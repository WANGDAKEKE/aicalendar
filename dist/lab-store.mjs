import {drama as originalDrama} from './drama-config.mjs';
import {getSummary, releaseTime} from './calendar-model.mjs';
import {getTicketProgress} from './ticket-model.mjs';

// This is an isolated, same-browser demonstration store, not an account service.
const STORAGE_KEY = 'drama-calendar-lab-v1';
const TIERS = new Set(['free', 'vip', 'svip']);
const CAMPAIGN_MODES = new Set(['auto', 'membership', 'screening']);
const LOG_KINDS = new Set(['penguin_tap', 'widget_preview', 'marketing_click', 'ticket_download_requested']);
const INITIAL_NOW = '2026-10-15T19:00:00+08:00';
const clone = value => structuredClone(value);
const fail = message => { throw new Error(message); };
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function validDate(value) {
  if(typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validTime(value) {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function validNow(value) {
  if(typeof value !== 'string') return false;
  const parts = /^(\d{4}-\d{2}-\d{2})T((?:[01]\d|2[0-3]):[0-5]\d)(?::[0-5]\d(?:\.\d{1,3})?)?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.exec(value);
  return Boolean(parts && validDate(parts[1]) && !/[+-]14:(?!00)/.test(parts[3]) && Number.isFinite(Date.parse(value)));
}

function episodes(value) {
  if(!Array.isArray(value) || value.some(episode => !Number.isSafeInteger(episode) || episode < 1 || episode > 30)) {
    fail('观看记录只能包含 1–30 集的整数集号。');
  }
  return [...new Set(value)].sort((a, b) => a - b);
}

function validateSchedule(releases) {
  if(!Array.isArray(releases) || releases.length === 0 || releases.length > 30) fail('排期必须完整覆盖 1–30 集。');
  let expected = 1;
  let previousDate = '';
  for(const release of releases) {
    if(!isRecord(release) || !validDate(release.date) || !validTime(release.time)) fail('请填写有效的播出日期和时间。');
    if(!Number.isSafeInteger(release.from) || !Number.isSafeInteger(release.to) || release.from !== expected || release.to < release.from || release.to > 30) {
      fail('排期集数必须顺序、连续且不重叠，完整覆盖 1–30 集。');
    }
    if(release.date <= previousDate) fail('播出日期必须依次递增，每天只能有一批更新，不能倒序或重叠。');
    if(release.milestone !== undefined && !['premiere', 'finale'].includes(release.milestone)) fail('排期节点无效。');
    if(release.milestone === 'premiere' && release.from !== 1 || release.milestone === 'finale' && release.to !== 30) fail('开播和完结节点必须对应首集与最终集。');
    previousDate = release.date;
    expected = release.to + 1;
  }
  if(expected !== 31) fail('排期必须完整覆盖 1–30 集。');
}

function validateCampaign(campaign) {
  if(!isRecord(campaign) || typeof campaign.enabled !== 'boolean' || typeof campaign.screeningEnabled !== 'boolean' || !CAMPAIGN_MODES.has(campaign.mode)) {
    fail('活动开关或活动模式无效。');
  }
  if(typeof campaign.headline !== 'string' || !campaign.headline.trim() || campaign.headline.length > 60) fail('活动标题请填写 1–60 个字符。');
}

function initialAssets(completed) {
  const level = getTicketProgress(completed).currentLevel;
  return {level, issuedAt: level ? INITIAL_NOW : null, upgradedAt: level > 1 ? INITIAL_NOW : null};
}

export function createInitialState() {
  const makeUser = (id, name, tier, count, ticketSerial) => {
    const completed = Array.from({length: count}, (_, index) => index + 1);
    return {id, name, tier, completed, reminded: false, ticketSerial, assets: initialAssets(completed)};
  };
  return {
    version: 1, revision: 0, now: INITIAL_NOW,
    drama: clone(originalDrama), activeUserId: 'lin',
    users: {
      lin: makeUser('lin', '小林', 'vip', 9, 'LY-0001'),
      mei: makeUser('mei', '小梅', 'free', 2, 'LY-0002'),
      chen: makeUser('chen', '阿辰', 'svip', 12, 'LY-0003'),
    },
    campaign: {enabled: true, mode: 'auto', headline: '好故事，先一步看到', screeningEnabled: true},
    events: [],
  };
}

export function selectLab(state) {
  const user = state.users[state.activeUserId];
  const summary = getSummary(state.drama, user.tier, state.now);
  const availableEpisodes = summary.releases
    .filter(release => releaseTime(release) <= Date.parse(state.now))
    .flatMap(release => Array.from({length: release.to - release.from + 1}, (_, index) => release.from + index));
  return {
    user, drama: state.drama, now: state.now, today: summary.today,
    availableEpisodes: [...new Set(availableEpisodes)].sort((a, b) => a - b),
    summary, progress: getTicketProgress(user.completed), campaign: state.campaign,
  };
}

function record(state, source, kind, label) {
  state.events.push({
    id: `lab-${state.revision}-${state.events.length + 1}`,
    at: state.now, source, kind, label, userId: state.activeUserId,
  });
}

function syncAssets(state, source, previousCompleted) {
  const user = state.users[state.activeUserId];
  const before = getTicketProgress(previousCompleted).currentLevel;
  const after = getTicketProgress(user.completed);
  if(after.currentLevel === before) return;
  user.assets = {
    level: after.currentLevel,
    issuedAt: after.currentLevel ? user.assets.issuedAt || state.now : null,
    upgradedAt: after.currentLevel > 1 ? state.now : null,
  };
  if(after.currentLevel > before) {
    record(state, source, before === 0 ? 'ticket_issued' : 'ticket_upgraded', `${user.name}${before === 0 ? '获得' : '升级为'}${after.current.name}（${user.ticketSerial}）`);
  } else {
    record(state, source, 'ticket_adjusted', `${user.name}的电子票随演示观看记录调整为${after.current?.name || '未解锁'}`);
  }
}

// Pure reducer: invalid input throws; idempotent/no-change actions return state.
export function reduceLab(state, action) {
  if(!isRecord(action) || typeof action.type !== 'string') fail('操作无效。');
  const source = action.source ?? 'admin';
  if(!['admin', 'front'].includes(source)) fail('操作来源无效。');
  if(action.expectedUserId !== undefined && (typeof action.expectedUserId !== 'string' || action.expectedUserId !== state.activeUserId)) {
    fail('演示用户已切换，请确认当前用户后重试。');
  }
  const next = clone(state);
  next.revision = state.revision + 1;
  const user = next.users[next.activeUserId];
  switch(action.type) {
    case 'SET_USER':
      if(typeof action.userId !== 'string' || !Object.hasOwn(next.users, action.userId)) fail('演示用户不存在。');
      if(action.userId === state.activeUserId) return state;
      next.activeUserId = action.userId;
      record(next, source, 'user_changed', `切换为${next.users[action.userId].name}`);
      break;
    case 'SET_TIER':
      if(!TIERS.has(action.tier)) fail('会员身份无效。');
      if(user.tier === action.tier) return state;
      user.tier = action.tier;
      record(next, source, 'tier_changed', `${user.name}的演示身份改为 ${next.drama.tiers[action.tier]}`);
      break;
    case 'SET_TIME':
      if(!validNow(action.now)) fail('请填写有效的演示时间，并包含时区。');
      if(next.now === action.now) return state;
      next.now = action.now;
      record(next, source, 'time_changed', `演示时间调整为 ${action.now}`);
      break;
    case 'SET_COMPLETED': {
      if(source !== 'admin') fail('只有演示后台可以直接调整观看记录。');
      const completed = episodes(action.completed);
      if(JSON.stringify(completed) === JSON.stringify(user.completed)) return state;
      const previous = user.completed;
      user.completed = completed;
      record(next, source, 'history_updated', `${user.name}的演示观看记录调整为已看 ${completed.length} 集`);
      syncAssets(next, source, previous);
      break;
    }
    case 'COMPLETE_EPISODE': {
      const [episode] = episodes([action.episode]);
      if(!selectLab(state).availableEpisodes.includes(episode)) fail('这一集尚未在当前账号排期中上线，不能记录看完。');
      if(user.completed.includes(episode)) return state;
      const previous = user.completed;
      user.completed = episodes([...previous, episode]);
      record(next, source, 'episode_completed', `${user.name}看完第 ${episode} 集`);
      syncAssets(next, source, previous);
      break;
    }
    case 'TOGGLE_REMINDER':
      user.reminded = !user.reminded;
      record(next, source, 'reminder_changed', `${user.name}${user.reminded ? '开启' : '关闭'}更新提醒`);
      break;
    case 'SET_RELEASE': {
      if(!TIERS.has(action.tier)) fail('排期会员类型无效。');
      const releases = next.drama.scheduleByTier[action.tier];
      if(!Number.isSafeInteger(action.index) || action.index < 0 || action.index >= releases.length) fail('排期位置无效。');
      if(!isRecord(action.release)) fail('请提供完整的排期内容。');
      const replacement = clone(action.release);
      releases[action.index] = replacement;
      validateSchedule(releases);
      if(JSON.stringify(replacement) === JSON.stringify(state.drama.scheduleByTier[action.tier][action.index])) return state;
      record(next, source, 'release_updated', `${next.drama.tiers[action.tier]} 第 ${replacement.from}–${replacement.to} 集排期调整为 ${replacement.date} ${replacement.time}`);
      break;
    }
    case 'SET_CAMPAIGN': {
      const allowed = ['enabled', 'mode', 'headline', 'screeningEnabled'];
      if(!isRecord(action.patch) || Object.keys(action.patch).some(key => !allowed.includes(key))) fail('活动配置字段无效。');
      const campaign = {...next.campaign, ...action.patch};
      validateCampaign(campaign);
      campaign.headline = campaign.headline.trim();
      if(JSON.stringify(campaign) === JSON.stringify(state.campaign)) return state;
      next.campaign = campaign;
      record(next, source, 'campaign_updated', '更新活动配置');
      break;
    }
    case 'LOG_EVENT':
      if(!LOG_KINDS.has(action.kind)) fail('此事件类型不可手动记录。');
      if(typeof action.label !== 'string' || !action.label.trim() || action.label.length > 160) fail('事件说明请填写 1–160 个字符。');
      record(next, source, action.kind, action.label.trim());
      break;
    case 'RESET': {
      if(source !== 'admin') fail('只有演示后台可以重置演示数据。');
      const initial = createInitialState();
      initial.revision = next.revision;
      return initial;
    }
    default:
      fail('暂不支持此操作。');
  }
  return next;
}

function validateStoredState(state) {
  if(!isRecord(state) || state.version !== 1 || !Number.isSafeInteger(state.revision) || state.revision < 0 || !validNow(state.now)) fail('演示数据格式无效。');
  if(!isRecord(state.drama) || state.drama.id !== originalDrama.id || state.drama.totalEpisodes !== 30 || state.drama.timeZone !== 'Asia/Shanghai' || !isRecord(state.drama.scheduleByTier)) fail('剧集配置无效。');
  for(const tier of TIERS) validateSchedule(state.drama.scheduleByTier[tier]);
  validateCampaign(state.campaign);
  if(!isRecord(state.users) || !Object.hasOwn(state.users, state.activeUserId)) fail('演示用户数据无效。');
  const serials = new Set();
  for(const [id, user] of Object.entries(state.users)) {
    if(!isRecord(user) || user.id !== id || typeof user.name !== 'string' || !user.name || !TIERS.has(user.tier) || typeof user.reminded !== 'boolean') fail('演示用户数据无效。');
    const completed = episodes(user.completed);
    if(JSON.stringify(completed) !== JSON.stringify(user.completed)) fail('观看记录无效。');
    if(typeof user.ticketSerial !== 'string' || !/^LY-\d{4}$/.test(user.ticketSerial) || serials.has(user.ticketSerial)) fail('电子票编号无效。');
    serials.add(user.ticketSerial);
    if(!isRecord(user.assets) || user.assets.level !== getTicketProgress(completed).currentLevel || ![user.assets.issuedAt, user.assets.upgradedAt].every(time => time === null || validNow(time))) fail('电子票记录无效。');
    if(user.assets.level > 0 && !user.assets.issuedAt || user.assets.level === 0 && (user.assets.issuedAt !== null || user.assets.upgradedAt !== null)) fail('电子票发放时间无效。');
  }
  if(!Array.isArray(state.events) || state.events.some(event => !isRecord(event) || typeof event.id !== 'string' || !validNow(event.at) || !['admin', 'front'].includes(event.source) || typeof event.kind !== 'string' || typeof event.label !== 'string' || !Object.hasOwn(state.users, event.userId))) fail('事件记录无效。');
  return state;
}

export function createLabStore() {
  let state = createInitialState();
  let storage = null;
  let storageError = null;
  const listeners = new Set();
  const host = globalThis.window;
  try {
    storage = host?.localStorage ?? globalThis.localStorage ?? null;
    const saved = storage?.getItem(STORAGE_KEY);
    if(saved) {
      try { state = validateStoredState(JSON.parse(saved)); }
      catch { /* Corrupt demo data is replaced by the next successful action. */ }
    }
  } catch {
    storageError = '浏览器阻止了演示数据存储，请允许本站存储后重试。';
  }

  const notify = () => {
    for(const listener of listeners) {
      try { listener(clone(state)); }
      catch(error) { console.error('演示界面更新失败', error); }
    }
  };

  host?.addEventListener('storage', event => {
    if(event.key !== STORAGE_KEY || !event.newValue || event.storageArea && event.storageArea !== storage) return;
    try {
      const incoming = validateStoredState(JSON.parse(event.newValue));
      if(incoming.revision <= state.revision) return;
      state = incoming;
      notify(); // Never persist an incoming event: avoids cross-page write loops.
    } catch { /* An invalid external update never replaces usable local data. */ }
  });

  return {
    getState: () => clone(state),
    dispatch(action) {
      try {
        // Resolve queued external changes before validation, including no-ops.
        // A newly published release must be playable without waiting for the
        // browser's storage event; a stale no-op must not hide another tab's edit.
        let base = state;
        if(storage) {
          try {
            const saved = storage.getItem(STORAGE_KEY);
            const latest = saved ? validateStoredState(JSON.parse(saved)) : null;
            if(latest && latest.revision > state.revision) base = latest;
          } catch { /* Keep the valid in-memory state if the stored copy is bad. */ }
        }
        const next = reduceLab(base, action);
        if(next === base) {
          if(base !== state) { state = base; notify(); }
          return {ok: true, state: clone(state), changed: false};
        }
        if(storageError) return {ok: false, error: storageError};
        if(storage) {
          try { storage.setItem(STORAGE_KEY, JSON.stringify(next)); }
          catch { return {ok: false, error: '演示数据保存失败，请检查浏览器存储空间或权限。'}; }
        }
        state = next;
        notify();
        return {ok: true, state: clone(state), changed: true};
      } catch(error) {
        return {ok: false, error: error instanceof Error ? error.message : '操作未成功，请重试。'};
      }
    },
    subscribe(listener) {
      if(typeof listener !== 'function') throw new TypeError('订阅者必须是函数。');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
