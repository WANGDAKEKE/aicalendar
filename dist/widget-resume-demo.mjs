import {timeStudies} from './widget-atlas-model.mjs';
import {paletteVariants,getStudyPalette,FIGMA_COLOR_SOURCE} from './widget-atlas-palettes.mjs';
import {renderAtlasWidget} from './widget-atlas-view.mjs';
import {renderRefinedHome} from './ios-home-v4.mjs';
import {RESUME_SCENARIOS,createResumeScenario,selectResumeStudy,advanceResumeDay,simulateResumeWatch} from './widget-resume-model.mjs';

const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const params = new URLSearchParams(location.search);
const metric = ['days','minutes','away'].includes(params.get('metric')) ? params.get('metric') : 'days';
const storyCases = ['drama','evening','day-3','switch-variety','caught-up'];
const studies = {
  story:storyCases.map(scenarioId=>({...selectResumeStudy(createResumeScenario(scenarioId)),id:`story-${scenarioId}`,scenarioId})),
  time:timeStudies(metric),
};
const requestedScenario = RESUME_SCENARIOS.some(item=>item.id===params.get('scene')) ? params.get('scene') : 'switch-variety';
let input = createResumeScenario(requestedScenario);
let phoneSize = params.get('size')==='wide' ? 'wide' : 'square';
const appearanceMedia = matchMedia('(prefers-color-scheme: dark)');
const explicitAppearance = ['light','dark'].includes(params.get('appearance')) ? params.get('appearance') : null;
let followsSystem = !explicitAppearance;
const initialAppearance = explicitAppearance || (appearanceMedia.matches ? 'dark' : 'light');
const selection = {group:'story',id:studies.story.find(item=>item.scenarioId===input.id)?.id ?? null,variant:`${initialAppearance}-gradient`};
let currentStudy;

const shortSource = source => source.replace(/^H\d+\//,'');
const clock = () => new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(input.now));
const date = () => new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric'}).format(new Date(input.now));

function renderBoard(group) {
  return paletteVariants.map(variant=>`<section class="atlas-ramp" aria-label="${escapeHTML(variant.label)}">
    <h3 class="atlas-ramp-label">${escapeHTML(variant.label)}<span>${variant.finish==='solid'?'原色基准':'组合提案'}</span></h3>
    <div class="atlas-ramp-grid">${studies[group].map(study=>{
      const colors = getStudyPalette(study.mood,variant.id);
      const hex = colors.finish==='solid' ? colors.top : `${colors.top} → ${colors.bottom}`;
      const source = colors.finish==='solid' ? shortSource(colors.source.top) : `${shortSource(colors.source.top)} → ${shortSource(colors.source.bottom)}`;
      return `<figure class="atlas-study"><div class="atlas-card-frame">${renderAtlasWidget(study,{group,variant:variant.id,id:`${group}-${variant.id}-${study.id}`,interactive:true})}</div><figcaption><span class="atlas-card-caption"><span>${escapeHTML(study.eyebrow)}</span><span>H${colors.hue}</span></span><code>${hex}</code><span class="atlas-card-source">${escapeHTML(source)}</span></figcaption></figure>`;
    }).join('')}</div>
  </section>`).join('');
}

$('#story-studies').innerHTML = renderBoard('story');
$('#time-studies').innerHTML = renderBoard('time');
$('#resume-scenario').innerHTML = RESUME_SCENARIOS.map(item=>`<option value="${escapeHTML(item.id)}">${escapeHTML(item.label)}</option>`).join('');
$('#resume-scenario').value=input.id;
$('#resume-appearance').innerHTML=paletteVariants.map(item=>`<option value="${item.id}">${escapeHTML(item.label)}</option>`).join('');
$('#time-direction').textContent = {days:'文案 + 眼神 + 累计观看天数',minutes:'文案 + 眼神 + 今日观看时长',away:'文案 + 眼神 + 距上次观看天数'}[metric];
$('#time-note').textContent = {
  days:'备选口径：有有效观看的自然日累计计数，不要求连续，中断不清零；正式统计规则待确认。',
  minutes:'备选口径：今日有效观看时长，不使用 App 前台停留时长；不设时长任务，久看时提醒休息。',
  away:'备选口径：按自然日展示距上次有效观看的天数；回访不等于完成观看。',
}[metric];

