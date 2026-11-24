import test from 'node:test';
import assert from 'node:assert/strict';
import {RESUME_POLICY, RESUME_SCENARIOS, LONG_VIDEO_TYPES, createResumeScenario, selectResumeStudy, formatPlaybackTime, formatResumeProgress, advanceResumeDay, simulateResumeWatch} from '../dist/widget-resume-model.mjs';

const makeInput = (id = 'drama') => createResumeScenario(id);
const select = id => selectResumeStudy(makeInput(id));
const shiftDate = (value, days) => new Date(Date.parse(value) + days * 86_400_000).toISOString();

test('reviewable policy exports natural days, both absence boundaries, and bounded evening hours', () => {
  assert.equal(RESUME_POLICY.status, 'proposal');
  assert.equal(RESUME_POLICY.timeZone, 'Asia/Shanghai');
  assert.equal(RESUME_POLICY.utcOffsetHours, 8);
  assert.equal(RESUME_POLICY.awayFromDays, 3);
  assert.equal(RESUME_POLICY.gentleAwayFromDays, 7);
  assert.equal(RESUME_POLICY.eveningStartHour, 18);
  assert.equal(RESUME_POLICY.eveningEndHour, 22);
  assert.equal(RESUME_POLICY.quietEndHour, 8);
  assert.deepEqual(LONG_VIDEO_TYPES, ['drama', 'variety', 'movie', 'anime', 'documentary']);
});

test('one study provides title, identical progress fields and formatted time for either widget size', () => {
  const study = select('drama');
  assert.equal(study.title, '南风来信');
  assert.equal(study.context, '第8集 · 已看13:32');
  assert.equal(study.progress.unitLabel, '第8集');
  assert.equal(study.progress.positionSeconds, 812);
  assert.equal(study.progress.positionLabel, '13:32');
  assert.equal(study.content.type, 'drama');
  assert.equal(study.mood, 'ready');
  assert.equal(study.lines.length, 2);
});

test('the newest valid long-video watch can replace drama with variety on the same day', () => {
  const study = select('switch-variety');
  assert.equal(study.title, '周末请就位');
  assert.equal(study.content.type, 'variety');
  assert.equal(study.context, '第3期（上） · 已看23:10');
  assert.equal(study.state, 'returned');
  assert.equal(study.history.latestContentId, 'weekend');
});

test('movies do not invent an episode; durations longer than an hour retain hours', () => {
  assert.equal(select('movie').context, '已看42:18');
  assert.equal(formatPlaybackTime(3600), '1:00:00');
  assert.equal(formatPlaybackTime(4218.9), '1:10:18');
  assert.equal(formatPlaybackTime(59), '00:59');
  assert.equal(formatPlaybackTime(-1), '00:00');
  assert.equal(formatPlaybackTime(Infinity), '00:00');
  assert.equal(formatResumeProgress({type: 'movie'}, {label: '第1集'}, 4218), '已看1:10:18');
});

test('anime and documentaries use their real unit labels and resume positions', () => {
  for (const [id, expectedType, expectedLabel] of [['star-shop', 'anime', '第3集'], ['coast', 'documentary', '第2集']]) {
    const input = makeInput();
    const content = input.catalog.find(item => item.id === id);
    const unit = content.units.find(item => item.label === expectedLabel);
    input.records = [{...input.records[0], contentId: id, unitId: unit.id, type: expectedType, durationSeconds: unit.durationSeconds}];
    const study = selectResumeStudy(input);
    assert.equal(study.content.type, expectedType);
    assert.equal(study.context, `${expectedLabel} · 已看13:32`);
  }
});

test('optional fixtures expose anime, documentary, a pending next unit and gentle late-night copy', () => {
  const anime = select('anime');
  assert.equal(anime.content.type, 'anime');
  assert.equal(anime.title, '星河便利店');
  assert.equal(anime.context, '第3集 · 已看05:25');
  const documentary = select('documentary');
  assert.equal(documentary.content.type, 'documentary');
  assert.equal(documentary.title, '海边旧事');
  assert.equal(documentary.context, '第2集 · 已看09:40');
  const next = select('next-unit');
  assert.equal(next.context, '第9集 · 待观看');
  assert.equal(next.progress.positionSeconds, 0);
  const night = select('late-night');
  assert.equal(makeInput('late-night').now, '2026-11-02T22:30:00+08:00');
  assert.equal(night.history.daysAway, 3);
  assert.equal(night.state, 'away');
  assert.equal(night.copy.quietHours, true);
  assert.equal(night.copy.pool, 'quiet');
  assert.doesNotMatch(night.lines.join(''), /蘑菇|还记得/);
});

