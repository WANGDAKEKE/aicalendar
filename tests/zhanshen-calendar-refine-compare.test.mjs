import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL(`../dist/${file}`,import.meta.url),'utf8');
const html=read('zhanshen-calendar-refine-compare.html');
const princess=read('princess-calendar-refine-compare.html');
const css=read('princess-calendar-refine-compare.css');
const decode=value=>value.replace(/&amp;/g,'&');
const frames=[...html.matchAll(/<iframe\b[^>]*>/g)].map(([tag])=>tag);
const links=[...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>/g)].map(([,href])=>decode(href));
const standalone=links.filter(href=>href.startsWith('./zhanshen-calendar-refine.html?'));
const tiers=['svip','vip','free'],labels=['SVIP','VIP','非VIP'];

test('the anime comparison has correct metadata and reuses the exact shared neutral phone shell',()=>{
  assert.match(html,/^<!doctype html>/i);
  assert.match(html,/<html lang="zh-CN">/);
  assert.match(html,/<meta charset="utf-8">/);
  assert.match(html,/<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">/);
  assert.match(html,/<title>斩神Ⅱ · 九宫格方案对照<\/title>/);
  assert.match(html,/<h1>斩神Ⅱ · 版式与会员身份对照<\/h1>/);
  assert.match(html,/<body class="prc-page">/);
  for(const type of ['stylesheet','module']){
    const pattern=type==='stylesheet'?/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/:/<script\b[^>]*type="module"[^>]*src="([^"]+)"/;
    assert.equal(html.match(pattern)?.[1],princess.match(pattern)?.[1],`${type} must share the original nine-phone parent implementation`);
  }
  assert.doesNotMatch(html,/<style\b|\bon\w+=|<script\b(?![^>]*\bsrc=)/i,'the new parent has no separate inline behavior or theme override');
});

