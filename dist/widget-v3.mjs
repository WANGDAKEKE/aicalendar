import {COMPANION_SCENARIOS, SCENARIO_IDS, createCompanionScenario, selectCompanion} from './companion-model.mjs';
import {companionCopy} from './companion-copy.mjs';
import {renderCompanionWidget} from './companion-view-v3.mjs';
import {APPLE_PREVIEW, renderIOSPreview} from './ios-preview-v3.mjs';

const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const params = new URLSearchParams(location.search);
let scene = SCENARIO_IDS.includes(params.get('scene')) ? params.get('scene') : 'away';
let input = createCompanionScenario(scene);
let tone = params.get('tone') === 'gentle' ? 'gentle' : 'cheeky';
let appearance = params.get('appearance') === 'dark' ? 'dark' : 'light';
let copyIndex = 0;
let originalSize = false;
let activeTarget = null;
let reactionTimer;
$('#deviceMount').innerHTML = renderIOSPreview();
document.documentElement.style.setProperty('--device-width', `${APPLE_PREVIEW.width}px`);
document.documentElement.style.setProperty('--device-height', `${APPLE_PREVIEW.height}px`);
const dialog = $('#returnDialog');
const reasons = {
  resume_latest: '最近有观看记录，今天还没看。白天轻提醒，点击从上次位置继续。',
  evening_reminder: '今天还没有观看记录，已到晚间。语气变急，但续看目标不变。',
  away_for_days: '距最近一次观看已有 3 天或以上。用文案表达等待，不增加重复状态标签。',
  returned_after_break: '今天产生了观看记录，切换为欢迎文案，实际进度同步更新。',
  watched_today: '今天已经看过了，不再催促；仍可从刚才的位置继续。',
  caught_up: '观看历史中的可播内容已经追平。点击后进入内容发现。',
  no_history: '没有有效观看记录。先发现内容，观看后生成自己的续看目标。',
  login_required: '未登录时不展示个人观看记录。点击先登录，再读取对应账号的记录。',
  no_playable_history: '历史内容当前均不可播。提供其他内容入口，不跳转失效播放页。',
  invalid_clock: '模拟时间不可用，暂不生成续看目标。',
};

function time(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

function updateURL() {
  const url = new URL(location.href);
  url.searchParams.set('scene', scene);
  url.searchParams.set('tone', tone);
  url.searchParams.set('appearance', appearance);
  history.replaceState(null, '', url);
}

function feedback(message) {
  clearTimeout(reactionTimer);
  $('#reaction').textContent = message;
  reactionTimer = setTimeout(() => {$('#reaction').textContent = '';}, 2800);
}

function render() {
  const selection = selectCompanion(input);
  const copy = companionCopy(selection, tone, copyIndex);
  $('#widgetMount').innerHTML = renderCompanionWidget(selection, copy, {appearance});
  $('#iosPreview').dataset.appearance = appearance;
  $('#statusClock').textContent = new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(input.now));
  $('#scenarioList').innerHTML = COMPANION_SCENARIOS.map(item => `<button type="button" class="scenario-button" data-scene="${item.id}" aria-pressed="${scene === item.id}"><span>${escapeHTML(item.label)}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg></button>`).join('');
  for (const button of document.querySelectorAll('[data-tone]')) button.setAttribute('aria-pressed', String(button.dataset.tone === tone));
  for (const button of document.querySelectorAll('[data-appearance]')) {
    if (button.tagName === 'BUTTON' && button.id !== 'companionWidget') button.setAttribute('aria-pressed', String(button.dataset.appearance === appearance));
  }
  $('#stateReason').textContent = reasons[selection.reason] || '根据最近的有效观看记录选择续看内容。';
  const records = input.loggedIn ? [...input.history].sort((a,b) => Date.parse(b.lastWatchedAt)-Date.parse(a.lastWatchedAt)) : [];
  $('#historyList').innerHTML = records.length ? records.map(record => {
    const content = input.contents.find(item => item.id === record.contentId);
    return `<div class="history-item"><b>${escapeHTML(content?.title || '内容暂不可用')}</b><span>第 ${record.episode} 集 · ${time(record.progressSeconds)}</span></div>`;
  }).join('') : '<p class="control-note">暂无可展示的个人观看记录</p>';
  return selection;
}

function openDialog(body) {
  $('#returnBody').innerHTML = body;
  if (!dialog.open) dialog.showModal();
}

function playback(target) {
  activeTarget = {...target};
  openDialog(`<p class="return-eyebrow">组件续看 · 回流预览</p><div class="return-player"><span>${escapeHTML(target.title)} · 第 ${target.episode} 集</span></div><h2 class="return-title" id="returnTitle">接着上次的故事。</h2><p class="return-caption">《${escapeHTML(target.title)}》第 ${target.episode} 集<br>${target.progressSeconds > 0 ? `从 ${time(target.progressSeconds)} 继续观看` : '从本集开头继续观看'}</p><button type="button" class="return-action" data-watch>模拟观看 5 分钟</button><p class="return-note">仅打开页面不计为已看；模拟观看后才更新本页记录。</p>`);
}

