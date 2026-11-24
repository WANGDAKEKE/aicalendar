/** Export existing code-native eye expressions; no demo files are changed. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const JSZip = require('jszip');
const root = path.resolve(import.meta.dirname, '..');
const destination = path.join(root, 'output', 'widget-eyes-20261106');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const moodNames = {ready:'机灵侧目',evening:'期待等你',waiting:'半眯无语',returned:'星星眼',resting:'放松躺平',welcome:'初次见面', 'logged-out':'安静等待',unavailable:'疑惑歪头'};
const oldInk = {ready:'#313a25',evening:'#4c302b',waiting:'#40324f',returned:'#2c473c',resting:'#344b5c',welcome:'#4d4228','logged-out':'#3e4859',unavailable:'#584542'};

/** Geometry mirrors companion-v4.css and widget-atlas.css at their native sizes. */
function classic(mood, size, atlas) {
  const small = size === 'square';
  const w = small ? 15 : 20, h = small ? 24 : 31;
  const cw = small ? 34 : 46, ch = small ? 26 : 35;
  const white = atlas ? '#F5F5F5' : '#FFFEFB';
  const ink = atlas ? '#111111' : oldInk[mood];
  let angle = -7;
  if (mood === 'waiting') angle = 7;
  if (mood === 'evening') angle = 3;
  if (mood === 'resting') angle = atlas ? -4 : 0;
  if (mood === 'logged-out') angle = -2;
  if (mood === 'unavailable') angle = 9;
  const eye = index => {
    const x = index * (cw - w);
    const y = index ? (atlas && mood === 'resting' ? 1 : small ? -2 : -3) : 0;
    const eyeH = mood === 'unavailable' && index ? (small ? 19 : 25) : h;
    let px = small ? 5 : 7, py = small ? 8 : 10, pw = small ? 7 : 9, ph = small ? 11 : 14;
    if (mood === 'evening') {px=small?3:4; py=small?8:11;}
    if (mood === 'welcome') {px=small?4:6; py=small?8:10; ph=small?11:13;}
    if (mood === 'logged-out') px=small?4:6;
    if (atlas && mood === 'ready') px=2;
    let shape = `<ellipse cx="${w/2}" cy="${eyeH/2}" rx="${w/2}" ry="${eyeH/2}"/>`;
    let clipShape = shape;
    let outline = '';
    if (atlas && mood === 'waiting') {
      const halfH = small ? 13 : 17;
      shape = `<path d="M0 8H${w}V${8+halfH/2}Q${w} ${8+halfH} ${w/2} ${8+halfH}Q0 ${8+halfH} 0 ${8+halfH/2}Z"/>`;
      clipShape=shape;
      outline=`<path d="M0 8H${w}" fill="none" stroke="${ink}" stroke-width="1"/>`;
      py=8;
    }
    const clip = `clip-${atlas?'atlas':'classic'}-${mood}-${size}-${index}`;
    let pupil;
    if (mood === 'returned') {
      px=small?2:3; py=small?5:7; pw=small?11:15; ph=small?14:18;
      const points = [[.5,0],[.62,.31],[.98,.36],[.72,.58],[.8,.96],[.5,.76],[.2,.96],[.28,.58],[.02,.36],[.38,.31]].map(([a,b])=>`${px+a*pw},${py+b*ph}`).join(' ');
      pupil=`<polygon points="${points}" fill="${ink}"/>`;
    } else if (mood === 'resting') {
      px=small?3:5;py=small?11:14;pw=small?9:11;ph=small?5:6;
      pupil=`<path d="M${px} ${py}H${px+pw}Q${px+pw} ${py+ph} ${px+pw/2} ${py+ph}Q${px} ${py+ph} ${px} ${py}Z" fill="${ink}"/>`;
    } else {
      pupil=`<ellipse cx="${px+pw/2}" cy="${py+ph/2}" rx="${pw/2}" ry="${ph/2}" fill="${ink}"/><circle cx="${px+pw-(small?2:3.5)}" cy="${py+(small?3:3.5)}" r="${small?1:1.5}" fill="${white}"/>`;
    }
    if (!atlas && mood === 'waiting') {
      // A transparent clip replaces the old background-coloured CSS eyelid.
      // The diagonal lid edge is retained; it works on any poster colour.
      const edge=small?13:18;
      clipShape=`<clipPath id="lid-${clip}"><path d="M-2 ${edge+1}L${w+2} ${edge-2}V${h+2}H-2Z"/></clipPath>`;
      const ellipse=`<ellipse cx="${w/2}" cy="${eyeH/2}" rx="${w/2}" ry="${eyeH/2}" fill="${white}"/>`;
      return `<g transform="translate(${x},${y})"><defs>${clipShape}<clipPath id="${clip}">${shape}</clipPath></defs><g clip-path="url(#${clip})"><g clip-path="url(#lid-${clip})">${ellipse}${pupil}</g><path d="M-2 ${edge+1}L${w+2} ${edge-2}" stroke="${ink}" stroke-width="${small?1.2:1.4}"/></g></g>`;
    }
    return `<g transform="translate(${x},${y})"><defs><clipPath id="${clip}">${clipShape}</clipPath></defs><g fill="${white}">${shape}</g><g clip-path="url(#${clip})">${pupil}</g>${outline}</g>`;
  };
  return `<g transform="translate(${(64-cw)/2},${(48-ch)/2+2})"><g transform="rotate(${angle} ${cw/2} ${ch/2})">${eye(0)}${eye(1)}</g></g>`;
}

