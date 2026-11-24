const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

const moods = new Set(['ready', 'evening', 'waiting', 'returned', 'resting', 'welcome', 'logged-out', 'unavailable']);

function playbackTime(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

/** Presentation-only widget sizes share one click target and never mutate history. */
export function renderEmotiveWidget(selection = {}, copy = {}, {id = 'companionWidget', hintId = 'widgetHint', size = 'wide'} = {}) {
  const widgetSize = size === 'square' ? 'square' : 'wide';
  const proposedMood = selection.status === 'logged-out' ? 'logged-out'
    : selection.status === 'unavailable' ? 'unavailable' : copy.key || selection.mood;
  const mood = moods.has(proposedMood) ? proposedMood : 'welcome';
  const target = selection.status === 'resume' ? selection.target : null;
  const lines = Array.isArray(copy.lines) ? copy.lines.slice(0, 2).map(line => String(line ?? '')) : [];
  const entry = selection.status === 'logged-out' ? '登录后继续'
    : selection.status === 'caught-up' ? '发现下一部好故事'
    : selection.status === 'unavailable' ? '换个故事看看'
    : '发现好故事';
  const label = target ? `《${target.title}》 · 第 ${target.episode} 集` : entry;
  const visibleLabel = widgetSize === 'square' && target ? `${target.title} · ${target.episode}集` : label;
  const context = target
    ? `${label}，${target.progressSeconds > 0 ? `从 ${playbackTime(target.progressSeconds)} 继续观看` : '从本集开头继续观看'}`
    : entry;
  const describedBy = hintId ? ` aria-describedby="${escapeHTML(hintId)}"` : '';

  const state = widgetSize === 'wide' ? `<span class="widget-v4__state">${escapeHTML(copy.tag || '')}</span>` : '';
  const play = widgetSize === 'wide' ? '<span class="widget-v4__play" aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false"><path d="M6 4.2a.6.6 0 0 1 .92-.51l5.2 3.3a1.2 1.2 0 0 1 0 2.02l-5.2 3.3a.6.6 0 0 1-.92-.51Z"/></svg></span>' : '';
  return `<button type="button" class="widget-v4" id="${escapeHTML(id)}" data-mood="${mood}" data-size="${widgetSize}"${describedBy} aria-label="${escapeHTML(`${lines.join('')} ${context}`)}"><span class="widget-v4__top"><span class="widget-v4__brand"><img src="./assets/tencent/tencent-video-official-icon-192.png" width="14" height="14" alt="" aria-hidden="true">腾讯视频</span>${state}</span><span class="widget-v4__headline">${lines.map(line => `<span>${escapeHTML(line)}</span>`).join('')}</span><span class="widget-v4__eyes" aria-hidden="true"><span class="widget-v4__eye"><i></i></span><span class="widget-v4__eye"><i></i></span></span><span class="widget-v4__footer"><span class="widget-v4__context">${escapeHTML(visibleLabel)}</span>${play}</span></button>`;
}
