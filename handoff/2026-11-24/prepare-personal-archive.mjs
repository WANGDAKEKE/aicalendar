// Build a publication/ZIP candidate in a separate clean clone. Original
// project files are only read. No Git staging, network or publication occurs.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const destination=process.argv[2]&&path.resolve(process.argv[2]);
if(!destination||destination===root||destination.startsWith(root+path.sep)||!fs.existsSync(path.join(destination,'.git'))){
  throw new Error('Provide a separate, already-cloned Git repository as destination.');
}
const skipDirs=new Set(['.git','.openai','node_modules','.venv','venv','__pycache__','font-cache','archives']);
const duplicates=new Map([
  ['output/widget-eyes-20261106 2/','output/widget-eyes-20261106/'],
  ['output/widget-eyes-20261106 3/','output/widget-eyes-20261106/'],
  ['output/小眼睛表情扩展包/','output/widget-eyes-rich-20261106/'],
]);
const privateFile='dist/assets/princess/membership-vip-reference.jpg';
const sensitive=/(?:^|\/)(?:\.env(?:\..*)?|\.npmrc|\.netrc|credentials(?:\..*)?|secrets?(?:\..*)?|id_rsa|id_ed25519|.*\.(?:pem|key|p12|pfx))$/i;
const textExtensions=new Set(['.md','.txt','.json','.mjs','.js','.css','.html','.py','.swift','.yml','.yaml','.svg','.conf','.tag']);
const ledger=[];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

function cleanJson(value){
  if(Array.isArray(value))return value.map(cleanJson);
  if(value&&typeof value==='object'){
    const clean={};
    for(const [key,item] of Object.entries(value)){
      if(['release_directory','releaseDirectory','releaseCheckout','auth_client_id','siwc_bypass_bearer_token','source_repository_credential','access_policy'].includes(key))continue;
      if(key==='oldSites'){clean[key]={status:item?.status||'registered',latest_version_number:item?.latest_version_number??0,current_live_url:null};continue;}
      clean[key]=cleanJson(item);
    }
    return clean;
  }
  return value;
}
function sanitize(text,relative){
  let result=text.replaceAll(root,'.').replace(/\/Users\/[^/\s"'<>`]+/g,'<user-home>');
  result=result.replace(/\/var\/folders\/[^\s"'<>`]+/g,'<temporary-file>');
  if(relative.endsWith('.json')){
    try{result=JSON.stringify(cleanJson(JSON.parse(result)),null,2)+'\n';}catch{}
  }
  if(relative.startsWith('handoff/')&&relative.endsWith('.md')){
    result='> 归档前的盘点快照。其“尚未上传”结论记录于补档之前；当前收录范围以根目录README和archive/publication-manifest.json为准。\n\n'+result;
    result=result.replace(/\[dist\/assets\/princess\/membership-vip-reference\.jpg\]\(<[^>]+>\)/g,'`dist/assets/princess/membership-vip-reference.jpg`（个人信息原图已排除）');
  }
  return result;
}
function recordExcluded(relative,reason){ledger.push({source:relative,status:'excluded',reason});}
function storeFile(relative,absolute){
  if(relative===privateFile){recordExcluded(relative,'Personal nickname original; excluded from public repository and ZIP.');return;}
  if(sensitive.test(relative)){recordExcluded(relative,'Credential/configuration pattern.');return;}
  if(relative==='.gitignore'){ledger.push({source:relative,status:'replaced',target:relative,reason:'Archive ignore rules are written separately.'});return;}
  for(const [prefix,canonical] of duplicates){
    if(relative.startsWith(prefix)){
      const target=canonical+relative.slice(prefix.length);
      const canonicalSource=path.join(root,target);
      if(!fs.existsSync(canonicalSource)||hash(fs.readFileSync(absolute))!==hash(fs.readFileSync(canonicalSource)))throw new Error(`Duplicate differs: ${relative}`);
      ledger.push({source:relative,status:'duplicate',target});return;
    }
  }
  if(relative==='参考视频.mp4'){
    const target='dist/assets/drama-recording.mp4';
    if(hash(fs.readFileSync(absolute))!==hash(fs.readFileSync(path.join(root,target))))throw new Error('Recording duplicate differs.');
    ledger.push({source:relative,status:'duplicate',target});return;
  }
  let target=relative;
  if(relative==='README.md')target='docs/project-history.md';
  else if(!relative.includes('/')&&/-preview\.jpg$/.test(relative))target='docs/previews/'+relative;
  else if(relative==='render-preview.swift')target='tools/render-preview.swift';
  else if(relative==='dist/app.js'||relative==='dist/assets/drama-mock.mp4')target='archive/legacy/'+relative;
  const original=fs.readFileSync(absolute);
  let bytes=original;
  if(textExtensions.has(path.extname(relative).toLowerCase())){
    let text=sanitize(original.toString('utf8'),relative);
    if(relative==='README.md')text='# 项目详细过程记录\n\n> 以下为归档前的历史笔记，按当时进度保留。“未发布”等描述只代表记录时点；当前入口和收录状态请看根目录README。\n\n'+text;
    bytes=Buffer.from(text);
  }
  const output=path.join(destination,target);
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,bytes);
  ledger.push({source:relative,status:bytes.equals(original)?'copied':'sanitized',target,bytes:bytes.length,sha256:hash(bytes)});
}
function walk(directory){
  for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const absolute=path.join(directory,entry.name),relative=path.relative(root,absolute).split(path.sep).join('/');
    if(entry.name==='.DS_Store'){recordExcluded(relative,'Operating-system metadata.');continue;}
    if(entry.isSymbolicLink()){recordExcluded(relative,'Local dependency symlink; not followed.');continue;}
    if(entry.isDirectory()){
      if(skipDirs.has(entry.name)){recordExcluded(relative,'Git state, account binding, dependency/cache or local archive output.');continue;}
      walk(absolute);continue;
    }
    if(entry.isFile())storeFile(relative,absolute);
  }
}
walk(root);
const archive=path.join(destination,'archive');fs.mkdirSync(archive,{recursive:true});
const result={date:'2026-11-24',purpose:'Complete project archive with personal information, account bindings, caches and exact duplicate folders excluded.',originalsUnchanged:true,records:ledger};
fs.writeFileSync(path.join(archive,'source-collection.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({filesCopied:ledger.filter(x=>['copied','sanitized'].includes(x.status)).length,sanitized:ledger.filter(x=>x.status==='sanitized').length,duplicates:ledger.filter(x=>x.status==='duplicate').length,excluded:ledger.filter(x=>x.status==='excluded').length,bytes:ledger.filter(x=>x.bytes).reduce((n,x)=>n+x.bytes,0)},null,2));
