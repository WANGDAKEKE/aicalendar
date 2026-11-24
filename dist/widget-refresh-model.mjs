/**
 * Static design-review fixtures, not live release or playback data.
 * Every fixture is an independent snapshot of the same IP. Neither scenario
 * selection nor elapsed days advances episodes, changes progress or adds rights.
 */
const STUDIES = Object.freeze({
  'updated-pending': Object.freeze({
    id: 'updated-pending',
    label: '今天更新 · 还有待看',
    contentTitle: '花开锦绣',
    updateLine: '今天更新至第10集',
    headline: '新集到了，接着看',
    progressLine: '第8集 · 已看13:32',
    actionLabel: '继续观看',
    action: 'resume',
    targetLabel: '第8集 · 从13:32继续',
    mood: 'alert',
    description: '静态演示：新集已更新，仍从未看完的第8集继续。',
  }),
  'updated-caught-up': Object.freeze({
    id: 'updated-caught-up',
    label: '今天更新 · 已追平',
    contentTitle: '花开锦绣',
    updateLine: '今天更新至第10集',
    headline: '今天的更新，已追平',
    progressLine: '已看完第10集 · 已追平',
    actionLabel: '看排期',
    action: 'schedule',
    targetLabel: '查看后续预计排期',
    mood: 'content',
    description: '静态演示：本次更新已看完，查看后续排期，不再催看。',
  }),
  'no-update-pending': Object.freeze({
    id: 'no-update-pending',
    label: '今天休更 · 还有待看',
    contentTitle: '花开锦绣',
    updateLine: '今天休更 · 更至10集',
    headline: '进度还在，接着看',
    progressLine: '第8集 · 已看13:32',
    actionLabel: '继续观看',
    action: 'resume',
    targetLabel: '第8集 · 从13:32继续',
    mood: 'content',
    description: '静态演示：休更不等于没内容，继续第8集，不跳到第10集。',
  }),
  waiting: Object.freeze({
    id: 'waiting',
    label: '已经追平 · 等待更新',
    contentTitle: '花开锦绣',
    updateLine: '周四20:00预计更新',
    headline: '下次更新，等你一起',
    progressLine: '已看完第8集 · 已追平',
    actionLabel: '看排期',
    action: 'schedule',
    targetLabel: '第9—10集 · 查看预计排期',
    mood: 'patient',
    description: '静态演示：当前更新已追平，展示预计排期，不承诺新集可播。',
  }),
});

export const REFRESH_SCENARIOS = Object.freeze(
  Object.values(STUDIES).map(({id, label}) => Object.freeze({id, label})),
);

/** Return one immutable presentation fixture; unknown inputs safely use default. */
export function createRefreshStudy(id = 'updated-pending') {
  return typeof id === 'string' && Object.hasOwn(STUDIES, id)
    ? STUDIES[id]
    : STUDIES['updated-pending'];
}
