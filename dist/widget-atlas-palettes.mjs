import {FIGMA_COLOR_COLUMNS, FIGMA_COLOR_SOURCE} from './widget-figma-colors.mjs';

export {FIGMA_COLOR_SOURCE};

/**
 * A comparison proposal built from the recorded Figma swatches. These semantic
 * assignments are this demo's proposal, not an official mapping in the source.
 * All returned colors are opaque. Only light-gradient extends the source colors.
 */
export const paletteVariants = Object.freeze([
  Object.freeze({id: 'light-solid', label: '浅色·纯色', appearance: 'light', finish: 'solid'}),
  Object.freeze({id: 'light-gradient', label: '浅色·轻渐变', appearance: 'light', finish: 'gradient'}),
  Object.freeze({id: 'dark-solid', label: '深色·纯色', appearance: 'dark', finish: 'solid'}),
  Object.freeze({id: 'dark-gradient', label: '深色·轻渐变', appearance: 'dark', finish: 'gradient'}),
]);

/** @deprecated Use paletteVariants. This alias contains only the four new IDs. */
export const gradientLevels = paletteVariants;

const moodHues = Object.freeze({ready: 80, evening: 20, waiting: 260, returned: 160, resting: 200});
const variantsById = Object.freeze(Object.fromEntries(paletteVariants.map(variant => [variant.id, variant])));

/** Mix encoded sRGB channels, rounding each channel to its nearest integer. */
function lightExtension(first, second) {
  const channels = [1, 3, 5].map(offset => Math.round(
    Number.parseInt(first.slice(offset, offset + 2), 16) * 0.8
    + Number.parseInt(second.slice(offset, offset + 2), 16) * 0.2,
  ));
  return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/**
 * Unknown moods use ready; unknown variants (including soft/bright/deep) use
 * light-solid. Inputs are never coerced. Calls return independent frozen tokens
 * and independent frozen provenance so a caller cannot affect another card.
 */
export function getStudyPalette(mood, variant = 'light-solid') {
  const moodKey = typeof mood === 'string' && Object.hasOwn(moodHues, mood) ? mood : 'ready';
  const variantKey = typeof variant === 'string' && Object.hasOwn(variantsById, variant) ? variant : 'light-solid';
  const {appearance, finish} = variantsById[variantKey];
  const hue = moodHues[moodKey];
  const swatches = FIGMA_COLOR_COLUMNS[hue];
  const dark = appearance === 'dark';
  const gradient = finish === 'gradient';
  const topRow = dark ? 'C4' : 'C1';
  const inkRow = dark ? 'C1' : 'C5';
  const secondaryRow = dark ? 'C1' : 'C3';
  const derived = !dark && gradient;
  const bottomRow = dark && gradient ? 'C3' : topRow;
  const source = Object.freeze({
    top: `H${hue}/${topRow}`,
    bottom: derived ? '80% C1 + 20% C2（延展）' : `H${hue}/${bottomRow}`,
    ink: `H${hue}/${inkRow}`,
    secondary: `H${hue}/${secondaryRow}`,
  });
  return Object.freeze({
    top: swatches[topRow],
    bottom: derived ? lightExtension(swatches.C1, swatches.C2) : swatches[bottomRow],
    ink: swatches[inkRow],
    secondary: swatches[secondaryRow],
    hue,
    appearance,
    finish,
    variant: variantKey,
    source,
    derived,
    angle: 160,
  });
}
