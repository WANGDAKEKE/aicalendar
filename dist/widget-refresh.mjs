import { renderRefinedHome } from './ios-home-v4.mjs';
import { REFRESH_SCENARIOS, createRefreshStudy } from './widget-refresh-model.mjs';
import { renderRefreshCard, refreshActionDetails, escapeRefreshHTML } from './widget-refresh-view.mjs';

const params = new URLSearchParams(location.search);
let study = createRefreshStudy(params.get('scene'));
let variant = params.get('variant') === 'poster' ? 'poster' : 'split';
let appearance = params.get('appearance') === 'dark' ? 'dark' : 'light';
let returnFocus = null;

const device = document.getElementById('refresh-device');
device.innerHTML = renderRefinedHome({prefix: 'refresh', clock: '20:00'});
const phone = device.querySelector('.rf-home');
phone.insertAdjacentHTML('beforeend', '<div class="refresh-sheet-layer" id="refresh-sheet-layer" hidden><section class="refresh-sheet" role="dialog" aria-modal="true" aria-labelledby="refresh-sheet-title"><button type="button" class="refresh-sheet-close" aria-label="关闭演示">×</button><p class="refresh-sheet-brand">腾讯视频 · 跳转演示</p><h2 id="refresh-sheet-title"></h2><p id="refresh-sheet-body"></p><p class="refresh-sheet-hint" id="refresh-sheet-hint"></p><button class="refresh-sheet-back" type="button">返回组件</button></section></div>');

const sceneSelect = document.getElementById('refresh-scene');
sceneSelect.innerHTML = REFRESH_SCENARIOS.map(scene => `<option value="${escapeRefreshHTML(scene.id)}">${escapeRefreshHTML(scene.label)}</option>`).join('');
const layer = document.getElementById('refresh-sheet-layer');
const sheet = layer.querySelector('.refresh-sheet');

function closeSheet() {
  layer.hidden = true;
  phone.querySelector('.rf-home-content').inert = false;
  if (returnFocus?.isConnected) returnFocus.focus();
}

function updateURL() {
  const url = new URL(location.href);
  url.searchParams.set('scene', study.id);
  url.searchParams.set('variant', variant);
  url.searchParams.set('appearance', appearance);
  history.replaceState(null, '', url);
}

function render() {
  closeSheet();
  sceneSelect.value = study.id;
  document.getElementById('refresh-widgetMount').innerHTML = renderRefreshCard(study, variant);
  document.getElementById('refresh-split').innerHTML = renderRefreshCard(study, 'split');
  document.getElementById('refresh-poster').innerHTML = renderRefreshCard(study, 'poster');
  document.getElementById('refresh-phone-caption').textContent = variant === 'split' ? '海报＋功能区 · 横版组件' : '整幅海报 · 横版组件';
  document.getElementById('refresh-state-note').textContent = study.description;
  document.querySelectorAll('[data-variant]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.variant === variant)));
  document.querySelectorAll('[data-appearance]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.appearance === appearance)));
  document.querySelectorAll('[data-study]').forEach(item => item.dataset.selected = String(item.dataset.study === variant));
  phone.dataset.appearance = appearance;
  updateURL();
}

function openSheet(action, trigger) {
  const details = refreshActionDetails(study, action);
  returnFocus = trigger;
  document.getElementById('refresh-sheet-title').textContent = details.title;
  document.getElementById('refresh-sheet-body').textContent = details.body;
  document.getElementById('refresh-sheet-hint').textContent = details.hint;
  layer.hidden = false;
  phone.querySelector('.rf-home-content').inert = true;
  layer.querySelector('.refresh-sheet-close').focus();
}

sceneSelect.addEventListener('change', () => { study = createRefreshStudy(sceneSelect.value); render(); });
document.addEventListener('click', event => {
  const variantButton = event.target.closest('button[data-variant]');
  if (variantButton) { variant = variantButton.dataset.variant; render(); return; }
  const themeButton = event.target.closest('button[data-appearance]');
  if (themeButton) { appearance = themeButton.dataset.appearance; render(); return; }
  if (event.target.closest('.refresh-sheet-close, .refresh-sheet-back') || event.target === layer) { closeSheet(); return; }
  const actionButton = event.target.closest('button[data-action]');
  if (actionButton) openSheet(actionButton.dataset.action, actionButton);
});
document.addEventListener('keydown', event => {
  if (layer.hidden) return;
  if (event.key === 'Escape') { event.preventDefault(); closeSheet(); }
  if (event.key === 'Tab') {
    const buttons = [...sheet.querySelectorAll('button')];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});

const previewWrap = document.querySelector('.refresh-device-wrap');
function fitPhone() {
  const scale = Math.min(.75, previewWrap.clientWidth / 453, Math.max(.43, (window.innerHeight - 250) / 912));
  previewWrap.style.setProperty('--phone-scale', String(scale));
  previewWrap.style.height = `${912 * scale}px`;
  document.querySelectorAll('.refresh-card-stage').forEach(stage => {
    const zoom = Math.min(window.innerHeight < 820 ? 1 : 1.2, stage.clientWidth / 345);
    stage.style.setProperty('--card-scale', String(zoom));
    stage.style.height = `${170 * zoom}px`;
  });
}
new ResizeObserver(fitPhone).observe(document.querySelector('.refresh-layout'));
window.addEventListener('resize', fitPhone);
render();
fitPhone();
