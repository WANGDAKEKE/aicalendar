import test from 'node:test';
import assert from 'node:assert/strict';
import {zhanshenAnime,createZhanshenSession,selectZhanshenCalendar} from '../dist/zhanshen-calendar-model.mjs';
import {
  createZhanshenRefineSession,selectZhanshenRefineCalendar,setZhanshenRefinePreview,
  shiftZhanshenRefinePeriod,switchZhanshenRefineMode,
} from '../dist/zhanshen-calendar-refine-model.mjs';

const TIERS=['free','vip','svip'];
const OPERATIONS_COPY={title:'每周四限免更新',subtitle:'12月3日第2–15集回锁会员'};
const expectedMarketing=tier=>tier==='svip'
  ?{...OPERATIONS_COPY,kind:'none',tier:null,cta:''}
  :{...OPERATIONS_COPY,kind:'membership',tier:tier==='free'?'vip':'svip',cta:tier==='free'?'升级VIP':'升级SVIP'};
const published=[
  ['2026-10-29',2,3],['2026-11-05',4,6],['2026-11-12',7,9],
  ['2026-11-19',10,12],['2026-11-26',13,15],['2026-12-03',2,15],
];
const assertUnknownPlayback=view=>{
  assert.deepEqual(view.availableEpisodes,[]);
  assert.equal(view.nextEpisode,null);
  assert.deepEqual(view.schedule.availableEpisodes,[]);
  assert.equal(view.schedule.nextEpisode,null);
  assert.equal(view.updateTime,null);
  assert.equal(view.schedule.updateTime,null);
};

test('all identities default to one audience-wide campaign and preserve original 3/9/15 demo tickets',()=>{
  let shared;
  for(const tier of TIERS){
    const session=createZhanshenRefineSession({tier});
    const view=selectZhanshenRefineCalendar(session);
    assert.equal(session.accountTier,tier);
    assert.equal(session.previewTier,'free');
    assert.equal(session.today,'2026-11-05');
    assert.equal(session.mode,'week');
    assert.deepEqual(session.completed,new Set([1,2,3]));
    assert.equal(session.reminded,false);
    assert.equal(session.widgetPreviewed,false);
    assert.equal(view.accountTier,tier);
    assert.equal(view.previewTier,'free');
    assert.equal(view.isPreview,false);
    assert.equal(view.schedule.scheduleType,'limited-free');
    assert.equal(view.schedule.audience,'all');
    assert.equal(view.schedule.scheduleKnown,true);
    assert.equal(Object.hasOwn(view.schedule,'accountTier'),false);
    assert.equal(Object.hasOwn(view.schedule,'previewTier'),false);
    assert.equal(view.completedCount,3);
    assert.equal(view.ticket.current.name,'初程票');
    assert.equal(view.ticket.nextCount,9);
    assert.deepEqual(view.ticket.levels.map(level=>level.episode),[3,9,15]);
    assertUnknownPlayback(view);
    if(shared)assert.equal(JSON.stringify(view.schedule),shared);
    else shared=JSON.stringify(view.schedule);
  }
  assert.equal(createZhanshenRefineSession().accountTier,'vip');
});

test('every legacy preview option, session value and setter argument is inert for campaign, account and tickets',()=>{
  const legacy=['free','vip','svip','VIP','constructor','__proto__','',null,undefined,{},[],Symbol('svip')];
  for(const tier of TIERS){
    const original={...createZhanshenRefineSession({tier}),reminded:true,widgetPreviewed:true};
    const before=structuredClone(original),baseline=selectZhanshenRefineCalendar(original);
    for(const previewTier of legacy){
      const created=createZhanshenRefineSession({tier,previewTier});
      const changed=setZhanshenRefinePreview({...original,previewTier},previewTier);
      assert.equal(created.previewTier,'free');
      assert.equal(changed.previewTier,'free');
      assert.equal(changed.accountTier,tier);
      assert.equal(changed.reminded,true);
      assert.equal(changed.widgetPreviewed,true);
      assert.deepEqual(changed.completed,original.completed);
      assert.notEqual(changed.completed,original.completed);
      for(const session of [created,changed,{...original,previewTier}]){
        const view=selectZhanshenRefineCalendar(session);
        assert.equal(view.previewTier,'free');
        assert.equal(view.isPreview,false);
        assert.equal(JSON.stringify(view.schedule),JSON.stringify(baseline.schedule));
        assert.deepEqual(view.ticket,baseline.ticket);
        assert.deepEqual(view.marketing,expectedMarketing(tier));
        assertUnknownPlayback(view);
      }
    }
    assert.deepEqual(original,before);
  }
});