test('1/2 days remain ordinary; 3/6 days are absent; 7/8 days use a gentle pool', () => {
  for (const [days, state, mood] of [[1, 'ready', 'ready'], [2, 'ready', 'ready'], [3, 'away', 'waiting'], [6, 'away', 'waiting'], [7, 'long-away', 'waiting'], [8, 'long-away', 'waiting']]) {
    const study = select(`day-${days}`);
    assert.equal(study.history.daysAway, days);
    assert.equal(study.state, state);
    assert.equal(study.mood, mood);
    assert.equal(study.copy.pool, state);
  }
});

test('evening starts at 18:00, ends at 22:00, and loses priority to today or long absence', () => {
  const input = makeInput('day-1');
  for (const [time, state] of [['17:59:59', 'ready'], ['18:00:00', 'evening'], ['21:59:59', 'evening'], ['22:00:00', 'ready'], ['23:59:59', 'ready']]) {
    assert.equal(selectResumeStudy({...input, now: `2026-11-02T${time}+08:00`}).state, state);
  }
  assert.equal(select('evening').state, 'evening');
  assert.equal(selectResumeStudy({...makeInput('day-3'), now: '2026-11-02T19:00:00+08:00'}).state, 'away');
  assert.equal(selectResumeStudy({...makeInput('today'), now: '2026-11-02T19:00:00+08:00'}).state, 'returned');
});

test('natural-day boundaries use +8 days rather than elapsed 24-hour windows', () => {
  const input = makeInput();
  input.now = '2026-11-02T00:01:00+08:00';
  input.records = [{...input.records[0], lastWatchedAt: '2026-11-01T23:59:00+08:00'}];
  assert.equal(selectResumeStudy(input).history.daysAway, 1);
  input.records[0].lastWatchedAt = '2026-11-01T16:00:00Z';
  assert.equal(selectResumeStudy(input).state, 'returned');
});

test('at 22:00 absent states remain unchanged but their copy becomes gentle', () => {
  for (const id of ['day-3', 'day-7']) {
    const input = makeInput(id);
    const before = selectResumeStudy({...input, now: '2026-11-02T21:59:59+08:00'});
    const after = selectResumeStudy({...input, now: '2026-11-02T22:00:00+08:00'});
    assert.equal(after.state, before.state);
    assert.equal(before.copy.quietHours, false);
    assert.equal(after.copy.quietHours, true);
    assert.equal(after.copy.pool, 'quiet');
    assert.match(after.lines.join(''), /休息|不催|夜深/);
    assert.doesNotMatch(after.lines.join(''), /蘑菇|还记得/);
  }
});

test('proposed quiet hours continue after midnight and end exactly at 08:00', () => {
  const input = makeInput('day-3');
  for (const time of ['00:00:00', '03:00:00', '07:59:59']) {
    const study = selectResumeStudy({...input, now: `2026-11-02T${time}+08:00`});
    assert.equal(study.state, 'away');
    assert.equal(study.copy.quietHours, true);
    assert.equal(study.copy.pool, 'quiet');
  }
  const morning = selectResumeStudy({...input, now: '2026-11-02T08:00:00+08:00'});
  assert.equal(morning.state, 'away');
  assert.equal(morning.copy.quietHours, false);
  assert.equal(morning.copy.pool, 'away');
});

test('emotion uses newest valid long-video history, even if its completed title cannot be the target', () => {
  const input = makeInput('day-7');
  const movie = input.catalog.find(item => item.type === 'movie');
  input.records.push({contentId: movie.id, unitId: 'feature', type: 'movie', valid: true, kind: 'full-length', completed: true, progressSeconds: 7440, durationSeconds: 7440, lastWatchedAt: '2026-11-02T09:00:00+08:00'});
  const study = selectResumeStudy(input);
  assert.equal(study.content.id, 'south-wind');
  assert.equal(study.history.latestContentId, 'cloud');
  assert.equal(study.history.daysAway, 0);
  assert.equal(study.state, 'returned');
});

test('finishing a real unit selects the next available unit without faking progress', () => {
  const input = makeInput('switch-variety');
  input.records[0].completed = true;
  const study = selectResumeStudy(input);
  assert.equal(study.progress.unitId, '3-lower');
  assert.equal(study.context, '第3期（下） · 待观看');
  assert.equal(study.progress.isNextUnit, true);
  assert.equal(study.progress.positionSeconds, 0);
});

