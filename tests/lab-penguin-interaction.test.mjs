import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState, reduceLab, selectLab} from '../dist/lab-store.mjs';

const apply = (state, type, fields = {}) => reduceLab(state, {type, ...fields});
const frontLog = (state, kind) => apply(state, 'LOG_EVENT', {
  kind, label: kind === 'penguin_tap' ? '和企鹅搭子打招呼' : '查看桌面小组件预览',
  source: 'front', expectedUserId: state.activeUserId,
});

test('repeated penguin greetings log interaction without changing any viewing or reward state', () => {
  const initial = createInitialState();
  let state = initial;
  for (let i = 0; i < 12; i++) state = frontLog(state, 'penguin_tap');
  assert.deepEqual(state.users, initial.users);
  assert.deepEqual(state.drama, initial.drama);
  assert.deepEqual(state.campaign, initial.campaign);
  assert.deepEqual(selectLab(state).progress, selectLab(initial).progress);
  assert.deepEqual(selectLab(state).availableEpisodes, selectLab(initial).availableEpisodes);
  assert.equal(state.events.length, 12);
  assert.ok(state.events.every(event => event.kind === 'penguin_tap' && event.source === 'front' && event.userId === 'lin'));
});

test('desktop penguin preview neither installs a widget nor grants watching or reminder rewards', () => {
  const initial = createInitialState();
  const state = frontLog(initial, 'widget_preview');
  assert.deepEqual(state.users, initial.users);
  assert.equal(state.users.lin.reminded, false);
  assert.equal(state.events.length, 1);
  assert.equal(state.events[0].kind, 'widget_preview');
  assert.deepEqual(Object.keys(state).sort(), Object.keys(initial).sort());
});

test('greeting before and after a genuine unlock preserves one earned ticket and one issuance', () => {
  let state = frontLog(createInitialState(), 'penguin_tap');
  assert.equal(selectLab(state).progress.currentLevel, 0);
  state = apply(state, 'COMPLETE_EPISODE', {episode: 10, source: 'front'});
  const earned = structuredClone(state.users.lin);
  state = frontLog(state, 'penguin_tap');
  state = frontLog(state, 'widget_preview');
  state = apply(state, 'COMPLETE_EPISODE', {episode: 10, source: 'front'});
  assert.deepEqual(state.users.lin, earned);
  assert.equal(selectLab(state).progress.currentLevel, 1);
  assert.equal(state.events.filter(event => event.kind === 'ticket_issued').length, 1);
  assert.equal(state.events.filter(event => event.kind === 'episode_completed').length, 1);
});

test('penguin interaction follows the selected user without changing another user’s assets', () => {
  let state = apply(createInitialState(), 'SET_USER', {userId: 'chen', source: 'admin'});
  const users = structuredClone(state.users);
  state = frontLog(state, 'penguin_tap');
  assert.deepEqual(state.users, users);
  assert.equal(state.events.at(-1).userId, 'chen');
  assert.equal(selectLab(state).progress.currentLevel, 1);
});
