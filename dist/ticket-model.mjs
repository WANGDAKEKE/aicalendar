import {getBadgeProgress} from './badge-model.mjs';

export const ticketLevels=Object.freeze([
  Object.freeze({level:1,episode:10,name:'初程票',finish:'paper'}),
  Object.freeze({level:2,episode:18,name:'同行票',finish:'foil'}),
  Object.freeze({level:3,episode:30,name:'典藏票',finish:'holo'}),
]);

function orderedLevels(levels) {
  if(!Array.isArray(levels)||![...levels].every(item=>item&&Number.isSafeInteger(item.level)&&item.level>0&&Number.isSafeInteger(item.episode)&&item.episode>0&&item.episode<=30)){
    throw new RangeError('Ticket levels require positive integer levels and episode targets from 1 to 30.');
  }
  const ordered=[...levels].sort((a,b)=>a.level-b.level);
  if(ordered.some((item,index)=>index>0&&(item.level===ordered[index-1].level||item.episode<=ordered[index-1].episode))){
    throw new RangeError('Ticket levels and episode targets must increase together.');
  }
  return ordered;
}

// A ticket grows only when every episode through a level's target is complete.
// Total viewing count and progress toward the next level are deliberately separate.
export function getTicketProgress(completed = [], levels = ticketLevels) {
  const history=completed!=null&&typeof completed[Symbol.iterator]==='function'?[...completed]:[];
  const watched=new Set(history.filter(episode=>Number.isSafeInteger(episode)&&episode>=1&&episode<=30));
  const stages=orderedLevels(levels).map(level=>({level,progress:getBadgeProgress(level,watched)}));
  const current=stages.findLast(stage=>stage.progress.unlocked)?.level||null;
  const upcoming=stages.find(stage=>!stage.progress.unlocked);
  return {
    current,next:upcoming?.level||null,currentLevel:current?.level||0,
    watchedCount:watched.size,nextProgress:upcoming?.progress||null,
  };
}

export function getTicketUpgrade(before, after) {
  const previous=getTicketProgress(before),current=getTicketProgress(after);
  return current.currentLevel>previous.currentLevel?current.current:null;
}

const rewardScenarios=Object.freeze({
  near:{count:9,date:'2026-10-15',focusDate:'2026-10-14'},
  first:{count:10,date:'2026-10-15',focusDate:'2026-10-14'},
  second:{count:18,date:'2026-10-18',focusDate:'2026-10-18'},
  final:{count:30,date:'2026-10-27',focusDate:'2026-10-27'},
});

// Explicit presentation scenarios only. This does not alter account entitlement
// or the shared demo clock; the caller decides whether to enter a scenario.
export function getRewardDemoScenario(key) {
  if(typeof key!=='string'||!Object.hasOwn(rewardScenarios,key))return null;
  const scenario=rewardScenarios[key];
  return {
    now:`${scenario.date}T19:00:00+08:00`,
    completed:Array.from({length:scenario.count},(_,index)=>index+1),
    focusDate:scenario.focusDate,
  };
}
