// Query-only review. Account, viewing history and screenshot release schedules
// stay separate; no membership order, media playback or notification is sent.
import {createZhanshenRefineSession,selectZhanshenRefineCalendar,setZhanshenRefinePreview,shiftZhanshenRefinePeriod,switchZhanshenRefineMode} from './zhanshen-calendar-refine-model.mjs';
import {renderZhanshenRefineContent} from './zhanshen-calendar-refine-view.mjs';
import {renderPrincessFrame} from './princess-calendar-view.mjs';
import {renderZhanshenTicket,renderZhanshenWidgetSetup} from './zhanshen-calendar-view.mjs';
import {animeTicketLevels} from './zhanshen-calendar-model.mjs';
import {attachCalendarPlayerShell} from './calendar-player-shell.mjs';
import {getPrincessMembershipPreview,renderPrincessMembershipPreview} from './princess-membership-preview.mjs';

const params=new URLSearchParams(location.search);
const embedded=params.get('presentation')==='embedded';
const playbackLayout=params.get('layout')==='player';
if(embedded)document.body.classList.add('pc-embedded');
if(playbackLayout)document.body.classList.add('pc-playback-layout');
if(playbackLayout&&params.get('hero')==='full')document.body.classList.add('pc-playback-full-hero');
const tier=['free','vip','svip'].includes(params.get('tier'))?params.get('tier'):'vip';
let session=createZhanshenRefineSession({tier,previewTier:params.get('preview')||undefined,mode:params.get('mode')==='month'?'month':'week'});
const mount=document.querySelector('#zhanshenRefineDemo');
mount.innerHTML=renderPrincessFrame();
const app=mount.querySelector('.pc-app'),scroll=app.querySelector('.pc-scroll'),nav=app.querySelector('.pc-nav'),layer=app.querySelector('.pc-layer'),sheet=app.querySelector('.pc-sheet');
nav.querySelector('[data-action="share"]').remove();
nav.querySelector('h1').textContent='追番日历';
let returnFocus=null,modal=null,toastTimer,widgetSize='wide',saving=false;
const playerShell=playbackLayout?attachCalendarPlayerShell(app,{ip:'zhanshen',onNotice:toast,onShare:()=>toast('请转发评审页面链接；当前为界面演示')}):null;
const view=()=>selectZhanshenRefineCalendar(session);
const tierName=value=>({free:'非VIP',vip:'VIP',svip:'SVIP'}[value]||'非VIP');

