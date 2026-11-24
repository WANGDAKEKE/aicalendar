import test from 'node:test';
import assert from 'node:assert/strict';
import {princessDrama,createPrincessSession,selectPrincessCalendar,shiftPrincessPeriod,switchPrincessMode} from '../dist/princess-calendar-model.mjs';

const cell=(view,date)=>view.days.find(day=>day.date===date);

test('the standalone princess schedule contains only screenshot-confirmed releases and separate extras',()=>{
  assert.equal(princessDrama.title,'尚公主');
  assert.equal(princessDrama.totalEpisodesKnown,false);
  assert.match(princessDrama.scheduleNote,/非全剧总集数/);
  assert.deepEqual(princessDrama.scheduleByTier.vip.map(({from,to})=>[from,to]),[[22,22],[23,23],[24,24],[25,26],[27,28],[29,30],[31,32]]);
  assert.deepEqual(princessDrama.scheduleByTier.svip.map(({from,to})=>[from,to]),[[23,23],[24,24],[25,25],[26,27],[28,29],[30,31],[32,33]]);
  assert.deepEqual(princessDrama.scheduleByTier.free,[]);
  for(const tier of ['vip','svip']){
    assert.equal(princessDrama.scheduleByTier[tier].length,7);
    assert.ok(princessDrama.scheduleByTier[tier].every(release=>release.time==='18:00'&&!release.milestone));
  }
  assert.deepEqual(princessDrama.activities,[{id:'sofa-talk-first',date:'2026-11-03',time:'17:00',title:'《沙发多话》上期',kind:'extra'}]);
  assert.ok(Object.isFrozen(princessDrama.scheduleByTier.vip));
});

test('the default week starts on November 2 and preserves historic viewing without inventing historic releases',()=>{
  const session=createPrincessSession(),view=selectPrincessCalendar(session);
  assert.equal(session.mode,'week');
  assert.equal(session.accountTier,'vip');
  assert.equal(session.weekStart,'2026-11-02');
  assert.equal(session.month,'2026-11');
  assert.equal(view.today,'2026-11-05');
  assert.equal(view.selectedDate,view.today);
  assert.equal(view.days.length,7);
  assert.equal(view.rangeLabel,'11月2日 — 11月8日');
  assert.deepEqual(view.availableEpisodes,[22,23,24,25,26]);
  assert.equal(view.nextEpisode,25);
  assert.equal(view.completedCount,24);
  assert.equal(view.ticket.current.name,'同行票');
  assert.equal(view.ticket.next.episode,30);
  assert.equal(view.ticket.nextProgress.watchedCount,24);
  assert.equal(view.currentRelease.from,25);
  assert.equal(view.currentRelease.to,26);
  assert.equal(view.nextRelease.date,'2026-11-06');
  assert.equal(cell(view,'2026-11-05').watching.status,'unwatched');
});

test('the November month uses six real calendar rows and keeps unpublished dates empty',()=>{
  const session=switchPrincessMode(createPrincessSession(),'month');
  const view=selectPrincessCalendar(session);
  assert.equal(view.days.length,42);
  assert.equal(view.rows,6);
  assert.equal(view.days[0].date,'2026-10-26');
  assert.equal(view.days.at(-1).date,'2026-12-06');
  assert.equal(view.rangeLabel,'2026年11月');
  for(const day of view.days){
    if(day.date<'2026-11-02'||day.date>'2026-11-08'){
      assert.equal(day.release,null,day.date);
      assert.equal(day.knownRelease,false,day.date);
      assert.equal(day.watching.status,'none',day.date);
    }
  }
  assert.equal(cell(view,'2026-11-03').activities[0].time,'17:00');
  assert.deepEqual([cell(view,'2026-11-03').release.from,cell(view,'2026-11-03').release.to],[23,23]);
});

test('actual account membership controls known playable episodes and upgrade benefits',()=>{
  const vip=selectPrincessCalendar(createPrincessSession());
  assert.deepEqual(vip.upgrade,{tier:'svip',availableThrough:27,currentAvailableThrough:26,extraEpisodes:1,known:true,currentRelease:{date:'2026-11-05',time:'18:00',from:26,to:27}});
  const svip=selectPrincessCalendar(createPrincessSession({tier:'svip'}));
  assert.deepEqual(svip.availableEpisodes,[23,24,25,26,27]);
  assert.equal(svip.upgrade,null);
  assert.equal(svip.availableEpisodes.includes(28),false);
  const free=selectPrincessCalendar(createPrincessSession({tier:'free'}));
  assert.deepEqual(free.availableEpisodes,[]);
  assert.equal(free.nextEpisode,null);
  assert.equal(free.currentRelease,null);
  assert.equal(free.scheduleKnown,false);
  assert.equal(free.upgrade.tier,'vip');
  assert.equal(free.upgrade.extraEpisodes,null);
  assert.equal(free.upgrade.known,false);
  assert.ok(free.days.every(day=>day.release===null));
  // A presentation-only preview field must not expand actual playback scope.
  assert.deepEqual(selectPrincessCalendar({...createPrincessSession(),previewTier:'svip'}).availableEpisodes,vip.availableEpisodes);
});

