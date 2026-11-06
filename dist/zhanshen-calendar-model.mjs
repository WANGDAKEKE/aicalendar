import {dateKey,parseDate,weekday,monthCells,shiftMonth} from './calendar-model.mjs';
import {getTicketProgress} from './ticket-model.mjs';

const DEFAULT_TODAY='2026-11-05';
const DEMO_HISTORY_LIMIT=15;
const freeze=value=>{
  if(value&&typeof value==='object'){
    for(const child of Object.values(value))freeze(child);
    Object.freeze(value);
  }
  return value;
};

// These are proposed local-demo reward targets, not an official campaign rule.
export const animeTicketLevels=freeze([
  {level:1,episode:3,name:'初程票',finish:'paper'},
  {level:2,episode:9,name:'同行票',finish:'foil'},
  {level:3,episode:15,name:'典藏票',finish:'holo'},
]);

// The supplied artwork describes dates and episode batches, but no clock time,
// VIP/SVIP schedule, first-episode entitlement or playback authorization.
export const zhanshenAnime=freeze({
  id:'zhanshen-2',title:'斩神Ⅱ',timeZone:'Asia/Shanghai',demoOnly:true,
  knownPeriod:{from:'2026-10-29',to:'2026-12-03'},
  updateWeekday:'周四',updateTime:null,
  scheduleNote:'仅展示运营截图公布的限免批次及回锁日期；具体更新时间、会员排播和第1集权益未提供，不作播放授权判断。',
  historyNote:'观看历史为本地演示数据，与限免排期及会员权益无关。',
  ticketRuleNote:'电子票3／9／15集为本地交互提案，非官方活动规则。',
  events:[
    {id:'free-20261029',date:'2026-10-29',kind:'free',from:2,to:3,time:null,label:'限免2–3集',title:'结业大考',accent:'diamond'},
    {id:'free-20261105',date:'2026-11-05',kind:'free',from:4,to:6,time:null,label:'限免4–6集',title:'极限救援',accent:'diamond'},
    {id:'free-20261112',date:'2026-11-12',kind:'free',from:7,to:9,time:null,label:'限免7–9集',title:'夜神降临',accent:'star'},
    {id:'free-20261119',date:'2026-11-19',kind:'free',from:10,to:12,time:null,label:'限免10–12集',title:'劫机事件',accent:'ghost'},
    {id:'free-20261126',date:'2026-11-26',kind:'free',from:13,to:15,time:null,label:'限免13–15集',title:'沧南神战',accent:'crown',isSeasonFree:true},
    {id:'relock-20261203',date:'2026-12-03',kind:'relock',from:2,to:15,time:null,label:'2–15集回锁会员',title:'限免结束',accent:'lock'},
  ],
});

const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)
  &&Number.isFinite(parseDate(value).getTime())&&dateKey(parseDate(value))===value;
const validMonth=value=>typeof value==='string'&&/^\d{4}-(?:0[1-9]|1[0-2])$/.test(value)&&validDate(`${value}-01`);

function addDays(date,amount){
  const next=parseDate(date);
  next.setUTCDate(next.getUTCDate()+amount);
  return dateKey(next);
}

function monday(date){
  return addDays(date,-((parseDate(date).getUTCDay()+6)%7));
}

function history(value){
  const episodes=value instanceof Set||Array.isArray(value)?[...value]:[];
  return new Set(episodes.filter(episode=>Number.isSafeInteger(episode)&&episode>0&&episode<=DEMO_HISTORY_LIMIT));
}

function normalizeSession(input={}){
  const source=input&&typeof input==='object'?input:{};
  const today=validDate(source.today)?source.today:DEFAULT_TODAY;
  return {
    today,mode:source.mode==='month'?'month':'week',
    weekStart:validDate(source.weekStart)?monday(source.weekStart):monday(today),
    month:validMonth(source.month)?source.month:today.slice(0,7),
    selectedDate:validDate(source.selectedDate)?source.selectedDate:today,
    completed:source.completed===undefined?new Set([1,2,3]):history(source.completed),
  };
}

export function createZhanshenSession({today=DEFAULT_TODAY,mode='week'}={}){
  return normalizeSession({today,mode});
}

