import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {zhanshenAnime,animeTicketLevels} from '../dist/zhanshen-calendar-model.mjs';
import {createZhanshenRefineSession,selectZhanshenRefineCalendar,setZhanshenRefinePreview,shiftZhanshenRefinePeriod,switchZhanshenRefineMode} from '../dist/zhanshen-calendar-refine-model.mjs';
import {renderZhanshenRefineContent,renderZhanshenRefineReminder} from '../dist/zhanshen-calendar-refine-view.mjs';
import {renderZhanshenWidgetEntry,renderZhanshenTicket} from '../dist/zhanshen-calendar-view.mjs';

const render=session=>renderZhanshenRefineContent(selectZhanshenRefineCalendar(session),session);
const dayHTML=(html,date)=>html.match(new RegExp(`<button\\b[^>]*data-date="${date}"[^>]*>[\\s\\S]*?<\\/button>`))?.[0];
const section=(html,begin,end)=>html.slice(html.indexOf(begin),html.indexOf(end,html.indexOf(begin)));
const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const rules=html=>html.match(/<section\b[^>]*class="[^"]*(?:zsr-marketing|zsr-rules)[^"]*"[^>]*>([\s\S]*?)<\/section>/)?.[1];
const campaignHTML=html=>html.match(/<section class="zs-calendar"[\s\S]*?<section class="pc-desktop-entry"[\s\S]*?<\/section>\s*<\/section>/)?.[0];
const campaignNodes=[
  ['2026-10-29','free',2,3],['2026-11-05','free',4,6],['2026-11-12','free',7,9],
  ['2026-11-19','free',10,12],['2026-11-26','free',13,15],['2026-12-03','relock',2,15],
];

test('the isolated anime refinement keeps original IP artwork and its three product sections in order',()=>{
  const html=render(createZhanshenRefineSession());
  const positions=['class="zs-hero"','class="zs-ticket"','class="zs-calendar"','class="pc-desktop-entry"','class="zs-marketing'].map(text=>html.indexOf(text));
  assert.ok(positions.every(position=>position>=0));
  for(let index=1;index<positions.length;index++)assert.ok(positions[index]>positions[index-1]);
  assert.match(html,/斩神Ⅱ蓝紫色原版人物海报/);
  assert.match(html,/<h2>斩神<span>Ⅱ<\/span><\/h2>/);
  assert.match(html,/<strong>限免日历<\/strong>/);
  assert.doesNotMatch(html,/尚公主|长安的荔枝|凡尘神域 · 每周四/);
});

test('known operations copy is shown once at the bottom for every account and preview combination',()=>{
  for(const account of ['free','vip','svip'])for(const preview of ['free','vip','svip']){
    const session=setZhanshenRefinePreview(createZhanshenRefineSession({tier:account}),preview),html=render(session);
    const footer=rules(html),hero=section(html,'class="zs-hero"','class="zs-contents"');
    const visibleText=html.replace(/<[^>]+>/g,'');
    assert.ok(footer);
    for(const copy of ['每周四限免更新','12月3日第2–15集回锁会员']){
      assert.equal(visibleText.split(copy).length-1,1,'the retained aria-hidden widget thumbnail label is not duplicate visible copy');
      assert.ok(footer.includes(copy));
      assert.ok(!hero.includes(copy));
    }
    assert.ok(html.indexOf(footer)>html.indexOf('class="pc-desktop-entry"'));
    assert.doesNotMatch(html,/zs-selection|class="zs-rule"|zs-tools|回到今天|data-action="today"/);
    assert.doesNotMatch(html,/18[:点]|\d{1,2}:\d{2}|首集免费|第1集免费|SVIP抢先看1集/);
  }
});

test('the static limited-free badge shares the calendar heading row with week-month controls, with no member selector',()=>{
  for(const mode of ['week','month'])for(const preview of ['free','vip','svip']){
    const session=switchZhanshenRefineMode(setZhanshenRefinePreview(createZhanshenRefineSession(),preview),mode),html=render(session);
    const heading=html.match(/<div class="zs-calendar__top">\s*<strong>限免日历<\/strong>\s*<span class="zsr-campaign-badge">限免活动<\/span>\s*<div class="pc-segment" aria-label="排期视图">([\s\S]*?)<\/div>\s*<\/div>/);
    assert.ok(heading);
    assert.match(heading[1],/data-mode="week"/);
    assert.match(heading[1],/data-mode="month"/);
    assert.doesNotMatch(html,/<select\b|<option\b|data-preview-tier|切换会员排期|zsr-tier-select|zsr-tierbar|pcr-tierbar/);
    assert.equal((html.match(/class="zsr-campaign-badge"/g)||[]).length,1);
  }
});

