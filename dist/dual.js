import {drama, demoSession} from './drama-config.mjs?v=2.3.2';
import {parseDate, shortDate, weekday, shiftMonth, monthCells, episodeLabel, releaseTime, getSummary} from './calendar-model.mjs';
import {getBadgeProgress, getBadgeRelease, newlyUnlockedBadges} from './badge-model.mjs';
import {getDateOperations} from './operations-model.mjs';

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
let playbackActive=false, activeScreen='calendar', calendarReturn='episodes';
let selectedDate=summary.today, visibleMonth=summary.today.slice(0,7), dateExpanded=false;
let rewardReturn=null, rewardResumeVideo=null, toastTimer;
const player=document.querySelector('.video-poster video');
const screens=[...document.querySelectorAll('.screen')];
const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

document.documentElement.style.setProperty('--accent',drama.accent);
document.documentElement.style.setProperty('--editorial-tint',drama.editorialTheme?.tint||'#f7f0e3');
// Hidden screens must not compete for the large demo recording on first load.
function prepareVideo(video) {
  if(video && !video.hasAttribute('src')) video.src=drama.video;
}
document.querySelectorAll('[data-drama-title]').forEach(node=>node.textContent=drama.title);
document.querySelectorAll('[data-total]').forEach(node=>node.textContent=`全${drama.totalEpisodes}集 ›`);
$('calendarTitle').textContent=`《${drama.title}》追剧日历`;
$('demoContext').textContent=`演示账户 ${tierName} · 模拟时间 ${summary.today.replaceAll('-','.')} 19:00`;
$('accountTier').textContent=`${tierName} 排期`;
const editorialTheme=drama.editorialTheme||{};
document.querySelector('.journey-art').innerHTML=editorialTheme.image?`<img src="${esc(editorialTheme.image)}" alt="" />`:'';
document.querySelectorAll('.editorial-entry').forEach(entry=>{
  entry.innerHTML=`<span class="editorial-entry-art" aria-hidden="true">${editorialTheme.image?`<img src="${esc(editorialTheme.image)}" alt="" />`:''}</span><span class="editorial-entry-copy"><small>追剧日历</small><strong>${esc(editorialTheme.entryTitle||drama.title)}</strong><span>${esc(editorialTheme.entryCaption||'查看你的更新安排')}</span></span><span class="editorial-entry-arrow" aria-hidden="true">›</span>`;
});

