import { APPLE_PREVIEW } from './ios-preview-v3.mjs';
import { renderIOSAppGrid, renderIOSDock, renderIOSIconDefinitions } from './ios-home.mjs';

const escapeHTML = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

/** Render the Home Screen only; the caller supplies each widget's content. */
export function renderRefinedHome({ prefix, clock = '19:30', size = 'wide' }) {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(prefix)) throw new TypeError('A unique alphanumeric phone prefix is required.');
  return `<div class="rf-home" data-widget-size="${size === 'square' ? 'square' : 'wide'}" aria-label="iPhone 主屏幕">
    ${renderIOSIconDefinitions(prefix)}
    <div class="rf-status"><span class="rf-status-clock">${escapeHTML(clock)}</span><span class="rf-status-signals" aria-hidden="true">
      <svg viewBox="0 0 18 13" fill="currentColor"><rect y="8" width="3" height="5" rx=".8"/><rect x="5" y="5.5" width="3" height="7.5" rx=".8"/><rect x="10" y="3" width="3" height="10" rx=".8"/><rect x="15" width="3" height="13" rx=".8"/></svg>
      <svg viewBox="0 0 17 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 4.5a11 11 0 0 1 15 0M3.7 7.3a7 7 0 0 1 9.6 0M6.4 10a3.2 3.2 0 0 1 4.2 0"/><circle cx="8.5" cy="12" r=".8" fill="currentColor" stroke="none"/></svg>
      <svg viewBox="0 0 29 14" fill="currentColor"><rect x=".7" y=".7" width="24" height="12.6" rx="3.3" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-width="1.2"/><rect x="2.6" y="2.6" width="20.2" height="8.8" rx="1.6"/><path d="M26.5 4.5V9.5Q29.5 9 29.5 7T26.5 4.5" fill-opacity=".4"/></svg>
    </span></div>
    <div class="rf-home-content"><div class="rf-widget-slot"><div id="${prefix}-widgetMount"></div><span class="rf-widget-app-label">腾讯视频</span></div>
    ${renderIOSAppGrid(prefix)}
    <div class="rf-search" aria-hidden="true"><svg viewBox="0 0 12 12"><circle cx="5" cy="5" r="3.3"/><path d="m7.5 7.5 3 3"/></svg><span>搜索</span></div>
    ${renderIOSDock(prefix)}
    <div class="rf-home-indicator" aria-hidden="true"></div>
    <span id="${prefix}-hint" class="rf-sr-only">点击组件，继续观看上次的内容。</span></div>
  </div><img class="device-bezel" src="${APPLE_PREVIEW.asset}" alt="" width="1359" height="2736" decoding="async" fetchpriority="high">`;
}
