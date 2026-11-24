import test from 'node:test';
import assert from 'node:assert/strict';
import {drama} from '../dist/drama-config.mjs';
import {createCalendarConceptSession,selectCalendarConcept} from '../dist/calendar-concept-model.mjs';
import {CONCEPT_STYLES,escapeHTML,renderConceptContent,renderConceptDay,renderConceptFrame} from '../dist/calendar-concept-view.mjs';

const day=(view,date)=>view.cells.find(cell=>cell.date===date);
const render=(session,configuredDrama=drama)=>renderConceptContent(configuredDrama,selectCalendarConcept(configuredDrama,session),session);

test('concept frames keep one shared calendar, progress and entitlement representation',()=>{
  const session=createCalendarConceptSession();
  const sessionBefore=structuredClone(session),dramaBefore=structuredClone(drama);
  const content=render(session);
  assert.deepEqual(CONCEPT_STYLES.map(style=>style.id),['clean','paper','playful','ip','skin']);
  for(const style of CONCEPT_STYLES){
    const frame=renderConceptFrame(style.id);
    assert.ok(frame.includes(`data-style="${style.id}"`));
    assert.match(frame,/data-theme="light"/);
    assert.match(frame,/class="cc-content"><\/div>/);
    assert.equal(render(session),content);
    assert.equal((content.match(/data-date=/g)||[]).length,35);
    assert.match(content,/当前 VIP/);
    assert.match(content,/aria-label="电子票观看进度"/);
  }
  assert.match(renderConceptFrame('clean','dark'),/data-theme="dark"/);
  assert.match(renderConceptFrame('unrecognized','unknown'),/data-style="clean" data-theme="light"/);
  assert.deepEqual(session,sessionBefore);
  assert.deepEqual(drama,dramaBefore);
});

test('partial viewing keeps the release range and an exact one-of-two watched hint',()=>{
  const session=createCalendarConceptSession(),view=selectCalendarConcept(drama,session);
  const html=renderConceptDay(day(view,'2026-10-14'),view,session);
  assert.match(html,/is-partial/);
  assert.match(html,/class="cc-day__episodes">9–10集<\/span>/);
  assert.match(html,/已看1\/2/);
  assert.match(html,/aria-label="[^"]*部分已看，已看 1\/2 集"/);
  assert.doesNotMatch(html,/is-watched|is-unwatched/);
  assert.equal(view.ticket.currentLevel,0);
  assert.equal(view.ticket.nextProgress.watchedCount,9);
});

