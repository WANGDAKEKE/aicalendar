import test from 'node:test';
import assert from 'node:assert/strict';
import {drama,demoSession} from '../dist/drama-config.mjs';
import {getSchedule,getSummary} from '../dist/calendar-model.mjs';
import {getDateOperations} from '../dist/operations-model.mjs';

const highlight={id:'journey',episode:8,icon:'🎭',title:'旅途初章'};
const screening={id:'screening',date:'2026-10-19',time:'19:00',endTime:'21:00',title:'大结局点映礼',from:27,to:30,tiers:['vip','svip'],accessNote:'需单独购买活动资格'};
const configured={...drama,calendarHighlights:[highlight],screeningEvents:[screening]};
const context={tier:'vip',date:screening.date,now:demoSession.now};

test('episode highlights map to each resolved entitlement schedule',()=>{
  const expected={vip:'2026-10-13',svip:'2026-10-12',free:'2026-10-17',unknown:'2026-10-17'};
  for(const [tier,date] of Object.entries(expected)){
    assert.deepEqual(getDateOperations(configured,{...context,tier,date}).highlights,[highlight]);
  }
  assert.deepEqual(getDateOperations(configured,{...context,tier:'unknown',date:'2026-10-13'}).highlights,[]);
  assert.deepEqual(getDateOperations(configured,{...context,tier:null,date:'2026-10-17'}).highlights,[highlight]);
});

test('screening state uses exact +08:00 boundaries with an exclusive ending',()=>{
  const cases=[
    ['2026-10-19T18:59:59+08:00','upcoming'],
    ['2026-10-19T19:00:00+08:00','live'],
    ['2026-10-19T20:59:59+08:00','live'],
    ['2026-10-19T21:00:00+08:00','ended'],
    ['2026-10-19T11:00:00Z','live'],
    [Date.parse('2026-10-19T19:00:00+08:00'),'live'],
    [new Date('2026-10-19T21:00:00+08:00'),'ended'],
  ];
  for(const [now,status] of cases){
    assert.equal(getDateOperations(configured,{...context,now}).events[0].status,status);
  }
});

test('screening tiers filter visibility, while omission shows every resolved identity',()=>{
  for(const tier of ['vip','svip'])assert.equal(getDateOperations(configured,{...context,tier}).events.length,1);
  for(const tier of ['free','unknown',null])assert.equal(getDateOperations(configured,{...context,tier}).events.length,0);
  const {tiers,...publicScreening}=screening;
  const publicConfig={...configured,screeningEvents:[publicScreening]};
  for(const tier of ['vip','svip','free','unknown',null])assert.equal(getDateOperations(publicConfig,{...context,tier}).events.length,1);
  const freeConfig={...configured,screeningEvents:[{...screening,tiers:['free']}]};
  assert.equal(getDateOperations(freeConfig,{...context,tier:'unknown'}).events.length,1);
});

test('explicit event dates remain visible on a day with no regular episode release',()=>{
  assert.equal(getSchedule(configured,'vip').releases.some(release=>release.date===screening.date),false);
  assert.equal(getDateOperations(configured,context).events[0].date,screening.date);
  assert.deepEqual(getDateOperations(configured,{...context,date:'2026-10-20'}).events,[]);
});

test('multiple highlights and screenings coexist without replacing the regular release',()=>{
  const date='2026-10-14';
  const calendarHighlights=[{...highlight,id:'one',episode:9},{...highlight,id:'two',episode:10}];
  const screeningEvents=[{...screening,id:'one',date},{...screening,id:'two',date,time:'21:00',endTime:'22:00'}];
  const result=getDateOperations({...configured,calendarHighlights,screeningEvents},{...context,date});
  assert.deepEqual(result.highlights,calendarHighlights);
  assert.deepEqual(result.events.map(event=>event.id),['one','two']);
  assert.equal(getSummary(configured,'vip',demoSession.now).todayRelease.to,12);
});

test('operations never mutate normal releases, availability or personal finale dates',()=>{
  const before=structuredClone(configured);
  for(const tier of ['vip','svip','free']){
    const normal=getSummary(drama,tier,demoSession.now);
    getDateOperations(configured,{...context,tier,now:'2026-10-19T20:00:00+08:00'});
    assert.deepEqual(getSummary(configured,tier,demoSession.now),normal);
  }
  assert.deepEqual(configured,before);
  assert.equal(getSummary(configured,'vip',demoSession.now).available,12);
  assert.equal(getSummary(configured,'vip',demoSession.now).finale.date,'2026-10-27');
});

test('invalid or unmatched highlights are ignored',()=>{
  const calendarHighlights=[null,{},...[0,-1,8.5,'8',31,NaN].map(episode=>({...highlight,episode})),{...highlight,id:''},{...highlight,title:''},{...highlight,icon:''}];
  assert.deepEqual(getDateOperations({...configured,calendarHighlights},{...context,date:'2026-10-13'}).highlights,[]);
});

test('invalid event times, ranges, visibility and metadata fail closed',()=>{
  const invalid=[
    null,{},
    {time:'24:00'},{time:'19:60'},{time:'9:00'},
    {endTime:'19:00'},{endTime:'18:59'},{endTime:'2026-10-20T21:00'},
    {from:0},{from:31},{from:'27'},{to:26},{to:31},{to:30.5},
    {tiers:null},{tiers:'vip'},{tiers:[]},{tiers:['vip','unknown']},{tiers:new Array(1)},
    {id:''},{title:''},{accessNote:7},
  ];
  for(const override of invalid){
    const event=override===null?null:Object.keys(override).length?{...screening,...override}:{};
    assert.deepEqual(getDateOperations({...configured,screeningEvents:[event]},context).events,[]);
  }
});

test('invalid dates and collection configuration return no operations',()=>{
  for(const date of ['2026-02-30','2026-13-01','2026-10-1','invalid',undefined]){
    const config={...configured,screeningEvents:[{...screening,date}]};
    assert.deepEqual(getDateOperations(config,{...context,date}),{highlights:[],events:[]});
  }
  assert.deepEqual(getDateOperations({...drama,calendarHighlights:{},screeningEvents:{}},context),{highlights:[],events:[]});
  assert.deepEqual(getDateOperations({},context),{highlights:[],events:[]});
  assert.deepEqual(getDateOperations(null,context),{highlights:[],events:[]});
});

test('invalid now suppresses events but retains valid episode highlights',()=>{
  const date='2026-10-13';
  const config={...configured,screeningEvents:[{...screening,date}]};
  for(const now of ['invalid','2026-02-30T19:00:00+08:00','2026-10-13T19:00:00','2026-10-13',undefined,null,NaN,Infinity,new Date(NaN)]){
    assert.deepEqual(getDateOperations(config,{...context,date,now}),{highlights:[highlight],events:[]});
  }
});

test('event output contains no playback permission even if configuration includes one',()=>{
  const event={...screening,canPlay:true,available:30,playbackUrl:'https://example.invalid/stream'};
  const result=getDateOperations({...configured,screeningEvents:[event]},context).events[0];
  assert.deepEqual(result,{...screening,status:'upcoming'});
  assert.equal(Object.hasOwn(result,'canPlay'),false);
  assert.equal(Object.hasOwn(result,'available'),false);
  assert.equal(Object.hasOwn(result,'playbackUrl'),false);
});