export function projectAnimeTicket(completed=[1,2,3]){
  const progress=getTicketProgress(history(completed),animeTicketLevels);
  const nextCount=progress.next?.episode??null;
  const progressCount=progress.nextProgress?.watchedCount??DEMO_HISTORY_LIMIT;
  const total=nextCount??DEMO_HISTORY_LIMIT;
  return {
    ...progress,
    current:progress.current?{...progress.current}:null,
    next:progress.next?{...progress.next}:null,
    nextProgress:progress.nextProgress?{...progress.nextProgress}:null,
    levels:animeTicketLevels.map(level=>({...level})),
    earnedLevels:animeTicketLevels.filter(level=>level.level<=progress.currentLevel).map(level=>level.level),
    nextCount,progressCount,total,ratio:progressCount/total,
    remaining:progress.nextProgress?.remaining??0,
    demoOnly:true,ruleNote:zhanshenAnime.ticketRuleNote,
  };
}

function phaseAt(today){
  if(today<zhanshenAnime.knownPeriod.from)return 'upcoming';
  if(today>=zhanshenAnime.knownPeriod.to)return 'relocked';
  return 'free';
}

function phaseLabel(phase){
  return {upcoming:'限免未开始',free:'限免进行中',relocked:'已回锁会员'}[phase];
}

function projectEvent(event,today){
  return event?{...event,status:event.date<today?'past':event.date===today?'today':'upcoming'}:null;
}

function rangeDate(date){
  const value=parseDate(date);
  return `${value.getUTCMonth()+1}月${value.getUTCDate()}日`;
}

export function selectZhanshenCalendar(input={}){
  const session=normalizeSession(input);
  const {today,mode,weekStart,month,selectedDate,completed}=session;
  const rows=mode==='week'?1:Math.max(5,monthCells(month).length/7);
  const first=mode==='week'?weekStart:monday(`${month}-01`);
  const events=zhanshenAnime.events.map(event=>projectEvent(event,today));
  const days=Array.from({length:rows*7},(_,index)=>{
    const date=addDays(first,index),outside=mode==='month'&&date.slice(0,7)!==month;
    const event=outside?null:projectEvent(zhanshenAnime.events.find(item=>item.date===date),today);
    return {date,day:parseDate(date).getUTCDate(),weekday:weekday(date),outside,isToday:date===today,event};
  });
  const phase=phaseAt(today);
  const [year,monthNumber]=month.split('-');
  const dateLabel=mode==='week'?`${rangeDate(weekStart)} — ${rangeDate(addDays(weekStart,6))}`:`${year}年${Number(monthNumber)}月`;
  return {
    title:zhanshenAnime.title,today,month,weekStart,mode,rows,days,cells:days,dateLabel,rangeLabel:dateLabel,
    selectedDate,selectedEvent:projectEvent(zhanshenAnime.events.find(event=>event.date===selectedDate),today),
    selectedDay:days.find(day=>day.date===selectedDate)||null,
    events,phase,phaseLabel:phaseLabel(phase),
    phaseNote:'按日期展示限免活动阶段；截图未标注钟点，当日生效时刻及实际观看权益以客户端为准。',
    todayEvent:projectEvent(zhanshenAnime.events.find(event=>event.date===today),today),
    latestEvent:projectEvent(zhanshenAnime.events.findLast(event=>event.date<=today),today),
    nextEvent:projectEvent(zhanshenAnime.events.find(event=>event.date>today),today),
    completedCount:completed.size,ticket:projectAnimeTicket(completed),
    scheduleNote:zhanshenAnime.scheduleNote,historyNote:zhanshenAnime.historyNote,
    updateWeekday:zhanshenAnime.updateWeekday,updateTime:null,
  };
}

export function shiftZhanshenPeriod(input,delta){
  const session=normalizeSession(input);
  const amount=Number.isSafeInteger(delta)&&Math.abs(delta)<=1200?delta:0;
  if(amount===0)return session;
  if(session.mode==='month'){
    const month=shiftMonth(session.month,amount);
    if(!validMonth(month))return session;
    return {...session,month,weekStart:monday(`${month}-01`),selectedDate:`${month}-01`};
  }
  const weekStart=addDays(session.weekStart,amount*7);
  if(!validDate(weekStart))return session;
  return {...session,weekStart,month:weekStart.slice(0,7),selectedDate:weekStart};
}

export function switchZhanshenMode(input,mode){
  const session=normalizeSession(input);
  if(!['week','month'].includes(mode)||mode===session.mode)return session;
  return {...session,mode,month:session.selectedDate.slice(0,7),weekStart:monday(session.selectedDate)};
}
