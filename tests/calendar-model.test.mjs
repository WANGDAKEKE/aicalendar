import test from 'node:test';
import assert from 'node:assert/strict';
import {drama,demoSession,demoScenarios} from '../dist/drama-config.mjs';
import {monthCells,weekday,shiftMonth,getSchedule,getSummary,releaseTime,getReleaseViewingState} from '../dist/calendar-model.mjs';

test('October layout uses real weekdays and only has 31 clickable dates',()=>{
  const cells=monthCells('2026-10');
  assert.equal(cells.length,35);assert.equal(cells.filter(Boolean).length,31);
  assert.deepEqual(cells.slice(0,4),[null,null,null,'2026-10-01']);
  assert.equal(weekday('2026-10-15'),'周四');
});
test('six-row months, leap years and year boundaries work',()=>{
  assert.equal(monthCells('2026-03').length,42);
  assert.equal(monthCells('2028-02').filter(Boolean).length,29);
  assert.equal(monthCells('2027-02').filter(Boolean).length,28);
  assert.equal(shiftMonth('2026-12',1),'2027-01');
  assert.equal(shiftMonth('2026-01',-1),'2025-12');
});
test('VIP summary answers today, next update and finale without other tier columns',()=>{
  const result=getSummary(drama,demoSession.tier,demoSession.now);
  assert.equal(result.today,'2026-10-15');assert.equal(result.available,12);
  assert.equal(result.todayRelease.from,11);assert.equal(result.next.date,'2026-10-16');
  assert.equal(result.finale.date,'2026-10-27');
});
test('availability changes at release time, never just at midnight',()=>{
  const before=getSummary(drama,'vip','2026-10-15T17:59:59+08:00');
  const after=getSummary(drama,'vip','2026-10-15T18:00:00+08:00');
  assert.equal(before.available,10);assert.equal(before.next.date,before.today);
  assert.equal(after.available,12);assert.equal(after.next.date,'2026-10-16');
});
test('SVIP and free identities resolve independent schedules and personal finale dates',()=>{
  assert.equal(getSummary(drama,'svip',demoSession.now).finale.date,'2026-10-26');
  const free=getSummary(drama,'free',demoSession.now);
  assert.equal(free.available,7);assert.equal(free.finale.date,'2026-11-11');
});
test('unknown identity safely falls back to free, not privileged access',()=>{
  assert.equal(getSchedule(drama,null).tier,'free');
  assert.equal(getSummary(drama,'invalid',demoSession.now).available,7);
});
test('rest days, pre-premiere and completed dramas have coherent summaries',()=>{
  assert.equal(getSummary(drama,'vip','2026-10-19T19:00:00+08:00').todayRelease,undefined);
  assert.equal(getSummary(drama,'vip','2026-10-01T19:00:00+08:00').available,0);
  const done=getSummary(drama,'vip','2026-11-01T19:00:00+08:00');
  assert.equal(done.available,30);assert.equal(done.next,undefined);
});
test('all tiers premiere on October 10, cover every episode once and finish with episode 30',()=>{
  for(const tier of Object.keys(drama.scheduleByTier)){
    const {releases}=getSchedule(drama,tier);
    const numbers=releases.flatMap(r=>Array.from({length:r.to-r.from+1},(_,i)=>r.from+i));
    assert.deepEqual(numbers,Array.from({length:30},(_,i)=>i+1));
    assert.equal(releases[0].date,'2026-10-10');
    assert.equal(releases[0].milestone,'premiere');
    assert.equal(releases.at(-1).milestone,'finale');
    assert.ok(releases.every(r=>Number.isFinite(releaseTime(r))));
  }
});

