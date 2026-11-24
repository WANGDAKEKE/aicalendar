import {progressStudies,timeStudies} from './widget-atlas-model.mjs';
import {paletteVariants,getStudyPalette,FIGMA_COLOR_SOURCE} from './widget-atlas-palettes.mjs';
import {renderAtlasWidget} from './widget-atlas-view.mjs';
import {renderRefinedHome} from './ios-home-v4.mjs';

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const params = new URLSearchParams(location.search);
const metric = ['days','minutes','away'].includes(params.get('metric')) ? params.get('metric') : 'days';
const studies = {story:progressStudies,time:timeStudies(metric)};
const appearanceMedia = matchMedia('(prefers-color-scheme: dark)');
const explicitAppearance = ['light','dark'].includes(params.get('appearance')) ? params.get('appearance') : null;
let followsSystem = !explicitAppearance;
const initialAppearance = explicitAppearance || (appearanceMedia.matches ? 'dark' : 'light');
const selection = {group:'story',id:progressStudies[2].id,variant:`${initialAppearance}-solid`};

function shortSource(source) {
  return source.replace(/^H\d+\//,'');
}

function renderBoard(group) {
  return paletteVariants.map(variant=>`<section class="atlas-ramp" aria-label="${escapeHTML(variant.label)}">
    <h3 class="atlas-ramp-label">${escapeHTML(variant.label)}<span>${variant.finish==='solid'?'原色基准':'组合提案'}</span></h3>
    <div class="atlas-ramp-grid">${studies[group].map(study=>{
      const colors = getStudyPalette(study.mood,variant.id);
      const hex = colors.finish==='solid' ? colors.top : `${colors.top} → ${colors.bottom}`;
      const source = colors.finish==='solid' ? shortSource(colors.source.top) : `${shortSource(colors.source.top)} → ${shortSource(colors.source.bottom)}`;
      return `<figure class="atlas-study"><div class="atlas-card-frame">${renderAtlasWidget(study,{group,variant:variant.id,id:`${group}-${variant.id}-${study.id}`,interactive:true,selected:selection.group===group&&selection.id===study.id&&selection.variant===variant.id})}</div><figcaption><span class="atlas-card-caption"><span>${escapeHTML(study.eyebrow)}</span><span>H${colors.hue}</span></span><code>${hex}</code><span class="atlas-card-source">${escapeHTML(source)}</span></figcaption></figure>`;
    }).join('')}</div>
  </section>`).join('');
}

document.querySelector('#atlas-device').innerHTML = renderRefinedHome({prefix:'atlas',clock:'19:30',size:'square'});
document.querySelector('#atlas-hint').textContent = '当前选中方案的外观预览；请在右侧色卡中选择。';
document.querySelector('#story-studies').innerHTML = renderBoard('story');
document.querySelector('#time-studies').innerHTML = renderBoard('time');
document.querySelector('#time-direction').textContent = {days:'文案 + 眼神 + 累计观看天数',minutes:'文案 + 眼神 + 今日观看时长',away:'文案 + 眼神 + 距上次观看天数'}[metric];
document.querySelector('#time-note').textContent = {
  days:'口径提案：有有效观看的自然日累计计数，不要求连续，中断不清零；正式统计规则待与研发确认。',
  minutes:'口径提案：今日有效观看时长，不使用 App 前台停留时长；不设时长任务，久看时提醒休息。',
  away:'口径提案：按自然日展示距上次有效观看的天数；今天已观看单独表达，不把回访当作完成观看。',
}[metric];

function updatePreview() {
  const study = studies[selection.group].find(item=>item.id===selection.id);
  if (!study) return;
  const colors = getStudyPalette(study.mood,selection.variant);
  const variant = paletteVariants.find(item=>item.id===selection.variant);
  document.querySelector('#atlas-widgetMount').innerHTML = renderAtlasWidget(study,{group:selection.group,variant:selection.variant,id:'atlas-selected-widget'});
  document.querySelector('#atlas-device .rf-home').dataset.appearance = colors.appearance;
  document.querySelector('#atlas-preview-caption').textContent = `${selection.group==='story'?'剧集进度':'陪伴时间'} · ${study.eyebrow} · ${variant.label}`;
  const backgroundValue = colors.finish==='solid' ? colors.top : `${colors.top} → ${colors.bottom}`;
  const backgroundSource = colors.finish==='solid' ? colors.source.top : `${colors.source.top} → ${colors.source.bottom}`;
  document.querySelector('#atlas-source').innerHTML = `<p class="atlas-source-heading">配色依据 <span>H${colors.hue}</span></p><dl><div><dt>背景</dt><dd><code>${backgroundValue}</code><small>${escapeHTML(backgroundSource)}</small></dd></div><div><dt>主字</dt><dd><code>${colors.ink}</code><small>${escapeHTML(colors.source.ink)}</small></dd></div><div><dt>次字</dt><dd><code>${colors.secondary}</code><small>${escapeHTML(colors.source.secondary)}</small></dd></div></dl><p class="atlas-source-note">浅深角色${colors.finish==='gradient'?'、渐变方式':''}为本次提案，待设计确认。</p><a href="${escapeHTML(FIGMA_COLOR_SOURCE)}" target="_blank" rel="noopener noreferrer">Figma 原色卡 ↗</a>`;
  for (const button of document.querySelectorAll('.atlas-card-frame button')) {
    button.setAttribute('aria-pressed',String(button.dataset.group===selection.group&&button.dataset.studyId===selection.id&&button.dataset.variant===selection.variant));
  }
}

document.querySelector('.atlas-collection').addEventListener('click',event=>{
  const button = event.target.closest('button[data-study-id]');
  if (!button || !studies[button.dataset.group]?.some(study=>study.id===button.dataset.studyId) || !paletteVariants.some(variant=>variant.id===button.dataset.variant)) return;
  selection.group=button.dataset.group;
  selection.id=button.dataset.studyId;
  selection.variant=button.dataset.variant;
  followsSystem=false;
  updatePreview();
});

function fitPreview() {
  const preview = document.querySelector('.atlas-preview');
  const mobile = innerWidth<=560;
  const scale = Math.min(mobile ? .63 : .76,preview.clientWidth/453,Math.max(.32,(innerHeight-(mobile?220:300))/912));
  document.documentElement.style.setProperty('--atlas-phone-scale',String(scale));
  for (const board of document.querySelectorAll('.atlas-board')) {
    const style = getComputedStyle(board);
    const width = board.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
    const columns = width>=660?5:width>=410?3:width>=270?2:1;
    const cardWidth = Math.min(170,(width-14*(columns-1))/columns);
    board.style.setProperty('--atlas-columns',String(columns));
    board.style.setProperty('--atlas-study-scale',String(cardWidth/170));
  }
}

updatePreview();
fitPreview();
window.addEventListener('resize',fitPreview);
appearanceMedia.addEventListener('change',event=>{
  if (!followsSystem) return;
  const finish = getStudyPalette('ready',selection.variant).finish;
  selection.variant=`${event.matches?'dark':'light'}-${finish}`;
  updatePreview();
});