const ruleLabels = {
  watched_today:'今天有有效长视频观看，不再催促。',
  away_seven_days_or_more:'最近有效观看在7天及以上前，使用温和文案池。',
  away_three_to_six_days:'最近有效观看在3–6天前，使用久未观看文案池。',
  recent_resume_evening_window:'1–2天未观看，且当前18:00–22:00，使用晚间文案。',
  recent_resume_outside_evening:'1–2天未观看，不在晚间时段；普通续看不要求每天观看。',
  no_pending_resume:'没有可续看目标，优先休息，不因离开天数催看。',
  login_required:'未登录，不展示账号历史。',
  no_playable_history:'没有可播的续看目标，不绕过客户端权限。',
  no_valid_history:'没有有效长视频观看记录，不虚构进度。',
};

function updatePreview() {
  currentStudy = selection.group==='story' ? selectResumeStudy(input) : studies.time.find(item=>item.id===selection.id);
  if (!currentStudy) return;
  const study=currentStudy;
  const colors=getStudyPalette(study.mood,selection.variant);
  const variant=paletteVariants.find(item=>item.id===selection.variant);
  $('#resume-appearance').value=selection.variant;
  $('#atlas-device').innerHTML=renderRefinedHome({prefix:'atlas',clock:clock(),size:phoneSize});
  $('#atlas-widgetMount').innerHTML=renderAtlasWidget(study,{group:selection.group,variant:selection.variant,size:phoneSize,id:'atlas-selected-widget',interactive:true,action:'resume'});
  $('#atlas-device .rf-home').dataset.appearance=colors.appearance;
  $('#atlas-hint').textContent='本地续看预览。打开不会增加观看记录，只有明确模拟观看才更新。';
  $('#atlas-preview-caption').textContent=`${selection.group==='story'?'近期长视频续看':'备选 · 陪伴时间'} · ${study.eyebrow} · ${variant.label}`;
  for (const button of document.querySelectorAll('[data-phone-size]')) button.setAttribute('aria-pressed',String(button.dataset.phoneSize===phoneSize));
  $('#resume-comparison').innerHTML=['square','wide'].map(size=>`<figure class="resume-size-sample"><div class="resume-size-frame" style="--resume-native-width:${size==='wide'?'345':'170'}px">${renderAtlasWidget(study,{group:selection.group,variant:selection.variant,size,id:`resume-compare-${size}`})}</div><figcaption>${size==='square'?'1×1 · 方形':'1×3 · 横版'}${selection.group==='story'?' · 同一内容、同一进度':''}</figcaption></figure>`).join('');
  const days=study.history?.daysAway;
  const last=days==null?'无有效观看日期':days===0?'今天已看':`距最近有效观看${days}天`;
  $('#resume-date').textContent=`${date()} ${clock()}`;
  $('#resume-date').dateTime=new Date(input.now).toISOString();
  $('#resume-rule').innerHTML=selection.group==='story'
    ? `<strong>${escapeHTML(study.eyebrow)}</strong> · ${escapeHTML(study.content?.typeLabel || '兜底状态')} · ${escapeHTML(last)}<br>${escapeHTML(ruleLabels[study.ruleReason] || '有效观看与完成标志沿用客户端口径。')}${study.copy?.quietHours?' 当前为22:00–次日08:00安静时段，文案保持温和。':''}`
    : '当前为备用时间方向。选择上方场景，可回到近期长视频续看主方案。';
  const backgroundValue=colors.finish==='solid'?colors.top:`${colors.top} → ${colors.bottom}`;
  const backgroundSource=colors.finish==='solid'?colors.source.top:`${colors.source.top} → ${colors.source.bottom}`;
  $('#atlas-source').innerHTML=`<p class="atlas-source-heading">配色依据 <span>H${colors.hue}</span></p><dl><div><dt>背景</dt><dd><code>${backgroundValue}</code><small>${escapeHTML(backgroundSource)}</small></dd></div><div><dt>主字</dt><dd><code>${colors.ink}</code><small>${escapeHTML(colors.source.ink)}</small></dd></div><div><dt>次字</dt><dd><code>${colors.secondary}</code><small>${escapeHTML(colors.source.secondary)}</small></dd></div></dl><p class="atlas-source-note">浅深角色${colors.finish==='gradient'?'、渐变方式':''}为本次提案，待设计确认。</p><a href="${escapeHTML(FIGMA_COLOR_SOURCE)}" target="_blank" rel="noopener noreferrer">Figma 原色卡 ↗</a>`;
  for(const button of document.querySelectorAll('.atlas-card-frame button')) button.setAttribute('aria-pressed',String(button.dataset.group===selection.group&&button.dataset.studyId===selection.id&&button.dataset.variant===selection.variant));
  fitPreview();
}

