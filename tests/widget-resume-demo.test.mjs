import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RESUME_SCENARIOS,createResumeScenario,selectResumeStudy,advanceResumeDay,simulateResumeWatch} from '../dist/widget-resume-model.mjs';
import {renderAtlasWidget} from '../dist/widget-atlas-view.mjs';
import {paletteVariants} from '../dist/widget-atlas-palettes.mjs';

const escapeHTML = text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

test('every long-video scenario uses identical visible information slots at both sizes and all finishes',()=>{
  for(const scenario of RESUME_SCENARIOS) {
    const study=selectResumeStudy(createResumeScenario(scenario.id));
    for(const variant of paletteVariants) {
      const markup=['square','wide'].map(size=>renderAtlasWidget(study,{size,variant:variant.id}));
      assert.equal(markup[0].replace('data-size="square"','data-size="wide"'),markup[1]);
      for(const html of markup) {
        assert.ok(html.includes(escapeHTML(study.title)));
        for(const line of study.lines) assert.ok(html.includes(escapeHTML(line)));
        assert.ok(html.includes(`title="${escapeHTML(study.context)}"`));
        assert.ok(html.indexOf('widget-v4__brand')<html.indexOf('class="atlas-title"'));
        assert.ok(html.indexOf('class="atlas-title"')<html.indexOf('class="widget-v4__headline"'));
        assert.ok(html.indexOf('class="widget-v4__headline"')<html.indexOf('class="widget-v4__footer"'));
      }
    }
  }
});

test('a viewing simulation and a date-only transition both keep the same size-neutral model',()=>{
  const initial=createResumeScenario('day-7');
  const sameDay=selectResumeStudy(initial);
  assert.deepEqual(selectResumeStudy(initial),sameDay);
  const tomorrow=advanceResumeDay(initial);
  const tomorrowStudy=selectResumeStudy(tomorrow);
  assert.deepEqual(tomorrow.records,initial.records);
  assert.equal(tomorrowStudy.context,sameDay.context);
  assert.notDeepEqual(tomorrowStudy.lines,sameDay.lines);
  const watched=simulateResumeWatch(tomorrow);
  const watchedStudy=selectResumeStudy(watched);
  assert.equal(watchedStudy.state,'returned');
  assert.equal(watchedStudy.progress.positionSeconds,sameDay.progress.positionSeconds+300);
  assert.equal(initial.records.length,1);
});

test('entry page uses the new controller and keeps strategy as a separate linked review document',()=>{
  const html=readFileSync(new URL('../dist/widget-atlas.html',import.meta.url),'utf8');
  const strategy=readFileSync(new URL('../dist/widget-strategy.html',import.meta.url),'utf8');
  const controller=readFileSync(new URL('../dist/widget-resume-demo.mjs',import.meta.url),'utf8');
  assert.match(html,/src="\.\/widget-resume-demo\.mjs/u);
  assert.doesNotMatch(html,/src="\.\/widget-atlas\.mjs/u);
  assert.match(html,/href="\.\/widget-strategy\.html"/u);
  assert.match(strategy,/待评审方案/u);
  assert.match(strategy,/3–6天|3天/u);
  assert.match(strategy,/7天/u);
  assert.match(strategy,/22:00/u);
  assert.match(strategy,/不代表.*零点实时刷新/u);
  assert.match(controller,/simulateResumeWatch\(input,300\)/u);
  assert.match(controller,/if\(input\.id!==study\.scenarioId\)/u);
});
