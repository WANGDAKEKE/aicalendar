import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as model from '../dist/princess-calendar-refine-model.mjs';
import {renderPrincessRefineContent,renderPrincessRefineReminder} from '../dist/princess-calendar-refine-view.mjs';
import {renderPrincessFrame,renderPrincessTicket} from '../dist/princess-calendar-view.mjs';
import {renderPrincessWidgetSetup} from '../dist/princess-widget-entry.mjs';
import {escapeHTML as esc} from '../dist/calendar-concept-view.mjs';
import {ticketLevels} from '../dist/ticket-model.mjs';
import {getPrincessMembershipPreview,renderPrincessMembershipPreview} from '../dist/princess-membership-preview.mjs';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const html=read('dist/princess-calendar-refine.html');
const source=read('dist/princess-calendar-refine.mjs');
const nestedSection=(markup,className)=>{
  const tags=[...markup.matchAll(/<\/?section\b[^>]*>/g)];
  const first=tags.findIndex(([tag])=>!tag.startsWith('</')&&tag.match(/\bclass="([^"]*)"/)?.[1].split(/\s+/).includes(className));
  if(first<0)return null;
  let depth=0;
  for(const tag of tags.slice(first)){
    depth+=tag[0].startsWith('</')?-1:1;
    if(depth===0){
      const start=tags[first].index,end=tag.index+tag[0].length;
      return {start,end,html:markup.slice(start,end)};
    }
  }
  return null;
};