test('legacy URL preview values cannot hide activities, switch identities or imply paid playback access',()=>{
  for(const tier of TIERS){
    const baseline=selectZhanshenRefineCalendar(createZhanshenRefineSession({tier}));
    for(const preview of ['free','vip','svip','__proto__','not-a-tier']){
      const query=new URLSearchParams('tier='+tier+'&preview='+encodeURIComponent(preview));
      const session=createZhanshenRefineSession({tier:query.get('tier'),previewTier:query.get('preview')});
      const view=selectZhanshenRefineCalendar(session);
      assert.equal(view.accountTier,tier);
      assert.equal(view.isPreview,false);
      assert.equal(JSON.stringify(view.schedule),JSON.stringify(baseline.schedule));
      assertUnknownPlayback(view);
    }
  }
});

test('complete published campaign remains intact including season-free and membership relock events',()=>{
  for(const tier of TIERS){
    const session=createZhanshenRefineSession({tier});
    const view=selectZhanshenRefineCalendar(session),actual=selectZhanshenCalendar(session);
    for(const [key,value] of Object.entries(actual))assert.deepEqual(view[key],value,tier+'/'+key);
    assert.deepEqual(view.schedule.events.map(({date,from,to})=>[date,from,to]),published);
    assert.deepEqual(view.schedule.days,actual.days);
    assert.deepEqual(view.schedule.selectedEvent,actual.selectedEvent);
    assert.equal(view.schedule.cells,view.schedule.days);
    assert.ok(view.schedule.events.every(event=>event.time===null));
    const season=selectZhanshenRefineCalendar(createZhanshenRefineSession({tier,today:'2026-11-26'}));
    assert.equal(season.schedule.selectedEvent.kind,'free');
    assert.equal(season.schedule.selectedEvent.isSeasonFree,true);
    assert.deepEqual([season.schedule.selectedEvent.from,season.schedule.selectedEvent.to],[13,15]);
    const relock=selectZhanshenRefineCalendar(createZhanshenRefineSession({tier,today:'2026-12-03'}));
    assert.equal(relock.schedule.selectedEvent.kind,'relock');
    assert.deepEqual([relock.schedule.selectedEvent.from,relock.schedule.selectedEvent.to],[2,15]);
    assert.equal(relock.schedule.phase,'relocked');
    assertUnknownPlayback(relock);
  }
});

test('membership entries stay independent of the common activity schedule and actual SVIP has no CTA',()=>{
  for(const tier of TIERS)for(const previewTier of TIERS){
    const view=selectZhanshenRefineCalendar(createZhanshenRefineSession({tier,previewTier}));
    assert.deepEqual(view.marketing,expectedMarketing(tier));
    assert.doesNotMatch(JSON.stringify(view.marketing),/18点|抢先看1集|多看|点映礼/);
    if(tier==='svip'){
      assert.equal(view.marketing.kind,'none');
      assert.equal(view.marketing.tier,null);
      assert.equal(view.marketing.cta,'');
    }
  }
});

test('navigation keeps one common campaign through November, December and the year boundary',()=>{
  const scheduleSnapshots=[];
  for(const tier of TIERS){
    const original={...createZhanshenRefineSession({tier,today:'2026-11-26'}),reminded:true,widgetPreviewed:true};
    const before=structuredClone(original);
    const month=switchZhanshenRefineMode(original,'month');
    const december=shiftZhanshenRefinePeriod(month,1);
    const january=shiftZhanshenRefinePeriod(december,1);
    const week=switchZhanshenRefineMode(january,'week');
    assert.equal(december.month,'2026-12');
    assert.equal(january.month,'2027-01');
    assert.equal(week.weekStart,'2026-12-28');
    const decemberView=selectZhanshenRefineCalendar(december);
    assert.equal(decemberView.schedule.days.filter(day=>day.event).length,1);
    assert.equal(decemberView.schedule.days.find(day=>day.date==='2026-12-03').event.kind,'relock');
    const januaryView=selectZhanshenRefineCalendar(january);
    assert.ok(januaryView.schedule.days.every(day=>day.event===null));
    assert.equal(januaryView.schedule.events.length,6);
    for(const changed of [month,december,january,week,shiftZhanshenRefinePeriod(original,1)]){
      assert.equal(changed.accountTier,tier);
      assert.equal(changed.previewTier,'free');
      assert.equal(changed.today,original.today);
      assert.equal(changed.reminded,true);
      assert.equal(changed.widgetPreviewed,true);
      assert.deepEqual(changed.completed,original.completed);
      assert.notEqual(changed.completed,original.completed);
      assertUnknownPlayback(selectZhanshenRefineCalendar(changed));
    }
    scheduleSnapshots.push(JSON.stringify([month,december,january,week].map(session=>selectZhanshenRefineCalendar(session).schedule)));
    assert.deepEqual(original,before);
  }
  assert.equal(new Set(scheduleSnapshots).size,1);
});

