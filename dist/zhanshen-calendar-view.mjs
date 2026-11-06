import {escapeHTML as esc,icon} from './calendar-concept-view.mjs';
import {renderCalendarPosterWidget} from './calendar-poster-widget.mjs';
import {animeTicketLevels} from './zhanshen-calendar-model.mjs';

const dateName=date=>`${Number(date.slice(5,7))}月${Number(date.slice(8))}日`;
const range=event=>event.from===event.to?`${event.from}集`:`${event.from}–${event.to}集`;
const markers={diamond:'✦',star:'★',ghost:'✧',crown:'♛',lock:'⌑'};
const lockIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3"/><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M12 14v3"/></svg>';

function widgetMarkup(size='wide',interactive=false,mini=false){
  // Appearance only: the user's real cross-title history and playback are not
  // inferred from a promotional free-access calendar.
  return renderCalendarPosterWidget({ip:'zhanshen',title:'斩神Ⅱ',size,mini,interactive,
    action:'widget-calendar',eyebrow:'每周四限免更新',headline:'追番日程，一眼看到',
    context:'限免更新 · 回锁安排',actionLabel:'看排期'});
}

export function renderZhanshenWidgetEntry({previewed=false}={}){
  return `<section class="pc-desktop-entry" aria-label="追剧搭子桌面小组件"><span class="pc-widget-mini cpw-mini-wrap" aria-hidden="true">${widgetMarkup('wide',false,true)}</span><span class="pc-desktop-entry__copy"><strong>把追剧搭子放到桌面</strong><span>桌面看更新，不错过追番日</span></span><button type="button" class="pc-desktop-entry__action" data-action="desktop" aria-label="${previewed?'查看':'预览添加'}追剧搭子桌面小组件">${previewed?'查看':'添加'}</button></section>`;
}

export function renderZhanshenContent(view,session){
  const ticket=view.ticket,target=ticket.next?.episode??ticket.current?.episode??3;
  const count=ticket.progressCount;
  const selected=view.days.find(day=>day.date===view.selectedDate);
  const event=selected?.event;
  const selectedTitle=event?`${dateName(event.date)} · ${event.kind==='relock'?'回锁会员':'限免上新'} ${range(event)}`:`${dateName(view.selectedDate)} · 暂无新增限免安排`;
  const selectedNote=event?.kind==='relock'?'第2–15集恢复会员权益，具体生效时间以实际规则为准。':event?'每周四限免更新，具体上线时刻以实际规则为准。':'可切换日期查看已公布的限免批次。';
  const days=view.days.map(day=>{
    const item=day.event;
    const description=`${dateName(day.date)}${day.isToday?'，今天':''}，${day.outside?'非本月日期':item?`${item.kind==='relock'?'回锁会员':'限免上新'}${range(item)}`:'暂无新增限免安排'}`;
    return `<button type="button" class="zs-day ${day.isToday?'is-today':''} ${day.date===view.selectedDate?'is-selected':''} ${day.outside?'is-outside':''} ${item?'has-event':''} ${item?.kind==='relock'?'is-relock':''}" data-date="${esc(day.date)}" aria-pressed="${day.date===view.selectedDate}" aria-label="${esc(description)}" ${day.outside?'disabled':''}><span class="zs-day__date">${day.isToday?'今':day.day}</span><span class="zs-day__event">${item?`<small>${item.kind==='relock'?'回锁':'限免'}</small><b>${range(item)}</b>`:'<span aria-hidden="true">—</span>'}</span><span class="zs-day__marker" aria-hidden="true">${item?markers[item.accent]||'✦':''}</span></button>`;
  }).join('');
  return `<section class="zs-hero" aria-label="斩神Ⅱ原运营主视觉"><div class="zs-hero__art" role="img" aria-label="斩神Ⅱ蓝紫色原版人物海报"></div><div class="zs-hero__copy"><small>腾讯视频 · 追番日历</small><h2>斩神<span>Ⅱ</span></h2><p>凡尘神域 · 每周四限免更新</p></div></section>
    <div class="zs-contents">
      <button type="button" class="zs-ticket" data-action="ticket" aria-label="成长电子票，${esc(ticket.current?.name||'初程票未解锁')}，演示观看进度${count}/${target}集"><span class="zs-ticket__icon">${icon('ticket')}</span><span class="zs-ticket__copy"><strong>${esc(ticket.current?.name||'初程票')} · ${ticket.current?'已收好':'待解锁'}</strong><span>${ticket.next?`追番纪念 · 下一站${esc(ticket.next.name)}`:'追番纪念 · 珍藏守夜时光'}</span></span><span class="zs-ticket__count"><b>${count}</b><small> / ${target}</small></span><span class="zs-ticket__track" role="progressbar" aria-label="电子票观看进度" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${count}"><i style="width:${Math.min(100,count/target*100)}%"></i></span></button>
      <section class="zs-calendar" aria-label="${esc(view.dateLabel)}限免排期" data-mode="${view.mode}">
        <div class="zs-calendar__top"><strong>限免日历</strong><div class="pc-segment" aria-label="排期视图"><button type="button" data-mode="week" aria-pressed="${view.mode==='week'}">周</button><button type="button" data-mode="month" aria-pressed="${view.mode==='month'}">月</button></div></div>
        <div class="zs-period"><button type="button" data-period="-1" aria-label="上${view.mode==='week'?'一周':'个月'}">${icon('previous')}</button><span>${esc(view.dateLabel)}</span><button type="button" data-period="1" aria-label="下${view.mode==='week'?'一周':'个月'}">${icon('next')}</button></div>
        <div class="zs-weekdays" aria-hidden="true">${[...'一二三四五六日'].map(day=>`<span>周${day}</span>`).join('')}</div>
        <div class="zs-${view.mode==='week'?'week':'month'}-grid">${days}</div>
        <div class="zs-selection"><strong>${esc(selectedTitle)}</strong><p>${esc(selectedNote)}</p></div>
        <div class="zs-rule"><strong>${lockIcon}12月3日 · 第2–15集回锁会员</strong><p>10月29日起，每周四限免更新</p></div>
        ${renderZhanshenWidgetEntry({previewed:Boolean(session.widgetPreviewed)})}
      </section>
      <section class="zs-marketing" aria-label="会员权益"><h3>限免之后，会员接着追</h3><p>了解后续观看权益与会员活动</p><button type="button" class="zs-upgrade" data-action="membership">了解会员 ${icon('chevron')}</button></section>
      <div class="zs-tools"><button type="button" data-action="reminder" aria-pressed="${Boolean(session.reminded)}">${icon(session.reminded?'check':'bell')}${session.reminded?'已关注限免日':'限免更新提醒'}</button></div><p class="zs-note">截图排期演示 · 非实时数据 · 以实际播出与权益为准</p>
    </div>`;
}

