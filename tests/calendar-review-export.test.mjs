import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import {createCalendarReview} from '../scripts/export-calendar-review.mjs';

const distDir=fileURLToPath(new URL('../dist/',import.meta.url));
const review=createCalendarReview({distDir});
const payloadMatch=review.html.match(/<script\b(?=[^>]*\bid=["']calendar-review-payload["'])(?=[^>]*\btype=["']application\/json["'])[^>]*>([\s\S]*?)<\/script>/i);
assert.ok(payloadMatch,'the review must contain an inert, self-contained JSON payload');
const payload=JSON.parse(payloadMatch[1]);
const expectedFrames=[
  {id:'review-princess-full',ip:'princess',query:'?presentation=embedded&entry=widget'},
  {id:'review-princess-player',ip:'princess',query:'?presentation=embedded&entry=widget&layout=player'},
  {id:'review-princess-player-fullhero',ip:'princess',query:'?presentation=embedded&entry=widget&layout=player&hero=full'},
  {id:'review-zhanshen-full',ip:'zhanshen',query:'?presentation=embedded'},
  {id:'review-zhanshen-player',ip:'zhanshen',query:'?presentation=embedded&layout=player'},
  {id:'review-zhanshen-player-fullhero',ip:'zhanshen',query:'?presentation=embedded&layout=player&hero=full'},
];
const assetTokens=Object.keys(payload.assets);
const scripts=html=>[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(([,attrs])=>!/[\b\s]type\s*=\s*["']application\/json["']/i.test(attrs));
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const sourceAsset=relative=>readFileSync(path.join(distDir,relative.replace(/^\.\//,'')));
const decodeAsset=url=>{
  assert.match(url,/^data:image\/(?:png|jpeg|webp|svg\+xml);base64,/);
  return Buffer.from(url.slice(url.indexOf(',')+1),'base64');
};
const materialize=html=>html.replace(/__CAL_ASSET_\d+__/g,token=>{
  assert.ok(Object.hasOwn(payload.assets,token),`unknown embedded asset: ${token}`);
  return payload.assets[token];
});

test('the review is a standalone HTML document with six independent offline phone canvases',()=>{
  assert.match(review.html,/^<!doctype html>/i);
  assert.equal(review.frameCount,6);
  assert.equal((review.html.match(/<iframe\b/gi)||[]).length,7,'six comparison canvases plus one reusable single-view dialog');
  assert.equal((review.html.match(/<iframe\b[^>]*\bid=["']review-(?:princess|zhanshen)-(?:full|player|player-fullhero)["']/gi)||[]).length,6);
  for(const [tag] of review.html.matchAll(/<iframe\b[^>]*>/gi)){
    assert.doesNotMatch(tag,/\bsrc\s*=/i,'frames must be populated from the embedded payload, not another file');
    assert.match(tag,/\btitle=["'][^"']+["']/i);
  }
  assert.match(review.html,/\.srcdoc\s*=/);
  assert.equal(payload.frames.length,6);
  assert.equal(new Set(payload.frames.map(frame=>frame.id)).size,6);
  assert.deepEqual(payload.frames,expectedFrames,'retain the original four queries and append the full-hero player variant for each IP');
  for(const [index,frame] of payload.frames.entries()){
    const query=new URLSearchParams(frame.query);
    assert.equal(query.get('presentation'),'embedded','the fixed phone frame must not accidentally switch to a mobile viewport layout');
    assert.equal(query.get('layout'),index%3===0?null:'player');
    assert.equal(query.get('hero'),index%3===2?'full':null);
    assert.equal(query.get('entry'),frame.ip==='princess'?'widget':null);
    assert.equal(query.has('purpose'),false,'the query-only calendar must not become the older playback prototype');
  }
});

test('single-view controls open embedded previews instead of requiring companion files',()=>{
  const controls=[...review.html.matchAll(/<button\b[^>]*\bdata-review-open=["']([^"']+)["'][^>]*>/gi)];
  assert.equal(controls.length,6);
  assert.deepEqual(new Set(controls.map(([,id])=>id)),new Set(payload.frames.map(frame=>frame.id)));
  assert.match(review.html,/<dialog\b/i);
  assert.match(review.html,/showModal\s*\(/);
  assert.doesNotMatch(review.html,/<a\b[^>]*\bhref=["']\.?\/?(?:princess|zhanshen)-calendar\.html/i);
});

test('each child has inline CSS, a classic JavaScript bundle and explicit per-frame query injection',()=>{
  assert.deepEqual(Object.keys(payload.templates).sort(),['princess','zhanshen']);
  for(const [ip,html] of Object.entries(payload.templates)){
    assert.match(html,/<html\b[^>]*\bdata-demo-query=["']__DEMO_QUERY__["']/i);
    assert.match(html,/<style\b[^>]*>[\s\S]+<\/style>/i);
    assert.doesNotMatch(html,/<(?:link\b[^>]*rel=["']stylesheet|script\b[^>]*\bsrc\s*=)/i);
    assert.doesNotMatch(html,/<script\b[^>]*\btype=["']module["']/i);
    const executable=scripts(html);
    assert.ok(executable.length>0,`${ip} must retain its interactive controller`);
    for(const [,attrs,code] of executable){
      assert.doesNotMatch(attrs,/\bsrc\s*=/i);
      assert.doesNotMatch(code,/^\s*(?:import|export)\b/m,'a browser opened via file:// must not fetch local ESM dependencies');
      assert.doesNotThrow(()=>new vm.Script(code,{filename:`${ip}-offline-bundle.js`}),`${ip} bundle must be valid classic JavaScript`);
    }
    assert.match(executable.map(([, ,code])=>code).join('\n'),/new\s+URLSearchParams\(document\.documentElement\.dataset\.demoQuery\s*\|\|\s*['"]['"]\)/);
    assert.doesNotMatch(html,/new\s+URLSearchParams\(location\.search\)/,'srcdoc does not preserve the original URL query');
  }
  for(const [, ,code] of scripts(review.html))assert.doesNotThrow(()=>new vm.Script(code,{filename:'offline-review-shell.js'}));
});

test('all image assets are included once in the payload and match their original file bytes and hashes',()=>{
  assert.ok(assetTokens.length>=7,'the phone bezel, both IPs and the original supplied player stills must be embedded');
  assert.equal(new Set(assetTokens).size,assetTokens.length);
  for(const token of assetTokens)assert.match(token,/^__CAL_ASSET_\d+__$/);
  const decoded=assetTokens.map(token=>decodeAsset(payload.assets[token]));
  const payloadHashes=new Set(decoded.map(hash));
  assert.equal(payloadHashes.size,assetTokens.length,'identical asset files should be deduplicated in the payload');
  assert.ok(Array.isArray(review.assets));
  for(const asset of review.assets){
    assert.equal(path.isAbsolute(asset.path),false);
    const original=sourceAsset(asset.path);
    assert.equal(asset.bytes,original.length,`${asset.path}: byte count`);
    assert.equal(asset.sha256,hash(original),`${asset.path}: SHA-256`);
    assert.ok(payloadHashes.has(asset.sha256),`${asset.path}: the declared asset must actually be embedded`);
  }
  for(const expected of [
    'assets/apple/iphone-16-black-portrait.png',
    'assets/tencent/tencent-video-official-icon-192.png',
    'assets/princess/reference-poster.jpg',
    'assets/princess/reference-scroll.jpg',
    'assets/princess/player-still.png',
    'assets/zhanshen/reference-top.jpg',
    'assets/zhanshen/player-still.png',
  ])assert.ok(payloadHashes.has(hash(sourceAsset(expected))),`${expected} must remain byte-for-byte intact`);
});

test('asset substitution covers CSS, generated image markup and canvas ticket downloads without local file references',()=>{
  for(const [ip,template] of Object.entries(payload.templates)){
    const html=materialize(template);
    assert.doesNotMatch(html,/__CAL_ASSET_\d+__/);
    assert.doesNotMatch(html,/\.\/assets\//,'dynamically generated image and canvas sources must be embedded too');
    assert.doesNotMatch(html,/\burl\(\s*['"]?(?!data:|#)[^'"\s)]/i,`${ip}: CSS cannot load another file or network resource`);
    for(const [,value] of html.matchAll(/\bsrc\s*=\s*["']([^"']+)["']/gi)){
      // The shared frame renderer interpolates this constant at runtime; its
      // value is embedded separately in the same classic bundle.
      if(value==='${APPLE_PREVIEW.asset}')continue;
      assert.match(value,/^data:image\//,`${ip}: image source is offline`);
    }
    const bezel=html.match(/\basset\s*:\s*['"](data:image\/png;base64,[A-Za-z0-9+/=]+)['"]/)?.[1];
    assert.ok(bezel,`${ip}: APPLE_PREVIEW.asset is itself inlined before renderer interpolation`);
    assert.equal(hash(decodeAsset(bezel)),hash(sourceAsset('assets/apple/iphone-16-black-portrait.png')));
    assert.match(html,/canvas\.toBlob/,'saving a ticket is retained in the interactive export');
    assert.match(html,/image\.src\s*=\s*['"]data:image\//,'the canvas drawImage source must also be a self-contained image');
  }
  assert.doesNotMatch(review.html,/\/Users\/|\/private\/var\/|\/var\/folders\/|127\.0\.0\.1|localhost(?::\d+)?/i);
});

test('the exported playback layout preserves the approved ratio and unaltered landscape stills',()=>{
  for(const html of Object.values(payload.templates)){
    assert.match(html,/--ply-video-height:\s*calc\(100cqw\s*\*\s*218\s*\/\s*390\)/);
    assert.match(html,/\.ply-art\s*\{[^}]*background-size:\s*contain\s*;/);
    assert.match(html,/播放页示意/);
    assert.doesNotMatch(html,/class=\\?["']ply-brand\\?["']/,'the supplied stills already contain Tencent Video watermarks');
    assert.match(html,/\.pc-scroll\s*\{[^}]*overflow-y:\s*auto/,'the lower calendar retains its own scroll area');
  }
});

test('the export explicitly blocks network connections and scripts, styles or images from companion files',()=>{
  const meta=review.html.match(/<meta\b(?=[^>]*http-equiv=["']Content-Security-Policy["'])[^>]*>/i)?.[0];
  assert.ok(meta,'the exported file must have an offline-only Content Security Policy');
  const encodedPolicy=meta.match(/\bcontent="([^"]+)"/)?.[1]||meta.match(/\bcontent='([^']+)'/)?.[1];
  const policy=encodedPolicy?.replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&');
  assert.ok(policy);
  for(const directive of ["default-src 'none'",'img-src data:',"style-src 'unsafe-inline'","script-src 'unsafe-inline'",'frame-src about:',"connect-src 'none'"]){
    assert.ok(policy.includes(directive),`missing offline policy: ${directive}`);
  }
  assert.doesNotMatch(policy,/\b(?:https?|file):|\*|'unsafe-eval'/);
  for(const [,attrs] of scripts(review.html))assert.doesNotMatch(attrs,/\bsrc\s*=/i);
  assert.doesNotMatch(review.html,/<link\b[^>]*\bhref=/i);
});

test('the actual parent bootstrap initializes offline frames, resizes and opens and closes each standalone preview',()=>{
  // This adapter runs only the exported parent script, never a browser, network
  // request or the child app's DOM. Each child bundle is compiled above, while
  // the existing calendar tests cover its models, renderers and controllers.
  const documentListeners=new Map(),windowListeners=new Map(),dialogListeners=new Map(),buttonListeners=new Map();
  const classes=new Set(),observed=[],properties=[];
  let animationFrames=0;
  const makeFrame=id=>({id,srcdoc:'',removeAttribute(name){assert.equal(name,'srcdoc');this.srcdoc='';}});
  const frameElements=Object.fromEntries(payload.frames.map(frame=>[frame.id,makeFrame(frame.id)]));
  const standalone=makeFrame('review-single-frame'),title={textContent:''};
  const dialog={
    open:false,
    showModal(){this.open=true;},
    close(){this.open=false;dialogListeners.get('close')?.();},
    addEventListener(name,callback){dialogListeners.set(name,callback);},
  };
  const closeButton={addEventListener(name,callback){buttonListeners.set(name,callback);}};
  const elements={
    ...frameElements,
    'calendar-review-payload':{textContent:payloadMatch[1]},
    'review-single':dialog,
    'review-single-frame':standalone,
    'review-single-title':title,
    'review-single-close':closeButton,
  };
  const versions=payload.frames.map(frame=>({
    getBoundingClientRect:()=>({width:425}),
    style:{setProperty(name,value){properties.push({id:frame.id,name,value});}},
  }));
  const document={
    getElementById(id){assert.ok(Object.hasOwn(elements,id),`unexpected element lookup: ${id}`);return elements[id];},
    querySelectorAll(selector){assert.equal(selector,'.pcc-version');return versions;},
    addEventListener(name,callback){documentListeners.set(name,callback);},
    body:{classList:{add(name){classes.add(name);},remove(name){classes.delete(name);}}},
  };
  const window={innerHeight:1000,addEventListener(name,callback){windowListeners.set(name,callback);}};
  class ResizeObserver {
    constructor(callback){this.callback=callback;}
    observe(element){assert.ok(versions.includes(element));observed.push(element);}
  }
  window.ResizeObserver=ResizeObserver;
  const context={document,window,URLSearchParams,ResizeObserver,requestAnimationFrame(callback){animationFrames++;callback();}};
  for(const [, ,code] of scripts(review.html))new vm.Script(code,{filename:'offline-review-bootstrap.js'}).runInNewContext(context,{timeout:1000});
  const decodeHTML=value=>value.replace(/&amp;/g,'&').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
  const queryFrom=html=>{
    assert.ok(html.startsWith('<!doctype html>'));
    assert.doesNotMatch(html,/__CAL_ASSET_\d+__|__DEMO_QUERY__/);
    assert.match(html,/data:image\//);
    const value=html.match(/<html\b[^>]*\bdata-demo-query="([^"]*)"/)?.[1];
    assert.notEqual(value,undefined,'the instantiated child must have explicit frame parameters');
    return new URLSearchParams(decodeHTML(value));
  };
  for(const frame of payload.frames){
    const query=queryFrom(frameElements[frame.id].srcdoc);
    assert.equal(query.toString(),new URLSearchParams(frame.query).toString());
    assert.equal(query.get('presentation'),'embedded');
  }
  assert.equal(observed.length,6);
  assert.equal(properties.length,6,'the parent fits all phones immediately');
  for(const property of properties){
    assert.equal(property.name,'--pcc-scale');
    assert.ok(Number(property.value)>0&&Number(property.value)<=.94);
  }
  assert.ok(windowListeners.has('resize'));
  window.innerHeight=700;
  windowListeners.get('resize')();
  assert.equal(animationFrames,1);
  assert.equal(properties.length,12,'resizing refits all comparison phones without a browser');
  const originalDocuments=Object.fromEntries(payload.frames.map(frame=>[frame.id,frameElements[frame.id].srcdoc]));
  const click=documentListeners.get('click');
  assert.equal(typeof click,'function');
  for(const frame of payload.frames){
    click({target:{closest(selector){assert.equal(selector,'[data-review-open]');return {dataset:{reviewOpen:frame.id}};}}});
    assert.equal(dialog.open,true);
    assert.equal(classes.has('review-is-focused'),true);
    assert.ok(title.textContent.includes(frame.ip==='princess'?'尚公主':'斩神Ⅱ'));
    if(new URLSearchParams(frame.query).get('hero')==='full')assert.match(title.textContent,/完整首图/,'the new third variant must be distinguishable in its standalone dialog');
    else assert.doesNotMatch(title.textContent,/完整首图/);
    const singleQuery=queryFrom(standalone.srcdoc),expected=new URLSearchParams(frame.query);
    expected.delete('presentation');
    assert.equal(singleQuery.toString(),expected.toString(),'the single view retains IP and layout but removes embedded phone dimensions');
    assert.equal(singleQuery.has('presentation'),false);
    assert.equal(singleQuery.get('hero'),new URLSearchParams(frame.query).get('hero'),'standalone preview must not lose the full-hero variant');
    buttonListeners.get('click')();
    assert.equal(dialog.open,false);
    assert.equal(classes.has('review-is-focused'),false);
    assert.equal(standalone.srcdoc,'','closing releases the standalone child');
    for(const original of payload.frames)assert.equal(frameElements[original.id].srcdoc,originalDocuments[original.id],'standalone interactions do not replace or reset the comparison frames');
  }
  click({target:{closest:()=>null}});
  click({target:{closest:()=>({dataset:{reviewOpen:'not-a-frame'}})}});
  assert.equal(dialog.open,false,'unrelated and unknown controls do not open a preview');
});
