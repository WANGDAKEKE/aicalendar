import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENARIO_IDS, createCompanionScenario, selectCompanion} from '../dist/companion-model.mjs';
import {companionCopy} from '../dist/companion-copy.mjs';
import {renderEmotiveWidget} from '../dist/companion-view-v4.mjs';

test('wide stays the default and unsupported sizes fall back to wide', () => {
  const selection = selectCompanion(createCompanionScenario('resume'));
  const copy = companionCopy(selection);
  const defaultMarkup = renderEmotiveWidget(selection, copy);
  assert.equal(defaultMarkup, renderEmotiveWidget(selection, copy, {size: 'wide'}));
  assert.equal(defaultMarkup, renderEmotiveWidget(selection, copy, {size: '<unsafe>'}));
  assert.match(defaultMarkup, /data-size="wide"/);
  assert.match(defaultMarkup, /widget-v4__state/);
  assert.match(defaultMarkup, /widget-v4__play/);
});

test('square shares all eight state and copy variants without added controls or mutations', () => {
  let variants = 0;
  for (const scene of SCENARIO_IDS) {
    const input = createCompanionScenario(scene);
    const snapshot = structuredClone(input);
    const selection = selectCompanion(input);
    for (const tone of ['cheeky', 'gentle']) for (let index = 0; index < 3; index++) {
      const copy = companionCopy(selection, tone, index);
      const html = renderEmotiveWidget(selection, copy, {id: `${scene}-square`, hintId: '', size: 'square'});
      assert.match(html, /data-size="square"/);
      assert.equal((html.match(/<button\b/g) || []).length, 1);
      assert.equal((html.match(/class="widget-v4__eye"/g) || []).length, 2);
      assert.ok(!html.includes('widget-v4__state'));
      assert.ok(!html.includes('widget-v4__play'));
      assert.ok(!html.includes('aria-describedby'));
      for (const line of copy.lines) assert.ok(html.includes(line));
      if (selection.target) {
        assert.ok(html.includes(`第 ${selection.target.episode} 集`));
        assert.ok(html.includes(`${selection.target.title} · ${selection.target.episode}集`));
      }
      variants++;
    }
    assert.deepEqual(input, snapshot);
  }
  assert.equal(variants, 48);
});

test('square keeps precise playback context, HTML escaping, and logged-out privacy', () => {
  const html = renderEmotiveWidget({status: 'resume', target: {title: '<unsafe>', episode: 8, progressSeconds: 812}}, {lines: ['A & B', '<script>']}, {size: 'square'});
  assert.match(html, /从 13:32 继续观看/);
  assert.match(html, /&lt;unsafe&gt; · 8集/);
  assert.match(html, /A &amp; B/);
  assert.ok(!html.includes('<script>'));
  const privateMarkup = renderEmotiveWidget({status: 'logged-out', target: {title: 'private-history'}}, {}, {size: 'square'});
  assert.ok(!privateMarkup.includes('private-history'));
  assert.match(privateMarkup, /登录后继续/);
});
