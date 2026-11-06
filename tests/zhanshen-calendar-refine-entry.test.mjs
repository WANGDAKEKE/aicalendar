import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as model from '../dist/zhanshen-calendar-refine-model.mjs';
import {renderZhanshenRefineContent} from '../dist/zhanshen-calendar-refine-view.mjs';
import {renderPrincessFrame} from '../dist/princess-calendar-view.mjs';
import {renderZhanshenTicket,renderZhanshenWidgetSetup} from '../dist/zhanshen-calendar-view.mjs';
import {animeTicketLevels} from '../dist/zhanshen-calendar-model.mjs';
import {getPrincessMembershipPreview,renderPrincessMembershipPreview} from '../dist/princess-membership-preview.mjs';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const source=read('dist/zhanshen-calendar-refine.mjs');
const html=read('dist/zhanshen-calendar-refine.html');
const LAYOUTS=['','&layout=player','&layout=player&hero=full'];
const snapshot=value=>JSON.stringify(value);

// Execute the real entry against the real projections/renderers. Only the small
// DOM surface the controller uses is stubbed; no browser or storage is exposed.
function harness(search=''){
  const listeners=new Map(),keys=new Map(),classes=new Set(),focuses=[],calls={content:[],tickets:[],widgets:[],shells:[],configs:[]},nodes=new Map();
  let document,frames=0,shareRemoved=0,timer=0;
  const focusable=(name,dataset={})=>({name,dataset,isConnected:true,disabled:false,getClientRects:()=>[{}],focus(){focuses.push(name);document.activeElement=this;}});
  const generic=selector=>{if(!nodes.has(selector))nodes.set(selector,focusable(selector));return nodes.get(selector);};
  const navTitle={textContent:''};
  const nav={inert:false,querySelector(selector){
    if(selector==='h1')return navTitle;
    if(selector==='[data-action="share"]')return {remove(){shareRemoved++;}};
    throw new Error(`Unexpected nav selector: ${selector}`);
  }};
  const scroll={innerHTML:'',inert:false,querySelector:generic};
  const layer={hidden:true},body={innerHTML:''},heading={textContent:''},eyebrow={textContent:''};
  const close=focusable('sheet-close',{action:'close'}),nativeClose=focusable('membership-close',{action:'close'}),imageScroll=focusable('membership-image-scroll');
  const sheet={dataset:{},scrollTop:0,querySelector(selector){
    return ({h2:heading,'header small':eyebrow,'.pc-sheet__body':body,'.pc-close':close,'[data-membership-close]':nativeClose})[selector]||generic(selector);
  },querySelectorAll(){return body.innerHTML.includes('data-membership-close')?[nativeClose,imageScroll]:[close];}};
  const toast={textContent:'',hidden:true};
  const app={querySelector(selector){return ({'.pc-scroll':scroll,'.pc-nav':nav,'.pc-layer':layer,'.pc-sheet':sheet,'.pc-toast':toast})[selector]||generic(selector);},addEventListener(name,fn){listeners.set(name,fn);}};
  const mount={set innerHTML(value){frames++;assert.match(value,/class="pc-app"/);},querySelector(selector){assert.equal(selector,'.pc-app');return app;}};
  document={activeElement:focusable('initial'),querySelector(selector){assert.equal(selector,'#zhanshenRefineDemo');return mount;},body:{classList:{add:(...items)=>items.forEach(item=>classes.add(item))}},documentElement:{style:{setProperty(name,value){assert.equal(name,'--pc-scale');assert.ok(Number(value)>0);}}},addEventListener(name,fn){keys.set(name,fn);}};
  const context=vm.createContext({
    ...model,renderPrincessFrame,animeTicketLevels,document,URLSearchParams,URL,location:{search},innerWidth:1200,innerHeight:1000,
    window:{addEventListener(){},matchMedia:()=>({matches:true})},setTimeout:()=>++timer,clearTimeout(){},
    renderZhanshenRefineContent(view,session){calls.content.push({view,session:structuredClone(session)});return renderZhanshenRefineContent(view,session);},
    renderZhanshenTicket(view,level){calls.tickets.push({view,level});return renderZhanshenTicket(view,level);},
    renderZhanshenWidgetSetup(...args){calls.widgets.push(args);return renderZhanshenWidgetSetup(...args);},
    getPrincessMembershipPreview(accountTier,targetTier){calls.configs.push({accountTier,targetTier});return getPrincessMembershipPreview(accountTier,targetTier);},
    renderPrincessMembershipPreview,
    attachCalendarPlayerShell(target,options){
      assert.equal(target,app);assert.equal(options.ip,'zhanshen');
      const shell={options,states:[],surface:{inert:false},setModalOpen(open){this.states.push(open);this.surface.inert=open;}};
      calls.shells.push(shell);return shell;
    },
  });
  const classic=source.replace(/^import\s*(?:\{[^}]+\}|[A-Za-z_$][\w$]*)\s*from\s*['"][^'"]+['"];?\s*$/gm,'');
  new vm.Script(classic,{filename:'zhanshen-calendar-refine.mjs'}).runInContext(context,{timeout:1000});
  const state=()=>new vm.Script('session').runInContext(context);
  const click=async(dataset={},disabled=false)=>{
    const button=focusable(`button-${dataset.action||'query'}`,dataset);button.disabled=disabled;document.activeElement=button;
    await listeners.get('click')({target:{closest:selector=>{assert.equal(selector,'button');return button;}}});return button;
  };
  const change=value=>listeners.get('change')({target:{value,matches:selector=>selector==='select[data-preview-tier]'}});
  const key=(name,shiftKey=false)=>{let prevented=false;keys.get('keydown')({key:name,shiftKey,preventDefault(){prevented=true;}});return prevented;};
  return {calls,state,click,change,key,scroll,layer,nav,navTitle,sheet,body,toast,classes,focuses,close,nativeClose,imageScroll,
    setFocus(node){document.activeElement=node;},get activeElement(){return document.activeElement;},get frames(){return frames;},get shareRemoved(){return shareRemoved;}};
}

