import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {getPrincessMembershipPreview,renderPrincessMembershipPreview} from '../dist/princess-membership-preview.mjs';

const read=file=>readFileSync(new URL(`../dist/${file}`,import.meta.url));
const source=read('princess-membership-preview.mjs').toString('utf8');
const css=read('princess-membership-preview.css').toString('utf8');
const configs={vip:getPrincessMembershipPreview('free','vip'),svip:getPrincessMembershipPreview('vip','svip')};

test('only the exact free-to-VIP and VIP-to-SVIP transitions have fixed, frozen preview configuration',()=>{
  for(const [accountTier,targetTier,variant] of [['free','vip','vip'],['vip','svip','svip']]){
    const config=getPrincessMembershipPreview(accountTier,targetTier);
    assert.ok(Object.isFrozen(config));
    assert.equal(config,configs[variant]);
    assert.equal(config.accountTier,accountTier);
    assert.equal(config.targetTier,targetTier);
    assert.equal(config.variant,variant);
    assert.equal(config.title,`${variant.toUpperCase()}开通页`);
    assert.equal(config.src,variant==='vip'?'./assets/princess/membership-vip-plans.jpg':'./assets/princess/membership-svip-reference.jpg');
    assert.equal(config.sourceWidth,variant==='vip'?393:1216);
    assert.equal(config.sourceHeight,variant==='vip'?705:2688);
  }
  for(const account of ['free','vip','svip'])for(const target of ['free','vip','svip']){
    if(account==='free'&&target==='vip'||account==='vip'&&target==='svip')continue;
    assert.equal(getPrincessMembershipPreview(account,target),null,`${account} → ${target} must not borrow another account's screenshot or price`);
  }
});

test('unsafe inputs, prototype names, copied configs and arbitrary image sources cannot enter the renderer',()=>{
  for(const value of ['__proto__','constructor','toString','VIP','',null,undefined,{},[],Symbol('vip')]){
    assert.equal(getPrincessMembershipPreview(value,'vip'),null);
    assert.equal(getPrincessMembershipPreview('vip',value),null);
    assert.equal(renderPrincessMembershipPreview(value),'');
  }
  for(const variant of ['vip','svip']){
    for(const fake of [{...configs[variant]},{variant},{variant,src:'https://untrusted.example/payment'},{...configs[variant],src:'"><img src=x onerror="bad">'},Object.create(configs[variant])])assert.equal(renderPrincessMembershipPreview(fake),'');
  }
});

