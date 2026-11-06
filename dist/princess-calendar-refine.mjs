// Isolated calendar study. Schedule previews are deliberately not account
// changes, playback authorization, order creation or viewing-history writes.
import {createPrincessRefineSession,selectPrincessRefineCalendar,setPrincessRefinePreview,shiftPrincessRefinePeriod,switchPrincessRefineMode} from './princess-calendar-refine-model.mjs';
import {renderPrincessRefineContent} from './princess-calendar-refine-view.mjs';
import {renderPrincessFrame,renderPrincessTicket} from './princess-calendar-view.mjs';
import {renderPrincessWidgetSetup} from './princess-widget-entry.mjs';
import {escapeHTML as esc} from './calendar-concept-view.mjs';
import {ticketLevels} from './ticket-model.mjs';
import {attachCalendarPlayerShell} from './calendar-player-shell.mjs';
import {getPrincessMembershipPreview,renderPrincessMembershipPreview} from './princess-membership-preview.mjs';

const params=new URLSearchParams(location.search);
const embedded=params.get('presentation')==='embedded';
if(embedded)document.body.classList.add('pc-embedded');
const playbackLayout=params.get('layout')==='player';
if(playbackLayout)document.body.classList.add('pc-playback-layout');
if(playbackLayout&&params.get('hero')==='full')document.body.classList.add('pc-playback-full-hero');
const tier=['free','vip','svip'].includes(params.get('tier'))?params.get('tier'):'vip';
let session=createPrincessRefineSession({tier,previewTier:params.get('preview')||undefined});
if(params.get('mode')==='month')session=switchPrincessRefineMode(session,'month');
const mount=document.querySelector('#princessDemo');
mount.innerHTML=renderPrincessFrame();
const app=mount.querySelector('.pc-app'),scroll=app.querySelector('.pc-scroll'),nav=app.querySelector('.pc-nav'),layer=app.querySelector('.pc-layer'),sheet=app.querySelector('.pc-sheet');
nav.querySelector('[data-action="share"]').remove();
let returnFocus=null,modal=null,toastTimer,widgetSize='wide',saving=false;
const playerShell=playbackLayout?attachCalendarPlayerShell(app,{ip:'princess',onNotice:toast,onShare:()=>toast('本地评审原型，请转发页面链接')}):null;
const view=()=>{
  const current=selectPrincessRefineCalendar(session);
  // All three study layouts share the same direct VIP entry. This is only
  // presentation; selecting a schedule never changes the actual account.
  return current.accountTier==='free'
    ?{...current,marketing:{...current.marketing,kind:'membership',tier:'vip',cta:'升级VIP'}}
    :current;
};
const tierName=value=>({free:'非VIP',vip:'VIP',svip:'SVIP'}[value]||'非VIP');