function render(focusSelector){
  scroll.innerHTML=renderZhanshenRefineContent(view(),session);
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
  const variant=kind==='membership-screenshot-vip'?'vip':kind==='membership-screenshot-svip'?'svip':null;
  if(variant)sheet.dataset.membershipPreview=variant;else delete sheet.dataset.membershipPreview;
  modal=kind;sheet.querySelector('h2').textContent=title;sheet.querySelector('header small').textContent=eyebrow;
  sheet.querySelector('.pc-sheet__body').innerHTML=html;layer.hidden=false;scroll.inert=true;nav.inert=true;
  playerShell?.setModalOpen(true);sheet.scrollTop=0;
  sheet.querySelector(variant?'[data-membership-close]':'.pc-close')?.focus({preventScroll:true});
}
function membership(target){
  const actual=view(),allowed=actual.accountTier==='free'?['vip']:actual.accountTier==='vip'?['svip']:[];
  if(!allowed.includes(target)){toast('当前没有需要开通的会员权益');return;}
  const preview=getPrincessMembershipPreview(actual.accountTier,target);
  if(preview)open(preview.title,'端内会员开通 · 截图示意',renderPrincessMembershipPreview(preview),`membership-screenshot-${preview.variant}`);
}
function showWidget(stage='setup'){
  open(stage==='desktop'?'桌面上的追剧搭子':'把追剧搭子放到桌面','桌面小组件 · 效果预览',renderZhanshenWidgetSetup({stage,size:widgetSize}),stage==='desktop'?'widget-home':'widget-setup');
}
function showTicket(level){open('我的成长电子票','追番纪念 · 演示规则',renderZhanshenTicket(view(),level),'ticket');}
async function saveTicket(level,button){
  const current=view();
  if(saving||!Number.isInteger(level)||level>current.ticket.currentLevel||!animeTicketLevels.some(item=>item.level===level))return;
  saving=true;button.disabled=true;button.textContent='正在生成…';
  try{
    const image=new Image();image.src='./assets/zhanshen/reference-top.jpg';await image.decode();
    const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1120;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#050a32';ctx.fillRect(0,0,720,1120);ctx.strokeStyle='#4779ff';ctx.lineWidth=3;ctx.strokeRect(22,22,676,1076);
    ctx.drawImage(image,0,458,1216,670,42,80,636,351);ctx.fillStyle='#eef1ff';ctx.font='700 86px "PingFang SC",sans-serif';ctx.fillText('斩神Ⅱ',62,585);
    ctx.font='36px "PingFang SC",sans-serif';ctx.fillText(animeTicketLevels.find(item=>item.level===level).name,64,676);
    ctx.font='24px sans-serif';ctx.fillText('NO. ZS-DEMO-001',64,785);ctx.fillText('追番纪念票 · 不代表播放或活动资格',64,1000);
    for(let x=64;x<650;x+=7)ctx.fillRect(x,855,(x%3)+1,80);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('empty PNG');
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`斩神Ⅱ-${animeTicketLevels.find(item=>item.level===level).name}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);toast('电子票已生成，请在下载中查看');
  }catch{toast('生成失败，请稍后重试');}finally{saving=false;if(button.isConnected){button.disabled=false;button.textContent='保存电子票';}}
}
app.addEventListener('change',event=>{
  if(!event.target.matches('select[data-preview-tier]'))return;
  session=setZhanshenRefinePreview(session,event.target.value);render('select[data-preview-tier]');
  if(view().isPreview)toast(`仅预览${tierName(session.previewTier)}排期，当前身份仍为${tierName(session.accountTier)}`);
});
app.addEventListener('click',async event=>{
  if(event.target===layer){close();return;}
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.dataset.date){session={...session,selectedDate:button.dataset.date};render(`[data-date="${button.dataset.date}"]`);return;}
  if(button.dataset.mode){session=switchZhanshenRefineMode(session,button.dataset.mode);render(`button[data-mode="${session.mode}"]`);return;}
  if(button.dataset.period){session=shiftZhanshenRefinePeriod(session,Number(button.dataset.period));render(`[data-period="${button.dataset.period}"]`);return;}
  if(button.dataset.ticketLevel){showTicket(Number(button.dataset.ticketLevel));return;}
  if(button.dataset.saveTicket){await saveTicket(Number(button.dataset.saveTicket),button);return;}
  if(button.dataset.widgetSize){widgetSize=button.dataset.widgetSize==='square'?'square':'wide';showWidget();sheet.querySelector(`[data-widget-size="${widgetSize}"]`)?.focus({preventScroll:true});return;}
  switch(button.dataset.action){
    case 'close':close();break;
    case 'reminder':session={...session,reminded:!session.reminded};render('[data-action="reminder"]');toast(session.reminded?'已开启演示提醒，不发送真实通知':'演示提醒已关闭');break;
    case 'membership':membership(button.dataset.targetTier||view().marketing.tier);break;
    case 'ticket':showTicket();break;
    case 'desktop':showWidget();break;
    case 'confirm-desktop':session={...session,widgetPreviewed:true};render();showWidget('desktop');break;
    case 'widget-calendar':if(modal==='widget-home'){close();toast('已回到追番日历，未连接实际播放器');}break;
    case 'back':open('斩神Ⅱ · 追番日历','界面评审示意','<p>保留原运营蓝紫色皮肤及限免批次。VIP、SVIP排期未提供时不编造集数。</p><p>排期预览不会改变身份、历史或电子票进度；会员页为历史截图，不支付。</p><button type="button" class="pc-primary" data-action="close">回到日历</button>');break;
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
