import {escapeHTML as esc,icon} from './calendar-concept-view.mjs';
import {princessDrama} from './princess-calendar-model.mjs';
import {renderPrincessWidgetEntry} from './princess-widget-entry.mjs';

const tierName=tier=>princessDrama.tiers[tier]||'非VIP';
const range=release=>!release?'—':release.from===release.to?String(release.from):`${release.from}–${release.to}`;
const dateName=date=>`${Number(date.slice(5,7))}月${Number(date.slice(8))}日`;
const ornaments={'2026-11-02':'🪨','2026-11-03':'🦌','2026-11-04':'🏹','2026-11-05':'🐟','2026-11-06':'🏮','2026-11-07':'📘','2026-11-08':'☂️'};
const validTier=tier=>Object.hasOwn(princessDrama.tiers,tier)?tier:'free';

export function renderPrincessRefineReminder(reminded=false){
  const active=Boolean(reminded);
  return `<button type="button" class="pcr-reminder" data-action="reminder" aria-pressed="${active}" aria-label="${active?'已开启更新提醒':'开启更新提醒'}">${icon(active?'check':'bell')}<span>${active?'已开启提醒':'更新提醒'}</span></button>`;
}

function renderTicket(progress){
  const target=progress.next?.episode||30;
  const count=progress.nextProgress?.watchedCount??progress.watchedCount;
  const percent=Math.min(100,count/target*100);
  return `<button type="button" class="pc-ticket" data-action="ticket" aria-label="查看成长电子票，${esc(progress.current?.name||'初程票未解锁')}，已看${count}/${target}集"><span class="pc-ticket__icon">${icon('ticket')}</span><span class="pc-ticket__copy"><strong>${esc(progress.current?.name||'初程票')} · ${progress.current?'已收好':'待解锁'}</strong><span>${progress.next?`再看完${target-count}集，升级${esc(progress.next.name)}`:'典藏票已收好，珍藏这段追剧时光'}</span></span><span class="pc-ticket__count"><b>${count}</b><small> / ${target}</small></span><span class="pc-ticket__track" role="progressbar" aria-label="电子票观看进度" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${count}"><i style="width:${percent}%"></i></span></button>`;
}

function renderMarketing(marketing){
  if(!marketing)return '';
  if(marketing.kind==='none')return `<section class="pcr-rules" aria-label="排播更新说明"><h3>${esc(marketing.title)}</h3><p>${esc(marketing.subtitle)}</p></section>`;
  const tier=validTier(marketing.tier);
  const action=marketing.kind==='preview'?`data-action="preview-membership" data-preview-tier="${tier}"`:`data-action="membership" data-target-tier="${tier}"`;
  return `<section class="pc-marketing pcr-marketing" aria-label="会员排期与权益"><div class="pcr-marketing__copy"><h3>${esc(marketing.title)}</h3><p>${esc(marketing.subtitle)}</p></div><button type="button" class="pc-upgrade" ${action}>${esc(marketing.cta)} ${icon('chevron')}</button></section>`;
}

/** The calendar projection is presentational only. Root ticket and widget data
 * always retain the actual account, history and entitlement selected by model. */
export function renderPrincessRefineContent(view,session){
  const schedule=view.schedule||view;
  const previewTier=validTier(view.previewTier??schedule.accountTier);
  const selected=schedule.days.find(day=>day.date===schedule.selectedDate);
  const activities=selected?.activities.map(activity=>`<button type="button" class="pc-extra" data-action="extra">${esc(activity.title)} · ${esc(activity.time)} ${icon('chevron')}</button>`).join('')||'';
  const days=schedule.days.map(day=>{
    const shown=day.release;
    const description=`${dateName(day.date)}${day.isToday?'，今天':''}，${shown?`${range(shown)}集`:'排期待公布'}`;
    return `<button type="button" class="pc-day ${day.isToday?'is-today':''} ${day.date===schedule.selectedDate?'is-selected':''} ${day.outside?'is-outside':''} ${shown?'has-release':''}" data-date="${esc(day.date)}" aria-label="${esc(description)}" aria-pressed="${day.date===schedule.selectedDate}" ${day.outside?'disabled':''}><span class="pc-day__date">${day.isToday?'今':day.day}</span><span class="pc-day__episodes">${day.outside?'':range(shown)}${shown&&!day.outside&&schedule.mode==='week'?'<small>集</small>':''}</span><span class="pc-day__marker" aria-hidden="true">${day.outside||!shown?'':ornaments[day.date]||''}</span></button>`;
  }).join('');
  const previewHint=view.isPreview?`<p class="pcr-preview-hint">当前为${esc(tierName(view.accountTier))}，仅预览${esc(tierName(previewTier))}排期，不改变观看权益</p>`:'';
  return `<section class="pc-hero" aria-label="尚公主主题主视觉"><div class="pc-hero__art" role="img" aria-label="尚公主原版人物海报"></div><div class="pc-hero__shade" aria-hidden="true"></div><div class="pc-hero__copy"><small>腾讯视频 · 追剧日历</small><h2>尚公主</h2></div>${renderPrincessRefineReminder(session.reminded)}</section>
    <div class="pc-contents">
      ${renderTicket(view.ticket)}
      <section class="pc-calendar" data-mode="${schedule.mode}" aria-label="${esc(schedule.rangeLabel)}${schedule.mode==='week'?'周排期':'月排期'}">
        <div class="pc-calendar__top"><strong>追剧日历</strong><label class="pcr-tier-select"><span class="pcr-sr-only">切换会员排期</span><select aria-label="切换会员排期" data-preview-tier>${['vip','svip','free'].map(tier=>`<option value="${tier}"${previewTier===tier?' selected':''}>${esc(tierName(tier))}排期</option>`).join('')}</select>${icon('chevron')}</label><div class="pc-segment" aria-label="排期视图"><button type="button" data-mode="week" aria-pressed="${schedule.mode==='week'}">周</button><button type="button" data-mode="month" aria-pressed="${schedule.mode==='month'}">月</button></div></div>
        ${previewHint}
        <div class="pc-period"><button type="button" data-period="-1" aria-label="上${schedule.mode==='week'?'一周':'个月'}">${icon('previous')}</button><span>${esc(schedule.rangeLabel)}</span><button type="button" data-period="1" aria-label="下${schedule.mode==='week'?'一周':'个月'}">${icon('next')}</button></div>
        <div class="pc-weekdays" aria-hidden="true">${[...'一二三四五六日'].map(day=>`<span>周${day}</span>`).join('')}</div>
        <div class="pcr-schedule-grid" data-mode="${schedule.mode}"><div class="${schedule.mode==='week'?'pc-week-grid':'pc-month-grid'}" aria-label="${esc(tierName(previewTier))}排期">${days}</div>${previewTier==='free'?'<p class="pcr-free-schedule-note">免费排期待公布</p>':''}</div>
        ${activities?`<div class="pc-query-activities">${activities}</div>`:''}
        ${renderPrincessWidgetEntry(view,{previewed:Boolean(session.widgetPreviewed)})}
      </section>
      ${renderMarketing(view.marketing)}
      <p class="pc-note pcr-footer-note">截图排期演示 · 非实时数据 · 以官方实际播出为准</p>
    </div>`;
}
