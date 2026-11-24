import {POLICY_CONFIG,POLICY_SCENARIOS,PARAMETER_DEFINITIONS,evaluatePolicy,advancePolicyDay,simulatePolicyWatch,createPolicyInput} from './widget-policy-model.mjs';
import {renderAtlasWidget} from './widget-atlas-view.mjs';
import {renderRefinedHome} from './ios-home-v4.mjs';

const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const form = $('#policy-form');
const reviewMarks = new Map();
const appearanceMedia = matchMedia('(prefers-color-scheme: dark)');
const reviewOptions = [['pending','待研发确认'],['exists','已有字段'],['derived','可计算得到'],['missing','需补充能力']];
let appearance = appearanceMedia.matches ? 'dark-gradient' : 'light-gradient';
let followsSystem = true;
let phoneSize = 'square';
let scenarioId = POLICY_SCENARIOS.some(item=>item.id==='day7') ? 'day7' : POLICY_SCENARIOS[0].id;
let input = createPolicyInput(scenarioId);
let output;

function localInput(value) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return '';
  return new Date(time+8*3600000).toISOString().slice(0,16);
}
function inputTimestamp(value) { return value ? `${value.length===16?`${value}:00`:value}+08:00` : null; }
function setForm(data) {
  for (const element of form.elements) {
    if (!element.name) continue;
    if (element.name==='now' || element.name==='last_valid_watch_at') element.value=localInput(data[element.name]);
    else if (element.name==='has_next') element.value=String(Boolean(data.next_play_unit));
    else if (element.name==='next_unit_id') element.value=data.next_play_unit?.play_unit_id ?? 'demo-unit-next';
    else if (element.name==='next_unit_label') element.value=data.next_play_unit?.unit_label ?? '第9集';
    else element.value=data[element.name] == null ? '' : String(data[element.name]);
  }
  updateConditionalFields();
}
function updateConditionalFields() {
  const hasNext=form.elements.has_next.value==='true';
  form.elements.next_unit_id.disabled=!hasNext;
  form.elements.next_unit_label.disabled=!hasNext;
}
function readForm() {
  const values=Object.fromEntries(new FormData(form));
  const data={...input};
  for(const [key,value] of Object.entries(values)) {
    if(['has_next','next_unit_id','next_unit_label'].includes(key)) continue;
    if(key==='now'||key==='last_valid_watch_at') data[key]=inputTimestamp(value);
    else if(key==='is_logged_in'||key==='is_completed') data[key]=value==='true';
    else if(key==='position_seconds') data[key]=value.trim()==='' ? null : Number(value);
    else data[key]=value;
  }
  data.next_play_unit=values.has_next==='true' ? {play_unit_id:values.next_unit_id ?? '',unit_label:values.next_unit_label ?? ''} : null;
  return data;
}
function formatTime(value) {
  if(typeof value!=='string'||!value.trim())return '—';
  const date=new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(date) : '—';
}
function traceStatus(item) { return item.status ?? (item.matched===true?'matched':item.matched===false?'passed':'skipped'); }
function getMatchedTrace(result) { return result.trace.find(item=>traceStatus(item)==='matched'); }

