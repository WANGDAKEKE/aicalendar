import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {renderCalendarPlayerShell,getPlayerShellConfig,attachCalendarPlayerShell} from '../dist/calendar-player-shell.mjs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const source=read('../dist/calendar-player-shell.mjs');
const css=read('../dist/calendar-player-shell.css');

// A deliberately small DOM adapter: the shell controller needs only its own
// selectors and DOM events, not a browser, media player or viewing-history model.
function mockDOM(){
  const element=(dataset={})=>({dataset:{...dataset},attributes:{},innerHTML:'',textContent:'',value:'',setAttribute(name,value){this.attributes[name]=value;}});
  const player=element(),play=[element({shell:'play'}),element({shell:'play'})],expand=element({shell:'expand'});
  const arrow={outerHTML:''},bar=element({shell:'collapse'}),reopen=element({shell:'collapse'}),back=element({shell:'back'}),cast=element({shell:'cast'}),share=element({shell:'share'});
  bar.querySelector=selector=>selector==='svg'?arrow:null;
  const elapsed=element(),range=element();
  range.matches=selector=>selector==='input[type="range"]';
  const listeners=new Map(),buttons=[...play,expand,bar,reopen,back,cast,share];
  let mounted=false,inserted='';
  const surface={
    inert:false,
    querySelector(selector){return ({'.ply-player':player,'[data-shell="expand"]':expand,'.ply-calendar-bar button':bar,'[data-ply-elapsed]':elapsed,input:range})[selector]??null;},
    querySelectorAll(selector){return selector==='[data-shell="play"]'?play:[];},
    contains(node){return buttons.includes(node);},
    addEventListener(name,listener){listeners.set(name,listener);},
    removeEventListener(name,listener){if(listeners.get(name)===listener)listeners.delete(name);},
    remove(){mounted=false;},
  };
  const nav={insertAdjacentHTML(position,html){assert.equal(position,'afterend');mounted=true;inserted=html;}};
  const app={dataset:{},querySelector(selector){return selector==='[data-player-shell]'?(mounted?surface:null):selector==='.pc-nav'?nav:null;}};
  const click=button=>{
    let stopped=false;
    const event={target:{closest:()=>button},stopPropagation(){stopped=true;}};
    listeners.get('click')?.(event);
    return stopped;
  };
  const input=value=>{range.value=String(value);listeners.get('input')?.({target:range});};
  return {app,surface,player,play,expand,bar,reopen,back,cast,share,range,elapsed,listeners,click,input,get inserted(){return inserted;},get mounted(){return mounted;}};
}

