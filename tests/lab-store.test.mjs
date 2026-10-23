import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState, reduceLab, selectLab, createLabStore} from '../dist/lab-store.mjs';

const run = (state, type, fields = {}) => reduceLab(state, {type, ...fields});
const range = count => Array.from({length: count}, (_, index) => index + 1);
const key = 'drama-calendar-lab-v1';

test('initial users, assets and cloned configuration are independent', () => {
  const state = createInitialState();
  assert.equal(state.version, 1);
  assert.equal(state.activeUserId, 'lin');
  assert.equal(state.users.chen.assets.level, 1);
  assert.equal(state.users.chen.ticketSerial, 'LY-0003');
  assert.equal(state.users.lin.assets.issuedAt, null);
  state.drama.scheduleByTier.vip[0].date = '2020-01-01';
  state.users.lin.completed.push(30);
  assert.equal(createInitialState().drama.scheduleByTier.vip[0].date, '2026-10-10');
  assert.deepEqual(createInitialState().users.lin.completed, range(9));
});

test('selectors use actual membership and explicit release time', () => {
  let state = createInitialState();
  assert.deepEqual(selectLab(state).availableEpisodes, range(12));
  assert.equal(selectLab(state).today, '2026-10-15');
  state = run(state, 'SET_TIME', {now: '2026-10-15T17:59:59+08:00'});
  assert.deepEqual(selectLab(state).availableEpisodes, range(10));
  state = run(state, 'SET_TIME', {now: '2026-10-15T18:00+08:00'});
  assert.deepEqual(selectLab(state).availableEpisodes, range(12));
});

test('completion emits one completion plus one initial ticket event; replay is a no-op', () => {
  const before = createInitialState();
  const after = run(before, 'COMPLETE_EPISODE', {episode: 10, source: 'front'});
  assert.deepEqual(after.events.map(event => event.kind), ['episode_completed', 'ticket_issued']);
  assert.ok(after.events.every(event => event.source === 'front' && event.userId === 'lin' && event.at === after.now));
  assert.equal(after.users.lin.assets.level, 1);
  assert.equal(after.users.lin.assets.issuedAt, after.now);
  assert.equal(after.users.lin.ticketSerial, 'LY-0001');
  assert.equal(run(after, 'COMPLETE_EPISODE', {episode: 10, source: 'front'}), after);
  assert.deepEqual(before.users.lin.completed, range(9));
});

test('later ticket upgrades preserve serial and initial issue time', () => {
  let state = run(createInitialState(), 'COMPLETE_EPISODE', {episode: 10});
  const issuedAt = state.users.lin.assets.issuedAt;
  state = run(state, 'SET_TIME', {now: '2026-10-18T19:00:00+08:00'});
  state = run(state, 'SET_COMPLETED', {completed: range(17)});
  state = run(state, 'COMPLETE_EPISODE', {episode: 18, source: 'front'});
  assert.equal(state.events.at(-1).kind, 'ticket_upgraded');
  assert.equal(state.users.lin.assets.level, 2);
  assert.equal(state.users.lin.assets.issuedAt, issuedAt);
  assert.equal(state.users.lin.assets.upgradedAt, state.now);
});

test('downgrade, clock changes and release edits retain history and assets', () => {
  let state = run(createInitialState(), 'SET_USER', {userId: 'chen'});
  const saved = structuredClone(state.users.chen);
  state = run(state, 'SET_TIER', {tier: 'free'});
  state = run(state, 'SET_TIME', {now: '2026-10-10T12:00:00+08:00'});
  state = run(state, 'SET_RELEASE', {tier: 'free', index: 0, release: {...state.drama.scheduleByTier.free[0], time: '20:00'}});
  assert.deepEqual(state.users.chen.completed, saved.completed);
  assert.deepEqual(state.users.chen.assets, saved.assets);
  assert.deepEqual(selectLab(state).availableEpisodes, []);
  assert.equal(selectLab(state).progress.currentLevel, 1);
});

test('switching users restores individual history, membership and reminder state', () => {
  let state = run(createInitialState(), 'TOGGLE_REMINDER', {source: 'front'});
  state = run(state, 'SET_USER', {userId: 'mei'});
  assert.equal(selectLab(state).user.reminded, false);
  assert.deepEqual(selectLab(state).availableEpisodes, range(7));
  state = run(state, 'COMPLETE_EPISODE', {episode: 3, source: 'front'});
  state = run(state, 'SET_USER', {userId: 'lin'});
  assert.equal(selectLab(state).user.reminded, true);
  assert.deepEqual(selectLab(state).user.completed, range(9));
  assert.deepEqual(state.users.mei.completed, [1, 2, 3]);
});

