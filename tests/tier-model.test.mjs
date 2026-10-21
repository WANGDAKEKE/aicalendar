import test from 'node:test';
import assert from 'node:assert/strict';
import {drama,demoSession} from '../dist/drama-config.mjs';
import {getSummary} from '../dist/calendar-model.mjs';
import {getBadgeRelease} from '../dist/badge-model.mjs';
import {getDateOperations} from '../dist/operations-model.mjs';
import {getTierContext} from '../dist/tier-model.mjs';

const now=demoSession.now;

test('initial preview defaults to the real VIP account and its 12 available episodes',()=>{
  const context=getTierContext(drama,demoSession.tier,undefined,now);
  assert.equal(context.account.tier,'vip');
  assert.equal(context.account.available,12);
  assert.deepEqual(context.preview,context.account);
  assert.notStrictEqual(context.preview,context.account);
  assert.notStrictEqual(context.preview.releases,context.account.releases);
  assert.equal(context.requiresUpgrade,false);
  assert.equal(context.extraAvailable,0);
});

test('a VIP previewing SVIP sees 14 episodes and an upgrade requirement but keeps 12 playable',()=>{
  const context=getTierContext(drama,'vip','svip',now);
  assert.equal(context.preview.tier,'svip');
  assert.equal(context.preview.available,14);
  assert.equal(context.requiresUpgrade,true);
  assert.equal(context.extraAvailable,2);
  assert.equal(context.account.tier,'vip');
  assert.equal(context.account.available,12);
  assert.deepEqual(context.account,getSummary(drama,'vip',now));
});

test('previewing free releases never downgrades the actual VIP playback scope',()=>{
  const context=getTierContext(drama,'vip','free',now);
  assert.equal(context.preview.tier,'free');
  assert.equal(context.preview.available,7);
  assert.equal(context.requiresUpgrade,false);
  assert.equal(context.extraAvailable,0);
  assert.equal(context.account.tier,'vip');
  assert.equal(context.account.available,12);
});

test('an SVIP account never receives an upgrade requirement for any supported preview',()=>{
  for(const preview of ['svip','vip','free',undefined]){
    const context=getTierContext(drama,'svip',preview,now);
    assert.equal(context.account.tier,'svip');
    assert.equal(context.account.available,14);
    assert.equal(context.requiresUpgrade,false);
    assert.equal(context.extraAvailable,0);
  }
});

test('a free account must upgrade for VIP or SVIP previews without gaining playback access',()=>{
  for(const [preview,extra] of [['vip',5],['svip',7]]){
    const context=getTierContext(drama,'free',preview,now);
    assert.equal(context.account.tier,'free');
    assert.equal(context.account.available,7);
    assert.equal(context.requiresUpgrade,true);
    assert.equal(context.extraAvailable,extra);
  }
});

test('invalid account identities fall back to free and invalid previews fall back to the real account',()=>{
  const invalid=[undefined,null,'unknown','VIP',0,1,false,[],{},Symbol('vip')];
  for(const tier of invalid){
    const fallback=getTierContext(drama,tier,undefined,now);
    assert.equal(fallback.account.tier,'free');
    assert.equal(fallback.account.available,7);
    assert.equal(fallback.preview.tier,'free');
    assert.equal(fallback.requiresUpgrade,false);
    const preview=getTierContext(drama,'vip',tier,now);
    assert.equal(preview.account.tier,'vip');
    assert.equal(preview.preview.tier,'vip');
    assert.equal(preview.requiresUpgrade,false);
  }
  const requestedUpgrade=getTierContext(drama,'unknown','svip',now);
  assert.equal(requestedUpgrade.account.tier,'free');
  assert.equal(requestedUpgrade.requiresUpgrade,true);
});

test('prototype keys and coercible objects cannot be treated as privileged identities',()=>{
  const keys=['__proto__','constructor','toString','valueOf','hasOwnProperty','__defineGetter__'];
  const scheduleByTier={...drama.scheduleByTier};
  for(const key of keys)Object.defineProperty(scheduleByTier,key,{value:drama.scheduleByTier.svip,enumerable:true});
  const configured={...drama,scheduleByTier};
  for(const tier of [...keys,{toString(){throw new Error('Identity coercion must not run');}}]){
    assert.equal(getTierContext(configured,tier,undefined,now).account.tier,'free');
    const context=getTierContext(configured,'vip',tier,now);
    assert.equal(context.preview.tier,'vip');
    assert.equal(context.requiresUpgrade,false);
    assert.equal(context.account.available,12);
  }
});

test('a missing optional preview schedule falls back to the account schedule',()=>{
  const {svip,...scheduleByTier}=drama.scheduleByTier;
  const context=getTierContext({...drama,scheduleByTier},'vip','svip',now);
  assert.equal(context.account.tier,'vip');
  assert.equal(context.preview.tier,'vip');
  assert.equal(context.requiresUpgrade,false);
});

test('upgrade ranking stays independent from the number of extra episodes',()=>{
  for(const time of ['2026-10-01T19:00:00+08:00','2026-11-20T19:00:00+08:00']){
    const context=getTierContext(drama,'vip','svip',time);
    assert.equal(context.requiresUpgrade,true);
    assert.equal(context.extraAvailable,0);
    assert.equal(context.account.available,context.preview.available);
  }
});

test('preview schedules keep their own release, badge and editorial dates without mutating configuration',()=>{
  const configured=structuredClone(drama);
  const before=structuredClone(configured);
  const freeze=value=>{for(const child of Object.values(value))if(child&&typeof child==='object')freeze(child);return Object.freeze(value);};
  freeze(configured);
  const context=getTierContext(configured,'vip','svip',now);
  assert.deepEqual(configured,before);
  assert.deepEqual([context.account.todayRelease.from,context.account.todayRelease.to],[11,12]);
  assert.deepEqual([context.preview.todayRelease.from,context.preview.todayRelease.to],[13,14]);
  assert.equal(context.account.finale.date,'2026-10-27');
  assert.equal(context.preview.finale.date,'2026-10-26');
  assert.equal(getBadgeRelease(configured.badges[0],context.account.releases).date,'2026-10-14');
  assert.equal(getBadgeRelease(configured.badges[0],context.preview.releases).date,'2026-10-13');
  const accountHints=getDateOperations(configured,{tier:context.account.tier,date:'2026-10-15',now});
  const previewHints=getDateOperations(configured,{tier:context.preview.tier,date:'2026-10-15',now});
  assert.deepEqual(accountHints.highlights,[]);
  assert.equal(previewHints.highlights[0].episode,14);
  assert.deepEqual(getTierContext(configured,'vip','free',now).account,context.account);
});