test('anime refinement HTML loads the standalone module and its scoped overrides after the player shell',()=>{
  assert.match(html,/<body\b[^>]*class="[^"]*\bzsr-page\b/);
  assert.match(html,/id="zhanshenRefineDemo"/);
  assert.match(html,/<script\b[^>]*type="module"[^>]*src="\.\/zhanshen-calendar-refine\.mjs/);
  assert.match(html,/<link\b[^>]*href="\.\/princess-membership-preview\.css/);
  assert.ok(html.indexOf('zhanshen-calendar-refine.css')>html.indexOf('calendar-player-shell.css'));
  assert.doesNotMatch(html,/<iframe\b|<video\b|<body\b[^>]*class="[^"]*pc-playback-layout/);
  const css=read('dist/zhanshen-calendar-refine.css').replace(/\/\*[\s\S]*?\*\//g,'');
  const selectors=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(([,selector])=>selector.split(',').map(value=>value.trim())).filter(value=>!value.startsWith('@'));
  assert.ok(selectors.length>0);
  assert.ok(selectors.every(value=>value.startsWith('.zsr-page')),'new overrides must not style retained pages');
  assert.match(css,/\.zsr-page\.pc-playback-layout\s+\.zs-hero\s*\{\s*height:\s*88px/);
  assert.match(css,/\.zsr-page\.pc-playback-layout\.pc-playback-full-hero\s+\.zs-hero\s*\{\s*height:\s*170px/);
});

test('entry remains query-only, changes previews through adapters, and never writes account, history or outside state',()=>{
  for(const name of ['createZhanshenRefineSession','selectZhanshenRefineCalendar','setZhanshenRefinePreview','shiftZhanshenRefinePeriod','switchZhanshenRefineMode'])assert.match(source,new RegExp(`\\b${name}\\b`));
  assert.match(source,/from ['"]\.\/zhanshen-calendar-refine-model\.mjs['"]/);
  assert.match(source,/nav\.querySelector\(['"]h1['"]\)\.textContent=['"]追番日历['"]/);
  assert.match(source,/renderZhanshenTicket\(view\(\),level\)/);
  assert.match(source,/renderZhanshenWidgetSetup\(\{stage,size:widgetSize\}\)/);
  assert.doesNotMatch(source,/\.accountTier\s*=(?!=)|\baccountTier\s*:|\.completed\s*\.\s*(?:add|delete|clear)\s*\(/);
  assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|Notification|PushManager|localStorage|sessionStorage|indexedDB)\b|requestPermission\s*\(|navigator\.serviceWorker/);
  assert.doesNotMatch(source,/data-play=|data-finish=|showPlayer\s*\(|case\s+['"]confirm-membership['"]|params\.get\(['"]purpose['"]\)/);
});

test('three real accounts keep identical content, data and direct upgrade routes across all three layouts',()=>{
  for(const tier of ['free','vip','svip']){
    const baseline=harness(`?tier=${tier}`),initial=baseline.state();
    for(const [index,suffix] of LAYOUTS.entries()){
      const run=harness(`?tier=${tier}${suffix}`);
      assert.equal(run.scroll.innerHTML,baseline.scroll.innerHTML);
      assert.equal(run.frames,1);assert.equal(run.shareRemoved,1);assert.equal(run.navTitle.textContent,'追番日历');
      assert.deepEqual([...run.classes].sort(),index===0?[]:index===1?['pc-playback-layout']:['pc-playback-full-hero','pc-playback-layout']);
      assert.equal(run.calls.shells.length,index===0?0:1);
      assert.equal(run.state().accountTier,tier);assert.equal(run.state().previewTier,tier);
      assert.deepEqual([...run.state().completed],[...initial.completed]);
      assert.equal(snapshot(run.calls.content.at(-1).view.ticket),snapshot(baseline.calls.content.at(-1).view.ticket));
      assert.deepEqual(run.calls.content.at(-1).view.availableEpisodes,[]);
      assert.match(run.scroll.innerHTML,/aria-valuenow="3"/);
      assert.doesNotMatch(run.scroll.innerHTML,/data-play=|data-finish=|data-action="today"|18点|抢先看1集/);
      assert.equal((run.scroll.innerHTML.match(/<h3>每周四限免更新<\/h3>/g)||[]).length,1);
      assert.equal((run.scroll.innerHTML.match(/12月3日第2–15集回锁会员/g)||[]).length,1);
      if(tier==='svip')assert.doesNotMatch(run.scroll.innerHTML,/data-action="membership"|升级VIP|升级SVIP/);
      else assert.match(run.scroll.innerHTML,new RegExp(`data-action="membership" data-target-tier="${tier==='free'?'vip':'svip'}"`));
    }
  }
  for(const query of ['?hero=full','?layout=PLAYER&hero=full','?layout=fullscreen&hero=full'])assert.equal(harness(query).calls.shells.length,0);
});

test('schedule dropdown, periods, modes and reminders never change account, viewing history or player-shell ownership',async()=>{
  for(const tier of ['free','vip','svip'])for(const suffix of LAYOUTS){
    const run=harness(`?tier=${tier}${suffix}`),history=[...run.state().completed],ticket=snapshot(run.calls.content.at(-1).view.ticket);
    for(const preview of ['free','vip','svip']){
      run.change(preview);
      const view=run.calls.content.at(-1).view;
      assert.equal(run.state().accountTier,tier);assert.equal(run.state().previewTier,preview);
      assert.deepEqual(view.availableEpisodes,[]);
      if(preview==='free')assert.equal(view.schedule.days.filter(day=>day.event).length,1);
      else{assert.ok(view.schedule.days.every(day=>day.event===null));assert.equal(view.schedule.selectedEvent,null);assert.match(run.scroll.innerHTML,/会员排期待公布/);}
    }
    await run.click({date:'2026-11-06'});await run.click({period:'1'});await run.click({period:'-1'});
    await run.click({mode:'month'});await run.click({mode:'week'});await run.click({action:'reminder'});await run.click({action:'reminder'});
    assert.deepEqual([...run.state().completed],history);assert.equal(run.state().accountTier,tier);
    assert.equal(run.state().reminded,false);assert.equal(snapshot(run.calls.content.at(-1).view.ticket),ticket);
    assert.equal(run.frames,1);assert.equal(run.calls.shells.length,suffix?1:0);
    assert.ok(run.calls.shells.every(shell=>shell.states.length===0));
  }
});

test('each layout opens the exact approved membership screenshot and rejects every invalid actual-account target',async()=>{
  for(const suffix of LAYOUTS)for(const tier of ['free','vip','svip']){
    const run=harness(`?tier=${tier}&preview=svip${suffix}`),before=structuredClone(run.state());
    const allowed=tier==='free'?'vip':tier==='vip'?'svip':null;
    if(allowed){
      await run.click({action:'membership'});
      assert.deepEqual(run.calls.configs,[{accountTier:tier,targetTier:allowed}]);
      assert.equal(run.layer.hidden,false);assert.equal(run.sheet.dataset.membershipPreview,allowed);
      assert.match(run.body.innerHTML,new RegExp(`data-membership-variant="${allowed}"`));
      assert.match(run.body.innerHTML,/截图示意 · 非实时价格 · 不支付/);
      assert.doesNotMatch(run.body.innerHTML,/data-action="confirm-membership"/);
      await run.click({action:'close'});
    }
    const calls=run.calls.configs.length;
    for(const target of ['free','vip','svip','constructor','__proto__','SVIP','bad'].filter(value=>value!==allowed)){
      await run.click({action:'membership',targetTier:target});
      assert.equal(run.layer.hidden,true);assert.match(run.toast.textContent,/当前没有需要开通/);
    }
    assert.equal(run.calls.configs.length,calls);assert.deepEqual(structuredClone(run.state()),before);
  }
});

test('tickets use actual root data and legacy widget setup receives only stage/size, without granting membership',async()=>{
  const run=harness('?tier=free&preview=svip&layout=player'),before=structuredClone(run.state());
  await run.click({action:'ticket'});
  assert.equal(run.calls.tickets.length,1);assert.equal(run.calls.tickets[0].view.accountTier,'free');
  assert.deepEqual(run.calls.tickets[0].view.availableEpisodes,[]);assert.equal(run.calls.tickets[0].view.ticket.currentLevel,1);
  await run.click({action:'close'});await run.click({action:'desktop'});
  assert.equal(run.calls.widgets[0].length,1);assert.equal(snapshot(run.calls.widgets[0][0]),snapshot({stage:'setup',size:'wide'}));
  await run.click({widgetSize:'square'});assert.equal(snapshot(run.calls.widgets.at(-1)[0]),snapshot({stage:'setup',size:'square'}));
  await run.click({action:'confirm-desktop'});assert.equal(run.state().widgetPreviewed,true);
  assert.equal(snapshot(run.calls.widgets.at(-1)[0]),snapshot({stage:'desktop',size:'square'}));
  await run.click({action:'widget-calendar'});assert.equal(run.layer.hidden,true);
  assert.equal(run.state().accountTier,before.accountTier);assert.equal(run.state().previewTier,before.previewTier);
  assert.deepEqual([...run.state().completed],[...before.completed]);
});

test('modal lifecycle protects the player, traps Tab, closes with Escape and restores the prior focus',async()=>{
  for(const suffix of LAYOUTS.slice(1)){
    const run=harness(`?tier=free${suffix}`),shell=run.calls.shells[0];
    const origin=await run.click({action:'membership'});
    assert.equal(run.scroll.inert,true);assert.equal(run.nav.inert,true);assert.equal(shell.surface.inert,true);
    assert.equal(run.activeElement,run.nativeClose);
    run.setFocus(run.imageScroll);assert.equal(run.key('Tab'),true);assert.equal(run.activeElement,run.nativeClose);
    assert.equal(run.key('Tab',true),true);assert.equal(run.activeElement,run.imageScroll);
    assert.equal(run.key('Escape'),true);
    assert.equal(run.layer.hidden,true);assert.equal(run.scroll.inert,false);assert.equal(run.nav.inert,false);assert.equal(shell.surface.inert,false);
    assert.equal(run.activeElement,origin);assert.equal(run.sheet.dataset.membershipPreview,undefined);
    assert.deepEqual(shell.states,[true,false]);
    await run.click({action:'ticket'});assert.equal(run.activeElement,run.close);
    await run.click({action:'close'});assert.equal(shell.surface.inert,false);assert.equal(run.frames,1);
    const before=structuredClone(run.state());shell.options.onNotice('播放画面示意');shell.options.onShare();
    assert.deepEqual(structuredClone(run.state()),before);assert.match(run.toast.textContent,/界面演示/);
  }
});