test('the nine anime frames are row-major full-screen, compact and full-hero with SVIP, VIP and free columns',()=>{
  assert.deepEqual([...html.matchAll(/<section\b[^>]*data-layout="([^"]+)"/g)].map(([,layout])=>layout),['fullscreen','compact','fullhero']);
  assert.deepEqual([...html.matchAll(/<h2\b[^>]*>([^<]+)<\/h2>/g)].map(([,label])=>label),['01 · 全屏日历','02 · 半屏日历 · 矮图','03 · 半屏日历 · 高图']);
  assert.equal((html.match(/class="prc-grid"/g)||[]).length,3);
  assert.equal((html.match(/class="prc-card"/g)||[]).length,9);
  assert.equal(frames.length,9);
  for(const [index,tag] of frames.entries()){
    const row=Math.floor(index/3),url=new URL(decode(tag.match(/\bsrc="([^"]+)"/)[1]),'https://local.invalid/');
    assert.equal(url.pathname,'/zhanshen-calendar-refine.html');
    assert.equal(url.searchParams.get('presentation'),'embedded');
    assert.equal(url.searchParams.get('tier'),tiers[index%3]);
    assert.equal(url.searchParams.get('layout'),row===0?null:'player');
    assert.equal(url.searchParams.get('hero'),row===2?'full':null);
    assert.equal(url.searchParams.get('rev'),'campaign-v2','all frames bypass the obsolete membership-schedule cache');
    assert.deepEqual([...url.searchParams.keys()],row===0?['rev','presentation','tier']:row===1?['rev','presentation','tier','layout']:['rev','presentation','tier','layout','hero']);
    assert.match(tag,/\bwidth="453"/);
    assert.match(tag,/\bheight="912"/);
    assert.match(tag,/title="斩神Ⅱ · /);
    assert.ok(tag.includes(`· ${labels[index%3]}"`));
    assert.doesNotMatch(tag,/sandbox=|loading="lazy"/);
  }
  assert.deepEqual([...html.matchAll(/<h3>([^<]+)<\/h3>/g)].map(([,label])=>label),[...labels,...labels,...labels]);
});

test('all nine standalone links preserve identity and layout while removing embedded presentation',()=>{
  assert.equal(standalone.length,9);
  for(const [index,href] of standalone.entries()){
    const single=new URL(href,'https://local.invalid/');
    const frame=new URL(decode(frames[index].match(/\bsrc="([^"]+)"/)[1]),'https://local.invalid/');
    frame.searchParams.delete('presentation');
    assert.equal(single.href,frame.href);
    assert.equal(single.searchParams.has('presentation'),false);
  }
  assert.equal((html.match(/target="_blank" rel="noopener"/g)||[]).length,9);
  assert.doesNotMatch(html,/preview=|purpose=playback|<iframe\b[^>]*src="\.\/(?:zhanshen-calendar\.html|princess-calendar)/);
});

test('the category switch is visible before the grid and all comparison regions remain accessible',()=>{
  assert.match(html,/<nav class="prc-category-nav" aria-label="切换日历品类"><a href="\.\/princess-calendar-refine-compare\.html\?v=nav-v3">← 尚公主 · 同版对照<\/a><\/nav>/);
  assert.ok(html.indexOf('aria-label="切换日历品类"')<html.indexOf('class="prc-intro"'));
  assert.equal((html.match(/class="prc-row-scroll"[^>]*role="region"[^>]*aria-label="[^"]+"[^>]*tabindex="0"/g)||[]).length,3);
  assert.match(html,/class="prc-scroll-hint"[^>]*>左右滑动/);
  assert.match(css,/grid-template-columns:\s*repeat\(3,minmax\(240px,1fr\)\)/);
  assert.match(css,/min-width:\s*768px/);
  assert.match(css,/\.prc-stage iframe\s*\{[^}]*width:\s*453px;[^}]*height:\s*912px;[^}]*transform:\s*scale\(var\(--prc-scale\)\)/);
});

test('both category links have prominent typography, a generous touch target and readable contrast without changing the nine-phone grid',()=>{
  for(const page of [html,princess])assert.match(page,/href="\.\/princess-calendar-refine-compare\.css\?v=1\.1\.0"/,'both pages must bypass the old understated-navigation styles');
  assert.match(princess,/<nav class="prc-category-nav" aria-label="切换日历品类"><a href="\.\/zhanshen-calendar-refine-compare\.html\?v=nav-v3">斩神Ⅱ · 同版对照 ↗<\/a><\/nav>/);
  const clean=css.replace(/\/\*[\s\S]*?\*\//g,'');
  const rule=clean.match(/\.prc-category-nav\s+a\s*\{([^}]*)\}/)?.[1];
  assert.ok(rule,'the category switch must have its own styling rather than borrowing the 11px phone-card link');
  const property=name=>rule.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`))?.[1].trim();
  assert.equal(property('font-size'),'18px');
  assert.equal(property('line-height'),'28px');
  assert.equal(property('min-height'),'48px');
  assert.equal(property('padding'),'10px 16px');
  assert.ok(Number(property('font-weight'))>=600);
  assert.match(property('display'),/^(?:inline-)?flex$/);
  assert.notEqual(property('background'),'transparent');
  const rgb=value=>{
    const color=value?.match(/^#([a-f\d]{3}|[a-f\d]{6})$/i)?.[1];
    assert.ok(color,`the category link must use an explicit opaque neutral color: ${value}`);
    const expanded=color.length===3?[...color].map(channel=>channel+channel).join(''):color;
    return expanded.match(/../g).map(channel=>Number.parseInt(channel,16)/255);
  };
  const luminance=value=>rgb(value).map(channel=>channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4).reduce((sum,channel,index)=>sum+channel*[.2126,.7152,.0722][index],0);
  const text=luminance(property('color')),surface=luminance(property('background'));
  assert.ok((Math.max(text,surface)+.05)/(Math.min(text,surface)+.05)>=4.5,'the enlarged category label must retain AA text contrast on its button surface');
  assert.equal(frames.length,9);
  assert.match(clean,/grid-template-columns:\s*repeat\(3,minmax\(240px,1fr\)\)/);
});