test('preview metadata and log events cannot grant a higher-tier episode or ticket', () => {
  let state = createInitialState();
  assert.throws(() => run(state, 'COMPLETE_EPISODE', {episode: 13, previewTier: 'svip', source: 'front'}), /尚未/);
  assert.throws(() => run(state, 'SET_COMPLETED', {completed: range(30), source: 'front'}), /后台/);
  assert.throws(() => run(state, 'SET_PREVIEW', {tier: 'svip'}), /不支持/);
  for(const kind of ['ticket_issued', 'ticket_upgraded', 'ticket_adjusted', 'episode_completed']) {
    assert.throws(() => run(state, 'LOG_EVENT', {kind, label: '伪造'}), /不可/);
  }
  state = run(state, 'LOG_EVENT', {kind: 'ticket_download_requested', label: '发起下载', source: 'front'});
  assert.deepEqual(state.users.lin.completed, range(9));
  assert.equal(state.users.lin.assets.level, 0);
});

test('episode availability is checked individually, never through a maximum shortcut', () => {
  const state = createInitialState();
  // Defensive selector case: even if an external caller supplied a gap, an
  // available later episode cannot make the missing earlier episode playable.
  state.drama.scheduleByTier.vip[4].date = '2026-10-30';
  assert.equal(selectLab(state).summary.available, 12);
  assert.equal(selectLab(state).availableEpisodes.includes(10), false);
  assert.throws(() => run(state, 'COMPLETE_EPISODE', {episode: 10, source: 'front'}), /尚未/);
});

test('a missing early episode blocks ticket upgrade even with a large watched count', () => {
  let state = run(createInitialState(), 'SET_COMPLETED', {completed: [1, 2, ...range(30).slice(3)]});
  assert.equal(selectLab(state).progress.currentLevel, 0);
  assert.equal(state.users.lin.assets.level, 0);
  state = run(state, 'COMPLETE_EPISODE', {episode: 3, source: 'front'});
  assert.equal(state.users.lin.assets.level, 3);
  assert.equal(state.events.filter(event => event.kind === 'ticket_issued').length, 1);
});

test('only explicit admin history editing can lower ticket assets', () => {
  let state = run(createInitialState(), 'SET_COMPLETED', {completed: range(30)});
  state = run(state, 'SET_COMPLETED', {completed: [2, 1, 2, 8]});
  assert.deepEqual(state.users.lin.completed, [1, 2, 8]);
  assert.deepEqual(state.users.lin.assets, {level: 0, issuedAt: null, upgradedAt: null});
  assert.equal(state.events.at(-1).kind, 'ticket_adjusted');
});

test('valid single release shift is reflected immediately without changing the account', () => {
  const initial = createInitialState();
  const state = run(initial, 'SET_RELEASE', {tier: 'vip', index: 5, release: {...initial.drama.scheduleByTier.vip[5], time: '20:00'}});
  assert.deepEqual(selectLab(state).availableEpisodes, range(10));
  assert.deepEqual(state.users, initial.users);
  assert.equal(state.events.at(-1).kind, 'release_updated');
});

test('invalid dates, same-day batches, backward dates and incomplete coverage are rejected', () => {
  const state = createInitialState();
  const release = state.drama.scheduleByTier.vip[5];
  for(const patch of [
    {date: '2026-02-30'}, {date: '2026-13-01'}, {date: '2026-10-14'},
    {date: '2026-10-13'}, {date: '2026-10-16'}, {time: '24:00'},
    {from: 10}, {from: 12}, {to: 13}, {to: 11}, {from: 11.5},
  ]) assert.throws(() => run(state, 'SET_RELEASE', {tier: 'vip', index: 5, release: {...release, ...patch}}));
  assert.throws(() => run(state, 'SET_RELEASE', {tier: 'vip', index: 5, release: {date: '2026-10-15'}}));
  assert.throws(() => run(state, 'SET_RELEASE', {tier: 'vip', index: -1, release}));
  assert.throws(() => run(state, 'SET_RELEASE', {tier: 'unknown', index: 5, release}));
  assert.deepEqual(state, createInitialState());
});

