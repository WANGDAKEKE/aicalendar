export function dateKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
}
export function parseDate(key) {return new Date(`${key}T00:00:00Z`);}
export function shortDate(key) {const date=parseDate(key);return `${date.getUTCMonth()+1}月${date.getUTCDate()}日`;}
export function weekday(key) {return `周${'日一二三四五六'[parseDate(key).getUTCDay()]}`;}
export function shiftMonth(month, amount) {
  const date=parseDate(`${month}-01`);
  date.setUTCMonth(date.getUTCMonth()+amount);
  return dateKey(date).slice(0,7);
}
export function monthCells(month) {
  const first=parseDate(`${month}-01`), offset=(first.getUTCDay()+6)%7;
  const count=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  return Array.from({length:Math.ceil((offset+count)/7)*7},(_,i)=>{
    const day=i-offset+1;
    return day<1||day>count?null:`${month}-${String(day).padStart(2,'0')}`;
  });
}
export function getSchedule(drama, tier) {
  const resolved=Object.hasOwn(drama.scheduleByTier,tier)?tier:'free';
  return {tier:resolved, releases:[...(drama.scheduleByTier[resolved]||[])].sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time))};
}
export function episodeLabel(release) {return release.from===release.to?`${release.from}集`:`${release.from}–${release.to}集`;}
export function releaseTime(release) {return Date.parse(`${release.date}T${release.time}:00+08:00`);}
export function getSummary(drama, tier, now) {
  const resolved=getSchedule(drama,tier), time=new Date(now).getTime();
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:drama.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
  return {
    ...resolved, today,
    available:resolved.releases.filter(r=>releaseTime(r)<=time).reduce((max,r)=>Math.max(max,r.to),0),
    todayRelease:resolved.releases.find(r=>r.date===today),
    next:resolved.releases.find(r=>releaseTime(r)>time),
    finale:resolved.releases.find(r=>r.to===drama.totalEpisodes),
  };
}
