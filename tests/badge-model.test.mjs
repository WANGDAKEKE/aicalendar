import test from 'node:test';
import assert from 'node:assert/strict';
import {drama} from '../dist/drama-config.mjs';
import {getSchedule} from '../dist/calendar-model.mjs';
import {getBadgeProgress,getBadgeRelease,newlyUnlockedBadges} from '../dist/badge-model.mjs';

const completedThrough=episode=>new Set(Array.from({length:episode},(_,index)=>index+1));
const firstBadge=drama.badges[0];

test('first badge moves from 8/10 through 9/10 to automatically unlocked',()=>{
  assert.deepEqual(getBadgeProgress(firstBadge,completedThrough(8)),{watchedCount:8,total:10,remaining:2,unlocked:false,nextEpisode:9});
  assert.deepEqual(getBadgeProgress(firstBadge,completedThrough(9)),{watchedCount:9,total:10,remaining:1,unlocked:false,nextEpisode:10});
  assert.deepEqual(getBadgeProgress(firstBadge,completedThrough(10)),{watchedCount:10,total:10,remaining:0,unlocked:true,nextEpisode:null});
});

test('out-of-order and skipped episodes do not unlock a badge early',()=>{
  const skipped=new Set([10,8,7,6,5,4,3,2,1]);
  assert.deepEqual(getBadgeProgress(firstBadge,skipped),{watchedCount:9,total:10,remaining:1,unlocked:false,nextEpisode:9});
  const after=new Set([...skipped,9]);
  assert.deepEqual(newlyUnlockedBadges(drama.badges,skipped,after),[firstBadge]);
});

test('every configured badge requires all of its own episodes',()=>{
  for(const badge of drama.badges){
    const before=completedThrough(badge.episode-1);
    assert.equal(getBadgeProgress(badge,before).unlocked,false);
    assert.equal(getBadgeProgress(badge,before).nextEpisode,badge.episode);
    assert.deepEqual(getBadgeProgress(badge,completedThrough(badge.episode)),{watchedCount:badge.episode,total:badge.episode,remaining:0,unlocked:true,nextEpisode:null});
  }
});

test('replaying an episode or a completed milestone does not trigger another unlock',()=>{
  assert.deepEqual(newlyUnlockedBadges(drama.badges,completedThrough(8),completedThrough(9)),[]);
  assert.deepEqual(newlyUnlockedBadges(drama.badges,completedThrough(9),completedThrough(10)),[firstBadge]);
  assert.deepEqual(newlyUnlockedBadges(drama.badges,completedThrough(10),new Set([...completedThrough(10),10])),[]);
  assert.deepEqual(newlyUnlockedBadges(drama.badges,completedThrough(10),completedThrough(18)),[drama.badges[1]]);
  assert.deepEqual(newlyUnlockedBadges(drama.badges,completedThrough(18),completedThrough(30)),[drama.badges[2]]);
  assert.deepEqual(newlyUnlockedBadges(drama.badges,completedThrough(30),completedThrough(30)),[]);
});

test('invalid history elements, duplicates and episodes beyond a badge do not inflate progress',()=>{
  const history=[...completedThrough(8),8,10,'9',9.5,0,-1,null,undefined,true,NaN,Infinity,11,30,Number.MAX_SAFE_INTEGER+1];
  assert.deepEqual(getBadgeProgress(firstBadge,history),{watchedCount:9,total:10,remaining:1,unlocked:false,nextEpisode:9});
  assert.deepEqual(getBadgeProgress(firstBadge),{watchedCount:0,total:10,remaining:10,unlocked:false,nextEpisode:1});
});

test('badge releases follow the independent schedule of each account tier',()=>{
  const expected={
    vip:['2026-10-15','2026-10-20','2026-10-27'],
    svip:['2026-10-14','2026-10-19','2026-10-26'],
    free:['2026-10-22','2026-10-31','2026-11-14'],
  };
  for(const [tier,dates] of Object.entries(expected)){
    const {releases}=getSchedule(drama,tier);
    assert.deepEqual(drama.badges.map(badge=>getBadgeRelease(badge,releases)?.date),dates);
    for(const badge of drama.badges){
      const release=getBadgeRelease(badge,releases);
      assert.ok(releases.includes(release));
      assert.ok(release.from<=badge.episode&&badge.episode<=release.to);
      assert.equal(release.time,'18:00');
    }
  }
});

test('missing releases return null without inventing a milestone date',()=>{
  assert.equal(getBadgeRelease(firstBadge,[]),null);
  assert.equal(getBadgeRelease(firstBadge,[{date:'2026-10-01',from:1,to:8}]),null);
  assert.equal(getBadgeRelease(firstBadge,[{date:'2026-10-01',from:'1',to:'10'}]),null);
});

test('invalid badge configuration fails explicitly',()=>{
  for(const episode of [0,-1,1.5,'10',undefined]){
    assert.throws(()=>getBadgeProgress({episode},completedThrough(10)),RangeError);
    assert.throws(()=>getBadgeRelease({episode},[]),RangeError);
  }
});
