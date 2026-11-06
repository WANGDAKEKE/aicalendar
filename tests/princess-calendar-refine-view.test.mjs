import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {princessDrama} from '../dist/princess-calendar-model.mjs';
import {createPrincessRefineSession,selectPrincessRefineCalendar,setPrincessRefinePreview,switchPrincessRefineMode} from '../dist/princess-calendar-refine-model.mjs';
import {renderPrincessRefineContent,renderPrincessRefineReminder} from '../dist/princess-calendar-refine-view.mjs';

const render=session=>renderPrincessRefineContent(selectPrincessRefineCalendar(session),session);
const dayHTML=(html,date)=>html.match(new RegExp(`<button\\b[^>]*data-date="${date}"[^>]*>[\\s\\S]*?<\\/button>`))?.[0];
const section=(html,begin,end)=>html.slice(html.indexOf(begin),html.indexOf(end,html.indexOf(begin)));
const ruleSection=html=>html.match(/<section\b[^>]*class="[^"]*(?:pcr-marketing|pcr-rules)[^"]*"[^>]*>([\s\S]*?)<\/section>/)?.[1];

test('the isolated refinement retains hero, ticket, schedule, widget and membership in order',()=>{
  const html=render(createPrincessRefineSession());
  const positions=['class="pc-hero"','class="pc-ticket"','class="pc-calendar"','class="pc-desktop-entry"','class="pc-marketing'].map(value=>html.indexOf(value));
  assert.ok(positions.every(value=>value>=0));
  for(let index=1;index<positions.length;index++)assert.ok(positions[index]>positions[index-1]);
  assert.match(html,/<h2>尚公主<\/h2>/);
  assert.match(html,/尚公主原版人物海报/);
});

test('operational copy appears once at the bottom for every actual account and preview schedule',()=>{
  for(const tier of ['free','vip','svip'])for(const previewTier of ['free','vip','svip']){
    const session=setPrincessRefinePreview(createPrincessRefineSession({tier}),previewTier),html=render(session);
    const hero=section(html,'class="pc-hero"','class="pc-contents"');
    assert.doesNotMatch(hero,/当前VIP|18[:点]|会员每日|<p(?:\s|>)/);
    const rules=ruleSection(html);
    assert.ok(rules,`${tier}/${previewTier}: the operational rules must remain visible`);
    assert.match(rules,/会员每日18点更新/);
    assert.match(rules,/SVIP抢先看1集/);
    assert.equal((html.match(/会员每日18点更新/g)||[]).length,1);
    assert.equal((html.match(/SVIP抢先看1集/g)||[]).length,1);
    assert.ok(html.indexOf(rules)>html.indexOf('class="pc-desktop-entry"'),'rules are placed after the calendar widget entry');
    assert.doesNotMatch(html,/pc-today-summary|今日\s*18:00|可看至第|今日可看至|已更新\s*25|会员每日18:00更新/);
    assert.doesNotMatch(html,/data-action="today"|回到今天|pcr-calendar-utility|class="pcr-schedule-note"/);
  }
});

test('membership selector is a direct sibling of the calendar title and view switch, without a separate row',()=>{
  for(const mode of ['week','month'])for(const tier of ['vip','svip','free']){
    const session=switchPrincessRefineMode(setPrincessRefinePreview(createPrincessRefineSession(),tier),mode);
    const html=render(session);
    const header=html.match(/<div class="pc-calendar__top">\s*<strong>追剧日历<\/strong>\s*<label class="pcr-tier-select">([\s\S]*?)<\/label>\s*<div class="pc-segment" aria-label="排期视图">([\s\S]*?)<\/div>\s*<\/div>/);
    assert.ok(header,`${mode}/${tier}: title, membership selector and week/month switch must share the same header`);
    assert.match(header[1],/<select aria-label="切换会员排期" data-preview-tier>/);
    assert.equal((header[1].match(/<select\b/g)||[]).length,1);
    assert.match(header[2],/data-mode="week"/);
    assert.match(header[2],/data-mode="month"/);
    assert.doesNotMatch(header[0],/pcr-schedule-note|18:00|免费排期待公布|会员每日18点更新|SVIP抢先看1集/);
    assert.doesNotMatch(html,/pcr-tierbar/);
    assert.equal((html.match(/class="pcr-tier-select"/g)||[]).length,1);
    assert.equal((html.match(/<select\b/g)||[]).length,1);
  }
});