function saveProgress() {try{localStorage.setItem(storageKey,JSON.stringify({completed:[...completed],reminded:state.reminded}));}catch{}}
function showToast(message) {
  $('toast').textContent=message;$('toast').hidden=false;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2600);
}
const medalMark='<svg viewBox="0 0 16 20" fill="none" aria-hidden="true"><path d="m4 12-1 6 5-2 5 2-1-6" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="7" r="5.5" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-width="1.5"/><path d="m8 4 1 2 2 .3-1.5 1.5.4 2.2L8 9l-1.9 1 .4-2.2L5 6.3 7 6Z" fill="currentColor"/></svg>';
const badgeProgress=badge=>getBadgeProgress(badge,completed);
const badgesForRelease=release=>release?drama.badges.filter(b=>b.episode>=release.from&&b.episode<=release.to):[];
const operationsForDate=date=>getDateOperations(drama,{tier:summary.tier,date,now});
function renderJourney() {
  const next=drama.badges.find(b=>!badgeProgress(b).unlocked),featured=next||drama.badges.at(-1);
  $('openCollection').hidden=!featured;
  if(!featured)return;
  const progress=badgeProgress(featured),count=drama.badges.filter(b=>badgeProgress(b).unlocked).length;
  $('journeyBadgeName').textContent=next?featured.name:'追剧旅程已点亮';
  $('journeyProgressText').textContent=next?`已看 ${progress.watchedCount}/${progress.total} 集`:`${count}/${drama.badges.length} 枚勋章`;
  $('journeyProgressFill').style.width=`${progress.watchedCount/progress.total*100}%`;
  $('journeyCaption').textContent=next?'观看自动点亮 · 我的勋章':'一路相伴 · 查看我的勋章';
  $('openCollection').setAttribute('aria-label',`查看我的勋章，${next?`${featured.name}，已看${progress.watchedCount}集，共${progress.total}集`:'全部勋章已点亮'}`);
}
function operationsMarkup({highlights,events}) {
  const notes=highlights.map(item=>`<div class="operations-note"><span class="operations-icon" aria-hidden="true">${esc(item.icon)}</span><span>${esc(item.title)}</span><small>运营看点 · 示例</small></div>`).join('');
  const activities=events.map(event=>`<article class="screening-card" aria-label="${esc(event.title)}活动说明"><header><strong>${esc(event.title)}</strong><span>${{upcoming:'未开始',live:'进行中',ended:'已结束'}[event.status]}</span></header><div class="screening-content"><span class="screening-ticket" aria-hidden="true">🎟️</span><div><strong>${event.status==='ended'?'活动场次：':'提前看 '}${episodeLabel(event)}</strong><p>${shortDate(event.date)} ${esc(event.time)}–${esc(event.endTime)}</p></div></div><p class="screening-access">${esc(event.accessNote||'需单独活动资格，不包含在常规会员排期中。')}</p><small class="screening-disclaimer">活动示例 · 无真实交易或播放授权</small></article>`).join('');
  return notes+activities;
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
    const operations=operationsForDate(date),hasEvent=operations.events.length>0,hasContent=hasEvent||operations.highlights.length>0;
    const classes=['day-cell',release?'has-release':'',released?'released':'',isToday?'is-today':'',selected?'selected':'',release?.milestone==='finale'?'finale':'',hasEvent?'has-screening':'',hasContent?'has-day-content':''].filter(Boolean).join(' ');
    const badges=badgesForRelease(release),allEarned=badges.length&&badges.every(b=>badgeProgress(b).unlocked);
    const accessible=`${shortDate(date)} ${weekday(date)}${isToday?'，今天':''}，${release?`${release.time} ${episodeLabel(release)}${milestone?'，'+milestone:''}${released?'，已更新':'，待更新'}`:'无常规更新'}${badges.length?`，勋章：${badges.map(b=>`${b.name}${badgeProgress(b).unlocked?'已点亮':'待解锁'}`).join('、')}`:''}${operations.highlights.length?`，运营看点示例：${operations.highlights.map(item=>item.title).join('、')}`:''}${hasEvent?`，另有${operations.events.map(event=>`${event.title} ${event.time}–${event.endTime}`).join('、')}，需单独活动资格`:''}`;
    const marker=badges.length?`<span class="day-reward ${allEarned?'earned':''}">${medalMark}</span>`:'';
    // Rewards own the corner. Content and events share the row below episodes;
    // an event takes priority there, while every note remains in date details.
    const content=hasContent?`<span class="day-content-slot" aria-hidden="true">${hasEvent?'<span class="day-event-label">点映礼</span>':operations.highlights.slice(0,2).map(item=>`<span class="day-operation">${esc(item.icon)}</span>`).join('')}</span>`:'';
    return `<button class="${classes}" data-date="${date}" aria-label="${esc(accessible)}" aria-pressed="${selected}" aria-expanded="${selected&&dateExpanded}" ${isToday?'aria-current="date"':''}><span class="day-number">${parseDate(date).getUTCDate()}</span><span class="day-caption">${label||'&nbsp;'}</span>${content}${marker}</button>`;
  }).join('');
  renderSelectedRelease();
  $('toggleReminder').setAttribute('aria-pressed',String(state.reminded));
  $('reminderLabel').textContent=state.reminded?'已开启更新提醒':'更新时提醒我';
  $('toggleReminder').disabled=!summary.next;
  if(!summary.next)$('reminderLabel').textContent='已完结，无后续更新';
  renderJourney();
}
function renderSelectedRelease() {
  $('selectedRelease').hidden=!dateExpanded;
  $('selectedRelease').setAttribute('aria-label',`${shortDate(selectedDate)} ${weekday(selectedDate)}的更新安排`);
  const release=summary.releases.find(r=>r.date===selectedDate);
  const operations=operationsForDate(selectedDate);
  const released=release && releaseTime(release)<=now;
  const watched=release && release.to<=state.watched;
  const nextEpisode=release?Math.min(release.to,Math.max(release.from,state.watched+1)):0;
  const title=release?`${release.time} ${operations.events.length?'常规':''}${released?'已更新':'更新'} ${episodeLabel(release)}`:operations.events.length?'这一天无常规更新':'这一天没有更新';
  const future=summary.releases.find(r=>r.date>selectedDate);
  const description=release?'':future?`下一更新日：${shortDate(future.date)}`:summary.finale&&selectedDate>summary.finale.date?'全剧排期已结束，无新增剧集':'更新安排待公布';
  $('selectedRelease').innerHTML=`<div class="release-summary"><div class="release-detail"><strong>${esc(title)}</strong>${description?`<p>${esc(description)}</p>`:''}</div>${released?`<button class="release-action" data-episode="${watched?release.from:nextEpisode}">${watched?'再看一遍':'去观看'} ›</button>`:release?'<span class="release-state">待更新</span>':''}</div>`;
  // Only show operational details after the user opens the date.
  if(dateExpanded)$('selectedRelease').insertAdjacentHTML('beforeend',operationsMarkup(operations));
}
function selectDate(date,focus=false,toggle=false) {
  dateExpanded=!(toggle&&date===selectedDate&&dateExpanded);
  selectedDate=date;visibleMonth=date.slice(0,7);renderCalendar();
  if(focus)document.querySelector(`[data-date="${date}"]`)?.focus({preventScroll:true});
  if(dateExpanded){
    const container=$('calendarScroll'),overflow=$('selectedRelease').getBoundingClientRect().bottom-container.getBoundingClientRect().bottom+14;
    if(overflow>0)container.scrollTop+=overflow;
  }
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
  $('playbackDemo').hidden=activeScreen!=='detail'||!$('rewardOverlay').hidden;
  $('finishEpisode').disabled=!playbackActive || !$('rewardOverlay').hidden || summary.available===0;
  $('finishEpisode').textContent=`快进到第${currentEpisode}集结束 →`;
}
function showScreen(id,push=true) {
  if(!$('rewardOverlay').hidden)closeReward();
  if(!screens.some(screen=>screen.id===id))id='calendar';
  if(id==='calendar'&&activeScreen!=='calendar')calendarReturn=activeScreen;
  document.querySelectorAll('[data-calendar-back]').forEach(button=>{
    button.dataset.target=calendarReturn;
    button.setAttribute('aria-label',`${button.classList.contains('collapse')?'收起追剧日历，':''}返回${calendarReturn==='detail'?'详情页':'选集页'}`);
  });
  activeScreen=id;
  screens.forEach(screen=>{
    const active=screen.id===id;screen.classList.toggle('active',active);screen.inert=!active;screen.setAttribute('aria-hidden',String(!active));
    if(!active)screen.querySelectorAll('video').forEach(video=>video.pause());
  });
  prepareVideo($(id).querySelector('video'));
  $(id).scrollTop=0;
  window.scrollTo({top:0,behavior:'instant'});
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
  const beforeCompleted=new Set(completed),finished=currentEpisode;
  player.pause();playbackActive=false;completed.add(finished);
  while(completed.has(state.watched+1))state.watched++;
  saveProgress();renderCalendar();renderEpisodes();
  const earned=newlyUnlockedBadges(drama.badges,beforeCompleted,completed);
  if(earned.length)showReward(earned.at(-1).episode,true,earned.length);
  else if(finished<summary.available)playEpisode(finished+1);
  else showToast('已追平当前更新，观看记录已同步');
}
function medallion(badge,preview=false) {
  const art={
    lychee:'<path d="M25 24c0-10 8-13 15-13-1 9-7 14-15 13Z"/><path d="M26 29c-9-12-22-1-17 13 4 11 19 13 24 1 3-7 0-12-7-14Z"/><path d="M26 29c1-7-4-12-9-14M16 33l2 2m7 2 2 2m-13 2 2 2m8 2 1 2"/><path d="M34 28c8-2 14 4 13 11-1 8-8 13-15 9"/>',
    journey:'<path d="m7 31 9-15 10 15M33 27l7-12 9 16M8 48h40M28 18v15c-16 0-18 7-6 8 13 1 17 4 8 7"/><path d="M28 13V6l12 4-12 4"/><circle cx="11" cy="9" r="3"/>',
    city:'<path d="M9 47h38M13 47V28h30v19M9 28h38l-9-6H18Z"/><path d="M20 22v-8h16v8M16 14h24L28 7ZM23 47V36a5 5 0 0 1 10 0v11M17 34v4m22-4v4M28 3v4"/>',
  };
  return `<span class="medallion ${badgeProgress(badge).unlocked?'earned':preview?'preview':'locked'}" aria-hidden="true"><span class="medal-art">${art[badge.icon]?`<svg viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${art[badge.icon]}</svg>`:esc(badge.glyph)}</span><span class="medal-ribbon"></span></span>`;
}
function progressMarkup(badge) {
  const p=badgeProgress(badge);
  return `<div class="badge-progress"><div><span>${p.unlocked?'已完成全部观看':`已看完 ${p.watchedCount} / ${p.total} 集`}</span><strong>${p.unlocked?'已点亮':`还差 ${p.remaining} 集`}</strong></div><div class="badge-progress-track" role="progressbar" aria-label="${esc(badge.name)}观看进度" aria-valuemin="0" aria-valuemax="${p.total}" aria-valuenow="${p.watchedCount}"><span style="width:${p.watchedCount/p.total*100}%"></span></div></div>`;
}
function badgeAction(badge) {
  const p=badgeProgress(badge),release=getBadgeRelease(badge,summary.releases);
  if(p.unlocked)return `<button class="reward-primary" data-badge-date="${badge.episode}">回日历查看勋章</button>`;
  if(p.nextEpisode<=summary.available)return `<button class="reward-primary" data-episode="${p.nextEpisode}">继续看第${p.nextEpisode}集 <span aria-hidden="true">→</span></button>`;
  return `<p class="badge-wait">${release?`${shortDate(release.date)} ${release.time}，解锁所需剧集全部上线`:'解锁所需剧集尚未全部上线'}</p><button class="reward-primary" data-badge-date="${badge.episode}">查看更新安排</button>`;
}
function showReward(episode=null,celebrate=false,earnedCount=1) {
  if($('rewardOverlay').hidden){
    rewardReturn=document.activeElement;
    const activeVideo=$(activeScreen).querySelector('video');
    rewardResumeVideo=activeVideo&&!activeVideo.paused?activeVideo:null;
    activeVideo?.pause();
  }
  $('rewardOverlay').hidden=false;$(activeScreen).inert=true;
  window.scrollTo({top:0,behavior:'instant'});
  const video=$(activeScreen).querySelector('video');
  $('rewardOverlay').style.top=`${video?.offsetHeight||168}px`;
  const badge=drama.badges.find(b=>b.episode===episode);
  $('rewardOverlay').classList.toggle('is-celebrating',celebrate);
  $('rewardTitle').textContent=celebrate?'这一程，谢谢你的陪伴':badge?'勋章故事':'我的追剧勋章';
  if(badge){
    const p=badgeProgress(badge);
    $('rewardContent').innerHTML=`<div class="badge-detail ${celebrate?'celebrating':''}"><div class="badge-artwork">${medallion(badge,true)}${celebrate?'<span class="badge-spark spark-one">✦</span><span class="badge-spark spark-two">✦</span><span class="badge-spark spark-three">✧</span>':''}</div><span class="badge-status">${p.unlocked?'✓ 已自动收入我的勋章':'待解锁 · 勋章预览'}</span><h3>${esc(badge.name)}</h3><p class="badge-story">${esc(badge.story||'每一段故事，都有你的陪伴。')}</p><div class="badge-rule"><strong>${p.unlocked?'你已看完':'解锁条件：看完'}前 ${badge.episode} 集</strong><span>观看历史自动同步，无需打卡或领取</span></div>${celebrate?`<p class="earned-note">${earnedCount>1?`本次点亮 ${earnedCount} 枚，已全部收入我的勋章`:'这枚勋章已点亮，随时回日历查看。'}</p><button class="reward-primary" data-close-reward>收好了</button><button class="reward-secondary" data-badge-date="${badge.episode}">回日历看看 →</button>`:`${progressMarkup(badge)}${badgeAction(badge)}<button class="reward-secondary" data-collection>查看全部勋章</button>`}</div>`;
  }else{
    const count=drama.badges.filter(b=>badgeProgress(b).unlocked).length,next=drama.badges.find(b=>!badgeProgress(b).unlocked);
    $('rewardContent').innerHTML=`<div class="collection-overview"><p>《${esc(drama.title)}》</p><strong>${count}<span> / ${drama.badges.length} 枚已点亮</span></strong><small>不用每天打卡，按自己的节奏追剧就好。</small></div><div class="badge-grid">${drama.badges.map(b=>`<button data-badge="${b.episode}" aria-label="${esc(b.name)}，${badgeProgress(b).unlocked?'已点亮':`看完前${b.episode}集解锁`}">${medallion(b)}<strong>${esc(b.name)}</strong><small>${badgeProgress(b).unlocked?'✓ 已点亮':`前${b.episode}集`}</small></button>`).join('')}</div>${next?`<div class="next-badge"><small>下一枚纪念</small><strong>${esc(next.name)}</strong>${progressMarkup(next)}</div>${badgeAction(next)}`:'<div class="collection-complete">一路相伴，整段旅程都被珍藏。<br>三枚勋章已全部点亮。</div><button class="reward-primary" data-close-reward>收好了</button>'}<p class="collection-disclaimer">观看自动记录 · 本机演示纪念，无实物或会员奖励</p>`;
  }
  document.querySelector('.reward-sheet').scrollTop=0;
  updatePlaybackControls();$('closeReward').focus({preventScroll:true});
}
function closeReward() {
  $('rewardOverlay').hidden=true;$(activeScreen).inert=false;updatePlaybackControls();
  if(rewardResumeVideo&&$(activeScreen).contains(rewardResumeVideo))rewardResumeVideo.play().catch(()=>{});
  rewardResumeVideo=null;
  const fallback=activeScreen==='calendar'?$('openCollection'):document.querySelector('.episode-strip .selected');
  const canReturn=rewardReturn?.isConnected&&rewardReturn.matches('button:not(:disabled),[tabindex="0"]')&&!rewardReturn.closest('[inert]');
  (canReturn?rewardReturn:fallback)?.focus({preventScroll:true});
}
document.addEventListener('click',event=>{
  const date=event.target.closest('[data-date]');if(date)selectDate(date.dataset.date,true,true);
  const route=event.target.closest('[data-target]');if(route)showScreen(route.dataset.target);
  const episode=event.target.closest('[data-episode]');if(episode)playEpisode(Number(episode.dataset.episode));
  const badge=event.target.closest('[data-badge]');if(badge)showReward(Number(badge.dataset.badge));
  const badgeDate=event.target.closest('[data-badge-date]');if(badgeDate){
    const b=drama.badges.find(b=>b.episode===Number(badgeDate.dataset.badgeDate)),release=b&&getBadgeRelease(b,summary.releases);
    showScreen('calendar');if(release)selectDate(release.date,true);
  }
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
$('toggleReminder').onclick=()=>{
  state.reminded=!state.reminded;saveProgress();renderCalendar();
  showToast(state.reminded?'已开启更新提醒（演示）':'已关闭更新提醒');
};
$('openCollection').onclick=()=>showReward();$('closeReward').onclick=closeReward;
$('rewardOverlay').onclick=event=>{if(event.target===$('rewardOverlay'))closeReward();};
$('finishEpisode').onclick=completeViewing;
player.addEventListener('ended',completeViewing);
player.addEventListener('play',()=>{if(summary.available===0){player.pause();showToast('本剧尚未开播');return;}if(activeScreen==='detail'){playbackActive=true;updatePlaybackControls();}});
function resetDemo() {
  if(!$('rewardOverlay').hidden)closeReward();
  state={watched:Math.min(demoSession.watched,summary.available),reminded:false};
  completed=new Set(Array.from({length:state.watched},(_,i)=>i+1));
  currentEpisode=summary.available?Math.min(state.watched+1,summary.available):1;playbackActive=false;player.pause();player.currentTime=0;
  selectedDate=summary.today;visibleMonth=summary.today.slice(0,7);dateExpanded=false;
  saveProgress();$('toast').hidden=true;showScreen('calendar');
}
$('resetDemo').onclick=resetDemo;
$('resetDemoMobile').onclick=resetDemo;
document.addEventListener('keydown',event=>{
  if($('rewardOverlay').hidden)return;
  if(event.key==='Escape')closeReward();
  if(event.key==='Tab') {
    const buttons=[...$('rewardOverlay').querySelectorAll('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});
window.addEventListener('popstate',()=>showScreen(location.hash.slice(1)||'calendar',false));
function fitStage(){
  document.documentElement.style.setProperty('--demo-scale',window.innerWidth<=480?1:Math.min(1,Math.max(.75,(window.innerHeight-156)/810)));
  if(!$('rewardOverlay').hidden)$('rewardOverlay').style.top=`${$(activeScreen).querySelector('video')?.offsetHeight||168}px`;
}
window.addEventListener('resize',fitStage);fitStage();renderEpisodes();renderCalendar();showScreen(location.hash.slice(1)||'calendar',false);
