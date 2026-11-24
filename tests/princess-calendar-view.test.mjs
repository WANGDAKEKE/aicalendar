import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {princessDrama,createPrincessSession,selectPrincessCalendar,switchPrincessMode} from '../dist/princess-calendar-model.mjs';
import {renderPrincessFrame,renderPrincessContent,renderPrincessTicket} from '../dist/princess-calendar-view.mjs';

const render=session=>renderPrincessContent(selectPrincessCalendar(session),session);
const renderPlayback=session=>renderPrincessContent(selectPrincessCalendar(session),session,{queryOnly:false});
const dayHTML=(html,date)=>html.match(new RegExp(`<button\\b[^>]*data-date="${date}"[^>]*>[\\s\\S]*?<\\/button>`))?.[0];

test('the standalone princess page preserves the three product sections in order',()=>{
  const html=render(createPrincessSession());
  const positions=['pc-ticket','pc-calendar','pc-marketing'].map(name=>html.search(new RegExp(`class="${name}(?:\\s|\")`)));
  assert.ok(positions.every(position=>position>=0));
  assert.ok(positions[0]<positions[1]&&positions[1]<positions[2]);
  assert.doesNotMatch(html,/荔枝|长安的荔枝|全\s*33\s*集|11月8日[^<]*完结/);
});

test('the default calendar is a schedule query surface without playback controls',()=>{
  const session=createPrincessSession(),view=selectPrincessCalendar(session);
  Object.defineProperty(view,'availableEpisodes',{get(){throw new Error('query rendering must not calculate continuation');}});
  const html=renderPrincessContent(view,session);
  assert.doesNotMatch(html,/data-play=|pc-continue|继续看第|重看第/);
  assert.match(html,/今日 18:00 已更新 25–26集/);
});

test('the default week has seven dates and the optional November month has all 42 real cells',()=>{
  const week=createPrincessSession(),month=switchPrincessMode(week,'month');
  assert.equal((render(week).match(/data-date=/g)||[]).length,7);
  assert.equal((render(month).match(/data-date=/g)||[]).length,42);
  assert.match(render(week),/11月2日/);
  assert.match(render(week),/11月8日/);
  assert.match(render(month),/2026年11月/);
  assert.ok(dayHTML(render(week),'2026-11-05'));
});

test('VIP dates show the current account schedule rather than a competing higher-tier episode row',()=>{
  const session=createPrincessSession(),html=render(session);
  const today=dayHTML(html,'2026-11-05');
  assert.ok(today);
  assert.match(today,/25[–—\-~～]26/);
  assert.doesNotMatch(today,/26[–—\-~～]27|SVIP/);
  assert.match(html,/升级\s*SVIP/);
  assert.match(html,/27/);
  assert.match(html,/多看\s*1\s*集|多\s*1\s*集/);
  assert.equal(session.accountTier,'vip');
});

test('SVIP dates show only SVIP releases and never promote a lower VIP schedule',()=>{
  const session=createPrincessSession({tier:'svip'}),html=render(session);
  const today=dayHTML(html,'2026-11-05');
  assert.ok(today);
  assert.match(today,/26[–—\-~～]27/);
  assert.doesNotMatch(today,/25[–—\-~～]26|\bVIP\b/);
  assert.doesNotMatch(html,/升级\s*SVIP/);
  assert.equal(selectPrincessCalendar(session).upgrade,null);
});

test('the extra sofa-talk item remains an activity, not an added episode release',()=>{
  const session={...createPrincessSession(),selectedDate:'2026-11-03'},view=selectPrincessCalendar(session);
  const activity=view.days.find(day=>day.date==='2026-11-03');
  const html=renderPrincessContent(view,session),cell=dayHTML(html,activity.date);
  assert.ok(cell);
  assert.match(cell,/23/);
  assert.match(html,/沙发多话/);
  assert.match(html,/class="pc-query-activities"/);
  assert.doesNotMatch(html,/pc-continue|data-play=/);
  assert.deepEqual([activity.release.from,activity.release.to],[23,23]);
  assert.equal(activity.activities[0].kind,'extra');
  assert.deepEqual(view.availableEpisodes,[22,23,24,25,26]);
});

test('rendering never changes the selected mode, time, entitlement, history or screenshot configuration',()=>{
  const sourceBefore=structuredClone(princessDrama);
  for(const tier of ['free','vip','svip']){
    for(const mode of ['week','month']){
      const session=switchPrincessMode(createPrincessSession({tier}),mode),view=selectPrincessCalendar(session);
      const sessionBefore=structuredClone(session),viewBefore=structuredClone(view);
      renderPrincessFrame();
      renderPrincessContent(view,session);
      renderPrincessTicket(view,2);
      renderPrincessTicket(view,3);
      assert.deepEqual(session,sessionBefore);
      assert.deepEqual(view,viewBefore);
    }
  }
  assert.deepEqual(princessDrama,sourceBefore);
});

