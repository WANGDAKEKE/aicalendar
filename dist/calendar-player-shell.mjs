// A local playback-page layout study. The supplied screenshot is a labelled still
// frame; player controls never start media, record viewing, or change entitlement.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CONFIG=Object.freeze({
  princess:Object.freeze({ip:'princess',title:'尚公主',calendarTitle:'《尚公主》追剧日历',category:'剧集'}),
  zhanshen:Object.freeze({ip:'zhanshen',title:'斩神Ⅱ',calendarTitle:'《斩神Ⅱ》追番日历',category:'动漫'}),
});
const paths={
  back:'<path d="m15 5-7 7 7 7"/>',
  share:'<path d="M12 15V3m-4 4 4-4 4 4M7 11H5v10h14V11h-2"/>',
  cast:'<path d="M3 15V5h18v14H11M3 19h.01M3 15a4 4 0 0 1 4 4M3 11a8 8 0 0 1 8 8"/>',
  play:'<path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/>',
  pause:'<path d="M8 5v14M16 5v14" stroke-width="4"/>',
  expand:'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
  restore:'<path d="M3 9h6V3m6 0v6h6M3 15h6v6m6 0v-6h6"/>',
  down:'<path d="m5 9 7 7 7-7"/>',up:'<path d="m5 15 7-7 7 7"/>',
};
function icon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.down}</svg>`;}
const time=value=>`00:${String(value).padStart(2,'0')}`;
export function getPlayerShellConfig(ip){return CONFIG[typeof ip==='string'&&Object.hasOwn(CONFIG,ip)?ip:'princess'];}

export function renderCalendarPlayerShell({ip='princess'}={}){
  const config=getPlayerShellConfig(ip);
  return `<div class="ply-shell" data-player-shell>
    <section class="ply-player" aria-label="${esc(config.title)}播放页画面示意" data-playing="false">
      <div class="ply-art" data-ip="${config.ip}" role="img" aria-label="${esc(config.title)}原版人物画面示意"></div>
      <div class="ply-topbar"><button type="button" data-shell="back" aria-label="收起日历，返回视频详情">${icon('back')}</button><span class="ply-topbar__spacer"></span><button type="button" data-shell="cast" aria-label="投屏入口示意">${icon('cast')}</button><button type="button" data-shell="share" aria-label="分享本地播放页方案">${icon('share')}</button></div>
      <button type="button" class="ply-center" data-shell="play" aria-label="播放画面示意" aria-pressed="false">${icon('play')}</button>
      <span class="ply-caption">播放页示意</span>
      <div class="ply-controls"><button type="button" data-shell="play" aria-label="播放画面示意" aria-pressed="false">${icon('play')}</button><span class="ply-time" data-ply-elapsed>00:05</span><input type="range" min="0" max="20" step="1" value="5" aria-label="演示进度，非真实播放进度" aria-valuetext="演示进度5秒，共20秒"><span class="ply-time">00:20</span><button type="button" class="ply-fit" data-shell="expand" aria-label="放大演示画面" aria-pressed="false">${icon('expand')}</button></div>
    </section>
    <header class="ply-calendar-bar"><button type="button" data-shell="collapse" aria-expanded="true" aria-label="收起${esc(config.calendarTitle)}"><strong>${esc(config.calendarTitle)}</strong>${icon('down')}</button></header>
    <section class="ply-underlay" aria-label="视频详情页示意"><small>${config.category} · 视频详情</small><h2>${esc(config.title)}</h2><p>收起日历后，回到视频详情。</p><div class="ply-underlay__tabs" aria-hidden="true"><span>简介</span><span>选集</span><span>相关推荐</span></div><button type="button" data-shell="collapse">打开追剧日历 ${icon('down')}</button></section>
  </div>`;
}

export function attachCalendarPlayerShell(app,{ip='princess',onNotice=()=>{},onShare=()=>{}}={}){
  if(!app||app.querySelector('[data-player-shell]'))return null;
  const config=getPlayerShellConfig(ip),nav=app.querySelector('.pc-nav');
  if(!nav)return null;
  nav.insertAdjacentHTML('afterend',renderCalendarPlayerShell({ip:config.ip}));
  const surface=app.querySelector('[data-player-shell]');
  const state={playing:false,position:5,expanded:false,calendarOpen:true};
  function sync(){
    app.dataset.calendarOpen=String(state.calendarOpen);app.dataset.playerExpanded=String(state.expanded);
    surface.querySelector('.ply-player').dataset.playing=String(state.playing);
    for(const button of surface.querySelectorAll('[data-shell="play"]')){button.innerHTML=icon(state.playing?'pause':'play');button.setAttribute('aria-pressed',String(state.playing));button.setAttribute('aria-label',state.playing?'暂停画面示意':'播放画面示意');}
    const expand=surface.querySelector('[data-shell="expand"]');expand.innerHTML=icon(state.expanded?'restore':'expand');expand.setAttribute('aria-pressed',String(state.expanded));expand.setAttribute('aria-label',state.expanded?'恢复画面比例':'放大演示画面');
    const bar=surface.querySelector('.ply-calendar-bar button');bar.setAttribute('aria-expanded',String(state.calendarOpen));bar.setAttribute('aria-label',`${state.calendarOpen?'收起':'展开'}${config.calendarTitle}`);bar.querySelector('svg').outerHTML=icon(state.calendarOpen?'down':'up');
    surface.querySelector('[data-ply-elapsed]').textContent=time(state.position);
    const range=surface.querySelector('input');range.value=String(state.position);range.setAttribute('aria-valuetext',`演示进度${state.position}秒，共20秒`);
  }
  function handleClick(event){
    const button=event.target.closest('button[data-shell]');if(!button||!surface.contains(button))return;
    event.stopPropagation();
    switch(button.dataset.shell){
      case 'play':state.playing=!state.playing;sync();onNotice('播放控件状态演示，未连接真实视频');break;
      case 'expand':state.expanded=!state.expanded;sync();break;
      case 'collapse':state.calendarOpen=!state.calendarOpen;sync();break;
      case 'back':if(state.calendarOpen){state.calendarOpen=false;sync();}else onNotice('当前为独立播放页原型');break;
      case 'cast':onNotice('投屏入口示意，未连接任何设备');break;
      case 'share':onShare();break;
    }
  }
  function handleInput(event){if(!event.target.matches('input[type="range"]'))return;const value=Number(event.target.value);state.position=Number.isFinite(value)?Math.max(0,Math.min(20,Math.round(value))):5;sync();}
  surface.addEventListener('click',handleClick);surface.addEventListener('input',handleInput);sync();
  return {surface,setModalOpen(open){surface.inert=Boolean(open);},destroy(){surface.removeEventListener('click',handleClick);surface.removeEventListener('input',handleInput);surface.remove();delete app.dataset.calendarOpen;delete app.dataset.playerExpanded;}};
}