test('the limited-free week shows only its real Thursday batch and original decorative accent',()=>{
  const html=render(createZhanshenRefineSession({tier:'free'}));
  assert.equal((html.match(/data-date=/g)||[]).length,7);
  assert.match(html,/11月2日 — 11月8日/);
  const today=dayHTML(html,'2026-11-05');
  assert.match(today,/限免<\/small><b>4–6集/);
  assert.match(today,/aria-pressed="true"/);
  assert.match(today,/✦/);
  assert.doesNotMatch(today,/7–9集|18:00/);
  assert.doesNotMatch(dayHTML(html,'2026-11-06'),/has-event|<b>|✦/);
  assert.doesNotMatch(html,/zsr-unknown-note|zsr-preview-hint/);
});

test('all real identities and legacy preview values show the same supplied limited-free activity calendar',()=>{
  const baseline=render(createZhanshenRefineSession({tier:'free'}));
  assert.ok(campaignHTML(baseline));
  for(const account of ['free','vip','svip'])for(const preview of ['free','vip','svip']){
    const session=setZhanshenRefinePreview(createZhanshenRefineSession({tier:account}),preview),html=render(session);
    assert.equal(campaignHTML(html),campaignHTML(baseline));
    assert.match(dayHTML(html,'2026-11-05'),/限免<\/small><b>4–6集/);
    assert.doesNotMatch(html,/zsr-unknown-note|zsr-preview-hint|会员排期待公布|仅预览|VIP排期|SVIP排期/);
    const view=selectZhanshenRefineCalendar(session);
    assert.equal(view.accountTier,account);
    assert.deepEqual(view.availableEpisodes,[]);
    assert.deepEqual(view.schedule.events.map(event=>[event.date,event.kind,event.from,event.to]),campaignNodes);
  }
});

