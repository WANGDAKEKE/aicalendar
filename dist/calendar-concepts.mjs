import {drama} from './drama-config.mjs';
import {createCalendarConceptSession,selectCalendarConcept} from './calendar-concept-model.mjs';
import {CONCEPT_STYLES,selectConceptStyles,renderConceptFrame,renderConceptContent,escapeHTML as esc,icon} from './calendar-concept-view.mjs';
import {shiftMonth,episodeLabel,shortDate} from './calendar-model.mjs';
import {getTierContext} from './tier-model.mjs';
import {ticketLevels} from './ticket-model.mjs';
import {renderTicketPanel} from './ticket-view.mjs';
import {createTicketDownload} from './ticket-download.mjs';

const gallery=document.querySelector('#calendarGallery');
const params=new URLSearchParams(location.search);
const selectedStyle=CONCEPT_STYLES.find(item=>item.id===params.get('style'));
document.body.dataset.single=String(Boolean(selectedStyle));
const boards=selectConceptStyles({style:params.get('style'),compare:params.get('compare'),all:params.get('all')}).map(style=>{
  const session=createCalendarConceptSession({scenario:params.get('scenario')||'partial',tier:params.get('tier')||'vip'});
  if(/^\d{4}-(?:0[1-9]|1[0-2])$/.test(params.get('month')||''))session.month=params.get('month');
  return {...style,session,theme:style.id==='clean'&&params.get('theme')==='dark'?'dark':'light',modal:null,returnFocus:null,playing:null,toastTimer:null,downloadBusy:false};
});

gallery.innerHTML=boards.map(board=>`<section class="cc-artboard" data-board="${board.id}" aria-label="${esc(board.name)}">${renderConceptFrame(board.id,board.theme)}<p class="cc-caption"><strong>${esc(board.name)}</strong><span>${esc(board.caption)}</span></p></section>`).join('');
for(const board of boards)board.root=gallery.querySelector(`[data-board="${board.id}"]`);
const select=board=>selectCalendarConcept(drama,board.session);
const query=(board,selector)=>board.root.querySelector(selector);

function render(board){
  query(board,'.cc-content').innerHTML=renderConceptContent(drama,select(board),board.session,{style:board.id});
}
function toast(board,message){
  const node=query(board,'.cc-toast');
  clearTimeout(board.toastTimer);node.textContent=message;node.hidden=false;
  board.toastTimer=setTimeout(()=>{node.hidden=true;},2600);
}
function closeSheet(board,restoreFocus=true){
  const layer=query(board,'.cc-layer');
  if(layer.hidden)return;
  layer.hidden=true;query(board,'.cc-main').inert=false;board.modal=null;board.playing=null;
  if(restoreFocus){
    const retained=board.returnFocus;
    const target=retained?.isConnected&&board.root.contains(retained)&&retained.matches('button,select,a[href],input')?retained:query(board,board.returnSelector||'[data-action="ticket"]');
    target?.focus({preventScroll:true});
  }
}
function openSheet(board,title,eyebrow,body,modal='info',returnSelector=null){
  for(const other of boards)if(other!==board)closeSheet(other,false);
  if(query(board,'.cc-layer').hidden){
    const active=document.activeElement;
    board.returnFocus=board.root.contains(active)&&active.matches('button,select,a[href],input')?active:null;
    board.returnSelector=returnSelector||(board.returnFocus?.dataset.date?`[data-date="${board.returnFocus.dataset.date}"]`:board.returnFocus?.dataset.action?`[data-action="${board.returnFocus.dataset.action}"]`:'[data-action="ticket"]');
  }
  board.modal=modal;
  const sheet=query(board,'.cc-sheet');
  sheet.querySelector('h2').textContent=title;
  sheet.querySelector('h2').id=`${board.id}-sheet-title`;
  sheet.setAttribute('aria-labelledby',`${board.id}-sheet-title`);
  sheet.querySelector('.cc-sheet__eyebrow').textContent=eyebrow;
  sheet.querySelector('.cc-sheet__body').innerHTML=body;
  query(board,'.cc-layer').hidden=false;query(board,'.cc-main').inert=true;
  sheet.scrollTop=0;sheet.querySelector('[data-action="close"]').focus({preventScroll:true});
}

