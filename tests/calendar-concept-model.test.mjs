import test from 'node:test';
import assert from 'node:assert/strict';
import {drama, demoScenarios, demoSession} from '../dist/drama-config.mjs';
import {createCalendarConceptSession, selectCalendarConcept} from '../dist/calendar-concept-model.mjs';

const cell = (projection, date) => projection.cells.find(item => item.date === date);

test('concept sessions default to partial VIP history and never share their Set', () => {
  const first = createCalendarConceptSession();
  const second = createCalendarConceptSession();
  assert.equal(first.accountTier, 'vip');
  assert.equal(first.previewTier, 'vip');
  assert.equal(first.month, '2026-10');
  assert.equal(first.selectedDate, '2026-10-15');
  assert.equal(first.reminded, false);
  assert.deepEqual([...first.completed], demoScenarios.partial.completed);
  first.completed.add(10);
  assert.equal(second.completed.has(10), false);
  assert.equal(demoScenarios.partial.completed.includes(10), false);
});

test('partial batches keep their dates and episode range while showing precise watched count', () => {
  const projection = selectCalendarConcept(drama, createCalendarConceptSession());
  const partial = cell(projection, '2026-10-14');
  assert.deepEqual([partial.release.from, partial.release.to], [9, 10]);
  assert.equal(partial.watching.status, 'partial');
  assert.equal(partial.hint, '已看1/2');
  assert.equal(cell(projection, '2026-10-13').hint, '已看');
  assert.equal(cell(projection, '2026-10-15').hint, '待看');
  assert.equal(projection.completedCount, 9);
  assert.equal(projection.nextEpisode, 10);
  assert.equal(projection.ticket.next.episode, 10);
});

test('SVIP schedule previews do not expand VIP playback or erase viewing history', () => {
  const session = createCalendarConceptSession();
  session.previewTier = 'svip';
  const projection = selectCalendarConcept(drama, session);
  assert.equal(projection.summary, projection.context.preview);
  assert.equal(projection.summary.available, 14);
  assert.equal(projection.context.account.available, 12);
  assert.equal(projection.context.requiresUpgrade, true);
  assert.deepEqual(projection.availableEpisodes, Array.from({length: 12}, (_, i) => i + 1));
  assert.equal(projection.nextEpisode, 10);
  assert.equal(cell(projection, '2026-10-13').hint, '已看1/2');
  assert.equal(projection.completedCount, 9);
});

test('available episodes follow actual account tier for free, VIP and SVIP', () => {
  for (const [tier, count] of [['free', 7], ['vip', 12], ['svip', 14]]) {
    const session = createCalendarConceptSession({tier});
    session.previewTier = tier === 'svip' ? 'free' : 'svip';
    const projection = selectCalendarConcept(drama, session);
    assert.equal(projection.context.account.tier, tier);
    assert.equal(projection.availableEpisodes.length, count);
    assert.equal(projection.nextEpisode, count < 10 ? null : 10);
  }
});

test('month cells include actual adjoining dates, with at least five and at most six rows', () => {
  const session = createCalendarConceptSession();
  for (const [month, rows, first, last] of [
    ['2026-10', 5, '2026-09-28', '2026-11-01'],
    ['2026-11', 6, '2026-10-26', '2026-12-06'],
    ['2027-02', 5, '2027-02-01', '2027-03-07'],
    ['2027-01', 5, '2026-12-28', '2027-01-31'],
    ['2026-12', 5, '2026-11-30', '2027-01-03'],
  ]) {
    const projection = selectCalendarConcept(drama, {...session, month});
    assert.equal(projection.rows, rows);
    assert.equal(projection.cells.length, rows * 7);
    assert.equal(projection.cells[0].date, first);
    assert.equal(projection.cells.at(-1).date, last);
    assert.ok(projection.cells.every(item => item && Number.isInteger(item.day)));
    assert.ok(projection.cells.filter(item => item.outside).every(item => item.hint === ''));
  }
});

test('invalid months, identities, scenarios and clocks fall back to safe demo values', () => {
  for (const tier of ['VIP', '__proto__', 'constructor', null, {}, Symbol('svip')]) {
    const session = createCalendarConceptSession({tier, scenario: '__proto__', now: 'invalid'});
    assert.equal(session.accountTier, 'vip');
    assert.deepEqual([...session.completed], demoScenarios.partial.completed);
    assert.equal(new Date(session.now).getTime(), new Date(demoSession.now).getTime());
  }
  const session = createCalendarConceptSession();
  for (const month of ['2026-00', '2026-13', '2026-1', '2026-10-01', undefined, null, {}, Symbol('month')]) {
    assert.equal(selectCalendarConcept(drama, {...session, month}).month, '2026-10');
  }
});

test('upcoming hints prioritize screenings, premiere, finale and then highlights', () => {
  const projection = selectCalendarConcept(drama, createCalendarConceptSession({now: '2026-10-01T00:00:00+08:00'}));
  assert.equal(cell(projection, '2026-10-10').hint, '开播');
  assert.equal(cell(projection, '2026-10-16').hint, '🤝');
  assert.equal(cell(projection, '2026-10-24').hint, '点映礼');
  assert.equal(cell(projection, '2026-10-27').hint, '完结');
  assert.equal(cell(projection, '2026-10-23').hint, '');
  const watched = selectCalendarConcept(drama, createCalendarConceptSession());
  assert.equal(cell(watched, '2026-10-10').hint, '已看');
});

test('screenings remain metadata and do not grant special-event episode access', () => {
  const session = createCalendarConceptSession({now: '2026-10-24T19:00:00+08:00'});
  const projection = selectCalendarConcept(drama, session);
  const screening = cell(projection, '2026-10-24');
  assert.equal(screening.ops.events[0].status, 'live');
  assert.equal(projection.availableEpisodes.at(-1), 26);
  assert.equal(projection.availableEpisodes.includes(27), false);
  assert.equal(projection.context.account.finale.date, '2026-10-27');
});

test('exact release boundaries and gaps determine playback rather than a maximum episode number', () => {
  const session = createCalendarConceptSession({now: '2026-10-15T17:59:59+08:00'});
  assert.equal(selectCalendarConcept(drama, session).availableEpisodes.at(-1), 10);
  session.now = '2026-10-15T18:00:00+08:00';
  assert.equal(selectCalendarConcept(drama, session).availableEpisodes.at(-1), 12);
  const configured = {...drama, scheduleByTier: {...drama.scheduleByTier, vip: drama.scheduleByTier.vip.filter(release => release.from !== 9)}};
  const projection = selectCalendarConcept(configured, session);
  assert.equal(projection.availableEpisodes.includes(10), false);
  assert.equal(projection.nextEpisode, 11);
});

test('repeated viewing stays deduplicated, invalid episodes are ignored and no inputs are mutated', () => {
  const session = createCalendarConceptSession();
  session.completed.add(9).add(9).add(0).add(31).add('10');
  const history = [...session.completed];
  const before = structuredClone(drama);
  const first = selectCalendarConcept(drama, session);
  const second = selectCalendarConcept(drama, session);
  assert.equal(first.completedCount, 9);
  assert.equal(second.completedCount, 9);
  assert.deepEqual([...session.completed], history);
  assert.deepEqual(drama, before);
});
