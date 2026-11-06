import {escapeHTML as esc,icon} from './calendar-concept-view.mjs';
import {renderZhanshenWidgetEntry} from './zhanshen-calendar-view.mjs';

const dateName=date=>`${Number(date.slice(5,7))}月${Number(date.slice(8))}日`;
const range=event=>event.from===event.to?`${event.from}集`:`${event.from}–${event.to}集`;
const markers=Object.freeze({diamond:'✦',star:'★',ghost:'✧',crown:'♛',lock:'⌑'});

export function renderZhanshenRefineReminder(reminded=false){
  const active=Boolean(reminded);
  return `<button type="button" class="zsr-reminder" data-action="reminder" aria-pressed="${active}" aria-label="${active?'已开启更新提醒':'开启更新提醒'}">${icon(active?'check':'bell')}<span>${active?'已开启提醒':'更新提醒'}</span></button>`;
}

function renderTicket(ticket){
  const target=ticket.next?.episode??ticket.current?.episode??3;
  const count=ticket.progressCount;
  return `<button type="button" class="zs-ticket" data-action="ticket" aria-label="成长电子票，${esc(ticket.current?.name||'初程票未解锁')}，演示观看进度${esc(count)}/${esc(target)}集"><span class="zs-ticket__icon">${icon('ticket')}</span><span class="zs-ticket__copy"><strong>${esc(ticket.current?.name||'初程票')} · ${ticket.current?'已收好':'待解锁'}</strong><span>${ticket.next?`追番纪念 · 下一站${esc(ticket.next.name)}`:'追番纪念 · 珍藏守夜时光'}</span></span><span class="zs-ticket__count"><b>${esc(count)}</b><small> / ${esc(target)}</small></span><span class="zs-ticket__track" role="progressbar" aria-label="电子票观看进度" aria-valuemin="0" aria-valuemax="${esc(target)}" aria-valuenow="${esc(count)}"><i style="width:${Math.min(100,count/target*100)}%"></i></span></button>`;
}

function renderMarketing(marketing){
  if(!marketing)return '';
  if(marketing.kind==='none')return `<section class="zsr-rules" aria-label="限免与会员排播说明"><h3>${esc(marketing.title)}</h3><p>${esc(marketing.subtitle)}</p></section>`;
  const target=marketing.tier==='svip'?'svip':'vip';
  return `<section class="zs-marketing zsr-marketing" aria-label="会员权益与排播说明"><div class="zsr-marketing__copy"><h3>${esc(marketing.title)}</h3><p>${esc(marketing.subtitle)}</p></div><button type="button" class="zs-upgrade" data-action="membership" data-target-tier="${target}">${esc(marketing.cta)} ${icon('chevron')}</button></section>`;
}

/** The supplied campaign calendar is shared by every account. Actual identity
 * still owns ticket history and membership actions, never playback access. */
export function renderZhanshenRefineContent(view,session){
  const schedule=view.schedule||view;
  const days=schedule.days.map(day=>{
    const event=day.event;
    const description=`${dateName(day.date)}${day.isToday?'，今天':''}，${day.outside?'非本月日期':event?`${event.kind==='relock'?'回锁会员':'限免上新'}${range(event)}${event.isSeasonFree?'，全季免费':''}`:'暂无新增限免安排'}`;
    return `<button type="button" class="zs-day ${day.isToday?'is-today':''} ${day.date===schedule.selectedDate?'is-selected':''} ${day.outside?'is-outside':''} ${event?'has-event':''} ${event?.kind==='relock'?'is-relock':''} ${event?.isSeasonFree?'is-season-free':''}" data-date="${esc(day.date)}" aria-pressed="${day.date===schedule.selectedDate}" aria-label="${esc(description)}" ${day.outside?'disabled':''}><span class="zs-day__date">${day.isToday?'今':esc(day.day)}</span><span class="zs-day__event">${event?`<small${event.isSeasonFree?' class="zsr-season-badge"':''}>${event.isSeasonFree?'全季免费':event.kind==='relock'?'回锁':'限免'}</small><b>${esc(range(event))}</b>`:'<span aria-hidden="true">—</span>'}</span><span class="zs-day__marker" aria-hidden="true">${event&&!event.isSeasonFree?(Object.hasOwn(markers,event.accent)?markers[event.accent]:'✦'):''}</span></button>`;
  }).join('');
  return `<section class="zs-hero" aria-label="斩神Ⅱ原运营主视觉"><div class="zs-hero__art" role="img" aria-label="斩神Ⅱ蓝紫色原版人物海报"></div><div class="zs-hero__copy"><small>腾讯视频 · 追番日历</small><h2>斩神<span>Ⅱ</span></h2></div>${renderZhanshenRefineReminder(session.reminded)}</section>
    <div class="zs-contents">
      ${renderTicket(view.ticket)}
      <section class="zs-calendar" aria-label="${esc(schedule.dateLabel)}限免排期" data-mode="${esc(schedule.mode)}">
        <div class="zs-calendar__top"><strong>限免日历</strong><span class="zsr-campaign-badge">限免活动</span><div class="pc-segment" aria-label="排期视图"><button type="button" data-mode="week" aria-pressed="${schedule.mode==='week'}">周</button><button type="button" data-mode="month" aria-pressed="${schedule.mode==='month'}">月</button></div></div>
        <div class="zs-period"><button type="button" data-period="-1" aria-label="上${schedule.mode==='week'?'一周':'个月'}">${icon('previous')}</button><span>${esc(schedule.dateLabel)}</span><button type="button" data-period="1" aria-label="下${schedule.mode==='week'?'一周':'个月'}">${icon('next')}</button></div>
        <div class="zs-weekdays" aria-hidden="true">${[...'一二三四五六日'].map(day=>`<span>周${day}</span>`).join('')}</div>
        <div class="zsr-schedule-grid" data-mode="${esc(schedule.mode)}"><div class="zs-${schedule.mode==='week'?'week':'month'}-grid">${days}</div></div>
        ${renderZhanshenWidgetEntry({previewed:Boolean(session.widgetPreviewed)})}
      </section>
      ${renderMarketing(view.marketing)}
      <p class="zs-note zsr-footer-note">截图排期演示 · 非实时数据 · 以实际播出与权益为准</p>
    </div>`;
}
