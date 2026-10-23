import test from 'node:test';
import assert from 'node:assert/strict';
import {drama} from '../dist/drama-config.mjs';
import {selectMarketing} from '../dist/lab-marketing.mjs';
const base={drama,now:'2026-10-15T19:00:00+08:00',campaign:{enabled:true,mode:'auto',screeningEnabled:true}};
test('marketing proactively shows a benefit for the real identity',()=>{
  assert.equal(selectMarketing({...base,user:{tier:'free'}}).target,'vip');
  assert.equal(selectMarketing({...base,user:{tier:'free'}}).extra,5);
  assert.equal(selectMarketing({...base,user:{tier:'vip'}}).extra,2);
  assert.equal(selectMarketing({...base,user:{tier:'svip'}}).kind,'screening');
});
test('campaign switches and event expiry do not invent access or inactive events',()=>{
  assert.equal(selectMarketing({...base,user:{tier:'vip'},campaign:{...base.campaign,enabled:false}}),null);
  const forced=selectMarketing({...base,user:{tier:'free'},campaign:{...base.campaign,mode:'screening'}});
  assert.equal(forced.kind,'screening');assert.equal(forced.playable,undefined);
  assert.equal(selectMarketing({...base,user:{tier:'svip'},now:'2026-10-25T19:00:00+08:00'}),null);
  assert.equal(selectMarketing({...base,user:{tier:'svip'},campaign:{...base.campaign,screeningEnabled:false}}),null);
});