test('release boundaries are exact and future history never makes a future episode playable',()=>{
  const before=createPrincessSession({now:'2026-11-05T17:59:59+08:00'});
  before.completed.add(27).add(33);
  const early=selectPrincessCalendar(before);
  assert.deepEqual(early.availableEpisodes,[22,23,24]);
  assert.equal(cell(early,'2026-11-05').watching.status,'upcoming');
  assert.equal(early.nextEpisode,null);
  const released=selectPrincessCalendar({...before,now:'2026-11-05T18:00:00+08:00'});
  assert.deepEqual(released.availableEpisodes,[22,23,24,25,26]);
  assert.equal(released.availableEpisodes.includes(27),false);
  assert.equal(released.nextEpisode,25);
  const premiere=selectPrincessCalendar(createPrincessSession({now:'2026-11-02T17:59:59+08:00'}));
  assert.deepEqual(premiere.availableEpisodes,[]);
  assert.ok(premiere.days.every(day=>day.watching.status==='upcoming'));
});

test('partial and skipped batches retain their exact missing episode',()=>{
  const session=createPrincessSession();
  session.completed.add(25);
  let view=selectPrincessCalendar(session);
  assert.equal(cell(view,'2026-11-05').watching.status,'partial');
  assert.deepEqual(cell(view,'2026-11-05').watching.pendingEpisodes,[26]);
  assert.equal(view.nextEpisode,26);
  session.completed.delete(25);
  session.completed.add(26);
  view=selectPrincessCalendar(session);
  assert.deepEqual(cell(view,'2026-11-05').watching.pendingEpisodes,[25]);
  assert.equal(view.nextEpisode,25);
});

test('period and mode changes are immutable and do not upgrade membership or edit viewing history',()=>{
  const session=createPrincessSession(),before=structuredClone(session);
  const nextWeek=shiftPrincessPeriod(session,1);
  assert.equal(nextWeek.weekStart,'2026-11-09');
  assert.ok(selectPrincessCalendar(nextWeek).days.every(day=>day.release===null));
  assert.equal(selectPrincessCalendar(nextWeek).knownRelease,false);
  assert.deepEqual(shiftPrincessPeriod(nextWeek,-1).weekStart,session.weekStart);
  const month=switchPrincessMode(session,'month');
  assert.equal(month.month,'2026-11');
  const december=shiftPrincessPeriod(month,1);
  assert.equal(december.month,'2026-12');
  assert.ok(selectPrincessCalendar(december).days.every(day=>day.release===null));
  for(const changed of [nextWeek,month,december,switchPrincessMode(month,'week')]){
    assert.equal(changed.accountTier,'vip');
    assert.deepEqual(changed.completed,session.completed);
    assert.notEqual(changed.completed,session.completed);
  }
  assert.deepEqual(session,before);
});

test('invalid identities do not gain access and invalid clocks, dates and history fail safely',()=>{
  for(const tier of ['VIP','__proto__','constructor',null,{},Symbol('svip')]){
    const session=createPrincessSession({tier,now:'invalid'});
    assert.equal(session.accountTier,'free');
    assert.deepEqual(selectPrincessCalendar(session).availableEpisodes,[]);
    assert.equal(selectPrincessCalendar(session).today,'2026-11-05');
  }
  const session={...createPrincessSession(),completed:[1,1,0,34,'25',25,null],month:'2026-13',weekStart:'2026-02-31',selectedDate:'bad'};
  const before=structuredClone(session),view=selectPrincessCalendar(session);
  assert.equal(view.weekStart,'2026-11-02');
  assert.equal(view.month,'2026-11');
  assert.equal(view.selectedDate,'2026-11-05');
  assert.equal(view.completedCount,2);
  assert.equal(view.nextEpisode,22);
  assert.equal(view.ticket.currentLevel,0);
  assert.deepEqual(session,before);
  assert.equal(shiftPrincessPeriod(createPrincessSession(),Infinity).weekStart,'2026-11-02');
  assert.equal(switchPrincessMode(createPrincessSession(),'unexpected').mode,'week');
});

test('independent sessions and projections never mutate the shared screenshot source',()=>{
  const first=createPrincessSession(),second=createPrincessSession();
  first.completed.add(25);
  assert.equal(second.completed.has(25),false);
  const sourceBefore=structuredClone(princessDrama);
  const view=selectPrincessCalendar(first);
  cell(view,'2026-11-02').release.from=999;
  cell(view,'2026-11-03').activities[0].title='changed';
  assert.deepEqual(princessDrama,sourceBefore);
  assert.equal(selectPrincessCalendar(first).days[0].release.from,22);
});
