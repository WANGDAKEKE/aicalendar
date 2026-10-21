import {drama, demoSession, demoScenarios} from './drama-config.mjs?v=2.6.1';
import {parseDate, shortDate, weekday, shiftMonth, monthCells, episodeLabel, getReleaseViewingState} from './calendar-model.mjs?v=2.6.1';
import {getTierContext} from './tier-model.mjs?v=2.6.1';
import {getBadgeProgress, getBadgeRelease, newlyUnlockedBadges} from './badge-model.mjs';
import {getDateOperations} from './operations-model.mjs';

const $ = id => document.getElementById(id);
let tierContext = getTierContext(drama, demoSession.tier, undefined, demoSession.now);
// Playback, saved history and reminders always use the authenticated account.
// Selecting another calendar is a preview, never an entitlement change.
const summary = tierContext.account;
const now = Date.parse(demoSession.now);
const tierName = drama.tiers[summary.tier];
const requestedScenario=new URLSearchParams(location.search).get('scenario');
let scenarioId=Object.hasOwn(demoScenarios,requestedScenario)?requestedScenario:demoSession.scenario;
// This schedule revision uses separate storage; previous demo records stay intact.
const storageBase = `drama-month-calendar-v3:${drama.id}:${summary.tier}`;
const storageKey = ()=>`${storageBase}:${scenarioId}`;
const validEpisode=n=>Number.isInteger(n)&&n>0&&n<=summary.available;
const initialCompleted=()=>new Set(demoScenarios[scenarioId].completed.filter(validEpisode));
let state = {reminded:false};
let completed = initialCompleted();
try {
  const saved = JSON.parse(localStorage.getItem(storageKey()));
  if(saved && Array.isArray(saved.completed)) {
    completed = new Set(saved.completed.filter(validEpisode));
    state.reminded=saved.reminded===true;
  }
} catch {}
const nextUnwatched=()=>Array.from({length:summary.available},(_,i)=>i+1).find(n=>!completed.has(n));
let currentEpisode = nextUnwatched()||summary.available||1;
let playbackActive=false, activeScreen='calendar', calendarReturn='episodes';
let selectedDate=demoScenarios[scenarioId].focusDate||summary.today, visibleMonth=selectedDate.slice(0,7), dateExpanded=false;
let rewardReturn=null, rewardResumeVideo=null, toastTimer;
let upgradeResumeVideo=null, upgradeReturn=null;
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
$('calendarTier').value=summary.tier;
$('calendarTier').setAttribute('aria-label',`切换会员排期，当前账号为${tierName}`);
$('demoScenario').innerHTML=Object.entries(demoScenarios).map(([id,scenario])=>`<option value="${esc(id)}">${esc(scenario.label)}</option>`).join('');
$('demoScenario').value=scenarioId;
const editorialTheme=drama.editorialTheme||{};
document.querySelector('.journey-art').innerHTML=editorialTheme.image?`<img src="${esc(editorialTheme.image)}" alt="" />`:'';
document.querySelectorAll('.editorial-entry').forEach(entry=>{
  entry.innerHTML=`<span class="editorial-entry-art" aria-hidden="true">${editorialTheme.image?`<img src="${esc(editorialTheme.image)}" alt="" />`:''}</span><span class="editorial-entry-copy"><small>追剧日历</small><strong>${esc(editorialTheme.entryTitle||drama.title)}</strong><span>${esc(editorialTheme.entryCaption||'查看你的更新安排')}</span></span><span class="editorial-entry-arrow" aria-hidden="true">›</span>`;
});

