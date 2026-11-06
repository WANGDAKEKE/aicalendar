// Historical membership screenshots are presentation assets, not account,
// pricing, checkout or entitlement data. Only these two known transitions map
// to the supplied references; the renderer accepts their exact frozen config.
const CONFIG=Object.freeze({
  vip:Object.freeze({
    variant:'vip',accountTier:'free',targetTier:'vip',title:'VIP开通页',
    src:'./assets/princess/membership-vip-plans.jpg',
    sourceWidth:393,sourceHeight:705,cropTop:0,
  }),
  svip:Object.freeze({
    variant:'svip',accountTier:'vip',targetTier:'svip',title:'SVIP开通页',
    src:'./assets/princess/membership-svip-reference.jpg',
    sourceWidth:1216,sourceHeight:2688,cropTop:900,
  }),
});

export function getPrincessMembershipPreview(accountTier,targetTier){
  if(accountTier==='free'&&targetTier==='vip')return CONFIG.vip;
  if(accountTier==='vip'&&targetTier==='svip')return CONFIG.svip;
  return null;
}

const close='<path d="m6 6 12 12M18 6 6 18"/>';

export function renderPrincessMembershipPreview(config){
  if(config!==CONFIG.vip&&config!==CONFIG.svip)return '';
  const isVIP=config.variant==='vip';
  const button=`<button type="button" class="pmp-close" data-action="close" data-membership-close aria-label="返回追剧日历"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${close}</svg></button>`;
  const spacer='<span class="pmp-toolbar__spacer" aria-hidden="true"></span>';
  const account=isVIP?'<div class="pmp-account"><strong>腾讯网友</strong><p>您没开通过腾讯视频VIP</p></div>':'';
  return `<section class="pmp-preview" data-membership-variant="${config.variant}" aria-label="${config.title}截图预览">
    <header class="pmp-toolbar">${spacer}<h3>${config.title}</h3>${button}</header>
    <small class="pmp-disclaimer">截图示意 · 非实时价格 · 不支付</small>
    <div class="pmp-image-scroll" role="region" tabindex="0" aria-label="${config.title}历史截图，可上下滚动查看">
      ${account}
      <div class="pmp-image-crop"><img class="pmp-reference-image" src="${config.src}" width="${config.sourceWidth}" height="${config.sourceHeight}" draggable="false" alt="${config.title}历史截图，截图中的用户名、账号状态和套餐仅为界面示意，非当前真实账号、非实时价格，不可支付"></div>
    </div>
  </section>`;
}
