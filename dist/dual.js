import {drama, demoSession} from './drama-config.mjs';
import {parseDate, shortDate, weekday, shiftMonth, monthCells, episodeLabel, releaseTime, getSummary} from './calendar-model.mjs';

const $ = id => document.getElementById(id);
const summary = getSummary(drama, demoSession.tier, demoSession.now);
const now = Date.parse(demoSession.now);
const tierName = drama.tiers[summary.tier];
const storageKey = `drama-month-calendar-v2:${drama.id}:${summary.tier}`;
let state = {watched:Math.min(demoSession.watched,summary.available), reminded:false};
let completed = new Set(Array.from({length:state.watched},(_,i)=>i+1));
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if(saved && Array.isArray(saved.completed)) {
    completed = new Set(saved.completed.filter(n=>Number.isInteger(n)&&n>0&&n<=summary.available));
    state.watched=0;
    while(completed.has(state.watched+1)) state.watched++;
    state.reminded=saved.reminded===true;
  }
} catch {}
let currentEpisode = summary.available?Math.min(state.watched+1, summary.available):1;
let playbackActive=false, activeScreen='calendar';
let selectedDate=summary.today, visibleMonth=summary.today.slice(0,7), dateExpanded=false;
let rewardReturn=null, toastTimer;
const player=document.querySelector('.video-poster video');
const screens=[...document.querySelectorAll('.screen')];
const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

document.documentElement.style.setProperty('--accent',drama.accent);
// Hidden screens must not compete for the large demo recording on first load.
function prepareVideo(video) {
  if(video && !video.hasAttribute('src')) video.src=drama.video;
}
document.querySelectorAll('[data-drama-title]').forEach(node=>node.textContent=drama.title);
document.querySelectorAll('[data-total]').forEach(node=>node.textContent=`全${drama.totalEpisodes}集 ›`);
$('calendarTitle').textContent=`《${drama.title}》追剧日历`;
$('demoContext').textContent=`演示账户 ${tierName} · 模拟时间 ${summary.today.replaceAll('-','.')} 19:00`;
$('accountTier').textContent=`${tierName} 排期`;
$('entrySummary').textContent=summary.finale?`${shortDate(summary.finale.date)}完结 · 查看你的更新安排`:'查看你的完整更新安排';

