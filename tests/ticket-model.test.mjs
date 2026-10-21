import test from 'node:test';
import assert from 'node:assert/strict';
import {drama,demoSession} from '../dist/drama-config.mjs';
import {getSummary} from '../dist/calendar-model.mjs';
import {ticketLevels,getTicketProgress,getTicketUpgrade,getRewardDemoScenario} from '../dist/ticket-model.mjs';

const through=count=>Array.from({length:count},(_,index)=>index+1);

test('one ticket has three ordered paper, foil and holographic levels',()=>{
  assert.deepEqual(ticketLevels,[
    {level:1,episode:10,name:'初程票',finish:'paper'},
    {level:2,episode:18,name:'同行票',finish:'foil'},
    {level:3,episode:30,name:'典藏票',finish:'holo'},
  ]);
  assert.ok(Object.isFrozen(ticketLevels));
  assert.ok(ticketLevels.every(Object.isFrozen));
});

test('before the first milestone there is no issued ticket and progress points to the first missing episode',()=>{
  assert.deepEqual(getTicketProgress(),{
    current:null,next:ticketLevels[0],currentLevel:0,watchedCount:0,
    nextProgress:{watchedCount:0,total:10,remaining:10,nextEpisode:1,unlocked:false},
  });
  assert.deepEqual(getTicketProgress(new Set([1,2,7,8])).nextProgress,{watchedCount:4,total:10,remaining:6,nextEpisode:3,unlocked:false});
});

test('the same ticket progresses through all levels and has no next target after completion',()=>{
  const near=getTicketProgress(through(9));
  assert.equal(near.current,null);
  assert.deepEqual(near.nextProgress,{watchedCount:9,total:10,remaining:1,nextEpisode:10,unlocked:false});
  const first=getTicketProgress(through(10));
  assert.equal(first.current,ticketLevels[0]);
  assert.equal(first.currentLevel,1);
  assert.equal(first.next,ticketLevels[1]);
  assert.deepEqual(first.nextProgress,{watchedCount:10,total:18,remaining:8,nextEpisode:11,unlocked:false});
  const second=getTicketProgress(through(18));
  assert.equal(second.current,ticketLevels[1]);
  assert.equal(second.currentLevel,2);
  assert.equal(second.next,ticketLevels[2]);
  assert.deepEqual(second.nextProgress,{watchedCount:18,total:30,remaining:12,nextEpisode:19,unlocked:false});
  assert.deepEqual(getTicketProgress(through(30)),{current:ticketLevels[2],next:null,currentLevel:3,watchedCount:30,nextProgress:null});
});

test('watching a milestone episode out of order never substitutes for completing its prerequisites',()=>{
  const missingNine=new Set([...through(8),10]);
  const progress=getTicketProgress(missingNine);
  assert.equal(progress.currentLevel,0);
  assert.deepEqual(progress.nextProgress,{watchedCount:9,total:10,remaining:1,nextEpisode:9,unlocked:false});
  const missingFive=through(30).filter(episode=>episode!==5);
  const incomplete=getTicketProgress(missingFive);
  assert.equal(incomplete.watchedCount,29);
  assert.equal(incomplete.current,null);
  assert.equal(incomplete.nextProgress.nextEpisode,5);
  assert.equal(getTicketUpgrade(missingFive,[...missingFive,5]),ticketLevels[2]);
});

test('global watched count includes all unique valid episodes but next progress counts only its own target',()=>{
  const completed=[...through(9),18,30,9,'10',9.5,0,-1,31,null,undefined,true,NaN,Infinity,Number.MAX_SAFE_INTEGER+1];
  const progress=getTicketProgress(completed);
  assert.equal(progress.watchedCount,11);
  assert.deepEqual(progress.nextProgress,{watchedCount:9,total:10,remaining:1,nextEpisode:10,unlocked:false});
  for(const invalid of [null,{},30,'10'])assert.equal(getTicketProgress(invalid).watchedCount,0);
});

