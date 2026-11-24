import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {drama} from '../dist/drama-config.mjs';
import {createCalendarConceptSession,selectCalendarConcept} from '../dist/calendar-concept-model.mjs';
import {escapeHTML,renderConceptContent,renderConceptDay,renderConceptFrame} from '../dist/calendar-concept-view.mjs';

const day=(view,date)=>view.cells.find(cell=>cell.date===date);
const renderDay=(view,session,date)=>renderConceptDay(day(view,date),view,session);
const scope='.cc-app[data-calendar-layout="figma"]';
const layout=await readFile(new URL('../dist/calendar-paper-layout.css',import.meta.url),'utf8');
const uncommented=layout.replace(/\/\*[\s\S]*?\*\//g,'');
const selectors=[...uncommented.matchAll(/([^{}]+)\{/g)]
  .map(match=>match[1].trim()).filter(selector=>!selector.startsWith('@'));
const rule=selector=>[...uncommented.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter(match=>match[1].split(',').some(item=>item.trim()===selector))
  .map(match=>match[2]).join('\n');

test('the member-calendar geometry stylesheet applies only to the explicit shared Figma layout',async()=>{
  assert.ok(selectors.length>0);
  for(const selectorList of selectors){
    for(const selector of selectorList.split(',')){
      assert.ok(selector.includes(scope),selector);
    }
  }
  assert.doesNotMatch(uncommented,/data-calendar-base|data-style=/);
  const html=await readFile(new URL('../dist/calendar-concepts.html',import.meta.url),'utf8');
  assert.match(html,/href="\.\/calendar-paper-layout\.css(?:\?[^"]*)?"/);
  assert.ok(html.indexOf('./calendar-paper-layout.css')>html.indexOf('./calendar-ip.css'));
});

test('only paper and the added skin direction opt into the shared Figma geometry',()=>{
  for(const style of ['clean','paper','playful','ip','skin']){
    const frame=renderConceptFrame(style);
    assert.ok(frame.includes(`data-style="${style}"`),style);
    if(['paper','skin'].includes(style)){
      assert.equal((frame.match(/data-calendar-layout="figma"/g)||[]).length,1,style);
      assert.match(frame,/data-calendar-base="paper"/,style);
    }else{
      assert.doesNotMatch(frame,/data-calendar-layout="figma"/,style);
    }
  }
  assert.doesNotMatch(renderConceptFrame('unknown'),/data-calendar-layout="figma"/);
});

test('paper scales the Figma 40-to-7 square-and-gutter ratio from the inline container width',()=>{
  const content=rule(`${scope} .cc-content`);
  assert.match(content,/padding-left:\s*17px/);
  assert.match(content,/padding-right:\s*17px/);
  assert.match(content,/container-type:\s*inline-size/);
  assert.match(rule(`${scope} .cc-calendar`),/padding:\s*10px/);
  const grid=rule(`${scope} .cc-grid`);
  const inlineGap=/gap:\s*calc\(\(100cqw\s*-\s*20px\)\s*\*\s*7\s*\/\s*322\)/;
  assert.match(grid,/gap:\s*7\.37px/);
  assert.match(grid,inlineGap);
  assert.doesNotMatch(grid,/gap:[^;]*%/);
  assert.match(grid,/grid-auto-rows:\s*auto/);
  const tile=rule(`${scope} .cc-day`);
  assert.match(tile,/aspect-ratio:\s*1\s*\/\s*1/);
  assert.match(tile,/border-radius:\s*2px/);
  assert.match(rule(`${scope} .cc-weekdays`),inlineGap);
  const panelWidth=393-17*2,gridWidth=panelWidth-10*2;
  const gap=gridWidth*7/322,tileWidth=(gridWidth-gap*6)/7;
  assert.equal(panelWidth,359);
  assert.equal(gridWidth,339);
  assert.ok(Math.abs(gap-7.3695652174)<1e-8);
  assert.ok(Math.abs(tileWidth-42.1118012422)<1e-8);
  assert.ok(Math.abs(tileWidth/gap-40/7)<1e-12);
});

test('paper matches the Figma weekday density while preserving its separate month navigation',()=>{
  const month=rule(`${scope} .cc-monthbar`);
  const monthTitle=rule(`${scope} .cc-monthbar h3`);
  const weekdays=rule(`${scope} .cc-weekdays`);
  const date=rule(`${scope} .cc-day__number`);
  assert.match(month,/height:\s*32px/);
  assert.match(monthTitle,/font-size:\s*17px/);
  assert.match(monthTitle,/line-height:\s*24px/);
  assert.match(weekdays,/height:\s*30px/);
  assert.match(weekdays,/font-size:\s*12px/);
  assert.match(weekdays,/line-height:\s*17px/);
  assert.match(date,/font-size:\s*10\.5px/);
  assert.match(date,/line-height:\s*13px/);
  assert.match(date,/top:\s*3px/);
  assert.match(date,/left:\s*3px/);
  // The grid begins after top padding, month navigation and the weekday row.
  assert.equal(10+32+30,72);
});

test('paper hides viewing-status hints without removing accessible viewing progress',()=>{
  const session=createCalendarConceptSession(),view=selectCalendarConcept(drama,session);
  for(const [status,date,description] of [
    ['watched','2026-10-13','已全部看完'],
    ['partial','2026-10-14','部分已看，已看 1/2 集'],
    ['unwatched','2026-10-15','还未观看'],
  ]){
    const hidden=rule(`${scope} .cc-day.is-${status} .cc-day__hint`);
    assert.match(hidden,/display:\s*none\s*[;}]/,status);
    const html=renderDay(view,session,date);
    const label=html.match(/aria-label="([^"]*)"/)?.[1];
    assert.ok(label?.includes(description),`${status}: ${label}`);
    assert.match(html,new RegExp(`class="cc-day is-${status} `));
  }
});

