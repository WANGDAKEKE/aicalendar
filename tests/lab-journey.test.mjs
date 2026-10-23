import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderJourney, penguinArt, getPenguinState} from '../dist/lab-journey.mjs';
import {getTicketProgress} from '../dist/ticket-model.mjs';

const through = count => Array.from({length: count}, (_, index) => index + 1);
const render = (count, options = {}) => renderJourney({
  progress: getTicketProgress(through(count)),
  user: {name: '小荔'}, today: '2026-10-15', summary: {available: 30}, ...options,
});
const nodeButtons = html => [...html.matchAll(/<button\b[^>]*data-lab-ticket="(\d)"[^>]*>[\s\S]*?<\/button>/g)]
  .map(match => ({level: Number(match[1]), html: match[0]}));

test('the journey owns exactly three ticket nodes and does not render date-based rewards', () => {
  const html = render(9);
  const nodes = nodeButtons(html);
  assert.deepEqual(nodes.map(node => node.level), [1, 2, 3]);
  for (const [index, [name, episode]] of [['初程票', 10], ['同行票', 18], ['典藏票', 30]].entries()) {
    assert.match(nodes[index].html, new RegExp(name));
    assert.match(nodes[index].html, new RegExp(`看完前 ${episode} 集解锁`));
  }
  assert.match(html, /data-lab-widget/);
  assert.match(html, /data-lab-penguin/);
  assert.doesNotMatch(html, /data-date=|data-badge=|day-reward|2026-10-15|签到|连续观看|扣奖/);
});

for (const scenario of [
  {count: 9, target: 1, total: 10, remaining: 1, earned: 0, name: '初程票'},
  {count: 10, target: 2, total: 18, remaining: 8, earned: 1, name: '同行票'},
  {count: 18, target: 3, total: 30, remaining: 12, earned: 2, name: '典藏票'},
]) {
  test(`${scenario.count}/${scenario.total} viewing progress targets node ${scenario.target} without granting it`, () => {
    const html = render(scenario.count);
    const nodes = nodeButtons(html);
    assert.match(html, new RegExp(`--journey-target:${scenario.target}`));
    assert.match(html, new RegExp(`已看 ${scenario.count} / ${scenario.total} 集`));
    assert.match(html, new RegExp(`还差 ${scenario.remaining} 集`));
    assert.match(html, new RegExp(scenario.name));
    assert.equal(nodes.filter(node => /is-target/.test(node.html)).length, 1);
    assert.equal(nodes.filter(node => /is-earned/.test(node.html)).length, scenario.earned);
    assert.match(nodes.find(node => node.level === scenario.target).html, /is-locked is-target/);
  });
}

test('full completion keeps the earned highest node and a celebratory companion without another upgrade target', () => {
  const html = render(30);
  const nodes = nodeButtons(html);
  assert.match(html, /--journey-target:3/);
  assert.match(html, /30 \/ 30 集/);
  assert.match(html, /典藏票已收好 · 查看票面/);
  assert.match(html, /一起追到了大结局/);
  assert.ok(nodes.every(node => /is-earned/.test(node.html)));
  assert.match(nodes[2].html, /is-earned is-target/);
  assert.doesNotMatch(html, /is-locked|还差|一起升级|再陪我看/);
});

test('out-of-order viewing shows prerequisite progress rather than all later watched episodes', () => {
  const progress = getTicketProgress([1, 2, 7, 8, 9, 10, 18, 30]);
  const original = structuredClone(progress);
  const html = render(0, {progress});
  assert.match(html, /已看 6 \/ 10 集/);
  assert.match(html, /还差 4 集/);
  assert.match(html, /--journey-target:1/);
  assert.ok(nodeButtons(html).every(node => /is-locked/.test(node.html)));
  assert.deepEqual(progress, original);
});

test('an unavailable missing episode gets a gentle wait message without creating a play or claim action', () => {
  const html = render(18, {summary: {available: 18}});
  assert.match(html, /还差 12 集 · 等更新再一起看/);
  assert.doesNotMatch(html, /data-episode=|data-claim|data-checkin/);
  assert.match(render(18, {summary: {available: 19}}), /还差 12 集 · 升级典藏票/);
});

test('dynamic ticket copy is escaped and cannot introduce HTML or event attributes', () => {
  const malicious = '<img src=x onerror="alert(1)"> & \'票\'';
  const progress = getTicketProgress(through(9));
  progress.next = {...progress.next, name: malicious};
  const html = render(9, {progress});
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; &#39;票&#39;/);
  assert.doesNotMatch(html, /<img src=x|<script|onerror="/);
  assert.equal(nodeButtons(html).length, 3);
});

test('four 3D states follow earned ticket levels, including skipped history and invalid input', () => {
  for (const [count, state] of [[9, 'sleep'], [10, 'awake'], [18, 'proud'], [30, 'celebrate']]) {
    const progress = getTicketProgress(through(count));
    assert.equal(getPenguinState(progress), state);
    const html = render(count);
    assert.match(html, new RegExp(`data-companion-state="${state}"`));
    assert.match(html, new RegExp(`qq-companion-${state}\\.png`));
  }
  assert.equal(getPenguinState(getTicketProgress([1, 2, 10, 18, 30])), 'sleep');
  for (const currentLevel of [-1, 4, 1.5, '3', Infinity, NaN, null, {}, undefined]) {
    assert.equal(getPenguinState({currentLevel}), 'sleep');
  }
  assert.equal(getPenguinState(), 'sleep');
});

test('3D art uses only local whitelisted assets and keeps accessible pose descriptions', () => {
  const descriptions = ['侧躺着睡觉', '抱着初程纸票', '举起同行金票', '开心庆祝'];
  for (const [index, state] of ['sleep', 'awake', 'proud', 'celebrate'].entries()) {
    for (const reaction of ['idle', 'poke', 'unlock']) {
      const art = penguinArt(state, reaction);
      assert.match(art, new RegExp(`src="\\.\\/assets\\/qq-companion-${state}\\.png"`));
      assert.match(art, new RegExp(`data-penguin-reaction="${reaction}"`));
      assert.match(art, new RegExp(descriptions[index]));
      assert.doesNotMatch(art, /<script|https?:|onerror=|<svg/);
    }
  }
  for (const malformed of ['unknown', '"><script>alert(1)</script>', '__proto__', {}, null]) {
    assert.equal(penguinArt(malformed, malformed), penguinArt());
  }
});

test('companion has its own scene instead of standing on ticket node controls', () => {
  const html = render(9);
  assert.ok(html.indexOf('data-lab-penguin') < html.indexOf('class="lab-journey__steps"'));
  const steps = html.slice(html.indexOf('class="lab-journey__steps"'));
  assert.doesNotMatch(steps, /data-lab-penguin|qq-companion-/);
  assert.match(html, /class="lab-journey__speech" aria-live="polite"/);
  assert.equal((html.match(/data-lab-penguin/g) || []).length, 1);
});

test('sleeping idle motion is finite and all motion has a reduced-motion override', () => {
  const css = readFileSync(new URL('../dist/lab-journey.css', import.meta.url), 'utf8');
  assert.match(css, /animation:lab-penguin-breathe 3\.4s ease-in-out 3/);
  assert.doesNotMatch(css, /\binfinite\b/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /animation:none!important/);
});
