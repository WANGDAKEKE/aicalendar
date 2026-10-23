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

test('membership marketing omits the corner badge while retaining each actual benefit and action',()=>{
  for(const [tier,target,available,extra,action] of [
    ['free','VIP',12,5,'开通 VIP'],
    ['vip','SVIP',14,2,'升级 SVIP'],
  ]) {
    const view={...base,user:{tier},campaign:{...base.campaign,headline:'好故事，先一步看到'}};
    const before=structuredClone(view);
    const html=renderMarketingCard(view);
    assert.doesNotMatch(html, /lab-offer-kicker|<b>\s*(?:SVIP|VIP)\s*<\/b>/);
    assert.match(html, new RegExp(`<strong>${target} 今日可看至第 ${available} 集<\\/strong>`));
    assert.match(html, new RegExp(`比当前权益多看 ${extra} 集`));
    assert.match(html, new RegExp(`<button data-lab-offer="membership">${action} ›<\\/button>`));
    assert.doesNotMatch(html, /好故事，先一步看到|活动详情/);
    assert.deepEqual(view,before);
    assert.equal(renderMarketingCard({...view,campaign:{...view.campaign,enabled:false}}),'');
  }
});

test('event marketing also omits the legacy slogan and escapes configurable text',()=>{
  const event=renderMarketingCard({...base,user:{tier:'svip'},campaign:{...base.campaign,headline:'不要出现的旧标题'}});
  assert.match(event, /<div class="lab-offer-kicker"><b>特别企划<\/b><\/div>/);
  assert.match(event, /大结局点映礼 · 提前赴约/);
  assert.match(event, /<button data-lab-offer="screening">了解活动 ›<\/button>/);
  assert.doesNotMatch(event, /不要出现的旧标题/);
  const unsafe=structuredClone(base);
  unsafe.drama.tiers.svip='<img src=x onerror="bad()">';
  const html=renderMarketingCard({...unsafe,user:{tier:'vip'}});
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});