test('completion follows the supplied flag, not a guessed duration percentage', () => {
  const input = makeInput('movie');
  input.records[0].progressSeconds = 7440;
  input.records[0].completed = false;
  assert.equal(selectResumeStudy(input).content.id, 'cloud');
  input.records[0].completed = true;
  assert.equal(selectResumeStudy(input).content.id, 'south-wind');
});

test('no pending content takes priority over absence and never replays a completed movie', () => {
  const study = select('caught-up');
  assert.equal(study.history.daysAway, 8);
  assert.equal(study.state, 'resting');
  assert.equal(study.status, 'caught-up');
  assert.equal(study.progress, null);
  assert.equal(study.context, '暂无待续看内容');
});

test('host validity and full-length flags exclude previews, shorts, clicks, and future records', () => {
  const input = makeInput('day-7');
  const original = input.records[0];
  input.records.push(...[
    {valid: false}, {valid: undefined}, {kind: 'trailer'}, {kind: 'short'},
    {type: 'short'}, {lastWatchedAt: 'invalid'}, {lastWatchedAt: '2026-11-03T10:00:00+08:00'},
    {progressSeconds: NaN}, {progressSeconds: -1}, {unitId: ''},
  ].map(overrides => ({...original, lastWatchedAt: '2026-11-02T10:00:00+08:00', ...overrides})));
  const study = selectResumeStudy(input);
  assert.equal(study.history.daysAway, 7);
  assert.equal(study.history.validRecordCount, 1);
  assert.equal(study.history.ignoredRecordCount, 10);
  assert.equal(study.state, 'long-away');
});

test('valid:true is authoritative without inventing a minimum playback-seconds threshold', () => {
  const input = makeInput();
  input.records = [{...input.records[0], progressSeconds: 0, lastWatchedAt: '2026-11-02T10:00:00+08:00'}];
  const study = selectResumeStudy(input);
  assert.equal(study.state, 'returned');
  assert.equal(study.progress.positionSeconds, 0);
});

test('missing or unplayable latest titles fall back while still counting valid viewing for emotion', () => {
  for (const mode of ['missing', 'unplayable', 'unknown-unit']) {
    const input = makeInput('switch-variety');
    if (mode === 'missing') input.catalog = input.catalog.filter(item => item.id !== 'weekend');
    if (mode === 'unplayable') input.catalog.find(item => item.id === 'weekend').playable = false;
    if (mode === 'unknown-unit') input.records[0].unitId = 'missing';
    const study = selectResumeStudy(input);
    assert.equal(study.content.id, 'south-wind');
    assert.equal(study.state, 'returned');
    assert.equal(study.history.skippedUnavailable, true);
  }
});

test('empty, logged-out and unavailable cases have no progress and no invented target', () => {
  for (const id of ['empty', 'logged-out', 'unavailable']) {
    const study = select(id);
    assert.equal(study.state, id);
    assert.equal(study.progress, null);
    assert.equal(study.content, null);
  }
  const loggedOut = selectResumeStudy({...makeInput('drama'), loggedIn: false});
  assert.equal(loggedOut.history.latestContentId, null);
  assert.equal(loggedOut.history.validRecordCount, 0);
  assert.equal(selectResumeStudy({...makeInput(), now: 'invalid'}).ruleReason, 'invalid_clock');
});

test('daily copy is stable within a day, consistent across sizes, and changes on adjacent same-state days', () => {
  const input = makeInput('day-3');
  const first = selectResumeStudy(input);
  const again = selectResumeStudy({...input, now: '2026-11-02T17:00:00+08:00'});
  assert.deepEqual(first.lines, again.lines);
  assert.deepEqual(first.copy, again.copy);
  const next = selectResumeStudy({...input, now: shiftDate(input.now, 1)});
  assert.equal(next.state, first.state);
  assert.notDeepEqual(next.lines, first.lines);
  const long = makeInput('day-7');
  const nextLong = selectResumeStudy({...long, now: shiftDate(long.now, 1)});
  assert.equal(nextLong.state, 'long-away');
  assert.notDeepEqual(nextLong.lines, selectResumeStudy(long).lines);
  assert.equal(first.copy.date, '2026-11-02');
});

