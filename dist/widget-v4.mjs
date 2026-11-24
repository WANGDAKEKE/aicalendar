import {SCENARIO_IDS, createCompanionScenario, selectCompanion} from './companion-model.mjs';
import {companionCopy} from './companion-copy.mjs';
import {renderEmotiveWidget} from './companion-view-v4.mjs';
import {renderRefinedHome} from './ios-home-v4.mjs';
import {APPLE_PREVIEW} from './ios-preview-v3.mjs';

const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const params = new URLSearchParams(location.search);
const initialScene = SCENARIO_IDS.includes(params.get('scene')) ? params.get('scene') : 'away';
const tone = params.get('tone') === 'gentle' ? 'gentle' : 'cheeky';
const initialCaption = {away:'久未观看',resume:'白天等待',evening:'晚间等待',returned:'回来之后','caught-up':'已经追平',empty:'初次相遇','logged-out':'等待登录',unavailable:'换个故事'}[initialScene];
const cases = [{prefix:'waiting',scene:initialScene,caption:initialCaption}, {prefix:'evening',scene:'evening',caption:'晚间等待'}, {prefix:'returned',scene:'returned',caption:'回来之后'}];
const configurations = params.get('view') === 'single'
  ? [{prefix:'primary',caseId:'primary',scene:initialScene,caption:'',size:params.get('size') === 'square' ? 'square' : 'wide'}]
  : ['wide','square'].flatMap(size=>cases.map(item=>({...item,caseId:item.prefix,prefix:size === 'wide' ? item.prefix : `${item.prefix}-square`,size})));
const caseInputs = new Map();
const boards = configurations.map(item => {
  if (!caseInputs.has(item.caseId)) caseInputs.set(item.caseId,createCompanionScenario(item.scene));
  return {...item,input:caseInputs.get(item.caseId),target:null};
});

function clock(input) {
  return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(input.now));
}

function time(seconds) {
  const value = Math.max(0,Math.floor(Number(seconds)||0));
  return `${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`;
}

$('#interfaceGallery').innerHTML = boards.map(board => `<section class="artboard" data-board="${board.prefix}" data-size="${board.size}" ${board.prefix==='waiting-square' ? 'id="square-row"' : ''} aria-label="${board.size === 'square' ? '1:1 方形 · ' : ''}${escapeHTML(board.caption || '追剧搭子')}界面"><div class="device-wrap"><div class="device">${renderRefinedHome({prefix:board.prefix,clock:clock(board.input),size:board.size})}</div></div>${board.caption ? `<p class="artboard-caption">${escapeHTML(board.caption)}</p>` : ''}</section>`).join('');

function renderBoard(board) {
  const selection = selectCompanion(board.input);
  const copy = companionCopy(selection,tone);
  $(`#${board.prefix}-widgetMount`).innerHTML = renderEmotiveWidget(selection,copy,{id:`${board.prefix}-widget`,hintId:`${board.prefix}-hint`,size:board.size});
  const caption = $(`[data-board="${board.prefix}"] .artboard-caption`);
  if (caption) caption.textContent = `${board.size==='square' ? '1:1 方形 · ' : ''}${{ready:'白天等待',evening:'晚间等待',waiting:'久未观看',returned:'回来之后',resting:'已经追平',welcome:'初次相遇','logged-out':'等待登录',unavailable:'换个故事'}[copy.key] || board.caption}`;
  return selection;
}

function renderCase(board) {
  for (const sibling of boards) if (sibling.input === board.input) renderBoard(sibling);
}

function sheetLayer(board) {
  const home = $(`[data-board="${board.prefix}"] .rf-home`);
  let layer = home.querySelector('.return-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'return-layer';
    layer.hidden = true;
    home.append(layer);
  }
  return layer;
}

function showSheet(board,body) {
  for (const other of boards) if (other !== board) closeSheet(other,false);
  const layer = sheetLayer(board);
  layer.innerHTML = `<section class="return-sheet" role="dialog" aria-labelledby="${board.prefix}-sheetTitle"><button type="button" class="return-close" data-close aria-label="返回桌面"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"/></svg></button>${body}</section>`;
  layer.hidden = false;
  $(`[data-board="${board.prefix}"] .rf-home-content`).inert = true;
  layer.querySelector('[data-close]').focus({preventScroll:true});
}

function closeSheet(board,returnFocus=true) {
  const layer = $(`[data-board="${board.prefix}"] .return-layer`);
  if (!layer || layer.hidden) return;
  layer.hidden = true;
  $(`[data-board="${board.prefix}"] .rf-home-content`).inert = false;
  board.target = null;
  if (returnFocus) $(`#${board.prefix}-widget`).focus({preventScroll:true});
}

