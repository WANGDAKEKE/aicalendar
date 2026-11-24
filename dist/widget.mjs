import {COMPANION_SCENARIOS, SCENARIO_IDS, createCompanionScenario, selectCompanion} from './companion-model.mjs';
import {companionCopy} from './companion-copy.mjs';
import {renderIOSHome} from './ios-home.mjs';

const $ = selector => document.querySelector(selector);
$('.phone').innerHTML = renderIOSHome();
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const params = new URLSearchParams(location.search);
let scene = SCENARIO_IDS.includes(params.get('scene')) ? params.get('scene') : 'evening';
let input = createCompanionScenario(scene);
let tone = params.get('tone') === 'gentle' ? 'gentle' : 'cheeky';
let copyIndex = 0;
let reactionTimer;
let activeTarget = null;
const dialog = $('#returnDialog');

const notes = {
  resume_latest: '最近有观看记录，今天还没看。白天轻轻提醒，点击续接上次进度。',
  evening_reminder: '今天还没有观看记录，已经到晚间。文案变得有点急，续看目标保持不变。',
  away_for_days: '距离最近一次观看已有 3 天或以上。搭子开始躺平，有空回来就好。',
  returned_after_break: '今天产生了观看记录。搭子从催促切换为欢迎，实际进度同步更新。',
  watched_today: '今天已经看过了。今天不再催，仍可从刚才的位置继续。',
  caught_up: '观看历史中的可播内容已经追平。没有可续看的目标，入口改为浏览内容。',
  no_history: '还没有有效观看记录。先发现内容，观看之后再生成自己的续看组件。',
  login_required: '尚未登录，组件不展示个人观看历史。登录后再读取对应账号的进度。',
  no_playable_history: '历史内容当前均不可播。展示替代入口，不跳转到失效播放页面。',
  invalid_clock: '演示时间不可用，暂不生成续看入口。',
};

