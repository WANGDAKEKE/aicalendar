import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState, reduceLab, selectLab, createLabStore} from '../dist/lab-store.mjs';
import {getDateOperations} from '../dist/operations-model.mjs';
import {selectMarketing} from '../dist/lab-marketing.mjs';

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

test('calendar emoji can be added, edited and removed without changing account data', () => {
  const initial = createInitialState();
  let state = run(initial, 'SET_HIGHLIGHT', {episode: 12, icon: '🎉'});
  const id = state.drama.calendarHighlights.at(-1).id;
  assert.match(id, /^highlight-/);
  assert.deepEqual(state.drama.calendarHighlights.at(-1), {id, episode: 12, icon: '🎉', title: '剧集表情'});
  state = run(state, 'SET_HIGHLIGHT', {id, episode: 10, icon: '🤝💌'});
  assert.equal(state.drama.calendarHighlights.find(item => item.id === id).episode, 10);
  assert.equal(run(state, 'SET_HIGHLIGHT', {id, episode: 10, icon: '🤝💌'}), state);
  state = run(state, 'REMOVE_HIGHLIGHT', {id});
  assert.equal(state.drama.calendarHighlights.some(item => item.id === id), false);
  assert.equal(run(state, 'REMOVE_HIGHLIGHT', {id}), state);
  assert.deepEqual(state.users, initial.users);
  assert.deepEqual(state.drama.scheduleByTier, initial.drama.scheduleByTier);
  assert.deepEqual(state.drama.screeningEvents, initial.drama.screeningEvents);
  assert.deepEqual(state.events.map(event => event.kind), ['highlight_updated', 'highlight_updated', 'highlight_removed']);
  assert.deepEqual(initial, createInitialState());
});

test('editing an existing emoji preserves its id and drops the internal plot caption', () => {
  const state = run(createInitialState(), 'SET_HIGHLIGHT', {id: 'companions', episode: 14, icon: '💖'});
  assert.deepEqual(state.drama.calendarHighlights[0], {id: 'companions', episode: 14, icon: '💖', title: '剧集表情'});
});

test('emoji validation accepts grapheme variants and rejects prose, markup and excess symbols', () => {
  const state = createInitialState();
  for(const icon of ['🤝', '🤝🏽', '🫱🏻‍🫲🏽', '👨‍👩‍👧‍👦', '❤️', '🏳️‍🌈', '🇨🇳', '1️⃣', '🎉💌']) {
    assert.doesNotThrow(() => run(state, 'SET_HIGHLIGHT', {episode: 12, icon}));
  }
  for(const icon of ['', ' ', '握手', 'hello', '<img src=x>', '🤝x', ' 🤝', '🤝 ', '🤝\n', '🎉💌🏡', '\u200D', '🏽', '1']) {
    assert.throws(() => run(state, 'SET_HIGHLIGHT', {episode: 12, icon}), /表情/);
  }
  for(const fields of [{episode: 14, icon: '🎉'}, {episode: 0, icon: '🎉'}, {episode: 31, icon: '🎉'}, {episode: 1.5, icon: '🎉'}, {episode: '12', icon: '🎉'}, {id: 'missing', episode: 12, icon: '🎉'}, {id: '<script>', episode: 12, icon: '🎉'}]) {
    assert.throws(() => run(state, 'SET_HIGHLIGHT', fields));
  }
  assert.throws(() => run(state, 'SET_HIGHLIGHT', {id: 'companions', episode: 22, icon: '🎉'}), /已有表情/);
  assert.throws(() => run(state, 'REMOVE_HIGHLIGHT', {id: {}}));
  assert.deepEqual(state, createInitialState());
});

test('an emoji remains attached to its episode across identity previews and release edits', () => {
  const initial = createInitialState();
  let state = run(initial, 'SET_HIGHLIGHT', {id: 'companions', episode: 14, icon: '🎉'});
  const at = (tier, date) => getDateOperations(state.drama, {tier, date, now: state.now});
  assert.equal(at('vip', '2026-10-16').highlights[0].icon, '🎉');
  assert.equal(at('svip', '2026-10-15').highlights[0].icon, '🎉');
  const freeRelease = state.drama.scheduleByTier.free.find(release => release.from <= 14 && release.to >= 14);
  assert.equal(at('free', freeRelease.date).highlights[0].icon, '🎉');
  // Move the first batch to a prior day and bind a separate emoji to it.
  state = run(state, 'SET_HIGHLIGHT', {episode: 1, icon: '🍒'});
  state = run(state, 'SET_RELEASE', {tier: 'vip', index: 0, release: {...state.drama.scheduleByTier.vip[0], date: '2026-10-09'}});
  assert.equal(at('vip', '2026-10-10').highlights.length, 0);
  assert.equal(at('vip', '2026-10-09').highlights[0].icon, '🍒');
  assert.deepEqual(state.users, initial.users);
});

