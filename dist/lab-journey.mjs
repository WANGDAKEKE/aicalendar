const levels = [
  {level: 1, episode: 10, name: '初程票'},
  {level: 2, episode: 18, name: '同行票'},
  {level: 3, episode: 30, name: '典藏票'},
];

const penguinStates = ['sleep', 'awake', 'proud', 'celebrate'];
const penguinDescriptions = {
  sleep: {alt: '圆胖企鹅侧躺着睡觉', title: '先躺一下，等你开场', speech: '初程票还没亮，鹅先眯一会儿。'},
  awake: {alt: '圆胖企鹅醒来抱着初程纸票', title: '醒了！这张票是咱的', speech: '初程票已收好，下一程一起。'},
  proud: {alt: '圆胖企鹅得意地举起同行金票', title: '第二程，鹅很得意', speech: '同行票已升级，离典藏更近啦。'},
  celebrate: {alt: '圆胖企鹅抱着典藏票开心庆祝', title: '杀青啦，抱紧典藏票', speech: '一起追到了大结局，值得留念。'},
};

const validLevel = progress => Number.isInteger(progress?.currentLevel)
  && progress.currentLevel >= 0 && progress.currentLevel <= 3 ? progress.currentLevel : 0;

// State follows earned ticket levels, never a preview selection, a tap count,
// or the highest episode number. Generated artwork is a prototype proposal.
export function getPenguinState(progress) {
  return penguinStates[validLevel(progress)];
}

export function penguinArt(state = 'sleep', reaction = 'idle') {
  const safeState = penguinStates.includes(state) ? state : 'sleep';
  const safeReaction = ['idle', 'poke', 'unlock'].includes(reaction) ? reaction : 'idle';
  return `<span class="lab-penguin-art" data-penguin-state="${safeState}" data-penguin-reaction="${safeReaction}"><img src="./assets/qq-companion-${safeState}.png" width="256" height="256" alt="${penguinDescriptions[safeState].alt}" draggable="false" decoding="async"><span class="lab-penguin-dream" aria-hidden="true"><i>z</i><i>z</i><i>Z</i></span><span class="lab-penguin-spark lab-penguin-spark--one" aria-hidden="true">✦</span><span class="lab-penguin-spark lab-penguin-spark--two" aria-hidden="true">✧</span></span>`;
}

const lockSVG = '<svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M5.5 7V5a3.5 3.5 0 0 1 7 0v2" stroke="currentColor" stroke-width="1.5"/><rect x="3.5" y="7" width="11" height="8" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M9 10v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
const ticketSVG = '<svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="m5 9 2.7 2.5L13 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const widgetSVG = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6M9 17h4M18 2v8M14 6h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Only presentation lives here: earned levels and missing episodes come from
// the shared progress model. Clicking a node must never grant that level.
export function renderJourney({progress} = {}) {
  const currentLevel = validLevel(progress);
  const state = getPenguinState(progress);
  const character = penguinDescriptions[state];
  const next = progress?.next || (currentLevel < 3 ? levels[currentLevel] : null);
  const targetLevel = next?.level || currentLevel || 1;
  const target = levels.find(level => level.level === targetLevel) || levels[0];

  return `<section class="lab-journey" data-companion-state="${state}" aria-label="追剧搭子和电子票成长进度">
    <button type="button" class="lab-journey__widget" data-lab-widget aria-label="添加到桌面，查看小组件预览" title="添加到桌面">${widgetSVG}</button>
    <div class="lab-journey__scene">
      <button type="button" class="lab-journey__penguin" data-lab-penguin aria-label="和企鹅搭子打个招呼" title="戳戳企鹅，打个招呼">${penguinArt(state)}</button>
      <div class="lab-journey__dialogue"><strong>${character.title}</strong><p class="lab-journey__speech" aria-live="polite">${character.speech}</p><span class="lab-journey__poke-hint" aria-hidden="true">戳戳我，有回应</span></div>
    </div>
    <div class="lab-journey__steps" data-target-level="${target.level}" style="--journey-target:${target.level}">
      <div class="lab-journey__track" aria-hidden="true"><span style="width:${currentLevel / 3 * 100}%"></span></div>
      ${levels.map(level => {
        const earned = level.level <= currentLevel;
        return `<button type="button" class="lab-journey__node${earned ? ' is-earned' : ' is-locked'}${level.level === target.level ? ' is-target' : ''}" data-lab-ticket="${level.level}" aria-label="${level.name}，${earned ? '已获得，查看票面' : `看完前 ${level.episode} 集解锁，查看票面预览`}"><span class="lab-journey__paper" aria-hidden="true">${earned ? ticketSVG : lockSVG}<i></i></span><span class="lab-journey__node-label">${level.name}<small>${level.episode} 集</small></span></button>`;
      }).join('')}
    </div>
  </section>`;
}
