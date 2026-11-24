/**
 * Local, fictional long-video resume studies. No account, calendar or playback
 * state is read or written here. `valid` and `completed` are supplied by the host;
 * this module does not invent an effective-playback or completion threshold.
 */
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const OFFSET_MS = 8 * HOUR_MS;
const DEFAULT_NOW = '2026-11-02T10:30:00+08:00';

export const RESUME_POLICY = Object.freeze({
  status: 'proposal',
  timeZone: 'Asia/Shanghai',
  utcOffsetHours: 8,
  awayFromDays: 3,
  gentleAwayFromDays: 7,
  eveningStartHour: 18,
  eveningEndHour: 22,
  quietEndHour: 8,
  copyRotation: 'one-per-local-day',
  effectivePlayback: 'host-valid-flag',
  completion: 'host-completed-flag',
});

export const LONG_VIDEO_TYPES = Object.freeze(['drama', 'variety', 'movie', 'anime', 'documentary']);
const TYPE_LABELS = Object.freeze({drama: '电视剧', variety: '综艺', movie: '电影', anime: '动漫', documentary: '纪录片'});

export const RESUME_SCENARIOS = Object.freeze([
  {id: 'drama', label: '电视剧 · 普通续看'},
  {id: 'switch-variety', label: '今天改看综艺'},
  {id: 'movie', label: '电影 · 中途续看'},
  {id: 'anime', label: '动漫 · 中途续看'},
  {id: 'documentary', label: '纪录片 · 中途续看'},
  {id: 'next-unit', label: '上一集已完 · 下一集待观看'},
  {id: 'day-1', label: '1天未看 · 普通续看'},
  {id: 'day-2', label: '2天未看 · 普通续看'},
  {id: 'evening', label: '晚间等待'},
  {id: 'late-night', label: '22:30 · 久未观看不催促'},
  {id: 'day-3', label: '3天未看 · 久未观看'},
  {id: 'day-6', label: '6天未看 · 久未观看'},
  {id: 'day-7', label: '7天未看 · 温和等待'},
  {id: 'day-8', label: '8天未看 · 温和等待'},
  {id: 'today', label: '今天已看'},
  {id: 'caught-up', label: '暂无待续看'},
  {id: 'empty', label: '暂无观看历史'},
  {id: 'logged-out', label: '尚未登录'},
  {id: 'unavailable', label: '内容暂不可播'},
].map(item => Object.freeze(item)));

const STATE_LABELS = Object.freeze({
  ready: '普通续看', evening: '晚间等待', away: '久未观看', 'long-away': '温和等待',
  returned: '今天已看', resting: '暂无待续看', empty: '暂无历史',
  'logged-out': '尚未登录', unavailable: '暂不可播',
});

const COPY_POOLS = Object.freeze(Object.fromEntries(Object.entries({
  ready: [
    ['人是走了，', '进度还在这。'],
    ['你忙你的，', '我替你记着。'],
    ['随时回来，', '从这里接着看。'],
    ['暂停一下，', '不影响再见。'],
  ],
  evening: [
    ['今晚有空？', '给你留了位置。'],
    ['白天辛苦了，', '有空坐一会儿。'],
    ['你的进度，', '还在原地等你。'],
    ['想放松一下？', '咱们接着看。'],
  ],
  away: [
    ['你再不来，', '我要长蘑菇了。'],
    ['这位观众，', '还记得我吗？'],
    ['我先躺会儿，', '你来了叫我。'],
    ['好几天没见，', '进度没走远。'],
  ],
  'long-away': [
    ['有空再来，', '位置给你留着。'],
    ['不用着急，', '进度替你记着。'],
    ['忙完再见，', '我一直都在。'],
    ['想看的时候，', '再一起接着看。'],
  ],
  quiet: [
    ['夜深啦，', '进度替你留着。'],
    ['先好好休息，', '有空再接着看。'],
    ['今晚不催啦，', '改天再一起看。'],
  ],
  returned: [
    ['行，来过就行。', '今天不闹你。'],
    ['今天见过啦，', '有空再接着看。'],
    ['进度往前了，', '我也开心了。'],
    ['刚刚看过，', '先歇一会儿吧。'],
  ],
  resting: [
    ['暂时没待续，', '我也歇一会儿。'],
    ['进度先放好，', '下次再一起看。'],
    ['这会儿不催，', '有新故事再见。'],
  ],
  empty: [
    ['初次见面，', '先混个眼熟。'],
    ['想看些什么？', '我帮你记进度。'],
    ['挑个喜欢的，', '下次从这继续。'],
  ],
  'logged-out': [
    ['先认个门，', '登录后接着看。'],
    ['登录见个面，', '进度就能跟上。'],
    ['你的老位置，', '登录后留给你。'],
  ],
  unavailable: [
    ['这会儿播不了，', '先歇一会儿吧。'],
    ['进度先留着，', '稍后再来看看。'],
    ['暂时停一停，', '恢复后再接着看。'],
  ],
}).map(([state, pool]) => [state, Object.freeze(pool.map(lines => Object.freeze(lines)))])));

