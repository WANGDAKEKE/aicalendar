import {APPLE_PREVIEW} from './ios-preview-v3.mjs';
import {episodeLabel,shortDate} from './calendar-model.mjs';

export const CONCEPT_STYLES = Object.freeze([
  Object.freeze({id:'clean',name:'A · 清爽月历',caption:'贴近会员月历，信息优先'}),
  Object.freeze({id:'paper',name:'B · 纸上长安',caption:'会员月历比例，保留纸感氛围'}),
  Object.freeze({id:'playful',name:'C · 荔枝手帐',caption:'轻贴纸氛围，偏运营表达'}),
  Object.freeze({id:'ip',name:'D · 荔枝赴长安',caption:'强 IP 主视觉，纸上长安的月历主体'}),
  Object.freeze({id:'skin',name:'E · 长安绮卷',caption:'整页红金主题皮肤，同一套月历比例'}),
]);

export function selectConceptStyles({style,compare,all}={}){
  const single=CONCEPT_STYLES.find(item=>item.id===style);
  if(single)return [single];
  const ids=typeof compare==='string'?compare.split(',').map(id=>id.trim()):[];
  const comparison=[...new Set(ids)].map(id=>CONCEPT_STYLES.find(item=>item.id===id)).filter(Boolean);
  if(comparison.length>=2)return comparison;
  return all==='1'?[...CONCEPT_STYLES]:['clean','paper','ip'].map(id=>CONCEPT_STYLES.find(item=>item.id===id));
}
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={
  back:'<path d="m14.5 5-7 7 7 7"/>',
  previous:'<path d="m14.5 5-7 7 7 7M8 12h12"/>',
  next:'<path d="m9.5 5 7 7-7 7M16 12H4"/>',
  chevron:'<path d="m10 7 5 5-5 5"/>',
  moon:'<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  share:'<path d="M12 15V3m-4 4 4-4 4 4M7 11H5v10h14V11h-2"/>',
  ticket:'<path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V6Z"/><path d="M9 6v2m0 3v2m0 3v2"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-2 7-2 9h16c0-2-2-2-2-9ZM10 21h4"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  play:'<path d="m9 5 11 7-11 7V5Z"/>',
  check:'<path d="m5 12 4.5 4.5L19 7"/>',
};
export function icon(name,classes=''){
  return `<svg class="cc-icon ${escapeHTML(classes)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${Object.hasOwn(paths,name)?paths[name]:paths.chevron}</svg>`;
}

function renderStatus(){
  return `<div class="cc-status" aria-hidden="true"><span>19:00</span><div><svg viewBox="0 0 18 13" fill="currentColor"><rect y="8" width="3" height="5" rx=".8"/><rect x="5" y="5.5" width="3" height="7.5" rx=".8"/><rect x="10" y="3" width="3" height="10" rx=".8"/><rect x="15" width="3" height="13" rx=".8"/></svg><svg viewBox="0 0 17 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M1 4.5a11 11 0 0 1 15 0M3.7 7.3a7 7 0 0 1 9.6 0M6.4 10a3.2 3.2 0 0 1 4.2 0"/><circle cx="8.5" cy="12" r=".8" fill="currentColor" stroke="none"/></svg><svg viewBox="0 0 29 14" fill="currentColor"><rect x=".7" y=".7" width="24" height="12.6" rx="3.3" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-width="1.2"/><rect x="2.6" y="2.6" width="20.2" height="8.8" rx="1.6"/><path d="M26.5 4.5V9.5Q29.5 9 29.5 7T26.5 4.5" fill-opacity=".4"/></svg></div></div>`;
}

