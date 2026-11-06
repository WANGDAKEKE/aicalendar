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
    // One limited-free campaign applies to every identity; legacy preview
    // options cannot select a different activity or a fabricated paid schedule.
    previewTier:'free',
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
  return normalize({...base,accountTier});
}

function marketingFor(accountTier){
  if(accountTier==='svip')return {...OPERATIONS_COPY,kind:'none',tier:null,cta:''};
  const tier=accountTier==='free'?'vip':'svip';
  return {...OPERATIONS_COPY,kind:'membership',tier,cta:`升级${TIERS[tier]}`};
}

function scheduleFor(session){
  const schedule=selectZhanshenCalendar(session);
  return {
    ...schedule,scheduleType:'limited-free',audience:'all',scheduleKnown:true,
    availableEpisodes:[],nextEpisode:null,
    scheduleNote:`${schedule.scheduleNote}这是面向所有身份的限免活动排期，不是会员排播或播放授权；回锁表示限免结束，不代表撤销已具备的会员观看权限。`,
  };
}

export function selectZhanshenRefineCalendar(input){
  const session=normalize(input);
  const actual=selectZhanshenCalendar(session);
  return {
    ...actual,accountTier:session.accountTier,previewTier:'free',isPreview:false,
    // Screenshot dates describe a campaign, not a known playable episode set.
    availableEpisodes:[],nextEpisode:null,
    marketing:marketingFor(session.accountTier),schedule:scheduleFor(session),
  };
}

export function setZhanshenRefinePreview(input,_tier){
  // Compatibility only: this no longer changes the common campaign, account,
  // ticket history or unknown viewing authorization.
  return normalize(input);
}

export function shiftZhanshenRefinePeriod(input,delta){
  const session=normalize(input);
  return {...session,...shiftZhanshenPeriod(session,delta)};
}

export function switchZhanshenRefineMode(input,mode){
  const session=normalize(input);
  return {...session,...switchZhanshenMode(session,mode)};
}