test('the player surface uses fixed, frozen IP configuration and safely falls back',()=>{
  assert.equal(getPlayerShellConfig('princess').title,'尚公主');
  assert.equal(getPlayerShellConfig('zhanshen').title,'斩神Ⅱ');
  for(const ip of ['unrecognized','__proto__','constructor','https://untrusted.example/player','"><img src=x onerror="bad">',null,Symbol('ip'),{}]){
    const config=getPlayerShellConfig(ip),html=renderCalendarPlayerShell({ip});
    assert.equal(config,getPlayerShellConfig('princess'));
    assert.ok(Object.isFrozen(config));
    assert.match(html,/data-ip="princess"/);
    assert.doesNotMatch(html,/<img|<script|onerror=|https?:\/\//i);
  }
});

test('each IP renders labelled still artwork, native-like controls and an initially expanded calendar',()=>{
  for(const ip of ['princess','zhanshen']){
    const config=getPlayerShellConfig(ip),html=renderCalendarPlayerShell({ip});
    assert.match(html,/class="ply-shell"[^>]*data-player-shell/);
    assert.match(html,/class="ply-player"[^>]*aria-label="[^"]+画面示意"/);
    assert.match(html,new RegExp(`class="ply-art"[^>]*data-ip="${ip}"[^>]*role="img"`));
    assert.ok(html.includes(config.title));
    assert.ok(html.includes(config.calendarTitle));
    for(const action of ['back','cast','share','play','expand']){
      assert.match(html,new RegExp(`<button\\b[^>]*type="button"[^>]*data-shell="${action}"[^>]*aria-label="[^\"]+"`));
    }
    assert.match(html,/class="ply-calendar-bar"[\s\S]*?data-shell="collapse"[^>]*aria-expanded="true"/);
    assert.match(html,/class="ply-underlay"[^>]*aria-label="[^"]+"[\s\S]*?data-shell="collapse"[\s\S]*?打开追剧日历/);
    const range=html.match(/<input\b[^>]*>/)?.[0];
    assert.ok(range);
    for(const [name,value] of [['type','range'],['min','0'],['max','20'],['value','5']])assert.match(range,new RegExp(`${name}="${value}"`));
    assert.match(range,/aria-label="[^\"]*非真实播放进度"/);
    assert.doesNotMatch(html,/<(?:video|audio|iframe)\b|\bsrc=|data-play=|data-finish=|继续看|模拟看完/);
  }
});

test('attaching is opt-in, idempotent and never requires a calendar model',()=>{
  assert.equal(attachCalendarPlayerShell(null),null);
  assert.equal(attachCalendarPlayerShell({querySelector:()=>null}),null);
  const dom=mockDOM(),options=Object.freeze({ip:'zhanshen'});
  const mounted=attachCalendarPlayerShell(dom.app,options);
  assert.equal(mounted.surface,dom.surface);
  assert.match(dom.inserted,/data-ip="zhanshen"/);
  assert.equal(dom.app.dataset.calendarOpen,'true');
  assert.equal(dom.app.dataset.playerExpanded,'false');
  assert.equal(attachCalendarPlayerShell(dom.app),null);
  assert.equal(dom.listeners.size,2);
  assert.deepEqual(options,{ip:'zhanshen'});
});

test('calendar collapse, detail-page reopen and back change only shell DOM state',()=>{
  const dom=mockDOM();attachCalendarPlayerShell(dom.app);
  assert.equal(dom.bar.attributes['aria-expanded'],'true');
  assert.equal(dom.click(dom.bar),true);
  assert.equal(dom.app.dataset.calendarOpen,'false');
  assert.equal(dom.bar.attributes['aria-expanded'],'false');
  assert.match(dom.bar.attributes['aria-label'],/^展开/);
  dom.click(dom.reopen);
  assert.equal(dom.app.dataset.calendarOpen,'true');
  assert.equal(dom.bar.attributes['aria-expanded'],'true');
  dom.click(dom.back);
  assert.equal(dom.app.dataset.calendarOpen,'false');
  const before={...dom.app.dataset};
  assert.equal(dom.click({dataset:{shell:'play'}}),false);
  assert.deepEqual(dom.app.dataset,before);
});

test('illustrative playback, resize and seeking never advance time or episode progress',()=>{
  const notices=[],dom=mockDOM();attachCalendarPlayerShell(dom.app,{onNotice:notice=>notices.push(notice)});
  assert.equal(dom.player.dataset.playing,'false');
  assert.equal(dom.elapsed.textContent,'00:05');
  dom.click(dom.play[0]);
  assert.equal(dom.player.dataset.playing,'true');
  assert.ok(dom.play.every(button=>button.attributes['aria-pressed']==='true'));
  assert.equal(dom.elapsed.textContent,'00:05');
  assert.match(notices[0],/未连接真实视频/);
  dom.click(dom.play[1]);
  assert.equal(dom.player.dataset.playing,'false');
  dom.click(dom.expand);
  assert.equal(dom.app.dataset.playerExpanded,'true');
  assert.equal(dom.expand.attributes['aria-pressed'],'true');
  dom.click(dom.expand);
  assert.equal(dom.app.dataset.playerExpanded,'false');
  for(const [value,expected] of [[12.6,13],[99,20],[-3,0],['not-a-number',5]]){
    dom.input(value);
    assert.equal(dom.range.value,String(expected));
    assert.equal(dom.elapsed.textContent,`00:${String(expected).padStart(2,'0')}`);
    assert.equal(dom.range.attributes['aria-valuetext'],`演示进度${expected}秒，共20秒`);
  }
});

test('the shell scopes notices and share callbacks and becomes inert while a calendar modal is open',()=>{
  const notices=[],shares=[],dom=mockDOM();
  const mounted=attachCalendarPlayerShell(dom.app,{onNotice:notice=>notices.push(notice),onShare:()=>shares.push('share')});
  dom.click(dom.cast);
  assert.match(notices[0],/未连接任何设备/);
  assert.equal(shares.length,0);
  dom.click(dom.share);
  assert.deepEqual(shares,['share']);
  mounted.setModalOpen(true);
  assert.equal(dom.surface.inert,true);
  mounted.setModalOpen(false);
  assert.equal(dom.surface.inert,false);
  mounted.destroy();
  assert.equal(dom.mounted,false);
  assert.equal(dom.listeners.size,0);
  assert.equal('calendarOpen' in dom.app.dataset,false);
  assert.equal('playerExpanded' in dom.app.dataset,false);
});

test('the layout preserves the referenced 390 by 218 player and gives the lower calendar its own scroll viewport',()=>{
  assert.match(css,/--ply-video-height:\s*calc\(100cqw\s*\*\s*218\s*\/\s*390\)/);
  assert.match(css,/\.pc-playback-layout\s+\.ply-player\s*\{[^}]*position:\s*absolute;[^}]*top:\s*var\(--ply-top\)/);
  assert.match(css,/\.pc-playback-layout\s+\.pc-scroll\s*\{[^}]*top:\s*calc\(var\(--ply-top\)\s*\+\s*var\(--ply-video-height\)\s*\+\s*var\(--ply-bar-height\)\)/);
  assert.match(read('../dist/princess-calendar.css'),/\.pc-scroll\s*\{[^}]*overflow-y:\s*auto;[^}]*overflow-x:\s*hidden/);
  assert.match(css,/\[data-calendar-open="false"\]\s+\.pc-scroll\s*\{\s*display:\s*none/);
  assert.match(css,/\[data-calendar-open="false"\]\s+\.ply-underlay\s*\{\s*display:\s*block/);
  assert.match(css,/safe-area-inset-top/);
  assert.match(css,/\.ply-player\s+button\.ply-center\s*\{[^}]*width:\s*48px;[^}]*height:\s*48px/);
  assert.match(css,/\.ply-underlay\s*>\s*button\s*\{[^}]*min-height:\s*48px/);
});

