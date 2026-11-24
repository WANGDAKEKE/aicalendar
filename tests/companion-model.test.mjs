import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPANION_SCENARIOS, SCENARIO_IDS, createCompanionScenario, selectCompanion} from '../dist/companion-model.mjs';

const makeContent = (id, overrides = {}) => ({id, title: `剧集 ${id}`, totalEpisodes: 12, availableEpisodes: 8, playable: true, episodeDurationSeconds: 2_400, ...overrides});
const makeRecord = (contentId, overrides = {}) => ({contentId, episode: 3, progressSeconds: 600, durationSeconds: 2_400, lastWatchedAt: '2026-10-28T21:00:00+08:00', ...overrides});
const select = (overrides = {}) => selectCompanion({now: '2026-10-29T10:30:00+08:00', loggedIn: true, contents: [makeContent('a'), makeContent('b')], history: [makeRecord('a')], ...overrides});

test('recommendation follows the latest real cross-title history rather than catalog order', () => {
  const history = [makeRecord('a'), makeRecord('b', {episode: 6, progressSeconds: 900, lastWatchedAt: '2026-10-28T22:00:00+08:00'})];
  const output = select({history});
  assert.equal(output.target.contentId, 'b');
  assert.equal(output.target.episode, 6);
  assert.equal(output.target.progressSeconds, 900);
  assert.equal(output.mood, 'ready');
  assert.equal(output.daysAway, 1);
  assert.equal(output.watchedToday, false);
});

test('completed episodes advance to the next available episode without replaying a completed finale', () => {
  const output = select({history: [makeRecord('a', {progressSeconds: 2_400})]});
  assert.equal(output.target.episode, 4);
  assert.equal(output.target.progressSeconds, 0);
  assert.equal(output.target.durationSeconds, 2_400);
  const finale = select({contents: [makeContent('a', {totalEpisodes: 8})], history: [makeRecord('a', {episode: 8, progressSeconds: 2_400})]});
  assert.equal(finale.status, 'caught-up');
  assert.equal(finale.target, null);
  assert.equal(finale.mood, 'resting');
});

test('finishing the latest title can fall back to a different unfinished title', () => {
  const output = select({history: [makeRecord('a', {episode: 8, progressSeconds: 2_400}), makeRecord('b', {lastWatchedAt: '2026-10-27T21:00:00+08:00'})]});
  assert.equal(output.latest.contentId, 'a');
  assert.equal(output.target.contentId, 'b');
  assert.equal(output.skippedUnavailable, false);
});

test('unplayable, missing and no-longer-available titles are skipped for an older playable target', () => {
  for (const contents of [
    [makeContent('a', {playable: false}), makeContent('b')],
    [makeContent('b')],
    [makeContent('a', {availableEpisodes: 2}), makeContent('b')],
  ]) {
    const output = select({contents, history: [makeRecord('a'), makeRecord('b', {lastWatchedAt: '2026-10-27T21:00:00+08:00'})]});
    assert.equal(output.target.contentId, 'b');
    assert.equal(output.skippedUnavailable, true);
  }
  const output = select({contents: [makeContent('a', {playable: false})]});
  assert.equal(output.status, 'unavailable');
  assert.equal(output.target, null);
});

test('same-timestamp ties are deterministic even when input history is reordered', () => {
  const history = [makeRecord('b'), makeRecord('a'), makeRecord('a', {episode: 4})];
  const forward = select({history});
  const reversed = select({history: [...history].reverse()});
  assert.deepEqual(forward, reversed);
  assert.equal(forward.target.contentId, 'a');
  assert.equal(forward.target.episode, 4);
});

test('watching at 00:01 uses Beijing calendar days, not rolling 24-hour periods', () => {
  const output = select({now: '2026-10-29T00:01:00+08:00', history: [makeRecord('a', {lastWatchedAt: '2026-10-28T23:59:00+08:00'})]});
  assert.equal(output.daysAway, 1);
  assert.equal(output.watchedToday, false);
  assert.equal(output.mood, 'ready');
  const today = select({now: '2026-10-29T00:01:00+08:00', history: [makeRecord('a', {lastWatchedAt: '2026-10-28T16:00:00Z'})]});
  assert.equal(today.daysAway, 0);
  assert.equal(today.watchedToday, true);
});

