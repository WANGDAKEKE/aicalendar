import test from 'node:test';
import assert from 'node:assert/strict';
import {progressStudies, timeStudies} from '../dist/widget-atlas-model.mjs';

const moods = ['ready', 'evening', 'waiting', 'returned', 'resting'];
const metricValues = {
  days: [1, 7, 30, 100, 365],
  minutes: [0, 15, 35, 60, 120],
  away: [0, 1, 3, 7, 30],
};

function assertStudyShape(studies, hasMetric = false) {
  assert.equal(studies.length, 5);
  assert.deepEqual(studies.map(study => study.mood), moods);
  for (const study of studies) {
    assert.equal(typeof study.id, 'string');
    assert.ok(study.id.length > 0);
    assert.equal(typeof study.eyebrow, 'string');
    assert.ok(study.eyebrow.length > 0);
    assert.ok([...study.eyebrow].length <= 8);
    assert.equal(typeof study.context, 'string');
    assert.ok(study.context.length > 0);
    assert.ok(Array.isArray(study.lines));
    assert.equal(study.lines.length, 2);
    for (const line of study.lines) {
      assert.equal(typeof line, 'string');
      assert.ok([...line].length > 0 && [...line].length <= 8, line);
    }
    if (hasMetric) {
      assert.ok(Number.isInteger(study.metric.value));
      assert.ok(study.metric.value >= 0);
      assert.ok(['天', '分钟'].includes(study.metric.unit));
      assert.equal(typeof study.metric.label, 'string');
      assert.ok(study.metric.label.length > 0);
    } else {
      assert.equal(study.metric, undefined);
    }
  }
}

test('atlas studies have five supported moods, concise copy, and globally unique ids', () => {
  assertStudyShape(progressStudies);
  const allStudies = [...progressStudies];
  for (const metric of Object.keys(metricValues)) {
    const studies = timeStudies(metric);
    assertStudyShape(studies, true);
    allStudies.push(...studies);
  }
  assert.equal(new Set(allStudies.map(study => study.id)).size, allStudies.length);
});

test('progress contexts distinguish current episode position from completed episodes', () => {
  for (const study of progressStudies.slice(0, 4)) {
    assert.ok(study.title.length > 0);
    assert.match(study.context, /^第\d+集 · 已看\d+:\d{2}$/u);
    assert.doesNotMatch(study.context, /看完|追平|更新/u);
  }
  assert.match(progressStudies[0].context, /第8集 · 已看13:32/u);
  const caughtUp = progressStudies.find(study => study.mood === 'resting');
  assert.match(caughtUp.context, /已看完24\/24集/u);
  assert.doesNotMatch(caughtUp.context, /第24集|新更新|已更新/u);
});

test('time metrics preserve their units and distinguish zero away days from no viewing', () => {
  for (const [key, values] of Object.entries(metricValues)) {
    const studies = timeStudies(key);
    assert.deepEqual(studies.map(study => study.metric.value), values);
    assert.ok(studies.every(study => study.metric.unit === (key === 'minutes' ? '分钟' : '天')));
  }
  for (const study of timeStudies('days')) {
    assert.equal(study.metric.label, '一起看过的日子');
    assert.match(study.context, /按自然日累计/u);
  }
  for (const study of timeStudies('minutes')) {
    assert.equal(study.metric.label, '今日累计观看');
    assert.match(study.context, /^今日累计观看\d+分钟$/u);
  }
  const today = timeStudies('away')[0];
  assert.equal(today.metric.value, 0);
  assert.match(today.context, /上次观看：今天/u);
  assert.doesNotMatch(JSON.stringify(today), /未观看|没看过|未播放/u);
});

test('unsupported metric inputs use days without coercing or mutating the input', () => {
  const hostileInput = {
    toString() { throw new Error('should not coerce input'); },
    valueOf() { throw new Error('should not coerce input'); },
  };
  const arrayInput = ['minutes'];
  const objectInput = {metric: 'away'};
  for (const input of [undefined, null, '', 'unknown', 'toString', 'constructor', 0, false, NaN, arrayInput, objectInput, hostileInput]) {
    assert.deepEqual(timeStudies(input), timeStudies('days'));
  }
  assert.deepEqual(arrayInput, ['minutes']);
  assert.deepEqual(objectInput, {metric: 'away'});
});

test('progress source is deeply frozen and time studies are independent copies', () => {
  assert.ok(Object.isFrozen(progressStudies));
  for (const study of progressStudies) {
    assert.ok(Object.isFrozen(study));
    assert.ok(Object.isFrozen(study.lines));
  }
  assert.throws(() => progressStudies.push({}), TypeError);
  assert.throws(() => { progressStudies[0].lines[0] = 'changed'; }, TypeError);

  for (const metric of Object.keys(metricValues)) {
    const expected = timeStudies(metric);
    const changed = timeStudies(metric);
    assert.notEqual(changed, expected);
    assert.notEqual(changed[0], expected[0]);
    assert.notEqual(changed[0].lines, expected[0].lines);
    assert.notEqual(changed[0].metric, expected[0].metric);
    changed[0].id = 'changed';
    changed[0].lines[0] = 'changed';
    changed[0].metric.value = -1;
    changed.push({});
    assert.deepEqual(timeStudies(metric), expected);
  }
});

test('copy makes no streak, reward, pressure, or late-night promises and suggests breaks after long viewing', () => {
  const allStudies = [...progressStudies, ...timeStudies('days'), ...timeStudies('minutes'), ...timeStudies('away')];
  const copy = JSON.stringify(allStudies);
  assert.doesNotMatch(copy, /连续观看|连续打卡|连签|断签|清零|补签|连看|奖励|红包|赢取|会员|价格|熬夜|通宵|不许走|超过.*用户/u);
  for (const study of timeStudies('minutes').filter(study => study.metric.value >= 60)) {
    assert.match(study.lines.join(''), /歇|放假|休息/u);
    assert.doesNotMatch(study.lines.join(''), /再看|接着看|继续看|加时|冲刺/u);
  }
});