function playback(board,target) {
  board.target = {...target};
  showSheet(board,`<p class="return-eyebrow"><img src="./assets/tencent/tencent-video-official-icon-192.png" alt="">腾讯视频</p><div class="return-player"><span>${escapeHTML(target.title)} · 第 ${target.episode} 集</span></div><h2 id="${board.prefix}-sheetTitle">接着上次的故事</h2><p class="return-caption">《${escapeHTML(target.title)}》第 ${target.episode} 集<br>${target.progressSeconds ? `从 ${time(target.progressSeconds)} 继续观看` : '从本集开头继续观看'}</p><button type="button" class="return-action" data-watch>模拟观看 5 分钟</button><p class="return-note">本地播放预览，不涉及真实账号；仅打开不增加观看记录。</p>`);
}

function browse(board) {
  board.target = null;
  const playable = board.input.contents.filter(item => item.playable && item.availableEpisodes > 0);
  showSheet(board,`<p class="return-eyebrow">腾讯视频</p><h2 id="${board.prefix}-sheetTitle">下一部，一起看</h2><p class="return-caption">选择一部，接着新的故事。</p><div class="return-recommendations">${playable.map(item=>`<button type="button" data-start="${escapeHTML(item.id)}">${escapeHTML(item.title)}</button>`).join('') || '<p class="return-caption">当前暂无可播内容。</p>'}</div>`);
}

function openWidget(board) {
  const selection = selectCompanion(board.input);
  if (selection.status === 'logged-out') {
    board.target = null;
    showSheet(board,`<p class="return-eyebrow">腾讯视频</p><h2 id="${board.prefix}-sheetTitle">先认识一下</h2><p class="return-caption">登录后，接着你自己的观看记录。</p><button type="button" class="return-action" data-login>模拟登录</button><p class="return-note">仅切换本页状态，不涉及真实账号。</p>`);
  } else if (selection.target) playback(board,selection.target);
  else browse(board);
}

$('#interfaceGallery').addEventListener('click',event => {
  const section = event.target.closest('[data-board]');
  const board = boards.find(item => item.prefix === section?.dataset.board);
  if (!board) return;
  if (event.target.closest('.widget-v4')) openWidget(board);
  if (event.target.closest('[data-close]') || event.target.classList.contains('return-layer')) closeSheet(board);
  if (event.target.closest('[data-login]')) {board.input.loggedIn=true;renderCase(board);browse(board);}
  const start = event.target.closest('[data-start]');
  if (start) {
    const content = board.input.contents.find(item=>item.id === start.dataset.start && item.playable && item.availableEpisodes>0);
    if (content) playback(board,{contentId:content.id,title:content.title,episode:1,progressSeconds:0,durationSeconds:content.episodeDurationSeconds});
  }
  if (event.target.closest('[data-watch]') && board.target) {
    const target = board.target;
    const content = board.input.contents.find(item=>item.id === target.contentId);
    if (!board.input.loggedIn || !content?.playable || target.episode>content.availableEpisodes) return;
    board.input.history.push({contentId:target.contentId,episode:target.episode,progressSeconds:Math.min(target.durationSeconds,target.progressSeconds+300),durationSeconds:target.durationSeconds,lastWatchedAt:board.input.now});
    renderCase(board);
    closeSheet(board);
  }
});
window.addEventListener('keydown',event=>{if(event.key==='Escape')for(const board of boards)closeSheet(board);});

function fitInterfaces() {
  const gallery = $('#interfaceGallery');
  const style = getComputedStyle(gallery);
  const horizontalPadding = parseFloat(style.paddingLeft)+parseFloat(style.paddingRight);
  const gap = parseFloat(style.columnGap)||42;
  const mobile = innerWidth<=760;
  const availableWidth = gallery.clientWidth-horizontalPadding;
  const columns = Math.min(3,boards.length);
  gallery.style.setProperty('--gallery-columns',String(columns));
  const columnWidth = mobile ? availableWidth : (availableWidth-gap*(columns-1))/columns;
  const scale = Math.min(.86,columnWidth/APPLE_PREVIEW.width,Math.max(.36,(innerHeight-88)/APPLE_PREVIEW.height));
  document.documentElement.style.setProperty('--interface-scale',String(scale));
}
for(const board of boards)renderBoard(board);
fitInterfaces();
if(location.hash === '#square-row')$('#square-row')?.scrollIntoView({block:'start'});
window.addEventListener('resize',fitInterfaces);
