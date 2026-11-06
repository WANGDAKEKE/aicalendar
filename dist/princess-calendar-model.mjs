import {dateKey,parseDate,weekday,monthCells,shiftMonth,getReleaseViewingState,releaseTime} from './calendar-model.mjs';
import {getTicketProgress} from './ticket-model.mjs';

const DEFAULT_NOW='2026-11-05T19:00:00+08:00';
const DEFAULT_WEEK='2026-11-02';
const DEFAULT_MONTH='2026-11';
const DEMO_EPISODE_LIMIT=33;
const freeze=value=>{
  if(value&&typeof value==='object'){
    for(const child of Object.values(value))freeze(child);
    Object.freeze(value);
  }
  return value;
};
const makeReleases=ranges=>ranges.map(([from,to],index)=>({
  date:`2026-11-${String(index+2).padStart(2,'0')}`,time:'18:00',from,to,
}));

// Screenshot-derived release data only. The limit 33 is a demo history guard,
// not a claim about the drama's total episode count or its finale date.
export const princessDrama=freeze({
  id:'shang-gong-zhu',title:'尚公主',timeZone:'Asia/Shanghai',
  totalEpisodes:DEMO_EPISODE_LIMIT,totalEpisodesKnown:false,demoOnly:true,
  knownPeriod:{from:'2026-11-02',to:'2026-11-08'},
  scheduleNote:'仅演示截图已公布的11月2日—8日排期；33为演示历史上限，非全剧总集数。',
  tiers:{free:'非VIP',vip:'VIP',svip:'SVIP'},
  scheduleByTier:{
    free:[],
    vip:makeReleases([[22,22],[23,23],[24,24],[25,26],[27,28],[29,30],[31,32]]),
    svip:makeReleases([[23,23],[24,24],[25,25],[26,27],[28,29],[30,31],[32,33]]),
  },
  activities:[{id:'sofa-talk-first',date:'2026-11-03',time:'17:00',title:'《沙发多话》上期',kind:'extra'}],
});

const validTier=tier=>typeof tier==='string'&&Object.hasOwn(princessDrama.tiers,tier);
const resolveTier=tier=>validTier(tier)?tier:'free';
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)
  &&Number.isFinite(parseDate(value).getTime())&&dateKey(parseDate(value))===value;
const validMonth=value=>typeof value==='string'&&/^\d{4}-(?:0[1-9]|1[0-2])$/.test(value);
const copyRelease=release=>release?{...release}:null;

function resolveNow(value){
  if(value instanceof Date||typeof value==='number'){
    const time=new Date(value);
    if(Number.isFinite(time.getTime()))return time.toISOString();
  }
  if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)
    &&validDate(value.slice(0,10))&&Number.isFinite(Date.parse(value)))return value;
  return DEFAULT_NOW;
}