test('the free schedule hint lives in the reserved grid area only when previewing unpublished free releases',()=>{
  for(const account of ['free','vip','svip'])for(const previewTier of ['free','vip','svip']){
    const session=setPrincessRefinePreview(createPrincessRefineSession({tier:account}),previewTier),html=render(session);
    const grid=html.match(/<div class="pcr-schedule-grid"[^>]*>([\s\S]*?)<\/div>\s*(?:<div class="pc-query-activities"|<section class="pc-desktop-entry")/)?.[1];
    assert.ok(grid,'weekly cells have one wrapper for the overlaid unpublished-schedule hint');
    if(previewTier==='free'){
      assert.match(grid,/<p class="pcr-free-schedule-note">免费排期待公布<\/p>/);
      assert.equal((html.match(/免费排期待公布/g)||[]).length,1);
    }else{
      assert.doesNotMatch(html,/pcr-free-schedule-note|免费排期待公布/);
    }
    assert.doesNotMatch(html,/pcr-calendar-utility|class="pcr-schedule-note"|data-action="today"|回到今天/);
  }
});

test('VIP, SVIP and free schedule choices remain accessible and the real selected option is shown',()=>{
  for(const tier of ['vip','svip','free']){
    const session=setPrincessRefinePreview(createPrincessRefineSession(),tier),html=render(session);
    assert.match(html,/<select aria-label="切换会员排期" data-preview-tier>/);
    assert.match(html,new RegExp(`<option value="${tier}" selected>`));
    assert.match(html,/VIP排期/);
    assert.match(html,/SVIP排期/);
    assert.match(html,/非VIP排期/);
    const options=[...html.matchAll(/<option value="([^"]+)"( selected)?>([^<]*)<\/option>/g)];
    assert.deepEqual(options.map(match=>[match[1],match[3]]),[['vip','VIP排期'],['svip','SVIP排期'],['free','非VIP排期']]);
    assert.deepEqual(options.filter(match=>Boolean(match[2])).map(match=>match[1]),[tier]);
  }
});

test('only schedule projection changes for SVIP preview; the visible week keeps original dates and decorations',()=>{
  const session=setPrincessRefinePreview(createPrincessRefineSession(),'svip');
  const html=render(session),today=dayHTML(html,'2026-11-05');
  assert.match(today,/26–27/);
  assert.doesNotMatch(today,/25–26/);
  assert.match(today,/🐟/);
  assert.match(html,/11月2日 — 11月8日/);
  assert.equal((html.match(/data-date=/g)||[]).length,7);
  assert.match(html,/当前为VIP，仅预览SVIP排期，不改变观看权益/);
  assert.match(html,/aria-valuenow="24"/);
});

test('free default calendar is unknown rather than silently filled with VIP episodes',()=>{
  const html=render(createPrincessRefineSession({tier:'free'}));
  assert.match(html,/免费排期待公布/);
  assert.doesNotMatch(dayHTML(html,'2026-11-05'),/25–26|26–27|VIP预览/);
  assert.match(dayHTML(html,'2026-11-05'),/排期待公布/);
  assert.doesNotMatch(dayHTML(html,'2026-11-05'),/🐟/);
  const cells=[...html.matchAll(/<span class="pc-day__episodes">([^<]*)<\/span>/g)];
  assert.equal(cells.length,7);
  assert.ok(cells.every(match=>match[1]==='—'));
  const markers=[...html.matchAll(/<span class="pc-day__marker" aria-hidden="true">([^<]*)<\/span>/g)];
  assert.equal(markers.length,7);
  assert.ok(markers.every(match=>match[1]===''));
  assert.doesNotMatch(html,/会员每日18:00更新|pcr-preview-hint/);
  assert.match(html,/data-action="preview-membership" data-preview-tier="vip"/);
  assert.match(html,/看VIP排期/);
  assert.doesNotMatch(html,/data-action="membership"/);
});

