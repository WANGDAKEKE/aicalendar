const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

function playbackTime(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

/** Presentation only: one widget, one return path, no history mutation. */
export function renderCompanionWidget(selection = {}, copy = {}, {appearance = 'light'} = {}) {
  const resolvedAppearance = appearance === 'dark' ? 'dark' : 'light';
  const target = selection.status === 'resume' ? selection.target : null;
  const lines = Array.isArray(copy.lines) ? copy.lines.slice(0, 2).map(line => String(line ?? '')) : [];
  const mood = copy.key || selection.mood || 'welcome';
  const entry = selection.status === 'logged-out' ? '登录后继续'
    : selection.status === 'caught-up' ? '发现下一部好故事'
    : selection.status === 'unavailable' ? '换个故事'
    : '发现好故事';
  const context = target
    ? `《${target.title}》，第 ${target.episode} 集，${target.progressSeconds > 0 ? `从 ${playbackTime(target.progressSeconds)} 继续观看` : '从本集开头继续观看'}`
    : entry;
  const metadata = target
    ? `<span class="widget-v3__title">《${escapeHTML(target.title)}》</span><span class="widget-v3__episode">第 ${escapeHTML(target.episode)} 集</span>`
    : `<span class="widget-v3__title">${escapeHTML(entry)}</span>`;
  const entryIcon = target
    ? '<path d="M5.2 3.5a.65.65 0 0 1 .98-.56l6.25 3.9a1.36 1.36 0 0 1 0 2.32l-6.25 3.9a.65.65 0 0 1-.98-.56Z"/>'
    : '<path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';

  return `<button type="button" class="widget-v3" id="companionWidget" data-mood="${escapeHTML(mood)}" data-appearance="${resolvedAppearance}" aria-describedby="widgetHint" aria-label="${escapeHTML(`${lines.join('')} ${context}`)}"><span class="widget-v3__headline">${lines.map((line, index) => `<span class="widget-v3__line${index === 1 ? ' widget-v3__line--accent' : ''}">${escapeHTML(line)}</span>`).join('')}</span><span class="widget-v3__footer"><span class="widget-v3__metadata">${metadata}</span><svg class="widget-v3__play" viewBox="0 0 16 16" aria-hidden="true" focusable="false">${entryIcon}</svg></span></button>`;
}
