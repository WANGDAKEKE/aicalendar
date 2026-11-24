import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {paletteVariants, gradientLevels, getStudyPalette, FIGMA_COLOR_SOURCE} from '../dist/widget-atlas-palettes.mjs';
import {FIGMA_COLOR_COLUMNS} from '../dist/widget-figma-colors.mjs';

const moodHues = {ready: 80, evening: 20, waiting: 260, returned: 160, resting: 200};
const csvLines = readFileSync(new URL('../design/widget-figma-color-card.csv', import.meta.url), 'utf8').trim().split(/\r?\n/u);
const [csvHeader, ...csvRows] = csvLines.map(line => line.split(','));
const sourceColumns = Object.fromEntries(csvRows.map(([hue, ...colors]) => [hue, Object.fromEntries(
  csvHeader.slice(1).map((row, index) => [row, colors[index]]),
)]));
const sourceMetadata = JSON.parse(readFileSync(new URL('../design/widget-figma-color-card-source.json', import.meta.url), 'utf8'));

function channels(hex) {
  return hex.slice(1).match(/../gu).map(channel => Number.parseInt(channel, 16));
}

function mix(first, second, weight) {
  const secondChannels = channels(second);
  return `#${channels(first).map((channel, index) => Math.round(
    channel * (1 - weight) + secondChannels[index] * weight,
  ).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function luminance(hex) {
  const linear = channels(hex).map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => a - b);
  return (values[1] + 0.05) / (values[0] + 0.05);
}

test('controlled static source preserves every recorded swatch for the five selected Figma columns', () => {
  assert.deepEqual(Object.keys(FIGMA_COLOR_COLUMNS).map(Number).sort((a, b) => a - b), [20, 80, 160, 200, 260]);
  for (const hue of Object.values(moodHues)) {
    assert.deepEqual(FIGMA_COLOR_COLUMNS[hue], sourceColumns[hue], `H${hue} must match the extraction CSV row by row`);
    assert.ok(Object.isFrozen(FIGMA_COLOR_COLUMNS[hue]));
    for (const value of Object.values(FIGMA_COLOR_COLUMNS[hue])) assert.match(value, /^#[\dA-F]{6}$/u);
  }
  assert.ok(Object.isFrozen(FIGMA_COLOR_COLUMNS));
  assert.equal(FIGMA_COLOR_SOURCE, sourceMetadata.sourceUrl);
  const runtimeSource = readFileSync(new URL('../dist/widget-figma-colors.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(runtimeSource, /(?:from\s*['"](?:node:)?fs|\brequire\s*\(|\bfetch\s*\(|\breadFile(?:Sync)?\s*\()/u);
});

test('the atlas exposes four frozen appearance and finish variants with explicit labels', () => {
  assert.deepEqual(paletteVariants, [
    {id: 'light-solid', label: '浅色·纯色', appearance: 'light', finish: 'solid'},
    {id: 'light-gradient', label: '浅色·轻渐变', appearance: 'light', finish: 'gradient'},
    {id: 'dark-solid', label: '深色·纯色', appearance: 'dark', finish: 'solid'},
    {id: 'dark-gradient', label: '深色·轻渐变', appearance: 'dark', finish: 'gradient'},
  ]);
  assert.equal(gradientLevels, paletteVariants, 'the deprecated export aliases only the new variants');
  assert.ok(Object.isFrozen(paletteVariants));
  assert.ok(paletteVariants.every(Object.isFrozen));
  assert.throws(() => { paletteVariants[0].id = 'changed'; }, TypeError);
  assert.throws(() => { paletteVariants.push({}); }, TypeError);
});

test('all twenty palettes use the proposed source rows and opaque endpoints', () => {
  const signatures = new Set();
  for (const [mood, hue] of Object.entries(moodHues)) {
    const source = sourceColumns[hue];
    for (const {id, appearance, finish} of paletteVariants) {
      const palette = getStudyPalette(mood, id);
      assert.deepEqual(Object.keys(palette).sort(), ['angle', 'appearance', 'bottom', 'derived', 'finish', 'hue', 'ink', 'secondary', 'source', 'top', 'variant']);
      assert.equal(palette.hue, hue);
      assert.equal(palette.variant, id);
      assert.equal(palette.appearance, appearance);
      assert.equal(palette.finish, finish);
      assert.equal(palette.angle, 160);
      for (const field of ['top', 'bottom', 'ink', 'secondary']) assert.match(palette[field], /^#[\dA-F]{6}$/u);
      assert.equal(palette.top, appearance === 'light' ? source.C1 : source.C4);
      assert.equal(palette.ink, appearance === 'light' ? source.C5 : source.C1);
      assert.equal(palette.secondary, appearance === 'light' ? source.C3 : source.C1);
      if (finish === 'solid') {
        assert.equal(palette.top, palette.bottom, `${mood}/${id} is a solid fill`);
      } else {
        assert.notEqual(palette.top, palette.bottom, `${mood}/${id} has two distinct endpoints`);
        assert.equal(palette.bottom, appearance === 'light' ? mix(source.C1, source.C2, 0.2) : source.C3);
      }
      signatures.add(`${palette.top}/${palette.bottom}`);
    }
  }
  assert.equal(signatures.size, 20);
});

test('light gradient extension rounds the 80% C1 + 20% C2 mix in encoded sRGB', () => {
  const expected = {
    ready: '#E4F0CC', evening: '#FADCCF', waiting: '#E2D6FA', returned: '#D0F2E8', resting: '#CFEAF7',
  };
  for (const [mood, hue] of Object.entries(moodHues)) {
    const palette = getStudyPalette(mood, 'light-gradient');
    const source = sourceColumns[hue];
    assert.equal(palette.bottom, mix(source.C1, source.C2, 0.2));
    assert.equal(palette.bottom, expected[mood]);
    assert.equal(palette.derived, true);
  }
});

test('provenance identifies original rows and explicitly labels the derived extension', () => {
  for (const [mood, hue] of Object.entries(moodHues)) {
    for (const {id, appearance, finish} of paletteVariants) {
      const palette = getStudyPalette(mood, id);
      const dark = appearance === 'dark';
      const derived = !dark && finish === 'gradient';
      assert.equal(palette.derived, derived);
      assert.deepEqual(palette.source, {
        top: `H${hue}/${dark ? 'C4' : 'C1'}`,
        bottom: derived ? '80% C1 + 20% C2（延展）' : `H${hue}/${dark && finish === 'gradient' ? 'C3' : dark ? 'C4' : 'C1'}`,
        ink: `H${hue}/${dark ? 'C1' : 'C5'}`,
        secondary: `H${hue}/${dark ? 'C1' : 'C3'}`,
      });
      if (derived) assert.doesNotMatch(palette.source.bottom, /^H\d+\/C\d+$/u);
    }
  }
});

test('primary and secondary text meet 4.5:1 contrast at endpoints and nine interior gradient samples', () => {
  for (const mood of Object.keys(moodHues)) {
    for (const {id} of paletteVariants) {
      const palette = getStudyPalette(mood, id);
      for (let step = 0; step <= 10; step++) {
        const background = mix(palette.top, palette.bottom, step / 10);
        for (const text of ['ink', 'secondary']) {
          const ratio = contrast(background, palette[text]);
          assert.ok(ratio >= 4.5, `${mood}/${id}/${step / 10}/${text}: ${ratio.toFixed(3)}:1`);
        }
      }
    }
  }
});

test('palette calls return independent frozen tokens and provenance', () => {
  for (const mood of Object.keys(moodHues)) {
    for (const {id} of paletteVariants) {
      const first = getStudyPalette(mood, id);
      const second = getStudyPalette(mood, id);
      assert.notEqual(first, second);
      assert.notEqual(first.source, second.source);
      assert.deepEqual(first, second);
      assert.ok(Object.isFrozen(first));
      assert.ok(Object.isFrozen(first.source));
      assert.throws(() => { first.top = '#000000'; }, TypeError);
      assert.throws(() => { first.source.top = 'changed'; }, TypeError);
      assert.deepEqual(getStudyPalette(mood, id), second);
    }
  }
});

test('unsupported parameters and legacy level IDs fall back safely without coercing inputs', () => {
  const hostile = {
    toString() { throw new Error('must not coerce input'); },
    valueOf() { throw new Error('must not coerce input'); },
  };
  const array = ['waiting'];
  const invalid = [undefined, null, '', 'unknown', 'constructor', '__proto__', 'toString', 0, false, NaN, Symbol('mood'), array, hostile];
  for (const mood of invalid) {
    assert.deepEqual(getStudyPalette(mood), getStudyPalette('ready', 'light-solid'));
    assert.deepEqual(getStudyPalette(mood, 'dark-gradient'), getStudyPalette('ready', 'dark-gradient'));
  }
  for (const variant of [...invalid, 'soft', 'bright', 'deep']) {
    assert.deepEqual(getStudyPalette('waiting', variant), getStudyPalette('waiting', 'light-solid'));
  }
  assert.deepEqual(array, ['waiting']);
  assert.equal(Object.isFrozen(hostile), false);
  assert.deepEqual(getStudyPalette(), getStudyPalette('ready', 'light-solid'));
});
