import test from 'node:test';
import assert from 'node:assert/strict';
import {
  POLICY_CONFIG, POLICY_SCENARIOS, PARAMETER_DEFINITIONS,
  evaluatePolicy, createPolicyInput, advancePolicyDay, simulatePolicyWatch,
} from '../dist/widget-policy-model.mjs';

const withDays = days => ({...createPolicyInput(), last_valid_watch_at: new Date(Date.parse('2026-11-02T18:00:00+08:00') - days * 86_400_000).toISOString()});
const at = (time, days = 7) => ({...withDays(days), now: `2026-11-02T${time}+08:00`});

test('contract defines each proposed input and the review-only scope', () => {
  assert.equal(POLICY_CONFIG.status, 'review-proposal');
  assert.equal(POLICY_CONFIG.timeZone, 'Asia/Shanghai');
  assert.deepEqual(POLICY_CONFIG.stageBoundaries, [3, 7, 14, 21, 30]);
  const input = createPolicyInput();
  assert.deepEqual(PARAMETER_DEFINITIONS.map(field => field.key).sort(), Object.keys(input).sort());
  assert.ok(PARAMETER_DEFINITIONS.every(field => field.key && field.label && field.type && field.role && field.source && typeof field.required === 'boolean'));
  for (const id of ['day1', 'day7', 'day14', 'day21', 'day30', 'today', 'variety', 'movie', 'empty', 'loggedout', 'unavailable', 'error', 'caughtup', 'late-night', 'next-unit', 'requires-vip']) {
    assert.ok(POLICY_SCENARIOS.some(item => item.id === id));
  }
});

test('all boundary days map to the correct finite state', () => {
  const cases = [[0, 'today'], [1, 'ready'], [2, 'ready'], [3, 'wait3'], [6, 'wait3'], [7, 'wait7'], [13, 'wait7'], [14, 'wait14'], [20, 'wait14'], [21, 'wait21'], [29, 'wait21'], [30, 'wait30'], [31, 'wait30']];
  for (const [days, id] of cases) {
    const result = evaluatePolicy(withDays(days));
    assert.equal(result.state.id, id, `D${days}`);
    assert.equal(result.derived.days_since_watch, days);
    assert.equal(result.derived.watched_today, days === 0);
    assert.equal(result.trace.filter(item => item.status === 'matched').length, 1);
  }
});

test('natural day changes at Beijing midnight, not after elapsed 24 hours', () => {
  const input = {...createPolicyInput(), now: '2026-11-02T23:59:59+08:00', last_valid_watch_at: '2026-11-02T23:58:00+08:00'};
  assert.equal(evaluatePolicy(input).derived.days_since_watch, 0);
  const next = evaluatePolicy({...input, now: '2026-11-03T00:00:00+08:00'});
  assert.equal(next.derived.days_since_watch, 1);
  assert.equal(next.state.id, 'ready');
  assert.equal(evaluatePolicy({...input, now: '2026-11-02T16:00:00Z'}).derived.local_date, '2026-11-03');
});

test('future, malformed, timezone-free and impossible calendar times are not history facts', () => {
  const original = createPolicyInput();
  for (const last of ['2026-11-03T01:00:00+08:00', 'bad', undefined, '2026-10-26T20:00:00', '2026-02-30T20:00:00+08:00']) {
    const result = evaluatePolicy({...original, last_valid_watch_at: last});
    assert.equal(result.state.id, 'neutral');
    assert.equal(result.derived.days_since_watch, null);
    assert.equal(result.target, null);
    assert.equal(result.study.title, '');
    assert.equal(result.study.context, '');
  }
  assert.equal(evaluatePolicy({...original, now: 'bad'}).state.id, 'neutral');
});

test('failed history is not confused with an empty successful history', () => {
  assert.equal(evaluatePolicy({...createPolicyInput(), history_status: 'ERROR', last_valid_watch_at: null}).state.id, 'neutral');
  assert.equal(evaluatePolicy({...createPolicyInput(), history_status: 'UNKNOWN', last_valid_watch_at: null}).state.id, 'neutral');
  const empty = evaluatePolicy(createPolicyInput('empty'));
  assert.equal(empty.state.id, 'empty');
  assert.equal(empty.action.id, 'discover');
  assert.equal(empty.derived.watched_today, null);
});

test('logged-out has first priority and no private display history', () => {
  const result = evaluatePolicy({...createPolicyInput(), is_logged_in: false, history_status: 'ERROR'});
  assert.equal(result.state.id, 'logged-out');
  assert.equal(result.target, null);
  assert.equal(result.study.title, '');
  assert.equal(result.study.context, '');
  assert.equal(result.derived.days_since_watch, null);
  assert.equal(result.action.id, 'login');
  assert.equal(result.trace[0].matched, true);
  assert.ok(result.trace.slice(1).every(item => item.status === 'skipped' && item.matched === null));
  assert.equal(evaluatePolicy({...createPolicyInput(), is_logged_in: 'true'}).state.id, 'neutral');
});

