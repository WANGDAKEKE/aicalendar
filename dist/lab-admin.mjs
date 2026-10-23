import {selectLab} from './lab-store.mjs';

const tierNames = {free:'非VIP', vip:'VIP', svip:'SVIP'};
const tabNames = {users:'用户', schedule:'排播', campaign:'运营', logs:'日志'};
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let instanceCount = 0;

function beijingInput(now) {
  const time = new Date(now).getTime();
  return Number.isFinite(time) ? new Date(time + 8 * 3600000).toISOString().slice(0,16) : '';
}

function beijingISO(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('请填写完整的北京时间。');
  const iso = `${value}:00+08:00`;
  if (beijingInput(iso) !== value) throw new Error('日期或时间无效，请检查后重试。');
  return iso;
}

function eventTime(value) {
  const local = beijingInput(value);
  return local ? `${local.slice(5,10).replace('-', '/')} ${local.slice(11)}` : '时间未知';
}

function sourceName(source) {
  if (source === 'admin') return '后台';
  return ['front','frontend','phone','app','client','player','ui'].includes(source) ? '前端' : '系统';
}

function kindName(kind) {
  return ({SET_USER:'切换用户',SET_TIER:'调整会员',SET_TIME:'调整时间',SET_COMPLETED:'更新记录',
    SET_RELEASE:'修改排播',SET_CAMPAIGN:'调整运营',RESET:'重置演示',
    PLAY_EPISODE:'开始观看',COMPLETE_EPISODE:'看完剧集',COMPLETE_VIEWING:'看完剧集',
    SET_REMINDER:'更新提醒',TOGGLE_REMINDER:'更新提醒',TICKET_UPGRADE:'电子票升级',
    PENGUIN_INTERACTION:'企鹅互动',user_changed:'切换用户',tier_changed:'调整会员',
    time_changed:'调整时间',history_updated:'更新记录',release_updated:'修改排播',
    campaign_updated:'调整运营',episode_completed:'看完剧集',reminder_changed:'更新提醒',
    ticket_issued:'首次获得',ticket_upgraded:'电子票升级',ticket_adjusted:'调整电子票',
    penguin_tap:'企鹅互动',widget_preview:'桌面组件',widget_added:'演示桌面添加',widget_open:'桌面回流',marketing_click:'营销入口',
    ticket_download_requested:'保存电子票'})[kind] || '状态更新';
}