test('free member-preview calendar reveals the chosen schedule and adds the opening membership action',()=>{
  for(const tier of ['vip','svip']){
    const session=setPrincessRefinePreview(createPrincessRefineSession({tier:'free'}),tier),html=render(session);
    assert.match(dayHTML(html,'2026-11-05'),tier==='vip'?/25–26/:/26–27/);
    assert.match(html,new RegExp(`当前为非VIP，仅预览${tier.toUpperCase()}排期，不改变观看权益`));
    assert.match(html,new RegExp(`data-action="membership" data-target-tier="${tier}"`));
    assert.match(html,new RegExp(`开通${tier.toUpperCase()}`));
    assert.doesNotMatch(html,/data-action="preview-membership"/);
    assert.equal(session.accountTier,'free');
    assert.equal(selectPrincessRefineCalendar(session).availableEpisodes.length,0);
  }
});

test('actual SVIP has no placeholder marketing panel or screening event when there is nothing to promote',()=>{
  for(const previewTier of ['free','vip','svip']){
    const session=setPrincessRefinePreview(createPrincessRefineSession({tier:'svip'}),previewTier),html=render(session);
    assert.doesNotMatch(html,/class="pc-marketing|pcr-marketing|点映礼|data-action="event"|升级SVIP|开通VIP|开通SVIP|data-action="membership"|data-action="preview-membership"/);
    assert.match(html,/<section\b[^>]*class="pcr-rules"[^>]*>/);
    const rules=ruleSection(html);
    assert.match(rules,/会员每日18点更新/);
    assert.match(rules,/SVIP抢先看1集/);
    assert.doesNotMatch(rules,/<button\b|升级|开通/);
  }
  const current=render(createPrincessRefineSession({tier:'svip'}));
  assert.doesNotMatch(current,/pcr-preview-hint/);
  assert.match(dayHTML(current,'2026-11-05'),/26–27/);
});

test('all rendered calendars are query-only with no footer reminder, playback, or history actions',()=>{
  for(const tier of ['free','vip','svip']){
    const html=render(createPrincessRefineSession({tier}));
    assert.doesNotMatch(html,/data-play=|pc-continue|继续看第|重看第|pc-tools|点映礼|data-finish/);
    assert.doesNotMatch(html.slice(html.indexOf('class="pc-contents"')),/data-action="reminder"/);
    assert.match(html,/截图排期演示 · 非实时数据 · 以官方实际播出为准/);
  }
});

test('reminder is a compact reusable function with accessible pressed state',()=>{
  const inactive=renderPrincessRefineReminder(),active=renderPrincessRefineReminder(true);
  assert.match(inactive,/class="pcr-reminder" data-action="reminder" aria-pressed="false"/);
  assert.match(inactive,/开启更新提醒/);
  assert.match(inactive,/<span>更新提醒<\/span>/);
  assert.match(active,/aria-pressed="true"/);
  assert.match(active,/<span>已开启提醒<\/span>/);
  assert.equal((active.match(/<button\b/g)||[]).length,1);
});

test('the only reminder is rendered inside the hero and reflects each session on/off state',()=>{
  for(const reminded of [false,true])for(const tier of ['free','vip','svip']){
    const session={...createPrincessRefineSession({tier}),reminded},html=render(session);
    const hero=section(html,'class="pc-hero"','class="pc-contents"');
    assert.equal((html.match(/data-action="reminder"/g)||[]).length,1);
    assert.equal((hero.match(/data-action="reminder"/g)||[]).length,1);
    assert.ok(hero.includes(renderPrincessRefineReminder(reminded)));
    assert.match(hero,new RegExp(`aria-pressed="${reminded}"`));
    assert.match(hero,reminded?/<span>已开启提醒<\/span>/:/<span>更新提醒<\/span>/);
    assert.ok(html.indexOf('data-action="reminder"')<html.indexOf('class="pc-ticket"'));
  }
});

test('known November 3 extra remains separate without adding episode counts',()=>{
  const session={...createPrincessRefineSession(),selectedDate:'2026-11-03'},html=render(session);
  assert.match(html,/class="pc-query-activities"/);
  assert.match(html,/data-action="extra"/);
  assert.match(html,/《沙发多话》上期 · 17:00/);
  assert.match(dayHTML(html,'2026-11-03'),/>23<small>集/);
  assert.doesNotMatch(html,/点映礼/);
});

test('month projection retains all real 42 calendar cells and outside dates stay disabled',()=>{
  const session=switchPrincessRefineMode(createPrincessRefineSession(),'month'),html=render(session);
  assert.match(html,/pc-month-grid/);
  assert.equal((html.match(/data-date=/g)||[]).length,42);
  assert.match(html,/2026年11月/);
  assert.match(dayHTML(html,'2026-10-26'),/disabled/);
  assert.match(dayHTML(html,'2026-11-05'),/25–26/);
});

test('previewing cannot leak projected entitlement into ticket or desktop widget rendering',()=>{
  const actual=createPrincessRefineSession({tier:'free'}),preview=setPrincessRefinePreview(actual,'svip');
  const currentHTML=render(actual),previewHTML=render(preview);
  const ticket=html=>section(html,'class="pc-ticket"','<section class="pc-calendar"');
  const widget=html=>section(html,'<section class="pc-desktop-entry"','</section>');
  assert.equal(ticket(previewHTML),ticket(currentHTML));
  assert.equal(widget(previewHTML),widget(currentHTML));
  assert.equal(preview.completed.size,actual.completed.size);
});

test('titles, labels and copied operational text are escaped before insertion',()=>{
  const session={...createPrincessRefineSession(),selectedDate:'2026-11-03'},view=structuredClone(selectPrincessRefineCalendar(session));
  const unsafe='<img src=x onerror="bad"> & 测试';
  view.ticket.current.name=unsafe;
  view.schedule.rangeLabel=unsafe;
  view.schedule.days.find(day=>day.date===session.selectedDate).activities[0].title=unsafe;
  view.marketing.title=unsafe;view.marketing.subtitle=unsafe;view.marketing.cta=unsafe;
  const html=renderPrincessRefineContent(view,session);
  assert.match(html,/&lt;img src=x onerror=&quot;bad&quot;&gt; &amp; 测试/);
  assert.doesNotMatch(html,/<img src=x|onerror="bad"/);
});

test('all render variants preserve the source account, history, view and source schedule',()=>{
  const config=structuredClone(princessDrama);
  for(const tier of ['free','vip','svip'])for(const previewTier of ['free','vip','svip'])for(const mode of ['week','month']){
    const session=switchPrincessRefineMode(setPrincessRefinePreview(createPrincessRefineSession({tier}),previewTier),mode);
    const view=selectPrincessRefineCalendar(session),before=structuredClone({session,view});
    renderPrincessRefineContent(view,session);renderPrincessRefineReminder(session.reminded);
    assert.deepEqual({session,view},before);
  }
  assert.deepEqual(princessDrama,config);
});

test('the refinement stylesheet is entirely opt-in and preserves a full-height hero and usable controls',()=>{
  const css=readFileSync(new URL('../dist/princess-calendar-refine.css',import.meta.url),'utf8');
  const selectors=css.replace(/\/\*[\s\S]*?\*\//g,'').match(/[^{}]+(?=\{)/g).map(value=>value.trim()).filter(value=>!value.startsWith('@'));
  assert.ok(selectors.length>20);
  assert.ok(selectors.every(selector=>selector.startsWith('.pcr-page')));
  assert.match(css,/\.pcr-page\s*\{\s*--pc-scale:\s*inherit/);
  assert.match(css,/\.pcr-page \.pc-hero\s*\{\s*height:\s*196px/);
  assert.doesNotMatch(css,/pcr-tierbar/);
  assert.doesNotMatch(css,/\.pc-nav[^{}]*\.pcr-reminder/);
  assert.match(css,/@media \(max-width: 350px\)/);
});

test('calendar heading, membership outline and week-month outline share the 30px visual rhythm',()=>{
  const css=readFileSync(new URL('../dist/princess-calendar-refine.css',import.meta.url),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(([,names,body])=>names.split(',').map(name=>({selector:name.trim(),body})));
  const value=(selector,property)=>{
    const declaration=new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`);
    return rules.filter(rule=>selector instanceof RegExp?selector.test(rule.selector):rule.selector===selector).map(rule=>rule.body.match(declaration)?.[1].trim()).filter(Boolean).at(-1);
  };
  const resolve=value=>{
    const variable=value?.match(/^var\((--[\w-]+)\)$/)?.[1];
    return variable?rules.map(rule=>rule.body.match(new RegExp(`(?:^|;)\\s*${variable}\\s*:\\s*([^;]+)`))?.[1].trim()).filter(Boolean).at(-1):value;
  };
  assert.equal(resolve(value('.pcr-page .pc-calendar__top > strong','line-height')),'30px');
  assert.equal(resolve(value('.pcr-page .pcr-tier-select','height')),'30px');
  assert.equal(resolve(value(/\.pc-segment$/,'height')),'30px');
});
