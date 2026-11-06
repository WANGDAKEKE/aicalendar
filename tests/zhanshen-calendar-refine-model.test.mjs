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

test('anime refinement defaults preserve the original date, history and proposed 3/9/15 ticket targets',()=>{
  for(const tier of TIERS){
    const session=createZhanshenRefineSession({tier});
    const view=selectZhanshenRefineCalendar(session);
    assert.equal(session.accountTier,tier);
    assert.equal(session.previewTier,tier);
    assert.equal(session.today,'2026-11-05');
    assert.equal(session.mode,'week');
    assert.deepEqual(session.completed,new Set([1,2,3]));
    assert.equal(session.reminded,false);
    assert.equal(session.widgetPreviewed,false);
    assert.equal(view.isPreview,false);
    assert.equal(view.completedCount,3);
    assert.equal(view.ticket.current.name,'初程票');
    assert.equal(view.ticket.nextCount,9);
    assert.deepEqual(view.ticket.levels.map(level=>level.episode),[3,9,15]);
  }
  assert.equal(createZhanshenRefineSession().accountTier,'vip');
});

test('three real identities and all three previews isolate schedule presentation from actual campaign and ticket data',()=>{
  for(const tier of TIERS){
    const session=createZhanshenRefineSession({tier});
    const before=structuredClone(session);
    const actual=selectZhanshenCalendar(session);
    for(const previewTier of TIERS){
      const changed=setZhanshenRefinePreview(session,previewTier);
      const view=selectZhanshenRefineCalendar(changed);
      assert.equal(changed.accountTier,tier);
      assert.equal(view.accountTier,tier);
      assert.equal(view.previewTier,previewTier);
      assert.equal(view.isPreview,tier!==previewTier);
      for(const [key,value] of Object.entries(actual))assert.deepEqual(view[key],value,`${tier}/${previewTier}/${key}`);
      assert.deepEqual(view.availableEpisodes,[]);
      assert.equal(view.nextEpisode,null);
      assert.deepEqual(view.marketing,expectedMarketing(tier));
      assert.deepEqual(view.schedule.availableEpisodes,[]);
      assert.equal(view.schedule.nextEpisode,null);
      assert.equal(view.schedule.accountTier,previewTier);
      assert.equal(view.schedule.previewTier,previewTier);
      assert.deepEqual(changed.completed,session.completed);
      assert.notEqual(changed.completed,session.completed);
      assert.deepEqual(session,before);
    }
  }
});

test('only the free preview exposes supplied limited-free events; unpublished membership cells remain empty',()=>{
  for(const tier of TIERS){
    for(const previewTier of TIERS){
      const session=createZhanshenRefineSession({tier,previewTier});
      const view=selectZhanshenRefineCalendar(session);
      const actual=selectZhanshenCalendar(session);
      const schedule=view.schedule;
      assert.deepEqual(schedule.days.map(({event,...day})=>day),actual.days.map(({event,...day})=>day));
      assert.equal(schedule.rangeLabel,actual.rangeLabel);
      assert.equal(schedule.selectedDate,actual.selectedDate);
      assert.equal(schedule.updateTime,null);
      if(previewTier==='free'){
        assert.deepEqual(schedule.days,actual.days);
        assert.deepEqual(schedule.events,actual.events);
        assert.equal(schedule.selectedEvent.label,'限免4–6集');
        assert.equal(schedule.scheduleKnown,true);
        assert.equal(schedule.scheduleNote,zhanshenAnime.scheduleNote);
      }else{
        assert.ok(schedule.days.every(day=>day.event===null));
        assert.deepEqual(schedule.events,[]);
        for(const field of ['selectedEvent','todayEvent','latestEvent','nextEvent'])assert.equal(schedule[field],null);
        assert.equal(schedule.selectedDay.event,null);
        assert.equal(schedule.scheduleKnown,false);
        assert.match(schedule.scheduleNote,new RegExp(`${previewTier.toUpperCase()}会员排期待公布`));
        assert.match(schedule.scheduleNote,/不作播放授权判断/);
      }
      assert.equal(schedule.cells,schedule.days);
      assert.deepEqual(view.availableEpisodes,[]);
    }
  }
});

test('marketing uses only anime operations copy and never offers an upgrade to actual SVIP accounts',()=>{
  for(const tier of TIERS){
    for(const previewTier of TIERS){
      const view=selectZhanshenRefineCalendar(createZhanshenRefineSession({tier,previewTier}));
      assert.deepEqual(view.marketing,expectedMarketing(tier));
      assert.doesNotMatch(JSON.stringify(view.marketing),/18点|抢先看1集|多看|点映礼/);
      if(tier==='svip'){
        assert.equal(view.marketing.kind,'none');
        assert.equal(view.marketing.tier,null);
        assert.equal(view.marketing.cta,'');
      }
    }
  }
});

