const DAY_MS = 86_400_000;
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1_000;
const DEFAULT_NOW = '2026-10-29T19:30:00+08:00';

export const COMPANION_SCENARIOS = Object.freeze([
  Object.freeze({id: 'resume', label: '白天等你'}),
  Object.freeze({id: 'evening', label: '今晚还没看'}),
  Object.freeze({id: 'away', label: '三天没来'}),
  Object.freeze({id: 'returned', label: '今天回来了'}),
  Object.freeze({id: 'caught-up', label: '已经追平'}),
  Object.freeze({id: 'empty', label: '暂无历史'}),
  Object.freeze({id: 'logged-out', label: '尚未登录'}),
  Object.freeze({id: 'unavailable', label: '内容不可播'}),
]);

export const SCENARIO_IDS = Object.freeze(COMPANION_SCENARIOS.map(item => item.id));

function timestamp(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).getTime();
  return typeof value === 'string' && value.trim() ? Date.parse(value) : NaN;
}

function localDay(time) {
  return Math.floor((time + BEIJING_OFFSET_MS) / DAY_MS);
}

function validContent(item) {
  return item && typeof item.id === 'string' && item.id.trim()
    && typeof item.title === 'string' && item.title.trim()
    && Number.isSafeInteger(item.totalEpisodes) && item.totalEpisodes > 0
    && Number.isSafeInteger(item.availableEpisodes) && item.availableEpisodes >= 0
    && item.availableEpisodes <= item.totalEpisodes;
}

function compareRecords(a, b) {
  return b.time - a.time
    || (a.contentId < b.contentId ? -1 : a.contentId > b.contentId ? 1 : 0)
    || b.episode - a.episode
    || b.progressSeconds - a.progressSeconds
    || b.durationSeconds - a.durationSeconds;
}

function validRecords(history, now, catalog) {
  return (Array.isArray(history) ? history : []).flatMap(item => {
    if (!item || typeof item.contentId !== 'string' || !item.contentId.trim()
      || !Number.isSafeInteger(item.episode) || item.episode < 1
      || typeof item.progressSeconds !== 'number' || !Number.isFinite(item.progressSeconds) || item.progressSeconds <= 0
      || typeof item.durationSeconds !== 'number' || !Number.isFinite(item.durationSeconds) || item.durationSeconds <= 0) return [];
    const time = timestamp(item.lastWatchedAt);
    const content = catalog.get(item.contentId);
    if (!Number.isFinite(time) || time > now || (content && item.episode > content.totalEpisodes)) return [];
    return [{
      contentId: item.contentId,
      episode: item.episode,
      progressSeconds: Math.min(item.progressSeconds, item.durationSeconds),
      durationSeconds: item.durationSeconds,
      lastWatchedAt: new Date(time).toISOString(),
      time,
    }];
  }).sort(compareRecords);
}

function resumeTarget(content, records) {
  const latest = records[0];
  if (!content || content.playable === false || content.availableEpisodes < 1) return null;
  // Keep the latest real record per episode, including deliberate rewatches.
  const episodeRecords = new Map();
  for (const record of records) {
    if (!episodeRecords.has(record.episode)) episodeRecords.set(record.episode, record);
  }
  let episode = latest.episode;
  while (episode <= content.availableEpisodes) {
    const record = episodeRecords.get(episode);
    if (!record || record.progressSeconds < record.durationSeconds) {
      const defaultDuration = typeof content.episodeDurationSeconds === 'number'
        && Number.isFinite(content.episodeDurationSeconds) && content.episodeDurationSeconds > 0
        ? content.episodeDurationSeconds : 2_400;
      return {
        kind: 'resume', contentId: content.id, title: content.title, episode,
        progressSeconds: record?.progressSeconds || 0,
        durationSeconds: record?.durationSeconds || defaultDuration,
        lastWatchedAt: latest.lastWatchedAt,
      };
    }
    episode += 1;
  }
  return null;
}

/**
 * Select from real, cross-title watch history without modifying it.
 * Content availability is supplied by the host, never inferred from a click.
 * Day boundaries and evening (18:00+) follow Asia/Shanghai.
 */
