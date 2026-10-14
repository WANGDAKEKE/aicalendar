const $ = id => document.getElementById(id);
const rows = [
  ['周一 · 开播','9月3日',6,'1–6集','1–2集'], ['周二','9月4日',8,'7–8集','3集'],
  ['周三','9月5日',10,'9–10集','4集'], ['周四','9月6日',12,'11–12集','5集'],
  ['周五','9月7日',14,'13–14集','6集'], ['周六','9月8日',16,'15–16集','7集'],
  ['周日','9月9日',18,'17–18集','8集'], ['周一','9月10日',20,'19–20集','9集'],
  ['周二','9月11日',22,'21–22集','10集'], ['周三','9月12日',24,'23–24集','11集'],
  ['周三','9月13日',26,'25–26集','12集'], ['周三 · 完结','9月18日',28,'27–28集','13集'],
  ['周四 · 点映礼','9月28日',30,'29–30集','14集']
];
let state = {watched:8, available:10, subscribed:false, notification:null, selectedDay:5, alarm:0};
const progressKey='drama-demo-collection-v1';
let completedEpisodes=new Set(Array.from({length:8},(_,i)=>i+1));
try {
  const saved=JSON.parse(localStorage.getItem(progressKey));
  if(saved && Number.isInteger(saved.watched) && saved.watched>=0 && rows.some(r=>r[2]===saved.available) && saved.available>=saved.watched){
    state.watched=saved.watched;state.available=saved.available;
    completedEpisodes=new Set(Array.from({length:saved.watched},(_,i)=>i+1));
    if(Array.isArray(saved.completed))saved.completed.filter(n=>Number.isInteger(n)&&n>0&&n<=state.available).forEach(n=>completedEpisodes.add(n));
  }
} catch {}
let currentEpisode=Math.min(state.watched+1,state.available);
let playbackActive=false;
const badges=[
  {episode:10,name:'荔枝初程',subtitle:'一程相伴，一枚纪念',description:'从第一集的相遇，到第十集的同行。这段追剧时光，值得留下。',glyph:'荔',tone:'lychee'},
  {episode:18,name:'千里同路',subtitle:'故事过半，依然同行',description:'一路看到了第十八集，把这份陪伴收藏在长安的故事里。',glyph:'驿',tone:'jade'},
  {episode:30,name:'长安赴约',subtitle:'故事有终，相伴留痕',description:'从开篇到终章，感谢你陪这个故事走完全程。',glyph:'安',tone:'gold'}
];
let rewardReturn=null;
function saveProgress(){try{localStorage.setItem(progressKey,JSON.stringify({watched:state.watched,available:state.available,completed:[...completedEpisodes]}));}catch{}}
function badgeArt(badge,small=false){return `<span aria-hidden="true" class="medallion ${badge.tone} ${small?'mini':''} ${state.watched<badge.episode?'locked':''}"><span class="medallion-ring"><span class="medallion-flower">✦</span><b>${badge.glyph}</b><small>长安 · 追剧纪念</small></span></span>`;}
function showReward(episode=null,celebrate=false){
  if($('rewardOverlay').hidden)rewardReturn=document.activeElement;
  const badge=badges.find(b=>b.episode===episode);
  $('rewardOverlay').hidden=false;$(activeScreen).inert=true;
  $('rewardOverlay').style.top=activeScreen==='detail'?'202.5px':'254.5px';
  updatePlaybackControls();
  $('rewardOverlay').classList.toggle('celebrating',celebrate);
  $('rewardEyebrow').textContent=celebrate?'观看记录已同步 · 无需领取':'长安的荔枝 · 追剧收藏';
  $('rewardTitle').textContent=badge?(celebrate?'解锁一枚追剧纪念':state.watched>=episode?'我的纪念勋章':'勋章预览'):'我的追剧收藏';
  if(badge){
    const unlocked=state.watched>=episode;
    $('rewardContent').innerHTML=`<div class="badge-detail">${badgeArt(badge)}<span class="badge-status">${unlocked?'✓ 已自动收入收藏':'尚未解锁 · 可提前预览'}</span><h3>${badge.name}</h3><p class="badge-subtitle">${badge.subtitle}</p><p class="badge-description">${badge.description}</p><div class="badge-condition">${unlocked?`已看完第${episode}集 · 观看记录自动解锁`:`看完第${episode}集解锁 · 还差${episode-state.watched}集`}<div class="badge-meter"><i style="width:${Math.min(100,state.watched/episode*100)}%"></i></div><small>${unlocked?'关闭提示后依然保留，可随时回来查看':'无需连续打卡，晚几天看也不会清零'}</small></div><button class="reward-primary" data-reward-collection>查看我的收藏</button><button class="reward-secondary" data-reward-calendar>返回追剧日历</button></div>`;
  }else{
    const count=badges.filter(b=>state.watched>=b.episode).length;
    $('rewardContent').innerHTML=`<p class="collection-intro">随故事走一程，留下一枚纪念。</p><div class="collection-summary"><strong>${count}<small> / ${badges.length} 枚已收藏</small></strong><span>观看自动解锁</span></div><div class="badge-grid">${badges.map(b=>`<button data-badge="${b.episode}" aria-label="${state.watched>=b.episode?'查看':'预览'}${b.name}">${badgeArt(b,true)}<strong>${b.name}</strong><small>${state.watched>=b.episode?'✓ 已收藏':`第${b.episode}集解锁`}</small></button>`).join('')}</div><p class="collection-rule">按本剧观看记录自动点亮，不用手动领取。<br>奖励不失效，历史已看进度也会计入。</p><p class="collection-demo-note">本机演示收藏 · 不代表正式活动权益<br>点击页面外的「重新演示」会清空本次进度</p><button class="reward-primary" data-reward-calendar>返回追剧日历</button>`;
  }
  $('closeReward').focus({preventScroll:true});
}
function closeReward(){
  $('rewardOverlay').hidden=true;$(activeScreen).inert=false;
  const target=rewardReturn?.isConnected && !rewardReturn.closest('[inert]')?rewardReturn:activeScreen==='detail'?document.querySelector('.episode-strip [aria-current="true"]'):$('openCollection');
  target.focus({preventScroll:true});
  updatePlaybackControls();
}
let activeScreen = 'calendar';
let toastTimer;
const screens = [...document.querySelectorAll('.screen')];
for (const selector of ['.video-poster','.mini-player']) {
  const holder = document.querySelector(selector);
  holder.innerHTML = '<video src="./assets/drama-recording.mp4" controls muted playsinline preload="metadata" aria-label="剧集录屏播放"></video>' + (selector === '.mini-player' ? '<button class="video-back" data-target="detail" aria-label="返回详情页">‹</button>' : '');
}
const player = document.querySelector('.video-poster video');
player.addEventListener('ended', completeViewing);
player.addEventListener('play',()=>{if(activeScreen==='detail'){playbackActive=true;updatePlaybackControls();}});
function updatePlaybackControls(){
  $('playbackDemo').hidden=activeScreen!=='detail';
  $('finishEpisode').disabled=!playbackActive || !$('rewardOverlay').hidden;
  $('playbackDemoHint').textContent=playbackActive?'播完后记录进度，自动切换下一集':'本集已结束，可选集重看或查看追剧日历';
}
function renderEpisodes(){
  const markup=Array.from({length:30},(_,i)=>{
    const n=i+1,selected=n===currentEpisode,locked=n>state.available;
    return `<button type="button" class="episode-tile ${selected?'selected':''}" data-episode="${n}" aria-current="${selected}" aria-label="第${n}集${selected?'，当前播放':''}${locked?'，待更新':''}" ${locked?'disabled':''}><small class="vip-tag">VIP</small><strong>${n}</strong>${locked?'<span class="episode-pending">待更新</span>':''}</button>`;
  }).join('');
  document.querySelector('.episode-strip').innerHTML=markup;
  document.querySelector('.episode-grid').innerHTML=markup;
  player.setAttribute('aria-label',`长安的荔枝第${currentEpisode}集播放`);
  const strip=document.querySelector('.episode-strip'),selected=strip.querySelector('.selected');
  strip.scrollLeft=Math.max(0,selected.offsetLeft-strip.offsetLeft-strip.clientWidth/2+selected.offsetWidth/2);
  updatePlaybackControls();
}
function showToast(message) {
  $('toast').textContent = message; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>{$('toast').hidden=true;},2800);
}
function showScreen(id, push=true) {
  if(!$('rewardOverlay').hidden)closeReward();
  if(id==='watching')id='detail';
  if (!screens.some(s=>s.id===id)) id='calendar';
  activeScreen=id;
  screens.forEach(screen=>{
    const active=screen.id===id;
    screen.classList.toggle('active',active); screen.inert=!active;
    screen.setAttribute('aria-hidden',String(!active));
    screen.querySelectorAll('video').forEach(video=>{if(!active)video.pause();});
  });
  $(id).scrollTop=0;
  if(id==='calendar'){
    $('calendarScroll').scrollTop=0;
    document.querySelector('.calendar-preview').play().catch(()=>{});
  }
  if(id==='detail'){
    renderEpisodes();
    if(playbackActive && !player.ended)player.play().catch(()=>{});
  }
  updatePlaybackControls();
  if(push)history.pushState(null,'',`#${id}`);
}
function setSystem(view) {
  $('systemCalendar').hidden=view!=='calendar'; $('systemLock').hidden=view!=='lock';
  document.querySelectorAll('[data-system]').forEach(button=>button.classList.toggle('selected',button.dataset.system===view));
}
function upcomingRow() {return rows.find(row=>row[2]>state.available);}
function nextRow() {return upcomingRow() || rows[rows.length-1];}
function render() {
  renderEpisodes();
  const next=nextRow();
  $('nextUpdateLabel').textContent=upcomingRow()?`${next[1]} 18:00 · SVIP ${next[3]}`:'本剧已全部更新';
  $('reminderAction').textContent=state.subscribed?'管理提醒':'加入手机日历';
  $('reminderEpisode').textContent=next[3]; $('reminderWhen').textContent=`${next[1]} 18:00 更新`;
  $('addCalendar').textContent=state.subscribed?'保存提醒设置':'添加到手机日历';
  const earned=badges.filter(b=>state.watched>=b.episode),nextBadge=badges.find(b=>state.watched<b.episode);
  $('collectionCount').textContent=`${earned.length} / ${badges.length}`;
  $('collectionNext').textContent=nextBadge?`再看完${nextBadge.episode-state.watched}集，解锁「${nextBadge.name}」`:'全套已收藏，重温你的长安之旅';
  $('calendarRows').innerHTML=rows.map((r,i)=>{
    const watched=r[2]<=state.watched, available=r[2]<=state.available;
    const emoji=({2:'💎',6:'💎🌈',9:'🔥💛',10:'💛🚗'})[i] || '';
    const badge=badges.find(b=>b.episode===r[2]);
    const reward=badge?`<button class="row-badge ${watched?'earned':''}" data-badge="${badge.episode}" aria-label="${watched?'查看':'预览'}${badge.name}勋章"><span aria-hidden="true">${badge.glyph}</span><small>${watched?'已收藏':'待解锁'}</small></button>`:emoji?`<span class="emoji">${emoji}</span>`:'';
    return `<div class="calendar-row ${watched?'watched':''} ${r[2]===state.available?'today':''} ${r[0].includes('·')?'milestone':''}" role="row"><div class="date-cell" role="cell"><strong>${r[0]}</strong><small>${r[1]}</small></div><div class="episode-cell" role="cell">${r[3]}<span class="watched-mark">${watched?'✓ 已看':available?'可观看':'待更新'}</span>${reward}</div><div class="episode-cell" role="cell">${r[3]}${emoji?`<span class="emoji">${emoji}</span>`:''}</div><div class="episode-cell" role="cell">${r[4]}</div></div>`;
  }).join('');
  $('monthGrid').innerHTML=Array.from({length:35},(_,i)=>{
    const day=i-4; if(day<1||day>30)return '<span></span>';
    const hasEvent=state.subscribed && rows.slice(2).some(r=>parseInt(r[1].slice(2))===day);
    return `<button class="${day===state.selectedDay?'selected':''} ${hasEvent?'has-event':''}" data-day="${day}" aria-label="9月${day}日">${day}</button>`;
  }).join('');
  const currentDay=parseInt(rows.find(r=>r[2]===state.available)[1].slice(2));
  $('agendaDate').textContent=`9月${state.selectedDay}日${state.selectedDay===currentDay?' · 今天':''}`;
  $('agendaEmpty').hidden=state.subscribed; $('agendaEvents').hidden=!state.subscribed; $('calendarSource').hidden=!state.subscribed;
  const selected=rows.filter(r=>parseInt(r[1].slice(2))===state.selectedDay);
  $('agendaEvents').innerHTML=selected.length?selected.map(r=>`<article class="agenda-event ${r[2]<=state.watched?'done':''}"><time>18:00<small>18:45</small></time><div><small>腾讯视频 · SVIP</small><h4>长安的荔枝</h4><strong>${r[3]}${r[2]<=state.watched?' · 已看完':'更新'}</strong><p>${r[2]<=state.watched?'✓ 观看历史已同步':state.alarm?`更新前${state.alarm}分钟提醒`:'更新时提醒'}</p></div></article>`).join(''):'<p class="free-day">这一天没有追剧日程</p>';
  $('triggerReminder').disabled=!state.subscribed||!upcomingRow();
  $('systemHint').textContent=state.subscribed?`下一次：${next[1]} 18:00 · ${next[3]}`:'先在左侧添加追剧日历';
  $('lockNotification').hidden=!state.notification; $('noNotifications').hidden=!!state.notification;
}
function openSheet(open) {
  $('reminderSheet').hidden=!open; $(activeScreen).inert=open;
  if(open)$('closeReminder').focus(); else $('openReminder').focus();
}
function subscribe() {
  state.alarm=Number($('alarmTime').value); state.subscribed=true; state.selectedDay=parseInt(nextRow()[1].slice(2));
  render();openSheet(false);setSystem('calendar');
  showToast('已添加到右侧手机日历');
  document.querySelector('.system-phone').classList.remove('sync-flash');
  requestAnimationFrame(()=>document.querySelector('.system-phone').classList.add('sync-flash'));
}
function startWatching(fromNotification=false) {
  if(state.watched>=state.available)return;
  const episode=state.watched+1;
  playEpisode(episode);
  if(fromNotification){state.notification=null;render();}
}
function playEpisode(episode){
  if(!Number.isInteger(episode)||episode<1||episode>state.available)return;
  currentEpisode=episode;playbackActive=true;
  player.pause();player.currentTime=0;
  if(activeScreen!=='detail')showScreen('detail');
  renderEpisodes();player.play().catch(()=>showToast('点击播放器开始播放'));
}
function completeViewing() {
  if(activeScreen!=='detail'||!playbackActive)return;
  const previousWatched=state.watched;
  const finishedEpisode=currentEpisode;
  player.pause();playbackActive=false;completedEpisodes.add(finishedEpisode);
  while(completedEpisodes.has(state.watched+1))state.watched++;
  saveProgress();
  if(state.notification && state.watched>=state.notification[2])state.notification=null;
  state.selectedDay=parseInt(rows.find(r=>r[2]>=finishedEpisode)[1].slice(2));
  render();setSystem('calendar');
  const newlyEarned=badges.find(b=>b.episode>previousWatched && b.episode<=state.watched);
  if(newlyEarned){$('toast').hidden=true;showReward(newlyEarned.episode,true);}
  else if(finishedEpisode<state.available)playEpisode(finishedEpisode+1);
  else showToast('已追平当前更新，观看记录已同步');
}
function triggerNotification() {
  if(!state.subscribed||!upcomingRow())return;
  const release=upcomingRow();state.available=release[2];state.notification=release;state.selectedDay=parseInt(release[1].slice(2));
  saveProgress();
  $('lockDate').textContent=`${release[1]} · 剧集更新日`; $('lockTime').textContent='18:00'; $('systemClock').textContent='18:00';
  $('notificationTitle').textContent=`《长安的荔枝》${release[3]}已更新`;
  $('notificationBody').textContent=`你已看到第${state.watched}集，点击从第${state.watched+1}集接着看。`;
  render();setSystem('lock');
}
document.addEventListener('click',event=>{
  const badge=event.target.closest('[data-badge]');if(badge)showReward(Number(badge.dataset.badge));
  if(event.target.closest('[data-reward-collection]'))showReward();
  if(event.target.closest('[data-reward-close]'))closeReward();
  if(event.target.closest('[data-reward-calendar]')){closeReward();showScreen('calendar');$('calendarScroll').scrollTop=document.querySelector('.calendar-hero').offsetHeight;}
  const episode=event.target.closest('[data-episode]');if(episode)playEpisode(Number(episode.dataset.episode));
  const route=event.target.closest('[data-target]');if(route)showScreen(route.dataset.target);
  const view=event.target.closest('[data-system]');if(view)setSystem(view.dataset.system);
  const day=event.target.closest('[data-day]');if(day){state.selectedDay=Number(day.dataset.day);render();}
});
$('openReminder').onclick=()=>openSheet(true);$('closeReminder').onclick=()=>openSheet(false);$('pushOnly').onclick=()=>openSheet(false);
$('reminderSheet').onclick=event=>{if(event.target===$('reminderSheet'))openSheet(false);};
$('addCalendar').onclick=subscribe; $('finishEpisode').onclick=completeViewing;
$('triggerReminder').onclick=triggerNotification; $('lockNotification').onclick=()=>startWatching(true);
$('openCollection').onclick=()=>showReward();$('closeReward').onclick=closeReward;
$('rewardOverlay').onclick=event=>{if(event.target===$('rewardOverlay'))closeReward();};
$('resetDemo').onclick=()=>{
  if(!$('rewardOverlay').hidden)closeReward();
  state={watched:8,available:10,subscribed:false,notification:null,selectedDay:5,alarm:0};
  completedEpisodes=new Set(Array.from({length:8},(_,i)=>i+1));currentEpisode=9;playbackActive=false;player.pause();player.currentTime=0;
  saveProgress();
  $('alarmTime').value='0';$('reminderSheet').hidden=true;$('toast').hidden=true;
  $('lockDate').textContent='9月5日 星期三';$('lockTime').textContent='18:05';$('systemClock').textContent='18:05';
  render();setSystem('calendar');showScreen('calendar');
};
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
    if(!$('rewardOverlay').hidden)closeReward();
    else if(!$('reminderSheet').hidden)openSheet(false);
  }
  if(event.key==='Tab'&&!$('rewardOverlay').hidden){
    const buttons=[...$('rewardOverlay').querySelectorAll('button')];
    const first=buttons[0],last=buttons[buttons.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});
window.addEventListener('popstate',()=>showScreen(location.hash.slice(1)||'calendar',false));
function fitStage(){document.documentElement.style.setProperty('--demo-scale',Math.min(1,(window.innerWidth-24)/860));}
window.addEventListener('resize',fitStage);fitStage();render();showScreen(location.hash.slice(1)||'calendar',false);