test('paper positions operational emoji in the top-right corner instead of a bottom hint row',()=>{
  const corner=rule(`${scope} .cc-day__hint.is-emoji`);
  assert.match(corner,/top:\s*[0-6]px\s*;/);
  assert.match(corner,/right:\s*[0-6]px\s*;/);
  assert.match(corner,/left:\s*auto\s*;/);
  assert.match(corner,/bottom:\s*auto\s*;/);
  const session=createCalendarConceptSession(),view=selectCalendarConcept(drama,session);
  const html=renderDay(view,session,'2026-10-16');
  assert.match(html,/is-emoji" aria-hidden="true">🤝<\/span>/);
  assert.match(html,/data-compact="🤝"/);
});

test('compact partial progress preserves exact one-of-two wording and accessible information',()=>{
  const session=createCalendarConceptSession(),before=structuredClone(session);
  const view=selectCalendarConcept(drama,session),html=renderDay(view,session,'2026-10-14');
  assert.match(html,/is-partial/);
  assert.match(html,/data-compact="1\/2"/);
  assert.match(html,/class="cc-day__episodes">9–10集<\/span>/);
  assert.match(html,/>已看1\/2<\/span>/);
  assert.match(html,/aria-label="[^"]*部分已看，已看 1\/2 集"/);
  assert.deepEqual(day(view,'2026-10-14').watching.pendingEpisodes,[10]);
  assert.deepEqual(session,before);
});

test('compact partial fractions are calculated for other release batch sizes, not hard-coded halves',()=>{
  const configured={...drama,scheduleByTier:{...drama.scheduleByTier,vip:drama.scheduleByTier.vip.map(release=>
    release.date==='2026-10-14'?{...release,from:9,to:12}:release)}};
  const session={...createCalendarConceptSession(),completed:new Set([9,10,11])};
  const view=selectCalendarConcept(configured,session),html=renderDay(view,session,'2026-10-14');
  assert.match(html,/data-compact="3\/4"/);
  assert.match(html,/class="cc-day__episodes">9–12集<\/span>/);
  assert.match(html,/>已看3\/4<\/span>/);
  assert.match(html,/已看 3\/4 集/);
  assert.doesNotMatch(html,/1\/2/);
});

test('compact watched, pending, event and milestone labels retain their full DOM meanings for every style',()=>{
  const session=createCalendarConceptSession(),view=selectCalendarConcept(drama,session);
  for(const [date,compact,full] of [
    ['2026-10-13','✓','已看'],['2026-10-15','待','待看'],
    ['2026-10-16','🤝','🤝'],['2026-10-24','礼','点映礼'],['2026-10-27','完','完结'],
  ]){
    const html=renderDay(view,session,date);
    assert.ok(html.includes(`data-compact="${compact}"`),date);
    assert.ok(html.includes(`>${full}</span>`),date);
  }
  const beforePremiere=createCalendarConceptSession({now:'2026-10-09T19:00:00+08:00'});
  const premiereView=selectCalendarConcept(drama,beforePremiere);
  assert.match(renderDay(premiereView,beforePremiere,'2026-10-10'),/data-compact="首"[^>]*>开播<\/span>/);
});

test('configured emoji hints are escaped in compact attributes as well as visible text',()=>{
  const unsafeIcon='🤝" data-bad="<script>&';
  const configured={...drama,calendarHighlights:drama.calendarHighlights.map(highlight=>
    highlight.id==='companions'?{...highlight,icon:unsafeIcon}:highlight)};
  const session=createCalendarConceptSession(),view=selectCalendarConcept(configured,session);
  const html=renderDay(view,session,'2026-10-16'),safe=escapeHTML(unsafeIcon);
  assert.ok(html.includes(`data-compact="${safe}"`));
  assert.ok(html.includes(`aria-hidden="true">${safe}</span>`));
  assert.doesNotMatch(html,/<script>|data-compact="🤝" data-bad=/);
});

test('compact hints do not change five- or six-row calendars or expose adjacent-month content',()=>{
  for(const [month,rows] of [['2026-10',5],['2026-11',6]]){
    const session={...createCalendarConceptSession(),month};
    const view=selectCalendarConcept(drama,session);
    assert.equal(view.cells.length,rows*7);
    const html=renderConceptContent(drama,view,session,{style:'paper'});
    assert.equal((html.match(/data-date=/g)||[]).length,rows*7);
    assert.equal((html.match(/data-compact=/g)||[]).length,rows*7);
    assert.match(html,new RegExp(`--cc-rows:${rows}`));
    for(const cell of view.cells.filter(item=>item.outside)){
      const outside=renderConceptDay(cell,view,session);
      assert.match(outside,/ disabled>/);
      assert.match(outside,/data-compact=""/);
      assert.match(outside,/class="cc-day__episodes"><\/span>/);
      assert.match(outside,/class="cc-day__hint "\s*><\/span>/);
    }
  }
});