test('screening settings update atomically but never grant episodes or affect normal finale', () => {
  const initial = createInitialState();
  const event = {...initial.drama.screeningEvents[0], date: '2026-10-15', time: '18:30', endTime: '21:00', from: 25, to: 30, accessNote: ' 需单独获取资格。 '};
  let state = run(initial, 'SET_SCREENING', {enabled: true, event});
  assert.equal(state.drama.screeningEvents[0].accessNote, '需单独获取资格。');
  const selected = selectLab(state);
  assert.deepEqual(selected.availableEpisodes, range(12));
  assert.deepEqual(state.users, initial.users);
  assert.deepEqual(state.drama.scheduleByTier, initial.drama.scheduleByTier);
  assert.equal(getDateOperations(state.drama, {tier: 'vip', date: '2026-10-15', now: state.now}).events[0].status, 'live');
  assert.equal(selectMarketing({...selected, campaign: {...state.campaign, mode: 'screening'}}).event.from, 25);
  assert.throws(() => run(state, 'COMPLETE_EPISODE', {episode: 25, source: 'front'}), /尚未/);
  assert.equal(run(state, 'SET_SCREENING', {enabled: true, event: state.drama.screeningEvents[0]}), state);
  assert.equal(run(state, 'SET_SCREENING', {enabled: true, event: Object.fromEntries(Object.entries(state.drama.screeningEvents[0]).reverse())}), state);
  state = run(state, 'SET_SCREENING', {enabled: false, event: state.drama.screeningEvents[0]});
  assert.equal(state.campaign.screeningEnabled, false);
  assert.equal(selectMarketing({...selectLab(state), campaign: {...state.campaign, mode: 'screening'}}), null);
  assert.equal(state.events.at(-1).kind, 'screening_updated');
});

test('screening validation rejects malformed activity metadata without partial toggle changes', () => {
  const state = createInitialState(), event = state.drama.screeningEvents[0];
  const invalid = [{id: 'unknown'}, {title: ''}, {title: '<script>'}, {date: '2026-02-30'}, {time: '24:00'}, {endTime: '18:00'}, {endTime: '17:00'}, {from: 0}, {to: 31}, {from: 30, to: 29}, {from: '27'}, {accessNote: ''}, {tiers: []}, {tiers: ['vip', 'vip']}, {tiers: ['__proto__']}, {tiers: 'vip'}, {playable: true}];
  for(const patch of invalid) assert.throws(() => run(state, 'SET_SCREENING', {enabled: false, event: {...event, ...patch}}));
  for(const enabled of ['true', null, 1]) assert.throws(() => run(state, 'SET_SCREENING', {enabled, event}));
  assert.deepEqual(state, createInitialState());
});

test('screening can be created for an empty configuration and identity visibility stays independent', () => {
  const initial = createInitialState();
  initial.drama.screeningEvents = [];
  const event = {...createInitialState().drama.screeningEvents[0], tiers: ['svip']};
  const state = run(initial, 'SET_SCREENING', {enabled: true, event});
  assert.deepEqual(state.drama.screeningEvents, [event]);
  assert.equal(getDateOperations(state.drama, {tier: 'vip', date: event.date, now: state.now}).events.length, 0);
  assert.equal(getDateOperations(state.drama, {tier: 'svip', date: event.date, now: state.now}).events.length, 1);
  assert.deepEqual(state.users, initial.users);
});

test('front-end actions cannot edit screening or emoji configuration', () => {
  const state = createInitialState();
  for(const action of [
    {type: 'SET_HIGHLIGHT', episode: 12, icon: '🤝'},
    {type: 'REMOVE_HIGHLIGHT', id: 'companions'},
    {type: 'SET_SCREENING', enabled: false, event: state.drama.screeningEvents[0]},
  ]) assert.throws(() => reduceLab(state, {...action, source: 'front'}), /后台/);
});

test('old v1 data and new operations survive persistence without resetting user progress', () => {
  const initial = JSON.parse(JSON.stringify(run(createInitialState(), 'COMPLETE_EPISODE', {episode: 10, source: 'front'})));
  const browser = browserMock(JSON.stringify(initial));
  withBrowser(browser, () => {
    const store = createLabStore();
    assert.deepEqual(store.getState(), initial);
    assert.equal(store.dispatch({type: 'SET_HIGHLIGHT', episode: 12, icon: '🤝🏽'}).ok, true);
    assert.equal(store.dispatch({type: 'SET_SCREENING', enabled: false, event: {...initial.drama.screeningEvents[0], date: '2026-10-25'}}).ok, true);
    const restored = createLabStore().getState();
    assert.deepEqual(restored, store.getState());
    assert.equal(restored.drama.calendarHighlights.at(-1).icon, '🤝🏽');
    assert.equal(restored.drama.screeningEvents[0].date, '2026-10-25');
    assert.equal(restored.campaign.screeningEnabled, false);
    assert.deepEqual(restored.users, initial.users);
  });
});

test('malformed operations in cross-page storage cannot replace valid in-memory data', () => {
  withBrowser(browserMock(), () => {
    const browser = globalThis.window, store = createLabStore();
    const valid = JSON.parse(JSON.stringify(run(createInitialState(), 'TOGGLE_REMINDER')));
    browser.emit(JSON.stringify(valid));
    for(const corrupt of [
      state => {state.drama.calendarHighlights[0].icon = '<img>';},
      state => {state.drama.calendarHighlights[1].episode = 14;},
      state => {state.drama.screeningEvents[0].endTime = '17:00';},
    ]) {
      const incoming = structuredClone(valid);incoming.revision++;
      corrupt(incoming);browser.emit(JSON.stringify(incoming));
      assert.deepEqual(store.getState(), valid);
    }
  });
});