function saveProgress() {try{localStorage.setItem(storageKey(),JSON.stringify({completed:[...completed],reminded:state.reminded}));}catch{}}
function showToast(message) {
  $('toast').textContent=message;$('toast').hidden=false;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2600);
}
const medalMark='<svg viewBox="0 0 16 20" fill="none" aria-hidden="true"><path d="m4 12-1 6 5-2 5 2-1-6" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="7" r="5.5" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-width="1.5"/><path d="m8 4 1 2 2 .3-1.5 1.5.4 2.2L8 9l-1.9 1 .4-2.2L5 6.3 7 6Z" fill="currentColor"/></svg>';
const badgeProgress=badge=>getBadgeProgress(badge,completed);
const badgesForRelease=release=>release?drama.badges.filter(b=>b.episode>=release.from&&b.episode<=release.to):[];
const operationsForDate=date=>getDateOperations(drama,{tier:tierContext.preview.tier,date,now});
const pendingEpisodeLabel=episodes=>episodes.at(-1)-episodes[0]+1===episodes.length?episodeLabel({from:episodes[0],to:episodes.at(-1)}):`${episodes.join('、')}集`;
const isCatchUp=episode=>Number.isInteger(episode)&&!completed.has(episode)&&[...completed].some(n=>n>episode);
const viewingActionLabel=episode=>`${isCatchUp(episode)?'补看':'继续看'}第${episode}集`;
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
  const notes=highlights.map(item=>`<div class="operations-note"><span class="operations-icon" aria-hidden="true">${esc(item.icon)}</span><span>${esc(item.title)}</span><small>本集看点</small></div>`).join('');
  const activities=events.map(event=>`<article class="screening-card" aria-label="${esc(event.title)}活动说明"><header><strong>${esc(event.title)}</strong><span>${{upcoming:'未开始',live:'进行中',ended:'已结束'}[event.status]}</span></header><div class="screening-content"><span class="screening-ticket" aria-hidden="true">🎟️</span><div><strong>${event.status==='ended'?'活动场次：':'提前看 '}${episodeLabel(event)}</strong><p>${shortDate(event.date)} ${esc(event.time)}–${esc(event.endTime)}</p></div></div><p class="screening-access">${esc(event.accessNote||'需单独活动资格，不包含在常规会员排期中。')}</p></article>`).join('');
  return notes+activities;
}
function renderCalendar() {
  const calendar=tierContext.preview,previewing=calendar.tier!==summary.tier;
  $('calendarTier').value=calendar.tier;
  $('calendarTier').classList.toggle('is-preview',previewing);
  const [year,month]=visibleMonth.split('-').map(Number);
  $('monthHeading').textContent=`${year}年 ${month}月`;
  $('releaseGrid').setAttribute('aria-label',`${year}年${month}月更新日历`);
  $('releaseGrid').innerHTML=monthCells(visibleMonth).map(date=>{
    if(!date)return '<span class="day-blank" aria-hidden="true"></span>';
    const release=calendar.releases.find(r=>r.date===date),isToday=date===summary.today,selected=date===selectedDate;
    const viewing=getReleaseViewingState(release,completed,now);
    const released=viewing.nextEpisode!==null;
    const milestone=release?.milestone==='premiere'?'开播':release?.milestone==='finale'?'完结':'';
    const label=milestone || (release?episodeLabel(release):'');
    const operations=operationsForDate(date),hasEvent=operations.events.length>0;
    const classes=['day-cell',release?'has-release':'',`is-${viewing.status}`,isToday?'is-today':'',selected?'selected':'',release?.milestone==='finale'?'finale':'',hasEvent?'has-screening':''].filter(Boolean).join(' ');
    const badges=badgesForRelease(release),allEarned=badges.length&&badges.every(b=>badgeProgress(b).unlocked);
    const watchLabel=viewing.status==='watched'?'，已看完':viewing.pendingEpisodes.length?`，待看${pendingEpisodeLabel(viewing.pendingEpisodes)}`:'';
    const accessible=`${shortDate(date)} ${weekday(date)}${isToday?'，今天':''}，${release?`${release.time} ${episodeLabel(release)}${milestone?'，'+milestone:''}${released?'，已更新':'，待更新'}${watchLabel}`:'无常规更新'}${badges.length?`，勋章：${badges.map(b=>`${b.name}${badgeProgress(b).unlocked?'已点亮':'待解锁'}`).join('、')}`:''}${operations.highlights.length?`，本集看点：${operations.highlights.map(item=>item.title).join('、')}`:''}${hasEvent?`，另有${operations.events.map(event=>`${event.title} ${event.time}–${event.endTime}`).join('、')}，需单独活动资格`:''}`;
    const marker=badges.length?`<span class="day-reward ${allEarned?'earned':''}">${medalMark}</span>`:'';
    // Rewards own the corner. Content and events share the row below episodes;
    // an event takes priority there, while every note remains in date details.
    const content=`<span class="day-content-slot" aria-hidden="true">${hasEvent?'<span class="day-event-label">点映礼</span>':operations.highlights.slice(0,2).map(item=>`<span class="day-operation">${esc(item.icon)}</span>`).join('')}</span>`;
    const expandable=hasEvent||operations.highlights.length>0;
    return `<button class="${classes}" data-date="${date}" aria-label="${esc(accessible)}" aria-pressed="${selected}" ${expandable?`aria-expanded="${selected&&dateExpanded}" aria-controls="dateOperations"`:''} ${isToday?'aria-current="date"':''}><span class="day-number">${parseDate(date).getUTCDate()}</span><span class="day-caption"${label?'':' aria-hidden="true"'}>${label}</span>${content}${marker}</button>`;
  }).join('');
  renderDateOperations();
  const action=$('toggleReminder'),upgrade=tierContext.requiresUpgrade;
  action.classList.toggle('is-upgrade',upgrade);
  if(upgrade){
    action.removeAttribute('aria-pressed');
    action.setAttribute('aria-haspopup','dialog');
    action.setAttribute('aria-controls','upgradeOverlay');
    action.disabled=false;
    $('reminderLabel').textContent=`升级 ${drama.tiers[calendar.tier]}，抢先看`;
  }else{
    action.removeAttribute('aria-haspopup');action.removeAttribute('aria-controls');
    action.setAttribute('aria-pressed',String(state.reminded));
    action.disabled=!summary.next;
    $('reminderLabel').textContent=!summary.next?'已完结，无后续更新':previewing?`按我的 ${tierName} 排期提醒`:state.reminded?'已开启更新提醒':'更新时提醒我';
  }
  renderJourney();
}
function renderDateOperations() {
  const operations=operationsForDate(selectedDate);
  const content=dateExpanded?operationsMarkup(operations):'';
  $('dateOperations').hidden=!content;
  $('dateOperations').setAttribute('aria-label',`${shortDate(selectedDate)} ${weekday(selectedDate)}的看点与活动`);
  $('dateOperations').innerHTML=content;
}
function selectDate(date,focus=false,toggle=false) {
  const operations=operationsForDate(date),expandable=operations.events.length||operations.highlights.length;
  dateExpanded=Boolean(expandable)&&!(toggle&&date===selectedDate&&dateExpanded);
  selectedDate=date;visibleMonth=date.slice(0,7);renderCalendar();
  if(focus)document.querySelector(`[data-date="${date}"]`)?.focus({preventScroll:true});
  if(dateExpanded){
    const container=$('calendarScroll'),overflow=$('dateOperations').getBoundingClientRect().bottom-container.getBoundingClientRect().bottom+14;
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
  if(!$('upgradeOverlay').hidden)closeUpgrade();
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
    tierContext=getTierContext(drama,summary.tier,summary.tier,demoSession.now);
    dateExpanded=false;
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
  saveProgress();renderCalendar();renderEpisodes();
  const earned=newlyUnlockedBadges(drama.badges,beforeCompleted,completed);
  if(earned.length)showReward(earned.at(-1).episode,true,earned.length);
  else if(finished<summary.available)playEpisode(finished+1);
  else showToast(nextUnwatched()?'本集已看完，观看记录已同步':'已追平当前更新，观看记录已同步');
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
  if(p.nextEpisode<=summary.available)return `<button class="reward-primary" data-episode="${p.nextEpisode}">${viewingActionLabel(p.nextEpisode)} <span aria-hidden="true">→</span></button>`;
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
    $('rewardContent').innerHTML=`<div class="collection-overview"><p>《${esc(drama.title)}》</p><strong>${count}<span> / ${drama.badges.length} 枚已点亮</span></strong><small>不用每天打卡，按自己的节奏追剧就好。</small></div><div class="badge-grid">${drama.badges.map(b=>`<button data-badge="${b.episode}" aria-label="${esc(b.name)}，${badgeProgress(b).unlocked?'已点亮':`看完前${b.episode}集解锁`}">${medallion(b)}<strong>${esc(b.name)}</strong><small>${badgeProgress(b).unlocked?'✓ 已点亮':`前${b.episode}集`}</small></button>`).join('')}</div>${next?`<div class="next-badge"><small>下一枚纪念</small><strong>${esc(next.name)}</strong>${progressMarkup(next)}</div>${badgeAction(next)}`:'<div class="collection-complete">一路相伴，整段旅程都被珍藏。<br>三枚勋章已全部点亮。</div><button class="reward-primary" data-close-reward>收好了</button>'}<p class="collection-disclaimer">观看自动记录 · 勋章随观看进度点亮</p>`;
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
function showUpgrade() {
  if(!tierContext.requiresUpgrade||activeScreen!=='calendar')return;
  upgradeReturn=document.activeElement;
  const targetName=drama.tiers[tierContext.preview.tier];
  $('upgradeTier').textContent=targetName;
  $('upgradeTitle').textContent=`升级 ${targetName}，抢先看`;
  $('upgradeDescription').textContent=`当前为 ${tierName} · 正在预览 ${targetName} 排期`;
  $('upgradeAvailable').textContent=tierContext.preview.available?`今日可看至第 ${tierContext.preview.available} 集`:'提前了解更新安排';
  $('upgradeBenefit').textContent=tierContext.extraAvailable?`比当前会员多看 ${tierContext.extraAvailable} 集`:`查看 ${targetName} 专属更新安排`;
  $('confirmUpgrade').textContent=`升级 ${targetName}`;
  const video=document.querySelector('.calendar-preview');
  upgradeResumeVideo=video.paused?null:video;
  video.pause();
  $('upgradeOverlay').style.top=`${video.offsetHeight||168}px`;
  $('upgradeOverlay').hidden=false;$('calendar').inert=true;
  $('closeUpgrade').focus({preventScroll:true});
}
function closeUpgrade() {
  $('upgradeOverlay').hidden=true;$('calendar').inert=false;
  if(upgradeResumeVideo&&activeScreen==='calendar')upgradeResumeVideo.play().catch(()=>{});
  upgradeResumeVideo=null;
  const trigger=upgradeReturn?.isConnected&&upgradeReturn.matches('button:not(:disabled),select:not(:disabled)')&&!upgradeReturn.closest('[inert]')?upgradeReturn:$('calendarTier');
  if(activeScreen==='calendar')trigger.focus({preventScroll:true});
  upgradeReturn=null;
}
$('calendarTier').onchange=()=>{
  tierContext=getTierContext(drama,summary.tier,$('calendarTier').value,demoSession.now);
  dateExpanded=false;renderCalendar();
  if(tierContext.requiresUpgrade)showUpgrade();
};
$('closeUpgrade').onclick=closeUpgrade;
$('previewSchedule').onclick=closeUpgrade;
$('upgradeOverlay').onclick=event=>{if(event.target===$('upgradeOverlay'))closeUpgrade();};
$('confirmUpgrade').onclick=()=>{
  closeUpgrade();
  showToast(`演示版未接入会员支付，当前账号仍为 ${tierName}`);
};
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
  if(tierContext.requiresUpgrade){showUpgrade();return;}
  const previewing=tierContext.preview.tier!==summary.tier;
  state.reminded=previewing?true:!state.reminded;
  if(previewing){tierContext=getTierContext(drama,summary.tier,summary.tier,demoSession.now);dateExpanded=false;}
  saveProgress();renderCalendar();
  showToast(state.reminded?`已开启 ${tierName} 更新提醒`:'已关闭更新提醒');
};
$('openCollection').onclick=()=>showReward();$('closeReward').onclick=closeReward;
$('rewardOverlay').onclick=event=>{if(event.target===$('rewardOverlay'))closeReward();};
$('finishEpisode').onclick=completeViewing;
player.addEventListener('ended',completeViewing);
player.addEventListener('play',()=>{if(summary.available===0){player.pause();showToast('本剧尚未开播');return;}if(activeScreen==='detail'){playbackActive=true;updatePlaybackControls();}});
function resetDemo() {
  if(!$('rewardOverlay').hidden)closeReward();
  if(!$('upgradeOverlay').hidden)closeUpgrade();
  state={reminded:false};
  completed=initialCompleted();
  currentEpisode=nextUnwatched()||summary.available||1;playbackActive=false;player.pause();player.currentTime=0;
  selectedDate=demoScenarios[scenarioId].focusDate||summary.today;visibleMonth=selectedDate.slice(0,7);dateExpanded=false;
  saveProgress();$('toast').hidden=true;showScreen('calendar');
}
$('resetDemo').onclick=resetDemo;
$('resetDemoMobile').onclick=resetDemo;
$('demoScenario').onchange=()=>{
  saveProgress();scenarioId=$('demoScenario').value;
  const url=new URL(location.href);url.searchParams.set('scenario',scenarioId);history.replaceState(null,'',url);
  resetDemo();
};
document.addEventListener('keydown',event=>{
  const overlay=!$('upgradeOverlay').hidden?$('upgradeOverlay'):!$('rewardOverlay').hidden?$('rewardOverlay'):null;
  if(!overlay)return;
  if(event.key==='Escape'){event.preventDefault();overlay.id==='upgradeOverlay'?closeUpgrade():closeReward();return;}
  if(event.key==='Tab') {
    const buttons=[...overlay.querySelectorAll('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});
window.addEventListener('popstate',()=>showScreen(location.hash.slice(1)||'calendar',false));
function fitStage(){
  document.documentElement.style.setProperty('--demo-scale',window.innerWidth<=480?1:Math.min(1,Math.max(.75,(window.innerHeight-156)/810)));
  if(!$('rewardOverlay').hidden)$('rewardOverlay').style.top=`${$(activeScreen).querySelector('video')?.offsetHeight||168}px`;
  if(!$('upgradeOverlay').hidden)$('upgradeOverlay').style.top=`${document.querySelector('.calendar-preview').offsetHeight||168}px`;
}
window.addEventListener('resize',fitStage);fitStage();renderEpisodes();renderCalendar();showScreen(location.hash.slice(1)||'calendar',false);
