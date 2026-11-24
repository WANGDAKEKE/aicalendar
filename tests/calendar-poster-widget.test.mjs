import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderCalendarPosterWidget} from '../dist/calendar-poster-widget.mjs';

const source = readFileSync(new URL('../dist/calendar-poster-widget.mjs', import.meta.url), 'utf8');
const css = readFileSync(new URL('../dist/calendar-poster-widget.css', import.meta.url), 'utf8');

test('default poster is a noninteractive IP image without generated IDs or old green widget markup', () => {
  const html = renderCalendarPosterWidget();
  assert.match(html, /^<span\b[^>]*class="cpw-card"/);
  assert.match(html, /data-ip="princess"/);
  assert.match(html, /data-size="wide"/);
  assert.match(html, /role="img"/);
  assert.match(html, /尚公主/);
  assert.doesNotMatch(html, /<button\b|\bdata-action=|\bid=|widget-v4|companion-/);
});

test('both IPs and native shapes use allow-listed poster attributes', () => {
  for (const ip of ['princess', 'zhanshen']) {
    for (const size of ['wide', 'square']) {
      const html = renderCalendarPosterWidget({ip, size});
      assert.match(html, new RegExp(`data-ip="${ip}"`));
      assert.match(html, new RegExp(`data-size="${size}"`));
      assert.match(html, /cpw-card__art/);
      assert.match(html, /cpw-card__scrim/);
      assert.match(html, /cpw-card__brand/);
      assert.match(html, ip === 'princess' ? /尚公主/ : /斩神Ⅱ/);
    }
  }
});

test('unrecognized IPs and shapes fall back without injecting arbitrary data attributes', () => {
  for (const ip of ['unknown', '__proto__', 'constructor', '"><script>alert(1)</script>']) {
    const html = renderCalendarPosterWidget({ip, size: '"><img src=x>'});
    assert.match(html, /data-ip="princess"/);
    assert.match(html, /data-size="wide"/);
    assert.doesNotMatch(html, /<script|<img src=x|data-ip="unknown"|data-ip="__proto__"/);
  }
});

test('all supplied visible and accessible copy is escaped', () => {
  const payload = '<img src=x onerror="oops"> & \'剧名\'';
  const escaped = '&lt;img src=x onerror=&quot;oops&quot;&gt; &amp; &#39;剧名&#39;';
  for (const field of ['title', 'eyebrow', 'headline', 'context', 'actionLabel']) {
    for (const mini of [false, true]) {
      const html = renderCalendarPosterWidget({[field]: payload, mini});
      assert.ok(html.includes(escaped), `${field} is escaped in ${mini ? 'mini' : 'full'} markup`);
      assert.doesNotMatch(html, /<img src=x|onerror="oops"/);
    }
  }
});

test('thumbnail is purpose-built art and title rather than a scaled functional widget', () => {
  for (const ip of ['princess', 'zhanshen']) {
    const html = renderCalendarPosterWidget({ip, mini: true});
    assert.match(html, /class="cpw-card cpw-card--mini"/);
    assert.match(html, /cpw-card__mini-title/);
    assert.match(html, /cpw-card__art/);
    assert.doesNotMatch(html, /class="cpw-card__headline"|class="cpw-card__context"|class="cpw-card__top"|class="cpw-card__bottom"|<button\b|<img\b/);
    assert.doesNotMatch(html, /widget-v4|transform:\s*scale/);
  }
});

test('interactive poster has exactly one button and only an approved action', () => {
  for (const action of ['widget-calendar', 'widget-resume']) {
    for (const mini of [false, true]) {
      const html = renderCalendarPosterWidget({interactive: true, action, mini});
      assert.match(html, /^<button\b/);
      assert.match(html, /type="button"/);
      assert.match(html, new RegExp(`data-action="${action}"`));
      assert.equal((html.match(/<button\b/g) || []).length, 1);
      assert.equal((html.match(/<\/button>/g) || []).length, 1);
      assert.doesNotMatch(html, /\bid=|role="img"/);
    }
  }
});

test('unsafe actions cannot inject an action, handler or nested element', () => {
  for (const action of ['desktop', 'javascript:alert(1)', '"><button onclick="oops">', null]) {
    const html = renderCalendarPosterWidget({interactive: true, action});
    assert.match(html, /data-action="widget-calendar"/);
    assert.equal((html.match(/<button\b/g) || []).length, 1);
    assert.doesNotMatch(html, /onclick=|javascript:|data-action="desktop"/);
  }
});

test('rendering leaves caller options intact and strict flags do not accidentally enable controls', () => {
  const options = Object.freeze({ip: 'zhanshen', size: 'square', mini: true, interactive: false, title: '斩神Ⅱ'});
  const before = {...options};
  renderCalendarPosterWidget(options);
  assert.deepEqual(options, before);
  const html = renderCalendarPosterWidget({interactive: 'true', mini: 'true'});
  assert.match(html, /^<span\b/);
  assert.doesNotMatch(html, /cpw-card--mini|<button\b/);
});

test('shared presentation reuses local IP artwork with explicit safe source windows', () => {
  assert.match(css, /assets\/princess\/reference-poster\.jpg/);
  assert.match(css, /assets\/zhanshen\/reference-top\.jpg/);
  assert.match(css, /Princess\s+y\s*=\s*1480/i);
  assert.match(css, /Zhanshen\s+y\s*=\s*458/i);
  assert.match(css, /advertisement/i);
  assert.match(css, /@supports\s*\(width:\s*1cqw\)/);
  assert.match(css, /max-width:\s*345px/);
  assert.match(css, /max\(125%,\s*425px\)/);
  assert.match(css, /max\(100%,\s*260px\)/);
  assert.match(css, /min\(-47\.080592cqw,\s*-160\.074014px\)/);
  assert.match(css, /\.cpw-card--mini|\.cpw-card\.cpw-card--mini/);
  assert.doesNotMatch(css, /https?:\/\/|data:image|widget-v4/);
});

test('poster renderer owns no persistence, history, network, raster copying or installation side effects', () => {
  assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|copyFile|writeFile|createObjectURL)\b/);
  assert.doesNotMatch(source, /document\.|window\.|navigator\.|companion-view|widget-v4/);
  assert.doesNotMatch(source, /import\s+.*(?:node:fs|fs\/promises)/);
});
