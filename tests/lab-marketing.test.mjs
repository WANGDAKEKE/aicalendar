import test from 'node:test';
import assert from 'node:assert/strict';
import {drama} from '../dist/drama-config.mjs';
import {selectMarketing,renderMarketingCard} from '../dist/lab-marketing.mjs';
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

test('marketing keeps the membership benefit and action, never the legacy slogan',()=>{
  const view={...base,user:{tier:'vip'},campaign:{...base.campaign,headline:'好故事，先一步看到'}};
  const before=structuredClone(view);
  const html=renderMarketingCard(view);
  assert.match(html, /<b>SVIP<\/b>/);
  assert.match(html, /SVIP 今日可看至第 14 集/);
  assert.match(html, /升级 SVIP/);
  assert.doesNotMatch(html, /好故事，先一步看到|活动详情/);
  assert.deepEqual(view,before);
  assert.equal(renderMarketingCard({...view,campaign:{...view.campaign,enabled:false}}),'');
});

test('event marketing also omits the legacy slogan and escapes configurable text',()=>{
  const event=renderMarketingCard({...base,user:{tier:'svip'},campaign:{...base.campaign,headline:'不要出现的旧标题'}});
  assert.match(event, /特别企划/);
  assert.doesNotMatch(event, /不要出现的旧标题/);
  const unsafe=structuredClone(base);
  unsafe.drama.tiers.svip='<img src=x onerror="bad()">';
  const html=renderMarketingCard({...unsafe,user:{tier:'vip'}});
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});
