import {
  createZhanshenSession,
  selectZhanshenCalendar,
  shiftZhanshenPeriod,
  switchZhanshenMode,
} from './zhanshen-calendar-model.mjs';

const TIERS=Object.freeze({free:'非VIP',vip:'VIP',svip:'SVIP'});
const OPERATIONS_COPY=Object.freeze({title:'每周四限免更新',subtitle:'12月3日第2–15集回锁会员'});
const BASE_FIELDS=['today','mode','weekStart','month','selectedDate','completed'];
const own=(value,key)=>Object.hasOwn(value,key);
const record=value=>value&&typeof value==='object'?value:{};
const validTier=tier=>typeof tier==='string'&&own(TIERS,tier);
const resolveTier=tier=>validTier(tier)?tier:'free';

function normalize(input){
  const source=record(input);
  const baseInput=Object.fromEntries(BASE_FIELDS.filter(key=>own(source,key)).map(key=>[key,source[key]]));
  const base=shiftZhanshenPeriod(baseInput,0);
  const accountTier=own(source,'accountTier')&&source.accountTier!==undefined?resolveTier(source.accountTier):'vip';
  return {
    ...base,accountTier,
    previewTier:own(source,'previewTier')&&validTier(source.previewTier)?source.previewTier:accountTier,
    reminded:own(source,'reminded')&&source.reminded===true,
    widgetPreviewed:own(source,'widgetPreviewed')&&source.widgetPreviewed===true,
  };
}

export function createZhanshenRefineSession(options={}){
  const source=record(options);
  const base=createZhanshenSession({
    today:own(source,'today')?source.today:undefined,
    mode:own(source,'mode')?source.mode:undefined,
  });
  const accountTier=own(source,'tier')&&source.tier!==undefined?resolveTier(source.tier):'vip';
  return normalize({...base,accountTier,previewTier:own(source,'previewTier')?source.previewTier:accountTier});
}

function marketingFor(accountTier){
  if(accountTier==='svip')return {...OPERATIONS_COPY,kind:'none',tier:null,cta:''};
  const tier=accountTier==='free'?'vip':'svip';
  return {...OPERATIONS_COPY,kind:'membership',tier,cta:`升级${TIERS[tier]}`};
}

function scheduleFor(session){
  const schedule=selectZhanshenCalendar(session);
  const shared={...schedule,accountTier:session.previewTier,previewTier:session.previewTier,availableEpisodes:[],nextEpisode:null};
  if(session.previewTier==='free')return {...shared,scheduleKnown:true};
  // No VIP or SVIP release schedule was supplied. Do not reuse the limited-free
  // batches as membership releases or infer actual viewing authorization.
  const days=schedule.days.map(day=>({...day,event:null}));
  return {
    ...shared,days,cells:days,events:[],selectedEvent:null,
    selectedDay:days.find(day=>day.date===schedule.selectedDate)||null,
    todayEvent:null,latestEvent:null,nextEvent:null,scheduleKnown:false,
    scheduleNote:`${TIERS[session.previewTier]}会员排期待公布；当前仅有运营公布的限免排期，未提供会员排播，不作播放授权判断。`,
  };
}

export function selectZhanshenRefineCalendar(input){
  const session=normalize(input);
  const actual=selectZhanshenCalendar(session);
  return {
    ...actual,accountTier:session.accountTier,previewTier:session.previewTier,
    isPreview:session.previewTier!==session.accountTier,
    // Screenshot dates describe a campaign, not a known playable episode set.
    availableEpisodes:[],nextEpisode:null,
    marketing:marketingFor(session.accountTier),schedule:scheduleFor(session),
  };
}

export function setZhanshenRefinePreview(input,tier){
  const session=normalize(input);
  return {...session,previewTier:validTier(tier)?tier:session.accountTier};
}

export function shiftZhanshenRefinePeriod(input,delta){
  const session=normalize(input);
  return {...session,...shiftZhanshenPeriod(session,delta)};
}

export function switchZhanshenRefineMode(input,mode){
  const session=normalize(input);
  return {...session,...switchZhanshenMode(session,mode)};
}
