export const APPLE_PREVIEW = Object.freeze({
  width: 453,
  height: 912,
  screen: Object.freeze({left: 30, top: 30, width: 393, height: 852}),
  asset: './assets/apple/iphone-16-black-portrait.png',
  source: 'https://developer.apple.com/design/resources/',
});

export function renderIOSPreview() {
  return `<div class="ios-preview" id="iosPreview" data-appearance="light" aria-label="iOS 主屏幕交互原型">
    <div class="ios-wallpaper" aria-hidden="true"></div>
    <div class="native-status"><span id="statusClock">19:30</span><span class="native-status-signals" aria-hidden="true"><svg viewBox="0 0 18 13" fill="currentColor"><rect y="8" width="3" height="5" rx=".8"/><rect x="5" y="5.5" width="3" height="7.5" rx=".8"/><rect x="10" y="3" width="3" height="10" rx=".8"/><rect x="15" width="3" height="13" rx=".8"/></svg><svg viewBox="0 0 17 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 4.5a11 11 0 0 1 15 0M3.7 7.3a7 7 0 0 1 9.6 0M6.4 10a3.2 3.2 0 0 1 4.2 0"/><circle cx="8.5" cy="12" r=".8" fill="currentColor" stroke="none"/></svg><svg viewBox="0 0 29 14" fill="currentColor"><rect x=".7" y=".7" width="24" height="12.6" rx="3.3" fill="none" stroke="currentColor" stroke-opacity=".5" stroke-width="1.2"/><rect x="2.6" y="2.6" width="20.2" height="8.8" rx="1.6"/><path d="M26.5 4.5V9.5Q29.5 9 29.5 7T26.5 4.5" fill-opacity=".5"/></svg></span></div>
    <div class="native-widget-slot"><div id="widgetMount"></div><span class="widget-app-label">腾讯视频</span></div>
    <div class="native-page-dots" aria-hidden="true"><i></i><i></i></div>
    <div class="native-dock" aria-hidden="true"><span class="native-dock-app"><img src="./assets/tencent/tencent-video-official-icon-192.png" alt="" width="192" height="192"></span></div>
    <div class="native-home-indicator" aria-hidden="true"></div>
  </div><img class="device-bezel" src="${APPLE_PREVIEW.asset}" alt="" width="1359" height="2736" decoding="async" fetchpriority="high">`;
}
