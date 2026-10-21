import test from 'node:test';
import assert from 'node:assert/strict';
import {drama} from '../dist/drama-config.mjs';
import {createTicketDownload,getTicketDownloadDescriptor} from '../dist/ticket-download.mjs';

const through=count=>Array.from({length:count},(_,index)=>index+1);
const args={drama,completed:through(10),level:1,today:'2026-10-15'};

test('an earned ticket descriptor contains its real title, stable serial, finish and PNG dimensions',()=>{
  const ticket=getTicketDownloadDescriptor(args);
  assert.equal(ticket.title,'长安的荔枝');
  assert.equal(ticket.name,'初程票');
  assert.equal(ticket.level,1);assert.equal(ticket.episode,10);
  assert.equal(ticket.finish,'paper');assert.equal(ticket.finishName,'原色纸票');
  assert.equal(ticket.serial,'LY-0001');
  assert.equal(ticket.dateLabel,'进度 2026.10.15');
  assert.equal(ticket.filename,'长安的荔枝-初程票-LY-0001-20261015.png');
  assert.deepEqual([ticket.width,ticket.height],[920,1540]);
});

test('locked tickets are rejected even if the caller supplies forged DOM-like earned flags',()=>{
  for(const [count,level] of [[0,1],[9,1],[10,2],[17,2],[18,3],[29,3]]){
    assert.throws(()=>getTicketDownloadDescriptor({...args,completed:through(count),level,unlocked:true,currentLevel:3}),/尚未解锁/);
  }
});

test('jumping to milestone episodes cannot bypass complete viewing requirements',()=>{
  assert.throws(()=>getTicketDownloadDescriptor({...args,completed:[...through(8),10]}),/尚未解锁/);
  assert.throws(()=>getTicketDownloadDescriptor({...args,completed:through(30).filter(episode=>episode!==5),level:3}),/尚未解锁/);
  assert.throws(()=>getTicketDownloadDescriptor({...args,completed:[...through(9),'10',10.5,0,31,NaN]}),/尚未解锁/);
});

test('all previously earned levels remain exportable after an upgrade with the same ticket serial',()=>{
  for(const [level,name,finish] of [[1,'初程票','paper'],[2,'同行票','foil'],[3,'典藏票','holo']]){
    const ticket=getTicketDownloadDescriptor({...args,completed:new Set(through(30)),level,today:'2026-10-27'});
    assert.equal(ticket.level,level);assert.equal(ticket.name,name);assert.equal(ticket.finish,finish);
    assert.equal(ticket.serial,'LY-0001');
  }
});

test('only integer levels 1 through 3 are accepted without coercion',()=>{
  for(const level of [undefined,null,0,-1,1.5,4,'1',true,NaN,Infinity,{},Symbol('1')]){
    assert.throws(()=>getTicketDownloadDescriptor({...args,completed:through(30),level}),/等级无效/);
  }
});

test('filenames cannot contain path separators, controls, direction overrides or unsafe suffixes',()=>{
  const title='../长安/荔枝\\票\u202e: ? * " < > | \u0000\n';
  const ticket=getTicketDownloadDescriptor({...args,drama:{title}});
  assert.ok(!/[\\/:*?"<>|\u0000-\u001f\u007f\u202a-\u202e]/.test(ticket.filename));
  assert.ok(!ticket.filename.startsWith('.'));
  assert.ok(ticket.filename.endsWith('-初程票-LY-0001-20261015.png'));
  assert.equal(ticket.filename.split('.').length,2);
  const long=getTicketDownloadDescriptor({...args,drama:{title:'荔枝'.repeat(100)}});
  assert.ok(Buffer.byteLength(long.filename,'utf8')<255);
  assert.equal(long.title,'荔枝'.repeat(100));
  const emptyStem=getTicketDownloadDescriptor({...args,drama:{title:'../\\:*?"<>|'}});
  assert.ok(emptyStem.filename.startsWith('追剧纪念票-'));
});

test('progress dates must be real calendar dates, not normalized invalid dates or filename payloads',()=>{
  for(const today of [undefined,null,'','2026-2-3','2026-02-29','2026-02-30','2026-13-01','2026-10-15/../../','2026-10-15T19:00:00+08:00','2026-10-15\n']){
    assert.throws(()=>getTicketDownloadDescriptor({...args,today}),/日期无效/);
  }
  assert.equal(getTicketDownloadDescriptor({...args,today:'2028-02-29'}).dateLabel,'进度 2028.02.29');
});

test('missing titles fail clearly and descriptor generation does not mutate input records',()=>{
  for(const title of [undefined,null,'','  ',42,'\u0000']){
    assert.throws(()=>getTicketDownloadDescriptor({...args,drama:{title}}),/缺少剧集标题/);
  }
  const before=structuredClone(args);
  getTicketDownloadDescriptor(args);
  assert.deepEqual(args,before);
});

test('download revalidates ownership before attempting to access a browser or load artwork',async()=>{
  await assert.rejects(createTicketDownload({...args,level:3}),/尚未解锁/);
  await assert.rejects(createTicketDownload({...args,completed:through(9)}),/尚未解锁/);
  await assert.rejects(createTicketDownload(args),/使用浏览器重试/);
});

test('artwork failures reject instead of returning a partially rendered ticket',async()=>{
  const previousDocument=globalThis.document,previousImage=globalThis.Image;
  let canvasCreated=false;
  try{
    globalThis.document={fonts:{ready:Promise.resolve()},createElement(){canvasCreated=true;throw new Error('Unexpected partial render');}};
    globalThis.Image=class {
      set src(value){if(value)queueMicrotask(()=>this.onerror?.());}
    };
    await assert.rejects(createTicketDownload(args),/加载失败/);
    assert.equal(canvasCreated,false);
  }finally{
    if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
    if(previousImage===undefined)delete globalThis.Image;else globalThis.Image=previousImage;
  }
});