test('invalid time, history, identity and campaign inputs are rejected', () => {
  const state = createInitialState();
  for(const now of ['2026-02-30T19:00:00+08:00', '2026-10-15T24:00:00+08:00', '2026-10-15T19:00', 'bad']) {
    assert.throws(() => run(state, 'SET_TIME', {now}));
  }
  for(const completed of [[0], [31], [1.5], ['1'], null]) assert.throws(() => run(state, 'SET_COMPLETED', {completed}));
  assert.throws(() => run(state, 'SET_USER', {userId: '__proto__'}));
  assert.throws(() => run(state, 'SET_TIER', {tier: 'gold'}));
  assert.throws(() => run(state, 'TOGGLE_REMINDER', {source: 'unknown'}));
  for(const patch of [{mode: 'other'}, {enabled: 'true'}, {headline: ' '}, {unknown: true}]) assert.throws(() => run(state, 'SET_CAMPAIGN', {patch}));
});

test('campaign editing changes no progress and reset restores isolated defaults', () => {
  const initial = createInitialState();
  let state = run(initial, 'SET_CAMPAIGN', {patch: {enabled: false, mode: 'screening', screeningEnabled: false, headline: ' 点映活动 '}});
  assert.equal(state.campaign.headline, '点映活动');
  assert.deepEqual(state.users, initial.users);
  assert.throws(() => run(state, 'RESET', {source: 'front'}));
  state = run(state, 'RESET');
  assert.equal(state.revision, 2);
  assert.deepEqual({...state, revision: 0}, initial);
});

function browserMock(initial = null) {
  const values = new Map(initial === null ? [] : [[key, initial]]);
  const handlers = [];
  const storage = {
    writes: 0, failWrite: false,
    getItem: name => values.get(name) ?? null,
    setItem(name, value) { if(this.failWrite) throw new Error('quota'); this.writes++; values.set(name, value); },
  };
  return {
    localStorage: storage,
    addEventListener(name, listener) { if(name === 'storage') handlers.push(listener); },
    emit(value, name = key) { for(const listener of handlers) listener({key: name, newValue: value, storageArea: storage}); },
  };
}

function withBrowser(mock, fn) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {configurable: true, value: mock});
  try { fn(); }
  finally { if(previous) Object.defineProperty(globalThis, 'window', previous); else delete globalThis.window; }
}

test('store persists front and admin actions and subscribers can unsubscribe', () => {
  const browser = browserMock();
  withBrowser(browser, () => {
    const store = createLabStore();
    const updates = [];
    const unsubscribe = store.subscribe(state => updates.push(state));
    assert.equal(store.dispatch({type: 'COMPLETE_EPISODE', episode: 10, source: 'front'}).ok, true);
    assert.equal(store.dispatch({type: 'SET_TIER', tier: 'svip', source: 'admin'}).ok, true);
    assert.equal(updates.length, 2);
    assert.equal(createLabStore().getState().users.lin.assets.level, 1);
    unsubscribe();
    store.dispatch({type: 'TOGGLE_REMINDER', source: 'front'});
    assert.equal(updates.length, 2);
    const copy = store.getState();
    copy.users.lin.completed.length = 0;
    assert.equal(store.getState().users.lin.completed.length, 10);
    assert.equal(store.dispatch({type: 'COMPLETE_EPISODE', episode: 30, source: 'front'}).ok, false);
  });
});

test('cross-page updates notify without writing back and stale/invalid updates are ignored', () => {
  const browser = browserMock();
  withBrowser(browser, () => {
    const store = createLabStore();
    let notices = 0;
    store.subscribe(() => notices++);
    const incoming = run(createInitialState(), 'TOGGLE_REMINDER', {source: 'front'});
    browser.emit(JSON.stringify(incoming));
    assert.equal(store.getState().users.lin.reminded, true);
    assert.equal(notices, 1);
    assert.equal(browser.localStorage.writes, 0);
    browser.emit(JSON.stringify(createInitialState()));
    browser.emit('{bad json');
    browser.emit(JSON.stringify(incoming), 'old-production-key');
    assert.equal(notices, 1);
  });
});

