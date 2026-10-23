import {createLabStore,selectLab} from './lab-store.mjs';
import {mountAdmin} from './lab-admin.mjs';
import {renderJourney,penguinArt,getPenguinState} from './lab-journey.mjs';
import {selectMarketing} from './lab-marketing.mjs';
import {monthCells,shiftMonth,getSchedule,getReleaseViewingState,episodeLabel,shortDate} from './calendar-model.mjs';
import {getTierContext} from './tier-model.mjs';
import {getDateOperations} from './operations-model.mjs';
import {ticketLevels,getTicketProgress} from './ticket-model.mjs';
import {renderTicketPanel} from './ticket-view.mjs';
import {createTicketDownload} from './ticket-download.mjs';
import {renderWidgetPreview,renderWidgetDesktop} from './lab-widget.mjs?v=2.9.0';

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store=createLabStore();
let view=selectLab(store.getState()),previewTier=view.user.tier,visibleMonth=view.today.slice(0,7),selectedDate=view.today;
let playingEpisode=null,playingUser=null,modal=null,modalReturn=null,resumeVideo=false,toastTimer,downloadBusy=false,modalPayload=null;
const video=$('labVideo');
function dispatch(action){const result=store.dispatch({...action,source:'front',expectedUserId:view.user.id});if(!result.ok)toast(result.error);return result;}
function log(kind,label){return dispatch({type:'LOG_EVENT',kind,label});}
function toast(message){$('labToast').textContent=message;$('labToast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('labToast').hidden=true,2800);}

function renderCalendar(){
  const {drama,user,today,now,campaign}=view;
  const schedule=getSchedule(drama,previewTier).releases;
  const [year,month]=visibleMonth.split('-');
  $('labMonth').textContent=`${year}年 ${Number(month)}月`;
  $('labTier').value=previewTier;
  $('labDays').innerHTML=monthCells(visibleMonth).map(date=>{
    if(!date)return '<span aria-hidden="true"></span>';
    const release=schedule.find(r=>r.date===date);
    const watching=getReleaseViewingState(release,new Set(user.completed),now);
    const ops=getDateOperations(drama,{tier:previewTier,date,now});
    const event=campaign.screeningEnabled&&ops.events[0];
    const milestone=release?.milestone;
    const caption=milestone==='premiere'?'<span class="milestone">开播</span>':milestone==='finale'?'<span class="finale-tag">完结</span>':release?episodeLabel(release):'';
    const hint=event?'<span class="event-tag">点映礼</span>':ops.highlights.slice(0,2).map(item=>esc(item.icon)).join('');
    const history=watching.status==='watched'?'已看完':watching.status==='partial'?'部分已看':watching.status==='unwatched'?'待看':'待更新';
    return `<button class="lab-day ${release?'has-release':''} is-${watching.status} ${date===today?'is-today':''} ${date===selectedDate?'is-selected':''}" data-lab-date="${date}" aria-label="${shortDate(date)}${date===today?'，今天':''}，${release?`${release.time} 更新${episodeLabel(release)}，${history}`:'无更新'}${event?'，点映礼':''}" aria-pressed="${date===selectedDate}" ${date===today?'aria-current="date"':''}><strong>${Number(date.slice(-2))}</strong>${date===today?'<span class="today-dot">今</span>':''}<small>${caption}</small><span class="day-content" aria-hidden="true">${hint}</span></button>`;
  }).join('');
}
function renderMarketing(){
  const offer=selectMarketing(view);
  $('labMarketing').hidden=!offer;
  if(!offer){$('labMarketing').innerHTML='';return;}
  $('labMarketing').innerHTML=`<article class="lab-offer ${offer.kind==='screening'?'olive':''}"><div class="lab-offer-kicker"><b>${offer.kind==='screening'?'特别企划':view.drama.tiers[offer.target]}</b>${esc(view.campaign.headline)}</div><div class="lab-offer-main"><div><strong>${esc(offer.title)}</strong><p>${esc(offer.caption)}</p></div><button data-lab-offer="${offer.kind}">${esc(offer.button)} ›</button></div></article>`;
}
function render(){
  $('labUserLabel').textContent=`${view.user.name} · ${view.drama.tiers[view.user.tier]}`;
  $('labJourney').innerHTML=renderJourney(view);
  renderCalendar();renderMarketing();
  $('labReminder').disabled=!view.summary.next;
  $('labReminder').setAttribute('aria-pressed',String(view.user.reminded));
  $('labReminder').textContent=!view.summary.next?'全剧已更新，慢慢看也没关系':view.user.reminded?'✓ 已开启我的更新提醒':'♧ 更新时提醒我';
  $('labPlaybackControl').hidden=playingEpisode===null;
  $('labPlaybackLabel').textContent=playingEpisode?`第 ${playingEpisode} 集 · 播放演示`:'';
  $('labFinish').textContent=playingEpisode?`模拟看完第 ${playingEpisode} 集 →`:'模拟看完本集 →';
  $('labVideoBadge').textContent=playingEpisode?`正在播放 · 第 ${playingEpisode} 集`:'剧集预览';
}
function refreshModal(){
  if(modal==='ticket')renderTicket(modalPayload?.level,modalPayload?.celebrate);
  if(modal==='widget')renderWidget();
  if(modal==='player')renderEpisodePicker();
  if(modal==='membership')renderMembership(modalPayload?.target);
  if(modal==='screening')renderScreening();
}
store.subscribe(()=>{
  const next=selectLab(store.getState());
  const identityChanged=next.user.id!==view.user.id;
  const tierChanged=next.user.tier!==view.user.tier;
  if(identityChanged||tierChanged)previewTier=next.user.tier;
  if(identityChanged||next.today!==view.today){selectedDate=next.today;visibleMonth=next.today.slice(0,7);}
  view=next;
  if(playingEpisode!==null&&(identityChanged||!view.availableEpisodes.includes(playingEpisode))){video.pause();playingEpisode=null;playingUser=null;resumeVideo=false;}
  if(identityChanged)closeDialog();
  render();refreshModal();
});

function openDialog(kind,title,kicker,payload={}){
  if($('labDialog').hidden){modalReturn=document.activeElement;resumeVideo=!video.paused;video.pause();}
  modal=kind;modalPayload=payload;
  $('labDialogTitle').textContent=title;$('labDialogKicker').textContent=kicker;$('labDialogKicker').hidden=!kicker;
  $('labDialog').dataset.scene=kind;$('labDialogClose').setAttribute('aria-label','关闭面板');
  $('labDialog').hidden=false;
  $('labPhoneScroll').inert=true;document.querySelector('.lab-calendar-title').inert=true;document.querySelector('.lab-video').inert=true;
  $('labDialogClose').focus({preventScroll:true});
}
function closeDialog(){
  modal=null;modalPayload=null;$('labDialog').hidden=true;delete $('labDialog').dataset.scene;
  $('labPhoneScroll').inert=false;document.querySelector('.lab-calendar-title').inert=false;document.querySelector('.lab-video').inert=false;
  if(resumeVideo)video.play().catch(()=>{});resumeVideo=false;
  if(modalReturn?.isConnected&&!modalReturn.closest('[inert]'))modalReturn.focus({preventScroll:true});
}
function renderTicket(level=1,celebrate=false){
  const next=view.progress.nextProgress?.nextEpisode;
  // The existing panel uses a contiguous bound. Pass only the actual next
  // episode after checking the authoritative per-episode set.
  const available=next&&view.availableEpisodes.includes(next)?next:0;
  const companion=celebrate&&view.progress.currentLevel>0&&level<=view.progress.currentLevel
    ? `<div class="lab-reward-companion">${penguinArt(getPenguinState(view.progress),'unlock')}<div><strong>${view.progress.currentLevel===3?'追完啦！鹅先撒个花':view.progress.currentLevel===1?'睡醒了！第一张票到手':'这张票，鹅先炫一下！'}</strong><p>${esc(view.progress.current?.name)}已收好，点下面保存留念</p></div></div>` : '';
  $('labDialogBody').innerHTML=companion+renderTicketPanel({drama:view.drama,progress:view.progress,levels:ticketLevels,selectedLevel:level,celebrate,available,today:view.today,serial:view.user.ticketSerial});
}
function showTicket(level=1,celebrate=false){
  openDialog('ticket',celebrate?(level===1?'你的第一张电子票':'电子票升级啦！'):'我的成长电子票','观看自动记录 · 每一程都算数',{level,celebrate});
  renderTicket(level,celebrate);
}
function renderEpisodePicker(){
  $('labDialogBody').innerHTML=`<p class="lab-picker-title">选择已上线的剧集继续观看 · 当前 ${view.drama.tiers[view.user.tier]}</p><div class="lab-episode-grid">${Array.from({length:view.drama.totalEpisodes},(_,i)=>{
    const n=i+1,available=view.availableEpisodes.includes(n),watched=view.user.completed.includes(n);
    return `<button class="lab-episode ${n===playingEpisode?'is-current':''} ${watched?'is-complete':''}" data-lab-play="${n}" ${available?'':'disabled'} aria-label="第${n}集，${!available?'当前权益未上线':watched?'已看完':'可观看'}">${n}</button>`;
  }).join('')}</div><p class="lab-fine-print">每段录屏代表一集；点击手机下方的模拟按钮可快进到本集结束。</p>`;
}
function showPlayer(){openDialog('player','选一集，接着看','长安的荔枝 · 全30集');renderEpisodePicker();}
function playEpisode(episode){
  if(!view.availableEpisodes.includes(episode)){toast('当前会员暂不可观看这一集');return;}
  closeDialog();playingEpisode=episode;playingUser=view.user.id;video.pause();video.loop=false;video.currentTime=0;video.play().catch(()=>toast('点击播放器开始播放'));render();
}
function finishEpisode(){
  if(playingEpisode===null||playingUser!==view.user.id||!$('labDialog').hidden)return;
  const episode=playingEpisode,before=view.progress.currentLevel;
  video.pause();playingEpisode=null;playingUser=null;
  const result=dispatch({type:'COMPLETE_EPISODE',episode});
  if(!result.ok){render();return;}
  if(result.changed&&view.progress.currentLevel>before){showTicket(view.progress.currentLevel,true);}
  else{toast(`第 ${episode} 集已看完，后台记录已同步`);}
  render();
}
function renderMembership(target){
  const context=getTierContext(view.drama,view.user.tier,target,view.now);
  if(!context.requiresUpgrade){$('labDialogBody').innerHTML='<p class="lab-fine-print">当前账号已拥有此权益，无需重复升级。</p><button class="lab-primary" data-lab-close>返回日历</button>';return;}
  const name=view.drama.tiers[target];
  $('labDialogBody').innerHTML=`<div class="lab-benefit"><strong>今日可看至第 ${context.preview.available} 集</strong><p>${context.extraAvailable?`比当前权益多看 ${context.extraAvailable} 集`:'了解专属排期，提前安排追剧'}</p></div><p class="lab-fine-print">当前为 ${view.drama.tiers[view.user.tier]}。查看推荐或排期不会改变会员身份。</p><button class="lab-primary" data-lab-purchase="${target}">${view.user.tier==='free'?'开通':'升级'} ${name}</button><button class="lab-secondary" data-lab-close>先看看</button><p class="lab-fine-print">此原型未接入支付；可在右侧虚拟后台切换演示会员身份。</p>`;
}
function showMembership(target){openDialog('membership',`${view.user.tier==='free'?'开通':'升级'} ${view.drama.tiers[target]}，先一步看到`,'会员权益 · 更多精彩',{target});renderMembership(target);}
function renderScreening(){
  const offer=selectMarketing({...view,campaign:{...view.campaign,enabled:true,mode:'screening'}});
  if(!offer){$('labDialogBody').innerHTML='<p class="lab-fine-print">本场活动已结束或暂未开放，敬请期待下一次相聚。</p><button class="lab-primary" data-lab-close>返回日历</button>';return;}
  const event=offer.event;
  $('labDialogBody').innerHTML=`<div class="lab-screening-detail"><small>长安的荔枝 · 大结局点映礼</small><p><strong>${episodeLabel(event)}</strong> 提前赴约</p><p>${shortDate(event.date)} ${event.time}—${event.endTime}</p></div><p class="lab-fine-print">${esc(event.accessNote)}<br>点映礼独立于常规会员排期，了解活动不会自动获得观看资格。</p><button class="lab-primary" data-lab-event-reminder>关注活动安排</button><p class="lab-fine-print">此处只记录演示意向，不发送真实提醒或购买门票。</p>`;
}
function showScreening(){openDialog('screening','一起赴长安之约','特别企划 · 点映礼');renderScreening();}
function renderWidget(){
  const desktop=modalPayload?.stage==='desktop';
  $('labDialog').dataset.scene=desktop?'widget-desktop':'widget-preview';
  $('labDialogTitle').textContent=desktop?'演示桌面':'添加到桌面';
  $('labDialogClose').setAttribute('aria-label',desktop?'返回追剧日历':'关闭面板');
  $('labDialogBody').innerHTML=desktop?renderWidgetDesktop(view):renderWidgetPreview(view);
}
async function saveTicket(button){
  if(downloadBusy)return;
  const level=Number(button.dataset.saveTicket),snapshot=selectLab(store.getState()),revision=store.getState().revision;
  if(level>snapshot.progress.currentLevel){toast('票面尚未解锁');return;}
  downloadBusy=true;button.disabled=true;button.textContent='正在生成…';
  try{
    const file=await createTicketDownload({drama:snapshot.drama,completed:new Set(snapshot.user.completed),level,today:snapshot.today,serial:snapshot.user.ticketSerial});
    // A user switch while the PNG is generated must not download or log for
    // another user, or revive a ticket after an admin reset.
    const current=selectLab(store.getState());
    if(store.getState().revision!==revision||current.user.id!==snapshot.user.id||current.progress.currentLevel<level){toast('演示数据已变化，请重新下载当前票面');return;}
    const url=URL.createObjectURL(file.blob),a=document.createElement('a');a.href=url;a.download=file.filename;a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    log('ticket_download_requested',`发起下载${ticketLevels.find(t=>t.level===level).name}`);toast('已发起下载，请在浏览器下载中查看');
  }catch(error){toast(error.message||'图片生成失败，请重试');}
  finally{downloadBusy=false;if(modal==='ticket')renderTicket(modalPayload.level,modalPayload.celebrate);}
}

$('labTier').onchange=()=>{previewTier=$('labTier').value;renderCalendar();if(getTierContext(view.drama,view.user.tier,previewTier,view.now).requiresUpgrade)showMembership(previewTier);};
$('labPrev').onclick=()=>{visibleMonth=shiftMonth(visibleMonth,-1);renderCalendar();};
$('labNext').onclick=()=>{visibleMonth=shiftMonth(visibleMonth,1);renderCalendar();};
$('labToday').onclick=()=>{visibleMonth=view.today.slice(0,7);selectedDate=view.today;renderCalendar();};
$('labReminder').onclick=()=>{const result=dispatch({type:'TOGGLE_REMINDER'});if(result.ok)toast(view.user.reminded?'更新提醒已开启，后台已同步':'更新提醒已关闭');};
$('labOpenPlayer').onclick=showPlayer;$('labFinish').onclick=finishEpisode;
video.addEventListener('ended',finishEpisode);
$('labDialogClose').onclick=closeDialog;
$('labDialog').onclick=event=>{if(event.target===$('labDialog'))closeDialog();};
document.addEventListener('click',event=>{
  const target=event.target.closest('button');if(!target)return;
  if(target.matches('[data-view-switch]')){if(modal)closeDialog();document.body.dataset.view=target.dataset.viewSwitch;document.querySelectorAll('[data-view-switch]').forEach(b=>b.setAttribute('aria-pressed',String(b===target)));target.focus({preventScroll:true});}
  if(target.matches('[data-lab-ticket]'))showTicket(Number(target.dataset.labTicket));
  if(target.matches('[data-ticket-level]'))showTicket(Number(target.dataset.ticketLevel));
  if(target.matches('[data-lab-widget]')){log('widget_preview','查看桌面小组件预览');document.querySelector('[data-lab-widget]').focus({preventScroll:true});openDialog('widget','添加到桌面','',{stage:'preview'});renderWidget();}
  if(target.matches('[data-lab-widget-add]')&&modal==='widget'&&modalPayload?.stage==='preview'){
    const result=log('widget_added','将追剧组件放入演示桌面（非系统安装）');
    if(result.ok){modalPayload.stage='desktop';renderWidget();$('labDialogBody').querySelector('[data-lab-widget-open]').focus({preventScroll:true});}
  }
  if(target.matches('[data-lab-widget-penguin]')&&modal==='widget'){
    // Separate sibling controls: petting the penguin must never launch playback.
    const result=log('penguin_tap','戳戳桌面组件里的企鹅');
    if(result.ok){
      const penguin=$('labDialogBody').querySelector('[data-lab-widget-penguin]');
      const state=getPenguinState(view.progress);
      const reply={sleep:'唔…再眯一会儿',awake:'抱紧我的票！',proud:'嘿嘿，看我的！',celebrate:'一起撒花！'}[state];
      penguin.innerHTML=penguinArt(state,'poke')+`<span class="lab-widget-reaction" role="status" aria-live="polite">${reply}</span>`;
      penguin.focus({preventScroll:true});
      setTimeout(()=>{if(penguin.isConnected)penguin.innerHTML=penguinArt(state)+'<span class="lab-widget-reaction" role="status" aria-live="polite"></span>';},1800);
    }
  }
  if(target.matches('[data-lab-widget-open]')&&modal==='widget'&&modalPayload?.stage==='desktop'){
    // Recompute from the current account; the displayed desktop is never an entitlement.
    const episode=view.availableEpisodes.find(n=>!view.user.completed.includes(n));
    const result=log('widget_open','从演示桌面返回追剧页面');
    if(result.ok){if(episode)playEpisode(episode);else closeDialog();}
  }
  if(target.matches('[data-lab-penguin]')){
    log('penguin_tap','和企鹅搭子打招呼');
    const penguin=document.querySelector('[data-lab-penguin]'),speech=document.querySelector('.lab-journey__speech'),originalSpeech=speech.textContent,state=getPenguinState(view.progress);
    penguin.innerHTML=penguinArt(state,'poke');
    // LOG_EVENT re-renders the journey; retain keyboard focus on its new button.
    penguin.focus({preventScroll:true});
    speech.textContent={sleep:'嗯？鹅再眯一小会儿…',awake:'票抱紧了，谁也不给！',proud:'给你看一眼，就一眼～',celebrate:'这排面，咱俩一起挣的！'}[state];
    setTimeout(()=>{if(penguin.isConnected){penguin.innerHTML=penguinArt(state);speech.textContent=originalSpeech;}},2600);
  }
  if(target.matches('[data-lab-date]')){
    selectedDate=target.dataset.labDate;renderCalendar();
    if(view.campaign.screeningEnabled&&getDateOperations(view.drama,{tier:previewTier,date:selectedDate,now:view.now}).events.length)showScreening();
  }
  if(target.matches('[data-lab-offer]')){
    const screening=target.dataset.labOffer==='screening';
    log('marketing_click',screening?'查看点映礼活动':'查看会员提前看权益');
    if(screening)showScreening();else showMembership(view.user.tier==='free'?'vip':'svip');
  }
  if(target.matches('[data-lab-purchase]')){log('marketing_click',`点击${view.drama.tiers[target.dataset.labPurchase]}开通入口（未支付）`);toast('演示未接入支付，真实会员身份未改变');}
  if(target.matches('[data-lab-event-reminder]')){log('marketing_click','关注点映礼活动安排（演示意向）');toast('活动意向已记录，不发送真实通知');}
  if(target.matches('[data-lab-play]'))playEpisode(Number(target.dataset.labPlay));
  if(target.matches('[data-episode]'))playEpisode(Number(target.dataset.episode));
  if(target.matches('[data-lab-close],[data-close-reward]'))closeDialog();
  if(target.matches('[data-save-ticket]'))void saveTicket(target);
});
document.addEventListener('keydown',event=>{
  if($('labDialog').hidden)return;
  if(event.key==='Escape'){event.preventDefault();closeDialog();}
  if(event.key==='Tab'){
    const focusable=[...$('labDialog').querySelectorAll('button:not(:disabled),a[href],select,input')],first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
});
mountAdmin($('labAdmin'),store);render();
function fitLab(){document.documentElement.style.setProperty('--lab-scale',String(Math.min(1,Math.max(.68,(window.innerHeight-200)/920))));}
window.addEventListener('resize',fitLab);fitLab();
// A muted looping preview is decorative; it never earns watching progress.
video.loop=true;video.play().catch(()=>{});