export function selectCompanion({now, loggedIn, history = [], contents = []} = {}) {
  const base = {
    status: 'empty', mood: 'welcome', daysAway: null, watchedToday: false,
    reason: 'no_history', target: null, latest: null, skippedUnavailable: false,
  };
  if (!loggedIn) return {...base, status: 'logged-out', reason: 'login_required'};
  const current = timestamp(now);
  if (!Number.isFinite(current)) return {...base, status: 'unavailable', reason: 'invalid_clock'};
  const catalog = new Map();
  for (const item of Array.isArray(contents) ? contents : []) {
    if (validContent(item) && !catalog.has(item.id)) catalog.set(item.id, item);
  }
  const records = validRecords(history, current, catalog);
  if (!records.length) return base;

  const latestRecord = records[0];
  const today = localDay(current);
  const daysAway = today - localDay(latestRecord.time);
  const watchedToday = daysAway === 0;
  const latestContent = catalog.get(latestRecord.contentId);
  const latest = {
    contentId: latestRecord.contentId, title: latestContent?.title || '内容暂不可用',
    episode: latestRecord.episode, lastWatchedAt: latestRecord.lastWatchedAt,
  };
  const result = {...base, daysAway, watchedToday, latest};

  const byContent = new Map();
  for (const record of records) {
    if (!byContent.has(record.contentId)) byContent.set(record.contentId, []);
    byContent.get(record.contentId).push(record);
  }
  let target = null;
  let skippedUnavailable = false;
  let hasAvailableHistory = false;
  for (const [contentId, contentRecords] of byContent) {
    const content = catalog.get(contentId);
    if (!content || content.playable === false || content.availableEpisodes < 1
      || contentRecords[0].episode > content.availableEpisodes) {
      skippedUnavailable = true;
      continue;
    }
    hasAvailableHistory = true;
    target = resumeTarget(content, contentRecords);
    if (target) break;
  }

  if (!target) return {
    ...result, status: hasAvailableHistory ? 'caught-up' : 'unavailable', mood: hasAvailableHistory ? 'resting' : 'welcome',
    reason: hasAvailableHistory ? 'caught_up' : 'no_playable_history', skippedUnavailable,
  };

  const previousDayRecord = records.find(record => localDay(record.time) < today);
  const returned = watchedToday && previousDayRecord && today - localDay(previousDayRecord.time) >= 3;
  const evening = new Date(current + BEIJING_OFFSET_MS).getUTCHours() >= 18;
  const mood = watchedToday ? 'returned'
    : daysAway >= 3 ? 'waiting' : evening ? 'evening' : 'ready';
  const reason = returned ? 'returned_after_break' : watchedToday ? 'watched_today'
    : daysAway >= 3 ? 'away_for_days' : evening ? 'evening_reminder' : 'resume_latest';
  return {...result, status: 'resume', mood, reason, target, skippedUnavailable};
}

function dayAt(current, daysBefore, hour = 20) {
  return new Date(localDay(current) * DAY_MS - BEIJING_OFFSET_MS - daysBefore * DAY_MS + hour * 3_600_000).toISOString();
}

/** Deterministic fixtures only: these never read or write the existing calendar. */
export function createCompanionScenario(id = 'resume', now) {
  const resolvedId = SCENARIO_IDS.includes(id) ? id : 'resume';
  const defaultNow = resolvedId === 'resume' ? '2026-10-29T10:30:00+08:00'
    : resolvedId === 'evening' ? '2026-10-29T21:30:00+08:00' : DEFAULT_NOW;
  const resolvedNow = now === undefined ? defaultNow : now;
  const current = timestamp(resolvedNow);
  if (!Number.isFinite(current)) throw new RangeError('A scenario requires a valid clock.');
  const contents = [
    {id: 'south-wind', title: '南风来信', totalEpisodes: 24, availableEpisodes: 12, playable: true, episodeDurationSeconds: 2_400},
    {id: 'star-shop', title: '星河便利店', totalEpisodes: 16, availableEpisodes: 8, playable: true, episodeDurationSeconds: 1_800},
    {id: 'sunny-stop', title: '下一站晴天', totalEpisodes: 12, availableEpisodes: 12, playable: true, episodeDurationSeconds: 2_700},
  ];
  const record = (contentId, episode, progressSeconds, durationSeconds, lastWatchedAt) => ({contentId, episode, progressSeconds, durationSeconds, lastWatchedAt});
  let history = [
    record('south-wind', 8, 812, 2_400, dayAt(current, 1, 21)),
    record('star-shop', 3, 325, 1_800, dayAt(current, 2)),
    record('sunny-stop', 12, 2_700, 2_700, dayAt(current, 5)),
  ];
  if (resolvedId === 'away') history = [
    record('south-wind', 8, 812, 2_400, dayAt(current, 3)),
    record('star-shop', 3, 325, 1_800, dayAt(current, 5)),
  ];
  if (resolvedId === 'returned') history = [
    record('south-wind', 8, 1_080, 2_400, new Date(current).toISOString()),
    record('star-shop', 3, 325, 1_800, dayAt(current, 4)),
  ];
  if (resolvedId === 'caught-up') history = [
    record('south-wind', 12, 2_400, 2_400, dayAt(current, 1)),
    record('star-shop', 8, 1_800, 1_800, dayAt(current, 2)),
    record('sunny-stop', 12, 2_700, 2_700, dayAt(current, 3)),
  ];
  if (resolvedId === 'empty' || resolvedId === 'logged-out') history = [];
  if (resolvedId === 'unavailable') for (const content of contents) content.playable = false;
  return {
    id: resolvedId, label: COMPANION_SCENARIOS.find(item => item.id === resolvedId).label,
    now: resolvedNow, loggedIn: resolvedId !== 'logged-out', history, contents,
  };
}
