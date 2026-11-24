/**
 * Review-only rule simulator. Field names below are a proposed contract, not
 * names read from an existing Tencent API. A host supplies the latest valid
 * watch across all eligible long videos and an already selected resume candidate.
 * This module neither fetches account data nor reconstructs full watch history.
 */
const DAY_MS = 86_400_000;
const OFFSET_MS = 8 * 3_600_000;
const DEFAULT_NOW = '2026-11-02T19:30:00+08:00';
const TYPES = ['drama', 'variety', 'movie', 'anime', 'documentary'];

export const POLICY_CONFIG = Object.freeze({
  version: '0.1', status: 'review-proposal', timeZone: 'Asia/Shanghai', utcOffsetHours: 8,
  stageBoundaries: Object.freeze([3, 7, 14, 21, 30]), quietStartHour: 22, quietEndHour: 8,
  copyRotation: 'D1–D30逐日；D31起14条循环；特殊池按账号偏移与日期轮换',
  dataContract: '上游提供全品类最近有效观看时间与已筛选续看候选；不是完整历史排序模拟',
  effectiveWatch: '沿用客户端标准，本地不新增观看秒数门槛',
  privacy: '未登录或数据异常时不输出历史标题、集期与位置',
  permission: '会员身份不推导播放权限，实际播放由客户端鉴权',
});

const definitions = [
  ['user_key', '用户标识', 'string', '用户', '当前账号的去标识化标识；用于数据隔离和特殊文案池稳定轮换。', '需研发映射'],
  ['is_logged_in', '是否登录', 'boolean', '用户', '必须是明确的 true 或 false；未知不能当作已登录。', '需研发映射'],
  ['member_tier', '会员身份', 'NONE / VIP / SVIP / UNKNOWN', '用户', '仅展示事实，首期不决定等待情绪，也不代替播放鉴权。', '候选字段'],
  ['history_status', '历史数据状态', 'SUCCESS / ERROR / UNKNOWN', '数据', '区分无历史与数据请求失败；只有成功才能判断观看状态。', '需研发映射'],
  ['now', '当前时间', '带时区的 ISO 时间', '时间', '本次判断使用的时间；自然日和时段统一按北京时间。', '客户端/服务端对齐'],
  ['last_valid_watch_at', '最近有效观看时间', '带时区的 ISO 时间 / null', '观看汇总', '全品类长视频最近一次有效观看，不仅是当前候选内容；成功且 null 才代表无历史。', '上游汇总或计算'],
  ['target_status', '续看候选状态', 'READY / NO_PENDING / UNAVAILABLE / UNKNOWN', '续看汇总', '上游已完成候选筛选；无待续看与不可播、未知必须区分。', '上游汇总或计算'],
  ['content_id', '内容主体 ID', 'string', '内容', '一部剧、一档综艺或一部电影；不是单集/期 ID。', '需研发映射'],
  ['play_unit_id', '播放单元 ID', 'string', '内容', '实际续播的集、期或电影播放单元。', '需研发映射'],
  ['content_type', '内容类型', TYPES.join(' / '), '内容', '只覆盖长视频正片；电影不虚构第几集。', '需研发映射'],
  ['content_title', '内容标题', 'string', '内容', '两个尺寸展示同一标题，标题不决定用户情绪。', '需研发映射'],
  ['unit_label', '集/期名称', 'string', '内容', '例如第8集或第3期（上）；电影可为空。', '需研发映射'],
  ['position_seconds', '播放位置', '非负 number，单位秒', '观看', '用于展示真实进度与定位续播，不是累计使用时长。', '需研发映射'],
  ['is_completed', '当前单元已完成', 'boolean', '观看', '复用上游完播口径；不按组件自行猜测百分比。', '需研发映射'],
  ['next_play_unit', '下一条正片', 'null / {play_unit_id, unit_label}', '内容', '本地只演示推进到已提供的下一条；真实可用性和权限仍需校验。', '候选接口对齐'],
  ['content_status', '内容可用性', 'AVAILABLE / UNAVAILABLE / UNKNOWN', '可用性', '内容正常、下架或未知；未知不当作正常。', '需研发映射'],
  ['play_access_status', '播放鉴权结果', 'ALLOWED / REQUIRES_ENTITLEMENT / UNAVAILABLE / UNKNOWN', '权限', '需要开通不等于下架；未知时点击后校验，不声称可直接播。', '需研发映射'],
];
const SOURCE_LABELS = {用户: '账号', 数据: '历史汇总', 时间: '时间', 观看汇总: '历史汇总', 续看汇总: '续看候选', 内容: '续看候选', 观看: '续看候选', 可用性: '续看候选', 权限: '鉴权'};
export const PARAMETER_DEFINITIONS = Object.freeze(definitions.map(([key, label, type, group, description, note]) => Object.freeze({key, label, type, group, role: description, description, source: SOURCE_LABELS[group], note, required: !['member_tier', 'next_play_unit'].includes(key)})));

