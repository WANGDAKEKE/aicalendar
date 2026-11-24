const icon = (name, content, extra = '') => `<div class="ios-app" aria-hidden="true"><span class="ios-app-icon ${extra}">${content}</span><span class="ios-app-name">${name}</span></div>`;
const svg = content => `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${content}</svg>`;

const icons = {
  facetime: svg('<rect width="60" height="60" rx="14" fill="url(#ios-green)"/><rect x="11" y="18" width="27" height="24" rx="5" fill="white"/><path d="M39 25 48 19Q51 17 51 21V39Q51 43 48 41L39 35Z" fill="white"/>'),
  calendar: svg('<rect width="60" height="60" rx="14" fill="white"/><text x="30" y="18" fill="#F04443" text-anchor="middle" font-size="9" font-weight="500" font-family="-apple-system,BlinkMacSystemFont,sans-serif">星期四</text><text x="30" y="48" fill="#111" text-anchor="middle" font-size="33" font-weight="300" font-family="-apple-system,BlinkMacSystemFont,sans-serif">29</text>'),
  photos: svg('<rect width="60" height="60" rx="14" fill="white"/><g style="mix-blend-mode:multiply" opacity=".84"><ellipse cx="30" cy="18" rx="8" ry="12" fill="#FFB937"/><ellipse cx="30" cy="18" rx="8" ry="12" fill="#FF773D" transform="rotate(45 30 30)"/><ellipse cx="30" cy="18" rx="8" ry="12" fill="#F0575A" transform="rotate(90 30 30)"/><ellipse cx="30" cy="18" rx="8" ry="12" fill="#CF69A8" transform="rotate(135 30 30)"/><ellipse cx="30" cy="18" rx="8" ry="12" fill="#7C8CCF" transform="rotate(180 30 30)"/><ellipse cx="30" cy="18" rx="8" ry="12" fill="#55B8D4" transform="rotate(225 30 30)"/><ellipse cx="30" cy="18" rx="8" ry="12" fill="#74C584" transform="rotate(270 30 30)"/><ellipse cx="30" cy="18" rx="8" ry="12" fill="#C0D558" transform="rotate(315 30 30)"/></g>'),
  camera: svg('<rect width="60" height="60" rx="14" fill="url(#ios-gray)"/><path d="M12 21H21L24 16H37L40 21H48Q52 21 52 25V43Q52 47 48 47H12Q8 47 8 43V25Q8 21 12 21Z" fill="#25262B"/><circle cx="30" cy="33" r="11" fill="#90939A"/><circle cx="30" cy="33" r="8.4" fill="#191B20"/><circle cx="30" cy="33" r="5.4" fill="#182C40"/><circle cx="28" cy="30" r="2.7" fill="#425C75"/><circle cx="46" cy="26" r="2" fill="#E5E6EA"/>'),
  mail: svg('<rect width="60" height="60" rx="14" fill="url(#ios-blue)"/><rect x="9" y="17" width="42" height="29" rx="3.5" fill="white"/><path d="M10.5 19 27.5 32Q30 34 32.5 32L49.5 19M10 44 24 32M50 44 36 32" stroke="#338FFF" stroke-width="1.7" stroke-linejoin="round"/>'),
  clock: svg('<rect width="60" height="60" rx="14" fill="#101114"/><circle cx="30" cy="30" r="25" fill="#FAFAFC"/><g stroke="#17171B" stroke-width="1.3"><path d="M30 7V10M30 50V53M7 30H10M50 30H53M18.5 10 20 12.6M40 47.4 41.5 50M10 18.5 12.6 20M47.4 40 50 41.5M10 41.5 12.6 40M47.4 20 50 18.5M18.5 50 20 47.4M40 12.6 41.5 10"/></g><path d="M30 15V30L40 36" stroke="#17171B" stroke-width="2.7" stroke-linecap="round"/><path d="M30 31V10" stroke="#FF6739" stroke-width="1"/><circle cx="30" cy="30" r="2.2" fill="#FF6739"/>'),
  maps: svg('<rect width="60" height="60" rx="14" fill="#E7EAD9"/><path d="M0 36 22 27 32 60H0Z" fill="#BBE4AA"/><path d="M48 0H60V60H47L42 38Z" fill="#B1DFF8"/><path d="M-5 20 68 44" stroke="white" stroke-width="12"/><path d="M-5 20 68 44" stroke="#F2CD6B" stroke-width="6"/><path d="M33-5 22 65" stroke="white" stroke-width="11"/><path d="M33-5 22 65" stroke="#97B7E7" stroke-width="6"/><rect x="8" y="7" width="18" height="14" rx="3" fill="#4F9B5E"/><text x="17" y="17" fill="white" text-anchor="middle" font-size="8" font-family="sans-serif" font-weight="700">280</text><path d="m30 26 11 25-11-5-11 5Z" fill="white" stroke="#64A9FD" stroke-width="1.5"/><path d="M30 29V45L38 48Z" fill="#5B9EF1"/>'),
  weather: svg('<rect width="60" height="60" rx="14" fill="url(#ios-weather)"/><circle cx="38" cy="22" r="11" fill="#FFD65B"/><path d="M16 43C8 43 7 32 14 30 13 20 26 17 31 25 38 22 45 28 43 33 53 34 50 44 43 44H17Z" fill="white" fill-opacity=".96"/>'),
  notes: svg('<rect width="60" height="60" rx="14" fill="#FFFEF8"/><path d="M0 14Q0 0 14 0H46Q60 0 60 14V20H0Z" fill="url(#ios-yellow)"/><path d="M0 20H60" stroke="#DAAE24" stroke-width=".6"/><path d="M8 31H52M8 40H52M8 49H52" stroke="#DBDBD8" stroke-width=".8"/>'),
  appstore: svg('<rect width="60" height="60" rx="14" fill="url(#ios-blue)"/><path d="m22 12 21 36M38 12 17 48M11 39H49" stroke="white" stroke-width="4.5" stroke-linecap="round"/><path d="m38 39 5 9" stroke="#308AF7" stroke-width="7"/><path d="m36 36 7 12" stroke="white" stroke-width="4.5" stroke-linecap="round"/>'),
  settings: svg('<rect width="60" height="60" rx="14" fill="url(#ios-gray)"/><g fill="#797D84"><path d="m26 5 8 0 1 7 4 2 6-3 5 6-4 6 1 4 7 2v8l-7 1-2 4 3 6-6 5-6-4-4 1-2 7h-8l-1-7-4-2-6 3-5-6 4-6-1-4-7-2v-8l7-1 2-4-3-6 6-5 6 4 4-1Z" transform="translate(1 -1) scale(.97)"/><circle cx="30" cy="30" r="21" fill="#383B42"/><circle cx="30" cy="30" r="16.5" fill="#D5D7DC"/><circle cx="30" cy="30" r="12" fill="#484B53"/><circle cx="30" cy="30" r="8" fill="#B4B7BF"/></g><g stroke="#A1A4AC" stroke-width="2"><path d="M30 11V15M30 45V49M11 30H15M45 30H49M17 17 20 20M40 40 43 43M17 43 20 40M40 20 43 17"/></g>'),
  wallet: svg('<rect width="60" height="60" rx="14" fill="#151519"/><rect x="9" y="10" width="42" height="34" rx="4" fill="#DCECF1"/><path d="M9 20H51V30H9Z" fill="#8DC0D9"/><rect x="9" y="24" width="42" height="23" rx="4" fill="#F9B637"/><rect x="9" y="31" width="42" height="17" rx="4" fill="#57A98D"/><path d="M9 38H51V46Q51 50 47 50H13Q9 50 9 46Z" fill="#42444B"/><path d="M23 39H37" stroke="#737780" stroke-width="2.5" stroke-linecap="round"/>'),
  phone: svg('<rect width="60" height="60" rx="14" fill="url(#ios-green)"/><path d="M17 10C13 10 9 17 11 25 15 39 25 49 38 51 44 52 51 46 50 42L42 35C40 33 38 35 35 38 29 36 23 30 21 24 24 21 26 19 24 17L19 10Z" fill="white"/>'),
  safari: svg('<rect width="60" height="60" rx="14" fill="white"/><circle cx="30" cy="30" r="25" fill="url(#ios-blue)"/><circle cx="30" cy="30" r="22" stroke="white" stroke-width="2" stroke-dasharray=".7 3.1"/><path d="m41 17-7 18-15 8 7-18Z" fill="white"/><path d="m41 17-7 18-8-10Z" fill="#F4485F"/><path d="m19 43 7-18 8 10Z" fill="#F9FCFF"/>'),
  messages: svg('<rect width="60" height="60" rx="14" fill="url(#ios-green)"/><path d="M51 28C51 17 41 10 30 10S9 17 9 28C9 35 13 40 20 44L17 51 29 46H30C42 46 51 39 51 28Z" fill="white"/>'),
  music: svg('<rect width="60" height="60" rx="14" fill="url(#ios-music)"/><path d="M25 16V42C25 47 14 50 13 44 12 39 21 37 22 39V19Q22 17 25 16L44 12Q47 11 47 14V36C47 42 36 45 35 39 34 34 43 32 44 34V21L25 25" fill="white"/>'),
};