function renderResult() {
  output=evaluatePolicy(input);
  const state=output.state;
  const derived=output.derived;
  const days=derived.days_since_watch;
  const quiet=derived.time_slot==='quiet';
  const matched=getMatchedTrace(output);
  $('#policy-derived').innerHTML=`<div class="derived-card"><strong>${days==null?'—':escapeHTML(days)}${days==null?'':'<em>天</em>'}</strong><span>距最近有效观看</span><code>D · 自动计算</code></div><div class="derived-card"><strong class="derived-word">${derived.watched_today==null?'未知':derived.watched_today?'已看':'未看'}</strong><span>今天是否观看</span><code>watched_today</code></div><div class="derived-card"><strong class="derived-word">${quiet?'安静时段':derived.time_slot==='regular'?'常规时段':'未知'}</strong><span>${escapeHTML(formatTime(input.now))} · 北京时间</span><code>time_slot</code></div>`;
  for(const button of document.querySelectorAll('[data-day]')) button.setAttribute('aria-pressed',String(days!=null&&Number(button.dataset.day)===days));
  $('#policy-result').innerHTML=`<div class="result-card"><p class="result-eyebrow"><i></i>当前命中状态</p><h3>${escapeHTML(state.label)}</h3><code>state_id = ${escapeHTML(state.id)}</code><p>${escapeHTML(matched?.reason || '按优先级选择一个状态，不叠加多个状态。')}${quiet&&days>=1&&output.target?' 当前使用安静文案，原有天数分段不变。':''}</p></div>`;
  $('#policy-expression').innerHTML=`<p class="expression-caption">命中的条件表达式</p><code>${escapeHTML(matched?.expression || '等待完整的参数输入')}</code>`;
  $('#policy-copy-selection').innerHTML=`<p>再从 <code>${escapeHTML(output.copy.pool)}</code> 文案池选择</p><blockquote>${output.copy.lines.map(line=>`<span>${escapeHTML(line)}</span>`).join('')}</blockquote><small><code>${escapeHTML(output.copy.id)}</code> · ${escapeHTML(output.copy.rotation)}</small>`;
  $('#policy-warnings').innerHTML=output.warnings.map(warning=>`<p class="policy-warning">${escapeHTML(warning)}</p>`).join('');
  const firstMatch=output.trace.findIndex(item=>traceStatus(item)==='matched');
  const shown=firstMatch<0 ? output.trace : output.trace.slice(0,firstMatch+1);
  $('#policy-trace').innerHTML=shown.map(item=>{
    const status=traceStatus(item);
    return `<li class="trace-row" data-status="${escapeHTML(status)}"><span class="trace-symbol" aria-hidden="true">${status==='matched'?'✓':status==='skipped'?'·':'−'}</span><div class="trace-row-header"><span>${escapeHTML(item.label)}</span><span>${status==='matched'?'TRUE · 命中':status==='skipped'?'跳过':'FALSE · 继续'}</span></div><code>${escapeHTML(item.expression)}</code>${status==='matched'?`<p>${escapeHTML(item.reason)}</p>`:''}</li>`;
  }).join('')+(firstMatch>=0&&firstMatch<output.trace.length-1?`<li class="skipped-summary">后续 ${output.trace.length-firstMatch-1} 条规则已跳过：先命中，先结束。</li>`:'');
  renderPreview();
  renderParameters();
  $('#policy-watch').disabled=output.action.id!=='resume';
  $('#policy-next-day').disabled=derived.local_date==null;
  $('#policy-watch').title=output.action.id==='resume'?'仅模拟一次有效观看：更新最近观看时间，不修改已看位置、不触发真实播放。':output.action.reason || '当前状态不能模拟有效观看。';
}
function renderPreview() {
  $('#policy-phone').innerHTML=renderRefinedHome({prefix:'policy',clock:formatTime(input.now),size:phoneSize});
  $('#policy-widgetMount').innerHTML=renderAtlasWidget(output.study,{size:phoneSize,variant:appearance,id:'policy-preview-widget',interactive:true,action:'resume'});
  $('#policy-phone .rf-home').dataset.appearance=appearance.startsWith('dark')?'dark':'light';
  $('#policy-hint').textContent=`${output.action.label}。本页仅演示跳转去向，不会触发真实播放。`;
  $('#policy-output').innerHTML=[['文案编号',`<code>${escapeHTML(output.copy.id)}</code>`],['文案池',`<code>${escapeHTML(output.copy.pool)}</code>`],['点击后',escapeHTML(output.action.label)],['权限说明',escapeHTML(output.action.reason || '实际权限由客户端校验。')]].map(([key,value])=>`<div><dt>${key}</dt><dd>${value}</dd></div>`).join('');
  for(const button of document.querySelectorAll('.size-control [data-size]')) button.setAttribute('aria-pressed',String(button.dataset.size===phoneSize));
  $('#policy-appearance').value=appearance;
}
function describeValue(value) {
  if(value===null || value===undefined || value==='') return 'null';
  if(typeof value==='object') return JSON.stringify(value);
  return String(value);
}
function renderParameters() {
  $('#policy-parameters').innerHTML=PARAMETER_DEFINITIONS.map(item=>{
    const key=item.key;
    const mark=reviewMarks.get(key)??'pending';
    return `<tr><td><code>${escapeHTML(key)}</code><small>${escapeHTML(item.label??key)} · ${escapeHTML(item.type??'待对齐')}</small></td><td><code>${escapeHTML(describeValue(input[key]))}</code></td><td>${escapeHTML(item.role??item.usage??'用于本页条件判断或内容展示')}<small>建议来源：${escapeHTML(item.source??'待研发确认')}</small></td><td><label class="sr-only" for="review-${escapeHTML(key)}">${escapeHTML(key)} 字段已有情况</label><select id="review-${escapeHTML(key)}" data-review-key="${escapeHTML(key)}">${reviewOptions.map(([value,label])=>`<option value="${value}"${value===mark?' selected':''}>${label}</option>`).join('')}</select></td></tr>`;
  }).join('');
}
function feedback(message) { $('#policy-feedback').textContent=message; }
function chooseScenario(id) {
  scenarioId=id;
  input=createPolicyInput(id);
  setForm(input);
  $('#policy-scenario').value=id;
  renderResult();
  feedback('已载入虚构场景。现在修改任意参数，观察状态、条件表达式和组件如何一起变化。');
}
function setDays(days) {
  const now=Date.parse(input.now);
  if(!Number.isFinite(now)) {feedback('请先填写有效的当前模拟时间。');return;}
  input={...input,last_valid_watch_at:new Date(now-days*86400000).toISOString()};
  setForm(input);renderResult();
  feedback(`只把最近有效观看时间设为 ${days===0?'今天':`${days} 天前`}，其他条件未改变。数据失败、未登录等高优先级条件仍会优先命中。`);
}
function openJSON() {
  const payload={notice:'本地规范化模拟数据；字段名及可用性待研发映射，未连接真实接口。',input,derived:output.derived,result:{state:output.state,copy:output.copy,target:output.target,action:output.action},config:POLICY_CONFIG,field_review:Object.fromEntries(PARAMETER_DEFINITIONS.map(item=>[item.key,reviewOptions.find(([key])=>key===(reviewMarks.get(item.key)??'pending'))[1]]))};
  $('#policy-json-text').value=JSON.stringify(payload,null,2);
  $('#policy-copy-feedback').textContent='包含模拟输入、计算结果和字段核对标记。';
  $('#policy-json-dialog').showModal();
}