test('the player uses the supplied landscape stills without cropping, legacy poster offsets or expanded-mode zoom',()=>{
  const artworkRules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([,selector])=>selector.includes('.ply-art'));
  const base=artworkRules.find(([,selector])=>selector.trim()==='.pc-playback-layout .ply-art');
  assert.ok(base,'the common artwork rule must exist');
  assert.match(base[2],/background-size:\s*contain\s*;/);
  assert.match(base[2],/background-position:\s*center(?:\s+center)?\s*;/);
  for(const ip of ['princess','zhanshen']){
    const rule=artworkRules.find(([,selector])=>selector.trim()===`.pc-playback-layout .ply-art[data-ip="${ip}"]`);
    assert.ok(rule,`the ${ip} still must have an explicit local asset`);
    assert.match(rule[2],new RegExp(`background-image:\\s*url\\(['\"]?\\./assets/${ip}/player-still\\.png['\"]?\\)`));
    const image=readFileSync(new URL(`../dist/assets/${ip}/player-still.png`,import.meta.url));
    assert.deepEqual([...image.subarray(0,8)],[137,80,78,71,13,10,26,10],'the supplied still remains a local PNG');
    assert.ok(image.readUInt32BE(16)>image.readUInt32BE(20),'the source still is landscape');
  }
  for(const [,selector,declarations] of artworkRules){
    for(const [,value] of declarations.matchAll(/background-size:\s*([^;}]*)/g))assert.equal(value.trim(),'contain',`${selector.trim()} must not zoom the supplied still`);
    for(const [,value] of declarations.matchAll(/background-position:\s*([^;}]*)/g))assert.match(value.trim(),/^center(?:\s+center)?$/,`${selector.trim()} must not retain a poster crop offset`);
    assert.doesNotMatch(declarations,/\btransform\s*:|\bscale\s*:/,'expanded mode must not scale the still');
  }
  assert.doesNotMatch(css,/reference-poster\.jpg|reference-top\.jpg/);
  assert.doesNotMatch(source,/class="ply-brand"/,'the supplied still already contains its own Tencent Video watermark');
});

test('the showcase has full-screen, compact-player and full-hero-player columns for both IPs without changing the old two-frame comparison',()=>{
  const html=read('../dist/calendar-player-compare.html');
  const frames=[...html.matchAll(/<iframe\b[^>]*>/g)].map(match=>match[0]);
  assert.equal(frames.length,6);
  for(const [index,ip] of ['princess','princess','princess','zhanshen','zhanshen','zhanshen'].entries()){
    assert.match(frames[index],new RegExp(`src="\\./${ip}-calendar\\.html\\?`));
    assert.match(frames[index],/title="[^"]+"/);
    const query=new URLSearchParams(frames[index].match(/\bsrc="([^"]+)"/)[1].replace(/&amp;/g,'&').split('?')[1]);
    assert.equal(query.get('layout'),index%3===0?null:'player');
    assert.equal(query.get('hero'),index%3===2?'full':null);
    assert.equal(query.get('presentation'),'embedded');
    assert.equal(query.get('entry'),ip==='princess'?'widget':null);
  }
  const old=read('../dist/calendar-category-compare.html');
  assert.equal((old.match(/<iframe\b/g)||[]).length,2);
  assert.doesNotMatch(old,/layout=player|calendar-player-shell/);
});

