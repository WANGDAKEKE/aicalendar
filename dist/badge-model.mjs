function badgeTarget(badge) {
  if(!Number.isSafeInteger(badge?.episode)||badge.episode<1)throw new RangeError('Badge episode must be a positive integer.');
  return badge.episode;
}

// A milestone requires every episode up to its target, not just the target itself.
export function getBadgeProgress(badge, completed = []) {
  const total=badgeTarget(badge);
  const watched=new Set([...completed].filter(episode=>Number.isSafeInteger(episode)&&episode>0&&episode<=total));
  let nextEpisode=null;
  for(let episode=1;episode<=total;episode++){
    if(!watched.has(episode)){nextEpisode=episode;break;}
  }
  return {watchedCount:watched.size,total,remaining:total-watched.size,unlocked:watched.size===total,nextEpisode};
}

// Pass the account's resolved releases; a badge never borrows another tier's date.
export function getBadgeRelease(badge, releases) {
  const episode=badgeTarget(badge);
  return releases.find(release=>Number.isSafeInteger(release.from)&&Number.isSafeInteger(release.to)&&release.from<=episode&&episode<=release.to)||null;
}

export function newlyUnlockedBadges(badges, beforeCompleted, afterCompleted) {
  return badges.filter(badge=>!getBadgeProgress(badge,beforeCompleted).unlocked&&getBadgeProgress(badge,afterCompleted).unlocked);
}