function showTicket(board,level,celebrate=false){
  const view=select(board),next=view.ticket.nextProgress?.nextEpisode;
  const available=next&&view.availableEpisodes.includes(next)?next:0;
  openSheet(board,celebrate?'电子票已自动收好':'我的成长电子票','同一张票，随追剧进度升级',renderTicketPanel({drama,progress:view.ticket,levels:ticketLevels,selectedLevel:level,celebrate,available,today:view.today,serial:'LY-DEMO-001'}),'ticket');
}
function showMembership(board,target){
  const context=getTierContext(drama,board.session.accountTier,target,board.session.now);
  if(!context.requiresUpgrade){toast(board,'当前账号已拥有对应权益');return;}
  openSheet(board,`${board.session.accountTier==='free'?'开通':'升级'} ${drama.tiers[target]}`,'排期可以预览，观看权益以账号为准',`<div class="cc-benefit"><strong>今日可看到第 ${context.preview.available} 集</strong><p>${context.extraAvailable?`比当前权益多看 ${context.extraAvailable} 集`:'了解会员的专属更新安排'}</p></div><p>当前为 ${esc(drama.tiers[board.session.accountTier])}，预览 ${esc(drama.tiers[target])} 排期不会改变会员身份。</p><button type="button" class="cc-primary" data-action="confirm-upgrade">${board.session.accountTier==='free'?'开通':'升级'} ${esc(drama.tiers[target])}</button><button type="button" class="cc-secondary" data-action="close">先看排期</button><p class="cc-note">本地界面演示，不产生订单或真实会员权益。</p>`,'membership',board.returnSelector==='.cc-tierbar select'?'.cc-tierbar select':null);
}
function showScreening(board){
  const event=drama.screeningEvents[0];
  if(!event){toast(board,'暂无点映礼活动');return;}
  openSheet(board,'大结局点映礼','长安之约 · 活动安排',`<div class="cc-benefit"><strong>${episodeLabel(event)}，提前赴约</strong><p>${shortDate(event.date)} ${event.time}–${event.endTime}</p></div><p>${esc(event.accessNote)}</p><button type="button" class="cc-primary" data-action="event-reminder">关注活动安排</button><p class="cc-note">关注活动不代表获得资格，也不改变普通会员可播集数。演示不发送真实通知。</p>`,'screening');
}
function showDate(board,date){
  const view=select(board),cell=view.cells.find(item=>item.date===date&&!item.outside);
  if(!cell)return;
  board.session.selectedDate=date;render(board);
  board.returnSelector=`[data-date="${date}"]`;
  const release=cell.release;
  if(!release){
    openSheet(board,`${shortDate(date)} · 休息一下`,'剧集更新安排',`<p>这一天没有常规更新，已上线的剧集可以慢慢补。</p>${view.nextEpisode?`<button type="button" class="cc-primary" data-play="${view.nextEpisode}">继续看第 ${view.nextEpisode} 集</button>`:''}${cell.ops.events.length?'<button type="button" class="cc-secondary" data-action="screening">查看点映礼活动</button>':''}`,'date',`[data-date="${date}"]`);return;
  }
  const pending=cell.watching.pendingEpisodes,watched=release.to-release.from+1-pending.length;
  const headline=cell.watching.status==='partial'?`待看第 ${pending[0]} 集`:cell.watching.status==='unwatched'?`待看 ${episodeLabel(release)}`:cell.watching.status==='watched'?'这一天的更新，已看完':`${episodeLabel(release)} · 待更新`;
  const sub=cell.watching.status==='partial'||cell.watching.status==='watched'?`已看 ${watched}/${release.to-release.from+1} 集 · ${release.time} 已更新`:cell.watching.status==='unwatched'?`${release.time} 已更新`:`${shortDate(date)} ${release.time} 更新`;
  const episodeButtons=Array.from({length:release.to-release.from+1},(_,i)=>release.from+i).map(episode=>{
    const available=view.availableEpisodes.includes(episode),complete=board.session.completed.has(episode);
    return `<button type="button" class="cc-episode ${complete?'is-watched':''}" data-play="${episode}" ${available?'':'disabled'}>第 ${episode} 集<small>${!available?'当前暂不可播':complete?'已看完 · 可重看':'继续观看'}</small></button>`;
  }).join('');
  openSheet(board,headline,`${shortDate(date)} · ${drama.tiers[board.session.previewTier]} 排期`,`<p>${sub}</p><div class="cc-sheet__episodes">${episodeButtons}</div>${view.context.requiresUpgrade?`<button type="button" class="cc-primary" data-upgrade="${board.session.previewTier}">了解 ${esc(drama.tiers[board.session.previewTier])} 权益</button>`:''}${cell.ops.events.length?'<button type="button" class="cc-secondary" data-action="screening">查看点映礼活动</button>':''}<p class="cc-note">观看历史逐集记录；没有看完的集数会保留为待看。</p>`,'date',`[data-date="${date}"]`);
  board.returnSelector=`[data-date="${date}"]`;
}
function showPlayer(board,episode){
  if(!select(board).availableEpisodes.includes(episode)){toast(board,'这一集不在当前账号的可播范围内');return;}
  board.playing=episode;
  openSheet(board,`第 ${episode} 集`,'长安的荔枝 · 播放预览',`<div class="cc-player" role="img" aria-label="剧集播放演示">${icon('play')}</div><strong>${board.session.completed.has(episode)?'再看一遍，也很好':'接着这个故事看'}</strong><p>看完后自动记录观看进度。</p><button type="button" class="cc-primary" data-finish="${episode}">模拟看完第 ${episode} 集</button><p class="cc-note">仅点击“模拟看完”才写入本页演示记录；打开页面或预览排期不增加观看记录。</p>`,'player');
}
function finishEpisode(board,episode){
  const view=select(board);
  if(board.modal!=='player'||board.playing!==episode||!view.availableEpisodes.includes(episode))return;
  const before=view.ticket.currentLevel;
  board.session.completed.add(episode);render(board);closeSheet(board);
  if(select(board).ticket.currentLevel>before)showTicket(board,select(board).ticket.currentLevel,true);
  else toast(board,`第 ${episode} 集已记录，日历已更新`);
}
function showDrama(board){
  const view=select(board);
  openSheet(board,drama.title,'剧集详情',`<div class="cc-player" role="img" aria-label="长安的荔枝剧集海报"></div><p>全 ${drama.totalEpisodes} 集 · 当前 ${esc(drama.tiers[board.session.accountTier])} 可看到第 ${view.context.account.available} 集</p>${view.nextEpisode?`<button type="button" class="cc-primary" data-play="${view.nextEpisode}">继续看第 ${view.nextEpisode} 集</button>`:''}<button type="button" class="cc-secondary" data-action="close">回到追剧日历</button>`,'drama');
}
function previewLink(board){
  const url=new URL('./calendar-concepts.html',location.href);
  url.searchParams.set('style',board.id);
  for(const key of ['scenario','tier'])if(params.has(key))url.searchParams.set(key,params.get(key));
  if(board.theme==='dark')url.searchParams.set('theme','dark');
  return url.href;
}
async function saveTicket(board,button){
  const level=Number(button.dataset.saveTicket),view=select(board);
  if(board.downloadBusy||level>view.ticket.currentLevel||!ticketLevels.some(item=>item.level===level))return;
  board.downloadBusy=true;button.disabled=true;button.textContent='正在生成…';
  try{
    const file=await createTicketDownload({drama,completed:board.session.completed,level,today:view.today,serial:'LY-DEMO-001'});
    const url=URL.createObjectURL(file.blob),link=document.createElement('a');
    link.href=url;link.download=file.filename;link.hidden=true;document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);toast(board,'已生成电子票，请在下载中查看');
  }catch{toast(board,'生成失败，请稍后重试');}
  finally{board.downloadBusy=false;if(button.isConnected){button.disabled=false;button.textContent='保存电子票';}}
}