// Shared decorative system icons; a prefix keeps multiple phone previews isolated.
const scopedIconMarkup = (markup, prefix) => markup.replaceAll('url(#ios-', `url(#${prefix}-ios-`);

export function renderIOSIconDefinitions(prefix = 'home') {
  return `<svg class="ios-svg-library" width="0" height="0" aria-hidden="true"><defs>
    <linearGradient id="${prefix}-ios-green" x2="0" y2="1"><stop stop-color="#61F275"/><stop offset="1" stop-color="#13BA3F"/></linearGradient>
    <linearGradient id="${prefix}-ios-blue" x2="0" y2="1"><stop stop-color="#28BDFA"/><stop offset="1" stop-color="#126BEF"/></linearGradient>
    <linearGradient id="${prefix}-ios-gray" x2="0" y2="1"><stop stop-color="#EAEBF0"/><stop offset="1" stop-color="#B8BCC4"/></linearGradient>
    <linearGradient id="${prefix}-ios-weather" x2="0" y2="1"><stop stop-color="#1459B7"/><stop offset="1" stop-color="#3BA2F4"/></linearGradient>
    <linearGradient id="${prefix}-ios-yellow" x2="0" y2="1"><stop stop-color="#FFE478"/><stop offset="1" stop-color="#FDD844"/></linearGradient>
    <linearGradient id="${prefix}-ios-music" x2="0" y2="1"><stop stop-color="#FA6279"/><stop offset="1" stop-color="#F52D54"/></linearGradient>
  </defs></svg>`;
}