// Local copy proposals mirror the reviewed-for-discussion spreadsheet, not a
// live production copy service. D18 uses the spreadsheet's deduplicated wording.
const DAILY_LINES = [
  ['人是走了，', '进度还在这。'], ['我没催你，', '我就看看。'],
  ['我不着急，', '眼睛先急了。'], ['我有在等，', '但不太明显。'],
  ['进度不动，', '我先眨两下。'], ['没事没事，', '我很会待机。'],
  ['一周过去，', '我熟悉这儿了。'], ['这块桌面，', '我先住下了。'],
  ['别看我闲，', '我在守进度。'], ['今天的我，', '主打一个淡定。'],
  ['等着也是等，', '我换只眼看。'], ['表情很稳，', '眼神随缘。'],
  ['位置挺好，', '暂时不挪窝。'], ['本摆件，', '正式营业。'],
  ['别管我，', '我在当摆件。'], ['摆件也有，', '自己的眼神。'],
  ['我不催，', '我就摆着。'], ['摆得很正，', '态度很松。'],
  ['今日营业：', '安静地可爱。'], ['我很稳定，', '稳定地发呆。'],
  ['老熟人了，', '眨眼算招呼。'], ['换个姿势，', '继续当邻居。'],
  ['想说点啥，', '又忘词了。'], ['今天人设：', '沉默老朋友。'],
  ['没啥大事，', '就是眨个眼。'], ['我没走神，', '神自己走的。'],
  ['等会儿，', '我换个眼神。'], ['熟是熟了，', '可爱不能省。'],
  ['老朋友，', '今天也在岗。'], ['隆重宣布：', '我还挺可爱。'],
];
const LOOP_LINES = [
  ['今日状态：', '可爱且待机。'], ['别紧张，', '我只占桌面。'],
  ['我很忙的，', '忙着不打扰。'], ['眼神已就位，', '台词慢点来。'],
  ['今天的风格，', '安静地抢眼。'], ['没啥新事情，', '先眨个眼。'],
  ['躺平这方面，', '我略懂一点。'], ['今天也在，', '并没有很得意。'],
  ['本组件，', '情绪很稳定。'], ['你忙你的，', '我先练个眼神。'],
  ['没别的安排，', '就在这儿待着。'], ['别看我小，', '我挺能待机。'],
  ['进度替你留，', '我先歇一下。'], ['熟面孔了，', '不用重新介绍。'],
];
const COPY_POOLS = {
  today: [['行，来过就行。', '今天不闹你。'], ['进度往前了，', '我也开心了。'], ['刚刚看过，', '先歇一会儿吧。']],
  quiet: [['先好好休息，', '有空再接着看。'], ['我先安静，', '进度替你留着。'], ['晚点再见，', '不用赶着来。']],
  resting: [['进度先放好，', '我也歇会儿。'], ['这会儿不催，', '有新故事再见。'], ['先放松一下，', '下次再一起看。']],
  empty: [['初次见面，', '先混个眼熟。'], ['想看些什么？', '我帮你记进度。'], ['挑个喜欢的，', '下次从这继续。']],
  'logged-out': [['先认个门，', '登录后接着看。'], ['登录见个面，', '再一起接着看。'], ['先打个招呼，', '登录后再见。']],
  unavailable: [['这会儿播不了，', '先歇一会儿吧。'], ['暂时停一停，', '稍后再来看看。'], ['今天先等等，', '不用着急。']],
  neutral: [['我先缓一缓，', '稍后再见。'], ['这会儿歇一下，', '稍后再来看看。'], ['先等一小会，', '我们稍后再见。']],
};
const STATE_META = {
  'logged-out': ['待登录', 'resting'], neutral: ['暂不可用', 'resting'], empty: ['初次见面', 'ready'],
  unavailable: ['暂不可播', 'resting'], resting: ['暂无待续看', 'resting'], today: ['今天已看', 'returned'],
  ready: ['普通续看', 'ready'], wait3: ['轻轻试探', 'waiting'], wait7: ['桌面住户', 'resting'],
  wait14: ['摆件营业', 'evening'], wait21: ['久别熟人', 'waiting'], wait30: ['长期常驻', 'returned'],
};
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const dayIndex = time => Math.floor((time + OFFSET_MS) / DAY_MS);
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
function timestamp(value) {
  if (typeof value !== 'string' || !/T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value)) return NaN;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T/u.exec(value);
  if (!parts) return NaN;
  const [, year, month, day] = parts;
  const calendar = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (calendar.getUTCFullYear() !== Number(year) || calendar.getUTCMonth() !== Number(month) - 1 || calendar.getUTCDate() !== Number(day)) return NaN;
  return Date.parse(value);
}
function localISO(time) { return Number.isFinite(time) ? `${new Date(time + OFFSET_MS).toISOString().slice(0, 19)}+08:00` : null; }
function hash(value) {
  let result = 2166136261;
  for (const char of String(value ?? '')) result = Math.imul(result ^ char.charCodeAt(0), 16777619) >>> 0;
  return result;
}
function timeLabel(seconds) {
  const whole = Math.floor(seconds), hours = Math.floor(whole / 3600), mins = Math.floor(whole / 60) % 60, secs = whole % 60;
  const tail = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return hours ? `${hours}:${tail}` : tail;
}
function targetFor(input) {
  const next = input.content_type !== 'movie' && input.is_completed === true && input.next_play_unit != null;
  const unit = next ? input.next_play_unit : input;
  const position = next ? 0 : input.position_seconds;
  const unitLabel = input.content_type === 'movie' ? '' : unit.unit_label;
  const progress = next ? '待观看' : `已看${timeLabel(position)}`;
  return {
    content_id: input.content_id, play_unit_id: unit.play_unit_id, content_type: input.content_type,
    content_title: input.content_title, unit_label: unitLabel, position_seconds: position,
    is_next_unit: next, content_status: input.content_status, play_access_status: input.play_access_status,
    progress_label: unitLabel ? `${unitLabel} · ${progress}` : progress,
  };
}
function selectCopy(stateId, days, timeSlot, localDay, userKey) {
  const waiting = ['ready', 'wait3', 'wait7', 'wait14', 'wait21', 'wait30'].includes(stateId);
  const pool = waiting && timeSlot === 'quiet' ? 'quiet' : stateId;
  let index, lines, id, rotation;
  if (waiting && pool !== 'quiet') {
    index = days <= 30 ? days - 1 : (days - 31) % LOOP_LINES.length;
    lines = (days <= 30 ? DAILY_LINES : LOOP_LINES)[index];
    id = days <= 30 ? `DAY_${String(days).padStart(2, '0')}` : `LOOP_${String(index + 1).padStart(2, '0')}`;
    rotation = days <= 30 ? '按当前D直达，不补播' : 'D31起14条循环';
  } else {
    const choices = COPY_POOLS[pool];
    index = ((hash(userKey) + (Number.isFinite(localDay) ? localDay : 0)) % choices.length + choices.length) % choices.length;
    lines = choices[index];
    id = `${pool.replaceAll('-', '_').toUpperCase()}_${String(index + 1).padStart(2, '0')}`;
    rotation = '账号固定偏移＋北京时间日期；同日同池固定';
  }
  return {id, pool, index, lines: [...lines], rotation, quiet: pool === 'quiet', status: 'review-proposal'};
}