test('real account membership CTAs do not follow schedule previews or fabricate a new SVIP upsell',()=>{
  for(const account of ['free','vip','svip'])for(const preview of ['free','vip','svip']){
    const html=render(setZhanshenRefinePreview(createZhanshenRefineSession({tier:account}),preview));
    if(account==='svip'){
      assert.match(html,/<section class="zsr-rules"/);
      assert.doesNotMatch(html,/class="zs-marketing|zsr-marketing|data-action="membership"|升级VIP|升级SVIP/);
      assert.doesNotMatch(rules(html),/<button\b|升级|开通/);
    }else{
      const target=account==='free'?'vip':'svip';
      assert.match(html,new RegExp(`data-action="membership" data-target-tier="${target}"`));
      assert.match(html,new RegExp(`>升级${target.toUpperCase()}\\s`));
      assert.equal((html.match(/data-action="membership"/g)||[]).length,1);
    }
    assert.doesNotMatch(html,/点映礼|data-action="event"|data-action="preview-membership"/);
  }
});

test('changing the schedule projection never changes actual ticket or desktop entry markup',()=>{
  for(const account of ['free','vip','svip']){
    const session=createZhanshenRefineSession({tier:account}),baseline=render(session);
    const ticket=html=>section(html,'class="zs-ticket"','<section class="zs-calendar"');
    for(const preview of ['free','vip','svip']){
      const next=setZhanshenRefinePreview(session,preview),view=selectZhanshenRefineCalendar(next),html=render(next);
      assert.equal(ticket(html),ticket(baseline));
      assert.ok(html.includes(renderZhanshenWidgetEntry({previewed:false})));
      assert.match(html,/aria-valuenow="3"/);
      assert.equal(view.ticket.currentLevel,1);
      assert.equal(view.ticket.next.episode,9);
      assert.match(renderZhanshenTicket(view,1),/data-save-ticket="1"/);
      assert.doesNotMatch(renderZhanshenTicket(view,2),/data-save-ticket=/);
    }
  }
});

test('legacy preview arguments never split the activity schedule by membership or change actual identity',()=>{
  for(const account of ['free','vip','svip'])for(const preview of ['free','vip','svip']){
    const session=setZhanshenRefinePreview(createZhanshenRefineSession({tier:account}),preview),html=render(session);
    assert.doesNotMatch(html,/zsr-preview-hint|仅预览|会员排期待公布|切换会员排期/);
    assert.equal(session.previewTier,'free');
    assert.equal(selectZhanshenRefineCalendar(session).isPreview,false);
    assert.match(dayHTML(html,'2026-11-05'),/4–6集/);
    assert.equal(session.accountTier,account);
  }
});

test('reminder appears only inside the hero and preserves accessible on/off state across all accounts',()=>{
  for(const tier of ['free','vip','svip'])for(const reminded of [false,true]){
    const session={...createZhanshenRefineSession({tier}),reminded},html=render(session);
    const hero=section(html,'class="zs-hero"','class="zs-contents"');
    assert.equal((html.match(/data-action="reminder"/g)||[]).length,1);
    assert.ok(hero.includes(renderZhanshenRefineReminder(reminded)));
    assert.match(hero,new RegExp(`aria-pressed="${reminded}"`));
    assert.match(hero,reminded?/<span>已开启提醒<\/span>/:/<span>更新提醒<\/span>/);
    assert.doesNotMatch(html.slice(html.indexOf('class="zs-contents"')),/data-action="reminder"/);
  }
});

test('week and month queries retain real dates, disabled adjacent dates and the known December relock',()=>{
  const week=createZhanshenRefineSession({tier:'free'}),november=switchZhanshenRefineMode(week,'month'),december=shiftZhanshenRefinePeriod(november,1);
  assert.equal((render(november).match(/data-date=/g)||[]).length,42);
  assert.equal((render(december).match(/data-date=/g)||[]).length,35);
  assert.match(dayHTML(render(november),'2026-10-29'),/disabled/);
  const lock=dayHTML(render(december),'2026-12-03');
  assert.match(lock,/回锁<\/small><b>2–15集/);
  assert.match(lock,/is-relock/);
  assert.doesNotMatch(dayHTML(render(december),'2026-12-04'),/has-event|<b>/);
});

test('all six exact campaign nodes remain visible in week and month across the three real identities',()=>{
  for(const account of ['free','vip','svip'])for(const mode of ['week','month'])for(const [date,kind,from,to] of campaignNodes){
    const session=createZhanshenRefineSession({tier:account,today:date,mode}),html=render(session),cell=dayHTML(html,date);
    assert.ok(cell,`${account}/${mode}/${date}: original activity date must exist`);
    assert.match(cell,new RegExp(`<b>${from}–${to}集<\\/b>`));
    assert.match(cell,kind==='relock'?/回锁/:/限免上新/);
    if(date==='2026-11-26'){
      assert.match(cell,/class="zsr-season-badge">全季免费<\/small>/);
      assert.match(cell,/aria-label="[^"]*全季免费/);
      assert.match(cell,/is-season-free/);
      assert.doesNotMatch(cell,/♛/);
    }else assert.doesNotMatch(cell,/zsr-season-badge|全季免费/);
    if(date==='2026-12-03')assert.doesNotMatch(cell,/SVIP失效|VIP失效|会员失效/);
  }
});

test('query rendering does not consume playable-episode or continuation data',()=>{
  const session=createZhanshenRefineSession({tier:'vip'}),view=selectZhanshenRefineCalendar(session);
  for(const key of ['availableEpisodes','nextEpisode'])Object.defineProperty(view,key,{get(){throw new Error(`must not use ${key}`);}});
  const html=renderZhanshenRefineContent(view,session);
  assert.doesNotMatch(html,/data-play=|data-finish=|data-action="(?:play|finish|complete)"|继续看第|立即播放|去观看/);
});

test('widget previews never claim a successful system installation',()=>{
  const session={...createZhanshenRefineSession(),widgetPreviewed:true},html=render(session);
  assert.match(html,/data-action="desktop"[^>]*>查看<\/button>/);
  assert.doesNotMatch(html,/添加成功|安装成功|已安装|已添加/);
});

