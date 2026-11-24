const screens = [...document.querySelectorAll('.screen')];
const steps = [...document.querySelectorAll('[data-step]')];

const episodeGrid = document.querySelector('.episode-grid');
episodeGrid.innerHTML = Array.from({ length: 28 }, (_, index) => {
  const label = index === 0 ? '试看' : index;
  return `<button type="button" tabindex="-1">${label}</button>`;
}).join('');

const rows = [
  { day: '周一 · 开播', date: '9月3日', svip: '1–6集', vip: '1–6集', free: '1–2集', milestone: true, watched: true },
  { day: '周二', date: '9月4日', svip: '7–8集', vip: '7–8集', free: '3集', watched: true },
  { day: '周三', date: '今天', svip: '9–10集', vip: '9–10集', free: '4集', emoji: '💎', today: true },
  { day: '周四', date: '9月6日', svip: '11–12集', vip: '11–12集', free: '5集' },
  { day: '周五', date: '9月7日', svip: '13–14集', vip: '13–14集', free: '6集' },
  { day: '周六', date: '9月8日', svip: '15–16集', vip: '15–16集', free: '7集' },
  { day: '周日', date: '9月9日', svip: '17–18集', vip: '17–18集', free: '8集', emoji: '💎🌈' },
  { day: '周一', date: '9月10日', svip: '19–20集', vip: '19–20集', free: '9集' },
  { day: '周二', date: '9月11日', svip: '21–22集', vip: '21–22集', free: '10集' },
  { day: '周三', date: '9月12日', svip: '23–24集', vip: '23–24集', free: '11集', emoji: '🔥💛' },
  { day: '周三', date: '9月13日', svip: '25–26集', vip: '25–26集', free: '12集', emoji: '💛🚗' },
  { day: '周三 · 完结', date: '9月18日', svip: '27–28集', vip: '27–28集', free: '13集', milestone: true },
  { day: '周四 · 点映礼', date: '9月28日', svip: '29–30集', vip: '29–30集', free: '14集', milestone: true },
];

let watchedThrough = 8;

function renderCalendarRows() {
  document.getElementById('calendarRows').innerHTML = rows.map((row) => `
    <div class="calendar-row${row.milestone ? ' milestone' : ''}${row.today ? ' today' : ''}${row.watched ? ' watched' : ''}" role="row">
      <div class="date-cell" role="cell"><strong>${row.day}</strong><small>${row.date}</small></div>
      <div class="episode-cell" role="cell">${row.svip}${row.watched ? '<span class="watched-mark">✓ 已看</span>' : ''}${row.emoji && !row.watched ? `<span class="emoji">${row.emoji}</span>` : ''}</div>
      <div class="episode-cell" role="cell">${row.vip}${row.emoji ? `<span class="emoji">${row.emoji}</span>` : ''}</div>
      <div class="episode-cell" role="cell">${row.free}</div>
    </div>
  `).join('');
}

renderCalendarRows();

function showScreen(id, push = true) {
  const next = document.getElementById(id);
  if (!next) return;
  const stepId = id === 'watching' ? 'calendar' : id;
  screens.forEach((screen) => screen.classList.toggle('active', screen === next));
  steps.forEach((step) => step.classList.toggle('active', step.dataset.step === stepId));
  next.scrollTop = 0;
  if (push) history.pushState({ screen: id }, '', `#${id}`);
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-target]');
  if (target) showScreen(target.dataset.target);
});

const reminderSheet = document.getElementById('reminderSheet');
const openReminder = document.getElementById('openReminder');
const closeReminder = document.getElementById('closeReminder');
const addCalendar = document.getElementById('addCalendar');
const pushOnly = document.getElementById('pushOnly');
const toast = document.getElementById('toast');
const continueWatch = document.getElementById('continueWatch');
const finishEpisode = document.getElementById('finishEpisode');
const historyProgress = document.getElementById('historyProgress');
const nextUpdateLabel = document.getElementById('nextUpdateLabel');
const reminderAction = document.getElementById('reminderAction');
const reminderEpisode = document.getElementById('reminderEpisode');
const reminderWhen = document.getElementById('reminderWhen');
const watchPlayerState = document.getElementById('watchPlayerState');

function setReminderSheet(open) {
  reminderSheet.hidden = !open;
  if (open) closeReminder.focus();
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => { toast.hidden = true; }, 2200);
}

function calendarDate(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(18, 0, 0, 0);
  return date;
}

function toIcsDate(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function makeEvent(title, episode, offsetDays) {
  const start = calendarDate(offsetDays);
  const end = new Date(start.getTime() + 45 * 60 * 1000);
  return [
    'BEGIN:VEVENT',
    `UID:zhuiju-${episode}-${start.getTime()}@demo.tencent`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${title} 第${episode}集更新`,
    'DESCRIPTION:腾讯视频追剧提醒 · 点击回到剧集继续观看',
    'BEGIN:VALARM',
    'TRIGGER:-PT10M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${title}即将更新`,
    'END:VALARM',
    'END:VEVENT',
  ].join('\r\n');
}

function downloadCalendar() {
  const schedule = watchedThrough >= 10
    ? [['11–12', 3], ['13–14', 5], ['15–16', 7]]
    : [['9–10', 1], ['11–12', 3], ['13–14', 5]];
  const events = schedule.map(([episode, day]) => makeEvent('长安的荔枝', episode, day));
  const content = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tencent Video//Drama Calendar Demo//CN', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = '长安的荔枝-追剧日历.ics';
  link.click();
  URL.revokeObjectURL(url);
  addCalendar.classList.add('added');
  addCalendar.innerHTML = '<span>✓</span> 已生成手机日历';
  reminderAction.textContent = '已设置';
  showToast('已生成追剧日程，可在系统日历中导入');
  window.setTimeout(() => setReminderSheet(false), 850);
}

openReminder.addEventListener('click', () => setReminderSheet(true));
closeReminder.addEventListener('click', () => setReminderSheet(false));
reminderSheet.addEventListener('click', (event) => {
  if (event.target === reminderSheet) setReminderSheet(false);
});
addCalendar.addEventListener('click', downloadCalendar);
pushOnly.addEventListener('click', () => {
  reminderAction.textContent = '已提醒';
  setReminderSheet(false);
  showToast('腾讯视频更新提醒已开启');
});

continueWatch.addEventListener('click', () => showScreen('watching'));

finishEpisode.addEventListener('click', () => {
  finishEpisode.disabled = true;
  finishEpisode.classList.add('finishing');
  finishEpisode.textContent = '✓ 第9–10集已看完，正在同步…';
  watchPlayerState.textContent = '播放完成';

  window.setTimeout(() => {
    watchedThrough = 10;
    rows[2].watched = true;
    renderCalendarRows();
    historyProgress.textContent = '你已看到第10集';
    continueWatch.textContent = '已追平';
    continueWatch.disabled = true;
    nextUpdateLabel.textContent = '9月6日 18:00 · SVIP 第11–12集';
    reminderAction.textContent = '下一集';
    reminderEpisode.textContent = '第11–12集';
    reminderWhen.textContent = '9月6日 18:00 更新';
    showScreen('calendar');
    showToast('观看历史已同步，下一次提醒已更新');
  }, 750);
});

window.addEventListener('popstate', () => showScreen(location.hash.slice(1) || 'detail', false));

const initial = ['detail', 'episodes', 'calendar', 'watching'].includes(location.hash.slice(1))
  ? location.hash.slice(1)
  : 'detail';
history.replaceState({ screen: initial }, '', `#${initial}`);
showScreen(initial, false);