function chooseScenario(id) {
  input=createResumeScenario(id);
  selection.group='story';
  selection.id=studies.story.find(item=>item.scenarioId===input.id)?.id ?? null;
  $('#resume-scenario').value=input.id;
  $('#resume-feedback').textContent='';
  updatePreview();
}

$('.atlas-collection').addEventListener('click',event=>{
  const button=event.target.closest('.atlas-card-frame button[data-study-id]');
  const study=studies[button?.dataset.group]?.find(item=>item.id===button.dataset.studyId);
  if(!study || !paletteVariants.some(variant=>variant.id===button.dataset.variant)) return;
  selection.group=button.dataset.group;
  selection.id=study.id;
  selection.variant=button.dataset.variant;
  followsSystem=false;
  if(selection.group==='story') {
    // Comparing finishes of the same scenario must not erase the demo history.
    if(input.id!==study.scenarioId) input=createResumeScenario(study.scenarioId);
    $('#resume-scenario').value=input.id;
    const current=selectResumeStudy(input);
    if(current.context!==study.context || current.lines.join('')!==study.lines.join('')) selection.id=null;
  }
  $('#resume-feedback').textContent='';
  updatePreview();
});
$('#resume-scenario').addEventListener('change',event=>chooseScenario(event.target.value));
$('#resume-appearance').addEventListener('change',event=>{
  if(!paletteVariants.some(item=>item.id===event.target.value)) return;
  selection.variant=event.target.value;
  followsSystem=false;
  updatePreview();
});
$('#resume-next-day').addEventListener('click',()=>{
  input=advanceResumeDay(input);
  selection.group='story'; selection.id=null;
  updatePreview();
  $('#resume-feedback').textContent='仅推进演示日期，没有新增观看；同一天反复预览不换词，跨天按文案池轮换。';
});
$('#resume-reset').addEventListener('click',()=>chooseScenario(input.id));
$('.resume-size-switch').addEventListener('click',event=>{
  const button=event.target.closest('[data-phone-size]');
  if(!button) return;
  phoneSize=button.dataset.phoneSize==='wide'?'wide':'square';
  updatePreview();
  $(`[data-phone-size="${phoneSize}"]`).focus({preventScroll:true});
});

function closeSheet() {
  const layer=$('#atlas-device .resume-sheet-layer');
  if(!layer) return;
  layer.remove();
  $('#atlas-device .rf-home-content').inert=false;
  $('#atlas-selected-widget').focus({preventScroll:true});
}

