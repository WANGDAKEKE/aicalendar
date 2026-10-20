import test from 'node:test';
import assert from 'node:assert/strict';
import {drama,demoSession} from '../dist/drama-config.mjs';
import {getSchedule} from '../dist/calendar-model.mjs';
import {getEditorialState} from '../dist/editorial-model.mjs';

const item={episode:8,title:'Private title',image:'private-image.png',story:'Private editorial text'};
const completedThrough=episode=>new Set(Array.from({length:episode},(_,index)=>index+1));
const releasesFor=tier=>getSchedule(drama,tier).releases;
const context={releases:releasesFor('vip'),now:demoSession.now,completed:completedThrough(8)};

test('editorial release follows the resolved VIP, SVIP and free schedule',()=>{
  const expected={vip:['2026-10-14','ready'],svip:['2026-10-13','ready'],free:['2026-10-20','upcoming']};
  for(const [tier,[date,status]] of Object.entries(expected)){
    const releases=releasesFor(tier);
    const state=getEditorialState(item,{...context,releases});
    assert.equal(state.release.date,date);
    assert.ok(releases.includes(state.release));
    assert.equal(state.status,status);
    assert.equal(state.nextEpisode,null);
  }
});

test('eligibility changes at the exact release time, not at the start of the date',()=>{
  assert.equal(getEditorialState(item,{...context,now:'2026-10-14T17:59:59+08:00'}).status,'upcoming');
  assert.equal(getEditorialState(item,{...context,now:'2026-10-14T18:00:00+08:00'}).status,'ready');
  assert.equal(getEditorialState(item,{...context,now:Date.parse('2026-10-14T18:00:00+08:00')}).status,'ready');
  assert.equal(getEditorialState(item,{...context,now:new Date('2026-10-14T18:00:00+08:00')}).status,'ready');
});

test('fabricated completed history cannot unlock or offer playback before release',()=>{
  const state=getEditorialState(item,{...context,releases:releasesFor('free'),completed:completedThrough(30)});
  assert.equal(state.status,'upcoming');
  assert.equal(state.nextEpisode,null);
});

test('safe default requires every episode through the editorial target',()=>{
  const onlyTarget=getEditorialState(item,{...context,completed:new Set([8])});
  assert.equal(onlyTarget.status,'locked');
  assert.equal(onlyTarget.nextEpisode,1);
  const skipped=getEditorialState(item,{...context,completed:new Set([8,6,5,4,3,2,1])});
  assert.equal(skipped.status,'locked');
  assert.equal(skipped.nextEpisode,7);
  const empty=getEditorialState(item,{releases:context.releases,now:context.now});
  assert.equal(empty.status,'locked');
  assert.equal(empty.nextEpisode,1);
});

test('explicit requirements are deduplicated and sorted without changing the input',()=>{
  const requiresEpisodes=[8,3,3];
  const explicit={episode:8,requiresEpisodes};
  assert.equal(getEditorialState(explicit,{...context,completed:new Set([3,8])}).status,'ready');
  const missing=getEditorialState(explicit,{...context,completed:new Set([8])});
  assert.equal(missing.status,'locked');
  assert.equal(missing.nextEpisode,3);
  assert.deepEqual(requiresEpisodes,[8,3,3]);
});

test('invalid completed records cannot satisfy required episodes',()=>{
  const completed=[...completedThrough(7),7,'8',8.5,0,-8,null,undefined,true,NaN,Infinity,30];
  const state=getEditorialState(item,{...context,completed});
  assert.equal(state.status,'locked');
  assert.equal(state.nextEpisode,8);
  assert.equal(getEditorialState(item,{...context,completed:[...completed,8]}).status,'ready');
  for(const invalid of [null,8,{},'8']){
    assert.equal(getEditorialState(item,{...context,completed:invalid}).nextEpisode,1);
  }
});

test('missing schedule and unusable times fail closed',()=>{
  assert.deepEqual(getEditorialState(item,{...context,releases:[]}),{release:null,status:'unavailable',nextEpisode:null});
  assert.deepEqual(getEditorialState(item),{release:null,status:'unavailable',nextEpisode:null});
  const malformedRelease={date:'invalid',time:'18:00',from:7,to:8};
  assert.deepEqual(getEditorialState(item,{...context,releases:[malformedRelease]}),{release:malformedRelease,status:'unavailable',nextEpisode:null});
  for(const now of ['invalid',undefined,null,NaN,Infinity]){
    assert.equal(getEditorialState(item,{...context,now}).status,'unavailable');
    assert.equal(getEditorialState(item,{...context,now}).nextEpisode,null);
  }
});

test('a missing prerequisite is never offered for playback before its own release',()=>{
  const releases=[
    {date:'2026-10-16',time:'18:00',from:1,to:7},
    {date:'2026-10-14',time:'18:00',from:8,to:8},
  ];
  const state=getEditorialState(item,{...context,releases,completed:new Set([8])});
  assert.equal(state.status,'locked');
  assert.equal(state.nextEpisode,null);
  const missingSchedule=getEditorialState(item,{...context,releases:releases.slice(1),completed:new Set([8])});
  assert.equal(missingSchedule.status,'locked');
  assert.equal(missingSchedule.nextEpisode,null);
});

test('invalid editorial configuration fails explicitly rather than revealing content',()=>{
  for(const episode of [0,-1,8.5,'8',undefined]){
    assert.throws(()=>getEditorialState({episode},context),RangeError);
  }
  for(const requiresEpisodes of [[],new Array(2),null,'8',new Set([8]),[0],[-1],[8.5],['8'],[9],[NaN],[Infinity]]){
    assert.throws(()=>getEditorialState({episode:8,requiresEpisodes},context),RangeError);
  }
});

test('states contain only eligibility metadata and never editorial content',()=>{
  for(const completed of [new Set(),completedThrough(8)]){
    const state=getEditorialState(item,{...context,completed});
    assert.deepEqual(Object.keys(state).sort(),['nextEpisode','release','status']);
    assert.ok(!JSON.stringify(state).includes('Private'));
    assert.ok(!JSON.stringify(state).includes('private-image'));
  }
});
