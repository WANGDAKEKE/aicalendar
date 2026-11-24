import { eye, pair, tear, line, C } from './widget-eyes-shapes.mjs';

// These are eye-only assets: blue accents are tears, never cheeks or a face.
// Every drawing stays inside a 160 × 112 viewBox, including falling tears.
const well = (cx, y, width = 25, depth = 6) => `
  <path d="M ${cx - width / 2} ${y} Q ${cx} ${y - depth} ${cx + width / 2} ${y}
    Q ${cx + width / 2 - 2} ${y + depth} ${cx} ${y + depth + 1}
    Q ${cx - width / 2 + 2} ${y + depth} ${cx - width / 2} ${y}Z"
    fill="${C.blue}" fill-opacity=".88"/>
  <path d="M ${cx - width / 2 + 5} ${y + 1} Q ${cx - 3} ${y - 1} ${cx + 2} ${y}"
    fill="none" stroke="${C.white}" stroke-width="1.8" stroke-linecap="round"/>`;

const glimmer = (x, y, radius = 3) => `
  <circle cx="${x}" cy="${y}" r="${radius}" fill="${C.white}"/>
  <circle cx="${x + 5}" cy="${y + 6}" r="1.5" fill="${C.white}"/>`;

export const tearyExpressions = [
  {
    id: '01-holding-tears',
    name: '含泪忍住',
    group: '流泪委屈',
    art: `${pair(
      { px: 2, py: 3, prx: 10, pry: 16, mode: 'sad' },
      { px: -2, py: 3, prx: 10, pry: 16, mode: 'sad' },
    )}${well(53, 72, 26, 4)}${well(107, 68, 26, 4)}
      ${line('M 35 22 Q 45 15 54 20', C.ink, 2.5)}
      ${line('M 108 16 Q 119 10 127 18', C.ink, 2.5)}`,
    hint: '泪水只在眼眶里打转；适合轻度想念、短期未续看。',
  },
  {
    id: '02-one-teardrop',
    name: '单滴眼泪',
    group: '流泪委屈',
    art: `${pair(
      { px: 3, py: 6, mode: 'sad' },
      { px: -1, py: 4 },
    )}${well(53, 73, 23, 3)}${tear(32, 82, { scale: 0.75, angle: 10 })}`,
    hint: '一边忍着、一边掉一滴；适合温和的委屈提醒。',
  },
  {
    id: '03-two-teardrops',
    name: '双滴眼泪',
    group: '流泪委屈',
    art: `${pair(
      { px: 2, py: 6, mode: 'sad', prx: 9, pry: 15 },
      { px: -2, py: 6, mode: 'sad', prx: 9, pry: 15 },
    )}${tear(30, 78, { scale: 0.8, angle: 12 })}
      ${tear(130, 85, { scale: 0.65, angle: -12 })}`,
    hint: '左右各一滴、落点错开，情绪比单滴更明显。',
  },
  {
    id: '04-tear-streams',
    name: '泪流不止',
    group: '流泪委屈',
    art: `${pair(
      { px: 2, py: 2, mode: 'sad', prx: 9, pry: 13 },
      { px: -2, py: 2, mode: 'sad', prx: 9, pry: 13 },
    )}
      <path d="M 37 67 Q 43 64 48 68 L 48 95 Q 48 103 42 103 Q 36 103 36 95Z" fill="${C.blue}"/>
      <path d="M 113 63 Q 119 60 124 64 L 124 95 Q 124 103 118 103 Q 112 103 112 95Z" fill="${C.blue}"/>
      ${line('M 40 76 L 40 94', C.white, 2)}
      ${line('M 116 72 L 116 93', C.white, 2)}`,
    hint: '两道连续泪流；适合明显的夸张撒娇，不用作严肃警告。',
  },
  {
    id: '05-drooping-sad',
    name: '委屈下垂',
    group: '流泪委屈',
    art: `${eye(53, 54, { rx: 19, ry: 29, px: 5, py: 10, mode: 'sad', prx: 8, pry: 13, rot: -8 })}
      ${eye(107, 50, { rx: 19, ry: 29, px: -5, py: 10, mode: 'sad', prx: 8, pry: 13, rot: 8 })}
      ${line('M 33 24 Q 44 18 55 22', C.ink, 3)}
      ${line('M 105 18 Q 116 13 127 21', C.ink, 3)}
      ${well(54, 73, 18, 3)}${well(106, 69, 18, 3)}`,
    hint: '眼尾下垂、瞳孔靠内，轻轻委屈，不需要大颗眼泪。',
  },
  {
    id: '06-puppy-eyes',
    name: '汪汪大眼',
    group: '流泪委屈',
    art: `${pair(
      { px: 2, py: 0, prx: 13, pry: 19 },
      { px: -2, py: 0, prx: 13, pry: 19 },
    )}${glimmer(51, 46, 4.3)}${glimmer(101, 42, 4.3)}
      ${well(53, 72, 27, 5)}${well(107, 68, 27, 5)}`,
    hint: '放大黑瞳与高光，眼眶蓄泪；适合请求“再看一会儿”。',
  },
  {
    id: '07-sobbing-squint',
    name: '哭到眯眼',
    group: '流泪委屈',
    art: `${eye(53, 52, { rx: 20, ry: 28, mode: 'squint', rot: -5 })}
      ${eye(107, 48, { rx: 20, ry: 28, mode: 'squint', rot: 5 })}
      ${tear(31, 73, { scale: 0.85, angle: 18 })}
      ${tear(129, 70, { scale: 0.85, angle: -18 })}
      ${tear(46, 94, { scale: 0.4, angle: 6 })}
      ${tear(115, 93, { scale: 0.4, angle: -6 })}`,
    hint: '眼睛挤成小缝、泪滴错落；适合表情包式的夸张哭哭。',
  },
  {
    id: '08-side-eye-tears',
    name: '泪眼斜看',
    group: '流泪委屈',
    art: `${pair(
      { px: 8, py: 3, prx: 8, pry: 14, mode: 'half' },
      { px: 8, py: 3, prx: 8, pry: 14, mode: 'half' },
      { angle: -4 },
    )}${well(54, 73, 20, 3)}${well(108, 69, 20, 3)}
      ${tear(132, 80, { scale: 0.8, angle: -15 })}`,
    hint: '半眯侧目加一滴泪，委屈里带一点“你自己看着办”。',
  },
];