export function renderZhanshenTicket(view,level=view.ticket.currentLevel||1){
  const selected=animeTicketLevels.find(item=>item.level===level)||animeTicketLevels[0];
  const unlocked=selected.level<=view.ticket.currentLevel;
  return `<div class="zs-ticket-levels" aria-label="成长电子票等级">${animeTicketLevels.map(item=>`<button type="button" data-ticket-level="${item.level}" aria-pressed="${item.level===selected.level}">${esc(item.name)}<small>前${item.episode}集 · ${item.level<=view.ticket.currentLevel?'已解锁':'未解锁'}</small></button>`).join('')}</div><div class="zs-ticket-card ${unlocked?'':'is-locked'}"><div class="zs-ticket-card__art" role="img" aria-label="斩神Ⅱ纪念票原版人物海报"></div>${unlocked?'':'<span class="pc-ticket-card__lock" aria-label="未解锁"></span>'}<small>追番纪念 · ${unlocked?'已获得':'票面预览'}</small><h3>斩神Ⅱ</h3><strong>${esc(selected.name)}</strong><p>${unlocked?'NO. ZS-DEMO-001':`看完前${selected.episode}集解锁`}</p><span>纪念票 · 不代表播放或活动资格</span></div>${unlocked?`<button type="button" class="pc-primary" data-save-ticket="${selected.level}">保存电子票</button>`:''}<p class="zs-note">3／9／15集成长门槛为本地提案，非官方奖励规则</p>`;
}

export function renderZhanshenWidgetSetup({stage='setup',size='wide'}={}){
  const actualSize=size==='square'?'square':'wide';
  if(stage==='desktop')return `<div class="pc-widget-setup"><div class="pc-widget-home" aria-label="桌面效果预览"><div class="pc-widget-home__heading" aria-hidden="true"><span>19:00</span><span>主屏幕</span></div><div class="pc-widget-display pc-widget-home__slot" data-size="${actualSize}">${widgetMarkup(actualSize,true)}</div><span class="pc-widget-home__label">腾讯视频</span></div><p class="pc-widget-setup__caption">点一下小组件，体验回到追剧日历</p><p class="pc-widget-setup__note">本地效果预览，未安装系统组件</p><button type="button" class="pc-widget-setup__secondary" data-action="close">返回日历</button></div>`;
  return `<div class="pc-widget-setup"><div class="pc-widget-sizes" role="group" aria-label="小组件样式"><button type="button" data-widget-size="wide" aria-pressed="${actualSize==='wide'}">横版</button><button type="button" data-widget-size="square" aria-pressed="${actualSize==='square'}">方形</button></div><div class="pc-widget-preview-surface"><div class="pc-widget-display" data-size="${actualSize}">${widgetMarkup(actualSize)}</div></div><p class="pc-widget-setup__caption">根据最近观看更新，不限于《斩神Ⅱ》</p><button type="button" class="pc-widget-setup__primary" data-action="confirm-desktop">预览桌面效果</button><p class="pc-widget-setup__note">IP海报效果示意，未接入真实跨剧观看历史</p></div>`;
}
