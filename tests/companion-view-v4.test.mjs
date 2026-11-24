import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENARIO_IDS,createCompanionScenario,selectCompanion} from '../dist/companion-model.mjs';
import {companionCopy} from '../dist/companion-copy.mjs';
import {renderEmotiveWidget} from '../dist/companion-view-v4.mjs';
import {renderRefinedHome} from '../dist/ios-home-v4.mjs';

test('emotive widgets preserve each state and copy with one real return entry',()=>{
  for(const scene of SCENARIO_IDS) {
    const input=createCompanionScenario(scene);
    const snapshot=structuredClone(input);
    const selection=selectCompanion(input);
    for(const tone of ['cheeky','gentle'])for(let index=0;index<3;index++){
      const copy=companionCopy(selection,tone,index);
      const html=renderEmotiveWidget(selection,copy,{id:`${scene}-widget`,hintId:`${scene}-hint`});
      assert.equal((html.match(/<button\b/g)||[]).length,1);
      assert.ok(html.includes(`id="${scene}-widget"`));
      assert.ok(html.includes(`aria-describedby="${scene}-hint"`));
      assert.match(html,/class="widget-v4__eyes" aria-hidden="true"/);
      assert.equal((html.match(/class="widget-v4__eye"/g)||[]).length,2);
      for(const line of copy.lines)assert.ok(html.includes(line));
    }
    assert.deepEqual(input,snapshot);
  }
});

test('view escaping and logged-out privacy remain intact',()=>{
  const html=renderEmotiveWidget({status:'logged-out',target:{title:'private-history'}},{key:'" onmouseover="bad',lines:['<script>bad</script>','A & B'],tag:'<unsafe>'},{id:'" onclick="bad',hintId:'" onfocus="bad'});
  assert.ok(!html.includes('private-history'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<unsafe>'));
  assert.match(html,/A &amp; B/);
  assert.match(html,/登录后继续/);
  assert.ok(!html.includes('id="" onclick='));
});

test('three home screens have unique SVG ids and no external scenario controls',()=>{
  const markup=['waiting','evening','returned'].map(prefix=>renderRefinedHome({prefix})).join('');
  const ids=[...markup.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(new Set(ids).size,ids.length);
  for(const match of markup.matchAll(/url\(#([^\)]+)\)/g))assert.ok(ids.includes(match[1]));
  assert.ok(markup.includes('assets/apple/iphone-16-black-portrait.png'));
  assert.ok(!markup.includes('ios-island'));
  assert.ok(!markup.includes('scenarioList'));
  assert.ok(!markup.includes('widget-misty-lake'));
  assert.throws(()=>renderRefinedHome({prefix:'<unsafe>'}),TypeError);
});
