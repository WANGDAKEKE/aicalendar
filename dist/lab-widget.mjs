import {penguinArt, getPenguinState} from './lab-journey.mjs';

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const episodeNumbers = value => [...new Set((Array.isArray(value) ? value : [])
  .filter(episode => Number.isSafeInteger(episode) && episode >= 1 && episode <= 30))]
  .sort((a, b) => a - b);

function nextReleaseCaption(next) {
  if (!next || typeof next.date !== 'string' || typeof next.time !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(next.date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(next.time)) return null;
  const date = new Date(`${next.date}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== next.date) return null;
  return `${Number(next.date.slice(5, 7))}月${Number(next.date.slice(8, 10))}日 ${next.time} 再相见`;
}

function widgetContent(view = {}) {
  const watched = new Set(episodeNumbers(view?.user?.completed));
  // The caller supplies real account availability, never the previewed tier.
  const pending = episodeNumbers(view?.availableEpisodes).filter(episode => !watched.has(episode));
  const complete = watched.size === 30;
  const state = getPenguinState(view?.progress);
  const title = complete ? '这一程，圆满啦' : pending.length ? `还有 ${pending.length} 集，等你一起看` : '已追平，歇一歇';
  const caption = complete ? '典藏电子票已为你收好'
    : pending.length ? `从第 ${pending[0]} 集继续，企鹅陪你`
      : nextReleaseCaption(view?.summary?.next) || '打开日历，看看更新安排';
  const action = pending.length ? `继续看第 ${pending[0]} 集` : '打开追剧日历';
  const dramaName = typeof view?.drama?.title === 'string' ? view.drama.title : '追剧日历';
  return {title, caption, state, action, dramaName};
}

function clock(view) {
  const timestamp = typeof view?.now === 'string' ? Date.parse(view.now) : NaN;
  if (!Number.isFinite(timestamp)) return '<div class="lab-widget-clock">--:--</div>';
  // Display the shared demo clock in Beijing time, including ISO UTC input.
  const date = new Date(timestamp + 8 * 60 * 60 * 1000);
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getUTCDay()];
  return `<div class="lab-widget-clock">${hours}:${minutes}</div><div class="lab-widget-date">${date.getUTCMonth() + 1}月${date.getUTCDate()}日 星期${weekday}</div>`;
}

function card(view, interactive) {
  const content = widgetContent(view);
  const copy = `<span class="lab-widget-copy"><strong>${escapeHTML(content.title)}</strong><span class="lab-widget-caption">${escapeHTML(content.caption)}</span></span>`;
  const label = escapeHTML(`${content.dramaName}，${content.action}`);
  const entry = interactive
    ? `<button type="button" class="lab-widget-open" data-lab-widget-open aria-label="${label}">${copy}</button>`
    : copy;
  const penguin = `<button type="button" class="lab-widget-penguin" data-lab-widget-penguin aria-label="戳戳桌面企鹅" title="戳戳企鹅">${penguinArt(content.state)}<span class="lab-widget-reaction" role="status" aria-live="polite"></span></button>`;
  return `<div class="lab-widget-card" aria-label="${escapeHTML(content.dramaName)}">${entry}${penguin}</div>`;
}

// Pure rendering only: neither stage installs native software, writes viewing
// history, requests notification permission, nor embeds a playback entitlement.
export function renderWidgetPreview(view = {}) {
  return `<div class="lab-widget-scene lab-widget-preview">${clock(view)}${card(view, false)}<span class="lab-widget-provider">腾讯视频</span></div><button type="button" class="lab-primary" data-lab-widget-add>添加到桌面</button>`;
}

export function renderWidgetDesktop(view = {}) {
  return `<div class="lab-widget-scene lab-widget-desktop">${clock(view)}${card(view, true)}<span class="lab-widget-provider">腾讯视频</span><span class="lab-widget-added" role="status">已添加</span></div>`;
}
