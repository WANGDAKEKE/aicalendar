import test from 'node:test';
import assert from 'node:assert/strict';
import {REFRESH_SCENARIOS, createRefreshStudy} from '../dist/widget-refresh-model.mjs';

const IDS = ['updated-pending', 'updated-caught-up', 'no-update-pending', 'waiting'];
const FIELDS = [
  'id', 'label', 'contentTitle', 'updateLine', 'headline', 'progressLine',
  'actionLabel', 'action', 'targetLabel', 'mood', 'description',
];

test('four independent scenarios share a complete schema and the same poster IP', () => {
  assert.deepEqual(REFRESH_SCENARIOS.map(({id}) => id), IDS);
  for (const {id, label} of REFRESH_SCENARIOS) {
    const study = createRefreshStudy(id);
    assert.deepEqual(Object.keys(study), FIELDS);
    assert.equal(study.id, id);
    assert.equal(study.label, label);
    assert.equal(study.contentTitle, '花开锦绣');
    assert.ok(['resume', 'schedule'].includes(study.action));
    assert.ok(['alert', 'content', 'patient'].includes(study.mood));
    assert.match(study.description, /静态演示/);
    for (const key of FIELDS) assert.equal(typeof study[key], 'string');
  }
});

test('default is the updated-but-pending snapshot, not a day-based policy', () => {
  const study = createRefreshStudy();
  assert.equal(study.id, 'updated-pending');
  assert.equal(study.headline, '新集到了，接着看');
  assert.match(study.updateLine, /更新至第10集/);
  assert.equal(study.progressLine, '第8集 · 已看13:32');
  assert.equal(study.actionLabel, '继续观看');
  assert.equal(study.targetLabel, '第8集 · 从13:32继续');
  assert.ok(!('daysAway' in study));
  assert.ok(!('lastWatchAt' in study));
});

test('both pending snapshots resume the unfinished eighth episode without jumping to ten', () => {
  for (const id of ['updated-pending', 'no-update-pending']) {
    const study = createRefreshStudy(id);
    assert.equal(study.action, 'resume');
    assert.equal(study.targetLabel, '第8集 · 从13:32继续');
    assert.equal(study.progressLine, '第8集 · 已看13:32');
    assert.doesNotMatch(study.targetLabel, /第10集/);
  }
  assert.match(createRefreshStudy('no-update-pending').updateLine, /今天休更/);
});

test('both caught-up snapshots lead to a schedule rather than promising playback', () => {
  for (const id of ['updated-caught-up', 'waiting']) {
    const study = createRefreshStudy(id);
    assert.equal(study.action, 'schedule');
    assert.equal(study.actionLabel, '看排期');
    assert.match(study.targetLabel, /预计排期/);
    assert.doesNotMatch(study.actionLabel + study.targetLabel, /继续观看|立即播放|从.*继续/);
  }
  assert.match(createRefreshStudy('updated-caught-up').progressLine, /已看完第10集/);
  const waiting = createRefreshStudy('waiting');
  assert.match(waiting.progressLine, /已看完第8集/);
  assert.match(waiting.updateLine, /预计/u);
  assert.match(waiting.targetLabel, /第9—10集/u);
});

test('scenario list and presentation snapshots are frozen and selection is non-mutating', () => {
  assert.ok(Object.isFrozen(REFRESH_SCENARIOS));
  for (const scenario of REFRESH_SCENARIOS) {
    assert.ok(Object.isFrozen(scenario));
    assert.ok(Object.isFrozen(createRefreshStudy(scenario.id)));
  }
  const pending = createRefreshStudy('updated-pending');
  const before = JSON.stringify(pending);
  assert.throws(() => { pending.progressLine = '第10集'; }, TypeError);
  assert.throws(() => { REFRESH_SCENARIOS[0].label = 'changed'; }, TypeError);
  assert.throws(() => { REFRESH_SCENARIOS.push({id: 'other'}); }, TypeError);
  createRefreshStudy('waiting');
  createRefreshStudy('updated-caught-up');
  assert.equal(JSON.stringify(pending), before);
  assert.deepEqual(createRefreshStudy('updated-pending'), JSON.parse(before));
});

test('invalid IDs safely fall back without inheriting arbitrary object properties', () => {
  const fallback = createRefreshStudy();
  for (const value of ['', 'unknown', '__proto__', 'constructor', 'toString', null, false, 0, {}, []]) {
    assert.equal(createRefreshStudy(value), fallback);
  }
});