test('evening reminders begin at 18:00 and real viewing today stops the reminder', () => {
  assert.equal(select({now: '2026-10-29T17:59:59+08:00'}).mood, 'ready');
  assert.equal(select({now: '2026-10-29T18:00:00+08:00'}).mood, 'evening');
  const watched = select({now: '2026-10-29T21:00:00+08:00', history: [makeRecord('a', {lastWatchedAt: '2026-10-29T18:00:00+08:00'})]});
  assert.equal(watched.mood, 'returned');
  assert.equal(watched.watchedToday, true);
});

test('three absent calendar days lead to waiting; returning after the break is welcoming', () => {
  const away = select({history: [makeRecord('a', {lastWatchedAt: '2026-10-26T23:59:00+08:00'})]});
  assert.equal(away.daysAway, 3);
  assert.equal(away.mood, 'waiting');
  const returned = select({history: [makeRecord('a', {lastWatchedAt: '2026-10-29T10:00:00+08:00'}), makeRecord('b', {lastWatchedAt: '2026-10-25T21:00:00+08:00'})]});
  assert.equal(returned.mood, 'returned');
  assert.equal(returned.watchedToday, true);
  const regular = select({history: [makeRecord('a', {lastWatchedAt: '2026-10-29T10:00:00+08:00'}), makeRecord('b'), makeRecord('b', {lastWatchedAt: '2026-10-20T21:00:00+08:00'})]});
  assert.equal(regular.mood, 'returned');
});

test('zero-progress clicks, future records and malformed history cannot manufacture watching', () => {
  const invalid = [
    makeRecord('a', {progressSeconds: 0}), makeRecord('a', {progressSeconds: NaN}),
    makeRecord('a', {durationSeconds: 0}), makeRecord('a', {episode: 0}),
    makeRecord('a', {episode: 20}), makeRecord('a', {episode: '3'}),
    makeRecord('a', {lastWatchedAt: '2026-10-30T10:00:00+08:00'}),
    makeRecord('a', {lastWatchedAt: 'not a date'}), null,
  ];
  const output = select({history: invalid});
  assert.equal(output.status, 'empty');
  assert.equal(output.watchedToday, false);
  assert.equal(output.daysAway, null);
  assert.equal(output.target, null);
});

test('logged-out output cannot reveal history and invalid clocks provide no playback target', () => {
  const loggedOut = select({loggedIn: false});
  assert.equal(loggedOut.status, 'logged-out');
  assert.equal(loggedOut.latest, null);
  assert.equal(loggedOut.target, null);
  const badClock = select({now: 'not a date'});
  assert.equal(badClock.reason, 'invalid_clock');
  assert.equal(badClock.target, null);
});

test('selection and scenario switches do not mutate histories or the old calendar', () => {
  const input = createCompanionScenario('resume');
  const snapshot = structuredClone(input);
  const first = selectCompanion(input);
  selectCompanion(createCompanionScenario('away'));
  assert.deepEqual(input, snapshot);
  assert.deepEqual(selectCompanion(input), first);
  const second = createCompanionScenario('resume');
  second.history[0].progressSeconds += 100;
  assert.deepEqual(input, snapshot);
});

test('scenario fixtures cover the independent demo states and respect an explicit clock', () => {
  const expected = {
    resume: ['resume', 'ready'], evening: ['resume', 'evening'], away: ['resume', 'waiting'],
    returned: ['resume', 'returned'], 'caught-up': ['caught-up', 'resting'],
    empty: ['empty', 'welcome'], 'logged-out': ['logged-out', 'welcome'], unavailable: ['unavailable', 'welcome'],
  };
  assert.deepEqual(COMPANION_SCENARIOS.map(item => item.id), SCENARIO_IDS);
  for (const id of SCENARIO_IDS) {
    const input = createCompanionScenario(id);
    const output = selectCompanion(input);
    assert.deepEqual([output.status, output.mood], expected[id]);
    assert.equal(input.contents.length, 3);
  }
  const explicit = createCompanionScenario('evening', '2026-11-08T10:00:00+08:00');
  assert.equal(explicit.now, '2026-11-08T10:00:00+08:00');
  assert.equal(selectCompanion(explicit).mood, 'ready');
});