/** No input is mutated; unknown values are not coerced into positive facts. */
export function evaluatePolicy(raw = {}) {
  const input = clone(raw && typeof raw === 'object' ? raw : {});
  const now = timestamp(input.now), last = timestamp(input.last_valid_watch_at);
  const nowValid = Number.isFinite(now);
  const lastNull = input.last_valid_watch_at === null;
  const lastValid = Number.isFinite(last) && nowValid && last <= now;
  const day = nowValid ? dayIndex(now) : null;
  const hour = nowValid ? new Date(now + OFFSET_MS).getUTCHours() : null;
  const timeSlot = hour === null ? 'unknown' : hour >= POLICY_CONFIG.quietStartHour || hour < POLICY_CONFIG.quietEndHour ? 'quiet' : 'regular';
  // Never infer viewing data when logged out or history is unavailable.
  const trustedHistory = input.is_logged_in === true && input.history_status === 'SUCCESS' && nowValid && (lastNull || lastValid);
  const days = trustedHistory && lastValid ? day - dayIndex(last) : null;
  const warnings = [];
  if (!['NONE', 'VIP', 'SVIP', 'UNKNOWN'].includes(input.member_tier)) warnings.push('会员字段缺失或未知；不参与情绪判断，也不推导播放权限。');
  const errors = [];
  if (input.is_logged_in !== true && input.is_logged_in !== false) errors.push('登录态未知');
  if (input.history_status !== 'SUCCESS') errors.push('观看历史未成功获取');
  if (!nowValid) errors.push('当前时间无效或缺少时区');
  if (!lastNull && !Number.isFinite(last)) errors.push('最近观看时间缺失、无效或缺少时区');
  else if (!lastNull && nowValid && last > now) errors.push('最近观看时间在未来');
  const basicFieldsValid = nonempty(input.content_id) && nonempty(input.play_unit_id)
    && TYPES.includes(input.content_type) && nonempty(input.content_title)
    && (input.content_type === 'movie' || nonempty(input.unit_label))
    && typeof input.position_seconds === 'number' && Number.isFinite(input.position_seconds) && input.position_seconds >= 0
    && typeof input.is_completed === 'boolean';
  const nextValid = input.content_type === 'movie' || input.next_play_unit == null || (nonempty(input.next_play_unit.play_unit_id)
    && (input.content_type === 'movie' || nonempty(input.next_play_unit.unit_label)));
  const candidateUnknown = !['READY', 'NO_PENDING', 'UNAVAILABLE'].includes(input.target_status)
    || (input.target_status === 'READY' && (!basicFieldsValid || !nextValid
      || !['AVAILABLE', 'UNAVAILABLE'].includes(input.content_status)
      || !['ALLOWED', 'REQUIRES_ENTITLEMENT', 'UNAVAILABLE', 'UNKNOWN'].includes(input.play_access_status)));
  const candidateUnavailable = input.target_status === 'UNAVAILABLE'
    || (input.target_status === 'READY' && (input.content_status === 'UNAVAILABLE' || input.play_access_status === 'UNAVAILABLE'));
  const noPending = input.target_status === 'NO_PENDING'
    || (input.target_status === 'READY' && input.is_completed === true && (input.content_type === 'movie' || input.next_play_unit == null));
  const rules = [
    ['login', '先判断登录态', 'is_logged_in === false', () => input.is_logged_in === false, 'logged-out', '未登录，不展示账号历史。'],
    ['data', '检查数据是否可信', 'history_status !== "SUCCESS" OR 时间无效/未来 OR 登录态未知', () => errors.length > 0, 'neutral', errors.join('；') || '历史成功、时间合法、登录态明确。'],
    ['history', '判断是否有有效观看历史', 'last_valid_watch_at === null', () => lastNull, 'empty', lastNull ? '成功获取历史，明确没有有效观看记录。' : '已有全品类有效观看时间。'],
    ['candidate', '检查续看候选是否明确', 'target_status 未明确 OR (target_status === "READY" AND 候选关键字段缺失/未知)', () => candidateUnknown, 'neutral', candidateUnknown ? '候选信息不完整或状态未知，不猜测内容及进度。' : '候选状态已明确。'],
    ['availability', '排除不可播目标', 'target_status === "UNAVAILABLE" OR (target_status === "READY" AND (content_status === "UNAVAILABLE" OR play_access_status === "UNAVAILABLE"))', () => candidateUnavailable, 'unavailable', candidateUnavailable ? '上游未提供其他可续看的目标；此处不绕过限制。' : '没有命中明确不可播条件。'],
    ['pending', '判断是否暂无待续看', 'target_status === NO_PENDING OR (is_completed AND (content_type === movie OR next_play_unit === null))', () => noPending, 'resting', noPending ? '已确认暂无待续看；电影已看完不自动接下一集或另一部电影。' : '存在未完成内容或已提供的下一条剧集/期正片。'],
    ['today', '今天已看', 'D === 0', () => days === 0, 'today', `全品类最近有效观看距今天 ${days ?? '未知'} 个自然日。`],
    ['day1', '普通续看', '1 <= D < 3', () => days >= 1 && days < 3, 'ready', 'D1–D2：顺手续看。'],
    ['day3', '轻轻试探', '3 <= D < 7', () => days >= 3 && days < 7, 'wait3', 'D3–D6：轻试探，不责怪用户。'],
    ['day7', '桌面住户', '7 <= D < 14', () => days >= 7 && days < 14, 'wait7', 'D7–D13：在桌面安顿的小情境。'],
    ['day14', '摆件营业', '14 <= D < 21', () => days >= 14 && days < 21, 'wait14', 'D14–D20：换成摆件情境，不加大催促。'],
    ['day21', '久别熟人', '21 <= D < 30', () => days >= 21 && days < 30, 'wait21', 'D21–D29：像熟人招呼。'],
    ['day30', '长期常驻', 'D >= 30', () => days >= 30, 'wait30', 'D30节点台词；D31起14条循环。'],
  ];
  let stateId = null;
  const trace = rules.map(([id, label, expression, predicate, result, reason]) => {
    if (stateId !== null) return {id, label, expression, matched: null, reason: `已命中「${STATE_META[stateId][0]}」，本条不再执行。`, status: 'skipped'};
    const matched = predicate() === true;
    if (matched) stateId = result;
    return {id, label, expression, matched, reason, status: matched ? 'matched' : 'passed'};
  });
  stateId ||= 'neutral';
  const [label, mood] = STATE_META[stateId];
  const activeTarget = ['today', 'ready', 'wait3', 'wait7', 'wait14', 'wait21', 'wait30'].includes(stateId);
  const target = activeTarget ? targetFor(input) : null;
  if (target?.is_next_unit) warnings.push('下一条来自上游候选；真实播放前仍需校验该单元的可用性与权限。');
  if (target?.play_access_status === 'UNKNOWN') warnings.push('播放权限未知：可以展示续看目标，但不声称可直接播放。');
  const copy = selectCopy(stateId, days, timeSlot, day, input.is_logged_in === true ? input.user_key : 'anonymous');
  const state = {id: stateId, label, pool: copy.pool, mood};
  let action;
  if (target) {
    action = target.play_access_status === 'REQUIRES_ENTITLEMENT'
      ? {id: 'open-entitlement', label: '查看播放权益', reason: '需要开通或购买；不是下架，点击后交由客户端权益流程处理。'}
      : target.play_access_status === 'UNKNOWN' || target.is_next_unit
        ? {id: 'verify-access', label: '校验后续看', reason: '由客户端校验该播放单元，校验通过后才播放。'}
        : {id: 'resume', label: '继续观看', reason: '此处是模拟续看，真实上线仍由客户端播放器处理。'};
  } else {
    const actions = {
      'logged-out': ['login', '去登录', '登录后重新获取该账号的历史。'],
      neutral: ['retry', '稍后重试', '不输出未知数据，重新获取后再判断。'],
      empty: ['discover', '发现内容', '没有有效观看历史，不伪造续看进度。'],
      unavailable: ['unavailable', '暂不可续播', '没有可用续看目标，不能继续播放。'],
      resting: ['wait', '暂无待续看', '等待新的可续看内容，不虚构更新。'],
    };
    const [id, actionLabel, reason] = actions[stateId] || actions.neutral;
    action = {id, label: actionLabel, reason};
  }
  return {
    state, derived: {days_since_watch: days, watched_today: days === null ? null : days === 0, time_slot: timeSlot, local_date: nowValid ? localISO(now).slice(0, 10) : null},
    study: {id: `policy-${stateId}`, mood, title: target?.content_title || '', lines: [...copy.lines], context: target?.progress_label || ''},
    copy, trace, target, action, warnings, input, config: POLICY_CONFIG,
  };
}