// Editors remain mounted: subscriptions only refresh clean inputs and live metrics.
// No admin action writes storage or grants playback access outside the shared store.
export function mountAdmin(root, store) {
  if (!root?.querySelector || !['getState','dispatch','subscribe'].every(key => typeof store?.[key] === 'function')) {
    throw new TypeError('mountAdmin requires a root element and a lab store.');
  }
  const prefix = `lab-admin-${++instanceCount}`;
  const abort = new AbortController();
  const edits = Object.fromEntries(['user','tier','history','clock','campaign'].map(key => [key,{dirty:false,userId:null}]));
  const releaseDrafts = new Map();
  let releaseKey = '', activeTab = 'users', destroyed = false, lastEventSignature = '';
  const tiers = selected => ['vip','svip','free'].map(tier => `<option value="${tier}"${selected===tier?' selected':''}>${tierNames[tier]}</option>`).join('');
  const fieldId = name => `${prefix}-${name}`;
  root.classList.add('lab-admin');
  root.innerHTML = `
    <header class="lab-admin-header"><div><span class="lab-admin-eyebrow">LOCAL CONSOLE</span><h2>演示操作台</h2></div><div class="lab-admin-sync"><i aria-hidden="true"></i><span data-admin-sync>已同步</span></div></header>
    <p class="lab-admin-intro">改动在左侧生效，观看记录在这里同步。</p>
    <div class="lab-admin-metrics" aria-label="当前用户状态"><div><span>已看剧集</span><strong data-admin-watched>—</strong></div><div><span>成长电子票</span><strong data-admin-ticket>—</strong><small data-admin-ticket-serial>—</small></div><div><span>更新提醒</span><strong data-admin-reminder>—</strong></div></div>
    <div class="lab-admin-feedback" data-admin-feedback role="status" aria-live="polite" hidden></div>
    <div class="lab-admin-tabs" role="tablist" aria-label="操作台栏目">${Object.entries(tabNames).map(([key,label])=>`<button type="button" role="tab" id="${fieldId(`tab-${key}`)}" aria-controls="${fieldId(`panel-${key}`)}" aria-selected="${key===activeTab}" tabindex="${key===activeTab?0:-1}" data-admin-tab="${key}">${label}${key==='logs'?'<span data-admin-log-count>0</span>':''}</button>`).join('')}</div>
    <div class="lab-admin-body">
      <section role="tabpanel" id="${fieldId('panel-users')}" aria-labelledby="${fieldId('tab-users')}" data-admin-panel="users">
        <form class="lab-admin-card" data-admin-form="user">
          <div class="lab-admin-card-title"><h3>演示用户</h3><span class="lab-admin-chip">独立记录</span></div>
          <fieldset class="lab-admin-user-options" data-admin-user-options><legend class="lab-admin-sr">选择演示用户</legend></fieldset>
          <div class="lab-admin-form-bottom"><small data-admin-current-user>选择用户后切换</small><button class="lab-admin-primary" type="submit">切换用户</button></div>
        </form>
        <form class="lab-admin-card" data-admin-form="tier">
          <div class="lab-admin-card-title"><h3>账号身份</h3><button type="button" class="lab-admin-text-button" data-admin-reload="tier">载入当前</button></div>
          <label class="lab-admin-label" for="${fieldId('tier')}">真实会员身份</label>
          <div class="lab-admin-inline"><select id="${fieldId('tier')}" name="tier">${tiers('vip')}</select><button class="lab-admin-primary" type="submit">保存身份</button></div>
          <p class="lab-admin-help">改变模拟账号的真实权益，不是排期预览。</p><p class="lab-admin-draft" data-admin-draft="tier" hidden></p>
        </form>
        <form class="lab-admin-card" data-admin-form="history">
          <div class="lab-admin-card-title"><h3>已看完的剧集</h3><button type="button" class="lab-admin-text-button" data-admin-reload="history">载入当前</button></div>
          <p class="lab-admin-help">支持跳着看。电子票只按完整观看记录成长。</p>
          <fieldset class="lab-admin-episode-grid" data-admin-episodes><legend class="lab-admin-sr">已看完剧集，多选</legend>${Array.from({length:30},(_,index)=>`<label class="lab-admin-episode"><input type="checkbox" name="episode" value="${index+1}" aria-label="第 ${index+1} 集已看完"><span>${index+1}</span></label>`).join('')}</fieldset>
          <p class="lab-admin-help" data-admin-available></p><p class="lab-admin-draft" data-admin-draft="history" hidden></p>
          <div class="lab-admin-form-bottom"><small data-admin-selected-count>已选 0 集</small><button class="lab-admin-primary" type="submit">保存观看记录</button></div>
        </form>
      </section>
      <section role="tabpanel" id="${fieldId('panel-schedule')}" aria-labelledby="${fieldId('tab-schedule')}" data-admin-panel="schedule" hidden>
        <form class="lab-admin-card" data-admin-form="clock">
          <div class="lab-admin-card-title"><h3>演示时间</h3><span class="lab-admin-chip">北京时间</span></div>
          <label class="lab-admin-label" for="${fieldId('now')}">当前日期与时间</label><input id="${fieldId('now')}" type="datetime-local" name="now" step="60" required>
          <p class="lab-admin-help">调整后重算已上线剧集与活动状态，不改变真实系统时间。</p>
          <div class="lab-admin-form-bottom"><button type="button" class="lab-admin-text-button" data-admin-reload="clock">载入当前时间</button><button class="lab-admin-primary" type="submit">应用时间</button></div>
          <p class="lab-admin-draft" data-admin-draft="clock" hidden></p>
        </form>
        <form class="lab-admin-card" data-admin-form="release">
          <div class="lab-admin-card-title"><h3>调整发布批次</h3><span class="lab-admin-chip">仅改时间</span></div>
          <label class="lab-admin-label" for="${fieldId('release-tier')}">会员排期</label><select id="${fieldId('release-tier')}" name="releaseTier">${tiers('vip')}</select>
          <label class="lab-admin-label" for="${fieldId('release-index')}">发布批次</label><select id="${fieldId('release-index')}" name="releaseIndex"></select>
          <div class="lab-admin-two-columns"><div><label class="lab-admin-label" for="${fieldId('release-date')}">更新日期</label><input id="${fieldId('release-date')}" type="date" name="releaseDate" required></div><div><label class="lab-admin-label" for="${fieldId('release-time')}">更新时间</label><input id="${fieldId('release-time')}" type="time" name="releaseTime" step="60" required></div></div>
          <p class="lab-admin-help">保留该批次原有集数与开播 / 完结标识。不同身份排期独立。</p><p class="lab-admin-draft" data-admin-release-draft hidden></p>
          <div class="lab-admin-form-bottom"><button type="button" class="lab-admin-text-button" data-admin-reload="release">载入当前批次</button><button class="lab-admin-primary" type="submit">保存排播</button></div>
        </form>
      </section>
      <section role="tabpanel" id="${fieldId('panel-campaign')}" aria-labelledby="${fieldId('tab-campaign')}" data-admin-panel="campaign" hidden>
        <form class="lab-admin-card" data-admin-form="campaign">
          <div class="lab-admin-card-title"><h3>底部营销位</h3><button type="button" class="lab-admin-text-button" data-admin-reload="campaign">载入当前</button></div>
          <label class="lab-admin-toggle"><span><strong>展示营销入口</strong><small>关闭后不展示会员或点映礼营销</small></span><input type="checkbox" name="enabled"><i aria-hidden="true"></i></label>
          <label class="lab-admin-label" for="${fieldId('campaign-mode')}">展示策略</label><select id="${fieldId('campaign-mode')}" name="mode"><option value="auto">自动匹配当前用户</option><option value="membership">优先展示会员营销</option><option value="screening">优先展示点映礼</option></select>
          <label class="lab-admin-label" for="${fieldId('campaign-headline')}">营销标题</label><input id="${fieldId('campaign-headline')}" name="headline" type="text" maxlength="60" required placeholder="例：好故事，先一步看到">
          <label class="lab-admin-toggle lab-admin-toggle-secondary"><span><strong>开放点映礼活动展示</strong><small>资格独立，不解锁普通会员播放权限</small></span><input type="checkbox" name="screeningEnabled"><i aria-hidden="true"></i></label>
          <p class="lab-admin-help">这里只调整演示曝光。点击营销入口不产生订单、付款或真实会员权益。</p><p class="lab-admin-draft" data-admin-draft="campaign" hidden></p>
          <div class="lab-admin-form-bottom"><span class="lab-admin-asset-note">本机模拟运营配置</span><button class="lab-admin-primary" type="submit">保存运营配置</button></div>
        </form>
        <div class="lab-admin-asset-card"><span aria-hidden="true">◇</span><div><strong>演示素材 · 非真实媒资后台</strong><p>沿用项目现有视频与票面素材，不连接腾讯账号、媒资库或支付系统。</p></div></div>
      </section>
      <section role="tabpanel" id="${fieldId('panel-logs')}" aria-labelledby="${fieldId('tab-logs')}" data-admin-panel="logs" hidden>
        <div class="lab-admin-log-header"><h3>前后台同步记录</h3><small>最近 40 条 · 北京时间</small></div><ol class="lab-admin-log-list" data-admin-events></ol><p class="lab-admin-log-empty" data-admin-log-empty>还没有操作记录。<br>在左侧观看，或在这里保存一次改动。</p>
      </section>
    </div>
    <footer class="lab-admin-footer"><span>仅本机演示 · 不连接真实业务</span><button type="button" class="lab-admin-text-button" data-admin-reset-open>重置演示</button></footer>
    <div class="lab-admin-reset-confirm" data-admin-reset-confirm hidden><p>恢复初始用户、排期与记录？未保存草稿也会清空。</p><div><button type="button" data-admin-reset-cancel>保留当前</button><button type="button" class="lab-admin-danger" data-admin-reset-confirm-button>确认重置</button></div></div>`;

  const find = selector => root.querySelector(selector);
  const form = key => find(`[data-admin-form="${key}"]`);
  const input = (key,name) => form(key).elements.namedItem(name);
  const stateNow = () => store.getState();
  const currentRelease = () => {
    const tier = input('release','releaseTier').value;
    const index = Number(input('release','releaseIndex').value);
    return {tier,index,release:stateNow().drama.scheduleByTier[tier]?.[index]};
  };

  function feedback(message, error = false) {
    const box = find('[data-admin-feedback]');
    box.textContent = message;
    box.hidden = !message;
    box.dataset.kind = error ? 'error' : 'success';
    box.setAttribute('role',error?'alert':'status');
  }

  function dispatch(action, message) {
    try {
      const result = store.dispatch({...action,source:'admin'});
      if (!result?.ok) throw new Error(typeof result?.error==='string' ? result.error : '保存未成功，请检查输入后重试。');
      feedback(message);
      return true;
    } catch (error) {
      feedback(error instanceof Error ? error.message : '保存未成功，请稍后重试。',true);
      return false;
    }
  }

  function setTab(key, focus = false) {
    if (!Object.hasOwn(tabNames,key)) return;
    activeTab = key;
    root.querySelectorAll('[data-admin-tab]').forEach(button => {
      const selected = button.dataset.adminTab === key;
      button.setAttribute('aria-selected',String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected && focus) button.focus();
    });
    root.querySelectorAll('[data-admin-panel]').forEach(panel => {panel.hidden = panel.dataset.adminPanel !== key;});
    find('.lab-admin-body').scrollTop = 0;
  }

  function updateDraft(key) {
    const editor = edits[key], note = find(`[data-admin-draft="${key}"]`);
    if (!note) return;
    const differentUser = ['tier','history'].includes(key) && editor.userId !== stateNow().activeUserId;
    note.hidden = !editor.dirty;
    note.textContent = differentUser ? '当前用户已切换；此草稿仍属于原用户。请载入当前数据后再保存。' : '有未保存的修改；前台同步不会覆盖这份草稿。';
    form(key).querySelector('button[type="submit"]').disabled = editor.dirty && differentUser;
    const reload = find(`[data-admin-reload="${key}"]`);
    if (reload) reload.textContent = editor.dirty ? '放弃草稿并载入' : key==='clock'?'载入当前时间':'载入当前';
  }

  function selectedCount() {
    find('[data-admin-selected-count]').textContent = `已选 ${form('history').querySelectorAll('input[name="episode"]:checked').length} 集${edits.history.dirty?' · 待保存':''}`;
  }

  function refreshReleaseOptions() {
    const tier = input('release','releaseTier').value;
    const options = stateNow().drama.scheduleByTier[tier] || [];
    const select = input('release','releaseIndex');
    const previous = select.value || '0';
    // Update text in place so background changes do not replace the focused select.
    while (select.options.length > options.length) select.remove(select.options.length-1);
    options.forEach((release,index) => {
      let option = select.options[index];
      if (!option) {option = root.ownerDocument.createElement('option');select.append(option);}
      option.value = String(index);
      option.textContent = `${release.from===release.to?release.from:`${release.from}–${release.to}`}集 · ${release.date.slice(5)} ${release.time}`;
    });
    if (options.length) select.value = Number(previous)<options.length ? previous : '0';
    else select.value = '';
    form('release').querySelector('button[type="submit"]').disabled = options.length===0;
  }

  function renderRelease() {
    const {tier,index,release} = currentRelease();
    releaseKey = `${tier}:${index}`;
    const draft = releaseDrafts.get(releaseKey);
    input('release','releaseDate').value = draft?.date ?? release?.date ?? '';
    input('release','releaseTime').value = draft?.time ?? release?.time ?? '';
    const note = find('[data-admin-release-draft]');
    note.hidden = !draft;
    note.textContent = '该批次有未保存修改；切换批次后草稿仍保留。';
    find('[data-admin-reload="release"]').textContent = draft ? '放弃草稿并载入' : '载入当前批次';
  }

  function render() {
    if (destroyed) return;
    const state = stateNow(), derived = selectLab(state), {user,progress} = derived;
    find('[data-admin-sync]').textContent = `已同步 · ${state.revision}`;
    find('[data-admin-watched]').textContent = `${progress.watchedCount} / ${state.drama.totalEpisodes}`;
    find('[data-admin-ticket]').textContent = progress.current?.name || '尚未获得';
    find('[data-admin-ticket]').title = `当前等级 ${progress.currentLevel} / 3`;
    find('[data-admin-ticket-serial]').textContent = `${user.ticketSerial || '尚未编号'} · ${progress.currentLevel}/3 阶`;
    find('[data-admin-reminder]').textContent = user.reminded ? '已开启' : '未开启';
    find('[data-admin-current-user]').textContent = `当前：${user.name} · ${tierNames[user.tier] || '非VIP'}`;
    const userOptions = find('[data-admin-user-options]');
    if (!userOptions.querySelector('input')) {
      userOptions.insertAdjacentHTML('beforeend',Object.values(state.users).map(item => `<label class="lab-admin-user"><input type="radio" name="userId" value="${escapeHTML(item.id)}"><span class="lab-admin-avatar" aria-hidden="true">${escapeHTML(item.name?.slice(0,1)||'人')}</span><strong>${escapeHTML(item.name)}</strong><small data-admin-user-tier="${escapeHTML(item.id)}"></small></label>`).join(''));
    }
    root.querySelectorAll('[data-admin-user-tier]').forEach(label => {label.textContent = tierNames[state.users[label.dataset.adminUserTier]?.tier] || '非VIP';});
    if (!edits.user.dirty) form('user').querySelectorAll('input[name="userId"]').forEach(radio=>{radio.checked=radio.value===state.activeUserId;});
    if (!edits.tier.dirty) {input('tier','tier').value = user.tier;edits.tier.userId = state.activeUserId;}
    if (!edits.history.dirty) {
      const watched = new Set(user.completed);
      form('history').querySelectorAll('input[name="episode"]').forEach(checkbox=>{checkbox.checked=watched.has(Number(checkbox.value));});
      edits.history.userId = state.activeUserId;
    }
    const available = new Set(derived.availableEpisodes);
    form('history').querySelectorAll('input[name="episode"]').forEach(checkbox=>{
      const isAvailable = available.has(Number(checkbox.value));
      checkbox.closest('label').classList.toggle('is-upcoming',!isAvailable);
      checkbox.title = isAvailable ? '当前账号已上线' : '当前账号尚未上线，模拟历史可独立配置';
    });
    find('[data-admin-available]').textContent = `当前账号已上线 ${available.size} 集。浅色为尚未上线；这里仅调整模拟历史，不额外开放播放权限。`;
    if (!edits.clock.dirty) input('clock','now').value = beijingInput(state.now);
    if (!edits.campaign.dirty) {
      input('campaign','enabled').checked = Boolean(state.campaign.enabled);
      input('campaign','mode').value = state.campaign.mode;
      input('campaign','headline').value = state.campaign.headline || '';
      input('campaign','screeningEnabled').checked = Boolean(state.campaign.screeningEnabled);
    }
    Object.keys(edits).forEach(updateDraft);
    selectedCount();
    refreshReleaseOptions();
    // Never assign a date/time value while its draft is being edited.
    if (!releaseDrafts.has(releaseKey)) renderRelease();
    // Store order is action order; the demo clock can deliberately move backwards.
    const events = [...state.events].reverse().slice(0,40);
    const signature = JSON.stringify(events);
    find('[data-admin-log-count]').textContent = String(state.events.length);
    if (signature !== lastEventSignature) {
      lastEventSignature = signature;
      find('[data-admin-events]').innerHTML = events.map(event=>`<li><div class="lab-admin-log-meta"><span class="lab-admin-log-source ${event.source==='admin'?'is-admin':'is-front'}">${sourceName(event.source)}</span><span>${escapeHTML(kindName(event.kind))}</span><time>${escapeHTML(eventTime(event.at))}</time></div><p>${escapeHTML(event.label || kindName(event.kind))}</p>${event.userId?`<small>${escapeHTML(state.users[event.userId]?.name || '演示用户')}</small>`:''}</li>`).join('');
      find('[data-admin-log-empty]').hidden = events.length > 0;
    }
  }

  root.addEventListener('input',event=>{
    const key = event.target.closest('form')?.dataset.adminForm;
    if (edits[key]) {edits[key].dirty=true;updateDraft(key);if(key==='history')selectedCount();}
    if (key==='release' && ['releaseDate','releaseTime'].includes(event.target.name)) {
      releaseDrafts.set(releaseKey,{date:input('release','releaseDate').value,time:input('release','releaseTime').value});
      const note = find('[data-admin-release-draft]');note.hidden=false;note.textContent='该批次有未保存修改；切换批次后草稿仍保留。';
      find('[data-admin-reload="release"]').textContent='放弃草稿并载入';
    }
  },{signal:abort.signal});

  root.addEventListener('change',event=>{
    if (event.target.name==='releaseTier') {input('release','releaseIndex').value='0';refreshReleaseOptions();renderRelease();}
    else if (event.target.name==='releaseIndex') renderRelease();
  },{signal:abort.signal});

  root.addEventListener('submit',event=>{
    const key = event.target.dataset.adminForm;
    if (!key) return;
    event.preventDefault();
    const state = stateNow();
    if (['tier','history'].includes(key) && edits[key].userId!==state.activeUserId) {feedback('用户已切换，请先载入当前用户的数据。',true);return;}
    let action, message;
    try {
      if (key==='user') {action={type:'SET_USER',userId:new FormData(form(key)).get('userId')};message='已切换演示用户，左侧同步显示独立记录。';}
      if (key==='tier') {action={type:'SET_TIER',tier:input(key,'tier').value,expectedUserId:edits.tier.userId};message='会员身份已保存，实际可播范围已同步。';}
      if (key==='history') {action={type:'SET_COMPLETED',completed:[...form(key).querySelectorAll('input[name="episode"]:checked')].map(checkbox=>Number(checkbox.value)),expectedUserId:edits.history.userId};message='观看记录已保存，电子票进度已重新计算。';}
      if (key==='clock') {action={type:'SET_TIME',now:beijingISO(input(key,'now').value)};message='演示时间已调整（北京时间），左侧排期已同步。';}
      if (key==='campaign') {action={type:'SET_CAMPAIGN',patch:{enabled:input(key,'enabled').checked,mode:input(key,'mode').value,headline:input(key,'headline').value.trim(),screeningEnabled:input(key,'screeningEnabled').checked}};message='运营配置已保存；不会产生订单或改变账号权益。';}
      if (key==='release') {
        const {tier,index,release}=currentRelease();
        if (!release) throw new Error('该发布批次不存在，请重新选择。');
        const date=input(key,'releaseDate').value,time=input(key,'releaseTime').value;
        beijingISO(`${date}T${time}`);
        action={type:'SET_RELEASE',tier,index,release:{...release,date,time}};message=`${tierNames[tier]} 排播已保存，剧集范围保持不变。`;
      }
      if (action && dispatch(action,message)) {
        if (edits[key]) edits[key].dirty=false;
        if (key==='release') releaseDrafts.delete(releaseKey);
        render();
      }
    } catch(error) {feedback(error instanceof Error?error.message:'请检查输入后重试。',true);}
  },{signal:abort.signal});

  root.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if (!button || !root.contains(button)) return;
    if (button.dataset.adminTab) setTab(button.dataset.adminTab);
    if (button.dataset.adminReload) {
      const key=button.dataset.adminReload;
      if (key==='release') {releaseDrafts.delete(releaseKey);renderRelease();}
      else if (edits[key]) {edits[key].dirty=false;render();}
      feedback('已载入当前生效的数据，未保存草稿已放弃。');
    }
    if (button.hasAttribute('data-admin-reset-open')) {find('[data-admin-reset-confirm]').hidden=false;find('[data-admin-reset-cancel]').focus();}
    if (button.hasAttribute('data-admin-reset-cancel')) {find('[data-admin-reset-confirm]').hidden=true;find('[data-admin-reset-open]').focus();}
    if (button.hasAttribute('data-admin-reset-confirm-button') && dispatch({type:'RESET'},'已恢复初始演示数据。')) {
      Object.values(edits).forEach(editor=>{editor.dirty=false;});releaseDrafts.clear();
      find('[data-admin-reset-confirm]').hidden=true;render();find('[data-admin-reset-open]').focus();
    }
  },{signal:abort.signal});

  root.addEventListener('keydown',event=>{
    if (!event.target.matches('[data-admin-tab]')) return;
    const keys=Object.keys(tabNames),index=keys.indexOf(activeTab);
    let next;
    if(event.key==='ArrowRight')next=keys[(index+1)%keys.length];
    if(event.key==='ArrowLeft')next=keys[(index+keys.length-1)%keys.length];
    if(event.key==='Home')next=keys[0];
    if(event.key==='End')next=keys.at(-1);
    if(next){event.preventDefault();setTab(next,true);}
  },{signal:abort.signal});

  render();
  const unsubscribe=store.subscribe(render);
  return () => {destroyed=true;abort.abort();if(typeof unsubscribe==='function')unsubscribe();};
}