function time(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

function clockParts() {
  const date = new Date(input.now);
  const options = {timeZone: 'Asia/Shanghai'};
  return {
    clock: new Intl.DateTimeFormat('en-GB', {...options, hour:'2-digit', minute:'2-digit', hour12:false}).format(date),
    date: new Intl.DateTimeFormat('zh-CN', {...options, month:'long', day:'numeric', weekday:'long'}).format(date),
  };
}

function updateURL() {
  const url = new URL(location.href);
  url.searchParams.set('scene', scene);
  url.searchParams.set('tone', tone);
  history.replaceState(null, '', url);
}

function feedback(message) {
  clearTimeout(reactionTimer);
  $('#reaction').textContent = message;
  reactionTimer = setTimeout(() => {$('#reaction').textContent = '';}, 3500);
}

function render() {
  const selection = selectCompanion(input);
  const copy = companionCopy(selection, tone, copyIndex);
  const clock = clockParts();
  $('#statusClock').textContent = $('#desktopClock').textContent = clock.clock;
  $('#desktopDate').textContent = clock.date;
  $('#scenarioList').innerHTML = COMPANION_SCENARIOS.map((item, index) => `<button type="button" class="scenario-button" data-scene="${item.id}" aria-pressed="${scene === item.id}"><span class="scenario-number">${String(index + 1).padStart(2, '0')}</span><strong>${item.label}</strong><span class="scenario-sub">${({resume:'轻轻等',evening:'有点急',away:'已躺平',returned:'哄好了','caught-up':'等更新',empty:'先认识','logged-out':'认领我',unavailable:'换个看'})[item.id]}</span></button>`).join('');
  for (const button of document.querySelectorAll('[data-tone]')) button.setAttribute('aria-pressed', String(button.dataset.tone === tone));
  const target = selection.target;
  const title = target ? `《${target.title}》 · 第 ${target.episode} 集`
    : selection.status === 'logged-out' ? '登录，找回你的观看记录'
    : selection.status === 'caught-up' ? '最近在看的内容，已追平'
    : selection.status === 'unavailable' ? '看看其他故事' : '发现你的下一部好故事';
  const detail = target ? target.progressSeconds > 0 ? `上次看到 ${time(target.progressSeconds)} · 点我继续` : '下一集已上线 · 点我继续'
    : selection.status === 'logged-out' ? '点击登录后继续'
    : selection.status === 'caught-up' ? '打开腾讯视频，逛逛新内容' : '点击打开腾讯视频';
  const moodTag = copy.key === 'waiting' && selection.daysAway != null ? `${selection.daysAway} 天没见了` : copy.tag;
  const widget = $('#companionWidget');
  widget.dataset.mood = copy.key;
  widget.setAttribute('aria-label', `${copy.lines.join('')} ${title}，${detail}`);
  widget.innerHTML = `<span class="widget-top"><span class="widget-brand"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2.5Q2 1 4 2l10 5Q16 8 14 9L4 14Q2 15 3 13Z"/></svg>腾讯视频</span><span class="widget-mood">${escapeHTML(moodTag)}</span></span><span class="widget-eyes" aria-hidden="true"><span class="widget-eye"><i></i></span><span class="widget-eye"><i></i></span></span><span class="widget-headline">${copy.lines.map(line=>`<span>${escapeHTML(line)}</span>`).join('')}</span><span class="widget-bottom"><span class="widget-content-info"><b>${escapeHTML(title)}</b><span>${escapeHTML(detail)}</span></span><span class="widget-arrow" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M4 12 12 4M4 4H12V12"/></svg></span></span><span class="widget-sticker" aria-hidden="true">收到，马上安排</span>`;
  $('#stateReason').textContent = notes[selection.reason] || '根据最近的有效观看记录选择续看内容。';
  const records = input.loggedIn ? [...input.history].sort((a,b)=>Date.parse(b.lastWatchedAt)-Date.parse(a.lastWatchedAt)) : [];
  $('#historyList').innerHTML = records.length ? records.map(record => {
    const content = input.contents.find(item => item.id === record.contentId);
    return `<div class="history-item"><b>${escapeHTML(content?.title || '内容暂不可用')}</b><span>第 ${record.episode} 集 · ${time(record.progressSeconds)}</span></div>`;
  }).join('') : '<p>暂无可展示的个人观看记录</p>';
  return selection;
}

function openDialog(body) {
  $('#returnBody').innerHTML = body;
  if (!dialog.open) dialog.showModal();
}

function playback(target) {
  activeTarget = {...target};
  openDialog(`<p class="return-eyebrow">桌面组件 → 腾讯视频</p><div class="return-player"><span>${escapeHTML(target.title)} · 第 ${target.episode} 集</span></div><h2 class="return-title" id="returnTitle">故事，接上了。</h2><p class="return-caption">《${escapeHTML(target.title)}》第 ${target.episode} 集<br>${target.progressSeconds > 0 ? `从 ${time(target.progressSeconds)} 继续观看` : '从本集开头继续观看'}</p><p class="return-path">保留内容、集号与播放位置，回到对应播放器。</p><button class="return-action" data-watch>模拟观看 5 分钟</button><p class="return-note">这是回流交互预览。点击组件只打开页面，模拟观看后才更新本页的演示记录。</p>`);
}

function browse() {
  activeTarget = null;
  const playable = input.contents.filter(content => content.playable && content.availableEpisodes > 0);
  openDialog(`<p class="return-eyebrow">桌面组件 → 腾讯视频</p><h2 class="return-title" id="returnTitle">换个故事，也行。</h2><p class="return-caption">先选一部开始看，下次搭子就知道等谁了。</p><div class="return-recommendations">${playable.map(content=>`<button data-start="${escapeHTML(content.id)}">${escapeHTML(content.title)} <span aria-hidden="true">↗</span></button>`).join('') || '<p class="return-caption">当前演示情境没有可播内容。</p><button class="return-action secondary" data-normal>切到正常续看情境</button>'}</div>`);
}

function openFromWidget() {
  const selection = selectCompanion(input);
  if (selection.status === 'logged-out') {
    activeTarget = null;
    openDialog('<p class="return-eyebrow">桌面组件 → 腾讯视频登录</p><h2 class="return-title" id="returnTitle">先认识一下。</h2><p class="return-caption">登录后，才能为你续接自己的观看记录。</p><button class="return-action" data-login>模拟登录</button><p class="return-note">仅切换本页的模拟登录状态，不涉及真实账号。</p>');
  } else if (selection.target) playback(selection.target);
  else browse();
}

function changeScene(id) {
  if (!SCENARIO_IDS.includes(id)) return;
  scene = id;
  input = createCompanionScenario(scene);
  copyIndex = 0;
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
$('#refreshCopy').addEventListener('click', () => {copyIndex += 1;render();feedback('换句台词，观看进度没动。');});
$('#resetDemo').addEventListener('click', () => {changeScene(scene);feedback('已恢复这个情境的初始记录。');});
$('#companionWidget').addEventListener('click', openFromWidget);
$('#closeDialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }
  if (event.target.closest('[data-login]')) {input.loggedIn = true;render();browse();}
  if (event.target.closest('[data-normal]')) {changeScene('evening');}
  const start = event.target.closest('[data-start]');
  if (start) {
    const content = input.contents.find(item => item.id === start.dataset.start && item.playable && item.availableEpisodes > 0);
    if (content) playback({contentId:content.id,title:content.title,episode:1,progressSeconds:0,durationSeconds:content.episodeDurationSeconds});
  }
  if (event.target.closest('[data-watch]') && activeTarget) {
    const target = activeTarget;
    const content = input.contents.find(item => item.id === target.contentId);
    if (!input.loggedIn || !content?.playable || target.episode > content.availableEpisodes) return;
    const progressSeconds = Math.min(target.durationSeconds, target.progressSeconds + 300);
    input.history.push({contentId:target.contentId,episode:target.episode,progressSeconds,durationSeconds:target.durationSeconds,lastWatchedAt:input.now});
    activeTarget = null;
    render();
    dialog.close();
    $('#companionWidget').focus({preventScroll:true});
    feedback(`已模拟观看 5 分钟 · 今天的搭子哄好了`);
    $('#companionWidget').classList.remove('is-reacting');
    requestAnimationFrame(()=>$('#companionWidget').classList.add('is-reacting'));
    setTimeout(()=>$('#companionWidget').classList.remove('is-reacting'),1800);
  }
});

function fitDesktopPreview() {
  const scale = innerWidth > 850
    ? Math.min(.92, Math.max(.48, (innerHeight - 202) / 844))
    : Math.min(.94, (innerWidth - 52) / 390);
  document.documentElement.style.setProperty('--preview-scale', String(scale));
}
window.addEventListener('resize', fitDesktopPreview);
fitDesktopPreview();
render();
