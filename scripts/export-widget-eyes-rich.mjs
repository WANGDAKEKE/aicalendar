/** Expand the project's native eye system, preserving transparent geometry. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {tearyExpressions} from './widget-eyes-tears.mjs';
import {extraExpressions} from './widget-eyes-extra.mjs';
const require=createRequire(import.meta.url);
const sharp=require('sharp');
const JSZip=require('jszip');
const root=path.resolve(import.meta.dirname,'..');
const output=path.join(root,'output','widget-eyes-rich-20261106');
const expressions=[...tearyExpressions,...extraExpressions];
const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const groups=['流泪委屈','困倦等你','搞怪催看','开心回来','紧张疑惑'];
const records=[];
const visibleHashes=new Set();
await fs.mkdir(output,{recursive:true});
if(expressions.length!==32||new Set(expressions.map(e=>e.id)).size!==32)throw new Error('Expected 32 unique expressions');
for(const expression of expressions){
  const group=`${String(groups.indexOf(expression.group)+1).padStart(2,'0')}_${expression.group}`;
  const stem=`${expression.id.slice(0,2)}_${expression.name}`;
  const pngRelative=`01_新增透明PNG_32款/${group}/${stem}.png`;
  const svgRelative=`02_可编辑SVG_32款/${group}/${stem}.svg`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="384" viewBox="0 0 160 120" role="img" aria-label="${xml(expression.name)}"><title>${xml(expression.name)}</title><g transform="translate(0 4)">${expression.art}</g></svg>`;
  for(const relative of [pngRelative,svgRelative])await fs.mkdir(path.dirname(path.join(output,relative)),{recursive:true});
  await fs.writeFile(path.join(output,svgRelative),svg);
  const bytes=await sharp(Buffer.from(svg)).png().toBuffer();
  await fs.writeFile(path.join(output,pngRelative),bytes);
  const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let alphaPixels=0,transparentPixels=0,minX=info.width,minY=info.height,maxX=-1,maxY=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
    const alpha=data[(y*info.width+x)*4+3];
    if(alpha>0){alphaPixels++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}else transparentPixels++;
  }
  if(info.width!==512||info.height!==384||alphaPixels===0||transparentPixels===0||minX<5||minY<5||maxX>506||maxY>378)throw new Error(`Invalid or clipped PNG: ${expression.id}`);
  // Identity check on complete PNG bytes; accidental duplicate geometry is rejected.
  const hash=(await import('node:crypto')).createHash('sha256').update(bytes).digest('hex');
  if(visibleHashes.has(hash))throw new Error(`Duplicate PNG: ${expression.id}`);
  visibleHashes.add(hash);
  records.push({id:expression.id,name:expression.name,group:expression.group,hint:expression.hint,png:pngRelative,svg:svgRelative,width:512,height:384,alpha:true,visibleBounds:{minX,minY,maxX,maxY}});
}

async function preview(file,background,tileBackground,foreground,secondary,items=expressions){
  const cols=4,tileW=280,tileH=218,header=100;
  const panels=items.map((e,i)=>{
    const x=i%cols*tileW,y=Math.floor(i/cols)*tileH+header;
    // SVG IDs are globally unique across all expressions, making a safe native contact sheet.
    return `<g transform="translate(${x},${y})"><rect x="10" y="5" width="260" height="170" rx="12" fill="${tileBackground}"/><g transform="translate(28 0) scale(1.4)">${e.art}</g><text x="18" y="199" font-size="17" font-weight="500" fill="${foreground}">${xml(`${e.id.slice(0,2)} ${e.name}`)}</text><text x="18" y="217" font-size="11" fill="${secondary}">${xml(e.group)}</text></g>`;
  }).join('');
  const title=items.length===8?'哭哭也要有不同程度':'小眼睛表情扩展包';
  const subtitle=items.length===8?'8款流泪与委屈表情 · 全包另有困倦、搞怪、开心和疑惑等24款':'新增32款 · 透明PNG + 可编辑SVG · 流泪 / 困倦 / 搞怪 / 开心 / 疑惑';
  const sheet=`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="${header+Math.ceil(items.length/cols)*tileH+20}" style="font-family:PingFang SC,Arial,sans-serif"><rect width="100%" height="100%" fill="${background}"/><text x="24" y="38" fill="${foreground}" font-size="26" font-weight="600">${title}</text><text x="24" y="71" fill="${secondary}" font-size="15">${subtitle}</text>${panels}</svg>`;
  await sharp(Buffer.from(sheet)).png().toFile(path.join(output,file));
}
await preview('00_新增表情总览_深色底.png','#252B29','#3C4541','#F4F6F3','#A6B6AC');
await preview('00_新增表情总览_浅色底.png','#F5F6F3','#E3E8E2','#25342C','#78867B');
await preview('00_流泪表情预览.png','#252B29','#3C4541','#F4F6F3','#A6B6AC',tearyExpressions);

// A compact preview retains a truly small icon sample, not only large-scale art.
const microPanels=expressions.map((e,i)=>`<g transform="translate(${i%8*128} ${Math.floor(i/8)*90+72})"><g transform="translate(44 8) scale(.25)">${e.art}</g><text x="64" y="66" text-anchor="middle" fill="#ECF1EB" font-size="12">${xml(e.id.slice(0,2)+' '+e.name)}</text></g>`).join('');
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="440" style="font-family:PingFang SC,Arial,sans-serif"><rect width="100%" height="100%" fill="#303934"/><text x="20" y="32" fill="#ECF1EB" font-size="20">小尺寸效果预览</text><text x="20" y="56" fill="#A8BBB0" font-size="13">每张画布40×30像素，眼睛图形约25—30像素宽。需以实际机型和落稿尺寸再次核对。</text>${microPanels}</svg>`)).png().toFile(path.join(output,'03_小尺寸效果预览.png'));

const oldRoot=path.join(root,'output','widget-eyes-20261106');
let oldCount=0;
for(const folder of ['01_主用_色卡版','02_早期原稿_备选','03_当前海报版_迷你']){
  const dest=path.join(output,'04_上一版PNG_29张',folder);
  await fs.mkdir(dest,{recursive:true});
  for(const file of await fs.readdir(path.join(oldRoot,folder))){
    if(!file.endsWith('.png'))continue;
    await fs.copyFile(path.join(oldRoot,folder,file),path.join(dest,file));oldCount++;
  }
}
if(oldCount!==29)throw new Error('Previous asset count mismatch');
await fs.writeFile(path.join(output,'素材索引.json'),JSON.stringify({version:'2026-11-06-rich',newExpressions:32,newPNG:32,newSVG:32,previousPNG:oldCount,items:records},null,2)+'\n');
const readme=`小眼睛表情扩展包｜2026-11-06

新增32款：流泪委屈8款、困倦等你6款、搞怪催看8款、开心回来6款、紧张疑惑4款。
其中：含泪忍住、单滴眼泪、双滴眼泪、泪流不止、委屈下垂、汪汪大眼、哭到眯眼、泪眼斜看。

01_新增透明PNG_32款：新增32张透明底PNG，均为512×384 px。
02_可编辑SVG_32款：相同32款的SVG，可直接拖入Figma后编辑颜色和形态。
04_上一版PNG_29张：上一次的29张PNG也一并附上，不计入新增32款。
00开头为深浅色总览和流泪表情专题预览；03为小尺寸效果预览。

使用方法
1. PNG四周有透明留白，导入后等比缩放；眼睛图形在组件里建议先试24—36逻辑像素宽，再按实际机型核对。含留白的整张画布通常需约40—55逻辑像素宽。
2. PNG是固定颜色，不自动跟随深浅模式。白色眼白＋深色瞳孔，可在两种底色上预览；SVG可继续调整。
3. 眼泪、汗滴仅用少量蓝色；部分眼睛有粉色爱心或暖黄色星光。没有头、身体或嘴。
4. 强烈流泪、假生气、翻白眼建议少量使用，只搭配轻松文案，不暗示用户有义务回来观看。
5. 已追平、单纯等更新时优先用放松、睡觉、期待类，不要因为等更新而给用户“催看惩罚”。

来源
沿用现有demo的代码原生矢量眼睛语言，由几何图形扩展并导出，非图像模型生成。
这些是本地概念素材，不是腾讯官方审核的IP资产，也不是多邻国原素材。
本次没有修改demo或同步线上。
`;
await fs.writeFile(path.join(output,'使用说明.txt'),readme);

const archive=new JSZip();
async function addDir(folder,relative=''){
  for(const entry of await fs.readdir(folder,{withFileTypes:true})){
    const location=path.join(folder,entry.name), rel=path.posix.join(relative,entry.name);
    if(entry.isDirectory())await addDir(location,rel);
    else archive.file(`小眼睛表情扩展包/${rel}`,await fs.readFile(location));
  }
}
await addDir(output);
const zip=await archive.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:9}});
const zipPath=path.join(root,'output','小眼睛表情扩展包_新增32款_20261106.zip');
await fs.writeFile(zipPath,zip);
const verify=await JSZip.loadAsync(zip,{checkCRC32:true});
const files=Object.keys(verify.files);
if(files.filter(n=>n.includes('/01_新增透明PNG_32款/')&&n.endsWith('.png')).length!==32||files.filter(n=>n.endsWith('.svg')).length!==32)throw new Error('ZIP count mismatch');
console.log(JSON.stringify({zipPath,newPNG:32,newSVG:32,previousPNG:oldCount,uniqueImages:visibleHashes.size,zipBytes:zip.length,previews:[path.join(output,'00_新增表情总览_深色底.png'),path.join(output,'00_新增表情总览_浅色底.png'),path.join(output,'03_小尺寸效果预览.png')]},null,2));