gallery.addEventListener('click',async event=>{
  const root=event.target.closest('[data-board]'),board=boards.find(item=>item.id===root?.dataset.board);
  if(!board)return;
  if(event.target===query(board,'.cc-layer')){closeSheet(board);return;}
  const button=event.target.closest('button');
  if(!button||button.disabled)return;
  if(button.dataset.date){showDate(board,button.dataset.date);return;}
  if(button.dataset.month){board.session.month=shiftMonth(select(board).month,Number(button.dataset.month));render(board);query(board,`[data-month="${button.dataset.month}"]`).focus({preventScroll:true});return;}
  if(button.dataset.upgrade){showMembership(board,button.dataset.upgrade);return;}
  if(button.dataset.play||button.dataset.episode){showPlayer(board,Number(button.dataset.play||button.dataset.episode));return;}
  if(button.dataset.finish){finishEpisode(board,Number(button.dataset.finish));return;}
  if(button.dataset.ticketLevel){showTicket(board,Number(button.dataset.ticketLevel));return;}
  if(button.dataset.saveTicket){await saveTicket(board,button);return;}
  if(button.hasAttribute('data-close-reward')){closeSheet(board);return;}
  switch(button.dataset.action){
    case 'close':closeSheet(board);break;
    case 'ticket':showTicket(board);break;
    case 'today':board.session.month=select(board).today.slice(0,7);board.session.selectedDate=select(board).today;render(board);query(board,'[data-action="today"]').focus({preventScroll:true});break;
    case 'reminder':board.session.reminded=!board.session.reminded;render(board);query(board,'[data-action="reminder"]').focus({preventScroll:true});toast(board,board.session.reminded?'已开启演示提醒，不发送真实通知':'演示提醒已关闭');break;
    case 'screening':showScreening(board);break;
    case 'confirm-upgrade':toast(board,'此处为开通入口预览，不产生真实订单');break;
    case 'event-reminder':toast(board,'已记录演示意向，不发送真实通知');break;
    case 'drama':showDrama(board);break;
    case 'theme':{
      board.theme=board.theme==='dark'?'light':'dark';query(board,'.cc-app').dataset.theme=board.theme;
      button.innerHTML=icon(board.theme==='dark'?'sun':'moon');button.setAttribute('aria-label',board.theme==='dark'?'切换浅色外观':'切换深色外观');break;
    }
    case 'share':openSheet(board,'把这一版分享给同事','本地方案链接',`<p>当前方案：${esc(board.name)}</p><button type="button" class="cc-primary" data-action="copy-link">复制本地预览链接</button><p class="cc-note">仅供这台电脑本地预览，尚未同步到线上。</p>`,'share');break;
    case 'copy-link':try{await navigator.clipboard.writeText(previewLink(board));toast(board,'本地预览链接已复制');}catch{toast(board,'可复制浏览器地址栏中的本地链接');}break;
  }
});
gallery.addEventListener('change',event=>{
  if(!event.target.matches('.cc-tierbar select'))return;
  const board=boards.find(item=>item.id===event.target.closest('[data-board]').dataset.board);
  if(!board||!['vip','svip','free'].includes(event.target.value))return;
  board.session.previewTier=event.target.value;board.returnSelector='.cc-tierbar select';render(board);
  if(select(board).context.requiresUpgrade)showMembership(board,board.session.previewTier);
  else query(board,'.cc-tierbar select').focus({preventScroll:true});
});
document.addEventListener('keydown',event=>{
  const board=boards.find(item=>!query(item,'.cc-layer').hidden);
  if(!board)return;
  if(event.key==='Escape'){event.preventDefault();closeSheet(board);return;}
  if(event.key==='Tab'){
    const controls=[...query(board,'.cc-sheet').querySelectorAll('button:not([disabled]),a[href],select,input,[tabindex="0"]')].filter(node=>!node.hidden&&node.getClientRects().length);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
});
function fit(){
  const style=getComputedStyle(gallery),padding=parseFloat(style.paddingLeft)+parseFloat(style.paddingRight),gap=parseFloat(style.columnGap)||48;
  const columns=innerWidth<=760?1:Math.min(3,boards.length);
  const width=(gallery.clientWidth-padding-gap*(columns-1))/columns;
  const scale=Math.min(.88,width/453,Math.max(.38,(innerHeight-112)/912));
  gallery.style.setProperty('--cc-columns',columns);
  document.documentElement.style.setProperty('--cc-scale',scale);
  document.documentElement.style.setProperty('--cc-screen-height',selectedStyle&&innerWidth<=600?`${innerHeight}px`:'852px');
}
for(const board of boards)render(board);
fit();window.addEventListener('resize',fit);
