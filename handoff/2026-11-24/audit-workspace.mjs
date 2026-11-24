// Read-only content audit against the saved GitHub tree. No network, writes,
// Git index changes, symlink traversal or credential-file reads.
import {readFileSync,readdirSync,lstatSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(process.argv[2]||resolve(here,'../..'));
const snapshot=JSON.parse(readFileSync(resolve(process.argv[3]||resolve(here,'remote-snapshot.json')),'utf8'));
if(snapshot.treeTruncated)throw new Error('Remote file tree is truncated; cannot produce a complete comparison.');
const remote=new Map(snapshot.files.map(file=>[file.path,file]));
const remotePathsBySha=new Map();
for(const file of snapshot.files){
  const paths=remotePathsBySha.get(file.sha)||[];
  paths.push(file.path);remotePathsBySha.set(file.sha,paths);
}
const tracked=new Set(execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean));
const skipped=[];
const files=[];
const skipDirs=new Set(['.git','handoff','node_modules','.venv','venv','__pycache__']);
const sensitive=/(?:^|\/)(?:\.env(?:\..*)?|\.npmrc|\.netrc|credentials(?:\..*)?|secrets?(?:\..*)?|id_rsa|id_ed25519|.*\.(?:pem|key|p12|pfx))$/i;

function walk(directory){
  for(const entry of readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const absolute=resolve(directory,entry.name),path=relative(root,absolute).split('\\').join('/');
    if(entry.name==='.DS_Store')continue;
    if(entry.isDirectory()){
      if(skipDirs.has(entry.name))continue;
      walk(absolute);continue;
    }
    if(entry.isSymbolicLink()||sensitive.test(path)){
      skipped.push({path,reason:entry.isSymbolicLink()?'symlink not followed':'sensitive file excluded'});continue;
    }
    if(!entry.isFile())continue;
    const size=lstatSync(absolute).size;
    const sha=createHash('sha1').update(`blob ${size}\0`).update(readFileSync(absolute)).digest('hex');
    const reference=remote.get(path);
    files.push({path,bytes:size,gitBlobSha:sha,remoteBlobSha:reference?.sha||null,status:!reference?'local_only':sha===reference.sha?'remote_identical':'local_differs',remoteAtOtherPaths:(remotePathsBySha.get(sha)||[]).filter(item=>item!==path),locallyTracked:tracked.has(path),servedByPages:!!reference&&path.startsWith('dist/')});
  }
}
walk(root);
const remoteOnly=snapshot.files.filter(file=>!existsSync(resolve(root,file.path))).map(file=>({...file,status:'remote_only'}));
const summary={localFiles:files.length,localBytes:files.reduce((n,file)=>n+file.bytes,0),remoteFiles:snapshot.files.length,remoteDistFiles:snapshot.files.filter(file=>file.path.startsWith('dist/')).length,remoteIdentical:files.filter(file=>file.status==='remote_identical').length,localDiffers:files.filter(file=>file.status==='local_differs').length,localOnly:files.filter(file=>file.status==='local_only').length,remoteOnly:remoteOnly.length,remoteIdenticalButLocallyUntracked:files.filter(file=>file.status==='remote_identical'&&!file.locallyTracked).length,localOnlyBytes:files.filter(file=>file.status==='local_only').reduce((n,file)=>n+file.bytes,0)};
const groups={};
summary.localOnlyContentAlreadyRemote=files.filter(file=>file.status==='local_only'&&file.remoteAtOtherPaths.length).length;
summary.localOnlyContentNotInRemote=files.filter(file=>file.status==='local_only'&&!file.remoteAtOtherPaths.length).length;
for(const file of files){
  const group=file.path.includes('/')?file.path.split('/')[0]:'root';
  groups[group]??={files:0,bytes:0,remote_identical:0,local_differs:0,local_only:0};
  groups[group].files++;groups[group].bytes+=file.bytes;groups[group][file.status]++;
}
console.log(JSON.stringify({checkedOn:snapshot.checkedOn,root,repository:snapshot.repository,remoteCommit:snapshot.commit.sha,scope:'Working files only; excludes .git, handoff audit outputs, dependency caches, .DS_Store and sensitive files. Git blob SHA-1 compares file content, not executable mode or backup permissions.',summary,groups,files,remoteOnly,skipped},null,2));
