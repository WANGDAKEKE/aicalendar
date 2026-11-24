import test from 'node:test';
import assert from 'node:assert/strict';
import {drama} from '../dist/drama-config.mjs';
import {createCalendarConceptSession,selectCalendarConcept} from '../dist/calendar-concept-model.mjs';
import {CONCEPT_STYLES,renderConceptContent,renderConceptDay,renderConceptFrame} from '../dist/calendar-concept-view.mjs';

const render=(style='ip',session=createCalendarConceptSession(),configuredDrama=drama)=>
  renderConceptContent(configuredDrama,selectCalendarConcept(configuredDrama,session),session,{style});
const calendarBody=html=>html.slice(html.indexOf('<button type="button" class="cc-ticket"'));
const grid=html=>html.match(/<div class="cc-grid">([\s\S]*?)<\/div><\/section>/)?.[1];
const actions=html=>[...html.matchAll(/data-action="([^"]+)"/g)].map(match=>match[1]);

test('the strong-IP direction is additive and preserves all three existing frame identities',()=>{
  assert.deepEqual(CONCEPT_STYLES.slice(0,3).map(style=>style.id),['clean','paper','playful']);
  assert.equal(CONCEPT_STYLES.filter(style=>style.id==='ip').length,1);
  const ip=CONCEPT_STYLES.find(style=>style.id==='ip');
  assert.equal(ip.name,'D · 荔枝赴长安');
  assert.equal(ip.caption,'强 IP 主视觉，纸上长安的月历主体');
  for(const style of ['clean','paper','playful','ip']){
    const frame=renderConceptFrame(style);
    assert.match(frame,new RegExp(`data-style="${style}"`));
    assert.match(frame,/data-theme="light"/);
    assert.match(frame,/class="cc-content"><\/div>/);
    assert.match(frame,/data-action="share"/);
    assert.match(frame,/data-action="close"/);
  }
  assert.match(renderConceptFrame('unrecognized','unknown'),/data-style="clean" data-theme="light"/);
});

test('only the IP direction replaces the compact story with the large poster hero',()=>{
  const html=render();
  assert.match(html,/class="cc-ip-hero"/);
  assert.match(html,/src="\.\/assets\/calendar-art\.png"/);
  assert.match(html,/<h2[^>]*>长安的荔枝<\/h2>/);
  assert.match(html,/当前 VIP/);
  assert.doesNotMatch(html,/class="cc-story"/);
  for(const style of ['clean','paper','playful']){
    const ordinary=render(style);
    assert.match(ordinary,/class="cc-story"/);
    assert.doesNotMatch(ordinary,/class="cc-ip-hero"/);
  }
  const session=createCalendarConceptSession();
  const defaultHTML=renderConceptContent(drama,selectCalendarConcept(drama,session),session);
  assert.equal(defaultHTML,render('clean',session));
});

test('the IP hero leaves ticket, calendar, marketing and reminder markup unchanged',()=>{
  const session=createCalendarConceptSession();
  const before=structuredClone(session),dramaBefore=structuredClone(drama);
  const ip=render('ip',session),paper=render('paper',session);
  assert.notEqual(ip,paper);
  assert.ok(calendarBody(ip).startsWith('<button type="button" class="cc-ticket"'));
  assert.equal(calendarBody(ip),calendarBody(paper));
  assert.ok(grid(ip));
  assert.equal(grid(ip),grid(paper));
  assert.equal((grid(ip).match(/data-date=/g)||[]).length,35);
  assert.ok(ip.indexOf('class="cc-ticket"')<ip.indexOf('class="cc-calendar"'));
  assert.deepEqual(session,before);
  assert.deepEqual(drama,dramaBefore);
});

test('the strong-IP calendar retains exact partial viewing and privacy-safe date hints',()=>{
  const session=createCalendarConceptSession(),view=selectCalendarConcept(drama,session);
  const partial=renderConceptDay(view.cells.find(cell=>cell.date==='2026-10-14'),view,session);
  assert.ok(grid(render('ip',session)).includes(partial));
  assert.match(partial,/is-partial/);
  assert.match(partial,/class="cc-day__episodes">9–10集<\/span>/);
  assert.match(partial,/已看1\/2/);
  assert.match(partial,/部分已看，已看 1\/2 集/);
  assert.equal(view.ticket.nextProgress.watchedCount,9);
  const days=grid(render('ip',session));
  assert.doesNotMatch(days,/badge|reward|ticket|勋章|电子票|本集看点|剧情/);
  for(const highlight of drama.calendarHighlights)assert.ok(!days.includes(highlight.title));
  assert.match(days,/is-emoji" aria-hidden="true">🤝<\/span>/);
  assert.doesNotMatch(render('ip',session),/企鹅|penguin/i);
});

test('the IP hero escapes configured title and membership strings',()=>{
  const configured={...drama,title:'<img src=x onerror="bad"> & 荔枝',tiers:{...drama.tiers,vip:'VIP <unsafe>'}};
  const html=render('ip',createCalendarConceptSession(),configured);
  assert.match(html,/&lt;img src=x onerror=&quot;bad&quot;&gt; &amp; 荔枝/);
  assert.match(html,/当前 VIP &lt;unsafe&gt;/);
  assert.doesNotMatch(html,/<img src=x|<unsafe>/);
});

test('IP SVIP schedule preview never upgrades a VIP account or expands playable episodes',()=>{
  const session=createCalendarConceptSession();
  session.previewTier='svip';
  const view=selectCalendarConcept(drama,session),html=render('ip',session);
  assert.match(html,/当前 VIP/);
  assert.match(html,/<option value="svip" selected>SVIP 排期/);
  assert.match(html,/data-upgrade="svip"/);
  assert.match(html,/升级 SVIP，今天多看 2 集/);
  assert.match(html,/今日可看到第 14 集 · 了解会员权益/);
  assert.equal(calendarBody(html),calendarBody(render('paper',session)));
  assert.equal(view.context.account.available,12);
  assert.equal(view.context.preview.available,14);
  assert.equal(view.availableEpisodes.includes(13),false);
  assert.equal(view.availableEpisodes.includes(14),false);
  assert.equal(session.accountTier,'vip');
});

test('the IP direction keeps the same interactive calendar and reward entry points',()=>{
  const session=createCalendarConceptSession(),html=render('ip',session);
  assert.deepEqual(actions(html),actions(render('paper',session)));
  for(const action of ['ticket','today','reminder'])assert.ok(actions(html).includes(action));
  for(const offset of ['-1','1'])assert.ok(html.includes(`data-month="${offset}"`));
  assert.match(html,/<select aria-label="预览会员排期">/);
  assert.match(html,/data-upgrade="svip"/);
  assert.match(render('ip',createCalendarConceptSession({tier:'svip'})),/data-action="screening"/);
  assert.match(renderConceptFrame('ip'),/data-action="drama"/);
});
