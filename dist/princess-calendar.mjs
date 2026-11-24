import {createPrincessSession,selectPrincessCalendar,shiftPrincessPeriod,switchPrincessMode,princessDrama} from './princess-calendar-model.mjs';
import {renderPrincessFrame,renderPrincessContent,renderPrincessTicket} from './princess-calendar-view.mjs';
import {escapeHTML as esc,icon} from './calendar-concept-view.mjs';
import {ticketLevels} from './ticket-model.mjs';
import {renderPrincessWidgetSetup} from './princess-widget-entry.mjs';
import {attachCalendarPlayerShell} from './calendar-player-shell.mjs';

const mount=document.querySelector('#princessDemo');
const params=new URLSearchParams(location.search);
const desktopEntry=params.get('entry')==='widget';
const queryOnly=params.get('purpose')!=='playback';
const embedded=params.get('presentation')==='embedded';
const playbackLayout=params.get('layout')==='player';
if(playbackLayout)document.body.classList.add('pc-playback-layout');
if(playbackLayout&&params.get('hero')==='full')document.body.classList.add('pc-playback-full-hero');
if(embedded)document.body.classList.add('pc-embedded');
if(desktopEntry)document.body.classList.add('pc-widget-variant');
let session=createPrincessSession({tier:['vip','svip','free'].includes(params.get('tier'))?params.get('tier'):'vip'});
if(params.get('mode')==='month')session=switchPrincessMode(session,'month');
mount.innerHTML=renderPrincessFrame();
const app=mount.querySelector('.pc-app'),scroll=app.querySelector('.pc-scroll'),layer=app.querySelector('.pc-layer'),sheet=app.querySelector('.pc-sheet');
const playerShell=playbackLayout?attachCalendarPlayerShell(app,{ip:'princess',onNotice:message=>toast(message),onShare:()=>open('分享播放页方案','本地预览链接','<p>《尚公主》· 上方视频与下方日历</p><button type="button" class="pc-primary" data-action="copy-link">复制本地链接</button><p class="pc-note">仅本地原型，未发布线上。</p>')}):null;
let playing=null,returnFocus=null,toastTimer,modal=null,saving=false;
let widgetSize='wide';
const view=()=>selectPrincessCalendar(session);
function render(){scroll.innerHTML=renderPrincessContent(view(),session,{desktopEntry,queryOnly});}
function toast(message){const box=app.querySelector('.pc-toast');clearTimeout(toastTimer);box.textContent=message;box.hidden=false;toastTimer=setTimeout(()=>{box.hidden=true;},2600);}
function close(){layer.hidden=true;scroll.inert=false;app.querySelector('.pc-nav').inert=false;playerShell?.setModalOpen(false);playing=null;modal=null;const node=returnFocus?.isConnected?returnFocus:scroll.querySelector(returnFocus?.dataset.action==='desktop'?'[data-action="desktop"]':'[data-action="ticket"]');node?.focus({preventScroll:true});}
function open(title,eyebrow,html,kind='info'){
  if(layer.hidden)returnFocus=document.activeElement;
  modal=kind;sheet.querySelector('h2').textContent=title;sheet.querySelector('header small').textContent=eyebrow;sheet.querySelector('.pc-sheet__body').innerHTML=html;
  layer.hidden=false;scroll.inert=true;app.querySelector('.pc-nav').inert=true;playerShell?.setModalOpen(true);sheet.scrollTop=0;sheet.querySelector('.pc-close').focus({preventScroll:true});
}
function showTicket(level){open('我的成长电子票','同一张票，随追剧进度升级',renderPrincessTicket(view(),level),'ticket');}
function showWidget(stage='setup'){
  open(stage==='desktop'?'桌面上的追剧搭子':'把追剧搭子放到桌面','桌面小组件 · 效果预览',renderPrincessWidgetSetup(view(),{stage,size:widgetSize}),stage==='desktop'?'widget-home':'widget-setup');
}
function showPlayer(episode){
  if(!view().availableEpisodes.includes(episode)){toast('这集尚未到当前账号的播出时间');return;}
  playing=episode;
  open(`第${episode}集`,'尚公主 · 播放预览',`<div class="pc-player-art" role="img" aria-label="尚公主演示画面">${icon('play')}</div><p>看完后，观看进度和电子票会自动更新。</p><button type="button" class="pc-primary" data-finish="${episode}">模拟看完第${episode}集</button><p class="pc-note">本地交互演示，不接入真实播放与观看历史</p>`,'player');
}
function membership(){
  const current=view(),u=current.upgrade;
  if(!u){toast('当前已是SVIP');return;}
  open(`升级${princessDrama.tiers[u.tier]}`,'先看清权益，再决定升级',`<div class="pc-benefit"><strong>今日可看至第${u.availableThrough||'—'}集</strong><p>${u.extraEpisodes?`比当前权益多看${u.extraEpisodes}集`:'解锁会员专属更新安排'}</p></div><p>当前为${esc(princessDrama.tiers[current.accountTier])}。查看权益不会改变会员身份。</p><button type="button" class="pc-primary" data-action="confirm-upgrade">${current.accountTier==='free'?'开通VIP':'升级SVIP'}</button><button type="button" class="pc-secondary" data-action="close">先看排期</button><p class="pc-note">本地方案演示，不产生订单或真实会员权益</p>`,'membership');
}
async function saveTicket(level,button){
  if(saving||level>view().ticket.currentLevel||!ticketLevels.some(item=>item.level===level))return;
  saving=true;button.disabled=true;button.textContent='正在生成…';
  try{
    const image=new Image();image.src='./assets/princess/reference-poster.jpg';await image.decode();
    const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1120;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#efd7aa';ctx.fillRect(0,0,720,1120);ctx.strokeStyle='#a12b1b';ctx.lineWidth=3;ctx.strokeRect(22,22,676,1076);
    ctx.drawImage(image,0,1480,1216,820,42,80,636,429);
    ctx.fillStyle='#782617';ctx.font='600 82px "Songti SC",serif';ctx.fillText('尚公主',62,620);
    ctx.font='38px "PingFang SC",sans-serif';ctx.fillText(ticketLevels.find(item=>item.level===level).name,64,700);
    ctx.font='24px "PingFang SC",sans-serif';ctx.fillText('NO. SGZ-DEMO-001',64,792);ctx.fillText('追剧纪念票 · 非观影凭证',64,1000);
    for(let x=64;x<650;x+=7){ctx.fillRect(x,855,(x%3)+1,80);}
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('empty PNG');
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`尚公主-${ticketLevels.find(item=>item.level===level).name}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);toast('电子票已生成，请在下载中查看');
  }catch{toast('生成失败，请稍后重试');}finally{saving=false;if(button.isConnected){button.disabled=false;button.textContent='保存电子票';}}
}

app.addEventListener('click',async event=>{
  if(event.target===layer){close();return;}
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.dataset.date){session={...session,selectedDate:button.dataset.date};render();return;}
  if(button.dataset.mode){session={...session,...switchPrincessMode(session,button.dataset.mode)};render();return;}
  if(button.dataset.period){session={...session,...shiftPrincessPeriod(session,Number(button.dataset.period))};render();return;}
  if(button.dataset.widgetSize){widgetSize=button.dataset.widgetSize==='square'?'square':'wide';showWidget();sheet.querySelector(`[data-widget-size="${widgetSize}"]`)?.focus({preventScroll:true});return;}
  if(button.dataset.play){if(!queryOnly||(modal==='desktop'&&sheet.contains(button)))showPlayer(Number(button.dataset.play));return;}
  if(button.dataset.finish){
    const episode=Number(button.dataset.finish);if(modal!=='player'||playing!==episode||!view().availableEpisodes.includes(episode))return;
    const old=view().ticket.currentLevel;session.completed.add(episode);render();close();if(view().ticket.currentLevel>old)showTicket();else toast(`第${episode}集已记录，电子票进度已更新`);return;
  }
  if(button.dataset.ticketLevel){showTicket(Number(button.dataset.ticketLevel));return;}
  if(button.dataset.saveTicket){await saveTicket(Number(button.dataset.saveTicket),button);return;}
  switch(button.dataset.action){
    case 'close':close();break;
    case 'ticket':showTicket();break;
    case 'membership':membership();break;
    case 'confirm-upgrade':toast('此处为开通入口演示，不产生真实订单');break;
    case 'today':session={...session,weekStart:'2026-11-02',month:'2026-11',selectedDate:view().today};render();break;
    case 'reminder':session={...session,reminded:!session.reminded};render();toast(session.reminded?'已开启演示提醒，不发送真实通知':'演示提醒已关闭');break;
    case 'event':open('点映礼活动','抢先赴约大结局','<p>活动时间、场次和参与资格，以官方后续公布为准。</p><button type="button" class="pc-primary" data-action="event-reminder">关注活动安排</button><p class="pc-note">关注不代表获得点映资格，也不改变普通会员可播集数。</p>');break;
    case 'event-reminder':toast('已记录演示意向，不发送真实通知');break;
    case 'extra':open('《沙发多话》上期','11月3日17:00上线','<p>这是独立花絮，不计入正片观看集数，也不增加电子票进度。</p><button type="button" class="pc-secondary" data-action="close">回到排期</button>');break;
    case 'back':open('尚公主','剧集信息','<p>人物海报与红金卷轴皮肤沿用所提供的运营稿。</p><p>本页演示11月2日—8日排期，不代表实时播出数据。</p><button type="button" class="pc-primary" data-action="close">回到追剧日历</button>');break;
    case 'desktop':if(desktopEntry){showWidget();break;}open('把追剧日历放到桌面','桌面效果预览',`<div class="pc-widget-preview"><small>19:00</small><div><span>尚公主</span><strong>${view().nextEpisode?`第${view().nextEpisode}集，等你继续`:'新的故事，记得回来'} </strong><p>今天的更新，桌面上一眼看到</p></div></div><button type="button" class="pc-primary" data-action="confirm-desktop">确认添加</button>`,'desktop');break;
    case 'confirm-desktop':if(desktopEntry){session={...session,widgetPreviewed:true};render();showWidget('desktop');break;}open('桌面上的追剧日历','效果预览',`<div class="pc-widget-preview"><small>19:00</small><button type="button" data-play="${view().nextEpisode||25}"><span>腾讯视频 · 尚公主</span><strong>接着上次，继续看</strong><p>点击小组件继续观看 →</p></button></div><p class="pc-note">网页效果预览，未实际安装系统组件</p>`,'desktop');break;
    case 'widget-resume':if(desktopEntry&&modal==='widget-home'){const episode=view().nextEpisode;if(episode)showPlayer(episode);else close();}break;
    case 'share':open('分享这一版','本地预览链接','<p>《尚公主》· 运营皮肤与三段式方案</p><button type="button" class="pc-primary" data-action="copy-link">复制本地链接</button><p class="pc-note">仅供这台电脑本地预览，未发布线上。</p>');break;
    case 'copy-link':try{await navigator.clipboard.writeText(location.href);toast('本地链接已复制');}catch{toast('可复制浏览器地址栏中的链接');}break;
  }
});
document.addEventListener('keydown',event=>{
  if(layer.hidden)return;
  if(event.key==='Escape'){event.preventDefault();close();return;}
  if(event.key==='Tab'){
    const nodes=[...sheet.querySelectorAll('button:not([disabled]),a[href],input,select')].filter(el=>el.getClientRects().length),first=nodes[0],last=nodes.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
});
function fit(){document.documentElement.style.setProperty('--pc-scale',embedded?1:Math.min(.94,(innerWidth-48)/453,Math.max(.4,(innerHeight-64)/912)));}
render();fit();window.addEventListener('resize',fit);