function saveProgress() {try{localStorage.setItem(storageKey,JSON.stringify({completed:[...completed],reminded:state.reminded}));}catch{}}
function showToast(message) {
  $('toast').textContent=message;$('toast').hidden=false;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2600);
}
function renderCalendar() {
  const [year,month]=visibleMonth.split('-').map(Number);
  $('monthHeading').textContent=`${year}年 ${month}月`;
  $('releaseGrid').setAttribute('aria-label',`${year}年${month}月更新日历`);
  $('releaseGrid').innerHTML=monthCells(visibleMonth).map(date=>{
    if(!date)return '<span class="day-blank" aria-hidden="true"></span>';
    const release=summary.releases.find(r=>r.date===date),isToday=date===summary.today,selected=date===selectedDate;
    const released=release && releaseTime(release)<=now;
    const milestone=release?.milestone==='premiere'?'开播':release?.milestone==='finale'?'完结':'';
    const label=milestone || (release?episodeLabel(release):'');
    const classes=['day-cell',release?'has-release':'',released?'released':'',isToday?'is-today':'',selected?'selected':'',release?.milestone==='finale'?'finale':''].filter(Boolean).join(' ');
    const accessible=`${shortDate(date)} ${weekday(date)}${isToday?'，今天':''}，${release?`${release.time} ${episodeLabel(release)}${milestone?'，'+milestone:''}${released?'，已更新':'，待更新'}`:'无更新'}`;
    return `<button class="${classes}" data-date="${date}" aria-label="${esc(accessible)}" aria-pressed="${selected}" ${isToday?'aria-current="date"':''}><span class="day-number">${parseDate(date).getUTCDate()}</span><span class="day-caption">${label||'&nbsp;'}</span></button>`;
  }).join('');
  renderSelectedRelease();
  $('nextDate').textContent=summary.next?`${shortDate(summary.next.date)} ${summary.next.time}`:'已全部更新';
  $('nextEpisodes').textContent=summary.next?`${weekday(summary.next.date)} · 更新${episodeLabel(summary.next)}`:`全${drama.totalEpisodes}集可观看`;
  $('jumpNext').disabled=!summary.next;
  $('finaleDate').textContent=summary.finale?`${shortDate(summary.finale.date)} 完结`:'待公布';
  $('finaleEpisodes').textContent=summary.finale?`${summary.finale.time} · ${releaseTime(summary.finale)>now?'届时':''}全${drama.totalEpisodes}集可看`:'完结时间尚未公布';
  $('jumpFinale').disabled=!summary.finale;
  $('toggleReminder').setAttribute('aria-pressed',String(state.reminded));
  $('reminderLabel').textContent=state.reminded?'已开启更新提醒':'更新时提醒我';
  $('toggleReminder').disabled=!summary.next;
  if(!summary.next)$('reminderLabel').textContent='已完结，无后续更新';
  $('collectionCount').textContent=`${drama.badges.filter(b=>b.episode<=state.watched).length}`;
}
function renderSelectedRelease() {
  $('selectedRelease').hidden=!dateExpanded;
  const release=summary.releases.find(r=>r.date===selectedDate);
  const released=release && releaseTime(release)<=now;
  const watched=release && release.to<=state.watched;
  const nextEpisode=release?Math.min(release.to,Math.max(release.from,state.watched+1)):0;
  const title=release?`${release.time} ${released?'已更新':'更新'} ${episodeLabel(release)}`:'这一天没有更新';
  const future=summary.releases.find(r=>r.date>selectedDate);
  const description=release?(release.milestone==='premiere'?'首播上线':release.milestone==='finale'?(released?'大结局 · 全剧已更新':'大结局 · 届时全剧可看'):`${tierName}专属排期`)+(watched?' · 已看完':released?' · 可观看':' · 待上线'):(future?`下一更新日：${shortDate(future.date)}`:summary.finale&&selectedDate>summary.finale.date?'此日期晚于完结日，无新增剧集':'更新安排待公布');
  $('selectedRelease').innerHTML=`<div class="date-marker"><strong>${parseDate(selectedDate).getUTCDate()}</strong><small>${weekday(selectedDate)}</small></div><div class="release-detail"><strong>${esc(title)}</strong><p>${esc(description)}</p></div>${released?`<button class="release-action" data-episode="${watched?release.from:nextEpisode}">${watched?'再看一遍':'去观看'} ›</button>`:'<span class="release-state">'+(release?'待更新':'无更新')+'</span>'}`;
}
function selectDate(date,focus=false) {
  selectedDate=date;visibleMonth=date.slice(0,7);dateExpanded=true;renderCalendar();
  if(focus)document.querySelector(`[data-date="${date}"]`)?.focus({preventScroll:true});
}
function renderEpisodes() {
  const markup=Array.from({length:drama.totalEpisodes},(_,i)=>{
    const n=i+1, selected=n===currentEpisode, locked=n>summary.available;
    return `<button class="episode-tile ${selected?'selected':''}" data-episode="${n}" aria-current="${selected}" aria-label="第${n}集${selected?'，当前播放':''}${locked?'，待更新':''}" ${locked?'disabled':''}>${summary.tier==='free'?'':`<small class="vip-tag">${tierName}</small>`}<strong>${n}</strong>${locked?'<span class="episode-pending">待更新</span>':''}</button>`;
  }).join('');
  document.querySelector('.episode-strip').innerHTML=markup;document.querySelector('.episode-grid').innerHTML=markup;
  player.setAttribute('aria-label',`${drama.title}第${currentEpisode}集播放`);
  const strip=document.querySelector('.episode-strip'),selected=strip.querySelector('.selected');
  if(selected)strip.scrollLeft=Math.max(0,selected.offsetLeft-strip.offsetLeft-strip.clientWidth/2+selected.offsetWidth/2);
  updatePlaybackControls();
}
function updatePlaybackControls() {
  $('playbackDemo').hidden=activeScreen!=='detail';
  $('finishEpisode').disabled=!playbackActive || !$('rewardOverlay').hidden || summary.available===0;
}
function showScreen(id,push=true) {
  if(!$('rewardOverlay').hidden)closeReward();
  if(!screens.some(screen=>screen.id===id))id='calendar';
  activeScreen=id;
  screens.forEach(screen=>{
    const active=screen.id===id;screen.classList.toggle('active',active);screen.inert=!active;screen.setAttribute('aria-hidden',String(!active));
    if(!active)screen.querySelectorAll('video').forEach(video=>video.pause());
  });
  prepareVideo($(id).querySelector('video'));
  $(id).scrollTop=0;
  if(id==='calendar'){
    renderCalendar();$('calendarScroll').scrollTop=0;document.querySelector('.calendar-preview').play().catch(()=>{});
  }
  if(id==='detail'){renderEpisodes();if(playbackActive&&!player.ended)player.play().catch(()=>{});}
  updatePlaybackControls();
  if(push && location.hash!==`#${id}`)history.pushState(null,'',`#${id}`);
}
function playEpisode(episode) {
  if(!Number.isInteger(episode)||episode<1||episode>summary.available)return;
  prepareVideo(player);
  currentEpisode=episode;playbackActive=true;player.pause();player.currentTime=0;
  showScreen('detail');renderEpisodes();player.play().catch(()=>showToast('点击播放器开始播放'));
}
function completeViewing() {
  if(activeScreen!=='detail'||!playbackActive||!$('rewardOverlay').hidden||currentEpisode<1||currentEpisode>summary.available)return;
  const previousWatched=state.watched,finished=currentEpisode;
  player.pause();playbackActive=false;completed.add(finished);
  while(completed.has(state.watched+1))state.watched++;
  saveProgress();renderCalendar();renderEpisodes();
  const earned=drama.badges.find(b=>b.episode>previousWatched&&b.episode<=state.watched);
  if(earned)showReward(earned.episode,true);
  else if(finished<summary.available)playEpisode(finished+1);
  else showToast('已追平当前更新，观看记录已同步');
}
function medallion(badge) {return `<span class="medallion ${state.watched<badge.episode?'locked':''}" aria-hidden="true">${esc(badge.glyph)}</span>`;}
function showReward(episode=null,celebrate=false) {
  if($('rewardOverlay').hidden)rewardReturn=document.activeElement;
  $('rewardOverlay').hidden=false;$(activeScreen).inert=true;
  const video=$(activeScreen).querySelector('video');
  $('rewardOverlay').style.top=`${video?.offsetHeight||168}px`;
  const badge=drama.badges.find(b=>b.episode===episode);
  $('rewardTitle').textContent=celebrate?'解锁一枚追剧纪念':badge?'追剧纪念':'我的追剧收藏';
  $('rewardContent').innerHTML=badge?`<div class="badge-detail">${medallion(badge)}<h3>${esc(badge.name)}</h3><p>${state.watched>=badge.episode?`已看完第${badge.episode}集 · 已自动收藏`:`看完第${badge.episode}集自动解锁`}<br>无需打卡，追剧的每一程都有记录。</p><button class="reward-primary" data-collection>查看我的收藏</button></div>`:`<p class="collection-intro">${esc(drama.title)} · 随故事走一程，留下一枚纪念。</p><div class="badge-grid">${drama.badges.map(b=>`<button data-badge="${b.episode}">${medallion(b)}<strong>${esc(b.name)}</strong><small>${state.watched>=b.episode?'✓ 已收藏':`第${b.episode}集解锁`}</small></button>`).join('')}</div><p class="collection-intro">观看记录自动点亮，不用手动领取。<br>这是本机演示收藏，不代表正式活动权益。</p><button class="reward-primary" data-close-reward>知道了</button>`;
  updatePlaybackControls();$('closeReward').focus({preventScroll:true});
}
function closeReward() {
  $('rewardOverlay').hidden=true;$(activeScreen).inert=false;updatePlaybackControls();
  const fallback=activeScreen==='calendar'?$('openCollection'):document.querySelector('.episode-strip .selected');
  (rewardReturn?.isConnected&&!rewardReturn.closest('[inert]')?rewardReturn:fallback)?.focus({preventScroll:true});
}
document.addEventListener('click',event=>{
  const date=event.target.closest('[data-date]');if(date)selectDate(date.dataset.date,true);
  const route=event.target.closest('[data-target]');if(route)showScreen(route.dataset.target);
  const episode=event.target.closest('[data-episode]');if(episode)playEpisode(Number(episode.dataset.episode));
  const badge=event.target.closest('[data-badge]');if(badge)showReward(Number(badge.dataset.badge));
  if(event.target.closest('[data-collection]'))showReward();
  if(event.target.closest('[data-close-reward]'))closeReward();
});
for(const [id,amount] of [['prevMonth',-1],['nextMonth',1]])$(id).onclick=()=>{
  visibleMonth=shiftMonth(visibleMonth,amount);
  selectedDate=visibleMonth===summary.today.slice(0,7)?summary.today:`${visibleMonth}-01`;
  dateExpanded=false;
  renderCalendar();
};
$('backToToday').onclick=()=>{dateExpanded=false;selectedDate=summary.today;visibleMonth=summary.today.slice(0,7);renderCalendar();};
$('jumpNext').onclick=()=>{if(summary.next)selectDate(summary.next.date);};
$('jumpFinale').onclick=()=>{if(summary.finale)selectDate(summary.finale.date);};
$('toggleReminder').onclick=()=>{
  state.reminded=!state.reminded;saveProgress();renderCalendar();
  showToast(state.reminded?'已开启更新提醒（演示）':'已关闭更新提醒');
};
$('openCollection').onclick=()=>showReward();$('closeReward').onclick=closeReward;
$('rewardOverlay').onclick=event=>{if(event.target===$('rewardOverlay'))closeReward();};
$('finishEpisode').onclick=completeViewing;
player.addEventListener('ended',completeViewing);
player.addEventListener('play',()=>{if(summary.available===0){player.pause();showToast('本剧尚未开播');return;}if(activeScreen==='detail'){playbackActive=true;updatePlaybackControls();}});
$('resetDemo').onclick=()=>{
  if(!$('rewardOverlay').hidden)closeReward();
  state={watched:Math.min(demoSession.watched,summary.available),reminded:false};
  completed=new Set(Array.from({length:state.watched},(_,i)=>i+1));
  currentEpisode=summary.available?Math.min(state.watched+1,summary.available):1;playbackActive=false;player.pause();player.currentTime=0;
  selectedDate=summary.today;visibleMonth=summary.today.slice(0,7);dateExpanded=false;
  saveProgress();$('toast').hidden=true;showScreen('calendar');
};
document.addEventListener('keydown',event=>{
  if($('rewardOverlay').hidden)return;
  if(event.key==='Escape')closeReward();
  if(event.key==='Tab') {
    const buttons=[...$('rewardOverlay').querySelectorAll('button')],first=buttons[0],last=buttons.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});
window.addEventListener('popstate',()=>showScreen(location.hash.slice(1)||'calendar',false));
function fitStage(){document.documentElement.style.setProperty('--demo-scale',window.innerWidth<=480?1:Math.min(1,Math.max(.75,(window.innerHeight-156)/810)));}
window.addEventListener('resize',fitStage);fitStage();renderEpisodes();renderCalendar();showScreen(location.hash.slice(1)||'calendar',false);