const BASE_INPUT = {
  user_key: 'demo-user-a', is_logged_in: true, member_tier: 'VIP', history_status: 'SUCCESS', now: DEFAULT_NOW,
  last_valid_watch_at: '2026-10-26T20:00:00+08:00', target_status: 'READY',
  content_id: 'demo-drama-01', play_unit_id: 'demo-drama-01-08', content_type: 'drama', content_title: '南风来信',
  unit_label: '第8集', position_seconds: 812, is_completed: false, next_play_unit: null,
  content_status: 'AVAILABLE', play_access_status: 'ALLOWED',
};
const scenarioDefinitions = [
  ['day1', '1天未看 · 普通续看', {last_valid_watch_at: '2026-11-01T20:00:00+08:00'}],
  ['day7', '7天未看 · 桌面住户', {}],
  ['day14', '14天未看 · 摆件营业', {last_valid_watch_at: '2026-10-19T20:00:00+08:00'}],
  ['day21', '21天未看 · 久别熟人', {last_valid_watch_at: '2026-10-12T20:00:00+08:00'}],
  ['day30', '30天未看 · 长期常驻', {last_valid_watch_at: '2026-10-03T20:00:00+08:00'}],
  ['today', '今天已看 · 不再催促', {last_valid_watch_at: '2026-11-02T18:30:00+08:00'}],
  ['variety', '今天改看综艺', {last_valid_watch_at: '2026-11-02T18:30:00+08:00', content_id: 'demo-variety-01', play_unit_id: 'demo-variety-01-03a', content_type: 'variety', content_title: '周末请就位', unit_label: '第3期（上）', position_seconds: 1390}],
  ['movie', '电影 · 中途续看', {last_valid_watch_at: '2026-11-01T20:00:00+08:00', content_id: 'demo-movie-01', play_unit_id: 'demo-movie-01-main', content_type: 'movie', content_title: '云上散步', unit_label: '', position_seconds: 2538}],
  ['empty', '成功获取 · 无观看历史', {last_valid_watch_at: null, target_status: 'NO_PENDING'}],
  ['loggedout', '尚未登录 · 不展示历史', {is_logged_in: false}],
  ['unavailable', '无可用目标 · 暂不可播', {target_status: 'UNAVAILABLE', content_status: 'UNAVAILABLE', play_access_status: 'UNAVAILABLE'}],
  ['error', '历史获取失败 · 中性兜底', {history_status: 'ERROR'}],
  ['caughtup', '全部看完 · 暂无待续看', {target_status: 'NO_PENDING', is_completed: true}],
  ['late-night', '22:30 · 安静文案覆盖', {now: '2026-11-02T22:30:00+08:00'}],
  ['next-unit', '当前集看完 · 接下一集', {is_completed: true, next_play_unit: {play_unit_id: 'demo-drama-01-09', unit_label: '第9集'}}],
  ['requires-vip', '非会员 · 候选需要权益', {member_tier: 'NONE', play_access_status: 'REQUIRES_ENTITLEMENT'}],
  ['unknown-access', '权限未知 · 点击后校验', {play_access_status: 'UNKNOWN'}],
];
export const POLICY_SCENARIOS = Object.freeze(scenarioDefinitions.map(([id, label, override]) => Object.freeze({id, label, input: Object.freeze({...BASE_INPUT, ...override})})));
export function createPolicyInput(id = 'day7') { return clone((POLICY_SCENARIOS.find(item => item.id === id) || POLICY_SCENARIOS.find(item => item.id === 'day7')).input); }

/** Only advances the clock. It cannot create viewing history. */
export function advancePolicyDay(input, days = 1) {
  const next = clone(input), now = timestamp(next?.now);
  if (!Number.isInteger(days) || days < 0 || !Number.isFinite(now)) return next;
  next.now = localISO(now + days * DAY_MS);
  return next;
}

/** A local explicit-play button, not an app-open event. It updates only the
 * effective-watch timestamp: no duration is available to safely advance position.
 * Blocked/unknown access cannot manufacture a successful watch or a new unit.
 */
export function simulatePolicyWatch(input) {
  const next = clone(input), evaluated = evaluatePolicy(next);
  if (!evaluated.target || evaluated.action.id !== 'resume') return next;
  next.last_valid_watch_at = next.now;
  return next;
}
