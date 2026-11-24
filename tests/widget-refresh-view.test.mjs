import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REFRESH_SCENARIOS, createRefreshStudy } from '../dist/widget-refresh-model.mjs';
import { renderRefreshCard, refreshActionDetails } from '../dist/widget-refresh-view.mjs';

test('both design directions retain the same title, release information and progress', () => {
  for (const {id} of REFRESH_SCENARIOS) {
    const study = createRefreshStudy(id);
    for (const variant of ['split', 'poster']) {
      const html = renderRefreshCard(study, variant);
      for (const text of [study.contentTitle, study.updateLine, study.headline, study.progressLine]) assert.ok(html.includes(text));
      assert.ok(html.includes(`data-action="${study.action}"`));
      assert.doesNotMatch(html, /兰香如故|斩神/u);
    }
  }
});

test('split layout preserves separate home, downloads and poster-detail destinations', () => {
  const html = renderRefreshCard(createRefreshStudy(), 'split');
  for (const action of ['detail', 'resume', 'home', 'downloads']) assert.ok(html.includes(`data-action="${action}"`));
  assert.doesNotMatch(html, /<button\b[^>]*>(?:(?!<\/button>)[\s\S])*<button\b/u);
});

test('poster switches its single primary action from playback to a calendar after catching up', () => {
  const pending = renderRefreshCard(createRefreshStudy('updated-pending'), 'poster');
  const caughtUp = renderRefreshCard(createRefreshStudy('updated-caught-up'), 'poster');
  assert.match(pending, /data-action="resume"/u);
  assert.match(caughtUp, /data-action="schedule"/u);
  assert.doesNotMatch(caughtUp, /data-action="resume"|继续观看/u);
});

test('provided strings are escaped in text and attribute positions', () => {
  const custom = {...createRefreshStudy(), contentTitle: '<img onerror="bad()">', headline: '<script>bad()</script>', id: '" onfocus="bad()'};
  for (const variant of ['split', 'poster']) {
    const html = renderRefreshCard(custom, variant);
    assert.doesNotMatch(html, /<script>|<img onerror|data-scene="" onfocus/u);
    assert.ok(html.includes('&lt;img onerror=&quot;bad()&quot;&gt;'));
  }
});

test('all destinations describe local simulation without producing watch records', () => {
  for (const action of ['resume', 'schedule', 'detail', 'home', 'downloads']) {
    const details = refreshActionDetails(createRefreshStudy(), action);
    assert.ok(details.title && details.body && details.hint);
    assert.match(details.hint, /演示|预览/u);
  }
});

test('new entry is isolated from existing atlas and policy controllers', () => {
  const entry = readFileSync(new URL('../dist/widget-refresh.html', import.meta.url), 'utf8');
  const controller = readFileSync(new URL('../dist/widget-refresh.mjs', import.meta.url), 'utf8');
  assert.match(entry, /widget-refresh\.mjs/u);
  assert.match(entry, /本地设计稿 · 未发布/u);
  assert.match(controller, /renderRefinedHome/u);
  assert.doesNotMatch(controller, /localStorage|sessionStorage|fetch\(|simulatePolicyWatch|simulateResumeWatch/u);
  assert.match(controller, /aria-modal="true"/u);
  assert.match(controller, /event\.key === 'Escape'/u);
});
