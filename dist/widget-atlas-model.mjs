/**
 * Fictional, local presentation studies. These are not account or playback data.
 * A playback position describes the current episode, never a watched-episode count.
 * Time metrics use natural viewing days (not a streak), today's minutes, or days
 * since the last viewing. Skipped days do not reset the accumulated day count.
 */

function freezeStudies(studies) {
  for (const study of studies) {
    Object.freeze(study.lines);
    if (study.metric) Object.freeze(study.metric);
    Object.freeze(study);
  }
  return Object.freeze(studies);
}

export const progressStudies = freezeStudies([
  {
    id: 'progress-ready',
    mood: 'ready',
    eyebrow: '普通续看',
    title: '南风来信',
    lines: ['人是走了，', '进度还在这。'],
    context: '第8集 · 已看13:32',
  },
  {
    id: 'progress-evening',
    mood: 'evening',
    eyebrow: '晚间等待',
    title: '雾港慢车',
    lines: ['手机都打开了，', '顺便看看我呗。'],
    context: '第3集 · 已看06:18',
  },
  {
    id: 'progress-waiting',
    mood: 'waiting',
    eyebrow: '久未观看',
    title: '长街微光',
    lines: ['你再不来，', '我要长蘑菇了。'],
    context: '第12集 · 已看24:06',
  },
  {
    id: 'progress-returned',
    mood: 'returned',
    eyebrow: '回来之后',
    title: '海边旧事',
    lines: ['行，来过就行。', '今天不闹你。'],
    context: '第5集 · 已看09:40',
  },
  {
    id: 'progress-resting',
    mood: 'resting',
    eyebrow: '已经追平',
    title: '云上散步',
    lines: ['这部已追平，', '我也躺会儿。'],
    context: '已看完24/24集',
  },
]);

const timeCatalog = Object.freeze({
  days: freezeStudies([
    {
      id: 'time-days-1', mood: 'ready', eyebrow: '初次见面',
      lines: ['初次见面，', '先混个眼熟。'],
      context: '累计观看1天 · 按自然日累计',
      metric: {value: 1, unit: '天', label: '一起看过的日子'},
    },
    {
      id: 'time-days-7', mood: 'evening', eyebrow: '渐渐熟络',
      lines: ['来都来了，', '坐我旁边呗。'],
      context: '累计观看7天 · 按自然日累计',
      metric: {value: 7, unit: '天', label: '一起看过的日子'},
    },
    {
      id: 'time-days-30', mood: 'waiting', eyebrow: '有点默契',
      lines: ['你忙你的，', '位置给你留着。'],
      context: '累计观看30天 · 按自然日累计',
      metric: {value: 30, unit: '天', label: '一起看过的日子'},
    },
    {
      id: 'time-days-100', mood: 'returned', eyebrow: '百日熟脸',
      lines: ['都这么熟了，', '还用我招呼？'],
      context: '累计观看100天 · 按自然日累计',
      metric: {value: 100, unit: '天', label: '一起看过的日子'},
    },
    {
      id: 'time-days-365', mood: 'resting', eyebrow: '老友席位',
      lines: ['不是我黏人，', '是咱俩太熟。'],
      context: '累计观看365天 · 按自然日累计',
      metric: {value: 365, unit: '天', label: '一起看过的日子'},
    },
  ]),
  minutes: freezeStudies([
    {
      id: 'time-minutes-0', mood: 'ready', eyebrow: '今日未播放',
      lines: ['今天零分钟', '我先眨个眼'],
      context: '今日累计观看0分钟',
      metric: {value: 0, unit: '分钟', label: '今日累计观看'},
    },
    {
      id: 'time-minutes-15', mood: 'evening', eyebrow: '轻松看会',
      lines: ['十五分钟啦', '我先混个眼熟'],
      context: '今日累计观看15分钟',
      metric: {value: 15, unit: '分钟', label: '今日累计观看'},
    },
    {
      id: 'time-minutes-35', mood: 'waiting', eyebrow: '小憩也好',
      lines: ['三十五分钟', '歇会也挺好'],
      context: '今日累计观看35分钟',
      metric: {value: 35, unit: '分钟', label: '今日累计观看'},
    },
    {
      id: 'time-minutes-60', mood: 'returned', eyebrow: '该歇一会',
      lines: ['看满一小时', '眨眨眼歇会'],
      context: '今日累计观看60分钟',
      metric: {value: 60, unit: '分钟', label: '今日累计观看'},
    },
    {
      id: 'time-minutes-120', mood: 'resting', eyebrow: '休息优先',
      lines: ['已经两小时', '该给眼睛放假'],
      context: '今日累计观看120分钟',
      metric: {value: 120, unit: '分钟', label: '今日累计观看'},
    },
  ]),
  away: freezeStudies([
    {
      id: 'time-away-0', mood: 'ready', eyebrow: '今天见过',
      lines: ['今天才见过', '又来打个照面'],
      context: '上次观看：今天',
      metric: {value: 0, unit: '天', label: '距上次观看'},
    },
    {
      id: 'time-away-1', mood: 'evening', eyebrow: '隔天再会',
      lines: ['昨天见过面', '今天也有空啊'],
      context: '距上次观看1天',
      metric: {value: 1, unit: '天', label: '距上次观看'},
    },
    {
      id: 'time-away-3', mood: 'waiting', eyebrow: '几日未见',
      lines: ['三天没碰面', '眼神还认得吧'],
      context: '距上次观看3天',
      metric: {value: 3, unit: '天', label: '距上次观看'},
    },
    {
      id: 'time-away-7', mood: 'returned', eyebrow: '一周再会',
      lines: ['一周没碰面', '熟人请随意坐'],
      context: '距上次观看7天',
      metric: {value: 7, unit: '天', label: '距上次观看'},
    },
    {
      id: 'time-away-30', mood: 'resting', eyebrow: '久别再会',
      lines: ['三十天没见', '我还认得你呀'],
      context: '距上次观看30天',
      metric: {value: 30, unit: '天', label: '距上次观看'},
    },
  ]),
});

/** Return independent study cards. Unknown input safely uses accumulated days. */
export function timeStudies(metric = 'days') {
  const key = metric === 'minutes' || metric === 'away' ? metric : 'days';
  return timeCatalog[key].map(study => ({
    ...study,
    lines: [...study.lines],
    metric: {...study.metric},
  }));
}
