import test from 'node:test';
import assert from 'node:assert/strict';
import {princessDrama,createPrincessSession,selectPrincessCalendar} from '../dist/princess-calendar-model.mjs';
import {
  createPrincessRefineSession,selectPrincessRefineCalendar,setPrincessRefinePreview,
  shiftPrincessRefinePeriod,switchPrincessRefineMode,resetPrincessRefineToday,
} from '../dist/princess-calendar-refine-model.mjs';

const TIERS=['free','vip','svip'];
const OPERATIONS_COPY={title:'会员每日18点更新',subtitle:'SVIP抢先看1集'};
const entitlementFields=['accountTier','now','availableEpisodes','availableThrough','available','nextEpisode','completedCount','ticket','upgrade','currentRelease'];
const entitlement=view=>Object.fromEntries(entitlementFields.map(key=>[key,view[key]]));
const expectedMarketing=(tier,previewTier)=>{
  if(tier==='svip')return {...OPERATIONS_COPY,kind:'none',tier:null,cta:''};
  if(tier==='vip')return {...OPERATIONS_COPY,kind:'membership',tier:'svip',cta:'升级SVIP'};
  if(previewTier==='free')return {...OPERATIONS_COPY,kind:'preview',tier:'vip',cta:'看VIP排期'};
  return {...OPERATIONS_COPY,kind:'membership',tier:previewTier,cta:`开通${princessDrama.tiers[previewTier]}`};
};

test('refinement sessions start from the real account and keep independent demo history',()=>{
  for(const tier of TIERS){
    const session=createPrincessRefineSession({tier});
    assert.equal(session.accountTier,tier);
    assert.equal(session.previewTier,tier);
    assert.equal(session.reminded,false);
    assert.equal(session.widgetPreviewed,false);
    assert.equal(session.completed.size,24);
    assert.equal(selectPrincessRefineCalendar(session).isPreview,false);
  }
  const first=createPrincessRefineSession(),second=createPrincessRefineSession();
  first.completed.add(25);
  assert.equal(second.completed.has(25),false);
});

test('all account and preview combinations preserve real playback and ticket authorization',()=>{
  for(const tier of TIERS){
    const session=createPrincessRefineSession({tier});
    const before=structuredClone(session);
    const actual=selectPrincessCalendar(createPrincessSession({tier}));
    for(const previewTier of TIERS){
      const changed=setPrincessRefinePreview(session,previewTier);
      const view=selectPrincessRefineCalendar(changed);
      assert.equal(changed.accountTier,tier);
      assert.equal(view.accountTier,tier);
      assert.equal(view.previewTier,previewTier);
      assert.equal(view.isPreview,tier!==previewTier);
      assert.deepEqual(entitlement(view),entitlement(actual),`${tier} previewing ${previewTier}`);
      assert.deepEqual(view.schedule,selectPrincessCalendar({...session,accountTier:previewTier}));
      assert.deepEqual(changed.completed,session.completed);
      assert.notEqual(changed.completed,session.completed);
      assert.deepEqual(session,before);
    }
  }
});

test('all default and 3 by 3 preview combinations share operations copy with account-specific CTAs',()=>{
  for(const tier of TIERS){
    const session=createPrincessRefineSession({tier});
    assert.deepEqual(selectPrincessRefineCalendar(session).marketing,expectedMarketing(tier,tier));
    for(const previewTier of TIERS){
      const expected=expectedMarketing(tier,previewTier);
      const projected=selectPrincessRefineCalendar(setPrincessRefinePreview(session,previewTier));
      const direct=selectPrincessRefineCalendar(createPrincessRefineSession({tier,previewTier}));
      assert.deepEqual(projected.marketing,expected,`${tier} switching to ${previewTier}`);
      assert.deepEqual(direct.marketing,expected,`${tier} starting with ${previewTier}`);
      assert.doesNotMatch(projected.marketing.title,/升级|多看|可看至/);
    }
  }
});

test('non-members have no invented free schedule and can preview VIP before opening membership',()=>{
  const session=createPrincessRefineSession({tier:'free'});
  const initial=selectPrincessRefineCalendar(session);
  assert.equal(initial.schedule.scheduleKnown,false);
  assert.ok(initial.schedule.days.every(day=>day.release===null));
  assert.deepEqual(initial.availableEpisodes,[]);
  assert.equal(initial.nextEpisode,null);
  assert.equal(initial.marketing.kind,'preview');
  assert.equal(initial.marketing.tier,'vip');
  assert.equal(initial.marketing.cta,'看VIP排期');
  for(const previewTier of ['vip','svip']){
    const view=selectPrincessRefineCalendar(setPrincessRefinePreview(session,previewTier));
    assert.equal(view.schedule.scheduleKnown,true);
    assert.equal(view.marketing.kind,'membership');
    assert.equal(view.marketing.tier,previewTier);
    assert.equal(view.marketing.cta,`开通${princessDrama.tiers[previewTier]}`);
    assert.deepEqual(view.availableEpisodes,[]);
    assert.equal(view.nextEpisode,null);
    assert.equal(view.marketing.subtitle,'SVIP抢先看1集');
    assert.doesNotMatch(view.marketing.subtitle,/\d+月|可看至|第\d+集/);
  }
});

test('VIP keeps its SVIP upgrade entry for every preview and SVIP has no placeholder activity',()=>{
  for(const previewTier of TIERS){
    const vip=selectPrincessRefineCalendar(createPrincessRefineSession({tier:'vip',previewTier}));
    assert.equal(vip.marketing.kind,'membership');
    assert.equal(vip.marketing.tier,'svip');
    assert.equal(vip.marketing.cta,'升级SVIP');
    assert.equal(vip.marketing.title,'会员每日18点更新');
    assert.doesNotMatch(vip.marketing.subtitle,/\d+月|可看至|第\d+集/);
    const svip=selectPrincessRefineCalendar(createPrincessRefineSession({tier:'svip',previewTier}));
    assert.deepEqual(svip.marketing,{...OPERATIONS_COPY,kind:'none',tier:null,cta:''});
  }
});

