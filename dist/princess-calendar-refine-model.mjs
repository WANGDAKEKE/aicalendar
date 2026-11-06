import {dateKey,parseDate} from './calendar-model.mjs';
import {
  princessDrama,
  createPrincessSession,
  selectPrincessCalendar,
  shiftPrincessPeriod,
  switchPrincessMode,
} from './princess-calendar-model.mjs';

// This adapter adds a presentation-only calendar preview. Playback scope,
// ticket progress and viewing history always come from the real account.
const own=(value,key)=>Object.hasOwn(value,key);
const record=value=>value&&typeof value==='object'?value:{};
const validTier=tier=>typeof tier==='string'&&own(princessDrama.tiers,tier);
const BASE_FIELDS=['accountTier','now','completed','mode','weekStart','month','selectedDate'];
const OPERATIONS_COPY=Object.freeze({title:'会员每日18点更新',subtitle:'SVIP抢先看1集'});

function normalize(input){
  const source=record(input);
  const baseInput=Object.fromEntries(BASE_FIELDS.filter(key=>own(source,key)).map(key=>[key,source[key]]));
  const base=shiftPrincessPeriod(baseInput,0);
  return {
    ...base,
    previewTier:own(source,'previewTier')&&validTier(source.previewTier)?source.previewTier:base.accountTier,
    reminded:own(source,'reminded')&&source.reminded===true,
    widgetPreviewed:own(source,'widgetPreviewed')&&source.widgetPreviewed===true,
  };
}

export function createPrincessRefineSession(options={}){
  const source=record(options);
  const base=createPrincessSession({
    tier:own(source,'tier')?source.tier:'vip',
    now:own(source,'now')?source.now:undefined,
  });
  return normalize({...base,previewTier:own(source,'previewTier')?source.previewTier:base.accountTier});
}

function marketingFor(actual,previewTier){
  if(actual.accountTier==='free'){
    if(previewTier==='free')return {
      ...OPERATIONS_COPY,kind:'preview',tier:'vip',cta:'看VIP排期',
    };
    const name=princessDrama.tiers[previewTier];
    return {
      ...OPERATIONS_COPY,kind:'membership',tier:previewTier,cta:`开通${name}`,
    };
  }
  if(actual.accountTier==='vip'){
    return {
      ...OPERATIONS_COPY,kind:'membership',tier:'svip',cta:'升级SVIP',
    };
  }
  return {...OPERATIONS_COPY,kind:'none',tier:null,cta:''};
}

export function selectPrincessRefineCalendar(input){
  const session=normalize(input);
  const actual=selectPrincessCalendar(session);
  return {
    ...actual,
    previewTier:session.previewTier,
    isPreview:session.previewTier!==actual.accountTier,
    // Only the nested projection may show another membership's schedule.
    schedule:selectPrincessCalendar({...session,accountTier:session.previewTier}),
    marketing:marketingFor(actual,session.previewTier),
  };
}

export function setPrincessRefinePreview(input,tier){
  const session=normalize(input);
  return {...session,previewTier:validTier(tier)?tier:session.accountTier};
}

export function shiftPrincessRefinePeriod(input,delta){
  const session=normalize(input);
  return {...session,...shiftPrincessPeriod(session,delta)};
}

export function switchPrincessRefineMode(input,mode){
  const session=normalize(input);
  return {...session,...switchPrincessMode(session,mode)};
}

export function resetPrincessRefineToday(input){
  const session=normalize(input);
  const today=selectPrincessCalendar(session).today;
  const monday=parseDate(today);
  monday.setUTCDate(monday.getUTCDate()-((monday.getUTCDay()+6)%7));
  return {...session,selectedDate:today,weekStart:dateKey(monday),month:today.slice(0,7)};
}