test('unknown candidate or key field cannot become a playable positive fact', () => {
  const original = createPolicyInput();
  for (const override of [{target_status: 'UNKNOWN'}, {content_status: 'UNKNOWN'}, {content_title: ''}, {play_unit_id: ''}, {position_seconds: -1}, {is_completed: undefined}, {content_type: 'short'}, {play_access_status: 'made-up'}]) {
    const result = evaluatePolicy({...original, ...override});
    assert.equal(result.state.id, 'neutral', JSON.stringify(override));
    assert.equal(result.target, null);
  }
});

test('NO_PENDING does not require unused candidate catalog fields', () => {
  const input = createPolicyInput('caughtup');
  for (const key of ['content_title', 'content_id', 'play_unit_id', 'unit_label', 'position_seconds', 'content_status', 'play_access_status', 'content_type', 'is_completed']) delete input[key];
  const result = evaluatePolicy(input);
  assert.equal(result.state.id, 'resting');
  assert.equal(result.target, null);
  assert.equal(result.action.id, 'wait');
});

test('explicit unavailability wins over absence and never produces playback', () => {
  for (const override of [{target_status: 'UNAVAILABLE'}, {content_status: 'UNAVAILABLE'}, {play_access_status: 'UNAVAILABLE'}]) {
    const result = evaluatePolicy({...withDays(30), ...override});
    assert.equal(result.state.id, 'unavailable');
    assert.equal(result.target, null);
    assert.equal(result.action.id, 'unavailable');
  }
});

test('member tier does not change emotion, and access is separate from membership', () => {
  for (const tier of ['NONE', 'VIP', 'SVIP', 'UNKNOWN']) {
    const result = evaluatePolicy({...createPolicyInput(), member_tier: tier});
    assert.equal(result.state.id, 'wait7');
    assert.equal(result.action.id, 'resume');
  }
  const gated = evaluatePolicy(createPolicyInput('requires-vip'));
  assert.equal(gated.state.id, 'wait7');
  assert.equal(gated.action.id, 'open-entitlement');
  assert.ok(gated.target);
  const unknown = evaluatePolicy(createPolicyInput('unknown-access'));
  assert.equal(unknown.state.id, 'wait7');
  assert.equal(unknown.action.id, 'verify-access');
  assert.ok(unknown.warnings.some(message => message.includes('权限未知')));
});

test('completion advances only to an explicitly provided next unit, otherwise rests', () => {
  const next = evaluatePolicy(createPolicyInput('next-unit'));
  assert.equal(next.target.play_unit_id, 'demo-drama-01-09');
  assert.equal(next.target.position_seconds, 0);
  assert.equal(next.target.progress_label, '第9集 · 待观看');
  assert.equal(next.target.is_next_unit, true);
  assert.equal(next.action.id, 'verify-access');
  assert.equal(evaluatePolicy({...createPolicyInput(), is_completed: true, next_play_unit: null}).state.id, 'resting');
  assert.equal(evaluatePolicy({...createPolicyInput(), is_completed: true, next_play_unit: {play_unit_id: ''}}).state.id, 'neutral');
});

test('a completed movie cannot use an unexpected next unit to replay or change movies', () => {
  for (const next_play_unit of [{play_unit_id: 'other-movie', unit_label: '另一部电影'}, {play_unit_id: ''}, null]) {
    const result = evaluatePolicy({...createPolicyInput('movie'), is_completed: true, next_play_unit});
    assert.equal(result.state.id, 'resting');
    assert.equal(result.target, null);
    assert.equal(result.action.id, 'wait');
    assert.equal(result.trace.find(item => item.id === 'pending').matched, true);
    assert.match(result.trace.find(item => item.id === 'pending').expression, /content_type === movie/);
  }
});

test('movies preserve time without inventing an episode, variety preserves period label', () => {
  assert.equal(evaluatePolicy(createPolicyInput('movie')).study.context, '已看42:18');
  assert.equal(evaluatePolicy({...createPolicyInput('movie'), position_seconds: 4218}).study.context, '已看1:10:18');
  const variety = evaluatePolicy(createPolicyInput('variety'));
  assert.equal(variety.study.context, '第3期（上） · 已看23:10');
  assert.equal(variety.state.id, 'today');
  const globalToday = evaluatePolicy({...createPolicyInput('day30'), last_valid_watch_at: '2026-11-02T18:30:00+08:00'});
  assert.equal(globalToday.state.id, 'today', 'global timestamp, not title age, determines emotion');
});