export function renderConceptDay(cell,view,session){
  const release=cell.release,watching=cell.watching;
  const milestone=cell.outside?null:release?.milestone;
  const state={watched:'已全部看完',partial:'部分已看',unwatched:'还未观看',upcoming:'待更新',none:'无更新'}[watching.status];
  const description=`${shortDate(cell.date)}${cell.date===view.today?'，今天':''}，${release?`${release.time} 更新${episodeLabel(release)}，${state}`:'无更新'}${watching.status==='partial'?`，已看 ${release.to-release.from+1-watching.pendingEpisodes.length}/${release.to-release.from+1} 集`:''}${cell.ops.events.length?'，点映礼活动':''}`;
  const isEmoji=cell.hint&&!/[\u4e00-\u9fff]/u.test(cell.hint);
  const compact=cell.outside?'':watching.status==='partial'?`${release.to-release.from+1-watching.pendingEpisodes.length}/${release.to-release.from+1}`:watching.status==='watched'?'✓':watching.status==='unwatched'?'待':isEmoji?cell.hint:cell.hint==='点映礼'?'礼':cell.hint==='完结'?'完':cell.hint==='开播'?'首':'';
  const range=release&&!cell.outside?(release.from===release.to?String(release.from):`${release.from}–${release.to}`):'';
  return `<button type="button" class="cc-day is-${escapeHTML(watching.status)} ${release?'has-release':''} ${milestone==='premiere'?'is-premiere':''} ${milestone==='finale'?'is-finale':''} ${cell.date===view.today?'is-today':''} ${cell.outside?'is-outside':''} ${session.selectedDate===cell.date?'is-selected':''}" data-date="${escapeHTML(cell.date)}" aria-label="${escapeHTML(description)}" aria-pressed="${session.selectedDate===cell.date}" ${cell.date===view.today?'aria-current="date"':''} ${cell.outside?'disabled':''}><span class="cc-day__number">${cell.day}</span><span data-compact-range="${escapeHTML(range)}" class="cc-day__episodes">${release&&!cell.outside?episodeLabel(release):''}</span><span data-compact="${escapeHTML(compact)}" class="cc-day__hint ${isEmoji?'is-emoji':''}" ${isEmoji?'aria-hidden="true"':''}>${!cell.outside?escapeHTML(cell.hint):''}</span></button>`;
}

export function renderConceptContent(drama,view,session,{style='clean'}={}){
  const ticket=view.ticket;
  const target=ticket.next?.episode||drama.totalEpisodes;
  const count=ticket.nextProgress?.watchedCount??ticket.watchedCount;
  const percent=Math.min(100,Math.round(count/target*100));
  const [year,month]=view.month.split('-');
  const accountName=drama.tiers[session.accountTier];
  const summary=view.summary;
  const current=summary.todayRelease;
  const lead=view.month!==view.today.slice(0,7)?`今日可看至第 ${summary.available} 集`:current?`${current.time} ${current.to<=summary.available?'已更新':'更新'} ${episodeLabel(current)}`:summary.next?`下次 ${shortDate(summary.next.date)}更新`:'全剧已更新';
  const targetTier=session.previewTier==='svip'&&view.context.requiresUpgrade?'svip':session.accountTier==='free'?'vip':session.accountTier==='vip'?'svip':null;
  const targetAvailable=targetTier?Math.max(0,...drama.scheduleByTier[targetTier].filter(r=>Date.parse(`${r.date}T${r.time}:00+08:00`)<=Date.parse(session.now)).map(r=>r.to)):0;
  const extra=Math.max(0,targetAvailable-view.context.account.available);
  const marketing=targetTier?`<button type="button" class="cc-marketing" data-upgrade="${targetTier}"><span><strong>${session.accountTier==='free'?'开通':'升级'} ${drama.tiers[targetTier]}${extra?`，今天多看 ${extra} 集`:''}</strong><span>今日可看到第 ${targetAvailable} 集 · 了解会员权益</span></span>${icon('chevron')}</button>`:`<button type="button" class="cc-marketing" data-action="screening"><span><strong>长安之约 · 大结局点映礼</strong><span>查看活动安排与独立参与资格</span></span>${icon('chevron')}</button>`;
  const story=style==='ip'
    ? `<section class="cc-ip-hero" aria-label="${escapeHTML(drama.title)}主题追剧日历"><img class="cc-ip-hero__poster" src="./assets/calendar-art.png" alt="${escapeHTML(drama.title)}人物与荔枝树主视觉"><div class="cc-ip-hero__veil" aria-hidden="true"></div><div class="cc-ip-hero__copy"><p class="cc-ip-hero__eyebrow">腾讯视频 / 追剧日历</p><h2>${escapeHTML(drama.title)}</h2><p class="cc-ip-hero__meta">全 ${drama.totalEpisodes} 集 <span>·</span> 当前 ${escapeHTML(accountName)}</p></div><span class="cc-ip-hero__seal" aria-hidden="true">荔</span><span class="cc-ip-hero__folio" aria-hidden="true">一颗荔枝，一路长安</span></section>`
    : style==='skin'
    ? `<section class="cc-skin-hero" aria-label="${escapeHTML(drama.title)}主题追剧日历"><img class="cc-skin-hero__poster" src="./assets/calendar-art.png" alt="${escapeHTML(drama.title)}人物与荔枝树主视觉"><div class="cc-skin-hero__copy"><p class="cc-skin-hero__eyebrow">腾讯视频 · 追剧日历</p><h2>${escapeHTML(drama.title)}</h2><p class="cc-skin-hero__meta">全 ${drama.totalEpisodes} 集 <span>·</span> 当前 ${escapeHTML(accountName)}</p></div></section>`
    : `<section class="cc-story" aria-label="剧集信息"><img class="cc-story__art" src="./assets/calendar-art.png" alt="长安的荔枝剧集海报"><div class="cc-story__copy"><p class="cc-eyebrow">TENCENT VIDEO · 追剧日历</p><h2>${escapeHTML(drama.title)}</h2><p class="cc-story__meta">全 ${drama.totalEpisodes} 集 <span>·</span> 当前 ${escapeHTML(accountName)}</p></div><span class="cc-story__flourish" aria-hidden="true">荔</span></section>`;
  return `${story}
    <button type="button" class="cc-ticket" data-action="ticket" aria-label="查看成长电子票，${ticket.current?.name||'初程票未解锁'}，已看${count}/${target}集"><span class="cc-ticket__icon">${icon('ticket')}</span><span class="cc-ticket__copy"><strong>${ticket.current?`${ticket.current.name} · 已收好`:'你的第一张电子票'}</strong><span>${ticket.next?`看完前 ${target} 集${ticket.current?'升级':'解锁'}`:'典藏票已解锁，可保存纪念'}</span></span><span class="cc-ticket__count">${count}<small> / ${target}</small></span>${icon('chevron')}<span class="cc-ticket__track" role="progressbar" aria-label="电子票观看进度" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${count}"><i style="width:${percent}%"></i></span></button>
    <section class="cc-calendar" style="--cc-rows:${view.rows}" aria-label="${year}年${Number(month)}月更新排期"><div class="cc-monthbar"><button type="button" data-month="-1" aria-label="上个月">${icon('previous')}</button><h3>${year}年${Number(month)}月</h3><button type="button" data-month="1" aria-label="下个月">${icon('next')}</button></div><div class="cc-tierbar"><select aria-label="预览会员排期"><option value="vip" ${session.previewTier==='vip'?'selected':''}>VIP 排期</option><option value="svip" ${session.previewTier==='svip'?'selected':''}>SVIP 排期</option><option value="free" ${session.previewTier==='free'?'selected':''}>非VIP 排期</option></select><span>${escapeHTML(lead)}</span><button type="button" data-action="today">今天</button></div><div class="cc-weekdays" aria-hidden="true">${[...'一二三四五六日'].map(day=>`<span>${day}</span>`).join('')}</div><div class="cc-grid">${view.cells.map(cell=>renderConceptDay(cell,view,session)).join('')}</div></section>
    ${marketing}<button type="button" class="cc-reminder" data-action="reminder" aria-pressed="${session.reminded}">${icon(session.reminded?'check':'bell')} ${session.reminded?'已开启更新提醒':'更新时提醒我'}</button><p class="cc-disclaimer">演示排期 · 如有调整，以实际播出为准</p>`;
}