test('ticket upgrades report only the highest newly unlocked level, including multi-level jumps',()=>{
  assert.equal(getTicketUpgrade(through(8),through(9)),null);
  assert.equal(getTicketUpgrade(through(9),through(10)),ticketLevels[0]);
  assert.equal(getTicketUpgrade(through(17),through(18)),ticketLevels[1]);
  assert.equal(getTicketUpgrade(through(29),through(30)),ticketLevels[2]);
  assert.equal(getTicketUpgrade([],through(18)),ticketLevels[1]);
  assert.equal(getTicketUpgrade(through(10),through(30)),ticketLevels[2]);
  assert.equal(getTicketUpgrade([],through(30)),ticketLevels[2]);
});

test('replays, later non-milestone episodes and reductions in history never retrigger upgrades',()=>{
  assert.equal(getTicketUpgrade(through(10),[...through(10),10]),null);
  assert.equal(getTicketUpgrade(through(10),through(11)),null);
  assert.equal(getTicketUpgrade(through(30),through(30)),null);
  assert.equal(getTicketUpgrade(through(30),through(10)),null);
  assert.equal(getTicketUpgrade([1,2,7,8],[1,2,7,8,10]),null);
});

test('custom levels are evaluated in level order without mutating their configuration or history',()=>{
  const levels=[{level:2,episode:20,name:'Second'},{level:1,episode:12,name:'First'}];
  const completed=through(14).reverse();
  const originalLevels=structuredClone(levels),originalHistory=[...completed];
  const progress=getTicketProgress(completed,levels);
  assert.equal(progress.currentLevel,1);
  assert.equal(progress.current,levels[1]);
  assert.equal(progress.next,levels[0]);
  assert.deepEqual(progress.nextProgress,{watchedCount:14,total:20,remaining:6,nextEpisode:15,unlocked:false});
  assert.deepEqual(levels,originalLevels);
  assert.deepEqual(completed,originalHistory);
  assert.deepEqual(getTicketProgress(completed,[]),{current:null,next:null,currentLevel:0,watchedCount:14,nextProgress:null});
});

test('invalid custom level definitions fail explicitly',()=>{
  const invalid=[null,{},new Array(1),[{level:0,episode:10}],[{level:'1',episode:10}],[{level:1,episode:31}],
    [{level:1,episode:10},{level:1,episode:18}],[{level:1,episode:18},{level:2,episode:10}],
    [{level:1,episode:10},{level:2,episode:10}]];
  for(const levels of invalid)assert.throws(()=>getTicketProgress(through(30),levels),RangeError);
});

test('reward scenarios supply explicit clocks, completed records and relevant calendar focus dates',()=>{
  const expected={
    near:{count:9,date:'2026-10-15',focusDate:'2026-10-14'},
    first:{count:10,date:'2026-10-15',focusDate:'2026-10-14'},
    second:{count:18,date:'2026-10-18',focusDate:'2026-10-18'},
    final:{count:30,date:'2026-10-27',focusDate:'2026-10-27'},
  };
  for(const [key,{count,date,focusDate}] of Object.entries(expected)){
    const scenario=getRewardDemoScenario(key);
    assert.deepEqual(scenario,{now:`${date}T19:00:00+08:00`,completed:through(count),focusDate});
    assert.ok(getSummary(drama,'vip',scenario.now).available>=count);
  }
});

test('reward demo scenario lookup rejects unknown keys and returns independent mutable records',()=>{
  for(const key of [undefined,null,'unknown','Near','constructor','__proto__','toString',{},Symbol('near')]){
    assert.equal(getRewardDemoScenario(key),null);
  }
  const first=getRewardDemoScenario('near');
  first.completed.push(10);
  first.now='changed';
  assert.equal(getRewardDemoScenario('near').completed.length,9);
  assert.equal(getRewardDemoScenario('near').now,'2026-10-15T19:00:00+08:00');
});

test('scenario and ticket calculations never alter the shared clock, membership or release rules',()=>{
  const configBefore=structuredClone(drama),sessionBefore=structuredClone(demoSession);
  const summaries=Object.fromEntries(['free','vip','svip'].map(tier=>[tier,getSummary(drama,tier,demoSession.now)]));
  for(const key of ['near','first','second','final']){
    const scenario=getRewardDemoScenario(key);
    getTicketProgress(scenario.completed);
    getTicketUpgrade([],scenario.completed);
  }
  assert.deepEqual(drama,configBefore);
  assert.deepEqual(demoSession,sessionBefore);
  for(const tier of Object.keys(summaries))assert.deepEqual(getSummary(drama,tier,demoSession.now),summaries[tier]);
});