test('tie ordering, rewatches and output copies are deterministic and do not mutate inputs', () => {
  const input = makeInput();
  const repeated = {...input.records[0], progressSeconds: 33, lastWatchedAt: '2026-11-02T10:00:00+08:00'};
  input.records.push(repeated);
  const snapshot = structuredClone(input);
  const result = selectResumeStudy(input);
  assert.equal(result.progress.positionSeconds, 33);
  assert.deepEqual(result, selectResumeStudy({...input, records: [...input.records].reverse()}));
  result.lines[0] = 'changed';
  assert.notEqual(selectResumeStudy(input).lines[0], 'changed');
  assert.deepEqual(input, snapshot);
  const fixture = createResumeScenario();
  fixture.catalog[0].units[0].playable = false;
  assert.equal(createResumeScenario().catalog[0].units[0].playable, true);
});

test('every scenario is unique, usable and deterministic; unknown ids safely use drama', () => {
  assert.equal(new Set(RESUME_SCENARIOS.map(item => item.id)).size, RESUME_SCENARIOS.length);
  for (const {id} of RESUME_SCENARIOS) {
    const input = createResumeScenario(id);
    const snapshot = structuredClone(input);
    assert.deepEqual(selectResumeStudy(input), selectResumeStudy(input));
    assert.deepEqual(input, snapshot);
    assert.equal(selectResumeStudy(input).lines.length, 2);
  }
  assert.equal(createResumeScenario('unknown').id, 'drama');
  assert.throws(() => createResumeScenario('drama', 'invalid'), RangeError);
});

test('explicit next-day controls preserve records and alter daily copy without manufacturing viewing', () => {
  const input = makeInput('day-3');
  const snapshot = structuredClone(input);
  const output = advanceResumeDay(input);
  assert.equal(output.now, '2026-11-03T02:30:00.000Z');
  assert.deepEqual(output.records, input.records);
  assert.equal(selectResumeStudy(output).history.daysAway, 4);
  assert.notDeepEqual(selectResumeStudy(output).lines, selectResumeStudy(input).lines);
  output.catalog[0].units[0].playable = false;
  assert.deepEqual(input, snapshot);
  assert.throws(() => advanceResumeDay(input, 0), RangeError);
});

test('only an explicit simulated watch appends valid playback, updates progress and changes state', () => {
  const input = makeInput('day-7');
  const snapshot = structuredClone(input);
  const output = simulateResumeWatch(input, 300);
  assert.equal(output.records.length, input.records.length + 1);
  assert.deepEqual(input, snapshot);
  const latest = output.records.at(-1);
  assert.equal(latest.valid, true);
  assert.equal(latest.kind, 'full-length');
  assert.equal(latest.progressSeconds, 1112);
  assert.equal(latest.completed, false);
  const study = selectResumeStudy(output);
  assert.equal(study.state, 'returned');
  assert.equal(study.context, '第8集 · 已看18:32');
  const completed = simulateResumeWatch(makeInput('movie'), 10000);
  assert.equal(completed.records.at(-1).completed, true);
  assert.equal(selectResumeStudy(completed).content.id, 'south-wind');
  assert.deepEqual(simulateResumeWatch(makeInput('empty')).records, []);
  assert.throws(() => simulateResumeWatch(input, -1), RangeError);
});

test('advancing to an unwatched next episode says pending rather than claiming zero watched', () => {
  const input = makeInput('drama');
  input.records = [{...input.records[0], completed: true, progressSeconds: 2400}];
  const study = selectResumeStudy(input);
  assert.equal(study.context, '第9集 · 待观看');
  assert.equal(study.progress.positionSeconds, 0);
  assert.equal(study.progress.positionLabel, '00:00');
  assert.equal(study.progress.isNextUnit, true);
  assert.equal(selectResumeStudy(simulateResumeWatch(input, 300)).context, '第9集 · 已看05:00');
});

test('repeated simulated watches at one timestamp accumulate and advance units correctly', () => {
  let input = makeInput('drama');
  const now = input.now;
  for (let count = 0; count < 5; count += 1) input = simulateResumeWatch(input, 300);
  assert.equal(input.now, now);
  assert.equal(selectResumeStudy(input).context, '第8集 · 已看38:32');
  input = simulateResumeWatch(input, 300);
  assert.equal(selectResumeStudy(input).context, '第9集 · 待观看');
  for (let count = 0; count < 10; count += 1) input = simulateResumeWatch(input, 300);
  assert.equal(selectResumeStudy(input).context, '第10集 · 已看10:00');
  assert.equal(new Set(input.records.slice(2).map(record => record.lastWatchedAt)).size, 1);
  const reversed = {...input, records: [...input.records].reverse()};
  assert.deepEqual(selectResumeStudy(input), selectResumeStudy(reversed));
});