test('the independent refinement keeps full-screen as default and loads opt-in player presentation styles',()=>{
  assert.match(html,/<body\b[^>]*class="[^"]*\bpcr-page\b/);
  assert.match(html,/<script\b[^>]*type="module"[^>]*src="\.\/princess-calendar-refine\.mjs/);
  assert.match(html,/<link\b[^>]*href="\.\/princess-calendar-refine\.css/);
  assert.match(html,/id="princessDemo"/);
  assert.match(html,/<link\b[^>]*href="\.\/calendar-player-shell\.css/);
  assert.match(html,/<link\b[^>]*href="\.\/princess-calendar-refine-player\.css/);
  assert.ok(html.indexOf('princess-calendar-refine-player.css')>html.indexOf('calendar-player-shell.css'));
  assert.doesNotMatch(html,/zhanshen|<iframe\b|<video\b|<body\b[^>]*class="[^"]*pc-playback-/);
  assert.match(source,/from ['"]\.\/calendar-player-shell\.mjs['"]/);
  assert.match(source,/\battachCalendarPlayerShell\b/);
  assert.doesNotMatch(source,/params\.get\(['"]purpose['"]\)/);
  assert.match(source,/renderPrincessFrame\(\)/);
});

test('retained comparison pages and the review exporter still use the original calendars',()=>{
  for(const file of ['dist/calendar-category-compare.html','dist/calendar-player-compare.html','dist/princess-calendar-compare.html']){
    const retained=read(file);
    assert.match(retained,/\.\/princess-calendar\.html/);
    assert.doesNotMatch(retained,/princess-calendar-refine|\bpcr-page\b/);
  }
  const exporter=read('scripts/export-calendar-review.mjs');
  assert.match(exporter,/`\$\{ip\}-calendar\.html`/);
  assert.doesNotMatch(exporter,/princess-calendar-refine|\bpcr-page\b/);
  for(const file of ['dist/princess-calendar.html','dist/princess-calendar.mjs','dist/zhanshen-calendar.html','dist/zhanshen-calendar.mjs'])assert.doesNotMatch(read(file),/princess-calendar-refine|\bpcr-page\b/,`${file} must not import or select the new study`);
});

test('the controller uses presentation adapters without writing account identity, history or external state',()=>{
  for(const name of ['createPrincessRefineSession','selectPrincessRefineCalendar','setPrincessRefinePreview','shiftPrincessRefinePeriod','switchPrincessRefineMode'])assert.match(source,new RegExp(`\\b${name}\\b`));
  assert.match(source,/from ['"]\.\/princess-calendar-refine-model\.mjs['"]/);
  assert.match(source,/from ['"]\.\/princess-calendar-refine-view\.mjs\?v=calendar-label-v1['"]/,'the renamed calendar view uses a new cache version without changing the account model');
  assert.doesNotMatch(source,/\.accountTier\s*=(?!=)|\baccountTier\s*:|\.completed\s*\.\s*(?:add|delete|clear)\s*\(/);
  assert.doesNotMatch(source,/dataset\.(?:finish|play)\b|data-finish=|data-play=|showPlayer\s*\(|\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|Notification|PushManager|localStorage|sessionStorage|indexedDB)\b/);
  assert.doesNotMatch(source,/navigator\.serviceWorker|requestPermission\s*\(|\.subscribe\s*\(/);
  assert.match(source,/session\s*=\s*setPrincessRefinePreview\(session,/);
  assert.match(source,/session\s*=\s*switchPrincessRefineMode\(session,/);
  assert.match(source,/session\s*=\s*shiftPrincessRefinePeriod\(session,/);
  assert.doesNotMatch(source,/resetPrincessRefineToday|case\s+['"]today['"]|data-action=["']today["']/);
});

test('navigation removes sharing without hosting reminders, and tickets and widgets reuse actual-account renderers',()=>{
  assert.doesNotMatch(source,/nav\.querySelector\([^\n]*reminder/);
  assert.doesNotMatch(source,/renderPrincessRefineReminder\(session\.reminded\)/);
  assert.match(source,/nav\.querySelector\(['"]\[data-action=["']share["']\]['"]\)\??\.remove\(\)/);
  assert.match(source,/renderPrincessTicket\(view\(\),level\)/);
  assert.match(source,/renderPrincessWidgetSetup\(view\(\),/);
  assert.doesNotMatch(source,/renderPrincessTicket\(view\(\)\.schedule|renderPrincessWidgetSetup\(view\(\)\.schedule/);
  assert.match(source,/from ['"]\.\/princess-calendar-view\.mjs['"]/);
  assert.match(source,/from ['"]\.\/princess-widget-entry\.mjs['"]/);
});

// Execute the real controller with real model and view functions. The adapter
// supplies only the DOM operations it uses; no browser, network or persistence
// is available. Rendered strings remain inspectable without parsing an app DOM.
function controllerHarness(search=''){
  const listeners=new Map(),documentListeners=new Map(),windowListeners=new Map(),bodyClasses=new Set(),focuses=[],scrolls=[],focusQueries=[];
  const calls={content:[],ticket:[],widget:[],reminder:[],shell:[],membershipConfig:[],membershipRender:[]};
  const nodes=new Map(),timers=new Map();
  let timerId=0,shareRemovals=0,frameWrites=0,frameHTML='';
  let navHTML=renderPrincessFrame().match(/<header class="pc-nav">([\s\S]*?)<\/header>/)?.[1]||'';
  let document;
  function focusable(label,dataset={}){
    return {dataset,isConnected:true,disabled:false,label,focus(options){if(options!==undefined)assert.equal(options.preventScroll,true);focuses.push(label);document.activeElement=this;},getClientRects:()=>[{}]};
  }
  const generic=selector=>{
    if(!nodes.has(selector))nodes.set(selector,focusable(selector));
    return nodes.get(selector);
  };
  const share={remove(){shareRemovals++;navHTML=navHTML.replace(/<button\b[^>]*data-action="share"[^>]*>[\s\S]*?<\/button>/,'');}};
  const nav={inert:false,querySelector(selector){if(selector==='[data-action="share"]')return shareRemovals?null:share;throw new Error(`Unexpected navigation selector: ${selector}`);}};
  const calendar={getBoundingClientRect:()=>({top:520})};
  const scroll={innerHTML:'',inert:false,scrollTop:0,getBoundingClientRect:()=>({top:104}),scrollTo(options){scrolls.push(options);this.scrollTop=options.top;},querySelector(selector){return selector==='.pc-calendar'?calendar:generic(selector);}};
  const layer={hidden:true},sheetBody={innerHTML:''},heading={textContent:''},eyebrow={textContent:''},closeButton=focusable('sheet-close',{action:'close'}),membershipCloseButton=focusable('membership-screenshot-close',{action:'close',membershipClose:''}),membershipImageScroll=focusable('membership-image-scroll');
  const sheet={dataset:{},scrollTop:0,querySelector(selector){
    if(selector==='[data-membership-close]')return sheetBody.innerHTML.includes('data-membership-close')?membershipCloseButton:null;
    if(selector==='[tabindex="0"]')return sheetBody.innerHTML.includes('tabindex="0"')?membershipImageScroll:null;
    return ({h2:heading,'header small':eyebrow,'.pc-sheet__body':sheetBody,'.pc-close':closeButton})[selector]||generic(selector);
  },querySelectorAll(selector){
    focusQueries.push(selector);
    return sheetBody.innerHTML.includes('data-membership-close')?[membershipCloseButton,...(sheetBody.innerHTML.includes('tabindex="0"')&&selector.includes('[tabindex="0"]')?[membershipImageScroll]:[])]:[closeButton];
  }};
  const toast={textContent:'',hidden:true};
  const app={querySelector(selector){return ({'.pc-scroll':scroll,'.pc-nav':nav,'.pc-layer':layer,'.pc-sheet':sheet,'.pc-toast':toast})[selector]||generic(selector);},addEventListener(name,callback){listeners.set(name,callback);}};
  const mount={get innerHTML(){return frameHTML;},set innerHTML(value){frameWrites++;frameHTML=value;},querySelector(selector){assert.equal(selector,'.pc-app');return app;}};
  document={
    activeElement:focusable('initial-focus'),
    querySelector(selector){assert.equal(selector,'#princessDemo');return mount;},
    addEventListener(name,callback){documentListeners.set(name,callback);},
    body:{classList:{add:(...names)=>names.forEach(name=>bodyClasses.add(name))}},
    documentElement:{style:{setProperty(name,value){assert.equal(name,'--pc-scale');assert.ok(Number(value)>0);}}},
  };
  const context=vm.createContext({
    ...model,renderPrincessFrame,esc,ticketLevels,document,
    renderPrincessRefineContent(view,session){calls.content.push({view,session:structuredClone(session)});return renderPrincessRefineContent(view,session);},
    renderPrincessRefineReminder(reminded){calls.reminder.push(reminded);return renderPrincessRefineReminder(reminded);},
    renderPrincessTicket(view,level){calls.ticket.push({view,level});return renderPrincessTicket(view,level);},
    renderPrincessWidgetSetup(view,options){calls.widget.push({view,options});return renderPrincessWidgetSetup(view,options);},
    getPrincessMembershipPreview(accountTier,targetTier){calls.membershipConfig.push({accountTier,targetTier});return getPrincessMembershipPreview(accountTier,targetTier);},
    renderPrincessMembershipPreview(config){calls.membershipRender.push(config);return renderPrincessMembershipPreview(config);},
    attachCalendarPlayerShell(target,options){
      assert.equal(target,app,'the retained app frame is the only shell attachment target');
      assert.equal(options.ip,'princess');
      assert.equal(typeof options.onNotice,'function');
      assert.equal(typeof options.onShare,'function');
      const surface={inert:false},modalStates=[];
      const record={target,options,surface,modalStates,destroyed:0};
      const handle={surface,setModalOpen(open){assert.equal(typeof open,'boolean');modalStates.push(open);surface.inert=open;},destroy(){record.destroyed++;}};
      record.handle=handle;calls.shell.push(record);return handle;
    },
    URLSearchParams,URL,location:{search},innerWidth:900,innerHeight:1000,
    window:{matchMedia:()=>({matches:true}),addEventListener(name,callback){windowListeners.set(name,callback);}},
    setTimeout(callback){timers.set(++timerId,callback);return timerId;},clearTimeout:id=>timers.delete(id),
  });
  const classic=source.replace(/^import\s*(?:\{[^}]+\}|[A-Za-z_$][\w$]*)\s*from\s*['"][^'"]+['"];?\s*$/gm,'');
  new vm.Script(classic,{filename:'princess-calendar-refine.mjs'}).runInContext(context,{timeout:1000});
  const state=()=>new vm.Script('session').runInContext(context);
  const actual=()=>model.selectPrincessRefineCalendar(state());
  const click=async(dataset={},options={})=>{
    const button=focusable(`button-${dataset.action||Object.keys(dataset)[0]||'unknown'}`,dataset);
    Object.assign(button,options);document.activeElement=button;
    await listeners.get('click')({target:{closest(selector){assert.equal(selector,'button');return button;}}});
    return button;
  };
  const change=value=>listeners.get('change')({target:{value,matches:selector=>selector==='select[data-preview-tier]'}});
  const openSheet=(kind,markup='<p>普通弹窗内容</p>')=>new vm.Script('open').runInContext(context)('测试弹窗','测试说明',markup,kind);
  return {calls,state,actual,click,change,openSheet,scroll,nav,layer,sheet,sheetBody,heading,eyebrow,toast,focuses,focusQueries,scrolls,bodyClasses,documentListeners,windowListeners,get activeElement(){return document.activeElement;},get frameWrites(){return frameWrites;},get reminderHTML(){return scroll.innerHTML.match(/<button\b[^>]*data-action="reminder"[^>]*>[\s\S]*?<\/button>/)?.[0]||'';},get navHTML(){return navHTML;},get shareRemovals(){return shareRemovals;}};
}

test('the opt-in player shell never enables actual playback or membership for a free query calendar',()=>{
  const harness=controllerHarness('?tier=free&layout=player&hero=full&purpose=playback&presentation=embedded');
  assert.deepEqual([...harness.bodyClasses].sort(),['pc-embedded','pc-playback-full-hero','pc-playback-layout']);
  assert.equal(harness.calls.shell.length,1);
  assert.equal(harness.state().accountTier,'free');
  assert.equal(harness.state().previewTier,'free');
  assert.deepEqual(harness.actual().availableEpisodes,[]);
  assert.doesNotMatch(harness.scroll.innerHTML,/data-play=|data-finish=|class="ply-shell"/);
  assert.equal(harness.shareRemovals,1);
  assert.match(harness.reminderHTML,/data-action="reminder"/);
  assert.doesNotMatch(harness.navHTML,/data-action="(?:share|reminder)"/);
  assert.equal(harness.calls.reminder.length,0,'the controller must not maintain a separate navigation reminder');
  assert.equal(harness.windowListeners.has('resize'),true);
});

test('all three real account states preserve identical default schedules, tickets and CTAs across layouts',()=>{
  const layouts=[
    {query:'',classes:[],shells:0},
    {query:'&layout=player',classes:['pc-playback-layout'],shells:1},
    {query:'&layout=player&hero=full',classes:['pc-playback-full-hero','pc-playback-layout'],shells:1},
  ];
  for(const account of ['vip','svip','free']){
    const baseline=controllerHarness(`?tier=${account}`),original=baseline.actual();
    for(const layout of layouts){
      const harness=controllerHarness(`?tier=${account}${layout.query}`),current=harness.actual();
      assert.deepEqual([...harness.bodyClasses].sort(),layout.classes,`${account}/${layout.query}: layout must be explicitly selected`);
      assert.equal(harness.calls.shell.length,layout.shells);
      assert.equal(harness.frameWrites,1);
      assert.equal(harness.state().accountTier,account);
      assert.equal(harness.state().previewTier,account);
      assert.deepEqual([...harness.state().completed],[...baseline.state().completed]);
      assert.deepEqual(current.availableEpisodes,original.availableEpisodes);
      assert.equal(JSON.stringify(current.ticket),JSON.stringify(original.ticket));
      assert.deepEqual(current.schedule.days.map(day=>day.release),original.schedule.days.map(day=>day.release));
      assert.equal(harness.scroll.innerHTML,baseline.scroll.innerHTML,'the layout changes presentation, not query markup, CTA or account data');
      assert.match(harness.scroll.innerHTML,/aria-valuenow="24"/);
      assert.doesNotMatch(harness.scroll.innerHTML,/data-play=|data-finish=|data-action="today"/);
      assert.equal((harness.scroll.innerHTML.match(/会员每日18点更新/g)||[]).length,1);
      assert.equal((harness.scroll.innerHTML.match(/SVIP抢先看1集/g)||[]).length,1);
      if(account==='vip')assert.match(harness.scroll.innerHTML,/data-action="membership" data-target-tier="svip"/);
      else if(account==='free'){
        assert.deepEqual(current.availableEpisodes,[]);
        assert.ok(current.schedule.days.every(day=>day.release===null));
        assert.match(harness.scroll.innerHTML,/data-action="membership" data-target-tier="vip"/);
        assert.match(harness.scroll.innerHTML,/>升级VIP\s/);
        assert.doesNotMatch(harness.scroll.innerHTML,/data-action="preview-membership"|看VIP排期/);
      }else{
        assert.match(harness.scroll.innerHTML,/class="pcr-rules"/);
        assert.doesNotMatch(harness.scroll.innerHTML,/data-action="membership"|data-action="preview-membership"|升级SVIP/);
      }
    }
  }
});

test('every free-account schedule preview has identical direct-VIP markup across layouts while the pure model stays unchanged',()=>{
  for(const preview of ['free','vip','svip']){
    const baseline=controllerHarness(`?tier=free&preview=${preview}`);
    const markup=baseline.scroll.innerHTML,raw=model.selectPrincessRefineCalendar(baseline.state());
    assert.equal(raw.marketing.kind,preview==='free'?'preview':'membership');
    assert.equal(raw.marketing.tier,preview==='free'?'vip':preview);
    for(const suffix of ['&layout=player','&layout=player&hero=full']){
      const harness=controllerHarness(`?tier=free&preview=${preview}${suffix}`);
      assert.equal(harness.scroll.innerHTML,markup,'all calendar content and the direct-upgrade CTA remain byte-identical');
      assert.equal(JSON.stringify(harness.calls.content.at(-1).view.marketing),JSON.stringify(baseline.calls.content.at(-1).view.marketing));
      assert.equal(harness.state().accountTier,'free');
      assert.equal(harness.state().previewTier,preview);
      assert.deepEqual(harness.actual().availableEpisodes,[]);
      assert.equal(JSON.stringify(harness.actual().ticket),JSON.stringify(baseline.actual().ticket));
      assert.deepEqual([...harness.state().completed],[...baseline.state().completed]);
      assert.match(harness.scroll.innerHTML,/>升级VIP\s/);
      assert.match(harness.scroll.innerHTML,/data-action="membership" data-target-tier="vip"/);
      assert.doesNotMatch(harness.scroll.innerHTML,/data-action="preview-membership"|看VIP排期/);
    }
  }
});

test('all nine layouts keep account-specific membership inside the calendar and the desktop card directly below it across week and month previews',()=>{
  for(const account of ['svip','vip','free'])for(const suffix of ['','&layout=player','&layout=player&hero=full'])for(const preview of ['free','vip','svip'])for(const mode of ['week','month']){
    const harness=controllerHarness(`?tier=${account}&preview=${preview}&mode=${mode}${suffix}`);
    const markup=harness.scroll.innerHTML,label=`${account}/${suffix||'fullscreen'}/${preview}/${mode}`;
    const calendar=nestedSection(markup,'pc-calendar'),widget=nestedSection(markup,'pc-desktop-entry');
    const membership=nestedSection(markup,account==='svip'?'pcr-rules':'pcr-marketing');
    assert.ok(calendar&&widget&&membership,`${label}: all query sections remain present`);
    assert.ok(calendar.start<membership.start&&membership.end<calendar.end,`${label}: membership occupies the paper calendar footer`);
    assert.equal(markup.slice(calendar.end,widget.start).trim(),'',`${label}: desktop is the direct external successor`);
    assert.doesNotMatch(calendar.html,/class="pc-desktop-entry"/);
    assert.doesNotMatch(widget.html,/pcr-marketing|pcr-rules|data-action="membership"|data-action="preview-membership"/);
    assert.equal((markup.match(/data-action="desktop"/g)||[]).length,1);
    assert.equal((markup.match(/会员每日18点更新/g)||[]).length,1);
    assert.equal((markup.match(/SVIP抢先看1集/g)||[]).length,1);
    assert.doesNotMatch(markup,/data-action="preview-membership"|data-play=|data-finish=/);
    if(account==='svip')assert.doesNotMatch(markup,/data-action="membership"|升级VIP|升级SVIP/);
    else{
      assert.equal((markup.match(/data-action="membership"/g)||[]).length,1);
      assert.ok(membership.html.includes(`data-action="membership" data-target-tier="${account==='free'?'vip':'svip'}"`));
    }
    assert.equal(harness.state().accountTier,account);
    assert.equal(harness.state().previewTier,preview);
    if(account==='free')assert.deepEqual(harness.actual().availableEpisodes,[]);
  }
});

test('hero=full is inert without the exact player layout parameter',()=>{
  for(const query of ['?hero=full','?layout=fullscreen&hero=full','?layout=PLAYER&hero=full','?hero=full&purpose=playback']){
    const harness=controllerHarness(query);
    assert.deepEqual([...harness.bodyClasses],[]);
    assert.equal(harness.calls.shell.length,0);
    assert.equal(harness.frameWrites,1);
    assert.equal(harness.state().accountTier,'vip');
  }
});

test('the scoped player stylesheet preserves 88px compact and 196px full poster choices without changing defaults',()=>{
  const css=read('dist/princess-calendar-refine-player.css').replace(/\/\*[\s\S]*?\*\//g,'');
  const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(([,selectors,body])=>selectors.split(',').map(selector=>({selector:selector.trim(),body})));
  const realRules=rules.filter(rule=>!rule.selector.startsWith('@'));
  assert.ok(realRules.length>0);
  assert.ok(realRules.every(rule=>rule.selector.startsWith('.pcr-page.pc-playback-layout')),'every override must require both the refinement and player layout');
  const heroes=realRules.filter(rule=>/\.pc-hero$/.test(rule.selector));
  assert.ok(heroes.some(rule=>/height\s*:\s*88px(?:;|$)/.test(rule.body)));
  assert.ok(heroes.some(rule=>rule.selector.includes('.pc-playback-full-hero')&&/height\s*:\s*196px(?:;|$)/.test(rule.body)));
  assert.doesNotMatch(css,/url\([^)]*(?:drama-recording|https?:)/);
});

test('player-only notice and share callbacks remain local presentation without touching account data',()=>{
  for(const query of ['?tier=free&layout=player','?tier=free&layout=player&hero=full']){
    const harness=controllerHarness(query),shell=harness.calls.shell[0];
    const stateBefore=structuredClone(harness.state());
    shell.options.onNotice('播放控件状态演示，未连接真实视频');
    assert.match(harness.toast.textContent,/未连接真实视频/);
    shell.options.onShare();
    assert.match(harness.toast.textContent,/本地评审原型，请转发页面链接/);
    assert.deepEqual(structuredClone(harness.state()),stateBefore);
    assert.equal(harness.layer.hidden,true);
    assert.equal(harness.calls.shell.length,1);
    assert.equal(shell.surface.inert,false);
  }
});

test('player shell stays mounted across dates, periods, modes, previews and reminder toggles',async()=>{
  for(const account of ['vip','svip','free'])for(const suffix of ['&layout=player','&layout=player&hero=full']){
    const harness=controllerHarness(`?tier=${account}${suffix}`),shell=harness.calls.shell[0],initial=harness.actual();
    const history=[...harness.state().completed],ticket=JSON.stringify(initial.ticket),available=[...initial.availableEpisodes];
    await harness.click({date:'2026-11-06'});
    await harness.click({period:'1'});
    await harness.click({period:'-1'});
    await harness.click({mode:'month'});
    await harness.click({mode:'week'});
    for(const tier of ['svip','vip','free'])harness.change(tier);
    await harness.click({action:'reminder'});
    await harness.click({action:'reminder'});
    assert.equal(harness.calls.shell.length,1);
    assert.equal(harness.calls.shell[0],shell);
    assert.equal(shell.destroyed,0);
    assert.equal(shell.surface.inert,false);
    assert.deepEqual(shell.modalStates,[]);
    assert.equal(harness.frameWrites,1,'only .pc-scroll content is rerendered after initial frame creation');
    assert.equal(harness.state().accountTier,account);
    assert.deepEqual([...harness.state().completed],history);
    assert.equal(JSON.stringify(harness.actual().ticket),ticket);
    assert.deepEqual(harness.actual().availableEpisodes,available);
    assert.equal(harness.layer.hidden,true);
    assert.equal(harness.state().reminded,false);
  }
});

test('all player-shell controls are inert while calendar sheets are open and restored on closing',async()=>{
  for(const suffix of ['&layout=player','&layout=player&hero=full']){
    const harness=controllerHarness(`?tier=free&preview=vip${suffix}`),shell=harness.calls.shell[0];
    for(const dataset of [{action:'ticket'},{action:'desktop'},{action:'membership',targetTier:'vip'},{action:'extra'}]){
      await harness.click(dataset);
      assert.equal(harness.layer.hidden,false);
      assert.equal(harness.scroll.inert,true);
      assert.equal(harness.nav.inert,true);
      assert.equal(shell.surface.inert,true);
      assert.equal(shell.modalStates.at(-1),true);
      if(dataset.action==='membership'){
        assert.equal(harness.sheet.dataset.membershipPreview,'vip');
        assert.doesNotMatch(harness.sheetBody.innerHTML,/data-action="confirm-membership"/);
        const message=harness.toast.textContent;
        await harness.click({action:'confirm-membership',targetTier:'vip'});
        assert.equal(harness.toast.textContent,message,'a stale confirmation does nothing in a screenshot-only modal');
        assert.equal(shell.surface.inert,true,'the screenshot stays protected until closed');
        assert.equal(harness.state().accountTier,'free');
      }
      await harness.click({action:'close'});
      assert.equal(harness.layer.hidden,true);
      assert.equal(harness.scroll.inert,false);
      assert.equal(harness.nav.inert,false);
      assert.equal(shell.surface.inert,false);
      assert.equal(shell.modalStates.at(-1),false);
    }
    await harness.click({action:'ticket'});
    let prevented=false;
    harness.documentListeners.get('keydown')({key:'Escape',preventDefault(){prevented=true;}});
    assert.equal(prevented,true);
    assert.equal(shell.surface.inert,false,'Escape follows the same player protection lifecycle');
    assert.equal(harness.calls.shell.length,1);
    assert.equal(shell.destroyed,0);
    assert.equal(harness.frameWrites,1);
  }
});

test('schedule changes preserve each real account, ticket and viewing history across every preview tier',()=>{
  for(const account of ['free','vip','svip']){
    const harness=controllerHarness(`?tier=${account}`),initial=harness.actual();
    const completed=[...harness.state().completed],ticket=JSON.stringify(initial.ticket),available=[...initial.availableEpisodes];
    for(const preview of ['svip','free','vip']){
      harness.change(preview);
      assert.equal(harness.state().accountTier,account);
      assert.equal(harness.state().previewTier,preview);
      assert.deepEqual([...harness.state().completed],completed);
      assert.equal(JSON.stringify(harness.actual().ticket),ticket);
      assert.deepEqual(harness.actual().availableEpisodes,available);
      assert.equal(harness.calls.content.at(-1).view.accountTier,account);
      assert.equal(harness.calls.content.at(-1).view.schedule.accountTier,preview);
      assert.equal(harness.layer.hidden,true);
      assert.equal((harness.scroll.innerHTML.match(/会员每日18点更新/g)||[]).length,1);
      assert.equal((harness.scroll.innerHTML.match(/SVIP抢先看1集/g)||[]).length,1);
      assert.doesNotMatch(harness.scroll.innerHTML,/data-action="today"|回到今天|pcr-calendar-utility/);
      if(account==='svip'){
        assert.match(harness.scroll.innerHTML,/class="pcr-rules"/);
        assert.doesNotMatch(harness.scroll.innerHTML,/data-action="membership"|data-action="preview-membership"|升级SVIP/);
      }else if(account==='vip'){
        assert.match(harness.scroll.innerHTML,/data-action="membership" data-target-tier="svip"/);
      }else{
        assert.match(harness.scroll.innerHTML,/data-action="membership" data-target-tier="vip"/);
        assert.match(harness.scroll.innerHTML,/>升级VIP\s/);
        assert.doesNotMatch(harness.scroll.innerHTML,/data-action="preview-membership"|看VIP排期/);
      }
    }
  }
});

test('schedule selection in both player layouts stays independent from the synchronized direct-upgrade CTA',async()=>{
  for(const suffix of ['&layout=player','&layout=player&hero=full']){
    const harness=controllerHarness(`?tier=free${suffix}`);
    assert.match(harness.scroll.innerHTML,/>升级VIP\s/);
    assert.doesNotMatch(harness.scroll.innerHTML,/data-action="preview-membership"/);
    harness.change('vip');
    assert.equal(harness.state().previewTier,'vip');
    assert.equal(harness.state().accountTier,'free');
    assert.deepEqual(harness.actual().availableEpisodes,[]);
    assert.equal(harness.layer.hidden,true,'preview is an in-calendar presentation change, not a membership modal');
    assert.equal(harness.heading.textContent,'');
    assert.equal(harness.calls.membershipConfig.length,0);
    assert.match(harness.scroll.innerHTML,/data-action="membership" data-target-tier="vip"/);
    assert.match(harness.scroll.innerHTML,/>升级VIP\s/);
    assert.match(harness.toast.textContent,/不改变当前非VIP身份/);
    assert.equal(harness.focuses.at(-1),'select[data-preview-tier]');
    // The retained explicit preview helper is still non-authorizing and
    // reduced-motion-safe, even though no bottom CTA exposes that action.
    await harness.click({action:'preview-membership',previewTier:'svip'});
    assert.equal(harness.state().previewTier,'svip');
    assert.equal(harness.layer.hidden,true);
    assert.equal(harness.calls.membershipConfig.length,0);
    assert.match(harness.scroll.innerHTML,/data-action="membership" data-target-tier="vip"/);
    assert.ok(harness.scrolls.length>0);
    assert.equal(harness.scrolls.at(-1).behavior,'auto','calendar focus respects reduced motion');
    assert.ok(harness.scrolls.at(-1).top>=0);
  }
});

test('calendar navigation and the hero reminder keep preview, authorization and completion state independent',async()=>{
  const harness=controllerHarness('?tier=free&preview=svip');
  const completed=[...harness.state().completed],ticket=JSON.stringify(harness.actual().ticket);
  await harness.click({date:'2026-11-06'});
  assert.equal(harness.state().selectedDate,'2026-11-06');
  await harness.click({mode:'month'});
  assert.equal(harness.state().mode,'month');
  await harness.click({period:'1'});
  assert.equal(harness.state().month,'2026-12');
  await harness.click({period:'-1'});
  assert.equal(harness.state().selectedDate,'2026-11-01');
  assert.equal(harness.state().month,'2026-11');
  assert.doesNotMatch(harness.scroll.innerHTML,/data-action="today"|回到今天/);
  await harness.click({action:'reminder'});
  assert.equal(harness.state().reminded,true);
  assert.match(harness.reminderHTML,/aria-pressed="true"/);
  assert.match(harness.toast.textContent,/不发送真实通知/);
  await harness.click({action:'reminder'});
  assert.equal(harness.state().reminded,false);
  assert.match(harness.reminderHTML,/aria-pressed="false"/);
  assert.equal((harness.scroll.innerHTML.match(/data-action="reminder"/g)||[]).length,1);
  assert.match(harness.scroll.innerHTML,/<section class="pc-hero"[\s\S]*?data-action="reminder"[\s\S]*?<\/section>/);
  assert.doesNotMatch(harness.navHTML,/data-action="(?:share|reminder)"/);
  assert.equal(harness.calls.reminder.length,0);
  assert.equal(harness.state().previewTier,'svip');
  assert.equal(harness.state().accountTier,'free');
  assert.deepEqual([...harness.state().completed],completed);
  assert.equal(JSON.stringify(harness.actual().ticket),ticket);
  assert.deepEqual(harness.actual().availableEpisodes,[]);
});

test('membership confirmation remains a toast while modal inertness and focus are restored on close',async()=>{
  const harness=controllerHarness('?tier=free&preview=svip');
  const before=[...harness.state().completed];
  const button=await harness.click({action:'membership',targetTier:'svip'});
  assert.equal(harness.layer.hidden,false);
  assert.equal(harness.nav.inert,true);
  assert.equal(harness.scroll.inert,true);
  assert.match(harness.heading.textContent,/开通SVIP/);
  assert.equal(harness.sheet.dataset.membershipPreview,undefined,'free→SVIP has no supplied full-screen snapshot and retains its generic fallback');
  assert.equal(harness.calls.membershipRender.length,0);
  assert.match(harness.sheetBody.innerHTML,/当前账号为非VIP/);
  await harness.click({action:'confirm-membership',targetTier:'svip'});
  assert.match(harness.toast.textContent,/不创建订单或改变会员身份/);
  assert.equal(harness.state().accountTier,'free');
  assert.equal(harness.state().previewTier,'svip');
  assert.deepEqual([...harness.state().completed],before);
  assert.deepEqual(harness.actual().availableEpisodes,[]);
  assert.equal(harness.layer.hidden,false);
  await harness.click({action:'close'});
  assert.equal(harness.layer.hidden,true);
  assert.equal(harness.nav.inert,false);
  assert.equal(harness.scroll.inert,false);
  assert.equal(harness.focuses.at(-1),button.label);
  await harness.click({action:'confirm-membership',targetTier:'svip'});
  assert.equal(harness.layer.hidden,true,'a stray confirmation cannot create a membership flow');
});

test('VIP→SVIP and free→VIP use the same supplied screenshot UI in every layout',async()=>{
  for(const [account,target,variant,title] of [['vip','svip','svip','SVIP开通页'],['free','vip','vip','VIP开通页']])for(const suffix of ['', '&layout=player','&layout=player&hero=full']){
    const harness=controllerHarness(`?tier=${account}&preview=free${suffix}`),shell=harness.calls.shell[0];
    const stateBefore=structuredClone(harness.state()),calendarBefore=harness.scroll.innerHTML;
    const button=await harness.click({action:'membership',targetTier:target});
    const config=getPrincessMembershipPreview(account,target);
    assert.ok(config);
    assert.equal(harness.calls.membershipConfig.length,1);
    assert.deepEqual(harness.calls.membershipConfig[0],{accountTier:account,targetTier:target});
    assert.equal(harness.calls.membershipRender.length,1);
    assert.deepEqual(harness.calls.membershipRender[0],config);
    assert.equal(harness.heading.textContent,title);
    assert.equal(harness.eyebrow.textContent,'端内会员开通 · 截图示意');
    assert.equal(harness.sheet.dataset.membershipPreview,variant);
    assert.equal(harness.sheetBody.innerHTML,renderPrincessMembershipPreview(config));
    assert.match(harness.sheetBody.innerHTML,/data-membership-close/);
    assert.doesNotMatch(harness.sheetBody.innerHTML,/data-action="confirm-membership"|<form\b|<iframe\b/);
    assert.equal(harness.layer.hidden,false);
    assert.equal(harness.nav.inert,true);
    assert.equal(harness.scroll.inert,true);
    if(shell){assert.equal(shell.surface.inert,true);assert.equal(shell.modalStates.at(-1),true);}
    assert.equal(harness.focuses.at(-1),'membership-screenshot-close','the screenshot owns its close control and focus target');
    assert.deepEqual(structuredClone(harness.state()),stateBefore);
    assert.equal(harness.scroll.innerHTML,calendarBefore);
    const toastBefore=harness.toast.textContent;
    await harness.click({action:'confirm-membership',targetTier:target});
    assert.equal(harness.toast.textContent,toastBefore,'a stale generic confirmation cannot act within a screenshot-only modal');
    assert.deepEqual(structuredClone(harness.state()),stateBefore);
    assert.equal(harness.sheet.dataset.membershipPreview,variant);
    await harness.click({action:'close',membershipClose:''});
    assert.equal(harness.layer.hidden,true);
    assert.equal(harness.sheet.dataset.membershipPreview,undefined);
    assert.equal(harness.nav.inert,false);
    assert.equal(harness.scroll.inert,false);
    assert.equal(harness.activeElement,button);
    assert.equal(harness.calls.shell.length,suffix?1:0);
    if(shell){assert.equal(shell.surface.inert,false);assert.equal(shell.modalStates.at(-1),false);assert.equal(shell.destroyed,0);}
  }
});

test('screenshot sheet styling uses exact modal-kind matching and cannot leak into unrelated sheets',async()=>{
  const harness=controllerHarness('?tier=vip');
  for(const [kind,expected] of [
    ['membership-screenshot-vip','vip'],['membership-screenshot-svip','svip'],
    ['membership-screenshot-vip-extra',undefined],['membership-screenshot-svip-extra',undefined],
    ['membership-screenshot-__proto__',undefined],['membership',undefined],['ticket',undefined],['widget-setup',undefined],
  ]){
    harness.openSheet(kind);
    assert.equal(harness.sheet.dataset.membershipPreview,expected,`${kind}: only two exact kinds may activate screenshot styling`);
  }
  assert.equal(harness.sheet.dataset.membershipPreview,undefined);
  await harness.click({action:'close'});
  assert.equal(harness.sheet.dataset.membershipPreview,undefined);
  assert.equal(harness.layer.hidden,true);
});

test('closing a membership screenshot restores the exact calendar position, preview, reminder, history and focus without rendering',async()=>{
  for(const [account,target] of [['vip','svip'],['free','vip']])for(const suffix of ['', '&layout=player','&layout=player&hero=full']){
    const harness=controllerHarness(`?tier=${account}&preview=svip&mode=month${suffix}`),shell=harness.calls.shell[0];
    await harness.click({period:'1'});
    await harness.click({date:'2026-12-10'});
    await harness.click({action:'reminder'});
    harness.scroll.scrollTop=487;
    const stateBefore=structuredClone(harness.state()),contentBefore=harness.scroll.innerHTML;
    const ticketBefore=JSON.stringify(harness.actual().ticket),availableBefore=[...harness.actual().availableEpisodes];
    const renderCount=harness.calls.content.length,frameCount=harness.frameWrites;
    const button=await harness.click({action:'membership',targetTier:target});
    assert.equal(harness.scroll.scrollTop,487);
    assert.equal(harness.sheet.scrollTop,0,'only the newly opened sheet scroll position resets');
    assert.equal(harness.calls.content.length,renderCount);
    if(shell)assert.equal(shell.surface.inert,true);
    await harness.click({action:'close',membershipClose:''});
    assert.deepEqual(structuredClone(harness.state()),stateBefore);
    assert.equal(harness.state().mode,'month');
    assert.equal(harness.state().month,'2026-12');
    assert.equal(harness.state().selectedDate,'2026-12-10');
    assert.equal(harness.state().previewTier,'svip');
    assert.equal(harness.state().reminded,true);
    assert.equal(harness.scroll.scrollTop,487);
    assert.equal(harness.scroll.innerHTML,contentBefore);
    assert.equal(JSON.stringify(harness.actual().ticket),ticketBefore);
    assert.deepEqual(harness.actual().availableEpisodes,availableBefore);
    assert.equal(harness.calls.content.length,renderCount);
    assert.equal(harness.frameWrites,frameCount);
    assert.equal(harness.activeElement,button);
    assert.equal(harness.sheet.dataset.membershipPreview,undefined);
    if(shell)assert.equal(shell.surface.inert,false);
    const reopen=await harness.click({action:'membership',targetTier:target});
    if(shell)assert.equal(shell.surface.inert,true);
    let prevented=false;
    harness.documentListeners.get('keydown')({key:'Escape',preventDefault(){prevented=true;}});
    assert.equal(prevented,true);
    assert.equal(harness.layer.hidden,true);
    assert.equal(harness.sheet.dataset.membershipPreview,undefined);
    assert.equal(harness.activeElement,reopen);
    assert.equal(harness.scroll.scrollTop,487);
    assert.equal(harness.calls.content.length,renderCount);
    if(shell){assert.equal(shell.surface.inert,false);assert.equal(shell.destroyed,0);assert.equal(harness.calls.shell.length,1);}
    await harness.click({action:'ticket'});
    assert.equal(harness.sheet.dataset.membershipPreview,undefined,'other sheets cannot inherit screenshot-only styling');
    assert.equal(harness.focuses.at(-1),'sheet-close');
  }
});

test('free accounts in all layouts upgrade directly to the VIP screenshot without changing any selected schedule',async()=>{
  for(const preview of ['free','vip','svip'])for(const suffix of ['', '&layout=player','&layout=player&hero=full']){
    const harness=controllerHarness(`?tier=free${preview==='free'?'':`&preview=${preview}`}${suffix}`);
    const stateBefore=structuredClone(harness.state()),calendarBefore=harness.scroll.innerHTML;
    const raw=model.selectPrincessRefineCalendar(harness.state());
    assert.equal(raw.marketing.kind,preview==='free'?'preview':'membership','the pure model API remains unchanged beneath the synchronized presentation');
    assert.equal(raw.marketing.tier,preview==='free'?'vip':preview);
    const shown=harness.calls.content.at(-1).view;
    assert.equal(shown.marketing.kind,'membership');
    assert.equal(shown.marketing.tier,'vip');
    assert.equal(shown.marketing.cta,'升级VIP');
    assert.match(calendarBefore,/data-action="membership" data-target-tier="vip"/);
    assert.match(calendarBefore,/>升级VIP\s/);
    assert.doesNotMatch(calendarBefore,/data-action="preview-membership"|看VIP排期/);
    assert.equal(harness.calls.membershipConfig.length,0);
    await harness.click({action:'membership'});
    assert.equal(harness.calls.membershipConfig.length,1,'one click chooses the VIP screenshot directly');
    assert.deepEqual(harness.calls.membershipConfig[0],{accountTier:'free',targetTier:'vip'});
    assert.equal(harness.sheet.dataset.membershipPreview,'vip');
    assert.equal(harness.heading.textContent,'VIP开通页');
    assert.equal(harness.state().accountTier,'free');
    assert.equal(harness.state().previewTier,preview);
    assert.deepEqual(harness.actual().availableEpisodes,[]);
    assert.deepEqual(structuredClone(harness.state()),stateBefore);
    assert.equal(harness.scroll.innerHTML,calendarBefore);
    assert.doesNotMatch(harness.sheetBody.innerHTML,/data-action="confirm-membership"/);
  }
});

test('membership screenshot focus wraps between its own close control and keyboard-scrollable image',async()=>{
  for(const [account,target] of [['vip','svip'],['free','vip']])for(const suffix of ['', '&layout=player','&layout=player&hero=full']){
    const harness=controllerHarness(`?tier=${account}${suffix}`);
    await harness.click({action:'membership',targetTier:target});
    assert.equal(harness.activeElement.label,'membership-screenshot-close');
    let reversePrevented=false;
    harness.documentListeners.get('keydown')({key:'Tab',shiftKey:true,preventDefault(){reversePrevented=true;}});
    assert.equal(reversePrevented,true);
    assert.match(harness.focusQueries.at(-1),/\[tabindex="0"\]/);
    assert.equal(harness.activeElement.label,'membership-image-scroll');
    let forwardPrevented=false;
    harness.documentListeners.get('keydown')({key:'Tab',shiftKey:false,preventDefault(){forwardPrevented=true;}});
    assert.equal(forwardPrevented,true);
    assert.equal(harness.activeElement.label,'membership-screenshot-close');
    assert.equal(harness.scroll.inert,true);
    assert.equal(harness.nav.inert,true);
  }
});

test('free→SVIP keeps the identical generic fallback in all layouts because no source screenshot was supplied',async()=>{
    let genericBody;
    for(const suffix of ['', '&layout=player','&layout=player&hero=full']){
      const harness=controllerHarness(`?tier=free&preview=vip${suffix}`),shell=harness.calls.shell[0];
      const stateBefore=structuredClone(harness.state());
      const button=await harness.click({action:'membership',targetTier:'svip'});
      assert.equal(harness.heading.textContent,'开通SVIP');
      assert.equal(harness.eyebrow.textContent,'会员权益 · 入口示意');
      assert.equal(harness.sheet.dataset.membershipPreview,undefined);
      assert.equal(harness.calls.membershipConfig.length,1);
      assert.deepEqual(harness.calls.membershipConfig[0],{accountTier:'free',targetTier:'svip'});
      assert.equal(harness.calls.membershipRender.length,0);
      assert.match(harness.sheetBody.innerHTML,/data-action="confirm-membership"/);
      assert.doesNotMatch(harness.sheetBody.innerHTML,/data-membership-close/);
      assert.equal(harness.focuses.at(-1),'sheet-close');
      if(shell)assert.equal(shell.surface.inert,true);
      if(genericBody===undefined)genericBody=harness.sheetBody.innerHTML;
      else assert.equal(harness.sheetBody.innerHTML,genericBody,'all layouts retain the same fallback rather than inventing a membership screenshot');
      await harness.click({action:'confirm-membership',targetTier:'svip'});
      assert.match(harness.toast.textContent,/不创建订单或改变会员身份/);
      assert.deepEqual(harness.state(),stateBefore);
      if(shell)assert.equal(shell.surface.inert,true);
      await harness.click({action:'close'});
      assert.equal(harness.sheet.dataset.membershipPreview,undefined);
      if(shell)assert.equal(shell.surface.inert,false);
      assert.equal(harness.activeElement,button);
    }
});

test('SVIP has no upgrade action and invalid targets cannot open unauthorized membership modals',async()=>{
  for(const [tier,target] of [['svip','vip'],['svip','svip'],['vip','vip'],['free','__proto__']])for(const suffix of ['', '&layout=player','&layout=player&hero=full']){
    const harness=controllerHarness(`?tier=${tier}${suffix}`);
    await harness.click({action:'membership',targetTier:target});
    assert.equal(harness.layer.hidden,true);
    assert.equal(harness.state().accountTier,tier);
    assert.match(harness.toast.textContent,/没有需要开通/);
    assert.equal(harness.calls.membershipConfig.length,0,'authorization is checked before any screenshot is selected');
    assert.equal(harness.calls.membershipRender.length,0);
    assert.equal(harness.sheet.dataset.membershipPreview,undefined);
  }
});

test('ticket and widget sheets receive the actual account view even when previewing SVIP schedules',async()=>{
  const harness=controllerHarness('?tier=free&preview=svip'),initial=harness.actual();
  await harness.click({action:'ticket'});
  assert.equal(harness.calls.ticket.length,1);
  assert.equal(harness.calls.ticket[0].view.accountTier,'free');
  assert.deepEqual(harness.calls.ticket[0].view.availableEpisodes,[]);
  assert.equal(JSON.stringify(harness.calls.ticket[0].view.ticket),JSON.stringify(initial.ticket));
  assert.match(harness.sheetBody.innerHTML,/SGZ-DEMO-001/);
  let prevented=false;
  harness.documentListeners.get('keydown')({key:'Escape',preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  assert.equal(harness.layer.hidden,true);
  assert.equal(harness.nav.inert,false);
  await harness.click({action:'desktop'});
  assert.equal(harness.calls.widget.at(-1).view.accountTier,'free');
  assert.deepEqual(harness.calls.widget.at(-1).view.availableEpisodes,[]);
  assert.equal(harness.calls.widget.at(-1).options.stage,'setup');
  await harness.click({widgetSize:'square'});
  assert.equal(harness.calls.widget.at(-1).options.size,'square');
  await harness.click({action:'confirm-desktop'});
  assert.equal(harness.calls.widget.at(-1).options.stage,'desktop');
  assert.equal(harness.state().widgetPreviewed,true);
  await harness.click({action:'widget-resume'});
  assert.equal(harness.layer.hidden,true);
  assert.match(harness.toast.textContent,/未连接真实客户端播放/);
  assert.equal(harness.state().accountTier,'free');
  assert.equal(harness.state().previewTier,'svip');
  assert.equal(JSON.stringify(harness.actual().ticket),JSON.stringify(initial.ticket));
});