test('each preview has one native-style return control, an explicit historical-price disclaimer and inert screenshot art',()=>{
  for(const [variant,config] of Object.entries(configs)){
    const html=renderPrincessMembershipPreview(config);
    assert.match(html,new RegExp(`data-membership-variant="${variant}"`));
    assert.match(html,new RegExp(`<h3>${variant.toUpperCase()}开通页<\\/h3>`));
    assert.match(html,/截图示意 · 非实时价格 · 不支付/);
    assert.equal((html.match(/<button\b/g)||[]).length,1);
    assert.match(html,/<button\b[^>]*type="button"[^>]*data-action="close"[^>]*data-membership-close[^>]*aria-label="返回追剧日历"/);
    assert.equal((html.match(/<img\b/g)||[]).length,1);
    assert.match(html,new RegExp(`<img\\b[^>]*width="${config.sourceWidth}"[^>]*height="${config.sourceHeight}"[^>]*draggable="false"[^>]*alt="[^"]*非当前真实账号、非实时价格，不可支付"`));
    assert.match(html,/class="pmp-image-scroll"[^>]*role="region"[^>]*tabindex="0"/);
    assert.doesNotMatch(html,/<a\b|\bhref=|<form\b|<input\b|<iframe\b|<video\b|<script\b|data-target-tier|data-action="(?:confirm|membership|pay)/);
    const toolbar=html.match(/<header class="pmp-toolbar">([\s\S]*?)<\/header>/)[1];
    assert.ok(toolbar.indexOf('<button')>toolbar.indexOf('</h3>'),`${variant.toUpperCase()} has the same right close button`);
    assert.match(toolbar,/<path d="m6 6 12 12M18 6 6 18"/,'both variants use an X instead of a full-page back control');
  }
});

test('the VIP preview replaces the entire source account area with a generic account block',()=>{
  const html=renderPrincessMembershipPreview(configs.vip);
  assert.match(html,/<div class="pmp-account"><strong>腾讯网友<\/strong><p>您没开通过腾讯视频VIP<\/p><\/div>/);
  assert.ok(html.indexOf('class="pmp-account"')<html.indexOf('class="pmp-image-crop"'));
  assert.doesNotMatch(renderPrincessMembershipPreview(configs.svip),/class="pmp-account"/,'the SVIP reference already uses the same generic nickname');
  assert.match(css,/\.pmp-account\s*\{[^}]*background:\s*#f5f5f7/);
});

test('published preview assets have the expected formats, dimensions and exact byte signatures',()=>{
  const expected={vip:'fe00b0ab21e4c107ad0898876b4615140c95ad35753a08e62ab588cc2461a3e8',svip:'4276a3fb67707d535b9a8ce2c87357692591e52b0cd58523fb23acc0ce2b0639'};
  for(const variant of ['vip','svip']){
    const config=configs[variant],bytes=read(config.src.replace(/^\.\//,''));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),expected[variant]);
    assert.deepEqual([...bytes.subarray(0,2)],[0xff,0xd8]);
    assert.ok(bytes.length>(variant==='vip'?10000:100000));
    let dimensions=null;
    for(let offset=2;offset<bytes.length;){
      assert.equal(bytes[offset],0xff);
      while(bytes[offset]===0xff)offset++;
      const marker=bytes[offset++];
      if(marker===0xd9||marker===0xda)break;
      if(marker===0x01||marker>=0xd0&&marker<=0xd7)continue;
      const length=bytes.readUInt16BE(offset);
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
        dimensions={width:bytes.readUInt16BE(offset+5),height:bytes.readUInt16BE(offset+3)};break;
      }
      offset+=length;
    }
    assert.deepEqual(dimensions,{width:config.sourceWidth,height:config.sourceHeight});
  }
});

test('all refinement layouts share VIP and SVIP white-sheet geometry without leaking styles to retained pages',()=>{
  const clean=css.replace(/\/\*[\s\S]*?\*\//g,'');
  for(const [,selectors] of clean.matchAll(/([^{}]+)\{[^{}]*\}/g)){
    if(selectors.trim().startsWith('@media'))continue;
    for(const selector of selectors.split(',')){
      // Commas inside safe-area env() occur only in declarations, not here.
      assert.ok(selector.trim().startsWith('.pcr-page '),`unscoped selector: ${selector.trim()}`);
    }
  }
  assert.doesNotMatch(clean,/pc-playback-layout|pc-playback-full-hero|:not\(/,'full-screen, compact-player and full-hero-player refinements use the same membership preview styles');
  assert.match(clean,/\[data-membership-preview="vip"\]\s*\{[^}]*height:\s*74%;[^}]*max-height:\s*74%;[^}]*border-radius:\s*16px 16px 0 0/);
  assert.match(clean,/\[data-membership-preview="svip"\]\s*\{[^}]*height:\s*74%;[^}]*max-height:\s*74%;[^}]*border-radius:\s*16px 16px 0 0/);
  assert.match(clean,/\[data-membership-preview\]\s*>\s*header\s*\{\s*display:\s*none/);
  assert.match(clean,/\.pc-sheet__body\s*\{[^}]*height:\s*100%;[^}]*margin:\s*0;[^}]*padding:\s*0;[^}]*overflow:\s*hidden/);
  assert.match(clean,/\.pmp-preview\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*height:\s*100%/);
  assert.match(clean,/\.pmp-toolbar\s*\{[^}]*flex:\s*0 0 44px;[^}]*min-height:\s*44px/);
  assert.match(clean,/\.pmp-image-scroll\s*\{[^}]*flex:\s*1;[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto/);
  assert.match(clean,/\.pmp-reference-image\s*\{[^}]*pointer-events:\s*none/);
  assert.doesNotMatch(clean,/padding-top:\s*56px|safe-area-inset-top|\.pc-status|z-index:\s*8|@media/,'neither variant uses full-page status bar compensation or a mobile-only full-page override');
});

test('width-relative cropping removes source account details and the unrelated SVIP video ad without editing the assets',()=>{
  assert.equal(configs.vip.cropTop,0,'the public VIP plans asset contains no original account area');
  assert.match(css,/\[data-membership-preview="vip"\]\s+\.pmp-reference-image\s*\{\s*margin:\s*0\s*;/);
  assert.doesNotMatch(source,/membership-vip-reference\.jpg/,'the private original VIP screenshot must not enter the publication dependency closure');
  for(const [variant,crop] of [['svip',900]]){
    const rule=css.match(new RegExp(`\\[data-membership-preview="${variant}"\\]\\s+\\.pmp-reference-image\\s*\\{\\s*margin:\\s*(-[\\d.]+)% 0 0`));
    assert.ok(rule);
    assert.ok(Math.abs(Number(rule[1])*-1216/100-crop)<0.00001);
    assert.equal(configs[variant].cropTop,crop);
  }
  assert.ok(configs.svip.cropTop>803,'the entire unrelated source video/ad area is outside the viewport');
  assert.match(css,/\.pmp-image-crop\s*\{[^}]*overflow:\s*hidden/);
  assert.doesNotMatch(css,/background-image|object-fit:\s*cover|\btransform\s*:|filter\s*:/);
});

test('this presentational module owns no checkout, agreement, account, history or external side effects',()=>{
  assert.doesNotMatch(source,/\bimport\b|https?:\/\/|\b(?:fetch|XMLHttpRequest|WebSocket|Notification|localStorage|sessionStorage|indexedDB)\b/);
  assert.doesNotMatch(source,/document\.|window\.|navigator\.|createElement|addEventListener|accountTier\s*=(?!=)|completed\s*\.\s*add|data-pay|data-finish|data-play/);
  assert.doesNotMatch(css,/https?:\/\/|@import|url\(/);
});
