// Dependency-free, deliberately narrow exporter for the two approved calendar
// prototypes. Source pages stay untouched; generated documents need no server.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,relative,dirname,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';

const workspace=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const defaultDist=resolve(workspace,'dist');
const mimeTypes={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml','.woff2':'font/woff2'};
const frames=[
  {id:'review-princess-full',ip:'princess',query:'?presentation=embedded&entry=widget'},
  {id:'review-princess-player',ip:'princess',query:'?presentation=embedded&entry=widget&layout=player'},
  {id:'review-princess-player-fullhero',ip:'princess',query:'?presentation=embedded&entry=widget&layout=player&hero=full'},
  {id:'review-zhanshen-full',ip:'zhanshen',query:'?presentation=embedded'},
  {id:'review-zhanshen-player',ip:'zhanshen',query:'?presentation=embedded&layout=player'},
  {id:'review-zhanshen-player-fullhero',ip:'zhanshen',query:'?presentation=embedded&layout=player&hero=full'},
];
const csp="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-src about:; connect-src 'none'; font-src data:; base-uri 'none'; form-action 'none'";
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const safeScript=value=>value.replace(/<\/script/gi,'<\\/script');
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function within(root,path){
  const full=resolve(root,path),child=relative(root,full);
  if(child.startsWith(`..${sep}`)||child==='..'||child.startsWith(sep))throw new Error(`Outside export source: ${path}`);
  return full;
}

// Current sources use only named local imports and named function/const exports.
// Fail closed if that contract changes; do not silently produce a broken file.
function bundleModule(entry,distDir,inlineAssets){
  const modules=new Map(),visiting=new Set();
  function visit(file){
    const full=within(distDir,file),id=relative(distDir,full).split(sep).join('/');
    if(visiting.has(id))throw new Error(`Cyclic module not supported: ${id}`);
    if(modules.has(id))return id;
    visiting.add(id);
    let source=readFileSync(full,'utf8');
    source=source.replace(/^import\s*\{([^}]+)\}\s*from\s*(['"])(\.\/?[^'"]+)\2\s*;?/gm,(_all,bindings,_quote,specifier)=>{
      const dependency=visit(relative(distDir,resolve(dirname(full),specifier)));
      const names=bindings.split(',').map(value=>value.trim()).filter(Boolean).map(value=>{
        if(!/^[A-Za-z_$][\w$]*(?:\s+as\s+[A-Za-z_$][\w$]*)?$/.test(value))throw new Error(`Unsupported import binding in ${id}`);
        return value.replace(/\s+as\s+/,':');
      }).join(',');
      return `const {${names}}=__require(${JSON.stringify(dependency)});`;
    });
    const exports=[...source.matchAll(/^export\s+(?:(?:async\s+)?function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)].map(match=>match[1]);
    source=source.replace(/^export\s+(?=(?:async\s+)?function|const|let|class)/gm,'');
    if(/^\s*(?:import|export)\s/m.test(source)||/\bimport\s*\(|\bimport\.meta\b/.test(source))throw new Error(`Unsupported module syntax in ${id}`);
    source=source.replace(/new URLSearchParams\(location\.search\)/g,"new URLSearchParams(document.documentElement.dataset.demoQuery||'')");
    source=inlineAssets(source);
    modules.set(id,`function(__require){\n'use strict';\n${source}\nreturn Object.freeze({${exports.join(',')}});\n}`);
    visiting.delete(id);
    return id;
  }
  const entryId=visit(entry);
  const program=`(()=>{\n'use strict';\nconst __modules={${[...modules].map(([id,code])=>`${JSON.stringify(id)}:${code}`).join(',\n')}};\nconst __cache=new Map();\nfunction __require(id){if(__cache.has(id))return __cache.get(id);if(!Object.hasOwn(__modules,id))throw new Error('Missing bundled module: '+id);const value=__modules[id](__require);__cache.set(id,value);return value;}\n__require(${JSON.stringify(entryId)});\n})();`;
  new Script(program,{filename:`offline-${entryId}`});
  return program;
}

const offlineShare=`(()=>{let timer;document.addEventListener('click',event=>{const button=event.target.closest?.('button');if(!button?.matches('[data-action="share"],[data-shell="share"],[data-action="copy-link"]'))return;event.preventDefault();event.stopImmediatePropagation();const node=document.querySelector('.pc-toast');if(node){clearTimeout(timer);node.textContent='这是离线评审文件，直接转发原 HTML 即可';node.hidden=false;timer=setTimeout(()=>{node.hidden=true;},2600);}},true);})();`;

export function createCalendarReview({distDir=defaultDist}={}){
  distDir=resolve(distDir);
  const assetTokens=new Map(),assets=[],assetPayload={};
  function inlineAssets(text){
    return text.replace(/(?:\.\/)?assets\/[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp|gif|svg|woff2)\b/gi,path=>{
      const clean=path.startsWith('./')?path:`./${path}`;
      if(assetTokens.has(clean))return assetTokens.get(clean);
      const bytes=readFileSync(within(distDir,clean));
      const token=`__CAL_ASSET_${assets.length}__`;
      assetTokens.set(clean,token);
      assetPayload[token]=`data:${mimeTypes[extname(clean).toLowerCase()]};base64,${bytes.toString('base64')}`;
      assets.push({path:clean,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
      return token;
    });
  }
  const templates={};
  for(const ip of ['princess','zhanshen']){
    let html=readFileSync(within(distDir,`${ip}-calendar.html`),'utf8');
    html=html.replace('<html lang="zh-CN">','<html lang="zh-CN" data-demo-query="__DEMO_QUERY__">');
    html=html.replace(/<link\s+rel="stylesheet"\s+href="([^"?]+)(?:\?[^\"]*)?"\s*>/g,(_all,path)=>{
      const css=inlineAssets(readFileSync(within(distDir,path),'utf8'));
      if(/<\/style/i.test(css))throw new Error('Unexpected style terminator');
      return `<style>\n${css}\n</style>`;
    });
    html=html.replace(/<script\s+type="module"\s+src="([^"?]+)(?:\?[^\"]*)?"\s*><\/script>/g,(_all,path)=>`<script>\n${offlineShare}\n${safeScript(bundleModule(path,distDir,inlineAssets))}\n</script>`);
    html=html.replace('<meta charset="utf-8">',`<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${escapeHTML(csp)}">`);
    if(/<script[^>]+src=|<link[^>]+href=|@import\b/.test(html))throw new Error(`Unbundled dependency in ${ip}`);
    templates[ip]=html;
  }
  let outer=readFileSync(within(distDir,'calendar-player-compare.html'),'utf8');
  outer=outer.replace(/<link\s+rel="stylesheet"\s+href="([^"?]+)(?:\?[^\"]*)?"\s*>/g,(_all,path)=>`<style>\n${readFileSync(within(distDir,path),'utf8')}\n</style>`);
  let frameIndex=0;
  outer=outer.replace(/<iframe\b[^>]*><\/iframe>/g,tag=>{
    const frame=frames[frameIndex++];
    if(!frame)throw new Error('Unexpected extra comparison frame');
    return tag.replace(/\s+src="[^"]*"/,'').replace(/\s+allow="[^"]*"/,'').replace('<iframe',`<iframe id="${frame.id}"`);
  });
  if(frameIndex!==frames.length)throw new Error(`Expected exactly ${frames.length} comparison frames`);
  let linkIndex=0;
  outer=outer.replace(/<a\s+href="\.\/(?:princess|zhanshen)-calendar\.html[^>]*>单独查看 ↗<\/a>/g,()=>`<button type="button" class="review-open" data-review-open="${frames[linkIndex++].id}">单独查看 ↗</button>`);
  if(linkIndex!==frames.length)throw new Error(`Expected ${frames.length} standalone view links`);
  outer=outer.replace(/<title>[^<]*<\/title>/,'<title>追剧日历评审 · 尚公主与斩神Ⅱ</title>');
  outer=outer.replace('<meta charset="utf-8">',`<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${escapeHTML(csp)}">`);
  outer=outer.replace('<p>上方视频固定 · 下方日历独立滚动</p>','<p>上方视频固定 · 下方日历独立滚动</p><small class="review-caption">离线评审版 · 建议使用电脑浏览器打开</small>');
  const payload={assets:assetPayload,templates,frames};
  const bootstrap=`(()=>{\n'use strict';\nconst payload=JSON.parse(document.getElementById('calendar-review-payload').textContent);\nconst templates=Object.fromEntries(Object.entries(payload.templates).map(([ip,html])=>[ip,html.replace(/__CAL_ASSET_\\d+__/g,token=>{if(!Object.hasOwn(payload.assets,token))throw new Error('Missing inline artwork');return payload.assets[token];})]));\nconst escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));\nconst makeDocument=(frame,single=false)=>{const query=new URLSearchParams(frame.query);if(single)query.delete('presentation');return templates[frame.ip].replace('__DEMO_QUERY__',escape('?'+query.toString()));};\nfor(const frame of payload.frames)document.getElementById(frame.id).srcdoc=makeDocument(frame);\nconst dialog=document.getElementById('review-single'),singleFrame=document.getElementById('review-single-frame');\ndocument.addEventListener('click',event=>{const button=event.target.closest?.('[data-review-open]');if(!button)return;const frame=payload.frames.find(item=>item.id===button.dataset.reviewOpen);if(!frame)return;document.getElementById('review-single-title').textContent=(frame.ip==='princess'?'尚公主':'斩神Ⅱ')+' · '+(frame.query.includes('layout=player')?(frame.query.includes('hero=full')?'半屏日历 · 完整首图':'半屏日历 · 紧凑首图'):'全屏日历');singleFrame.srcdoc=makeDocument(frame,true);dialog.showModal();document.body.classList.add('review-is-focused');});\ndocument.getElementById('review-single-close').addEventListener('click',()=>dialog.close());\ndialog.addEventListener('close',()=>{singleFrame.removeAttribute('srcdoc');document.body.classList.remove('review-is-focused');});\n${readFileSync(within(distDir,'princess-calendar-compare.mjs'),'utf8')}\n})();`;
  new Script(bootstrap,{filename:'offline-review-bootstrap.js'});
  const extraCSS=`.review-caption{display:block;margin-top:8px;color:#94877c;font-size:10px;line-height:17px}.review-open{border:0;padding:0;background:transparent;color:#8b7a6c;font:inherit;font-size:11px;line-height:20px;cursor:pointer;white-space:nowrap}.review-open:focus-visible{outline:2px solid #ad7650;outline-offset:4px}.review-footer{text-align:center;font-size:10px;line-height:18px;color:#928477;margin-top:28px}.review-is-focused{overflow:hidden}.review-focus{width:100vw;max-width:none;height:100dvh;max-height:none;margin:0;padding:0;border:0;background:#e8e3df;color:#4f4137}.review-focus::backdrop{background:#e8e3df}.review-focus>header{display:flex;align-items:center;justify-content:space-between;gap:12px;height:52px;padding:0 20px;border-bottom:1px solid #d4ccc4;font:14px -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif}.review-focus>header button{min-height:40px;border:0;background:transparent;color:#795744;font:inherit;cursor:pointer}.review-focus>iframe{display:block;width:100%;height:calc(100% - 52px);border:0;background:#e8e3df}`;
  outer=outer.replace('</head>',`<style>${extraCSS}</style>\n</head>`);
  outer=outer.replace(/<script\s+type="module"\s+src="[^\"]*"\s*><\/script>/,()=>`<footer class="review-footer">方案交互演示 · 视频为静态画面 · 排期与权益非实时数据</footer>\n<dialog class="review-focus" id="review-single" aria-labelledby="review-single-title"><header><strong id="review-single-title">单独查看</strong><button type="button" id="review-single-close">返回对照 ×</button></header><iframe id="review-single-frame" title="日历方案单独查看"></iframe></dialog>\n<script type="application/json" id="calendar-review-payload">${json(payload)}</script>\n<script>${safeScript(bootstrap)}</script>`);
  if(/(?:127\.0\.0\.1|localhost|file:\/\/\/|\/Users\/|\/var\/folders\/)/.test(outer))throw new Error('Machine-local address leaked into review file');
  if(/<script[^>]+src=|<link[^>]+href=/.test(outer))throw new Error('Review file has external dependencies');
  return {html:outer,assets,frameCount:frames.length};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const output=resolve(process.argv[2]||resolve(workspace,'outputs/calendar-review-20261105/追剧日历评审版-三方案-20261105.html'));
  const review=createCalendarReview();
  mkdirSync(dirname(output),{recursive:true});
  // Never replace a manually edited or previously shared review artifact.
  writeFileSync(output,review.html,{flag:'wx'});
  console.log(JSON.stringify({output,bytes:Buffer.byteLength(review.html),frames:review.frameCount,inlineAssets:review.assets.length}));
}