function browse() {
  activeTarget = null;
  const playable = input.contents.filter(content => content.playable && content.availableEpisodes > 0);
  openDialog(`<p class="return-eyebrow">组件续看 · 内容发现</p><h2 class="return-title" id="returnTitle">换个故事，也行。</h2><p class="return-caption">先选一部开始看，下次从这里继续。</p><div class="return-recommendations">${playable.map(content => `<button type="button" data-start="${escapeHTML(content.id)}">${escapeHTML(content.title)}<span aria-hidden="true">→</span></button>`).join('') || '<p class="return-caption">当前情境没有可播内容。</p><button type="button" data-normal>切到正常续看情境</button>'}</div>`);
}

function openFromWidget() {
  const selection = selectCompanion(input);
  if (selection.status === 'logged-out') {
    activeTarget = null;
    openDialog('<p class="return-eyebrow">组件续看 · 登录</p><h2 class="return-title" id="returnTitle">先认识一下。</h2><p class="return-caption">登录后，为你续接自己的观看记录。</p><button type="button" class="return-action" data-login>模拟登录</button><p class="return-note">只切换本页模拟状态，不涉及真实账号。</p>');
  } else if (selection.target) playback(selection.target);
  else browse();
}

function changeScene(id) {
  if (!SCENARIO_IDS.includes(id)) return;
  scene = id;
  input = createCompanionScenario(id);
  copyIndex = 0;
  activeTarget = null;
  if (dialog.open) dialog.close();
  updateURL();
  render();
}

$('#scenarioList').addEventListener('click', event => {
  const button = event.target.closest('[data-scene]');
  if (button) changeScene(button.dataset.scene);
});
$('#toneOptions').addEventListener('click', event => {
  const button = event.target.closest('[data-tone]');
  if (button) {tone = button.dataset.tone;copyIndex = 0;updateURL();render();}
});
$('#appearanceOptions').addEventListener('click', event => {
  const button = event.target.closest('[data-appearance]');
  if (button) {appearance = button.dataset.appearance;updateURL();render();}
});
$('#refreshCopy').addEventListener('click', () => {copyIndex += 1;render();feedback('换了一句台词，观看进度不变。');});
$('#resetDemo').addEventListener('click', () => {changeScene(scene);feedback('已恢复当前情境。');});
$('#widgetMount').addEventListener('click', event => {if (event.target.closest('#companionWidget')) openFromWidget();});
$('#closeDialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }
  if (event.target.closest('[data-login]')) {input.loggedIn = true;render();browse();}
  if (event.target.closest('[data-normal]')) changeScene('evening');
  const start = event.target.closest('[data-start]');
  if (start) {
    const content = input.contents.find(item => item.id === start.dataset.start && item.playable && item.availableEpisodes > 0);
    if (content) playback({contentId:content.id,title:content.title,episode:1,progressSeconds:0,durationSeconds:content.episodeDurationSeconds});
  }
  if (event.target.closest('[data-watch]') && activeTarget) {
    const target = activeTarget;
    const content = input.contents.find(item => item.id === target.contentId);
    if (!input.loggedIn || !content?.playable || target.episode > content.availableEpisodes) return;
    input.history.push({contentId:target.contentId,episode:target.episode,progressSeconds:Math.min(target.durationSeconds,target.progressSeconds+300),durationSeconds:target.durationSeconds,lastWatchedAt:input.now});
    activeTarget = null;
    render();
    dialog.close();
    $('#companionWidget').focus({preventScroll:true});
    feedback('已模拟观看 5 分钟，搭子切换为欢迎状态。');
  }
});

function fitPreview() {
  const availableWidth = Math.min($('.preview-column').clientWidth, innerWidth <= 760 ? 408 : 400);
  const scale = originalSize ? 1 : innerWidth > 760
    ? Math.min(.88,Math.max(.42,(innerHeight-190)/APPLE_PREVIEW.height),availableWidth/APPLE_PREVIEW.width)
    : Math.min(.9,availableWidth/APPLE_PREVIEW.width);
  document.documentElement.style.setProperty('--preview-scale',String(scale));
  $('#previewScale').setAttribute('aria-pressed',String(originalSize));
  $('#previewScale').firstChild.textContent = originalSize ? '100% 原尺寸 ' : '适应窗口 ';
}
$('#previewScale').addEventListener('click', () => {originalSize = !originalSize;fitPreview();});
window.addEventListener('resize',fitPreview);
fitPreview();
render();
