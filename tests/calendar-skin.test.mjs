import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {drama} from '../dist/drama-config.mjs';
import {createCalendarConceptSession,selectCalendarConcept} from '../dist/calendar-concept-model.mjs';
import {CONCEPT_STYLES,renderConceptContent,renderConceptFrame,selectConceptStyles} from '../dist/calendar-concept-view.mjs';

const render=(style='skin',session=createCalendarConceptSession(),configuredDrama=drama)=>
  renderConceptContent(configuredDrama,selectCalendarConcept(configuredDrama,session),session,{style});
const functionalBody=html=>html.slice(html.indexOf('<button type="button" class="cc-ticket"'));

const selectedIds=options=>selectConceptStyles(options).map(style=>style.id);

test('E is an additional skin while the four existing concept identities remain registered',()=>{
  assert.deepEqual(CONCEPT_STYLES.map(style=>style.id),['clean','paper','playful','ip','skin']);
  assert.equal(CONCEPT_STYLES.find(style=>style.id==='skin').name,'E · 长安绮卷');
  for(const id of ['clean','paper','playful','ip','skin']){
    assert.ok(renderConceptFrame(id).includes(`data-style="${id}"`));
  }
  assert.match(renderConceptFrame('unknown'),/data-style="clean"/);
});

test('paper and the new skin share the same Figma calendar geometry without changing other frames',()=>{
  for(const id of ['paper','skin']){
    const html=renderConceptFrame(id);
    assert.match(html,/data-calendar-base="paper"/);
    assert.match(html,/data-calendar-layout="figma"/);
  }
  for(const id of ['clean','playful','ip']){
    assert.doesNotMatch(renderConceptFrame(id),/data-calendar-layout="figma"/);
  }
  assert.match(renderConceptFrame('ip'),/data-calendar-base="paper"/);
});

test('the skin has its own poster hero rather than replacing the existing IP or paper story',()=>{
  const html=render();
  assert.match(html,/class="cc-skin-hero"/);
  assert.match(html,/class="cc-skin-hero__poster"/);
  assert.match(html,/src="\.\/assets\/calendar-art\.png"/);
  assert.match(html,/<h2[^>]*>长安的荔枝<\/h2>/);
  assert.doesNotMatch(html,/class="cc-ip-hero"|class="cc-story"/);
  assert.match(render('paper'),/class="cc-story"/);
  assert.match(render('ip'),/class="cc-ip-hero"/);
});

test('the new skin keeps ticket, date cells, membership marketing and reminder markup identical to paper',()=>{
  for(const month of ['2026-10','2026-11']){
    const session={...createCalendarConceptSession(),month};
    const before=structuredClone(session);
    const skin=render('skin',session),paper=render('paper',session);
    assert.ok(functionalBody(skin).startsWith('<button type="button" class="cc-ticket"'));
    assert.equal(functionalBody(skin),functionalBody(paper));
    assert.equal((skin.match(/data-date=/g)||[]).length,month==='2026-10'?35:42);
    assert.match(skin,/data-action="ticket"/);
    assert.match(skin,/data-action="today"/);
    assert.match(skin,/data-action="reminder"/);
    assert.match(skin,/data-month="-1"/);
    assert.match(skin,/data-month="1"/);
    assert.deepEqual(session,before);
  }
});

test('partial viewing stays recorded per episode and only a completed prefix unlocks the ticket',()=>{
  const session=createCalendarConceptSession();
  let html=render('skin',session);
  assert.match(html,/is-partial[\s\S]*?data-date="2026-10-14"/);
  assert.match(html,/9–10集/);
  assert.match(html,/已看1\/2/);
  assert.match(html,/aria-valuemax="10" aria-valuenow="9"/);
  session.completed.add(11);
  html=render('skin',session);
  assert.match(html,/你的第一张电子票/);
  assert.match(html,/aria-valuemax="10" aria-valuenow="9"/);
  session.completed.add(10);
  html=render('skin',session);
  assert.match(html,/初程票 · 已收好/);
  assert.match(html,/aria-valuemax="18" aria-valuenow="11"/);
});

test('higher-tier skin schedule previews retain actual account identity and playback limits',()=>{
  const session=createCalendarConceptSession();
  session.previewTier='svip';
  const html=render('skin',session),view=selectCalendarConcept(drama,session);
  assert.match(html,/当前 VIP/);
  assert.match(html,/<option value="svip" selected>SVIP 排期/);
  assert.match(html,/data-upgrade="svip"/);
  assert.equal(view.context.account.available,12);
  assert.equal(view.context.preview.available,14);
  assert.equal(view.availableEpisodes.includes(13),false);
  assert.equal(view.availableEpisodes.includes(14),false);
  assert.equal(session.accountTier,'vip');
  const free=createCalendarConceptSession({tier:'free'});
  free.previewTier='svip';
  assert.match(render('skin',free),/当前 非VIP/);
  assert.equal(selectCalendarConcept(drama,free).availableEpisodes.at(-1),7);
});

test('configured text remains HTML-escaped in the skin hero and poster attributes',()=>{
  const configured={...drama,title:'<script>bad</script> " & 荔枝',tiers:{...drama.tiers,vip:'VIP <unsafe>'}};
  const html=render('skin',createCalendarConceptSession(),configured);
  assert.match(html,/&lt;script&gt;bad&lt;\/script&gt; &quot; &amp; 荔枝/);
  assert.match(html,/当前 VIP &lt;unsafe&gt;/);
  assert.doesNotMatch(html,/<script>|<unsafe>/);
});

test('the default gallery stays three directions while single, all and allowlisted comparison links work',()=>{
  assert.deepEqual(selectedIds(),['clean','paper','ip']);
  assert.deepEqual(selectedIds({style:'skin'}),['skin']);
  assert.deepEqual(selectedIds({all:'1'}),['clean','paper','playful','ip','skin']);
  assert.deepEqual(selectedIds({compare:'paper,skin'}),['paper','skin']);
  assert.deepEqual(selectedIds({compare:' paper , skin ,paper,not-a-style'}),['paper','skin']);
  assert.deepEqual(selectedIds({compare:'paper,paper'}),['clean','paper','ip']);
  assert.deepEqual(selectedIds({compare:'not-a-style,skin'}),['clean','paper','ip']);
  assert.deepEqual(selectedIds({compare:'not-a-style'}),['clean','paper','ip']);
  assert.deepEqual(selectedIds({style:'skin',compare:'paper,skin',all:'1'}),['skin']);
  assert.deepEqual(selectedIds({compare:'skin,paper,ip'}),['skin','paper','ip']);
  assert.deepEqual(selectedIds({compare:'paper,skin',all:'1'}),['paper','skin']);
  assert.deepEqual(selectedIds({compare:'paper,paper',all:'1'}),['clean','paper','playful','ip','skin']);
  assert.deepEqual(selectedIds({style:'unknown',all:'1'}),['clean','paper','playful','ip','skin']);
});

test('the new isolated skin stylesheet loads last, after the shared paper layout',()=>{
  const html=readFileSync(new URL('../dist/calendar-concepts.html',import.meta.url),'utf8');
  const sheets=[...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(match=>match[1]);
  assert.match(sheets.at(-1),/calendar-skin-concept\.css/);
  const paperIndex=sheets.findIndex(path=>path.includes('calendar-paper-layout.css'));
  assert.ok(paperIndex>=0&&paperIndex<sheets.length-1);
});
