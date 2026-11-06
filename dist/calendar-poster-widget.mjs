/* Shared, presentational IP-poster widget for the calendar entry and preview.
   Data/action attributes are deliberately allow-listed; this module owns no state. */
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

const IP_CONTENT = Object.freeze({
  princess: Object.freeze({
    title: '尚公主',
    eyebrow: '追剧日历',
    headline: '下次更新，等你一起',
    context: '排期与进度，桌面随时查看',
  }),
  zhanshen: Object.freeze({
    title: '斩神Ⅱ',
    eyebrow: '每周四限免更新',
    headline: '新的冒险，桌面见',
    context: '更新与限免，抬眼就知道',
  }),
});

function renderIcon(play = false) {
  const path = play
    ? '<path d="m9 6 10 6-10 6Z" fill="currentColor" stroke="none"/>'
    : '<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 10h16m-11 5h.01M12 15h.01M16 15h.01"/>';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

/** Native-size poster card; mini is a purpose-built thumbnail, not a scaled widget. */
export function renderCalendarPosterWidget({
  ip = 'princess', size = 'wide', mini = false, interactive = false,
  action = 'widget-calendar', title, eyebrow, headline, context, actionLabel = '看排期',
} = {}) {
  const safeIP = Object.hasOwn(IP_CONTENT, ip) ? ip : 'princess';
  const defaults = IP_CONTENT[safeIP];
  const content = {
    title: String(title ?? defaults.title),
    eyebrow: String(eyebrow ?? defaults.eyebrow),
    headline: String(headline ?? defaults.headline),
    context: String(context ?? defaults.context),
    actionLabel: String(actionLabel ?? '看排期'),
  };
  const safeSize = size === 'square' ? 'square' : 'wide';
  const safeAction = ['widget-resume', 'widget-calendar'].includes(action) ? action : 'widget-calendar';
  const isMini = mini === true;
  const isInteractive = interactive === true;
  const tag = isInteractive ? 'button' : 'span';
  const label = ['腾讯视频桌面小组件', content.title, content.eyebrow, content.headline, content.context, content.actionLabel].filter(Boolean).join('，');
  const attributes = isInteractive
    ? `type="button" data-action="${safeAction}"`
    : 'role="img"';
  const common = `class="cpw-card${isMini ? ' cpw-card--mini' : ''}" data-ip="${safeIP}" data-size="${safeSize}" ${attributes} aria-label="${escapeHTML(label)}"`;
  const art = '<span class="cpw-card__art" aria-hidden="true"></span><span class="cpw-card__scrim" aria-hidden="true"></span>';

  if (isMini) {
    return `<${tag} ${common}>${art}<span class="cpw-card__mini-title" aria-hidden="true">${escapeHTML(content.title)}</span><span class="cpw-card__mini-action" aria-hidden="true">${renderIcon()}</span></${tag}>`;
  }

  return `<${tag} ${common}>${art}
    <span class="cpw-card__top" aria-hidden="true"><span class="cpw-card__brand"><img src="./assets/tencent/tencent-video-official-icon-192.png" alt="" width="192" height="192"><span>腾讯视频</span></span><span class="cpw-card__eyebrow">${escapeHTML(content.eyebrow)}</span></span>
    <span class="cpw-card__title" aria-hidden="true">${escapeHTML(content.title)}</span>
    <span class="cpw-card__bottom" aria-hidden="true"><span class="cpw-card__copy"><span class="cpw-card__headline">${escapeHTML(content.headline)}</span><span class="cpw-card__context">${escapeHTML(content.context)}</span></span><span class="cpw-card__action">${renderIcon(content.actionLabel === '继续观看')}<span>${escapeHTML(content.actionLabel)}</span></span></span>
  </${tag}>`;
}
