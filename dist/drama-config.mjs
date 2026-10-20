// Demo editorial data only — not the actual release schedule of this drama.
// Reuse the calendar by replacing this config and supplying the account's tier.
const releases = (entries, time = '18:00') => entries.map(([date, from, to, milestone]) => ({date, time, from, to, milestone}));

export const drama = {
  id: 'changan-lychee',
  title: '长安的荔枝',
  totalEpisodes: 30,
  video: './assets/drama-recording.mp4',
  accent: '#009c91',
  timeZone: 'Asia/Shanghai',
  tiers: {svip: 'SVIP', vip: 'VIP', free: '非会员'},
  editorialTheme: {
    image: './assets/calendar-art.png',
    tint: '#f7f0e3',
    entryTitle: '一颗荔枝，一路相伴',
    entryCaption: '看更新安排，不错过精彩时刻',
  },
  // Small editorial hints follow the episode, not a fixed VIP calendar date.
  // These are atmosphere examples, not claims about the actual plot.
  calendarHighlights: [
    {id:'companions', episode:14, icon:'🤝', title:'同路相伴'},
    {id:'letter', episode:22, icon:'💌', title:'一纸心意'},
    {id:'homeward', episode:24, icon:'🏡', title:'心有所归'},
  ],
  // Special-event access is independent of regular membership releases.
  // The demo displays event information only; it never grants playback access.
  screeningEvents: [{
    id:'changan-screening', title:'点映礼',
    date:'2026-10-24', time:'18:00', endTime:'20:00', from:27, to:30,
    accessNote:'需另行获取点映礼资格，普通会员不自动包含。',
  }],
  scheduleByTier: {
    vip: releases([
      ['2026-10-10', 1, 2, 'premiere'], ['2026-10-11', 3, 4],
      ['2026-10-12', 5, 6], ['2026-10-13', 7, 8],
      ['2026-10-14', 9, 10], ['2026-10-15', 11, 12],
      ['2026-10-16', 13, 14], ['2026-10-17', 15, 16],
      ['2026-10-18', 17, 18], ['2026-10-20', 19, 20],
      ['2026-10-21', 21, 22], ['2026-10-22', 23, 24],
      ['2026-10-24', 25, 26], ['2026-10-25', 27, 28],
      ['2026-10-27', 29, 30, 'finale'],
    ]),
    svip: releases([
      ['2026-10-10', 1, 4, 'premiere'], ['2026-10-11', 5, 6],
      ['2026-10-12', 7, 8], ['2026-10-13', 9, 10],
      ['2026-10-14', 11, 12], ['2026-10-15', 13, 14],
      ['2026-10-16', 15, 16], ['2026-10-17', 17, 18],
      ['2026-10-19', 19, 20], ['2026-10-20', 21, 22],
      ['2026-10-21', 23, 24],
      ['2026-10-23', 25, 26], ['2026-10-24', 27, 28],
      ['2026-10-26', 29, 30, 'finale'],
    ]),
    free: releases([
      ['2026-10-10', 1, 2, 'premiere'], ['2026-10-11', 3, 3],
      ['2026-10-12', 4, 4], ['2026-10-13', 5, 5],
      ['2026-10-14', 6, 6], ['2026-10-15', 7, 7],
      ['2026-10-17', 8, 8], ['2026-10-18', 9, 9],
      ['2026-10-19', 10, 10], ['2026-10-20', 11, 11],
      ['2026-10-21', 12, 12], ['2026-10-22', 13, 13],
      ['2026-10-24', 14, 14], ['2026-10-25', 15, 15],
      ['2026-10-26', 16, 16], ['2026-10-27', 17, 17],
      ['2026-10-28', 18, 18], ['2026-10-29', 19, 19],
      ['2026-10-31', 20, 20], ['2026-11-01', 21, 21],
      ['2026-11-02', 22, 22], ['2026-11-03', 23, 23],
      ['2026-11-04', 24, 24], ['2026-11-05', 25, 25],
      ['2026-11-07', 26, 26], ['2026-11-08', 27, 27],
      ['2026-11-09', 28, 28], ['2026-11-10', 29, 29],
      ['2026-11-11', 30, 30, 'finale'],
    ]),
  },
  badges: [
    {episode:10, name:'荔枝初程', glyph:'荔', icon:'lychee', story:'一颗荔枝的旅程，因为你的陪伴而开始。'},
    {episode:18, name:'千里同路', glyph:'驿', icon:'journey', story:'山水迢迢，谢谢你陪他走过这一程。'},
    {episode:30, name:'长安赴约', glyph:'安', icon:'city', story:'荔枝抵达长安，你也见证了故事的终章。'},
  ],
};

// Fixed demo clock keeps presentation stable. Production supplies server time
// and authenticated entitlement; the UI must not infer access from local storage.
export const demoScenarios = {
  skipped: {label:'跳着看 · 10、13日已看，11日漏看',completed:[1,2,7,8],focusDate:'2026-10-11'},
  missed: {label:'14日未看 · 起始已看8集',completed:[1,2,3,4,5,6,7,8],focusDate:'2026-10-14'},
  partial: {label:'14日看了一集 · 起始已看9集',completed:[1,2,3,4,5,6,7,8,9],focusDate:'2026-10-14'},
  'caught-up': {label:'14日已看完 · 起始已看10集',completed:[1,2,3,4,5,6,7,8,9,10],focusDate:'2026-10-14'},
};
export const demoSession = {tier: 'vip', now: '2026-10-15T19:00:00+08:00', scenario:'skipped'};
