import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../dist/skin-preview.js',import.meta.url),'utf8');

function preview(href='https://example.test/?scenario=partial#calendar'){
  let currentUrl=new URL(href);
  const root={dataset:{}};
  const windowListeners=new Map();
  const calls={storage:0,reload:0,navigation:0,pushState:0,replaceState:[]};
  const originalState=Object.freeze({screen:'calendar',marker:'preserve-this-state'});
  const buttons=['classic','lychee'].map(skin=>{
    const listeners=new Map(),attributes=new Map();
    return {
      dataset:{skinChoice:skin},
      setAttribute(name,value){attributes.set(name,String(value));},
      getAttribute(name){return attributes.get(name);},
      addEventListener(name,listener){listeners.set(name,listener);},
      click(){assert.ok(listeners.has('click'));listeners.get('click')();},
    };
  });
  const location={
    get href(){return currentUrl.href;},
    set href(value){calls.navigation++;},
    get search(){return currentUrl.search;},
    set search(value){calls.navigation++;},
    get hash(){return currentUrl.hash;},
    set hash(value){calls.navigation++;},
    reload(){calls.reload++;},
    assign(){calls.navigation++;},
    replace(){calls.navigation++;},
  };
  const history={
    state:originalState,
    replaceState(state,title,url){
      calls.replaceState.push({state,title,url:String(url)});
      this.state=state;
      currentUrl=new URL(String(url),currentUrl);
    },
    pushState(){calls.pushState++;},
  };
  const sandbox={
    URL,URLSearchParams,history,
    document:{
      documentElement:root,
      querySelectorAll(selector){
        assert.equal(selector,'[data-skin-choice]');
        return buttons;
      },
    },
    addEventListener(name,listener){windowListeners.set(name,listener);},
  };
  Object.defineProperty(sandbox,'location',{
    get(){return location;},
    set(value){calls.navigation++;},
  });
  for(const storage of ['localStorage','sessionStorage']){
    Object.defineProperty(sandbox,storage,{
      get(){calls.storage++;throw new Error('Skin changes must not access storage');},
    });
  }
  sandbox.window=sandbox;
  runInNewContext(source,sandbox,{filename:'skin-preview.js',timeout:1000});
  return {
    root,buttons,calls,history,originalState,
    get url(){return new URL(currentUrl);},
    choose(skin){buttons.find(button=>button.dataset.skinChoice===skin).click();},
    popstate(href){
      currentUrl=new URL(href,currentUrl);
      assert.ok(windowListeners.has('popstate'));
      windowListeners.get('popstate')();
    },
  };
}

function assertSelected(app,skin){
  assert.equal(app.root.dataset.calendarSkin,skin);
  for(const button of app.buttons){
    assert.equal(button.getAttribute('aria-pressed'),String(button.dataset.skinChoice===skin));
  }
}

function assertPresentationOnly(app){
  assert.equal(app.calls.storage,0,'must not access localStorage or sessionStorage');
  assert.equal(app.calls.reload,0,'must not reload the page');
  assert.equal(app.calls.navigation,0,'must not navigate through location');
  assert.equal(app.calls.pushState,0,'skin changes must not add history entries');
  assert.strictEqual(app.history.state,app.originalState);
}

test('missing, empty and explicit classic skin initialize the classic design without rewriting the URL',()=>{
  for(const query of ['', '?skin=', '?skin=classic']){
    const app=preview(`https://example.test/${query}#calendar`);
    assertSelected(app,'classic');
    assert.equal(app.calls.replaceState.length,0);
    assertPresentationOnly(app);
  }
});

test('unknown or prototype-like skin values fall back to classic',()=>{
  for(const skin of ['unknown','LYCHEE','__proto__','constructor','null','lychee classic']){
    const app=preview(`https://example.test/?skin=${encodeURIComponent(skin)}#calendar`);
    assertSelected(app,'classic');
    assert.equal(app.calls.replaceState.length,0);
    assertPresentationOnly(app);
  }
});

test('lychee URL initializes the illustrated skin and accessible pressed states',()=>{
  const app=preview('https://example.test/?scenario=partial&skin=lychee#calendar');
  assertSelected(app,'lychee');
  assert.equal(app.url.searchParams.get('scenario'),'partial');
  assert.equal(app.calls.replaceState.length,0);
  assertPresentationOnly(app);
});

test('switching to classic removes only skin while retaining scenario, hash and history.state',()=>{
  const app=preview('https://example.test/demo/?scenario=partial&skin=lychee&campaign=review#calendar');
  app.choose('classic');
  assertSelected(app,'classic');
  assert.equal(app.url.pathname,'/demo/');
  assert.equal(app.url.searchParams.has('skin'),false);
  assert.equal(app.url.searchParams.get('scenario'),'partial');
  assert.equal(app.url.searchParams.get('campaign'),'review');
  assert.equal(app.url.hash,'#calendar');
  assert.equal(app.calls.replaceState.length,1);
  assert.strictEqual(app.calls.replaceState[0].state,app.originalState);
  assert.equal(app.calls.replaceState[0].title,'');
  assertPresentationOnly(app);
});

test('switching to lychee adds the skin parameter without changing the active route or scenario',()=>{
  const app=preview('https://example.test/demo/?scenario=skipped#detail');
  app.choose('lychee');
  assertSelected(app,'lychee');
  assert.equal(app.url.searchParams.get('skin'),'lychee');
  assert.equal(app.url.searchParams.get('scenario'),'skipped');
  assert.equal(app.url.hash,'#detail');
  assert.equal(app.calls.replaceState.length,1);
  assertPresentationOnly(app);
});

test('repeated skin changes never access stored progress, reload, navigate or duplicate skin parameters',()=>{
  const app=preview('https://example.test/?scenario=partial#episodes');
  for(const skin of ['lychee','lychee','classic','lychee','classic']){
    app.choose(skin);
    assertSelected(app,skin);
    assert.deepEqual(app.url.searchParams.getAll('skin'),skin==='lychee'?['lychee']:[]);
    assert.equal(app.url.searchParams.get('scenario'),'partial');
    assert.equal(app.url.hash,'#episodes');
    assertPresentationOnly(app);
  }
  assert.equal(app.calls.replaceState.length,5);
});

test('popstate reapplies the URL skin without replacing history or changing stored state',()=>{
  const app=preview();
  for(const [query,skin] of [['skin=lychee','lychee'],['skin=unknown','classic'],['','classic']]){
    app.popstate(`https://example.test/?scenario=partial&${query}#calendar`);
    assertSelected(app,skin);
    assert.equal(app.calls.replaceState.length,0);
    assertPresentationOnly(app);
  }
});