const october14=getSchedule(drama,'vip').releases.find(release=>release.date==='2026-10-14');
test('an unwatched October 14 release starts with episode 9, not the latest available episode',()=>{
  const completed=new Set(demoScenarios.missed.completed);
  assert.deepEqual(getReleaseViewingState(october14,completed,demoSession.now),{status:'unwatched',pendingEpisodes:[9,10],nextEpisode:9});
});
test('watching only episode 9 continues from the missing episode 10',()=>{
  assert.deepEqual(getReleaseViewingState(october14,new Set(demoScenarios.partial.completed),demoSession.now),{status:'partial',pendingEpisodes:[10],nextEpisode:10});
});
test('skipping to episode 10 keeps episode 9 pending and resumes there',()=>{
  assert.deepEqual(getReleaseViewingState(october14,new Set([10]),demoSession.now),{status:'partial',pendingEpisodes:[9],nextEpisode:9});
});
test('a fully watched release offers replay even when earlier batches contain gaps',()=>{
  assert.deepEqual(getReleaseViewingState(october14,new Set([9,10,12]),demoSession.now),{status:'watched',pendingEpisodes:[],nextEpisode:9});
});
test('future releases never offer playback despite contaminated completed history',()=>{
  const completed=new Set([9,10,'9',NaN]);
  assert.deepEqual(getReleaseViewingState(october14,completed,'2026-10-14T17:59:59+08:00'),{status:'upcoming',pendingEpisodes:[],nextEpisode:null});
  assert.deepEqual(getReleaseViewingState(october14,completed,releaseTime(october14)),{status:'watched',pendingEpisodes:[],nextEpisode:9});
});
test('rest days have no viewing action',()=>{
  for(const release of [undefined,null]){
    assert.deepEqual(getReleaseViewingState(release,new Set([9,10]),demoSession.now),{status:'none',pendingEpisodes:[],nextEpisode:null});
  }
});
test('viewing state ignores invalid history records and handles single-episode releases',()=>{
  const invalid=new Set(['9','10',9.5,0,-1,null,undefined,NaN,Infinity,11]);
  assert.deepEqual(getReleaseViewingState(october14,invalid,demoSession.now),{status:'unwatched',pendingEpisodes:[9,10],nextEpisode:9});
  const single={...october14,from:9,to:9};
  assert.deepEqual(getReleaseViewingState(single,new Set(),demoSession.now),{status:'unwatched',pendingEpisodes:[9],nextEpisode:9});
  assert.deepEqual(getReleaseViewingState(single,new Set([9]),demoSession.now),{status:'watched',pendingEpisodes:[],nextEpisode:9});
});
test('invalid release metadata or clock cannot provide a playback action',()=>{
  for(const release of [{...october14,from:0},{...october14,from:'9'},{...october14,to:8}]){
    assert.deepEqual(getReleaseViewingState(release,new Set([9,10]),demoSession.now),{status:'none',pendingEpisodes:[],nextEpisode:null});
  }
  for(const now of [undefined,null,'invalid',NaN,Infinity]){
    assert.deepEqual(getReleaseViewingState(october14,new Set([9,10]),now),{status:'upcoming',pendingEpisodes:[],nextEpisode:null});
  }
  assert.deepEqual(getReleaseViewingState({...october14,time:'invalid'},new Set([9,10]),demoSession.now),{status:'upcoming',pendingEpisodes:[],nextEpisode:null});
});

test('the default skipped scenario records exact completed episodes instead of a continuous count',()=>{
  assert.equal(demoSession.scenario,'skipped');
  assert.equal(demoSession.now,'2026-10-15T19:00:00+08:00');
  assert.deepEqual(demoScenarios.skipped.completed,[1,2,7,8]);
  assert.equal(demoScenarios.skipped.focusDate,'2026-10-11');
  for(const scenario of Object.values(demoScenarios)){
    assert.ok(Array.isArray(scenario.completed));
    assert.equal(Object.hasOwn(scenario,'watched'),false);
  }
  for(const [id,count] of [['missed',8],['partial',9],['caught-up',10]]){
    assert.deepEqual(demoScenarios[id].completed,Array.from({length:count},(_,index)=>index+1));
    assert.equal(demoScenarios[id].focusDate,'2026-10-14');
  }
});
test('skipped history marks only October 10 and 13 watched, while other dates retain their own state',()=>{
  const {releases}=getSchedule(drama,demoSession.tier);
  const completed=new Set(demoScenarios.skipped.completed);
  const cases=[
    ['2026-10-10','watched',[],1],
    ['2026-10-11','unwatched',[3,4],3],
    ['2026-10-12','unwatched',[5,6],5],
    ['2026-10-13','watched',[],7],
    ['2026-10-14','unwatched',[9,10],9],
    ['2026-10-15','unwatched',[11,12],11],
    ['2026-10-16','upcoming',[],null],
    ['2026-10-19','none',[],null],
  ];
  for(const [date,status,pendingEpisodes,nextEpisode] of cases){
    const release=releases.find(release=>release.date===date);
    assert.deepEqual(getReleaseViewingState(release,completed,demoSession.now),{status,pendingEpisodes,nextEpisode});
  }
});
test('finishing the missed October 11 batch does not mark October 12 or 14 watched',()=>{
  const {releases}=getSchedule(drama,demoSession.tier);
  const completed=new Set([...demoScenarios.skipped.completed,3,4]);
  const viewing=date=>getReleaseViewingState(releases.find(release=>release.date===date),completed,demoSession.now);
  assert.deepEqual(viewing('2026-10-11'),{status:'watched',pendingEpisodes:[],nextEpisode:3});
  assert.deepEqual(viewing('2026-10-12'),{status:'unwatched',pendingEpisodes:[5,6],nextEpisode:5});
  assert.deepEqual(viewing('2026-10-14'),{status:'unwatched',pendingEpisodes:[9,10],nextEpisode:9});
  assert.equal(viewing('2026-10-10').status,'watched');
  assert.equal(viewing('2026-10-13').status,'watched');
  assert.deepEqual(demoScenarios.skipped.completed,[1,2,7,8]);
});
test('VIP rest days and independent screening date stay distinct from episode releases',()=>{
  const {releases}=getSchedule(drama,'vip');
  for(const date of ['2026-10-19','2026-10-23','2026-10-26']){
    assert.equal(releases.some(release=>release.date===date),false);
  }
  const screening=drama.screeningEvents[0];
  assert.equal(screening.date,'2026-10-24');
  assert.deepEqual([screening.from,screening.to],[27,30]);
  const regular=releases.find(release=>release.date===screening.date);
  assert.deepEqual([regular.from,regular.to],[25,26]);
});
