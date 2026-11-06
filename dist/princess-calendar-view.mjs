import {APPLE_PREVIEW} from './ios-preview-v3.mjs';
import {escapeHTML as esc,icon} from './calendar-concept-view.mjs';
import {princessDrama} from './princess-calendar-model.mjs';
import {ticketLevels} from './ticket-model.mjs';
import {renderPrincessWidgetEntry} from './princess-widget-entry.mjs';

const tierName=tier=>princessDrama.tiers[tier]||'非VIP';
const range=release=>!release?'—':release.from===release.to?String(release.from):`${release.from}–${release.to}`;
const dateName=date=>`${Number(date.slice(5,7))}月${Number(date.slice(8))}日`;
const ornaments={'2026-11-02':'🪨','2026-11-03':'🦌','2026-11-04':'🏹','2026-11-05':'🐟','2026-11-06':'🏮','2026-11-07':'📘','2026-11-08':'☂️'};

export function renderPrincessFrame(){
  return `<div class="pc-device-wrap"><div class="pc-device"><div class="pc-app">
    <div class="pc-status" aria-hidden="true"><span>19:00</span><div><svg viewBox="0 0 18 13" fill="currentColor"><rect y="8" width="3" height="5" rx=".8"/><rect x="5" y="5.5" width="3" height="7.5" rx=".8"/><rect x="10" y="3" width="3" height="10" rx=".8"/><rect x="15" width="3" height="13" rx=".8"/></svg><svg viewBox="0 0 17 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M1 4.5a11 11 0 0 1 15 0M3.7 7.3a7 7 0 0 1 9.6 0M6.4 10a3.2 3.2 0 0 1 4.2 0"/><circle cx="8.5" cy="12" r=".8" fill="currentColor" stroke="none"/></svg><svg viewBox="0 0 29 14" fill="currentColor"><rect x=".7" y=".7" width="24" height="12.6" rx="3.3" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-width="1.2"/><rect x="2.6" y="2.6" width="20.2" height="8.8" rx="1.6"/><path d="M26.5 4.5V9.5Q29.5 9 29.5 7T26.5 4.5" fill-opacity=".4"/></svg></div></div>
    <header class="pc-nav"><button type="button" data-action="back" aria-label="剧集信息">${icon('back')}</button><h1>追剧日历</h1><button type="button" data-action="share" aria-label="分享本地方案">${icon('share')}</button></header>
    <div class="pc-scroll"></div>
    <div class="pc-layer" hidden><section class="pc-sheet" role="dialog" aria-modal="true" aria-labelledby="princess-sheet-title"><header><div><small></small><h2 id="princess-sheet-title"></h2></div><button type="button" class="pc-close" data-action="close" aria-label="关闭面板">${icon('close')}</button></header><div class="pc-sheet__body"></div></section></div>
    <div class="pc-toast" role="status" hidden></div><span class="pc-home-indicator" aria-hidden="true"></span>
    </div><img class="pc-bezel" src="${APPLE_PREVIEW.asset}" alt="" width="1359" height="2736"></div></div>`;
}