test('copied operational text, labels, dates and event ranges are escaped before insertion',()=>{
  const session=createZhanshenRefineSession({tier:'free'}),view=structuredClone(selectZhanshenRefineCalendar(session));
  const unsafe='<img src=x onerror="bad"> & 演示';
  view.schedule.dateLabel=unsafe;view.schedule.days[0].date=unsafe;
  view.ticket.current.name=unsafe;view.ticket.next.name=unsafe;
  view.marketing.title=unsafe;view.marketing.subtitle=unsafe;view.marketing.cta=unsafe;
  view.schedule.days.find(day=>day.event).event.from=unsafe;
  const html=renderZhanshenRefineContent(view,session);
  assert.match(html,/&lt;img src=x onerror=&quot;bad&quot;&gt; &amp; 演示/);
  assert.match(html,/data-date="&lt;img src=x onerror=&quot;bad&quot;&gt; &amp; 演示"/);
  assert.doesNotMatch(html,/<img src=x|onerror="bad"|<script/);
});

test('rendering does not mutate sessions, projections, original artwork data or reward proposals',()=>{
  const config=structuredClone(zhanshenAnime),levels=structuredClone(animeTicketLevels);
  for(const account of ['free','vip','svip'])for(const preview of ['free','vip','svip'])for(const mode of ['week','month']){
    const session=switchZhanshenRefineMode(setZhanshenRefinePreview(createZhanshenRefineSession({tier:account}),preview),mode),view=selectZhanshenRefineCalendar(session);
    const before=structuredClone({session,view});
    renderZhanshenRefineContent(view,session);
    assert.deepEqual({session,view},before);
  }
  assert.deepEqual(zhanshenAnime,config);assert.deepEqual(animeTicketLevels,levels);
});

test('the new stylesheet is fully opt-in and never themes a membership preview sheet',()=>{
  const css=read('dist/zhanshen-calendar-refine.css').replace(/\/\*[\s\S]*?\*\//g,'');
  const selectors=[...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].flatMap(([,names])=>names.split(',').map(name=>name.trim())).filter(name=>!name.startsWith('@'));
  assert.ok(selectors.length>30);
  assert.ok(selectors.every(name=>name.startsWith('.zsr-page')));
  assert.doesNotMatch(css,/\.pc-sheet|\.pmp-|\.pc-layer/);
  assert.match(css,/@media \(max-width: 350px\)/);
  assert.match(css,/safe-area-inset-top/);
});

test('heading, static campaign badge and week-month control align at 30px with generous actual button hit areas',()=>{
  const css=read('dist/zhanshen-calendar-refine.css');
  assert.match(css,/\.zsr-page \.zs-calendar__top > strong[^}]*line-height:\s*30px/);
  assert.match(css,/\.zsr-page \.zsr-campaign-badge\s*\{[^}]*height:\s*30px/);
  assert.match(css,/\.zsr-page \.zs-calendar__top \.pc-segment\s*\{[^}]*height:\s*30px/);
  assert.match(css,/\.zsr-page \.zs-calendar__top \.pc-segment button::before[^}]*inset:\s*-10px 0/);
  assert.doesNotMatch(css,/zsr-tier-select|zsr-unknown-note|zsr-preview-hint/);
});

test('full screen and both player modes preserve 170px, 88px and 170px headers with independent lower scrolling',()=>{
  const css=read('dist/zhanshen-calendar-refine.css');
  assert.match(css,/\.zsr-page \.zs-hero\s*\{\s*height:\s*170px/);
  assert.match(css,/\.zsr-page\.pc-playback-layout \.zs-hero\s*\{\s*height:\s*88px/);
  assert.match(css,/\.zsr-page\.pc-playback-layout\.pc-playback-full-hero \.zs-hero\s*\{\s*height:\s*170px/);
  assert.match(css,/\.zsr-page\.pc-playback-layout \.pc-scroll[^}]*var\(--ply-top\)[^}]*var\(--ply-video-height\)[^}]*var\(--ply-bar-height\)/);
  assert.match(css,/\.zsr-page \.zs-day__event \.zsr-season-badge[^}]*font-size:\s*8px[^}]*white-space:\s*normal/);
  assert.match(css,/\.zsr-page \.zs-month-grid \.zs-day__event \.zsr-season-badge[^}]*font-size:\s*8px/);
});

test('retained anime and princess pages do not opt into the new presentation module or scope',()=>{
  for(const file of ['dist/zhanshen-calendar.html','dist/zhanshen-calendar.mjs','dist/zhanshen-calendar-view.mjs','dist/zhanshen-calendar.css','dist/princess-calendar.html','dist/princess-calendar-refine-view.mjs']){
    assert.doesNotMatch(read(file),/zhanshen-calendar-refine|\bzsr-page\b/,file);
  }
});