test('week/month navigation preserves identities, feature flags, clock and history through year boundaries',()=>{
  const original={...createZhanshenRefineSession({tier:'free',previewTier:'svip',today:'2026-12-31'}),reminded:true,widgetPreviewed:true};
  const before=structuredClone(original);
  const nextWeek=shiftZhanshenRefinePeriod(original,1);
  assert.equal(nextWeek.weekStart,'2027-01-04');
  assert.equal(nextWeek.selectedDate,'2027-01-04');
  assert.equal(nextWeek.month,'2027-01');
  const month=switchZhanshenRefineMode(original,'month');
  const january=shiftZhanshenRefinePeriod(month,1);
  assert.equal(january.month,'2027-01');
  assert.equal(january.selectedDate,'2027-01-01');
  const week=switchZhanshenRefineMode(january,'week');
  assert.equal(week.weekStart,'2026-12-28');
  for(const changed of [nextWeek,month,january,week,shiftZhanshenRefinePeriod(january,-1)]){
    assert.equal(changed.accountTier,'free');
    assert.equal(changed.previewTier,'svip');
    assert.equal(changed.today,original.today);
    assert.equal(changed.reminded,true);
    assert.equal(changed.widgetPreviewed,true);
    assert.deepEqual(changed.completed,original.completed);
    assert.notEqual(changed.completed,original.completed);
    assert.deepEqual(selectZhanshenRefineCalendar(changed).availableEpisodes,[]);
  }
  assert.deepEqual(original,before);
});

test('campaign boundary dates remain queries rather than grants of free or member playback',()=>{
  for(const today of ['2026-10-28','2026-10-29','2026-12-02','2026-12-03','2027-01-01']){
    for(const tier of TIERS){
      for(const previewTier of TIERS){
        const view=selectZhanshenRefineCalendar(createZhanshenRefineSession({tier,previewTier,today}));
        const base=selectZhanshenCalendar(createZhanshenSession({today}));
        assert.equal(view.today,today);
        assert.equal(view.phase,base.phase);
        assert.deepEqual(view.availableEpisodes,[]);
        assert.equal(view.nextEpisode,null);
        assert.deepEqual(view.marketing,expectedMarketing(tier));
        assert.deepEqual(view.schedule.availableEpisodes,[]);
        if(previewTier!=='free')assert.ok(view.schedule.days.every(day=>day.event===null));
      }
    }
  }
});

test('invalid tier names, prototype properties and malformed dates cannot create member authorization',()=>{
  for(const invalid of ['VIP','__proto__','constructor','toString','',null,{},[],Symbol('svip')]){
    const session=createZhanshenRefineSession({tier:invalid,previewTier:invalid,today:'2026-02-31',mode:'daily'});
    assert.equal(session.accountTier,'free');
    assert.equal(session.previewTier,'free');
    assert.equal(session.today,'2026-11-05');
    assert.equal(session.mode,'week');
    assert.deepEqual(selectZhanshenRefineCalendar(session).availableEpisodes,[]);
    const reset=setZhanshenRefinePreview(createZhanshenRefineSession({tier:'vip',previewTier:'svip'}),invalid);
    assert.equal(reset.accountTier,'vip');
    assert.equal(reset.previewTier,'vip');
  }
  const inherited=Object.create({accountTier:'svip',previewTier:'svip',today:'2026-12-03',completed:[1,2,3,4],reminded:true,widgetPreviewed:true});
  const view=selectZhanshenRefineCalendar(inherited);
  assert.equal(view.accountTier,'vip');
  assert.equal(view.previewTier,'vip');
  assert.equal(view.today,'2026-11-05');
  assert.equal(view.completedCount,3);
  assert.equal(createZhanshenRefineSession(Object.create({tier:'svip'})).accountTier,'vip');
  assert.equal(createZhanshenRefineSession(null).accountTier,'vip');
});

test('safe no-op navigation sanitizes session data while retaining feature booleans and identity',()=>{
  const source={...createZhanshenRefineSession({tier:'free',previewTier:'vip'}),today:null,month:'2026-13',weekStart:'bad',selectedDate:'2026-11-31',completed:[1,1,3,0,16],reminded:'true',widgetPreviewed:1};
  const before=structuredClone(source);
  const view=selectZhanshenRefineCalendar(source);
  assert.equal(view.today,'2026-11-05');
  assert.equal(view.month,'2026-11');
  assert.equal(view.weekStart,'2026-11-02');
  assert.equal(view.selectedDate,'2026-11-05');
  assert.equal(view.completedCount,2);
  assert.equal(view.ticket.currentLevel,0);
  for(const delta of [Infinity,'1',1201,1.5]){
    const changed=shiftZhanshenRefinePeriod(source,delta);
    assert.equal(changed.weekStart,'2026-11-02');
    assert.equal(changed.accountTier,'free');
    assert.equal(changed.previewTier,'vip');
    assert.equal(changed.reminded,false);
    assert.equal(changed.widgetPreviewed,false);
  }
  assert.equal(switchZhanshenRefineMode(source,'daily').mode,'week');
  assert.deepEqual(source,before);
});

test('sessions, root projections and preview mutations never affect shared screenshot data or another projection',()=>{
  const first=createZhanshenRefineSession({tier:'free'}),second=createZhanshenRefineSession({tier:'free'});
  const original=structuredClone(zhanshenAnime);
  first.completed.add(4);
  assert.equal(second.completed.has(4),false);
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
  assert.deepEqual(selectZhanshenRefineCalendar(second).availableEpisodes,[]);
});