test('full hero artwork is enabled only by the explicit player plus hero=full query combination',()=>{
  for(const ip of ['princess','zhanshen']){
    const controller=read(`../dist/${ip}-calendar.mjs`);
    const guard=controller.match(/if\(playbackLayout\s*&&\s*params\.get\('hero'\)\s*===\s*'full'\)\s*document\.body\.classList\.add\('pc-playback-full-hero'\);/)?.[0];
    assert.ok(guard,`${ip} must keep the new hero treatment opt-in and scoped to playback layout`);
    for(const query of ['', '?hero=full','?layout=player','?layout=player&hero=compact','?layout=player&hero=full','?layout=player&hero=full&presentation=embedded']){
      const params=new URLSearchParams(query),classes=[];
      new vm.Script(guard).runInNewContext({params,playbackLayout:params.get('layout')==='player',document:{body:{classList:{add:name=>classes.push(name)}}}});
      assert.deepEqual(classes,params.get('layout')==='player'&&params.get('hero')==='full'?['pc-playback-full-hero']:[],`${ip}: ${query||'default'} must preserve the correct hero size`);
    }
    assert.doesNotMatch(read(`../dist/${ip}-calendar.html`),/<body[^>]*class="[^"]*pc-playback-full-hero/,'existing full-screen HTML cannot opt into the new treatment by default');
  }
});

test('the third player variant restores full-size IP headers without changing the approved compact player or video dimensions',()=>{
  const rules=[...css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  for(const [selector,height] of [['.pc-playback-layout.pc-playback-full-hero .pc-hero',196],['.pc-playback-layout.pc-playback-full-hero .zs-hero',170]]){
    const rule=rules.find(([,selectors])=>selectors.split(',').some(value=>value.trim()===selector));
    assert.ok(rule,`${selector} must have an explicit full-height rule`);
    assert.match(rule[2],new RegExp(`\\bheight:\\s*${height}px\\s*;`));
  }
  const compact=rules.find(([,selector])=>selector.includes('.pc-playback-layout .pc-hero')&&selector.includes('.pc-playback-layout .zs-hero')&&!selector.includes('pc-playback-full-hero'));
  assert.ok(compact);
  assert.match(compact[2],/height:\s*88px\s*;/,'the retained middle column must remain compact');
  for(const className of ['pc-hero__copy','zs-hero__copy']){
    const position=rules.find(([,selector,declarations])=>selector.includes('pc-playback-full-hero')&&selector.split(',').some(value=>value.trim().endsWith(` .${className}`))&&/bottom:\s*10px/.test(declarations));
    const subtitle=rules.find(([,selector,declarations])=>selector.includes('pc-playback-full-hero')&&selector.split(',').some(value=>value.trim().endsWith(` .${className} small`))&&/display:\s*block/.test(declarations));
    assert.ok(position,`${className}: full header restores its original text offset`);
    assert.ok(subtitle,`${className}: full header restores the original subtitle`);
  }
  for(const [,selector,declarations] of rules.filter(([,selector])=>selector.includes('pc-playback-full-hero'))){
    assert.doesNotMatch(selector,/\.ply-player|\.ply-art|\.pc-scroll/,'the new option only changes the calendar header, never the video or scroll geometry');
    assert.doesNotMatch(declarations,/--ply-video-height|background-size|\btransform\s*:/);
  }
  assert.match(css,/--ply-video-height:\s*calc\(100cqw\s*\*\s*218\s*\/\s*390\)/);
});

test('both existing entries attach the shell only for an explicit player layout and protect its controls during a modal',()=>{
  for(const ip of ['princess','zhanshen']){
    const controller=read(`../dist/${ip}-calendar.mjs`),html=read(`../dist/${ip}-calendar.html`);
    assert.match(controller,/params\.get\('layout'\)\s*===\s*'player'/);
    assert.match(controller,/if\(playbackLayout\)document\.body\.classList\.add\('pc-playback-layout'\)/);
    assert.match(controller,new RegExp(`playbackLayout\\s*\\?\\s*attachCalendarPlayerShell\\(app,\\{ip:'${ip}'`));
    assert.match(controller,/playerShell\?\.setModalOpen\(true\)/);
    assert.match(controller,/playerShell\?\.setModalOpen\(false\)/);
    assert.match(html,/calendar-player-shell\.css/);
    assert.doesNotMatch(html,/<body[^>]*class="[^"]*pc-playback-layout/);
  }
});

test('the presentation-only shell never imports a calendar model or owns persistence, media, history or network side effects',()=>{
  assert.doesNotMatch(source,/\bimport\b|\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage|indexedDB|setInterval|setTimeout|Audio|MediaSource)\b/);
  assert.doesNotMatch(source,/completed\s*\.\s*add|data-play=|data-finish=|\.play\s*\(|\.pause\s*\(/);
  assert.doesNotMatch(source,/document\.|window\.|navigator\.|createElement\(['"](?:video|audio)/);
});
