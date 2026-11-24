import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPolicyInput,evaluatePolicy,POLICY_SCENARIOS,PARAMETER_DEFINITIONS} from '../dist/widget-policy-model.mjs';
import {renderAtlasWidget} from '../dist/widget-atlas-view.mjs';

const html=readFileSync(new URL('../dist/widget-policy.html',import.meta.url),'utf8');
const controller=readFileSync(new URL('../dist/widget-policy.mjs',import.meta.url),'utf8');

test('independent local entry links to retained demos and explains the normalized input boundary',()=>{
  assert.match(html,/src="\.\/widget-policy\.mjs/u);
  assert.match(html,/href="\.\/widget-atlas\.html"/u);
  assert.match(html,/观看汇总＋续看候选/u);
  assert.match(html,/不接真实账号/u);
  assert.match(html,/刷新会重置/u);
  assert.doesNotMatch(controller,/\bfetch\s*\(|\blocalStorage\b|\bsessionStorage\b/u);
});

test('all proposed parameters have editable controls or an explicit structured next-unit editor',()=>{
  for(const item of PARAMETER_DEFINITIONS){
    if(item.key==='next_play_unit'){
      assert.match(html,/name="has_next"/u);
      assert.match(html,/name="next_unit_id"/u);
      assert.match(html,/name="next_unit_label"/u);
    }else assert.ok(html.includes(`name="${item.key}"`),`${item.key} needs a control`);
  }
  assert.match(controller,/reviewMarks = new Map/u);
  assert.match(controller,/\.size-control \[data-size\]/u);
  assert.doesNotMatch(controller,/querySelectorAll\('\[data-size\]'\)/u);
});

test('unknown time is not displayed as a known regular slot or the epoch clock',()=>{
  assert.match(controller,/typeof value!==\s*'string'/u);
  assert.match(controller,/derived\.time_slot==='regular'\?'常规时段':'未知'/u);
  assert.equal(evaluatePolicy({...createPolicyInput(),now:null}).derived.time_slot,'unknown');
  const invalidNow=evaluatePolicy({...createPolicyInput(),now:null});
  assert.ok(invalidNow.trace.find(item=>item.status==='matched').reason.includes('当前时间无效'));
  assert.ok(!invalidNow.trace.find(item=>item.status==='matched').reason.includes('最近观看时间缺失'));
});

test('every fixture renders identical content at both sizes and all four appearances',()=>{
  for(const scenario of POLICY_SCENARIOS){
    const result=evaluatePolicy(createPolicyInput(scenario.id));
    for(const variant of ['light-solid','light-gradient','dark-solid','dark-gradient']){
      const square=renderAtlasWidget(result.study,{size:'square',variant,id:'shared'});
      const wide=renderAtlasWidget(result.study,{size:'wide',variant,id:'shared'});
      assert.equal(square.replace('data-size="square"','data-size="wide"'),wide);
    }
  }
});

test('untrusted user text remains text in the shared renderer',()=>{
  const result=evaluatePolicy({...createPolicyInput(),content_title:'<img src=x onerror=alert(1)>'});
  const markup=renderAtlasWidget(result.study);
  assert.ok(markup.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!markup.includes('<img src=x'));
  assert.match(controller,/JSON\.stringify\(payload,null,2\)/u);
  assert.match(controller,/#policy-json-text'\)\.value=/u);
});
