import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENARIO_IDS, createCompanionScenario, selectCompanion} from '../dist/companion-model.mjs';
import {companionCopy} from '../dist/companion-copy.mjs';
import {renderCompanionWidget} from '../dist/companion-view-v3.mjs';
import {APPLE_PREVIEW, renderIOSPreview} from '../dist/ios-preview-v3.mjs';

test('all scenarios render one accessible entry in either tone or appearance without changing history', () => {
  for (const scene of SCENARIO_IDS) {
    const input = createCompanionScenario(scene);
    const snapshot = structuredClone(input);
    const selection = selectCompanion(input);
    for (const tone of ['gentle','cheeky']) for (const appearance of ['light','dark']) {
      const copy = companionCopy(selection,tone);
      const html = renderCompanionWidget(selection,copy,{appearance});
      assert.equal((html.match(/<button\b/g) || []).length,1);
      assert.match(html,/aria-label="[^"]+"/);
      assert.ok(html.includes(`data-appearance="${appearance}"`));
      for (const line of copy.lines) assert.ok(html.includes(line));
    }
    assert.deepEqual(input,snapshot);
  }
});

test('precise playback position is retained for accessibility, not a duplicated line', () => {
  const selection = selectCompanion(createCompanionScenario('away'));
  const html = renderCompanionWidget(selection,companionCopy(selection));
  assert.match(html,/aria-label="[^"]*从 13:32 继续观看/);
  assert.equal((html.match(/13:32/g) || []).length,1);
  assert.match(html,/第 8 集/);
});

test('logged-out views never expose a stale supplied target', () => {
  const html = renderCompanionWidget({status:'logged-out',target:{title:'不该出现的私密历史',episode:8,progressSeconds:812}}, {lines:['先认识一下。','再接着看。']});
  assert.ok(!html.includes('不该出现的私密历史'));
  assert.match(html,/登录后继续/);
});

test('copy, target titles, and mood attributes escape HTML', () => {
  const html = renderCompanionWidget({status:'resume',target:{title:'<img src=x onerror="alert(1)">',episode:1,progressSeconds:0}}, {key:'" onclick="bad',lines:['<script>bad()</script>','A & B']});
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.match(html,/&lt;script&gt;/);
  assert.match(html,/A &amp; B/);
  assert.ok(!html.includes('data-mood="" onclick='));
});

test('official bezel layout uses its original opening rather than a CSS-drawn device', () => {
  assert.deepEqual(APPLE_PREVIEW.screen,{left:30,top:30,width:393,height:852});
  assert.equal(APPLE_PREVIEW.width/APPLE_PREVIEW.height,1359/2736);
  const html = renderIOSPreview();
  assert.ok(html.includes(APPLE_PREVIEW.asset));
  assert.ok(!html.includes('native-island'));
  assert.ok(!html.includes('ios-app-grid'));
});