test('day cells contain no reward-corner markers or plot-explanation text',()=>{
  const session=createCalendarConceptSession(),view=selectCalendarConcept(drama,session);
  const days=view.cells.map(cell=>renderConceptDay(cell,view,session)).join('');
  assert.doesNotMatch(days,/badge|reward|ticket|勋章|电子票|本集看点|剧情/);
  for(const highlight of drama.calendarHighlights)assert.ok(!days.includes(highlight.title));
  const handshake=renderConceptDay(day(view,'2026-10-16'),view,session);
  assert.match(handshake,/is-emoji" aria-hidden="true">🤝<\/span>/);
  assert.match(renderConceptDay(day(view,'2026-10-24'),view,session),/>点映礼<\/span>/);
  assert.match(renderConceptDay(day(view,'2026-10-27'),view,session),/>完结<\/span>/);
});

test('five- and six-row calendars disable real adjoining-month cells without showing their release contents',()=>{
  for(const [month,rows] of [['2026-10',5],['2026-11',6]]){
    const session={...createCalendarConceptSession(),month};
    const view=selectCalendarConcept(drama,session);
    assert.match(renderConceptContent(drama,view,session),new RegExp(`--cc-rows:${rows}`));
    assert.equal(view.cells.length,rows*7);
    for(const cell of view.cells){
      const html=renderConceptDay(cell,view,session);
      if(cell.outside){
        assert.match(html,/is-outside/);
        assert.match(html,/ disabled>/);
        assert.match(html,/class="cc-day__episodes"><\/span>/);
        assert.match(html,/class="cc-day__hint "\s*><\/span>/);
      }else assert.doesNotMatch(html,/ disabled>/);
    }
  }
});

test('drama content, calendar hints and date attributes are HTML escaped',()=>{
  assert.equal(escapeHTML('&<>"\''),'&amp;&lt;&gt;&quot;&#39;');
  const session=createCalendarConceptSession();
  const configured={...drama,title:'<img src=x onerror="bad"> & 荔枝',tiers:{...drama.tiers,vip:'VIP <unsafe>'}};
  const html=render(session,configured);
  assert.match(html,/<h2>&lt;img src=x onerror=&quot;bad&quot;&gt; &amp; 荔枝<\/h2>/);
  assert.match(html,/当前 VIP &lt;unsafe&gt;/);
  assert.doesNotMatch(html,/<img src=x|<unsafe>/);
  const view=selectCalendarConcept(drama,session);
  const unsafeCell={...day(view,'2026-10-16'),date:'2026-10-16" onclick="bad',hint:'<script>bad</script> &'};
  const dayHTML=renderConceptDay(unsafeCell,view,session);
  assert.match(dayHTML,/data-date="2026-10-16&quot; onclick=&quot;bad"/);
  assert.match(dayHTML,/&lt;script&gt;bad&lt;\/script&gt; &amp;/);
  assert.doesNotMatch(dayHTML,/<script>|data-date="2026-10-16" onclick=/);
});

test('membership preview describes higher-tier availability without upgrading actual playback scope',()=>{
  const session=createCalendarConceptSession();
  session.previewTier='svip';
  const view=selectCalendarConcept(drama,session),html=renderConceptContent(drama,view,session);
  assert.match(html,/当前 VIP/);
  assert.match(html,/<option value="svip" selected>SVIP 排期/);
  assert.match(html,/data-upgrade="svip"/);
  assert.match(html,/升级 SVIP，今天多看 2 集/);
  assert.match(html,/今日可看到第 14 集 · 了解会员权益/);
  assert.equal(view.context.account.available,12);
  assert.equal(view.context.preview.available,14);
  assert.equal(view.availableEpisodes.includes(13),false);
  assert.equal(view.availableEpisodes.includes(14),false);
  assert.equal(session.accountTier,'vip');
  const free=createCalendarConceptSession({tier:'free'});
  free.previewTier='svip';
  assert.match(render(free),/当前 非VIP/);
  assert.match(render(free),/开通 SVIP/);
  assert.equal(selectCalendarConcept(drama,free).availableEpisodes.at(-1),7);
  assert.match(render(createCalendarConceptSession({tier:'svip'})),/查看活动安排与独立参与资格/);
});

test('ticket progress stays at the top and advances only through completed prefix milestones',()=>{
  const session=createCalendarConceptSession();
  session.completed.add(11);
  let html=render(session);
  assert.match(html,/你的第一张电子票/);
  assert.match(html,/看完前 10 集解锁/);
  assert.match(html,/aria-valuemax="10" aria-valuenow="9"/);
  assert.match(html,/style="width:90%"/);
  assert.ok(html.indexOf('class="cc-ticket"')<html.indexOf('class="cc-calendar"'));
  session.completed.add(10);
  html=render(session);
  assert.match(html,/初程票 · 已收好/);
  assert.match(html,/看完前 18 集升级/);
  assert.match(html,/aria-valuemax="18" aria-valuenow="11"/);
  session.completed=new Set(Array.from({length:18},(_,index)=>index+1));
  html=render(session);
  assert.match(html,/同行票 · 已收好/);
  assert.match(html,/看完前 30 集升级/);
  session.completed=new Set(Array.from({length:30},(_,index)=>index+1));
  html=render(session);
  assert.match(html,/典藏票 · 已收好/);
  assert.match(html,/典藏票已解锁，可保存纪念/);
  assert.match(html,/aria-valuemax="30" aria-valuenow="30"/);
  assert.match(html,/style="width:100%"/);
});
