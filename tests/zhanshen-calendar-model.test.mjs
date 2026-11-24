import test from 'node:test';
import assert from 'node:assert/strict';
import {zhanshenAnime,animeTicketLevels,createZhanshenSession,selectZhanshenCalendar,shiftZhanshenPeriod,switchZhanshenMode,projectAnimeTicket} from '../dist/zhanshen-calendar-model.mjs';

const day=(view,date)=>view.days.find(item=>item.date===date);

test('anime data preserves screenshot-only Thursday free batches and the December membership relock',()=>{
  assert.equal(zhanshenAnime.title,'斩神Ⅱ');
  assert.deepEqual(zhanshenAnime.events.map(({date,from,to})=>[date,from,to]),[
    ['2026-10-29',2,3],['2026-11-05',4,6],['2026-11-12',7,9],
    ['2026-11-19',10,12],['2026-11-26',13,15],['2026-12-03',2,15],
  ]);
  assert.ok(zhanshenAnime.events.every(event=>new Date(`${event.date}T00:00:00Z`).getUTCDay()===4));
  assert.ok(zhanshenAnime.events.every(event=>event.time===null));
  assert.equal(zhanshenAnime.events.at(-1).kind,'relock');
  assert.equal(zhanshenAnime.events.at(-2).isSeasonFree,true);
  assert.match(zhanshenAnime.scheduleNote,/第1集权益未提供/);
  assert.match(zhanshenAnime.scheduleNote,/不作播放授权判断/);
  assert.ok(Object.isFrozen(zhanshenAnime.events[0]));
  assert.ok(Object.isFrozen(animeTicketLevels));
});

test('default November week projects one limited-free batch without creating a play scope',()=>{
  const session=createZhanshenSession(),view=selectZhanshenCalendar(session);
  assert.equal(session.weekStart,'2026-11-02');
  assert.equal(session.selectedDate,'2026-11-05');
  assert.equal(view.days.length,7);
  assert.equal(view.dateLabel,'11月2日 — 11月8日');
  assert.equal(view.days[0].weekday,'周一');
  assert.equal(view.days.at(-1).weekday,'周日');
  assert.equal(view.days.filter(item=>item.event).length,1);
  assert.equal(day(view,'2026-11-05').isToday,true);
  assert.deepEqual([view.selectedEvent.from,view.selectedEvent.to],[4,6]);
  assert.equal(view.selectedEvent.status,'today');
  assert.equal(view.nextEvent.date,'2026-11-12');
  assert.equal(view.phase,'free');
  assert.equal(view.completedCount,3);
  assert.equal(view.availableEpisodes,undefined);
  assert.equal(view.nextEpisode,undefined);
  assert.equal(view.updateTime,null);
});

test('November and December have real six- and five-row calendars, including unannounced empty dates',()=>{
  const november=selectZhanshenCalendar(createZhanshenSession({mode:'month'}));
  assert.equal(november.days.length,42);
  assert.equal(november.days[0].date,'2026-10-26');
  assert.equal(november.days.at(-1).date,'2026-12-06');
  assert.equal(november.dateLabel,'2026年11月');
  assert.equal(day(november,'2026-10-29').outside,true);
  assert.equal(day(november,'2026-10-29').event,null);
  assert.equal(day(november,'2026-11-06').event,null);
  assert.equal(november.days.filter(item=>item.event).length,4);
  const december=selectZhanshenCalendar(shiftZhanshenPeriod(createZhanshenSession({mode:'month'}),1));
  assert.equal(december.days.length,35);
  assert.equal(december.days[0].date,'2026-11-30');
  assert.equal(december.days.at(-1).date,'2027-01-03');
  assert.equal(day(december,'2026-12-03').event.kind,'relock');
  assert.equal(december.days.filter(item=>item.event).length,1);
});

test('date-only activity phases do not claim an invented hour, cumulative free entitlement, or a forever-free finale',()=>{
  const before=selectZhanshenCalendar(createZhanshenSession({today:'2026-10-28'}));
  assert.equal(before.phase,'upcoming');
  assert.equal(before.latestEvent,null);
  assert.equal(before.nextEvent.date,'2026-10-29');
  const first=selectZhanshenCalendar(createZhanshenSession({today:'2026-10-29'}));
  assert.equal(first.phase,'free');
  assert.equal(first.todayEvent.label,'限免2–3集');
  const lastFree=selectZhanshenCalendar(createZhanshenSession({today:'2026-12-02'}));
  assert.equal(lastFree.phase,'free');
  assert.equal(lastFree.nextEvent.kind,'relock');
  const relocked=selectZhanshenCalendar(createZhanshenSession({today:'2026-12-03'}));
  assert.equal(relocked.phase,'relocked');
  assert.equal(relocked.todayEvent.label,'2–15集回锁会员');
  assert.equal(relocked.nextEvent,null);
  assert.match(relocked.phaseNote,/未标注钟点/);
  const after=selectZhanshenCalendar(createZhanshenSession({today:'2027-01-01'}));
  assert.equal(after.phase,'relocked');
  assert.ok(after.days.every(item=>item.event===null));
  assert.equal(after.events.length,6);
  assert.equal(after.freeThrough,undefined);
});