$('#policy-scenario').innerHTML=POLICY_SCENARIOS.map(item=>`<option value="${escapeHTML(item.id)}">${escapeHTML(item.label)}</option>`).join('');
$('#policy-scenario').value=scenarioId;
setForm(input);renderResult();
form.addEventListener('submit',event=>event.preventDefault());
form.addEventListener('input',event=>{
  if(!(event.target instanceof HTMLInputElement)) return;
  input=readForm();renderResult();
  feedback('参数已更新。字段名是建议名；所有计算只在当前页面进行。');
});
form.addEventListener('change',()=>{
  updateConditionalFields();input=readForm();renderResult();
  feedback('参数已更新。会员身份不直接决定情绪，播放权限仍独立判断。');
});
$('#policy-scenario').addEventListener('change',event=>chooseScenario(event.target.value));
$('#policy-reset').addEventListener('click',()=>chooseScenario(scenarioId));
$('#policy-next-day').addEventListener('click',()=>{
  input=advancePolicyDay(input);setForm(input);renderResult();
  feedback('仅推进模拟日期，没有新增观看。D 可能增长，命中的文案也会随规则变化。');
});
$('#policy-watch').addEventListener('click',()=>{
  input=simulatePolicyWatch(input);setForm(input);renderResult();
  feedback('已模拟一次有效观看：最近观看时间更新为当前时间，D 变为 0。本次不改播放位置；点击预览本身不会产生观看。');
});
$('.day-shortcuts').addEventListener('click',event=>{
  const button=event.target.closest('[data-day]');if(button)setDays(Number(button.dataset.day));
});
$('.size-control').addEventListener('click',event=>{
  const button=event.target.closest('[data-size]');if(!button)return;
  phoneSize=button.dataset.size;renderPreview();
});
$('#policy-appearance').addEventListener('change',event=>{appearance=event.target.value;followsSystem=false;renderPreview();});
appearanceMedia.addEventListener('change',event=>{if(followsSystem){appearance=`${event.matches?'dark':'light'}-${appearance.endsWith('gradient')?'gradient':'solid'}`;renderPreview();}});
$('#policy-phone').addEventListener('click',event=>{
  if(event.target.closest('#policy-preview-widget'))feedback(`点击后：${output.action.label}。${output.action.reason??''} 这里只预览跳转，不修改观看时间。`);
});
$('#policy-parameters').addEventListener('change',event=>{
  const control=event.target.closest('[data-review-key]');if(!control)return;
  reviewMarks.set(control.dataset.reviewKey,control.value);
  feedback('字段核对标记已暂存于当前页面；不会改变策略结果，刷新页面会重置。可通过参数 JSON 一起复制。');
});
$('#policy-json').addEventListener('click',openJSON);
$('#policy-json-close').addEventListener('click',()=>$('#policy-json-dialog').close());
$('#policy-copy-json').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText($('#policy-json-text').value);$('#policy-copy-feedback').textContent='JSON 已复制。';}
  catch{$('#policy-json-text').focus();$('#policy-json-text').select();$('#policy-copy-feedback').textContent='浏览器未允许自动复制，已选中文字，可手动复制。';}
});