export function renderConceptFrame(style,theme='light'){
  const safeStyle=CONCEPT_STYLES.find(item=>item.id===style)?.id||'clean';
  const base=['ip','skin'].includes(safeStyle)?'paper':safeStyle;
  const layout=['paper','skin'].includes(safeStyle)?' data-calendar-layout="figma"':'';
  return `<div class="cc-device-wrap"><div class="cc-device"><div class="cc-app" data-style="${safeStyle}" data-theme="${theme==='dark'?'dark':'light'}" data-calendar-base="${base}"${layout} aria-label="追剧日历手机界面">${renderStatus()}<div class="cc-main"><header class="cc-nav"><button type="button" data-action="drama" aria-label="返回剧集详情">${icon('back')}</button><h1>追剧日历</h1><span class="cc-nav__actions">${safeStyle==='clean'?`<button type="button" data-action="theme" aria-label="${theme==='dark'?'切换浅色外观':'切换深色外观'}">${icon(theme==='dark'?'sun':'moon')}</button>`:''}<button type="button" data-action="share" aria-label="分享本地方案">${icon('share')}</button></span></header><div class="cc-scroll"><div class="cc-content"></div></div></div><div class="cc-layer" hidden><section class="cc-sheet" role="dialog" aria-modal="true"><header><div><small class="cc-sheet__eyebrow"></small><h2></h2></div><button type="button" data-action="close" aria-label="关闭面板">${icon('close')}</button></header><div class="cc-sheet__body"></div></section></div><div class="cc-toast" role="status" hidden></div><span class="cc-home-indicator" aria-hidden="true"></span></div><img class="cc-bezel" src="${APPLE_PREVIEW.asset}" alt="" width="1359" height="2736" decoding="async"></div></div>`;
}