function render(focusSelector){
  scroll.innerHTML=renderPrincessRefineContent(view(),session);
  if(focusSelector)app.querySelector(focusSelector)?.focus({preventScroll:true});
}
function toast(message){const node=app.querySelector('.pc-toast');clearTimeout(toastTimer);node.textContent=message;node.hidden=false;toastTimer=setTimeout(()=>{node.hidden=true;},2800);}
function close(){
  layer.hidden=true;scroll.inert=false;nav.inert=false;modal=null;
  delete sheet.dataset.membershipPreview;
  playerShell?.setModalOpen(false);
  const target=returnFocus?.isConnected?returnFocus:scroll.querySelector(returnFocus?.dataset.action==='desktop'?'[data-action="desktop"]':'[data-action="ticket"]');
  target?.focus({preventScroll:true});
}
function open(title,eyebrow,html,kind='info'){
  if(layer.hidden)returnFocus=document.activeElement;
  const nativeVariant=kind==='membership-screenshot-vip'?'vip':kind==='membership-screenshot-svip'?'svip':null;
  if(nativeVariant)sheet.dataset.membershipPreview=nativeVariant;
  else delete sheet.dataset.membershipPreview;
  modal=kind;sheet.querySelector('h2').textContent=title;sheet.querySelector('header small').textContent=eyebrow;
  sheet.querySelector('.pc-sheet__body').innerHTML=html;layer.hidden=false;scroll.inert=true;nav.inert=true;
  playerShell?.setModalOpen(true);
  sheet.scrollTop=0;
  const closeControl=sheet.querySelector(nativeVariant?'[data-membership-close]':'.pc-close');
  closeControl?.focus({preventScroll:true});
}
function showTicket(level){open('我的成长电子票','观看进度不随排期预览改变',renderPrincessTicket(view(),level),'ticket');}
function showWidget(stage='setup'){
  open(stage==='desktop'?'桌面上的追剧搭子':'把追剧搭子放到桌面','桌面小组件 · 效果预览',renderPrincessWidgetSetup(view(),{stage,size:widgetSize}),stage==='desktop'?'widget-home':'widget-setup');
}
function focusCalendar(){
  const calendar=scroll.querySelector('.pc-calendar');if(!calendar)return;
  const top=scroll.scrollTop+calendar.getBoundingClientRect().top-scroll.getBoundingClientRect().top-8;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  scroll.scrollTo({top:Math.max(0,top),behavior:reduced?'auto':'smooth'});
}
function previewMembership(target){
  session=setPrincessRefinePreview(session,target);render();focusCalendar();
  toast(`已展示${tierName(session.previewTier)}排期，当前身份仍为${tierName(session.accountTier)}`);
}
function membership(target){
  const actual=view(),allowed=actual.accountTier==='free'?['vip','svip']:actual.accountTier==='vip'?['svip']:[];
  if(!allowed.includes(target)){toast('当前没有需要开通的会员权益');return;}
  const preview=getPrincessMembershipPreview(actual.accountTier,target);
  if(preview){
    open(preview.title,'端内会员开通 · 截图示意',renderPrincessMembershipPreview(preview),`membership-screenshot-${preview.variant}`);
    return;
  }
  const label=`${actual.accountTier==='free'?'开通':'升级'}${tierName(target)}`;
  open(label,'会员权益 · 入口示意',`<div class="pc-benefit"><strong>了解${esc(tierName(target))}观看权益</strong><p>排期可先预览，播放仍以实际会员权益为准</p></div><p>当前账号为${esc(tierName(actual.accountTier))}，切换排期不会开通会员，也不会解锁新剧集。</p><button type="button" class="pc-primary" data-action="confirm-membership" data-target-tier="${target}">${esc(label)}</button><button type="button" class="pc-secondary" data-action="close">返回日历</button><p class="pc-note">方案演示，不创建订单、不支付，也不改变真实身份。</p>`,'membership');
}
async function saveTicket(level,button){
  const current=view();
  if(saving||!Number.isInteger(level)||level>current.ticket.currentLevel||!ticketLevels.some(item=>item.level===level))return;
  saving=true;button.disabled=true;button.textContent='正在生成…';
  try{
    const image=new Image();image.src='./assets/princess/reference-poster.jpg';await image.decode();
    const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1120;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#efd7aa';ctx.fillRect(0,0,720,1120);ctx.strokeStyle='#a12b1b';ctx.lineWidth=3;ctx.strokeRect(22,22,676,1076);
    ctx.drawImage(image,0,1480,1216,820,42,80,636,429);ctx.fillStyle='#782617';ctx.font='600 82px "Songti SC",serif';ctx.fillText('尚公主',62,620);
    ctx.font='38px "PingFang SC",sans-serif';ctx.fillText(ticketLevels.find(item=>item.level===level).name,64,700);
    ctx.font='24px "PingFang SC",sans-serif';ctx.fillText('NO. SGZ-DEMO-001',64,792);ctx.fillText('追剧纪念票 · 非观影凭证',64,1000);
    for(let x=64;x<650;x+=7)ctx.fillRect(x,855,(x%3)+1,80);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('No ticket PNG');
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`尚公主-${ticketLevels.find(item=>item.level===level).name}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);toast('电子票已生成，请在下载中查看');
  }catch{toast('生成失败，请稍后重试');}finally{saving=false;if(button.isConnected){button.disabled=false;button.textContent='保存电子票';}}
}

app.addEventListener('change',event=>{
  if(!event.target.matches('select[data-preview-tier]'))return;
  session=setPrincessRefinePreview(session,event.target.value);render('select[data-preview-tier]');
  if(view().isPreview)toast(`仅预览${tierName(session.previewTier)}排期，不改变当前${tierName(session.accountTier)}身份`);
});
app.addEventListener('click',async event=>{
  if(event.target===layer){close();return;}
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.dataset.date){session={...session,selectedDate:button.dataset.date};render(`[data-date="${button.dataset.date}"]`);return;}
  if(button.dataset.mode){session=switchPrincessRefineMode(session,button.dataset.mode);render(`button[data-mode="${session.mode}"]`);return;}
  if(button.dataset.period){session=shiftPrincessRefinePeriod(session,Number(button.dataset.period));render(`[data-period="${button.dataset.period}"]`);return;}
  if(button.dataset.ticketLevel){showTicket(Number(button.dataset.ticketLevel));return;}
  if(button.dataset.saveTicket){await saveTicket(Number(button.dataset.saveTicket),button);return;}
  if(button.dataset.widgetSize){widgetSize=button.dataset.widgetSize==='square'?'square':'wide';showWidget();sheet.querySelector(`[data-widget-size="${widgetSize}"]`)?.focus({preventScroll:true});return;}
  switch(button.dataset.action){
    case 'close':close();break;
    case 'reminder':session={...session,reminded:!session.reminded};render('[data-action="reminder"]');toast(session.reminded?'已开启本剧演示提醒，不发送真实通知，也不改变观看权益':'演示更新提醒已关闭');break;
    case 'preview-membership':previewMembership(button.dataset.previewTier);break;
    case 'membership':membership(button.dataset.targetTier||view().marketing.tier);break;
    case 'confirm-membership':if(modal==='membership')toast('开通入口演示，不创建订单或改变会员身份');break;
    case 'ticket':showTicket();break;
    case 'desktop':showWidget();break;
    case 'confirm-desktop':session={...session,widgetPreviewed:true};render();showWidget('desktop');break;
    case 'widget-resume':case 'widget-calendar':if(modal==='widget-home'){close();toast('桌面入口效果演示，未连接真实客户端播放');}break;
    case 'extra':open('《沙发多话》上期','已公布花絮 · 11月3日17:00上线','<p>独立花絮不计入正片集数，也不改变电子票进度。</p><button type="button" class="pc-primary" data-action="close">回到日历</button>');break;
    case 'back':open('尚公主 · 日历细节版','当前为独立评审原型',`<p>支持全屏及两种半屏首图，保留旧提案、动漫及已导出的文件。</p><p>当前演示身份：${esc(tierName(session.accountTier))}。会员排期选择只影响展示，不修改身份或历史。</p><p>沿用11月2日—8日的截图排期与演示时钟，非实时数据。</p><button type="button" class="pc-primary" data-action="close">回到日历</button>`);break;
  }
});
document.addEventListener('keydown',event=>{
  if(layer.hidden)return;
  if(event.key==='Escape'){event.preventDefault();close();return;}
  if(event.key==='Tab'){
    const nodes=[...sheet.querySelectorAll('button:not([disabled]),a[href],input,select,[tabindex="0"]')].filter(node=>node.getClientRects().length),first=nodes[0],last=nodes.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
});
function fit(){document.documentElement.style.setProperty('--pc-scale',embedded?1:Math.min(.94,(innerWidth-48)/453,Math.max(.4,(innerHeight-64)/912)));}
render();fit();window.addEventListener('resize',fit);