function timestamp(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).getTime();
  return typeof value === 'string' && value.trim() ? Date.parse(value) : NaN;
}

function localDay(time) { return Math.floor((time + OFFSET_MS) / DAY_MS); }
function nonempty(value) { return typeof value === 'string' && Boolean(value.trim()); }
function positive(value) { return typeof value === 'number' && Number.isFinite(value) && value > 0; }
function hash(value) {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619) >>> 0;
  return result;
}

export function formatPlaybackTime(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '00:00';
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor(whole / 60) % 60;
  const remaining = whole % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

/** Unit labels come from the catalog (e.g. 第3期（上）), not guessed from a number. */
export function formatResumeProgress(content, unit, seconds) {
  const position = `已看${formatPlaybackTime(seconds)}`;
  return content?.type === 'movie' || !nonempty(unit?.label) ? position : `${unit.label} · ${position}`;
}

function normalizeCatalog(input) {
  const catalog = new Map();
  for (const item of Array.isArray(input) ? input : []) {
    if (!item || !nonempty(item.id) || !nonempty(item.title) || !LONG_VIDEO_TYPES.includes(item.type) || catalog.has(item.id)) continue;
    const units = [];
    const ids = new Set();
    for (const unit of Array.isArray(item.units) ? item.units : []) {
      if (!unit || !nonempty(unit.id) || ids.has(unit.id) || !positive(unit.durationSeconds)) continue;
      if (item.type !== 'movie' && !nonempty(unit.label)) continue;
      ids.add(unit.id);
      units.push({...unit, label: item.type === 'movie' ? '' : unit.label});
    }
    catalog.set(item.id, {...item, units});
  }
  return catalog;
}

function normalizeRecords(input, now, catalog) {
  return (Array.isArray(input) ? input : []).flatMap(item => {
    if (!item || item.valid !== true || item.kind !== 'full-length'
      || !nonempty(item.contentId) || !nonempty(item.unitId)
      || typeof item.progressSeconds !== 'number' || !Number.isFinite(item.progressSeconds) || item.progressSeconds < 0
      || (item.type !== undefined && !LONG_VIDEO_TYPES.includes(item.type))) return [];
    const time = timestamp(item.lastWatchedAt);
    if (!Number.isFinite(time) || time > now) return [];
    const content = catalog.get(item.contentId);
    const unit = content?.units.find(candidate => candidate.id === item.unitId);
    const durationSeconds = positive(item.durationSeconds) ? item.durationSeconds : unit?.durationSeconds;
    if (!positive(durationSeconds)) return [];
    return [{
      contentId: item.contentId, unitId: item.unitId,
      type: content?.type || item.type || null,
      progressSeconds: Math.min(item.progressSeconds, durationSeconds), durationSeconds,
      completed: item.completed === true, time, lastWatchedAt: new Date(time).toISOString(),
    }];
  }).sort((a, b) => b.time - a.time
    || a.contentId.localeCompare(b.contentId, 'en')
    || a.unitId.localeCompare(b.unitId, 'en')
    || Number(b.completed) - Number(a.completed)
    || b.progressSeconds - a.progressSeconds
    || b.durationSeconds - a.durationSeconds);
}

function targetFor(content, records) {
  if (!content || content.playable === false) return {unavailable: true};
  const latest = records[0];
  const start = content.units.findIndex(unit => unit.id === latest.unitId);
  if (start < 0 || content.units[start].playable === false) return {unavailable: true};
  const unitRecords = new Map();
  for (const record of records) if (!unitRecords.has(record.unitId)) unitRecords.set(record.unitId, record);
  for (let index = start; index < content.units.length; index += 1) {
    const unit = content.units[index];
    if (unit.playable === false) return {unavailable: true};
    const record = unitRecords.get(unit.id);
    if (record?.completed) continue;
    const seconds = record?.progressSeconds || 0;
    return {target: {
      content: {id: content.id, title: content.title, type: content.type, typeLabel: TYPE_LABELS[content.type]},
      progress: {
        unitId: unit.id, unitLabel: unit.label, positionSeconds: seconds,
        durationSeconds: record?.durationSeconds || unit.durationSeconds,
        positionLabel: formatPlaybackTime(seconds),
        label: record ? formatResumeProgress(content, unit, seconds) : `${unit.label} · 待观看`,
        lastWatchedAt: latest.lastWatchedAt, isNextUnit: !record,
      },
    }};
  }
  return {complete: true};
}

function attachCopy(result, now, userId) {
  const day = Number.isFinite(now) ? localDay(now) : 0;
  const hour = Number.isFinite(now) ? new Date(now + OFFSET_MS).getUTCHours() : null;
  const quietHours = hour !== null && (hour >= RESUME_POLICY.eveningEndHour || hour < RESUME_POLICY.quietEndHour);
  const poolKey = quietHours && ['away', 'long-away', 'evening'].includes(result.state) ? 'quiet' : result.state;
  const pool = COPY_POOLS[poolKey];
  const seed = `${userId}|${result.content?.id || 'none'}|${result.progress?.unitId || 'none'}|${result.state}`;
  const index = ((day + hash(seed)) % pool.length + pool.length) % pool.length;
  const date = Number.isFinite(now) ? new Date(day * DAY_MS).toISOString().slice(0, 10) : null;
  return {
    ...result,
    id: result.id || `resume-${result.state}-${result.content?.id || 'none'}`,
    eyebrow: STATE_LABELS[result.state], title: result.content?.title || result.title,
    lines: [...pool[index]], context: result.progress?.label || result.context,
    copy: {pool: poolKey, index, date, quietHours, rotation: RESUME_POLICY.copyRotation},
  };
}

/**
 * One view model for both widget sizes. Content selection scans recent eligible
 * titles; emotion uses the latest valid long-video record across ALL titles.
 * The 3/7-day split, +8 natural days and 18–22 window are reviewable proposals.
 */
export function selectResumeStudy({id, now = DEFAULT_NOW, loggedIn = true, userId = 'local-demo', records = [], catalog = []} = {}) {
  const current = timestamp(now);
  const base = {
    id, status: 'empty', state: 'empty', mood: 'welcome', ruleReason: 'no_valid_history',
    title: '你的下一段故事', context: '观看后同步续看进度', content: null, progress: null,
    history: {validRecordCount: 0, ignoredRecordCount: 0, latestWatchedAt: null, latestContentId: null, latestContentType: null, daysAway: null, watchedToday: false, skippedUnavailable: false},
  };
  const withCopy = result => attachCopy(result, current, typeof userId === 'string' ? userId : 'local-demo');
  if (!loggedIn) return withCopy({...base, status: 'logged-out', state: 'logged-out', ruleReason: 'login_required', title: '登录后，接着看', context: '登录后同步观看进度'});
  if (!Number.isFinite(current)) return withCopy({...base, status: 'unavailable', state: 'unavailable', ruleReason: 'invalid_clock', title: '暂时无法同步', context: '稍后再来看看'});
  const contents = normalizeCatalog(catalog);
  const history = normalizeRecords(records, current, contents);
  if (!history.length) return withCopy({...base, history: {...base.history, ignoredRecordCount: Array.isArray(records) ? records.length : 0}});

  const latest = history[0];
  const daysAway = localDay(current) - localDay(latest.time);
  const summary = {
    validRecordCount: history.length, ignoredRecordCount: (Array.isArray(records) ? records.length : 0) - history.length,
    latestWatchedAt: latest.lastWatchedAt, latestContentId: latest.contentId,
    latestContentType: latest.type, daysAway, watchedToday: daysAway === 0, skippedUnavailable: false,
  };
  const byContent = new Map();
  for (const record of history) {
    if (!byContent.has(record.contentId)) byContent.set(record.contentId, []);
    byContent.get(record.contentId).push(record);
  }
  let target = null;
  let latestComplete = null;
  for (const [contentId, contentRecords] of byContent) {
    const content = contents.get(contentId);
    const candidate = targetFor(content, contentRecords);
    if (candidate.unavailable) summary.skippedUnavailable = true;
    if (candidate.complete && !latestComplete) latestComplete = content;
    if (candidate.target) { target = candidate.target; break; }
  }
  if (!target) {
    if (latestComplete) return withCopy({
      ...base, status: 'caught-up', state: 'resting', mood: 'resting', ruleReason: 'no_pending_resume', history: summary,
      content: {id: latestComplete.id, title: latestComplete.title, type: latestComplete.type, typeLabel: TYPE_LABELS[latestComplete.type]},
      context: '暂无待续看内容',
    });
    return withCopy({...base, status: 'unavailable', state: 'unavailable', ruleReason: 'no_playable_history', history: summary, title: '内容暂不可播', context: '稍后再来看看'});
  }
  const hour = new Date(current + OFFSET_MS).getUTCHours();
  const state = daysAway === 0 ? 'returned'
    : daysAway >= RESUME_POLICY.gentleAwayFromDays ? 'long-away'
      : daysAway >= RESUME_POLICY.awayFromDays ? 'away'
        : hour >= RESUME_POLICY.eveningStartHour && hour < RESUME_POLICY.eveningEndHour ? 'evening' : 'ready';
  const ruleReason = {
    returned: 'watched_today', 'long-away': 'away_seven_days_or_more', away: 'away_three_to_six_days',
    evening: 'recent_resume_evening_window', ready: 'recent_resume_outside_evening',
  }[state];
  return withCopy({...base, ...target, status: 'resume', state, mood: state === 'away' || state === 'long-away' ? 'waiting' : state, ruleReason, history: summary});
}

function dayAt(current, daysBefore, hour = 20) {
  return new Date(localDay(current) * DAY_MS - OFFSET_MS - daysBefore * DAY_MS + hour * HOUR_MS).toISOString();
}

/** Reusable fixtures; dates, records and catalog are returned as independent data. */
export function createResumeScenario(id = 'drama', now) {
  const scenario = RESUME_SCENARIOS.find(item => item.id === id) || RESUME_SCENARIOS[0];
  const resolvedNow = now ?? (scenario.id === 'evening' ? '2026-11-02T19:30:00+08:00'
    : scenario.id === 'late-night' ? '2026-11-02T22:30:00+08:00' : DEFAULT_NOW);
  const current = timestamp(resolvedNow);
  if (!Number.isFinite(current)) throw new RangeError('A resume scenario requires a valid clock.');
  const makeEpisodes = (count, durationSeconds, suffix = '集') => Array.from({length: count}, (_, i) => ({id: String(i + 1), label: `第${i + 1}${suffix}`, durationSeconds, playable: true}));
  const catalog = [
    {id: 'south-wind', title: '南风来信', type: 'drama', playable: true, units: makeEpisodes(12, 2400)},
    {id: 'weekend', title: '周末请就位', type: 'variety', playable: true, units: [
      {id: '3-upper', label: '第3期（上）', durationSeconds: 5400, playable: true},
      {id: '3-lower', label: '第3期（下）', durationSeconds: 4800, playable: true},
    ]},
    {id: 'cloud', title: '云上散步', type: 'movie', playable: true, units: [{id: 'feature', label: '', durationSeconds: 7440, playable: true}]},
    {id: 'star-shop', title: '星河便利店', type: 'anime', playable: true, units: makeEpisodes(8, 1440)},
    {id: 'coast', title: '海边旧事', type: 'documentary', playable: true, units: makeEpisodes(5, 3000)},
  ];
  const record = (contentId, unitId, progressSeconds, daysBefore = 1, completed = false) => {
    const content = catalog.find(item => item.id === contentId);
    const unit = content.units.find(item => item.id === unitId);
    return {contentId, unitId, type: content.type, progressSeconds, durationSeconds: unit.durationSeconds, valid: true, kind: 'full-length', completed, lastWatchedAt: daysBefore === 0 ? new Date(current - 18 * 60_000).toISOString() : dayAt(current, daysBefore)};
  };
  let records = [record('south-wind', '8', 812), record('star-shop', '3', 325, 2)];
  if (scenario.id.startsWith('day-')) {
    const days = Number(scenario.id.slice(4));
    records = [record('south-wind', '8', 812, days)];
  }
  if (scenario.id === 'switch-variety') records = [record('weekend', '3-upper', 1390, 0), record('south-wind', '8', 812, 2)];
  if (scenario.id === 'movie') records = [record('cloud', 'feature', 2538), record('south-wind', '8', 812, 2)];
  if (scenario.id === 'anime') records = [record('star-shop', '3', 325), record('south-wind', '8', 812, 2)];
  if (scenario.id === 'documentary') records = [record('coast', '2', 580), record('south-wind', '8', 812, 2)];
  if (scenario.id === 'next-unit') records = [record('south-wind', '8', 2400, 1, true)];
  if (scenario.id === 'late-night') records = [record('south-wind', '8', 812, 3)];
  if (scenario.id === 'today') records = [record('south-wind', '8', 1080, 0), record('coast', '2', 580, 4)];
  if (scenario.id === 'caught-up') records = [record('cloud', 'feature', 7440, 8, true), record('south-wind', '12', 2400, 9, true)];
  if (scenario.id === 'empty' || scenario.id === 'logged-out') records = [];
  if (scenario.id === 'unavailable') for (const content of catalog) content.playable = false;
  return {id: scenario.id, label: scenario.label, now: resolvedNow, loggedIn: scenario.id !== 'logged-out', userId: 'local-demo', records, catalog};
}

function copyScenario(input) {
  return {
    ...input,
    records: (Array.isArray(input.records) ? input.records : []).map(record => ({...record})),
    catalog: (Array.isArray(input.catalog) ? input.catalog : []).map(content => ({...content, units: (Array.isArray(content.units) ? content.units : []).map(unit => ({...unit}))})),
  };
}

/** Explicit demonstration control only: advancing the clock does not add a watch. */
export function advanceResumeDay(input, days = 1) {
  const current = timestamp(input?.now);
  if (!Number.isFinite(current) || !Number.isSafeInteger(days) || days < 1) throw new RangeError('Advance requires a valid clock and positive whole days.');
  return {...copyScenario(input), now: new Date(current + days * DAY_MS).toISOString()};
}

/**
 * Explicit demonstration control only, never called when rendering or opening a
 * widget. Appends a simulated player event with trusted validity/completion flags.
 */
export function simulateResumeWatch(input, seconds = 300) {
  if (!positive(seconds)) throw new RangeError('A simulated watch requires positive finite seconds.');
  const output = copyScenario(input);
  const study = selectResumeStudy(input);
  if (study.status !== 'resume' || !study.content || !study.progress) return output;
  const progressSeconds = Math.min(study.progress.positionSeconds + seconds, study.progress.durationSeconds);
  output.records.push({
    contentId: study.content.id, unitId: study.progress.unitId, type: study.content.type,
    kind: 'full-length', valid: true, progressSeconds, durationSeconds: study.progress.durationSeconds,
    completed: progressSeconds === study.progress.durationSeconds,
    lastWatchedAt: new Date(timestamp(input.now)).toISOString(),
  });
  return output;
}
