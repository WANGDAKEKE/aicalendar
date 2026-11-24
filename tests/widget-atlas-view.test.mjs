import test from 'node:test';
import assert from 'node:assert/strict';
import {progressStudies, timeStudies} from '../dist/widget-atlas-model.mjs';
import {paletteVariants, getStudyPalette} from '../dist/widget-atlas-palettes.mjs';
import {renderAtlasWidget} from '../dist/widget-atlas-view.mjs';

function attribute(html, name) {
  return html.match(new RegExp(`\\b${name}="([^"]*)"`, 'u'))?.[1];
}

const studyCases = [
  ...progressStudies.map(study => ({study, group: 'story'})),
  ...['days', 'minutes', 'away'].flatMap(metric => timeStudies(metric).map(study => ({study, group: 'time'}))),
];

test('all twenty studies preserve the shared square widget shape across four palette variants', () => {
  assert.equal(studyCases.length, 20);
  assert.deepEqual(paletteVariants.map(({id}) => id), ['light-solid', 'light-gradient', 'dark-solid', 'dark-gradient']);
  for (const {study, group} of studyCases) {
    for (const {id: variant} of paletteVariants) {
      const html = renderAtlasWidget(study, {group, variant});
      const palette = getStudyPalette(study.mood, variant);
      assert.match(html, /^<div role="img" class="widget-v4 atlas-widget(?: atlas-widget--time)?"/u);
      assert.equal(attribute(html, 'id'), 'atlas-preview');
      assert.equal(attribute(html, 'data-size'), 'square');
      assert.equal(attribute(html, 'data-mood'), study.mood);
      assert.equal(attribute(html, 'data-study-id'), study.id);
      assert.equal(attribute(html, 'data-group'), group);
      assert.equal(attribute(html, 'data-variant'), variant);
      assert.equal(attribute(html, 'data-appearance'), palette.appearance);
      assert.equal(attribute(html, 'data-finish'), palette.finish);
      assert.equal(attribute(html, 'data-expression'), study.mood === 'ready' ? 'side-eye' : study.mood === 'resting' ? 'soft' : 'default');
      assert.match(html, /src="\.\/assets\/tencent\/tencent-video-official-icon-192\.png"/u);
      assert.match(html, /腾讯视频/u);
      assert.equal((html.match(/class="widget-v4__eye"/gu) || []).length, 2);
      assert.equal((html.match(/<i><\/i>/gu) || []).length, 2);
      assert.match(html, /class="widget-v4__headline" aria-hidden="true"><span>[^<]*<\/span><span>[^<]*<\/span>/u);
      assert.equal(attribute(html, 'style'), `--widget-v4-bg:${palette.top};--widget-v4-ink:${palette.ink};--widget-v4-secondary:${palette.secondary};--atlas-top:${palette.top};--atlas-bottom:${palette.bottom};--atlas-angle:160deg`);
      assert.doesNotMatch(html, /data-level|aria-describedby|aria-labelledby|aria-pressed/u);
    }
  }
});