export function renderPrincessContent(view,session,{desktopEntry=false,queryOnly=true}={}){
  const progress=view.ticket,target=progress.next?.episode||30;
  const count=progress.nextProgress?.watchedCount??progress.watchedCount;
  const percent=Math.min(100,count/target*100);
  const selected=view.days.find(day=>day.date===view.selectedDate);
  const release=selected?.release;
  const activities=selected?.activities.map(activity=>`<button type="button" class="pc-extra" data-action="extra">${esc(activity.title)} · ${esc(activity.time)} ${icon('chevron')}</button>`).join('')||'';
  let continuation='';
  if(!queryOnly){
    const pending=selected?.watching.pendingEpisodes?.find(episode=>view.availableEpisodes.includes(episode));
    const continuing=pending??(release&&view.availableEpisodes.includes(release.from)?release.from:null);
    continuation=`<div class="pc-continue">${continuing?`<button type="button" data-play="${continuing}">${session.completed.has(continuing)?`重看第${continuing}集`:`继续看第${continuing}集`} <span aria-hidden="true">→</span></button>`:''}${activities}</div>`;
  }
  const past=release&&Date.parse(`${release.date}T${release.time}:00+08:00`)<=Date.parse(view.now);
  const selectedTitle=release?`${selected.isToday?'今日':dateName(selected.date)} ${release.time} ${past?'已更新':'更新'} ${range(release)}集`:'这一天的排期暂未公布';
  const summary=release?`${tierName(view.accountTier)} ${past?`可看至第${view.availableThrough}集`:'以实际播出为准'}`:view.accountTier==='free'?'免费排期待公布，可先预览VIP更新安排':'仅展示已公布的排播信息';
  const days=view.days.map(day=>{
    const shown=view.accountTier==='free'?day.vipRelease:day.release;
    const description=`${dateName(day.date)}${day.isToday?'，今天':''}，${shown?`${view.accountTier==='free'?'VIP预览，':''}${range(shown)}集，${shown.time}更新`:'排期待公布'}`;
    return `<button type="button" class="pc-day ${day.isToday?'is-today':''} ${day.date===view.selectedDate?'is-selected':''} ${day.outside?'is-outside':''} ${shown?'has-release':''}" data-date="${esc(day.date)}" aria-label="${esc(description)}" aria-pressed="${day.date===view.selectedDate}" ${day.outside?'disabled':''}><span class="pc-day__date">${day.isToday?'今':day.day}</span><span class="pc-day__episodes">${day.outside?'':range(shown)}${shown&&!day.outside&&view.mode==='week'?'<small>集</small>':''}</span><span class="pc-day__marker" aria-hidden="true">${day.outside?'':ornaments[day.date]||''}</span></button>`;
  }).join('');
  const upgrade=view.upgrade;
  const marketing=upgrade?`<h3>${view.accountTier==='free'?'开通VIP，解锁会员排期':`升级SVIP，今日多看${upgrade.extraEpisodes??0}集`}</h3><p>${upgrade.availableThrough?`今日可看至第${upgrade.availableThrough}集`:'了解会员专属更新安排'}</p><button type="button" class="pc-upgrade" data-action="membership">${view.accountTier==='free'?'开通VIP':'升级SVIP'} ${icon('chevron')}</button>`:`<h3>点映礼，抢先赴约大结局</h3><p>活动安排与参与资格，以官方公布为准</p><button type="button" class="pc-upgrade" data-action="event">查看活动 ${icon('chevron')}</button>`;
  return `<section class="pc-hero" aria-label="${esc(princessDrama.title)}主题主视觉"><div class="pc-hero__art" role="img" aria-label="尚公主原版人物海报"></div><div class="pc-hero__shade" aria-hidden="true"></div><div class="pc-hero__copy"><small>腾讯视频 · 追剧日历</small><h2>${esc(princessDrama.title)}</h2><p>当前${esc(tierName(view.accountTier))} · 会员每日18点更新</p></div></section>
    <div class="pc-contents">
    <button type="button" class="pc-ticket" data-action="ticket" aria-label="查看成长电子票，${esc(progress.current?.name||'初程票未解锁')}，已看${count}/${target}集"><span class="pc-ticket__icon">${icon('ticket')}</span><span class="pc-ticket__copy"><strong>${esc(progress.current?.name||'初程票')} · ${progress.current?'已收好':'待解锁'}</strong><span>${progress.next?`再看完${target-count}集，升级${esc(progress.next.name)}`:'典藏票已收好，珍藏这段追剧时光'}</span></span><span class="pc-ticket__count"><b>${count}</b><small> / ${target}</small></span><span class="pc-ticket__track" role="progressbar" aria-label="电子票观看进度" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${count}"><i style="width:${percent}%"></i></span></button>
    <section class="pc-calendar" data-mode="${view.mode}" aria-label="${esc(view.rangeLabel)}${view.mode==='week'?'周排期':'月排期'}">
      <div class="pc-calendar__top"><strong>追剧日历</strong><div class="pc-segment" aria-label="排期视图"><button type="button" data-mode="week" aria-pressed="${view.mode==='week'}">周</button><button type="button" data-mode="month" aria-pressed="${view.mode==='month'}">月</button></div></div>
      <div class="pc-period"><button type="button" data-period="-1" aria-label="上${view.mode==='week'?'一周':'个月'}">${icon('previous')}</button><span>${esc(view.rangeLabel)}</span><button type="button" data-period="1" aria-label="下${view.mode==='week'?'一周':'个月'}">${icon('next')}</button></div>
      ${view.accountTier==='free'?'<p class="pc-preview-note">VIP排期预览 · 观看权益以当前账号为准</p>':''}<div class="pc-weekdays" aria-hidden="true">${[...'一二三四五六日'].map(day=>`<span>周${day}</span>`).join('')}</div>
      <div class="${view.mode==='week'?'pc-week-grid':'pc-month-grid'}" aria-label="${view.accountTier==='free'?'VIP排期预览':esc(tierName(view.accountTier))+'排期'}">${days}</div>
      <div class="pc-today-summary"><strong>${esc(selectedTitle)}</strong><p>${esc(summary)} <button type="button" data-action="today">回到今天</button></p></div>
      ${queryOnly?(activities?`<div class="pc-query-activities">${activities}</div>`:''):continuation}
      ${desktopEntry?renderPrincessWidgetEntry(view,{previewed:Boolean(session.widgetPreviewed)}):''}
    </section>
    <section class="pc-marketing" aria-label="会员权益与活动">${marketing}${upgrade?'<button type="button" class="pc-event" data-action="event">点映礼活动安排 ›</button>':''}</section>
    <div class="pc-tools"><button type="button" data-action="reminder" aria-pressed="${Boolean(session.reminded)}">${icon(session.reminded?'check':'bell')}${session.reminded?'已开启提醒':'更新提醒'}</button>${desktopEntry?'':`<button type="button" data-action="desktop">${icon('share')}添加桌面</button>`}</div>
    <p class="pc-note">排期为截图演示 · 以官方实际播出为准</p>
    </div>`;
}