function openSheet() {
  const study=currentStudy;
  const hasTarget=selection.group==='story'&&study.status==='resume'&&study.progress;
  const title=hasTarget?study.content.title:selection.group==='time'?'陪伴时间 · 备选预览':study.title;
  const description=hasTarget?`${study.content.typeLabel} · ${study.context}`:selection.group==='time'?'仅比较文案与色彩，不产生观看记录。':study.context;
  const home=$('#atlas-device .rf-home');
  if(home.querySelector('.resume-sheet-layer')) return;
  $('#atlas-device .rf-home-content').inert=true;
  const layer=document.createElement('div');
  layer.className='resume-sheet-layer'; layer.dataset.appearance=home.dataset.appearance;
  layer.innerHTML=`<section class="resume-sheet" role="dialog" aria-labelledby="resume-sheet-title"><button type="button" class="resume-sheet-close" data-close-sheet aria-label="返回桌面">×</button><p class="resume-sheet-brand"><img src="./assets/tencent/tencent-video-official-icon-192.png" alt="">腾讯视频 · 本地续看预览</p><h2 id="resume-sheet-title">${escapeHTML(title)}</h2><p class="resume-sheet-progress">${escapeHTML(description)}</p>${hasTarget?'<button type="button" class="resume-sheet-action" data-simulate-watch>模拟观看 5 分钟</button>':'<button type="button" class="resume-sheet-action" data-close-sheet>返回桌面</button>'}<p class="resume-sheet-note">${hasTarget?'仅打开不算观看。点击上方按钮才增加本页演示进度，不涉及真实账号或播放。':'正式登录、发现内容或权限处理由客户端接入；本页只演示状态。'}</p></section>`;
  home.append(layer);
  layer.querySelector('button').focus({preventScroll:true});
}
$('#atlas-device').addEventListener('click',event=>{
  if(event.target.closest('#atlas-selected-widget')) openSheet();
  else if(event.target.closest('[data-close-sheet]') || event.target.classList.contains('resume-sheet-layer')) closeSheet();
  else if(event.target.closest('[data-simulate-watch]')) {
    input=simulateResumeWatch(input,300);
    selection.group='story'; selection.id=null;
    updatePreview();
    $('#resume-feedback').textContent=`已模拟观看并同步两种尺寸的进度；当前为“${currentStudy.eyebrow}”。不足5分钟时播放至本集／期结束，刷新页面可恢复初始示例。`;
    $('#atlas-selected-widget').focus({preventScroll:true});
  }
});
document.addEventListener('keydown',event=>{
  const sheet=$('.resume-sheet-layer');
  if(!sheet) return;
  if(event.key==='Escape') {event.preventDefault();closeSheet();}
  if(event.key==='Tab' && sheet.contains(document.activeElement)) {
    const controls=[...sheet.querySelectorAll('button')];
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first) {event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last) {event.preventDefault();first.focus();}
  }
});

function fitPreview() {
  const preview=$('.atlas-preview');
  const mobile=innerWidth<=560;
  const scale=Math.min(mobile ? .63 : .76,preview.clientWidth/453,Math.max(.32,(innerHeight-(mobile?220:340))/912));
  document.documentElement.style.setProperty('--atlas-phone-scale',String(scale));
  for(const board of document.querySelectorAll('.atlas-board')) {
    if(!board.clientWidth) continue;
    const style=getComputedStyle(board);
    const width=board.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
    const columns=width>=660?5:width>=410?3:width>=270?2:1;
    board.style.setProperty('--atlas-columns',String(columns));
    board.style.setProperty('--atlas-study-scale',String(Math.min(170,(width-14*(columns-1))/columns)/170));
  }
  const comparison=$('#resume-comparison');
  const style=getComputedStyle(comparison);
  const width=comparison.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
  comparison.style.setProperty('--resume-pair-scale',String(Math.min(1,width/345)));
}

$('.resume-alternative').addEventListener('toggle',fitPreview);
updatePreview();
window.addEventListener('resize',fitPreview);
appearanceMedia.addEventListener('change',event=>{
  if(!followsSystem) return;
  const finish=getStudyPalette('ready',selection.variant).finish;
  selection.variant=`${event.matches?'dark':'light'}-${finish}`;
  updatePreview();
});
