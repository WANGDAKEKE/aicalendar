// The comparison shell only changes iframe URLs. All playback and reward state
// belongs to each demo; no cross-frame DOM access, messaging or storage is used.
const scenarios=Object.freeze({
  near:{date:'10 月 15 日',description:'距首个奖励还差 1 集',celebrate:false},
  first:{date:'10 月 15 日',description:'获得首个奖励 · 电子票初次点亮',celebrate:true},
  second:{date:'10 月 18 日',description:'到达下一程 · 升级同行票',celebrate:true},
  final:{date:'10 月 27 日',description:'追完全部剧集 · 升级典藏票',celebrate:true},
});
const scenarioButtons=[...document.querySelectorAll('[data-scenario]')];
const viewButtons=[...document.querySelectorAll('[data-view]')];
const variants=[...document.querySelectorAll('[data-variant]')];
const viewport=document.getElementById('comparisonViewport');
const frames={badge:document.getElementById('badgeFrame'),ticket:document.getElementById('ticketFrame')};
const validScenario=value=>Object.hasOwn(scenarios,value)?value:'near';

function frameUrl(reward,scenario){
  const url=new URL('./index.html',location.href);
  url.searchParams.set('v','2.7.0');
  url.searchParams.set('skin','lychee');
  url.searchParams.set('embed','1');
  url.searchParams.set('reward',reward);
  url.searchParams.set('rewardDemo',scenario);
  if(scenarios[scenario].celebrate)url.searchParams.set('celebrate','1');
  url.hash='calendar';
  return url.href;
}

function selectScenario(value,{reload=true,updateUrl=true}={}){
  const scenario=validScenario(value),metadata=scenarios[scenario];
  for(const button of scenarioButtons){
    button.setAttribute('aria-pressed',String(button.dataset.scenario===scenario));
  }
  document.getElementById('scenarioStatus').textContent=`模拟 ${metadata.date} · ${metadata.description}`;
  for(const [reward,frame] of Object.entries(frames)){
    const target=frameUrl(reward,scenario);
    if(reload||frame.src!==target)frame.src=target;
  }
  if(updateUrl){
    const url=new URL(location.href);
    url.searchParams.set('rewardDemo',scenario);
    history.replaceState(history.state,'',url);
  }
}

function selectView(value){
  for(const button of viewButtons){
    button.setAttribute('aria-pressed',String(button.dataset.view===value));
  }
}

function focusVariant(value){
  const variant=variants.find(item=>item.dataset.variant===value);
  if(!variant)return;
  const left=viewport.scrollLeft+variant.getBoundingClientRect().left-viewport.getBoundingClientRect().left-(viewport.clientWidth-variant.clientWidth)/2;
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  viewport.scrollTo({left,behavior:reducedMotion?'auto':'smooth'});
  selectView(value);
}

for(const button of scenarioButtons){
  button.addEventListener('click',()=>selectScenario(button.dataset.scenario));
}
for(const button of viewButtons){
  button.addEventListener('click',()=>focusVariant(button.dataset.view));
}
viewport.addEventListener('scroll',()=>{
  const center=viewport.getBoundingClientRect().left+viewport.clientWidth/2;
  const nearest=variants.reduce((best,item)=>{
    const rect=item.getBoundingClientRect(),distance=Math.abs(rect.left+rect.width/2-center);
    return !best||distance<best.distance?{item,distance}:best;
  },null);
  if(nearest)selectView(nearest.item.dataset.variant);
},{passive:true});
window.addEventListener('popstate',()=>{
  selectScenario(new URLSearchParams(location.search).get('rewardDemo'),{updateUrl:false});
});
selectScenario(new URLSearchParams(location.search).get('rewardDemo'),{reload:false,updateUrl:false});