test('navigation retains preview and feature flags without changing the real account or history',()=>{
  const original={...createPrincessRefineSession({tier:'free',previewTier:'svip'}),reminded:true,widgetPreviewed:true};
  const before=structuredClone(original);
  const next=shiftPrincessRefinePeriod(original,1);
  assert.equal(next.weekStart,'2026-11-09');
  const month=switchPrincessRefineMode(next,'month');
  const december=shiftPrincessRefinePeriod(month,1);
  assert.equal(december.month,'2026-12');
  const reset=resetPrincessRefineToday(december);
  assert.equal(reset.mode,'month');
  assert.equal(reset.weekStart,'2026-11-02');
  assert.equal(reset.month,'2026-11');
  assert.equal(reset.selectedDate,'2026-11-05');
  const week=switchPrincessRefineMode(reset,'week');
  for(const changed of [next,month,december,reset,week]){
    assert.equal(changed.accountTier,'free');
    assert.equal(changed.previewTier,'svip');
    assert.equal(changed.reminded,true);
    assert.equal(changed.widgetPreviewed,true);
    assert.equal(changed.now,original.now);
    assert.deepEqual(changed.completed,original.completed);
    assert.notEqual(changed.completed,original.completed);
    assert.deepEqual(selectPrincessRefineCalendar(changed).availableEpisodes,[]);
  }
  assert.deepEqual(original,before);
});

test('release boundaries and future dates never grant authorization through a preview',()=>{
  const session=createPrincessRefineSession({tier:'vip',previewTier:'svip',now:'2026-11-05T17:59:59+08:00'});
  session.completed.add(27).add(33);
  const before=selectPrincessRefineCalendar(session);
  assert.deepEqual(before.marketing,expectedMarketing('vip','svip'));
  assert.deepEqual(before.availableEpisodes,[22,23,24]);
  assert.equal(before.availableEpisodes.includes(27),false);
  assert.equal(before.nextEpisode,null);
  const exact=selectPrincessRefineCalendar({...session,now:'2026-11-05T18:00:00+08:00'});
  assert.deepEqual(exact.availableEpisodes,[22,23,24,25,26]);
  assert.equal(exact.nextEpisode,25);
  assert.deepEqual(exact.schedule.availableEpisodes,[23,24,25,26,27]);
  const future=createPrincessRefineSession({tier:'free',previewTier:'svip',now:'2027-01-15T12:00:00+08:00'});
  const reset=resetPrincessRefineToday(future);
  const futureView=selectPrincessRefineCalendar(reset);
  assert.equal(reset.selectedDate,'2027-01-15');
  assert.equal(reset.weekStart,'2027-01-11');
  assert.equal(reset.month,'2027-01');
  assert.ok(futureView.schedule.days.every(day=>day.release===null));
  assert.equal(futureView.currentRelease,null);
  assert.deepEqual(futureView.availableEpisodes,[]);
  assert.deepEqual(futureView.marketing,expectedMarketing('free','svip'));
});

test('invalid tiers and prototype names fail safely without upgrading an account',()=>{
  for(const invalid of ['VIP','__proto__','constructor','toString','',null,{},[],Symbol('svip')]){
    const session=createPrincessRefineSession({tier:invalid,previewTier:invalid});
    assert.equal(session.accountTier,'free');
    assert.equal(session.previewTier,'free');
    assert.deepEqual(selectPrincessRefineCalendar(session).availableEpisodes,[]);
    const vip=setPrincessRefinePreview(createPrincessRefineSession({tier:'vip',previewTier:'svip'}),invalid);
    assert.equal(vip.accountTier,'vip');
    assert.equal(vip.previewTier,'vip');
  }
  const inherited=Object.create({accountTier:'svip',previewTier:'svip',reminded:true,widgetPreviewed:true});
  const inheritedView=selectPrincessRefineCalendar(inherited);
  assert.equal(inheritedView.accountTier,'vip');
  assert.equal(inheritedView.previewTier,'vip');
  assert.equal(createPrincessRefineSession(Object.create({tier:'svip'})).accountTier,'vip');
  assert.equal(createPrincessRefineSession(null).accountTier,'vip');
});

test('malformed session data, no-op navigation and selector mutation do not alter source state',()=>{
  const source={...createPrincessRefineSession({tier:'free',previewTier:'svip'}),completed:[1,1,0,34,'25',25,null],now:'invalid',weekStart:'2026-02-31',month:'2026-13',selectedDate:'bad',reminded:'true',widgetPreviewed:1};
  const before=structuredClone(source);
  const view=selectPrincessRefineCalendar(source);
  assert.equal(view.today,'2026-11-05');
  assert.equal(view.weekStart,'2026-11-02');
  assert.equal(view.month,'2026-11');
  assert.equal(view.completedCount,2);
  assert.equal(view.previewTier,'svip');
  const noOp=shiftPrincessRefinePeriod(source,Infinity);
  assert.equal(noOp.weekStart,'2026-11-02');
  assert.equal(noOp.reminded,false);
  assert.equal(noOp.widgetPreviewed,false);
  assert.equal(switchPrincessRefineMode(source,'unexpected').mode,'week');
  assert.deepEqual(source,before);
  const known=view.schedule.days.find(day=>day.release);
  known.release.from=999;
  assert.equal(selectPrincessRefineCalendar(source).schedule.days.find(day=>day.release).release.from,23);
  assert.deepEqual(source,before);
});
