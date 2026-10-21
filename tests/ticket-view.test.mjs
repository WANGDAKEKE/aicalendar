import test from 'node:test';
import assert from 'node:assert/strict';
import {renderTicketPanel} from '../dist/ticket-view.mjs';
import {getTicketProgress, ticketLevels} from '../dist/ticket-model.mjs';

const through = count => Array.from({length: count}, (_, index) => index + 1);
const drama = {title: '长安的荔枝', totalEpisodes: 30};
const render = (count, options = {}) => renderTicketPanel({
  drama, progress: getTicketProgress(through(count)), levels: ticketLevels,
  available: 30, today: '2026-10-15', ...options,
});
const buttons = html => [...html.matchAll(/<button\b[\s\S]*?<\/button>/g)].map(match => match[0]);
const ticket = html => html.match(/<article\b[\s\S]*?<\/article>/)?.[0];

test('before obtaining a ticket every finish remains a preview with no issued number or earned claim', () => {
  for (const selectedLevel of [1, 2, 3]) {
    const html = render(9, {selectedLevel});
    assert.match(html, /票面预览 · 未获得/);
    assert.match(ticket(html), /待生成/);
    assert.doesNotMatch(html, /LY-0001|当前票面 · 已获得|已自动收好|ticket-earned|ticket-celebrating/);
    const tabs = buttons(html).filter(button => button.includes('data-ticket-level'));
    assert.equal(tabs.length, 3);
    assert.ok(tabs.every(button => /is-locked/.test(button) && /未解锁/.test(button)));
    assert.equal(tabs.filter(button => /aria-pressed="true"/.test(button)).length, 1);
    assert.match(tabs[selectedLevel - 1], /aria-pressed="true"/);
  }
});

test('previewing a higher level never changes ownership or presents it as the current ticket', () => {
  const progress = getTicketProgress(through(10));
  const original = structuredClone(progress);
  const html = render(10, {progress, selectedLevel: 3});
  assert.match(html, /票面预览 · 尚未升级/);
  assert.match(ticket(html), /ticket-finish-holo is-preview/);
  assert.doesNotMatch(html, /当前票面 · 已获得/);
  assert.match(buttons(html).find(button => /data-ticket-level="1"/.test(button)), /已解锁/);
  assert.match(buttons(html).find(button => /data-ticket-level="3"/.test(button)), /未解锁/);
  assert.deepEqual(progress, original);
});

test('all obtained finishes and previews retain the same ticket number after upgrades', () => {
  for (const count of [10, 18, 30]) {
    for (const selectedLevel of [1, 2, 3]) {
      const html = render(count, {selectedLevel});
      assert.equal((html.match(/LY-0001/g) || []).length, 1);
      assert.doesNotMatch(ticket(html), /待生成/);
    }
  }
});

test('continue points at the first missing episode, including holes in an otherwise advanced history', () => {
  const progress = getTicketProgress([1, 2, 7, 8, 9, 10, 18, 30]);
  const html = render(0, {progress, available: 12});
  const playButtons = buttons(html).filter(button => button.includes('data-episode'));
  assert.equal(playButtons.length, 1);
  assert.match(playButtons[0], /data-episode="3"/);
  assert.match(playButtons[0], /继续看第 3 集/);
  assert.match(html, /aria-valuemax="10" aria-valuenow="6"/);
});

test('unreleased next episodes never create playback controls even during an earned-ticket celebration', () => {
  for (const celebrate of [false, true]) {
    const html = render(18, {available: 18, celebrate});
    assert.doesNotMatch(html, /data-episode=/);
    assert.match(html, /继续追剧后自动升级/);
    assert.match(html, /data-close-reward/);
  }
  const released = render(18, {available: 19});
  assert.match(released, /data-episode="19"/);
});

test('celebration applies only to the currently earned finish, not unowned or alternate previews', () => {
  const unowned = render(9, {celebrate: true});
  assert.doesNotMatch(unowned, /ticket-celebrating|ticket-earned|已自动收好|>收好了</);
  for (const [count, selectedLevel] of [[10, 3], [18, 1], [18, 3]]) {
    const preview = render(count, {selectedLevel, celebrate: true});
    assert.doesNotMatch(preview, /ticket-celebrating|ticket-earned|已自动收好/);
  }
  const obtained = render(10, {celebrate: true});
  assert.match(obtained, /ticket-celebrating/);
  assert.match(obtained, /已获得初程票 · 已自动收好/);
  assert.match(obtained, /data-close-reward>收好了/);
  const upgraded = render(18, {celebrate: true});
  assert.match(upgraded, /已升级为同行票 · 已自动收好/);
});

test('each finish has its distinct material and selecting no level defaults to the earned finish', () => {
  for (const [count, material, name] of [[10, 'paper', '初程票'], [18, 'foil', '同行票'], [30, 'holo', '典藏票']]) {
    const html = render(count);
    assert.match(ticket(html), new RegExp(`ticket-finish-${material}`));
    assert.match(ticket(html), new RegExp(name));
    assert.match(html, /当前票面 · 已获得/);
    assert.doesNotMatch(ticket(html), /is-preview/);
  }
});

test('first issuance that skips levels is not called an upgrade', () => {
  const html = render(30, {celebrate: true, firstTicket: true});
  assert.match(html, /已获得典藏票/);
  assert.doesNotMatch(html, /已升级为典藏票/);
});

test('titles and all level labels are escaped in visible copy and attributes', () => {
  const malicious = '<img src=x onerror="alert(1)"> & \'quoted\'';
  const levels = ticketLevels.map(level => ({...level, name: malicious}));
  const progress = getTicketProgress(through(10), levels);
  const html = render(10, {
    drama: {...drama, title: malicious}, progress, levels, celebrate: true,
  });
  assert.doesNotMatch(html, /<img|<script|onerror="|<h3><|<strong></);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; &#39;quoted&#39;/);
  assert.match(html, /aria-label="&lt;img/);
  assert.match(html, /ticket-earned/);
  assert.equal(buttons(html).filter(button => button.includes('data-ticket-level')).length, 3);
});

test('finish and date input cannot inject markup and valid dates are explicitly progress dates', () => {
  const levels = ticketLevels.map(level => ({...level, finish: 'holo" onmouseover="alert(1)'}));
  const html = render(10, {levels, today: '"><script>alert(1)</script>'});
  assert.match(ticket(html), /ticket-finish-paper/);
  assert.doesNotMatch(html, /onmouseover|<script|alert\(1\)|进度 \d/);
  const dated = render(10);
  assert.match(ticket(dated), /进度 2026\.10\.15/);
  assert.doesNotMatch(dated, /获得日期|解锁日期|领取日期/);
});

test('full completion returns to the calendar without further play or upgrade actions', () => {
  const html = render(30);
  assert.match(html, /全剧看完 · 典藏票已收好/);
  assert.match(html, /aria-valuemax="30" aria-valuenow="30"/);
  assert.doesNotMatch(html, /data-episode=|下一次升级|继续追剧后自动升级/);
  const actions = buttons(html).filter(button => !button.includes('data-ticket-level'));
  assert.equal(actions.length, 1);
  assert.match(actions[0], /data-close-reward>回日历/);
});

test('the barcode remains decorative and the ticket states that it is not an admission credential', () => {
  const html = render(18);
  assert.match(html, /class="ticket-barcode" aria-hidden="true"/);
  assert.match(ticket(html), /追剧纪念票 · 非观影凭证/);
  assert.doesNotMatch(html, /二维码|扫码入场|观影资格/);
});
