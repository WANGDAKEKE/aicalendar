import test from 'node:test';
import assert from 'node:assert/strict';
import {drama,demoSession} from '../dist/drama-config.mjs';
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
  assert.equal(result.today,'2026-10-15');assert.equal(result.available,10);
  assert.equal(result.todayRelease.from,9);assert.equal(result.next.date,'2026-10-16');
  assert.equal(result.finale.date,'2026-10-27');
});
test('availability changes at release time, never just at midnight',()=>{
  const before=getSummary(drama,'vip','2026-10-15T17:59:59+08:00');
  const after=getSummary(drama,'vip','2026-10-15T18:00:00+08:00');
  assert.equal(before.available,8);assert.equal(before.next.date,before.today);
  assert.equal(after.available,10);assert.equal(after.next.date,'2026-10-16');
});
test('SVIP and free identities resolve independent schedules and personal finale dates',()=>{
  assert.equal(getSummary(drama,'svip',demoSession.now).finale.date,'2026-10-26');
  const free=getSummary(drama,'free',demoSession.now);
  assert.equal(free.available,4);assert.equal(free.finale.date,'2026-11-14');
});
test('unknown identity safely falls back to free, not privileged access',()=>{
  assert.equal(getSchedule(drama,null).tier,'free');
  assert.equal(getSummary(drama,'invalid',demoSession.now).available,4);
});
test('rest days, pre-premiere and completed dramas have coherent summaries',()=>{
  assert.equal(getSummary(drama,'vip','2026-10-19T19:00:00+08:00').todayRelease,undefined);
  assert.equal(getSummary(drama,'vip','2026-10-01T19:00:00+08:00').available,0);
  const done=getSummary(drama,'vip','2026-11-01T19:00:00+08:00');
  assert.equal(done.available,30);assert.equal(done.next,undefined);
});
test('every tier covers all episodes once and finale really releases episode 30',()=>{
  for(const tier of Object.keys(drama.scheduleByTier)){
    const {releases}=getSchedule(drama,tier);
    const numbers=releases.flatMap(r=>Array.from({length:r.to-r.from+1},(_,i)=>r.from+i));
    assert.deepEqual(numbers,Array.from({length:30},(_,i)=>i+1));
    assert.equal(releases.at(-1).milestone,'finale');
    assert.ok(releases.every(r=>Number.isFinite(releaseTime(r))));
  }
});

const october14=getSchedule(drama,'vip').releases.find(release=>release.date==='2026-10-14');
test('an unwatched October 14 release starts with episode 7, not the latest available episode',()=>{
  const completed=new Set([1,2,3,4,5,6]);
  assert.deepEqual(getReleaseViewingState(october14,completed,demoSession.now),{status:'unwatched',pendingEpisodes:[7,8],nextEpisode:7});
});
test('watching only episode 7 continues from the missing episode 8',()=>{
  assert.deepEqual(getReleaseViewingState(october14,new Set([7]),demoSession.now),{status:'partial',pendingEpisodes:[8],nextEpisode:8});
});
test('skipping to episode 8 keeps episode 7 pending and resumes there',()=>{
  assert.deepEqual(getReleaseViewingState(october14,new Set([8]),demoSession.now),{status:'partial',pendingEpisodes:[7],nextEpisode:7});
});
test('a fully watched release offers replay even when earlier batches contain gaps',()=>{
  assert.deepEqual(getReleaseViewingState(october14,new Set([7,8,10]),demoSession.now),{status:'watched',pendingEpisodes:[],nextEpisode:7});
});
test('future releases never offer playback despite contaminated completed history',()=>{
  const completed=new Set([7,8,'7',NaN]);
  assert.deepEqual(getReleaseViewingState(october14,completed,'2026-10-14T17:59:59+08:00'),{status:'upcoming',pendingEpisodes:[],nextEpisode:null});
  assert.deepEqual(getReleaseViewingState(october14,completed,releaseTime(october14)),{status:'watched',pendingEpisodes:[],nextEpisode:7});
});
test('rest days have no viewing action',()=>{
  for(const release of [undefined,null]){
    assert.deepEqual(getReleaseViewingState(release,new Set([7,8]),demoSession.now),{status:'none',pendingEpisodes:[],nextEpisode:null});
  }
});
test('viewing state ignores invalid history records and handles single-episode releases',()=>{
  const invalid=new Set(['7','8',7.5,0,-1,null,undefined,NaN,Infinity,9]);
  assert.deepEqual(getReleaseViewingState(october14,invalid,demoSession.now),{status:'unwatched',pendingEpisodes:[7,8],nextEpisode:7});
  const single={...october14,from:7,to:7};
  assert.deepEqual(getReleaseViewingState(single,new Set(),demoSession.now),{status:'unwatched',pendingEpisodes:[7],nextEpisode:7});
  assert.deepEqual(getReleaseViewingState(single,new Set([7]),demoSession.now),{status:'watched',pendingEpisodes:[],nextEpisode:7});
});
test('invalid release metadata or clock cannot provide a playback action',()=>{
  for(const release of [{...october14,from:0},{...october14,from:'7'},{...october14,to:6}]){
    assert.deepEqual(getReleaseViewingState(release,new Set([7,8]),demoSession.now),{status:'none',pendingEpisodes:[],nextEpisode:null});
  }
  for(const now of [undefined,null,'invalid',NaN,Infinity]){
    assert.deepEqual(getReleaseViewingState(october14,new Set([7,8]),now),{status:'upcoming',pendingEpisodes:[],nextEpisode:null});
  }
  assert.deepEqual(getReleaseViewingState({...october14,time:'invalid'},new Set([7,8]),demoSession.now),{status:'upcoming',pendingEpisodes:[],nextEpisode:null});
});