test('a queued cross-page update is merged before a subsequent action', () => {
  const browser = browserMock();
  withBrowser(browser, () => {
    const front = createLabStore();
    const admin = createLabStore();
    front.dispatch({type: 'COMPLETE_EPISODE', episode: 10, source: 'front'});
    const result = admin.dispatch({type: 'SET_CAMPAIGN', patch: {enabled: false}, source: 'admin'});
    assert.equal(result.ok, true);
    assert.equal(result.state.users.lin.assets.level, 1);
    assert.equal(result.state.campaign.enabled, false);
    assert.equal(result.state.revision, 2);
    assert.equal(result.state.events.length, 3);
  });
});

test('queued membership changes apply before completion validation and idempotent checks', () => {
  withBrowser(browserMock(), () => {
    const front = createLabStore();
    const admin = createLabStore();
    admin.dispatch({type: 'SET_TIER', tier: 'svip'});
    const result = front.dispatch({type: 'COMPLETE_EPISODE', episode: 13, source: 'front'});
    assert.equal(result.ok, true);
    assert.equal(result.state.users.lin.completed.includes(13), true);
    admin.dispatch({type: 'SET_CAMPAIGN', patch: {headline: '新标题'}});
    const noop = front.dispatch({type: 'COMPLETE_EPISODE', episode: 13, source: 'front'});
    assert.equal(noop.ok, true);
    assert.equal(noop.changed, false);
    assert.equal(noop.state.campaign.headline, '新标题');
  });
});

test('changed describes this action, not a queued award created by another page', () => {
  withBrowser(browserMock(), () => {
    const front = createLabStore();
    const admin = createLabStore();
    const award = admin.dispatch({type: 'SET_COMPLETED', completed: range(10), source: 'admin'});
    assert.equal(award.changed, true);
    const replay = front.dispatch({type: 'COMPLETE_EPISODE', episode: 10, source: 'front'});
    assert.equal(replay.ok, true);
    assert.equal(replay.changed, false);
    assert.equal(replay.state.users.lin.assets.level, 1);
    assert.equal(replay.state.events.filter(event => event.kind === 'ticket_issued').length, 1);
    assert.equal(replay.state.events.some(event => event.kind === 'episode_completed'), false);
    assert.equal(front.dispatch({type: 'SET_TIER', tier: 'vip'}).changed, false);
    assert.equal(front.dispatch({type: 'SET_COMPLETED', completed: range(10)}).changed, false);
  });
});

test('a stale user-bound action cannot write to a user switched in another page', () => {
  withBrowser(browserMock(), () => {
    const editor = createLabStore();
    const otherPage = createLabStore();
    otherPage.dispatch({type: 'SET_USER', userId: 'mei'});
    for(const action of [
      {type: 'SET_COMPLETED', completed: range(10), source: 'admin'},
      {type: 'SET_TIER', tier: 'svip', source: 'admin'},
      {type: 'COMPLETE_EPISODE', episode: 3, source: 'front'},
      {type: 'TOGGLE_REMINDER', source: 'front'},
      {type: 'LOG_EVENT', kind: 'ticket_download_requested', label: '发起下载', source: 'front'},
    ]) {
      const result = editor.dispatch({...action, expectedUserId: 'lin'});
      assert.equal(result.ok, false);
      assert.match(result.error, /用户已切换/);
    }
    const saved = createLabStore().getState();
    assert.equal(saved.activeUserId, 'mei');
    assert.deepEqual(saved.users.mei.completed, [1, 2]);
    assert.equal(saved.users.mei.tier, 'free');
    assert.equal(saved.users.mei.reminded, false);
    assert.equal(saved.events.length, 1);
    assert.equal(editor.dispatch({type: 'COMPLETE_EPISODE', episode: 3, source: 'front', expectedUserId: 'mei'}).ok, true);
  });
});

test('corrupt saved state falls back safely and failed persistence does not claim success', () => {
  for(const saved of ['not-json', JSON.stringify({version: 1}), JSON.stringify({...createInitialState(), now: 'invalid'})]) {
    withBrowser(browserMock(saved), () => assert.deepEqual(createLabStore().getState(), createInitialState()));
  }
  const browser = browserMock();
  withBrowser(browser, () => {
    const store = createLabStore();
    browser.localStorage.failWrite = true;
    const result = store.dispatch({type: 'TOGGLE_REMINDER'});
    assert.equal(result.ok, false);
    assert.match(result.error, /保存失败/);
    assert.equal(store.getState().users.lin.reminded, false);
  });
});