export function renderIOSAppGrid(prefix = 'home') {
  return `<div class="ios-app-grid" aria-hidden="true">${[
    ['FaceTime', 'facetime'], ['日历', 'calendar'], ['照片', 'photos'], ['相机', 'camera'],
    ['邮件', 'mail'], ['时钟', 'clock'], ['地图', 'maps'], ['天气', 'weather'],
    ['备忘录', 'notes'], ['App Store', 'appstore'], ['设置', 'settings'], ['钱包', 'wallet'],
  ].map(([name, key]) => icon(name, scopedIconMarkup(icons[key], prefix))).join('')}</div>`;
}

export function renderIOSDock(prefix = 'home') {
  return `<div class="ios-dock" aria-hidden="true">${[
    ['电话', 'phone'], ['Safari', 'safari'], ['信息', 'messages'], ['音乐', 'music'],
  ].map(([name, key]) => icon(name, scopedIconMarkup(icons[key], prefix))).join('')}</div>`;
}

export function renderIOSHome() {
  return `<div class="phone-screen ios-screen">
    <svg class="ios-svg-library" width="0" height="0" aria-hidden="true"><defs>
      <linearGradient id="ios-green" x2="0" y2="1"><stop stop-color="#61F275"/><stop offset="1" stop-color="#13BA3F"/></linearGradient>
      <linearGradient id="ios-blue" x2="0" y2="1"><stop stop-color="#28BDFA"/><stop offset="1" stop-color="#126BEF"/></linearGradient>
      <linearGradient id="ios-gray" x2="0" y2="1"><stop stop-color="#EAEBF0"/><stop offset="1" stop-color="#B8BCC4"/></linearGradient>
      <linearGradient id="ios-weather" x2="0" y2="1"><stop stop-color="#1459B7"/><stop offset="1" stop-color="#3BA2F4"/></linearGradient>
      <linearGradient id="ios-yellow" x2="0" y2="1"><stop stop-color="#FFE478"/><stop offset="1" stop-color="#FDD844"/></linearGradient>
      <linearGradient id="ios-music" x2="0" y2="1"><stop stop-color="#FA6279"/><stop offset="1" stop-color="#F52D54"/></linearGradient>
    </defs></svg>
    <div class="ios-wallpaper" aria-hidden="true"><img src="./assets/widget-misty-lake-v1.jpg" alt="" width="853" height="1844" decoding="async" fetchpriority="high"></div>
    <div class="ios-status"><span id="statusClock">9:41</span><div class="ios-status-right" aria-hidden="true"><svg class="ios-cellular" viewBox="0 0 18 13"><rect x="0" y="8" width="3" height="5" rx=".8"/><rect x="5" y="5.5" width="3" height="7.5" rx=".8"/><rect x="10" y="3" width="3" height="10" rx=".8"/><rect x="15" width="3" height="13" rx=".8"/></svg><svg class="ios-wifi" viewBox="0 0 17 13"><path d="M1 4.5a11 11 0 0 1 15 0M3.7 7.3a7 7 0 0 1 9.6 0M6.4 10a3.2 3.2 0 0 1 4.2 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="8.5" cy="12" r="1"/></svg><svg class="ios-battery" viewBox="0 0 29 14"><rect x=".7" y=".7" width="24" height="12.6" rx="3.3" fill="none" stroke="currentColor" stroke-opacity=".55" stroke-width="1.2"/><rect x="2.6" y="2.6" width="20.2" height="8.8" rx="1.6"/><path d="M26.5 4.5V9.5Q29.5 9 29.5 7T26.5 4.5" fill-opacity=".55"/></svg></div></div>
    <div class="ios-island" aria-hidden="true"><i></i></div>
    <div id="desktopDate" hidden></div><div id="desktopClock" hidden></div>
    <div class="ios-home-content"><div class="widget-slot"><button type="button" id="companionWidget" class="companion-widget" aria-describedby="widgetHint"></button><span class="widget-app-label">腾讯视频</span></div>
      <div class="ios-app-grid" aria-hidden="true">
        ${icon('FaceTime', icons.facetime)}${icon('日历', icons.calendar)}${icon('照片', icons.photos)}${icon('相机', icons.camera)}
        ${icon('邮件', icons.mail)}${icon('时钟', icons.clock)}${icon('地图', icons.maps)}${icon('天气', icons.weather)}
        ${icon('备忘录', icons.notes)}${icon('App Store', icons.appstore)}${icon('设置', icons.settings)}${icon('钱包', icons.wallet)}
      </div>
    </div>
    <div class="ios-search" aria-hidden="true"><svg viewBox="0 0 12 12"><circle cx="5" cy="5" r="3.3"/><path d="m7.5 7.5 3 3"/></svg><span>搜索</span></div>
    <div class="ios-dock" aria-hidden="true">${icon('电话', icons.phone)}${icon('Safari', icons.safari)}${icon('信息', icons.messages)}${icon('音乐', icons.music)}</div>
    <div class="ios-home-indicator" aria-hidden="true"></div>
  </div>`;
}