test('the original princess photograph is a CSS background with a native unchanged title',()=>{
  const frame=renderPrincessFrame();
  const content=render(createPrincessSession());
  const css=readFileSync(new URL('../dist/princess-calendar.css',import.meta.url),'utf8');
  assert.match(content,/<div class="pc-hero__art"/);
  assert.match(content,/<h2[^>]*>尚公主<\/h2>/);
  assert.doesNotMatch(frame+content,/<img[^>]*reference-poster/);
  assert.match(css,/background-image:\s*url\(['"]?\.\/assets\/princess\/reference-poster\.jpg['"]?\)/);
  assert.doesNotMatch(frame,/荔枝|长安的荔枝/);
});

test('the selected activity, range label and ticket labels are escaped in text and attributes',()=>{
  const session={...createPrincessSession(),selectedDate:'2026-11-03'};
  const view=structuredClone(selectPrincessCalendar(session)),unsafe='<img src=x onerror="bad"> & 荔';
  view.rangeLabel=unsafe;
  view.ticket.current.name=unsafe;
  view.ticket.next.name=unsafe;
  const activity=view.days.find(day=>day.date==='2026-11-03').activities[0];
  activity.title=unsafe;
  activity.time='17:00 <script>bad</script>';
  const html=renderPrincessContent(view,session);
  assert.match(html,/&lt;img src=x onerror=&quot;bad&quot;&gt; &amp; 荔/);
  assert.match(html,/17:00 &lt;script&gt;bad&lt;\/script&gt;/);
  assert.doesNotMatch(html,/<img src=x|<script>|onerror="bad"/);
});

test('only earned ticket finishes have save actions and locked higher finishes remain previews',()=>{
  const session=createPrincessSession(),view=selectPrincessCalendar(session);
  assert.equal(view.ticket.currentLevel,2);
  const earned=renderPrincessTicket(view,2),locked=renderPrincessTicket(view,3);
  assert.match(earned,/data-save-ticket="2"/);
  assert.match(earned,/保存电子票/);
  assert.match(earned,/已获得/);
  assert.doesNotMatch(earned,/class="pc-ticket-card is-locked"/);
  assert.match(locked,/class="pc-ticket-card is-locked"/);
  assert.match(locked,/aria-label="未解锁"/);
  assert.match(locked,/票面预览/);
  assert.match(locked,/看完前30集自动解锁/);
  assert.doesNotMatch(locked,/data-save-ticket=|保存电子票/);
  assert.match(renderPrincessTicket(view),/data-save-ticket="2"/);
  assert.equal(view.ticket.currentLevel,2);
});

test('release time and partial history determine the actual continuation rather than a presentation shortcut',()=>{
  const before=createPrincessSession({now:'2026-11-05T17:59:59+08:00'});
  const after=createPrincessSession({now:'2026-11-05T18:00:00+08:00'});
  assert.match(renderPlayback(before),/今日 18:00 更新 25–26集/);
  assert.doesNotMatch(renderPlayback(before),/data-play="25"/);
  assert.match(renderPlayback(after),/今日 18:00 已更新 25–26集/);
  assert.match(renderPlayback(after),/data-play="25"/);
  after.completed.add(25);
  assert.match(renderPlayback(after),/data-play="26"/);
  assert.doesNotMatch(renderPlayback(after),/data-play="25"/);
});

test('the page has its own HTML, script and stylesheet entry without loading the old comparison surface',()=>{
  const html=readFileSync(new URL('../dist/princess-calendar.html',import.meta.url),'utf8');
  assert.match(html,/princess-calendar\.css/);
  assert.match(html,/type="module"[^>]*src="\.\/princess-calendar\.mjs/);
  assert.doesNotMatch(html,/calendar-concepts\.(?:css|mjs)|calendar-concept-themes\.css/);
});

test('the optional widget entry lives inside the query calendar between the daily summary and marketing',()=>{
  const session=createPrincessSession(),view=selectPrincessCalendar(session);
  const original=renderPrincessContent(view,session);
  const variant=renderPrincessContent(view,session,{desktopEntry:true});
  assert.doesNotMatch(original,/pc-desktop-entry/);
  assert.match(original,/添加桌面/);
  assert.match(variant,/把追剧搭子放到桌面/);
  assert.equal((variant.match(/data-action="desktop"/g)||[]).length,1);
  const summary=variant.indexOf('class="pc-today-summary"');
  const entry=variant.indexOf('pc-desktop-entry');
  const marketing=variant.indexOf('class="pc-marketing"');
  assert.ok(summary<entry&&entry<marketing);
  assert.doesNotMatch(variant,/pc-continue|data-play=/);
  assert.doesNotMatch(variant,/添加桌面<\/button>/);
  assert.deepEqual(session,createPrincessSession());
});

test('the independent comparison has an unchanged original and an opt-in widget iframe',()=>{
  const html=readFileSync(new URL('../dist/princess-calendar-compare.html',import.meta.url),'utf8');
  const sources=[...html.matchAll(/<iframe[^>]*src="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(sources,['./princess-calendar.html?presentation=embedded&amp;purpose=playback','./princess-calendar.html?presentation=embedded&amp;entry=widget&amp;purpose=playback']);
  assert.match(html,/原版 · 页尾入口/);
  assert.match(html,/新版 · 小组件入口前置/);
});
