import {createZhanshenSession,selectZhanshenCalendar,shiftZhanshenPeriod,switchZhanshenMode,animeTicketLevels} from './zhanshen-calendar-model.mjs';
import {renderPrincessFrame} from './princess-calendar-view.mjs';
import {renderZhanshenContent,renderZhanshenTicket,renderZhanshenWidgetSetup} from './zhanshen-calendar-view.mjs';
import {attachCalendarPlayerShell} from './calendar-player-shell.mjs';

const mount=document.querySelector('#zhanshenDemo'),params=new URLSearchParams(location.search);
const embedded=params.get('presentation')==='embedded';
const playbackLayout=params.get('layout')==='player';
if(playbackLayout)document.body.classList.add('pc-playback-layout');
if(playbackLayout&&params.get('hero')==='full')document.body.classList.add('pc-playback-full-hero');
if(embedded)document.body.classList.add('pc-embedded');
let session=createZhanshenSession({mode:params.get('mode')==='month'?'month':'week'});
mount.innerHTML=renderPrincessFrame();
const app=mount.querySelector('.pc-app'),scroll=app.querySelector('.pc-scroll'),layer=app.querySelector('.pc-layer'),sheet=app.querySelector('.pc-sheet');
const playerShell=playbackLayout?attachCalendarPlayerShell(app,{ip:'zhanshen',onNotice:message=>toast(message),onShare:()=>open('分享播放页方案','本地预览链接','<p>《斩神Ⅱ》· 上方视频与下方限免日历</p><button type="button" class="pc-primary" data-action="copy-link">复制本地链接</button><p class="zs-note">仅本地原型，未发布线上。</p>')}):null;
let returnFocus=null,toastTimer,widgetSize='wide',saving=false;
const view=()=>selectZhanshenCalendar(session);
function render(){scroll.innerHTML=renderZhanshenContent(view(),session);}
function toast(message){const node=app.querySelector('.pc-toast');clearTimeout(toastTimer);node.textContent=message;node.hidden=false;toastTimer=setTimeout(()=>{node.hidden=true;},2600);}
function close(){layer.hidden=true;scroll.inert=false;app.querySelector('.pc-nav').inert=false;playerShell?.setModalOpen(false);const node=returnFocus?.isConnected?returnFocus:scroll.querySelector(returnFocus?.dataset.action==='desktop'?'[data-action="desktop"]':'[data-action="ticket"]');node?.focus({preventScroll:true});}
function open(title,eyebrow,html){if(layer.hidden)returnFocus=document.activeElement;sheet.querySelector('h2').textContent=title;sheet.querySelector('header small').textContent=eyebrow;sheet.querySelector('.pc-sheet__body').innerHTML=html;layer.hidden=false;scroll.inert=true;app.querySelector('.pc-nav').inert=true;playerShell?.setModalOpen(true);sheet.scrollTop=0;sheet.querySelector('.pc-close').focus({preventScroll:true});}
function showWidget(stage='setup'){open(stage==='desktop'?'桌面上的追剧搭子':'把追剧搭子放到桌面','桌面小组件 · 效果预览',renderZhanshenWidgetSetup({stage,size:widgetSize}));}
function showTicket(level){open('我的成长电子票','追番纪念 · 本地方案',renderZhanshenTicket(view(),level));}
async function saveTicket(level,button){
  if(saving||level>view().ticket.currentLevel||!animeTicketLevels.some(item=>item.level===level))return;
  saving=true;button.disabled=true;button.textContent='正在生成…';
  try{
    const image=new Image();image.src='./assets/zhanshen/reference-top.jpg';await image.decode();
    const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1120;const ctx=canvas.getContext('2d');ctx.fillStyle='#050a32';ctx.fillRect(0,0,720,1120);ctx.strokeStyle='#4779ff';ctx.lineWidth=3;ctx.strokeRect(22,22,676,1076);ctx.drawImage(image,0,458,1216,670,42,80,636,351);ctx.fillStyle='#eef1ff';ctx.font='700 86px "PingFang SC",sans-serif';ctx.fillText('斩神Ⅱ',62,585);ctx.font='36px "PingFang SC",sans-serif';ctx.fillText(animeTicketLevels.find(item=>item.level===level).name,64,676);ctx.font='24px sans-serif';ctx.fillText('NO. ZS-DEMO-001',64,785);ctx.fillText('追番纪念票 · 不代表播放或活动资格',64,1000);for(let x=64;x<650;x+=7)ctx.fillRect(x,855,(x%3)+1,80);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('empty PNG');const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`斩神Ⅱ-${animeTicketLevels.find(item=>item.level===level).name}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);toast('电子票已生成，请在下载中查看');
  }catch{toast('生成失败，请稍后重试');}finally{saving=false;if(button.isConnected){button.disabled=false;button.textContent='保存电子票';}}
}
app.addEventListener('click',async event=>{
  if(event.target===layer){close();return;}
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.dataset.date){session={...session,selectedDate:button.dataset.date};render();return;}
  if(button.dataset.mode){session={...session,...switchZhanshenMode(session,button.dataset.mode)};render();return;}
  if(button.dataset.period){session={...session,...shiftZhanshenPeriod(session,Number(button.dataset.period))};render();return;}
  if(button.dataset.ticketLevel){showTicket(Number(button.dataset.ticketLevel));return;}
  if(button.dataset.saveTicket){await saveTicket(Number(button.dataset.saveTicket),button);return;}
  if(button.dataset.widgetSize){widgetSize=button.dataset.widgetSize==='square'?'square':'wide';showWidget();sheet.querySelector(`[data-widget-size="${widgetSize}"]`)?.focus({preventScroll:true});return;}
  switch(button.dataset.action){
    case 'close':case 'widget-calendar':close();break;
    case 'ticket':showTicket();break;
    case 'desktop':showWidget();break;
    case 'confirm-desktop':session={...session,widgetPreviewed:true};render();showWidget('desktop');break;
    case 'reminder':session={...session,reminded:!session.reminded};render();toast(session.reminded?'已记录演示提醒，不发送真实通知':'演示提醒已关闭');break;
    case 'membership':open('了解会员权益','限免之后，会员接着追','<div class="pc-benefit"><strong>12月3日 · 第2–15集回锁会员</strong><p>限免结束后的观看权益以实际规则为准</p></div><p>此处承接会员说明与运营活动，不推断截图之外的VIP／SVIP更新安排。</p><button type="button" class="pc-primary" data-action="membership-intent">查看开通入口</button><p class="zs-note">本地演示，不产生订单，不改变会员身份或限免期限。</p>');break;
    case 'membership-intent':toast('此处为会员入口演示，不产生真实订单');break;
    case 'back':open('斩神Ⅱ · 凡尘神域','追番日历','<p>原运营人物海报、深蓝与电光蓝紫配色保留，新增模块沿用统一查询模板。</p><p>限免批次与12月3日回锁会员规则来自提供的截图。当前以2026年11月5日演示，具体上线和回锁时刻未公布。</p><button type="button" class="pc-primary" data-action="close">回到日历</button>');break;
    case 'share':open('分享这一版','本地预览链接','<p>《斩神Ⅱ》· 动漫运营皮肤与查询日历方案</p><button type="button" class="pc-primary" data-action="copy-link">复制本地链接</button><p class="zs-note">仅供这台电脑本地预览，未发布线上。</p>');break;
    case 'copy-link':try{await navigator.clipboard.writeText(location.href);toast('本地链接已复制');}catch{toast('可复制浏览器地址栏链接');}break;
  }
});
document.addEventListener('keydown',event=>{if(layer.hidden)return;if(event.key==='Escape'){event.preventDefault();close();return;}if(event.key==='Tab'){const nodes=[...sheet.querySelectorAll('button:not([disabled]),a[href]')].filter(el=>el.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}});
function fit(){document.documentElement.style.setProperty('--pc-scale',embedded?1:Math.min(.94,(innerWidth-48)/453,Math.max(.4,(innerHeight-64)/912)));}
render();fit();window.addEventListener('resize',fit);
