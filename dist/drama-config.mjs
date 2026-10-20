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
      ['2026-10-13', 1, 6, 'premiere'], ['2026-10-14', 7, 8],
      ['2026-10-15', 9, 10], ['2026-10-16', 11, 12],
      ['2026-10-17', 13, 14], ['2026-10-18', 15, 16],
      ['2026-10-20', 17, 18], ['2026-10-21', 19, 20],
      ['2026-10-22', 21, 22], ['2026-10-23', 23, 24],
      ['2026-10-24', 25, 26], ['2026-10-25', 27, 28],
      ['2026-10-27', 29, 30, 'finale'],
    ]),
    svip: releases([
      ['2026-10-12', 1, 6, 'premiere'], ['2026-10-13', 7, 8],
      ['2026-10-14', 9, 10], ['2026-10-15', 11, 12],
      ['2026-10-16', 13, 14], ['2026-10-17', 15, 16],
      ['2026-10-19', 17, 18], ['2026-10-20', 19, 20],
      ['2026-10-21', 21, 22], ['2026-10-22', 23, 24],
      ['2026-10-23', 25, 26], ['2026-10-24', 27, 28],
      ['2026-10-26', 29, 30, 'finale'],
    ]),
    free: releases([
      ['2026-10-13', 1, 2, 'premiere'], ['2026-10-14', 3, 3],
      ['2026-10-15', 4, 4], ['2026-10-16', 5, 5],
      ['2026-10-17', 6, 6], ['2026-10-18', 7, 7],
      ['2026-10-20', 8, 8], ['2026-10-21', 9, 9],
      ['2026-10-22', 10, 10], ['2026-10-23', 11, 11],
      ['2026-10-24', 12, 12], ['2026-10-25', 13, 13],
      ['2026-10-27', 14, 14], ['2026-10-28', 15, 15],
      ['2026-10-29', 16, 16], ['2026-10-30', 17, 17],
      ['2026-10-31', 18, 18], ['2026-11-01', 19, 19],
      ['2026-11-03', 20, 20], ['2026-11-04', 21, 21],
      ['2026-11-05', 22, 22], ['2026-11-06', 23, 23],
      ['2026-11-07', 24, 24], ['2026-11-08', 25, 25],
      ['2026-11-10', 26, 26], ['2026-11-11', 27, 27],
      ['2026-11-12', 28, 28], ['2026-11-13', 29, 29],
      ['2026-11-14', 30, 30, 'finale'],
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
export const demoSession = {tier: 'vip', now: '2026-10-15T19:00:00+08:00', watched: 8};
