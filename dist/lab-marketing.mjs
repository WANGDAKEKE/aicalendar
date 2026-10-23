import {getSummary,releaseTime} from './calendar-model.mjs';

// Promotions are only invitations: never merge an event into playback rights.
export function selectMarketing({drama,user,now,campaign}) {
  if(!campaign.enabled)return null;
  const current=getSummary(drama,user.tier,now);
  const event=campaign.screeningEnabled?(drama.screeningEvents||[]).find(event=>{
    const end=releaseTime({...event,time:event.endTime});
    return Number.isFinite(end)&&end>Date.parse(now)&&(!event.tiers||event.tiers.includes(user.tier));
  }):null;
  const target=user.tier==='free'?'vip':user.tier==='vip'?'svip':null;
  const upgrade=target?getSummary(drama,target,now):null;
  const extra=upgrade?Math.max(0,upgrade.available-current.available):0;
  const primaryEvent=event&&(campaign.mode==='screening'||(!target&&campaign.mode==='auto'));
  if(primaryEvent)return {kind:'screening',event,title:`大结局点映礼 · 提前赴约`,caption:`${event.date.slice(5).replace('-','月')}日 ${event.time} · 资格需单独获取`,button:'了解活动'};
  if(target&&campaign.mode!=='screening')return {kind:'membership',target,available:upgrade.available,extra,title:extra>0?`${drama.tiers[target]} 今日可看至第 ${upgrade.available} 集`:`${drama.tiers[target]}，先一步追好剧`,caption:extra>0?`比当前权益多看 ${extra} 集 · 解锁更多精彩`:'查看会员专属排期与权益',button:user.tier==='free'?'开通 VIP':'升级 SVIP',event};
  return null;
}