function todayAt(now){
  return new Intl.DateTimeFormat('en-CA',{timeZone:princessDrama.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
}

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
  return new Set(episodes.filter(episode=>Number.isSafeInteger(episode)&&episode>0&&episode<=DEMO_EPISODE_LIMIT));
}

function normalizeSession(value={}){
  const source=value&&typeof value==='object'?value:{};
  const now=resolveNow(source.now);
  return {
    accountTier:source.accountTier===undefined?'vip':resolveTier(source.accountTier),
    now,
    completed:source.completed===undefined?new Set(Array.from({length:24},(_,index)=>index+1)):history(source.completed),
    mode:source.mode==='month'?'month':'week',
    weekStart:validDate(source.weekStart)?monday(source.weekStart):DEFAULT_WEEK,
    month:validMonth(source.month)?source.month:DEFAULT_MONTH,
    selectedDate:validDate(source.selectedDate)?source.selectedDate:todayAt(now),
  };
}

export function createPrincessSession({tier='vip',now=DEFAULT_NOW}={}){
  return normalizeSession({accountTier:resolveTier(tier),now});
}

function releaseFor(tier,date){
  return princessDrama.scheduleByTier[tier].find(release=>release.date===date)||null;
}

function availableFor(tier,now){
  const episodes=new Set();
  for(const release of princessDrama.scheduleByTier[tier]){
    if(releaseTime(release)>Date.parse(now))continue;
    for(let episode=release.from;episode<=release.to;episode+=1)episodes.add(episode);
  }
  return [...episodes].sort((first,second)=>first-second);
}

function rangeDate(date){
  const value=parseDate(date);
  return `${value.getUTCMonth()+1}月${value.getUTCDate()}日`;
}

export function selectPrincessCalendar(input={}){
  const session=normalizeSession(input);
  const {accountTier,now,completed,mode,weekStart,month,selectedDate}=session;
  const today=todayAt(now);
  const rows=mode==='week'?1:Math.max(5,monthCells(month).length/7);
  const first=mode==='week'?weekStart:monday(`${month}-01`);
  const availableEpisodes=availableFor(accountTier,now);
  const availableThrough=availableEpisodes.at(-1)??null;
  const schedule=princessDrama.scheduleByTier[accountTier];
  const days=Array.from({length:rows*7},(_,index)=>{
    const date=addDays(first,index),outside=mode==='month'&&date.slice(0,7)!==month;
    const release=outside?null:copyRelease(releaseFor(accountTier,date));
    return {
      date,day:parseDate(date).getUTCDate(),weekday:weekday(date),outside,isToday:date===today,
      release,knownRelease:Boolean(release),watching:getReleaseViewingState(release,completed,now),
      activities:outside?[]:princessDrama.activities.filter(activity=>activity.date===date).map(activity=>({...activity})),
      vipRelease:outside?null:copyRelease(releaseFor('vip',date)),
      svipRelease:outside?null:copyRelease(releaseFor('svip',date)),
    };
  });
  const targetTier=accountTier==='free'?'vip':accountTier==='vip'?'svip':null;
  const targetEpisodes=targetTier?availableFor(targetTier,now):[];
  const targetThrough=targetEpisodes.at(-1)??null;
  const upgrade=targetTier?{
    tier:targetTier,availableThrough:targetThrough,
    currentAvailableThrough:availableThrough,
    extraEpisodes:accountTier==='free'?null:targetEpisodes.filter(episode=>!availableEpisodes.includes(episode)).length,
    known:accountTier!=='free',
    currentRelease:copyRelease(releaseFor(targetTier,today)),
  }:null;
  const currentRelease=copyRelease(releaseFor(accountTier,today));
  const selectedRelease=copyRelease(releaseFor(accountTier,selectedDate));
  const [year,monthNumber]=month.split('-');
  return {
    mode,accountTier,now,weekStart,month,rows,days,cells:days,
    rangeLabel:mode==='week'?`${rangeDate(weekStart)} — ${rangeDate(addDays(weekStart,6))}`:`${year}年${Number(monthNumber)}月`,
    selectedDate,today,knownRelease:Boolean(selectedRelease),selectedRelease,
    selectedDay:days.find(day=>day.date===selectedDate)||null,
    availableEpisodes,availableThrough,available:availableThrough??0,
    nextEpisode:availableEpisodes.find(episode=>!completed.has(episode))??null,
    completedCount:completed.size,ticket:getTicketProgress(completed),
    currentRelease,todayRelease:currentRelease,
    nextRelease:copyRelease(schedule.find(release=>releaseTime(release)>Date.parse(now))),
    upgrade,scheduleKnown:accountTier!=='free',scheduleNote:princessDrama.scheduleNote,
  };
}

export function shiftPrincessPeriod(input,delta){
  const session=normalizeSession(input);
  const amount=Number.isSafeInteger(delta)&&Math.abs(delta)<=1200?delta:0;
  if(amount===0)return session;
  if(session.mode==='month'){
    const month=shiftMonth(session.month,amount);
    return {...session,month,weekStart:monday(`${month}-01`),selectedDate:`${month}-01`};
  }
  const weekStart=addDays(session.weekStart,amount*7);
  return {...session,weekStart,month:weekStart.slice(0,7),selectedDate:weekStart};
}

export function switchPrincessMode(input,mode){
  const session=normalizeSession(input);
  if(!['week','month'].includes(mode)||mode===session.mode)return session;
  return {...session,mode,month:session.selectedDate.slice(0,7),weekStart:monday(session.selectedDate)};
}
