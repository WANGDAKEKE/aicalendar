import {getStudyPalette} from './widget-atlas-palettes.mjs';

const moods = new Set(['ready', 'evening', 'waiting', 'returned', 'resting']);
const variants = new Set(['light-solid', 'light-gradient', 'dark-solid', 'dark-gradient']);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

/** Shared information slots for square studies, wide comparisons and the phone. */
export function renderAtlasWidget(study = {}, options = {}) {
  const {group = 'story', variant = 'light-solid', id = 'atlas-preview', size = 'square', interactive = false, selected = false, action = 'select'} = options ?? {};
  const source = study && typeof study === 'object' ? study : {};
  const widgetGroup = group === 'time' ? 'time' : 'story';
  const widgetVariant = variants.has(variant) ? variant : 'light-solid';
  const mood = moods.has(source.mood) ? source.mood : 'ready';
  const palette = getStudyPalette(mood, widgetVariant);
  const appearance = widgetVariant.startsWith('dark-') ? 'dark' : 'light';
  const finish = widgetVariant.endsWith('-gradient') ? 'gradient' : 'solid';
  const time = widgetGroup === 'time';
  const button = interactive === true;
  const widgetSize = size === 'wide' ? 'wide' : 'square';
  const widgetAction = action === 'resume' ? 'resume' : 'select';
  const selecting = button && widgetAction === 'select';
  const expression = mood === 'ready' ? 'side-eye' : mood === 'resting' ? 'soft' : 'default';
  const sourceLines = Array.isArray(source.lines) ? source.lines : [];
  const lines = [sourceLines[0] ?? '', sourceLines[1] ?? ''];
  const metric = source.metric && typeof source.metric === 'object' ? source.metric : {};
  const hasMetric = metric.label != null || metric.value != null || metric.unit != null;
  const label = [
    '腾讯视频',
    source.title == null || source.title === '' ? '' : `《${source.title}》`,
    source.context,
    hasMetric ? `${metric.label ?? ''} ${metric.value ?? ''}${metric.unit ?? ''}` : '',
    ...lines,
    selecting ? `${appearance === 'dark' ? '深色' : '浅色'}，${finish === 'gradient' ? '轻渐变' : '纯色'}` : '',
    selecting ? `色卡 H${palette.hue}` : '',
    button && widgetAction === 'resume' ? '打开续看预览' : '',
  ].filter(value => value != null && value !== '').join('，');
  const tag = button ? 'button' : 'div';
  const semantics = button ? `type="button"${selecting ? ` aria-pressed="${selected === true}"` : ''}` : 'role="img"';
  const style = `--widget-v4-bg:${palette.top};--widget-v4-ink:${palette.ink};--widget-v4-secondary:${palette.secondary};--atlas-top:${palette.top};--atlas-bottom:${palette.bottom};--atlas-angle:160deg`;
  // Keep each progress field intact; a long period label may move the time to a
  // second line, but neither size silently truncates the saved playback position.
  const context = String(source.context ?? '').split(/\s*·\s*/u).map(part => `<span class="atlas-progress-part">${escapeHTML(part)}</span>`).join('<span class="atlas-progress-separator"> · </span>');

  return `<${tag} ${semantics} class="widget-v4 atlas-widget${time ? ' atlas-widget--time' : ''}" id="${escapeHTML(id)}" data-size="${widgetSize}" data-mood="${mood}" data-expression="${expression}" data-study-id="${escapeHTML(source.id)}" data-variant="${widgetVariant}" data-appearance="${appearance}" data-finish="${finish}" data-group="${widgetGroup}" style="${style}" aria-label="${escapeHTML(label)}">
    <span class="widget-v4__top" aria-hidden="true"><span class="widget-v4__brand"><img src="./assets/tencent/tencent-video-official-icon-192.png" width="14" height="14" alt="">腾讯视频</span></span>
    ${time ? `<span class="atlas-metric" aria-hidden="true"><strong>${escapeHTML(metric.value)}</strong><span>${escapeHTML(metric.unit)}</span></span><span class="atlas-metric-label" aria-hidden="true">${escapeHTML(metric.label)}</span>` : `<span class="atlas-title" title="${escapeHTML(source.title)}" aria-hidden="true">${escapeHTML(source.title)}</span>`}
    <span class="widget-v4__headline" aria-hidden="true">${lines.map(line => `<span>${escapeHTML(line)}</span>`).join('')}</span>
    <span class="widget-v4__eyes" aria-hidden="true"><span class="widget-v4__eye"><i></i></span><span class="widget-v4__eye"><i></i></span></span>
    ${time ? '' : `<span class="widget-v4__footer" aria-hidden="true"><span class="widget-v4__context" title="${escapeHTML(source.context)}">${context}</span></span>`}
  </${tag}>`;
}
