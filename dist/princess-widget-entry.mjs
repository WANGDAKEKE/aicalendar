import {renderCalendarPosterWidget} from './calendar-poster-widget.mjs';
import {companionCopy} from './companion-copy.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

/**
 * Adapter for this local calendar demonstration, not a real cross-title history
 * service. Never manufacture a playable episode for a free or unknown account.
 */
export function derivePrincessWidgetState(view = {}) {
  const title = typeof view.title === 'string' && view.title.trim() ? view.title : '尚公主';
  const entitled = view.accountTier === 'vip' || view.accountTier === 'svip';
  const episode = Number.isInteger(view.nextEpisode) && view.nextEpisode > 0
    && Array.isArray(view.availableEpisodes) && view.availableEpisodes.includes(view.nextEpisode)
    && entitled
    ? view.nextEpisode : null;
  const caughtUp = episode === null && entitled
    && Array.isArray(view.availableEpisodes) && view.availableEpisodes.length > 0;
  const selection = episode !== null
    ? {status: 'resume', mood: 'ready', target: {contentId: 'princess-demo', title, episode, progressSeconds: 0}}
    : caughtUp ? {status: 'caught-up', mood: 'resting', target: null}
      : {status: 'unavailable', mood: 'unavailable', target: null};
  return {
    selection,
    copy: companionCopy(selection, 'cheeky'),
    canResume: episode !== null,
    episode,
    title,
    actionLabel: episode !== null ? `继续看第${episode}集` : '返回日历看看',
  };
}

function widgetMarkup(view, {size = 'wide', interactive = false, mini = false} = {}) {
  const state = derivePrincessWidgetState(view);
  const caughtUp=state.selection.status==='caught-up';
  return renderCalendarPosterWidget({
    ip:'princess',title:state.title,size,mini,interactive,action:'widget-resume',
    eyebrow:state.canResume?'最近在看':caughtUp?'等下一次更新':'追剧日程',
    headline:state.canResume?'上次的故事，等你继续':caughtUp?'下次更新，等你一起':'追剧更新，一眼看到',
    context:state.canResume?`已看${view.completedCount??0}集 · 第${state.episode}集待观看`:caughtUp?'已追平当前可看内容':'打开日历，查看更新安排',
    actionLabel:state.canResume?'继续观看':'看排期',
  });
}

export function renderPrincessWidgetEntry(view, {previewed = false} = {}) {
  return `<section class="pc-desktop-entry" aria-label="追剧搭子桌面小组件">
    <span class="pc-widget-mini cpw-mini-wrap" aria-hidden="true">${widgetMarkup(view, {mini:true})}</span>
    <span class="pc-desktop-entry__copy"><strong>把追剧搭子放到桌面</strong><span>桌面看更新，一点接着看</span></span>
    <button type="button" class="pc-desktop-entry__action" data-action="desktop" aria-label="${previewed ? '查看' : '预览添加'}追剧搭子桌面小组件">${previewed ? '查看' : '添加'}</button>
  </section>`;
}

function homeApps() {
  return `<div class="pc-widget-home__apps" aria-hidden="true">
    <span><i class="pc-widget-home__photos"><b></b><b></b><b></b><b></b><b></b><b></b></i><small>照片</small></span>
    <span><i class="pc-widget-home__calendar"><b>星期四</b><strong>5</strong></i><small>日历</small></span>
    <span><i class="pc-widget-home__clock"><b></b></i><small>时钟</small></span>
    <span><i class="pc-widget-home__video"><img src="./assets/tencent/tencent-video-official-icon-192.png" alt=""></i><small>腾讯视频</small></span>
  </div>`;
}

export function renderPrincessWidgetSetup(view, {stage = 'setup', size = 'wide'} = {}) {
  const widgetSize = size === 'square' ? 'square' : 'wide';
  const state = derivePrincessWidgetState(view);
  if (stage === 'desktop') {
    return `<div class="pc-widget-setup" data-stage="desktop">
      <div class="pc-widget-home" data-size="${widgetSize}" aria-label="添加小组件后的桌面效果预览">
        <div class="pc-widget-home__heading" aria-hidden="true"><span>19:00</span><span>主屏幕</span></div>
        <div class="pc-widget-display pc-widget-home__slot" data-size="${widgetSize}">${widgetMarkup(view, {size: widgetSize, interactive: true})}</div>
        <span class="pc-widget-home__label">腾讯视频</span>
        ${homeApps()}
      </div>
      <p class="pc-widget-setup__caption">${esc(state.canResume ? `点一下小组件，接着《${state.title}》第${state.episode}集` : '当前暂无可续看的剧集，可点小组件返回日历')}</p>
      <p class="pc-widget-setup__note">本地效果预览，未安装系统组件</p>
      <button type="button" class="pc-widget-setup__secondary" data-action="close">返回日历</button>
    </div>`;
  }
  return `<div class="pc-widget-setup" data-stage="setup">
    <div class="pc-widget-sizes" role="group" aria-label="小组件样式"><button type="button" data-widget-size="wide" aria-pressed="${widgetSize === 'wide'}">横版</button><button type="button" data-widget-size="square" aria-pressed="${widgetSize === 'square'}">方形</button></div>
    <div class="pc-widget-preview-surface"><div class="pc-widget-display" data-size="${widgetSize}" aria-label="${widgetSize === 'wide' ? '横版' : '方形'}追剧搭子小组件预览">${widgetMarkup(view, {size: widgetSize})}</div></div>
    <p class="pc-widget-setup__caption">根据最近观看更新，不限于《尚公主》</p>
    <button type="button" class="pc-widget-setup__primary" data-action="confirm-desktop">预览桌面效果</button>
    <p class="pc-widget-setup__note">当前以《尚公主》演示，未接入真实观看历史</p>
  </div>`;
}