function mini(mood) {
  const eye = index => {
    const x=index*10;
    if(mood==='content') return `<path d="M${x} 6Q${x+4} 1 ${x+8} 6" fill="none" stroke="#e7d4b9" stroke-width="1.5"/>`;
    const half=mood==='patient';
    const shape=half?'<path d="M0 4H8Q8 10 4 10Q0 10 0 4Z"/>':'<ellipse cx="4" cy="6.5" rx="4" ry="5.5"/>';
    const id=`mini-${mood}-${index}`;
    return `<g transform="translate(${x},0) rotate(6 4 6.5)"><defs><clipPath id="${id}">${shape}</clipPath></defs><g fill="#eee9db">${shape}</g><ellipse clip-path="url(#${id})" cx="5" cy="9" rx="2" ry="3" fill="#292f2c"/></g>`;
  };
  return `<g transform="translate(5,6) scale(3)">${eye(0)}${eye(1)}</g>`;
}

const records=[];
for(const [atlas,folder,moods] of [
  [true,'01_主用_色卡版',['ready','evening','waiting','returned','resting']],
  [false,'02_早期原稿_备选',['ready','evening','waiting','returned','resting','welcome','logged-out','unavailable']],
]) {
  for(const [index,mood] of moods.entries()) for(const size of ['wide','square']) {
    records.push({id:`${atlas?'atlas':'original'}-${mood}-${size}`,folder,name:`${String(index+1).padStart(2,'0')}_${moodNames[mood]}_${size==='wide'?'横版':'方版'}`,label:moodNames[mood],source:atlas?'companion-v4.css + widget-atlas.css':'companion-v4.css',size,art:classic(mood,size,atlas)});
  }
}
for(const [index,[mood,label]] of [['alert','睁眼关注'],['patient','耐心等待'],['content','开心弯眼']].entries()) records.push({id:`mini-${mood}`,folder:'03_当前海报版_迷你',name:`${String(index+1).padStart(2,'0')}_${label}`,label,source:'widget-refresh.css',size:'mini',art:mini(mood)});

await fs.mkdir(destination,{recursive:true});
for(const record of records) {
  const folder=path.join(destination,record.folder); await fs.mkdir(folder,{recursive:true});
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="384" viewBox="0 0 64 48">${record.art}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(folder,`${record.name}.png`));
}
const mainRecords=records.filter(record=>record.size==='wide'||record.size==='mini');
const tileW=300,tileH=230,headerH=110;
const panels=mainRecords.map((record,index)=>{
  const x=(index%4)*tileW,y=headerH+Math.floor(index/4)*tileH;
  const group=record.folder.startsWith('01')?'主用':record.folder.startsWith('02')?'原稿备选':'当前迷你';
  return `<g transform="translate(${x},${y})"><rect x="12" y="8" width="276" height="172" rx="12" fill="#9da5a3"/><g transform="translate(44,16) scale(3.3)">${record.art}</g><text x="20" y="204" font-size="17" fill="#26332e">${escape(`${group} · ${record.name.replace(/_横版$/,'')}`)}</text><text x="20" y="224" font-size="12" fill="#727d77">${escape(record.id)}</text></g>`;
}).join('');
const sheet=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${headerH+Math.ceil(mainRecords.length/4)*tileH+20}" style="font-family:PingFang SC,Arial,sans-serif"><rect width="100%" height="100%" fill="#f4f5f1"/><text x="28" y="42" font-size="26" fill="#24332d">小眼睛素材总览</text><text x="28" y="75" font-size="16" fill="#68766e">16种表达 / 29张透明PNG / 512 × 384 px / 原稿表情复用，不代表新增策略状态</text>${panels}</svg>`;
await sharp(Buffer.from(sheet)).png().toFile(path.join(destination,'00_素材总览.png'));
await fs.writeFile(path.join(destination,'manifest.json'),JSON.stringify(records.map(({art,...record})=>({...record,file:`${record.folder}/${record.name}.png`,width:512,height:384,transparent:true})),null,2)+'\n');
const report=[];
for(const record of records){
  const file=path.join(destination,record.folder,`${record.name}.png`);
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let opaque=0,transparent=0;
  for(let i=3;i<data.length;i+=4){if(data[i]===0) transparent++;else opaque++;}
  if(info.width!==512||info.height!==384||opaque===0||transparent===0)throw new Error(`Invalid transparent PNG: ${record.id}`);
  report.push({id:record.id,visiblePixels:opaque,transparentPixels:transparent});
}
await fs.writeFile(path.join(destination,'validation.json'),JSON.stringify({pngCount:records.length,checkedAt:'2026-11-06',images:report},null,2)+'\n');
// JSZip marks non-ASCII filenames as UTF-8 for cross-platform extraction.
const archive = new JSZip();
async function addFolder(folder,relative=''){
  for(const entry of await fs.readdir(folder,{withFileTypes:true})){
    const child=path.join(folder,entry.name), childRelative=path.posix.join(relative,entry.name);
    if(entry.isDirectory())await addFolder(child,childRelative);
    else archive.file(`widget-eyes-20261106/${childRelative}`,await fs.readFile(child));
  }
}
await addFolder(destination);
const zipBytes=await archive.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:9}});
const zipPath=path.join(root,'output','小眼睛透明PNG_20261106.zip');
await fs.writeFile(zipPath,zipBytes);
const checked=await JSZip.loadAsync(zipBytes,{checkCRC32:true});
if(Object.keys(checked.files).filter(name=>name.endsWith('.png')).length!==30)throw new Error('ZIP image count mismatch');
console.log(JSON.stringify({destination,pngCount:records.length,expressions:mainRecords.length,zipPath,overview:path.join(destination,'00_素材总览.png')},null,2));
