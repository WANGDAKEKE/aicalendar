import {getSummary} from './calendar-model.mjs';

const ranks=Object.freeze({free:0,vip:1,svip:2});
const knownTier=tier=>typeof tier==='string'&&Object.hasOwn(ranks,tier);

// Previewing a different schedule never changes the account's playback scope.
export function getTierContext(drama, accountTier, previewTier, now) {
  const account=getSummary(drama,knownTier(accountTier)?accountTier:'free',now);
  const selected=knownTier(previewTier)&&Object.hasOwn(drama.scheduleByTier,previewTier)?previewTier:account.tier;
  const preview=getSummary(drama,selected,now);
  return {
    account,preview,
    requiresUpgrade:ranks[preview.tier]>ranks[account.tier],
    extraAvailable:Math.max(0,preview.available-account.available),
  };
}