export function renderPrincessTicket(view,level=view.ticket.currentLevel||1){
  const selected=ticketLevels.find(item=>item.level===level)||ticketLevels[0];
  const unlocked=selected.level<=view.ticket.currentLevel;
  return `<div class="pc-ticket-levels" aria-label="电子票等级">${ticketLevels.map(item=>`<button type="button" data-ticket-level="${item.level}" aria-pressed="${item.level===selected.level}">${esc(item.name)}<small>前${item.episode}集 · ${item.level<=view.ticket.currentLevel?'已解锁':'未解锁'}</small></button>`).join('')}</div>
    <div class="pc-ticket-card ${unlocked?'':'is-locked'}"><div class="pc-ticket-card__art" role="img" aria-label="尚公主电子票票面"></div>${unlocked?'':'<span class="pc-ticket-card__lock" aria-label="未解锁">♙</span>'}<small>追剧纪念 · ${unlocked?'已获得':'票面预览'}</small><h3>${esc(princessDrama.title)}</h3><strong>${esc(selected.name)}</strong><p>${unlocked?'NO. SGZ-DEMO-001':`看完前${selected.episode}集自动解锁`}</p><span>追剧纪念票 · 非观影凭证</span></div>
    ${unlocked?`<button type="button" class="pc-primary" data-save-ticket="${selected.level}">保存电子票</button>`:'<p class="pc-note">继续看，属于你的票会自动升级</p>'}`;
}
