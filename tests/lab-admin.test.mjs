import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../dist/lab-admin.mjs', import.meta.url), 'utf8');
const css = readFileSync(new URL('../dist/lab-admin.css', import.meta.url), 'utf8');
const panel = name => source.match(new RegExp(`data-admin-panel="${name}" hidden>([\\s\\S]*?)<\\/section>`))?.[1] || '';

test('screening editor belongs to scheduling, not campaign editing', () => {
  const schedule = panel('schedule');
  const campaign = panel('campaign');
  assert.match(schedule, /data-admin-form="screening"/);
  for (const name of ['enabled', 'date', 'time', 'endTime', 'from', 'to', 'accessNote']) {
    assert.match(schedule, new RegExp(`name="${name}"`));
  }
  assert.match(schedule, /独立于常规排期/);
  assert.doesNotMatch(campaign, /data-admin-form="screening"|name="screeningEnabled"|开放点映礼活动展示/);
});

test('campaign form cannot reapply a stale slogan or screening draft', () => {
  const campaign = panel('campaign');
  assert.doesNotMatch(campaign, /name="headline"|营销标题|好故事，先一步看到/);
  const action = source.match(/if \(key==='campaign'\) \{action=\{type:'SET_CAMPAIGN',patch:\{([^}]*)\}/)?.[1];
  assert.ok(action);
  assert.match(action, /enabled:/);
  assert.match(action, /mode:/);
  assert.doesNotMatch(action, /headline|screeningEnabled/);
});

test('calendar highlights support episode binding, emoji picking, edit and removal without plot captions', () => {
  const campaign = panel('campaign');
  assert.match(campaign, /data-admin-form="highlight"/);
  assert.match(campaign, /name="episode"/);
  assert.match(campaign, /name="icon"/);
  assert.match(campaign, /data-admin-emoji/);
  assert.match(source, /data-admin-highlight-edit/);
  assert.match(source, /data-admin-highlight-remove/);
  assert.match(source, /type:'SET_HIGHLIGHT'/);
  assert.match(source, /type:'REMOVE_HIGHLIGHT'/);
  const list = source.match(/find\('\[data-admin-highlights\]'\)\.innerHTML = ([^\n]+)/)?.[1];
  assert.ok(list);
  assert.match(list, /escapeHTML\(item\.icon\)/);
  assert.doesNotMatch(list, /item\.title/);
});

test('emoji controls are non-submit buttons with accessible names and touch-sized targets', () => {
  assert.match(source, /type="button" data-admin-emoji=/);
  assert.match(source, /aria-label="选择\$\{label\}表情" aria-pressed="false"/);
  assert.match(source, /aria-label="编辑第 \$\{item\.episode\} 集表情"/);
  assert.match(source, /aria-label="移除第 \$\{item\.episode\} 集表情"/);
  assert.match(css, /\.lab-admin-emoji-picker button \{[^}]*min-width: 44px;[^}]*min-height: 44px;/);
});
