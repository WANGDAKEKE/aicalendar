import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {zhanshenAnime,animeTicketLevels,createZhanshenSession,selectZhanshenCalendar,shiftZhanshenPeriod,switchZhanshenMode} from '../dist/zhanshen-calendar-model.mjs';
import {renderZhanshenContent,renderZhanshenTicket,renderZhanshenWidgetEntry,renderZhanshenWidgetSetup} from '../dist/zhanshen-calendar-view.mjs';

const render=session=>renderZhanshenContent(selectZhanshenCalendar(session),session);
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const dayHTML=(html,date)=>html.match(new RegExp(`<button\\b[^>]*data-date="${date}"[^>]*>[\\s\\S]*?<\\/button>`))?.[0];
const buttonLabels=html=>[...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(match=>match[1].replace(/<[^>]+>/g,'').trim());

test('anime skin keeps the ordered ticket, query calendar and membership modules',()=>{
  const html=render(createZhanshenSession());
  const positions=['zs-ticket','zs-calendar','zs-marketing'].map(name=>html.search(new RegExp(`class="${name}(?:\\s|\")`)));
  assert.ok(positions.every(position=>position>=0));
  assert.ok(positions[0]<positions[1]&&positions[1]<positions[2]);
  assert.match(html,/aria-label="斩神Ⅱ原运营主视觉"/);
  assert.match(html,/蓝紫色原版人物海报/);
  assert.match(html,/<h2>斩神<span>Ⅱ<\/span><\/h2>/);
  assert.doesNotMatch(html,/尚公主|长安的荔枝|SVIP今日可看/);
});

test('the query calendar and widget preview have no play, continue-watching or history-writing controls',()=>{
  const session=createZhanshenSession(),view=selectZhanshenCalendar(session);
  for(const key of ['availableEpisodes','nextEpisode','upgrade']){
    Object.defineProperty(view,key,{get(){throw new Error(`query surface must not consume ${key}`);}});
  }
  const html=renderZhanshenContent(view,session)+renderZhanshenWidgetSetup()+renderZhanshenWidgetSetup({stage:'desktop'});
  assert.doesNotMatch(html,/data-play=|data-action="(?:play|playback|finish|complete)"|pc-continue/);
  assert.ok(buttonLabels(html).every(label=>!/继续看|立即播放|去观看|模拟看完|重看第/.test(label)));
  assert.match(html,/点一下小组件，体验回到追剧日历/);
});

test('Thursday limited-free information and the December 3 membership relock are both visible',()=>{
  const html=render(createZhanshenSession());
  assert.match(html,/10月29日起，每周四限免更新/);
  assert.match(html,/12月3日 · 第2–15集回锁会员/);
  const today=dayHTML(html,'2026-11-05');
  assert.ok(today);
  assert.match(today,/限免/);
  assert.match(today,/4–6集/);
  assert.match(today,/aria-pressed="true"/);
  assert.match(html,/11月5日 · 限免上新 4–6集/);
  const december=render(createZhanshenSession({today:'2026-12-03'}));
  assert.match(dayHTML(december,'2026-12-03'),/回锁[\s\S]*2–15集/);
  assert.match(december,/12月3日 · 回锁会员 2–15集/);
  assert.match(december,/具体生效时间以实际规则为准/);
});

test('week, November and December render seven, 42 and 35 date cells without fabricated events',()=>{
  const week=createZhanshenSession(),november=switchZhanshenMode(week,'month');
  const december=shiftZhanshenPeriod(november,1);
  assert.equal((render(week).match(/data-date=/g)||[]).length,7);
  assert.equal((render(november).match(/data-date=/g)||[]).length,42);
  assert.equal((render(december).match(/data-date=/g)||[]).length,35);
  assert.match(render(november),/class="zs-month-grid"/);
  assert.match(render(december),/2026年12月/);
  const empty=dayHTML(render(week),'2026-11-06');
  assert.match(empty,/暂无新增限免安排/);
  assert.doesNotMatch(empty,/has-event|限免上新|7–9集/);
  const outside=dayHTML(render(november),'2026-10-29');
  assert.match(outside,/is-outside/);
  assert.match(outside,/disabled/);
});

test('the query surface leaves exact clock times and unspecified member or first-episode rights unknown',()=>{
  const html=render(createZhanshenSession());
  assert.match(html,/具体上线时刻以实际规则为准/);
  assert.match(html,/以实际播出与权益为准/);
  assert.doesNotMatch(html,/\d{1,2}:\d{2}|\d{1,2}点更新|VIP\s*提前|SVIP\s*抢先|首集免费|第1集免费|免费1–6集|限免1–6集/);
  assert.match(html,/了解会员/);
  assert.doesNotMatch(html,/data-tier=|data-account-tier=|data-action="(?:upgrade|activate-vip|payment)"/);
  const selected={...createZhanshenSession(),selectedDate:'2026-11-06'};
  assert.match(render(selected),/11月6日 · 暂无新增限免安排/);
  assert.doesNotMatch(render(selected),/已免费开放.*7–9|今日.*7–9/);
});

test('the desktop entry appears within the calendar before marketing and previews a cross-title component',()=>{
  const html=render(createZhanshenSession());
  const selected=html.indexOf('class="zs-selection"'),entry=html.indexOf('pc-desktop-entry'),marketing=html.indexOf('class="zs-marketing"');
  assert.ok(selected>=0&&selected<entry&&entry<marketing);
  assert.equal((html.match(/data-action="desktop"/g)||[]).length,1);
  assert.match(renderZhanshenWidgetEntry(),/>添加<\/button>/);
  assert.match(renderZhanshenWidgetEntry({previewed:true}),/>查看<\/button>/);
  const setup=renderZhanshenWidgetSetup();
  assert.match(setup,/根据最近观看更新，不限于《斩神Ⅱ》/);
  assert.match(setup,/未接入真实跨剧观看历史/);
  assert.match(setup,/data-widget-size="wide"/);
  assert.match(setup,/data-widget-size="square"/);
  assert.match(renderZhanshenWidgetSetup({stage:'desktop',size:'square'}),/data-size="square"/);
  assert.match(renderZhanshenWidgetSetup({stage:'desktop'}),/本地效果预览，未安装系统组件/);
});

test('only the earned anime ticket can be saved while nine- and 15-episode levels remain locked previews',()=>{
  const view=selectZhanshenCalendar(createZhanshenSession());
  const earned=renderZhanshenTicket(view,1),second=renderZhanshenTicket(view,2),third=renderZhanshenTicket(view,3);
  assert.match(earned,/前3集 · 已解锁/);
  assert.match(earned,/前9集 · 未解锁/);
  assert.match(earned,/前15集 · 未解锁/);
  assert.match(earned,/data-save-ticket="1"/);
  assert.match(earned,/已获得/);
  for(const locked of [second,third]){
    assert.match(locked,/class="zs-ticket-card is-locked"/);
    assert.match(locked,/票面预览/);
    assert.doesNotMatch(locked,/data-save-ticket=|保存电子票/);
  }
  assert.match(second,/看完前9集解锁/);
  assert.match(third,/看完前15集解锁/);
  assert.match(third,/3／9／15集成长门槛为本地提案，非官方奖励规则/);
  assert.match(third,/不代表播放或活动资格/);
  assert.doesNotMatch(earned+second+third,/前30集|前18集/);
  const none=selectZhanshenCalendar({...createZhanshenSession(),completed:new Set()});
  assert.doesNotMatch(renderZhanshenTicket(none),/data-save-ticket=|保存电子票/);
});

test('date labels, calendar date attributes and ticket label input are HTML escaped',()=>{
  const session=createZhanshenSession(),view=structuredClone(selectZhanshenCalendar(session));
  const unsafe='<img src=x onerror="bad"> & 演示';
  view.dateLabel=unsafe;
  view.ticket.current.name=unsafe;
  view.ticket.next.name=unsafe;
  view.days[0].date=unsafe;
  const html=renderZhanshenContent(view,session);
  assert.match(html,/&lt;img src=x onerror=&quot;bad&quot;&gt; &amp; 演示/);
  assert.match(html,/data-date="&lt;img src=x onerror=&quot;bad&quot;&gt; &amp; 演示"/);
  assert.doesNotMatch(html,/<img src=x|onerror="bad"|<script>/);
});

test('the new category comparison pairs query-only drama and anime while the older playback comparison stays explicit',()=>{
  const html=read('../dist/calendar-category-compare.html');
  const sources=[...html.matchAll(/<iframe[^>]*src="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(sources,[
    './princess-calendar.html?presentation=embedded&amp;entry=widget',
    './zhanshen-calendar.html?presentation=embedded',
  ]);
  assert.match(html,/剧集 · 尚公主/);
  assert.match(html,/动漫 · 斩神Ⅱ/);
  assert.doesNotMatch(html,/purpose=playback/);
  const previous=read('../dist/princess-calendar-compare.html');
  const previousSources=[...previous.matchAll(/<iframe[^>]*src="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(previousSources.length,2);
  assert.ok(previousSources.every(source=>source.includes('purpose=playback')));
});

test('anime has its own HTML, stylesheet and controller entry while reusing only the established frame',()=>{
  const html=read('../dist/zhanshen-calendar.html'),controller=read('../dist/zhanshen-calendar.mjs'),css=read('../dist/zhanshen-calendar.css');
  assert.match(html,/zhanshen-calendar\.css/);
  assert.match(html,/type="module"[^>]*src="\.\/zhanshen-calendar\.mjs/);
  assert.match(controller,/renderPrincessFrame/);
  assert.match(css,/assets\/zhanshen\/reference-top\.jpg/);
  assert.doesNotMatch(controller,/completed\.add\(|completed\.delete\(|data-play|case 'play'|case 'finish'/);
  assert.doesNotMatch(html,/calendar-concepts\.mjs|calendar-concept-themes\.css/);
});

test('rendering never mutates date selection, event data, proposed reward thresholds or viewing history',()=>{
  const configBefore=structuredClone(zhanshenAnime),levelsBefore=structuredClone(animeTicketLevels);
  for(const today of ['2026-10-28','2026-11-05','2026-11-26','2026-12-03']){
    for(const mode of ['week','month']){
      const session=createZhanshenSession({today,mode}),view=selectZhanshenCalendar(session);
      const beforeSession=structuredClone(session),beforeView=structuredClone(view);
      renderZhanshenContent(view,session);
      renderZhanshenTicket(view,1);
      renderZhanshenTicket(view,2);
      renderZhanshenTicket(view,3);
      renderZhanshenWidgetEntry({previewed:true});
      renderZhanshenWidgetSetup({stage:'desktop',size:'square'});
      assert.deepEqual(session,beforeSession);
      assert.deepEqual(view,beforeView);
    }
  }
  assert.deepEqual(zhanshenAnime,configBefore);
  assert.deepEqual(animeTicketLevels,levelsBefore);
});