test('quiet boundaries only override waiting copy, not the finite state', () => {
  for (const [time, quiet] of [['07:59:59', true], ['08:00:00', false], ['21:59:59', false], ['22:00:00', true]]) {
    const result = evaluatePolicy(at(time));
    assert.equal(result.state.id, 'wait7');
    assert.equal(result.copy.pool === 'quiet', quiet, time);
    assert.equal(result.state.mood, 'resting');
  }
  for (const id of ['today', 'caughtup', 'empty', 'loggedout', 'unavailable', 'error']) {
    const input = createPolicyInput(id);
    const result = evaluatePolicy({...input, now: '2026-11-02T22:30:00+08:00'});
    assert.notEqual(result.copy.pool, 'quiet', id);
  }
});

test('same day and pool are stable; identity, size, title, and reload are not randomizers', () => {
  const input = createPolicyInput();
  assert.deepEqual(evaluatePolicy(input).copy, evaluatePolicy(input).copy);
  const base = evaluatePolicy(input);
  const changed = evaluatePolicy({...input, content_title: '另一部内容', size: 'wide', appearance: 'dark'});
  assert.deepEqual(changed.copy, base.copy);
  assert.equal(evaluatePolicy(advancePolicyDay(input)).copy.id, 'DAY_08');
  assert.equal(base.copy.id, 'DAY_07');
});

test('all D1–D30 copy is distinct; D31+ follows a 14-item cycle', () => {
  const lines = Array.from({length: 30}, (_, index) => evaluatePolicy(withDays(index + 1)).copy.lines.join(''));
  assert.equal(new Set(lines).size, 30);
  assert.deepEqual(evaluatePolicy(withDays(14)).copy.lines, ['本摆件，', '正式营业。']);
  assert.deepEqual(evaluatePolicy(withDays(21)).copy.lines, ['老熟人了，', '眨眼算招呼。']);
  assert.deepEqual(evaluatePolicy(withDays(30)).copy.lines, ['隆重宣布：', '我还挺可爱。']);
  assert.equal(evaluatePolicy(withDays(31)).copy.id, 'LOOP_01');
  assert.equal(evaluatePolicy(withDays(44)).copy.id, 'LOOP_14');
  assert.equal(evaluatePolicy(withDays(45)).copy.id, 'LOOP_01');
  assert.equal(new Set(Array.from({length: 14}, (_, index) => evaluatePolicy(withDays(index + 31)).copy.lines.join(''))).size, 14);
});

test('today and quiet special pools rotate by date independently of an unchanged D0', () => {
  const today = createPolicyInput('today');
  const tomorrowToday = {...advancePolicyDay(today), last_valid_watch_at: advancePolicyDay(today).now};
  assert.notEqual(evaluatePolicy(today).copy.id, evaluatePolicy(tomorrowToday).copy.id);
  const quiet = createPolicyInput('late-night');
  assert.notEqual(evaluatePolicy(quiet).copy.id, evaluatePolicy(advancePolicyDay(quiet)).copy.id);
});

test('a trace has exactly one match; preceding checks are false and later checks skipped', () => {
  const result = evaluatePolicy(createPolicyInput('day14'));
  const matched = result.trace.findIndex(item => item.status === 'matched');
  assert.equal(result.trace[matched].expression, '14 <= D < 21');
  assert.ok(result.trace.slice(0, matched).every(item => item.matched === false && item.status === 'passed'));
  assert.ok(result.trace.slice(matched + 1).every(item => item.matched === null && item.status === 'skipped'));
});

test('helpers do not mutate input, and only explicit allowed watching updates history', () => {
  const input = createPolicyInput(), original = structuredClone(input);
  evaluatePolicy(input);
  const next = advancePolicyDay(input);
  assert.equal(next.now, '2026-11-03T19:30:00+08:00');
  assert.equal(next.last_valid_watch_at, input.last_valid_watch_at);
  assert.equal(next.position_seconds, input.position_seconds);
  const watched = simulatePolicyWatch(input);
  assert.equal(watched.last_valid_watch_at, input.now);
  assert.equal(watched.position_seconds, input.position_seconds);
  assert.deepEqual(watched, {...input, last_valid_watch_at: input.now});
  assert.equal(evaluatePolicy(watched).state.id, 'today');
  assert.deepEqual(input, original);
  for (const id of ['caughtup', 'loggedout', 'error', 'empty', 'unavailable', 'requires-vip', 'unknown-access', 'next-unit']) {
    const blocked = createPolicyInput(id);
    assert.deepEqual(simulatePolicyWatch(blocked), blocked, id);
  }
});

test('no markup is evaluated by the model; display escaping belongs to shared renderer', () => {
  const title = '<img src=x onerror=alert(1)>';
  assert.equal(evaluatePolicy({...createPolicyInput(), content_title: title}).study.title, title);
});
