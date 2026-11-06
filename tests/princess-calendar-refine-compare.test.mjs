import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=file=>readFileSync(new URL(`../dist/${file}`,import.meta.url),'utf8');
const html=read('princess-calendar-refine-compare.html');
const css=read('princess-calendar-refine-compare.css');
const script=read('princess-calendar-refine-compare.mjs');
const decode=value=>value.replace(/&amp;/g,'&');
const frames=[...html.matchAll(/<iframe\b[^>]*>/g)].map(([tag])=>tag);
const links=[...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>/g)].map(([,href])=>decode(href)).filter(href=>href.startsWith('./princess-calendar-refine.html?'));
const tiers=['svip','vip','free'];
const labels=['SVIP','VIP','非VIP'];

test('the isolated local comparison has three rows and nine native phone canvases in row-major account order',()=>{
  assert.match(html,/<body\b[^>]*class="prc-page"/);
  assert.match(html,/href="\.\/princess-calendar-refine-compare\.css/);
  assert.match(html,/src="\.\/princess-calendar-refine-compare\.mjs/);
  assert.deepEqual([...html.matchAll(/<section\b[^>]*data-layout="([^"]+)"/g)].map(([,layout])=>layout),['fullscreen','compact','fullhero']);
  assert.equal((html.match(/class="prc-grid"/g)||[]).length,3);
  assert.equal((html.match(/class="prc-card"/g)||[]).length,9);
  assert.equal(frames.length,9);
  for(const [index,tag] of frames.entries()){
    const row=Math.floor(index/3),url=new URL(decode(tag.match(/\bsrc="([^"]+)"/)[1]),'https://local.invalid/');
    assert.equal(url.pathname,'/princess-calendar-refine.html');
    assert.equal(url.searchParams.get('presentation'),'embedded');
    assert.equal(url.searchParams.get('tier'),tiers[index%3]);
    assert.equal(url.searchParams.get('layout'),row===0?null:'player');
    assert.equal(url.searchParams.get('hero'),row===2?'full':null);
    assert.deepEqual([...url.searchParams.keys()],row===0?['presentation','tier']:row===1?['presentation','tier','layout']:['presentation','tier','layout','hero']);
    assert.match(tag,/\bwidth="453"/);
    assert.match(tag,/\bheight="912"/);
    assert.ok(tag.includes(`· ${labels[index%3]}"`));
    assert.doesNotMatch(tag,/sandbox=|loading="lazy"/,'all independent comparison frames initialize at their native size');
  }
  assert.deepEqual([...html.matchAll(/<h3>([^<]+)<\/h3>/g)].map(([,label])=>label),[...labels,...labels,...labels]);
});

test('nine standalone links retain identity and layout while dropping the embedded presentation',()=>{
  assert.equal(links.length,9);
  for(const [index,href] of links.entries()){
    const standalone=new URL(href,'https://local.invalid/');
    const framed=new URL(decode(frames[index].match(/\bsrc="([^"]+)"/)[1]),'https://local.invalid/');
    framed.searchParams.delete('presentation');
    assert.equal(standalone.href,framed.href);
    assert.equal(standalone.searchParams.has('presentation'),false);
  }
  assert.equal((html.match(/target="_blank" rel="noopener"/g)||[]).length,9);
  assert.match(html,/<nav\b[^>]*aria-label="切换日历品类"[\s\S]*?href="\.\/zhanshen-calendar-refine-compare\.html"/);
  assert.doesNotMatch(frames.join(''),/preview=|purpose=playback|zhanshen|calendar-player-compare|princess-calendar\.html\?/);
});

test('small screens retain three readable columns with keyboard-accessible horizontal scrolling',()=>{
  const clean=css.replace(/\/\*[\s\S]*?\*\//g,'');
  const columnRules=[...clean.matchAll(/grid-template-columns\s*:\s*([^;}]+)/g)].map(([,value])=>value.trim());
  assert.deepEqual(columnRules,['repeat(3,minmax(240px,1fr))'],'no breakpoint may collapse the matrix into one column');
  assert.match(clean,/\.prc-grid\s*\{[^}]*min-width:\s*768px/);
  assert.match(clean,/\.prc-card\s*\{[^}]*min-width:\s*240px/);
  assert.match(clean,/\.prc-row-scroll\s*\{[^}]*overflow-x:\s*auto;[^}]*overflow-y:\s*hidden/);
  assert.equal((html.match(/class="prc-row-scroll"[^>]*role="region"[^>]*aria-label="[^"]+"[^>]*tabindex="0"/g)||[]).length,3);
  assert.match(html,/class="prc-scroll-hint"[^>]*>左右滑动/);
  assert.match(clean,/@media\s*\(max-width:\s*815px\)[\s\S]*\.prc-scroll-hint\s*\{\s*display:\s*block/);
  assert.match(clean,/\.prc-stage iframe\s*\{[^}]*width:\s*453px;[^}]*height:\s*912px;[^}]*transform:\s*scale\(var\(--prc-scale\)\);[^}]*transform-origin:\s*top left/);
  assert.match(clean,/\.prc-stage\s*\{[^}]*width:\s*calc\(453px\s*\*\s*var\(--prc-scale\)\);[^}]*height:\s*calc\(912px\s*\*\s*var\(--prc-scale\)\)/);
});

test('the default 860px pane displays all three columns without the narrow-screen scroll hint',()=>{
  const pane=860,padding=16,gap=24,card=(pane-padding*2-gap*2)/3;
  assert.equal(card,260);
  assert.ok(card>=240);
  assert.equal(card*3+gap*2,pane-padding*2);
  assert.ok(768<=pane-padding*2,'the minimum grid width fits the default pane');
  assert.ok(pane>815,'the horizontal-scroll hint is not active in the default pane');
});

test('the shell has no cross-frame, account, network or persistence side effects',()=>{
  assert.doesNotMatch(script,/contentWindow|contentDocument|postMessage|messagechannel|localStorage|sessionStorage|indexedDB|fetch\s*\(|XMLHttpRequest|accountTier|previewTier|\.src\s*=|\.srcdoc\s*=/i);
  assert.doesNotMatch(css,/\.pc-app|\.pc-scroll|\.pc-hero|\.ply-player/,'the shell cannot restyle the nine embedded calendars');
  assert.doesNotMatch(html,/calendar-player-shell\.css|princess-calendar-refine\.css/,'child themes load inside each frame, never the comparison parent');
  assert.match(script,/querySelectorAll\('\.prc-card'\)/);
});

test('actual scaling code fits all nine phones independently, coalesces resize work and never shrinks a short mobile screen further',()=>{
  const writes=[],callbacks=[],listeners=new Map(),observed=[];
  let observerCallback;
  const widths=[425,260,240,425,260,240,425,260,240];
  const cards=widths.map((width,index)=>({getBoundingClientRect:()=>({width}),style:{setProperty(name,value){writes.push({index,name,value:Number(value)});}}}));
  class ResizeObserver {constructor(callback){observerCallback=callback;}observe(card){observed.push(card);}}
  const window={innerHeight:300,ResizeObserver,addEventListener(name,callback,options){assert.equal(options.passive,true);listeners.set(name,callback);}};
  const context={document:{querySelectorAll(selector){assert.equal(selector,'.prc-card');return cards;}},window,ResizeObserver,requestAnimationFrame:callback=>callbacks.push(callback)};
  new vm.Script(script,{filename:'princess-calendar-refine-compare.mjs'}).runInNewContext(context,{timeout:1000});
  assert.equal(writes.length,9);
  assert.deepEqual(observed,cards);
  for(const [index,write] of writes.entries()){
    assert.equal(write.index,index);
    assert.equal(write.name,'--prc-scale');
    assert.equal(write.value,Math.min(.94,widths[index]/453));
    assert.ok(write.value>=240/453,'phones retain the approved minimum scale even with a short window');
  }
  listeners.get('resize')();listeners.get('resize')();observerCallback();
  assert.equal(callbacks.length,1);
  callbacks.shift()();
  assert.equal(writes.length,18);
  assert.deepEqual(writes.slice(9),writes.slice(0,9),'each phone retains its own measured width rather than borrowing state from a neighbor');
});
