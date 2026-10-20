import {getSchedule,releaseTime} from './calendar-model.mjs';

const validEpisode=value=>Number.isSafeInteger(value)&&value>0;
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const validTime=value=>typeof value==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
function validDate(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const time=Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value;
}
function currentTime(now) {
  if(now instanceof Date||typeof now==='number')return new Date(now).getTime();
  if(typeof now!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(now)||!validDate(now.slice(0,10)))return NaN;
  return Date.parse(now);
}

// Editorial highlights and screenings are display metadata, never entitlement.
// Keep them separate from releases so they cannot alter availability or finale.
export function getDateOperations(drama, {tier,date,now} = {}) {
  const empty={highlights:[],events:[]};
  if(!validDate(date))return empty;
  let schedule;
  try{schedule=getSchedule(drama,tier);}catch{return empty;}
  const highlights=(Array.isArray(drama.calendarHighlights)?drama.calendarHighlights:[]).filter(item=>{
    if(!item||!nonempty(item.id)||!nonempty(item.icon)||!nonempty(item.title)||!validEpisode(item.episode))return false;
    return schedule.releases.some(release=>validEpisode(release?.from)&&validEpisode(release?.to)&&release.from<=item.episode&&item.episode<=release.to&&release.date===date&&validTime(release.time));
  }).map(({id,episode,icon,title})=>({id,episode,icon,title}));
  const time=currentTime(now);
  if(!Number.isFinite(time))return {highlights,events:[]};
  const events=(Array.isArray(drama.screeningEvents)?drama.screeningEvents:[]).flatMap(event=>{
    if(!event||!nonempty(event.id)||!nonempty(event.title)||event.date!==date||!validTime(event.time)||!validTime(event.endTime))return [];
    if(!validEpisode(event.from)||!validEpisode(event.to)||event.from>event.to||(validEpisode(drama.totalEpisodes)&&event.to>drama.totalEpisodes))return [];
    if(event.accessNote!==undefined&&!nonempty(event.accessNote))return [];
    if(event.tiers!==undefined&&(!Array.isArray(event.tiers)||![...event.tiers].every(identity=>typeof identity==='string'&&Object.hasOwn(drama.scheduleByTier,identity))||!event.tiers.includes(schedule.tier)))return [];
    const start=releaseTime(event),end=releaseTime({date,time:event.endTime});
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return [];
    const metadata={id:event.id,date:event.date,time:event.time,endTime:event.endTime,title:event.title,from:event.from,to:event.to};
    if(event.tiers!==undefined)metadata.tiers=[...event.tiers];
    if(event.accessNote!==undefined)metadata.accessNote=event.accessNote;
    return [{...metadata,status:time<start?'upcoming':time<end?'live':'ended'}];
  });
  return {highlights,events};
}