test('both story sizes keep identical title, copy and complete progress in the same visible slot order', () => {
  for (const study of progressStudies) {
    for (const {id: variant} of paletteVariants) {
      const widgets = ['square', 'wide'].map(size => renderAtlasWidget(study, {variant, size}));
      for (const [index, html] of widgets.entries()) {
        assert.equal(attribute(html, 'data-size'), index === 0 ? 'square' : 'wide');
        assert.ok(html.includes(`class="atlas-title" title="${study.title}" aria-hidden="true">${study.title}</span>`));
        assert.ok(html.includes(`class="widget-v4__context" title="${study.context}">`));
        for (const part of study.context.split(/\s*·\s*/u)) assert.ok(html.includes(`class="atlas-progress-part">${part}</span>`));
        assert.doesNotMatch(html, /class="atlas-metric|atlas-widget--time/u);
        const slots = ['widget-v4__top', 'atlas-title', 'widget-v4__headline', 'widget-v4__eyes', 'widget-v4__footer'].map(name => html.indexOf(`class="${name}"`));
        assert.ok(slots.every((position, slot) => position >= 0 && (slot === 0 || position > slots[slot - 1])));
        const label = attribute(html, 'aria-label');
        for (const copy of [study.title, study.context, ...study.lines]) assert.ok(label.includes(copy));
      }
      assert.equal(widgets[0].replace('data-size="square"', 'data-size="wide"'), widgets[1]);
    }
  }
});

test('long variety titles remain available in full and their progress fields can wrap without losing time', () => {
  const study = {...progressStudies[0], title: '这是一档名字很长的综艺节目第三季', context: '第3期（上） · 已看23:10'};
  for (const size of ['square', 'wide']) {
    const html = renderAtlasWidget(study, {size});
    assert.ok(html.includes(`class="atlas-title" title="${study.title}"`));
    assert.ok(attribute(html, 'aria-label').includes(study.title));
    assert.match(html, /class="atlas-progress-part">第3期（上）<\/span><span class="atlas-progress-separator"> · <\/span><span class="atlas-progress-part">已看23:10<\/span>/u);
    assert.ok(attribute(html, 'aria-label').includes(study.context));
  }
});

test('time widgets show the metric and both copy lines while retaining all context in their label', () => {
  for (const metric of ['days', 'minutes', 'away']) {
    for (const study of timeStudies(metric)) {
      for (const {id: variant} of paletteVariants) {
        for (const size of ['square', 'wide']) {
          const html = renderAtlasWidget({...study, title: '测试剧名'}, {group: 'time', variant, size});
          assert.equal(attribute(html, 'data-size'), size);
          assert.match(html, /class="widget-v4 atlas-widget atlas-widget--time"/u);
          assert.match(html, new RegExp(`class="atlas-metric" aria-hidden="true"><strong>${study.metric.value}<\\/strong><span>${study.metric.unit}<\\/span>`, 'u'));
          assert.match(html, new RegExp(`class="atlas-metric-label" aria-hidden="true">${study.metric.label}<\\/span>`, 'u'));
          assert.doesNotMatch(html, /class="atlas-title|class="widget-v4__footer/u);
          const label = attribute(html, 'aria-label');
          for (const copy of ['测试剧名', study.context, study.metric.label, `${study.metric.value}${study.metric.unit}`, ...study.lines]) assert.ok(label.includes(copy));
        }
      }
    }
  }
});

test('phone resume buttons open a preview without being announced as toggleable color cards', () => {
  for (const size of ['square', 'wide']) {
    const html = renderAtlasWidget(progressStudies[0], {interactive: true, action: 'resume', selected: true, size, variant: 'dark-gradient'});
    assert.match(html, /^<button type="button" class="widget-v4 atlas-widget"/u);
    assert.match(html, /<\/button>$/u);
    assert.equal(attribute(html, 'data-size'), size);
    assert.ok(attribute(html, 'aria-label').endsWith('打开续看预览'));
    assert.doesNotMatch(html, /aria-pressed|role="img"|色卡 H|深色，轻渐变/u);
    for (const copy of [progressStudies[0].title, progressStudies[0].context, ...progressStudies[0].lines]) assert.ok(attribute(html, 'aria-label').includes(copy));
  }
  assert.equal(renderAtlasWidget(progressStudies[0], {action: 'resume'}), renderAtlasWidget(progressStudies[0]));
});

test('interactive cards expose stable identity, selection, appearance, finish, and the Figma hue column', () => {
  for (const {study, group} of studyCases) {
    const labels = new Set();
    for (const {id: variant} of paletteVariants) {
      const palette = getStudyPalette(study.mood, variant);
      const id = `${study.id}-${variant}`;
      const selected = renderAtlasWidget(study, {group, variant, interactive: true, selected: true, id});
      const unselected = renderAtlasWidget(study, {group, variant, interactive: true});
      assert.match(selected, /^<button type="button" aria-pressed="true"/u);
      assert.match(selected, /<\/button>$/u);
      assert.equal(attribute(selected, 'id'), id);
      assert.equal(attribute(selected, 'data-study-id'), study.id);
      assert.equal(attribute(selected, 'data-variant'), variant);
      assert.equal(attribute(selected, 'data-group'), group);
      assert.equal(attribute(unselected, 'aria-pressed'), 'false');
      assert.equal(attribute(unselected, 'data-variant'), variant);
      assert.equal(attribute(unselected, 'data-group'), group);
      assert.doesNotMatch(selected, /data-level|role="img"|aria-describedby|aria-labelledby/u);
      const label = attribute(selected, 'aria-label');
      assert.ok(label.includes(palette.appearance === 'light' ? '浅色' : '深色'));
      assert.ok(label.includes(palette.finish === 'solid' ? '纯色' : '轻渐变'));
      assert.ok(label.includes(`色卡 H${palette.hue}`));
      for (const copy of [study.context, ...study.lines]) assert.ok(label.includes(copy));
      labels.add(label);
    }
    assert.equal(labels.size, 4, 'the same copy can be distinguished by its palette variant');
  }
});

test('all supplied ids and text are escaped in story and time markup', () => {
  const hostile = `<script>&"'`;
  const escaped = '&lt;script&gt;&amp;&quot;&#39;';
  const study = {
    id: hostile, mood: 'ready', title: hostile, context: hostile,
    lines: [hostile, hostile, 'unexpected third line'],
    metric: {value: hostile, unit: hostile, label: hostile},
  };
  for (const group of ['story', 'time']) {
    const html = renderAtlasWidget(study, {group, id: hostile, interactive: true});
    assert.equal(attribute(html, 'id'), escaped);
    assert.equal(attribute(html, 'data-study-id'), escaped);
    assert.ok(attribute(html, 'aria-label').includes(escaped));
    assert.doesNotMatch(html, /<script>|unexpected third line/u);
    assert.ok(html.includes(`>${escaped}</span>`));
    if (group === 'story') assert.equal(attribute(html, 'title'), escaped);
    else assert.ok(html.includes(`<strong>${escaped}</strong>`));
  }
});

test('untrusted moods, variants, groups, and palette metadata cannot enter CSS or attributes', () => {
  const injection = 'waiting" style="background:url(javascript:alert(1))';
  const hostile = {toString() { throw new Error('must not coerce selectors'); }};
  for (const invalid of [injection, '', 'constructor', '__proto__', 0, false, null, undefined, Symbol('invalid'), ['time'], hostile]) {
    const html = renderAtlasWidget({
      ...progressStudies[0], mood: invalid, variant: invalid, appearance: invalid, finish: invalid, hue: invalid,
      source: {top: invalid, bottom: invalid, ink: invalid, secondary: invalid},
      top: invalid, bottom: invalid, ink: invalid, secondary: invalid,
    }, {group: invalid, variant: invalid, size: invalid, action: invalid, appearance: invalid, finish: invalid, source: invalid, interactive: true});
    assert.equal(attribute(html, 'data-mood'), 'ready');
    assert.equal(attribute(html, 'data-variant'), 'light-solid');
    assert.equal(attribute(html, 'data-appearance'), 'light');
    assert.equal(attribute(html, 'data-finish'), 'solid');
    assert.equal(attribute(html, 'data-group'), 'story');
    assert.equal(attribute(html, 'data-size'), 'square');
    assert.equal(attribute(html, 'aria-pressed'), 'false');
    assert.equal(attribute(html, 'style'), attribute(renderAtlasWidget(progressStudies[0]), 'style'));
    assert.ok(attribute(html, 'aria-label').includes(`色卡 H${getStudyPalette('ready').hue}`));
    assert.doesNotMatch(html, /data-level|javascript:|background:url|atlas-widget--time/u);
  }
  assert.equal(renderAtlasWidget(progressStudies[0], {level: 'deep'}), renderAtlasWidget(progressStudies[0]));
});

test('empty and malformed studies render without mutation or missing-reference attributes', () => {
  for (const study of [undefined, null, {}, false, 'not a study', {lines: null}, {lines: ['one'], metric: null}]) {
    assert.doesNotThrow(() => renderAtlasWidget(study));
    const html = renderAtlasWidget(study);
    assert.match(html, /^<div role="img"/u);
    assert.doesNotMatch(html, /undefined|null|aria-describedby|aria-labelledby/u);
  }
  assert.doesNotThrow(() => renderAtlasWidget({}, null));
  const study = Object.freeze({id: 'frozen', mood: 'ready', lines: Object.freeze(['one', 'two'])});
  const options = Object.freeze({group: 'time', variant: 'dark-gradient', interactive: true, selected: false});
  assert.equal(renderAtlasWidget(study, options), renderAtlasWidget(study, options));
  assert.deepEqual(study.lines, ['one', 'two']);
});