test('date phases describe activity only, not authorization or loss of existing member rights',()=>{
  for(const today of ['2026-10-28','2026-10-29','2026-12-02','2026-12-03','2027-01-01']){
    const schedules=[];
    for(const tier of TIERS){
      const view=selectZhanshenRefineCalendar(createZhanshenRefineSession({tier,today}));
      const base=selectZhanshenCalendar(createZhanshenSession({today}));
      assert.equal(view.today,today);
      assert.equal(view.phase,base.phase);
      assert.match(view.schedule.scheduleNote,/面向所有身份的限免活动排期，不是会员排播或播放授权/);
      assert.match(view.schedule.scheduleNote,/回锁表示限免结束，不代表撤销已具备的会员观看权限/);
      assert.match(view.schedule.scheduleNote,/第1集权益未提供/);
      assertUnknownPlayback(view);
      schedules.push(JSON.stringify(view.schedule));
    }
    assert.equal(new Set(schedules).size,1);
  }
});

test('invalid identities and inherited fields fail safely while legacy preview pollution is ignored',()=>{
  for(const invalid of ['VIP','__proto__','constructor','toString','',null,{},[],Symbol('svip')]){
    const session=createZhanshenRefineSession({tier:invalid,previewTier:invalid,today:'2026-02-31',mode:'daily'});
    assert.equal(session.accountTier,'free');
    assert.equal(session.previewTier,'free');
    assert.equal(session.today,'2026-11-05');
    assert.equal(session.mode,'week');
    assertUnknownPlayback(selectZhanshenRefineCalendar(session));
  }
  const inherited=Object.create({accountTier:'svip',previewTier:'svip',today:'2026-12-03',completed:[1,2,3,4],reminded:true,widgetPreviewed:true});
  const view=selectZhanshenRefineCalendar(inherited);
  assert.equal(view.accountTier,'vip');
  assert.equal(view.previewTier,'free');
  assert.equal(view.today,'2026-11-05');
  assert.equal(view.completedCount,3);
  assert.equal(createZhanshenRefineSession(Object.create({tier:'svip'})).accountTier,'vip');
  assert.equal(createZhanshenRefineSession(null).accountTier,'vip');
});

test('malformed state and no-op navigation sanitize data without changing activity, history or identity',()=>{
  const source={...createZhanshenRefineSession({tier:'free'}),previewTier:'svip',today:null,month:'2026-13',weekStart:'bad',selectedDate:'2026-11-31',completed:[1,1,3,0,16],reminded:'true',widgetPreviewed:1};
  const before=structuredClone(source),view=selectZhanshenRefineCalendar(source);
  assert.equal(view.today,'2026-11-05');assert.equal(view.month,'2026-11');assert.equal(view.weekStart,'2026-11-02');
  assert.equal(view.selectedDate,'2026-11-05');assert.equal(view.completedCount,2);assert.equal(view.ticket.currentLevel,0);
  for(const delta of [Infinity,'1',1201,1.5]){
    const changed=shiftZhanshenRefinePeriod(source,delta);
    assert.equal(changed.weekStart,'2026-11-02');assert.equal(changed.accountTier,'free');assert.equal(changed.previewTier,'free');
    assert.equal(changed.reminded,false);assert.equal(changed.widgetPreviewed,false);
    assert.equal(JSON.stringify(selectZhanshenRefineCalendar(changed).schedule),JSON.stringify(view.schedule));
  }
  assert.equal(switchZhanshenRefineMode(source,'daily').mode,'week');
  assert.deepEqual(source,before);
});

test('projections and compatibility calls never mutate screenshot data, root events or another session',()=>{
  const first=createZhanshenRefineSession({tier:'vip'}),second=createZhanshenRefineSession({tier:'vip'});
  const original=structuredClone(zhanshenAnime);
  first.completed.add(4);
  assert.equal(second.completed.has(4),false);
  const before=structuredClone(first);
  setZhanshenRefinePreview(first,'svip');
  assert.deepEqual(first,before);
  const view=selectZhanshenRefineCalendar(first);
  view.schedule.days.find(day=>day.event).event.from=999;
  view.schedule.events[0].title='changed';
  view.schedule.ticket.levels[0].episode=99;
  assert.equal(view.days.find(day=>day.event).event.from,4);
  assert.equal(view.events[0].title,'结业大考');
  assert.equal(view.ticket.levels[0].episode,3);
  assert.deepEqual(zhanshenAnime,original);
  const fresh=selectZhanshenRefineCalendar(first);
  assert.equal(fresh.schedule.days.find(day=>day.event).event.from,4);
  assert.equal(fresh.schedule.events[0].title,'结业大考');
  assert.equal(fresh.schedule.ticket.levels[0].episode,3);
  assert.equal(fresh.completedCount,4);
  assertUnknownPlayback(selectZhanshenRefineCalendar(second));
});
