import {releaseTime} from './calendar-model.mjs';

const validEpisode=episode=>Number.isSafeInteger(episode)&&episode>0;
const findRelease=(episode,releases)=>releases.find(release=>validEpisode(release?.from)&&validEpisode(release?.to)&&release.from<=episode&&episode<=release.to)||null;

function requiredEpisodes(item) {
  if(!validEpisode(item?.episode))throw new RangeError('Editorial episode must be a positive integer.');
  if(item.requiresEpisodes===undefined)return Array.from({length:item.episode},(_,index)=>index+1);
  if(!Array.isArray(item.requiresEpisodes)||item.requiresEpisodes.length===0||![...item.requiresEpisodes].every(episode=>validEpisode(episode)&&episode<=item.episode)){
    throw new RangeError('Editorial requirements must be nonempty positive episode numbers up to its episode.');
  }
  return [...new Set(item.requiresEpisodes)].sort((a,b)=>a-b);
}

// Only return eligibility metadata. The caller must not reveal editorial content
// before status is ready, even if local watch history claims a future completion.
export function getEditorialState(item, {releases=[],now,completed=[]} = {}) {
  const required=requiredEpisodes(item);
  const schedule=Array.isArray(releases)?releases:[];
  const release=findRelease(item.episode,schedule);
  const time=typeof now==='string'||typeof now==='number'||now instanceof Date?new Date(now).getTime():NaN;
  if(!release||!Number.isFinite(time)||!Number.isFinite(releaseTime(release)))return {release,status:'unavailable',nextEpisode:null};
  if(releaseTime(release)>time)return {release,status:'upcoming',nextEpisode:null};

  const history=completed!=null&&typeof completed[Symbol.iterator]==='function'?[...completed]:[];
  const watched=new Set(history.filter(validEpisode));
  const missing=required.find(episode=>!watched.has(episode));
  if(missing===undefined)return {release,status:'ready',nextEpisode:null};
  const missingRelease=findRelease(missing,schedule);
  const nextEpisode=missingRelease&&releaseTime(missingRelease)<=time?missing:null;
  return {release,status:'locked',nextEpisode};
}