test('local electronic-ticket targets use the anime proposal 3, 9 and 15, not the drama targets',()=>{
  const ticket=selectZhanshenCalendar(createZhanshenSession()).ticket;
  assert.deepEqual(ticket.levels.map(level=>level.episode),[3,9,15]);
  assert.equal(ticket.currentLevel,1);
  assert.equal(ticket.current.name,'初程票');
  assert.equal(ticket.next.name,'同行票');
  assert.equal(ticket.nextCount,9);
  assert.equal(ticket.progressCount,3);
  assert.equal(ticket.remaining,6);
  assert.equal(ticket.ratio,1/3);
  assert.deepEqual(ticket.earnedLevels,[1]);
  assert.equal(ticket.demoOnly,true);
  assert.match(ticket.ruleNote,/非官方活动规则/);
  const full=projectAnimeTicket(new Set(Array.from({length:15},(_,index)=>index+1)));
  assert.equal(full.currentLevel,3);
  assert.equal(full.next,null);
  assert.equal(full.nextCount,null);
  assert.equal(full.progressCount,15);
  assert.equal(full.ratio,1);
});

test('ticket rewards require the complete prefix and sanitize invalid or duplicated history',()=>{
  const skipped=projectAnimeTicket([1,3,4,5,6,7,8,9]);
  assert.equal(skipped.currentLevel,0);
  assert.equal(skipped.nextCount,3);
  assert.equal(skipped.progressCount,2);
  assert.equal(skipped.remaining,1);
  assert.equal(skipped.nextProgress.nextEpisode,2);
  const invalid=projectAnimeTicket([1,1,2,3,0,-1,16,30,1.2,'4',null]);
  assert.equal(invalid.watchedCount,3);
  assert.equal(invalid.currentLevel,1);
});

test('navigation and date selection are immutable and never change demo viewing history',()=>{
  const session=createZhanshenSession(),before=structuredClone(session);
  const next=shiftZhanshenPeriod(session,1);
  assert.equal(next.weekStart,'2026-11-09');
  assert.equal(next.selectedDate,'2026-11-09');
  assert.equal(selectZhanshenCalendar(next).nextEvent.date,'2026-11-12');
  const month=switchZhanshenMode(session,'month');
  assert.equal(month.month,'2026-11');
  assert.equal(month.selectedDate,'2026-11-05');
  const december=shiftZhanshenPeriod(month,1);
  assert.equal(december.month,'2026-12');
  assert.equal(december.selectedDate,'2026-12-01');
  assert.equal(switchZhanshenMode(december,'week').weekStart,'2026-11-30');
  const selected=selectZhanshenCalendar({...session,selectedDate:'2026-11-26'});
  assert.equal(selected.selectedEvent.label,'限免13–15集');
  assert.equal(selected.phase,'free');
  assert.equal(selected.completedCount,3);
  for(const changed of [next,month,december]){
    assert.deepEqual(changed.completed,session.completed);
    assert.notEqual(changed.completed,session.completed);
    assert.equal(changed.today,'2026-11-05');
  }
  assert.deepEqual(session,before);
});

test('invalid dates, modes, movements and histories fail safely',()=>{
  const invalid=createZhanshenSession({today:'2026-02-31',mode:'unexpected'});
  assert.equal(invalid.today,'2026-11-05');
  assert.equal(invalid.mode,'week');
  const view=selectZhanshenCalendar({today:null,weekStart:'bad',month:'2026-13',selectedDate:'2026-11-31',completed:[1,1,3,0,16]});
  assert.equal(view.weekStart,'2026-11-02');
  assert.equal(view.month,'2026-11');
  assert.equal(view.selectedDate,'2026-11-05');
  assert.equal(view.completedCount,2);
  assert.equal(view.ticket.currentLevel,0);
  const session=createZhanshenSession();
  assert.equal(shiftZhanshenPeriod(session,Infinity).weekStart,session.weekStart);
  assert.equal(shiftZhanshenPeriod(session,'1').weekStart,session.weekStart);
  assert.equal(shiftZhanshenPeriod(session,1201).weekStart,session.weekStart);
  assert.equal(switchZhanshenMode(session,'daily').mode,'week');
});

test('session and projection mutations cannot modify shared screenshot data or other sessions',()=>{
  const one=createZhanshenSession(),two=createZhanshenSession(),source=structuredClone(zhanshenAnime);
  one.completed.add(4);
  assert.equal(two.completed.has(4),false);
  const view=selectZhanshenCalendar(one);
  view.selectedEvent.label='changed';
  view.days.find(item=>item.event).event.from=999;
  view.events[0].title='changed';
  view.ticket.levels[0].episode=999;
  assert.deepEqual(zhanshenAnime,source);
  const fresh=selectZhanshenCalendar(one);
  assert.equal(fresh.selectedEvent.from,4);
  assert.equal(fresh.events[0].title,'结业大考');
  assert.equal(fresh.ticket.levels[0].episode,3);
  assert.equal(fresh.completedCount,4);
});
