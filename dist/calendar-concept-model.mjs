import {drama as demoDrama, demoScenarios, demoSession} from './drama-config.mjs';
import {dateKey, parseDate, monthCells, getReleaseViewingState, releaseTime} from './calendar-model.mjs';
import {getTierContext} from './tier-model.mjs';
import {getTicketProgress} from './ticket-model.mjs';
import {getDateOperations} from './operations-model.mjs';

const knownTier = value => typeof value === 'string' && ['free', 'vip', 'svip'].includes(value);
const resolveTier = value => knownTier(value) ? value : 'vip';
const validMonth = value => typeof value === 'string' && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(value);

function resolveNow(value) {
  if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') return demoSession.now;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : demoSession.now;
}

function viewingHistory(value, totalEpisodes) {
  const history = value instanceof Set || Array.isArray(value) ? [...value] : [];
  return new Set(history.filter(episode => Number.isSafeInteger(episode) && episode >= 1 && episode <= totalEpisodes));
}

// These independent in-memory sessions belong to local concept previews only.
// Selecting another schedule never changes account identity or playback scope.
export function createCalendarConceptSession({scenario = 'partial', tier = 'vip', now = demoSession.now} = {}) {
  const accountTier = resolveTier(tier);
  const clock = resolveNow(now);
  const selectedScenario = typeof scenario === 'string' && Object.hasOwn(demoScenarios, scenario) ? demoScenarios[scenario] : demoScenarios.partial;
  const today = getTierContext(demoDrama, accountTier, accountTier, clock).account.today;
  return {
    accountTier,
    previewTier: accountTier,
    now: clock,
    completed: viewingHistory(selectedScenario.completed, demoDrama.totalEpisodes),
    month: today.slice(0, 7),
    selectedDate: today,
    reminded: false,
  };
}

function calendarHint(release, watching, operations, outside) {
  if (outside || !release) return '';
  if (watching.status === 'watched') return '已看';
  if (watching.status === 'partial') {
    const total = release.to - release.from + 1;
    return `已看${total - watching.pendingEpisodes.length}/${total}`;
  }
  if (watching.status === 'unwatched') return '待看';
  if (watching.status !== 'upcoming') return '';
  if (operations.events.some(event => event.status !== 'ended')) return '点映礼';
  if (release.milestone === 'premiere') return '开播';
  if (release.milestone === 'finale') return '完结';
  return operations.highlights[0]?.icon || '';
}

export function selectCalendarConcept(drama, session = {}) {
  const now = resolveNow(session.now);
  const accountTier = resolveTier(session.accountTier);
  const previewTier = knownTier(session.previewTier) ? session.previewTier : accountTier;
  const context = getTierContext(drama, accountTier, previewTier, now);
  const today = context.account.today;
  const month = validMonth(session.month) ? session.month : today.slice(0, 7);
  const totalEpisodes = Number.isSafeInteger(drama.totalEpisodes) && drama.totalEpisodes > 0 ? drama.totalEpisodes : 30;
  const completed = viewingHistory(session.completed, totalEpisodes);
  const first = parseDate(`${month}-01`);
  const offset = (first.getUTCDay() + 6) % 7;
  // Even a four-week February uses five rows, keeping phone layouts stable.
  const rows = Math.max(5, monthCells(month).length / 7);
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - offset);
  const summary = context.preview;
  const cells = Array.from({length: rows * 7}, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    const key = dateKey(date);
    const outside = key.slice(0, 7) !== month;
    const release = summary.releases.find(item => item.date === key) || null;
    const watching = getReleaseViewingState(release, completed, now);
    const ops = getDateOperations(drama, {tier: summary.tier, date: key, now});
    return {date: key, day: date.getUTCDate(), outside, release, watching, ops, hint: calendarHint(release, watching, ops, outside)};
  });
  const available = new Set();
  const time = new Date(now).getTime();
  for (const release of context.account.releases) {
    const availableAt = releaseTime(release);
    if (!Number.isFinite(availableAt) || availableAt > time || !Number.isSafeInteger(release.from) || !Number.isSafeInteger(release.to)) continue;
    for (let episode = Math.max(1, release.from); episode <= Math.min(totalEpisodes, release.to); episode += 1) available.add(episode);
  }
  const availableEpisodes = [...available].sort((a, b) => a - b);
  return {
    context,
    summary,
    today,
    month,
    rows,
    cells,
    ticket: getTicketProgress(completed),
    availableEpisodes,
    nextEpisode: availableEpisodes.find(episode => !completed.has(episode)) ?? null,
    completedCount: completed.size,
  };
}
