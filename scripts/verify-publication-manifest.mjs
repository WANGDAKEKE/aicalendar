// Hash the reviewed Git index when writing; verify without Git after ZIP extraction.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifestPath='archive/publication-manifest.json';
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const safePath=relative=>{
  if(typeof relative!=='string'||relative.includes('\\')||path.isAbsolute(relative)||relative.split('/').some(part=>part==='..'||part==='.'||!part))throw new Error('Unsafe manifest path.');
  return path.join(root,relative);
};
function inspect(relative){
  const absolute=safePath(relative);
  if(!fs.lstatSync(absolute).isFile())throw new Error(`Not a regular file: ${relative}`);
  const bytes=fs.readFileSync(absolute);
  return {path:relative,bytes:bytes.length,sha256:sha256(bytes)};
}

if(process.argv.includes('--write')){
  const names=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(name=>name&&name!==manifestPath).sort();
  const files=names.map(inspect);
  const manifest={format:1,date:'2026-11-24',algorithm:'SHA-256',baselineCommit:'eda2092247b9e07705030e55e7197cb76a1544fa',selfExcluded:manifestPath,fileCount:files.length,totalBytes:files.reduce((n,file)=>n+file.bytes,0),files};
  fs.writeFileSync(path.join(root,manifestPath),JSON.stringify(manifest,null,2)+'\n');
  console.log(`Wrote ${files.length} file hashes.`);
}else{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,manifestPath),'utf8'));
  if(manifest.format!==1||manifest.algorithm!=='SHA-256'||manifest.fileCount!==manifest.files.length)throw new Error('Invalid manifest header.');
  const seen=new Set();
  let totalBytes=0;
  for(const expected of manifest.files){
    if(seen.has(expected.path))throw new Error(`Duplicate manifest path: ${expected.path}`);
    seen.add(expected.path);
    const actual=inspect(expected.path);
    if(actual.bytes!==expected.bytes||actual.sha256!==expected.sha256)throw new Error(`File changed: ${expected.path}`);
    totalBytes+=actual.bytes;
  }
  if(totalBytes!==manifest.totalBytes)throw new Error('Manifest total differs.');
  console.log(`Verified ${seen.size} files (${totalBytes} bytes).`);
}
