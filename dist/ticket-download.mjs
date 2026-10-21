import {getTicketProgress,ticketLevels} from './ticket-model.mjs';

const WIDTH=920,HEIGHT=1540,SCALE=5;
const FONT='"PingFang SC","Microsoft YaHei",sans-serif';
const finishNames={paper:'原色纸票',foil:'鎏金票面',holo:'流光票面'};
const cleanText=value=>value.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g,'').replace(/\s+/g,' ').trim();

function validDate(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}

function filenamePart(title) {
  const safe=cleanText(title.normalize('NFKC')).replace(/[\\/:*?"<>|]/g,'-').replace(/\s+/g,'-').replace(/^[. -]+|[. -]+$/g,'');
  return Array.from(safe).slice(0,36).join('').replace(/[. -]+$/g,'')||'追剧纪念票';
}

function within(promise,milliseconds,message) {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error(message)),milliseconds);
    Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
  });
}

// Never trust a selected tab, DOM class or caller-supplied earned flag.
export function getTicketDownloadDescriptor({drama,completed,level,today} = {}) {
  if(!Number.isInteger(level)||level<1||level>3)throw new Error('电子票等级无效，请选择已获得的票面。');
  const selected=ticketLevels.find(ticket=>ticket.level===level);
  const progress=getTicketProgress(completed);
  if(!selected||level>progress.currentLevel)throw new Error('该票面尚未解锁，完成对应观看进度后才能下载。');
  if(typeof drama?.title!=='string'||!cleanText(drama.title))throw new Error('缺少剧集标题，无法导出电子票。');
  if(!validDate(today))throw new Error('进度日期无效，请刷新后重试。');
  const title=cleanText(drama.title),serial='LY-0001';
  return {
    title,level:selected.level,episode:selected.episode,name:selected.name,
    finish:selected.finish,finishName:finishNames[selected.finish],serial,today,
    dateLabel:`进度 ${today.replaceAll('-','.')}`,
    filename:`${filenamePart(title)}-${selected.name}-${serial}-${today.replaceAll('-','')}.png`,
    width:WIDTH,height:HEIGHT,
  };
}

function loadImage(url,label) {
  return new Promise((resolve,reject)=>{
    const image=new Image();
    let timer;
    const finish=(error)=>{
      clearTimeout(timer);image.onload=null;image.onerror=null;
      if(error)reject(new Error(`${label}加载失败，请检查网络后重试。`));
      else resolve(image);
    };
    image.decoding='async';
    image.onload=()=>finish(!image.naturalWidth||!image.naturalHeight);
    image.onerror=()=>finish(true);
    timer=setTimeout(()=>{finish(true);image.src='';},15000);
    image.src=url.href;
  });
}

function gradient(context,x0,y0,x1,y1,stops) {
  const paint=context.createLinearGradient(x0,y0,x1,y1);
  for(const [offset,color] of stops)paint.addColorStop(offset,color);
  return paint;
}

function text(context,value,x,y,{size=6,color='#81775e',weight=400,align='left',maxWidth}={}) {
  context.font=`${weight} ${size}px ${FONT}`;
  context.fillStyle=color;context.textAlign=align;context.textBaseline='alphabetic';
  if(maxWidth)context.fillText(value,x,y,maxWidth);else context.fillText(value,x,y);
}

function cover(context,image,x,y,width,height,positionX=.5,positionY=.5) {
  const scale=Math.max(width/image.naturalWidth,height/image.naturalHeight);
  const drawnWidth=image.naturalWidth*scale,drawnHeight=image.naturalHeight*scale;
  context.drawImage(image,x+(width-drawnWidth)*positionX,y+(height-drawnHeight)*positionY,drawnWidth,drawnHeight);
}

function drawPaper(context,finish) {
  const colors={paper:'#f4ecd8',foil:'#f2e2b9',holo:'#e8eddd'};
  context.fillStyle=colors[finish];context.fillRect(0,0,184,308);
  const stops=finish==='holo'?[[0,'#f0e6c5a8'],[.22,'#d6e9dfd9'],[.43,'#e7d9ecc2'],[.62,'#f6e8b9d6'],[.81,'#d3e8e3b3'],[1,'#ece2efb3']]
    :finish==='foil'?[[0,'#fff5cfb3'],[.24,'#fff5cf00'],[.48,'#ba8c3730'],[.60,'#fffbdfb3'],[.80,'#fffbdf00'],[1,'#fff5cf30']]
      :[[0,'#fffdf270'],[.6,'#fffdf200'],[1,'#fffdf200']];
  context.fillStyle=gradient(context,0,0,184,308,stops);context.fillRect(0,0,184,308);
  context.fillStyle=finish==='holo'?'#687e7219':'#8f79551c';
  for(let y=1.5;y<308;y+=3){
    for(let x=1.5;x<184;x+=3){context.beginPath();context.arc(x,y,.35,0,Math.PI*2);context.fill();}
  }
}

function drawPoster(context,poster,finish) {
  const x=9,y=23,width=166,height=162;
  context.save();context.beginPath();context.rect(x,y,width,height);context.clip();
  // Match the UI's background-position: 70% top; background-size: auto 140%.
  const drawnHeight=height*1.4,drawnWidth=poster.naturalWidth/poster.naturalHeight*drawnHeight;
  context.drawImage(poster,x+(width-drawnWidth)*.7,y,drawnWidth,drawnHeight);
  const stops=finish==='holo'?[[0,'#efdcba21'],[.33,'#d3eee928'],[.65,'#e0c9ed2b'],[1,'#f6e9bc30']]
    :[[0,'#6e49230a'],[.65,'#79614000'],[1,'#79614015']];
  context.fillStyle=gradient(context,x,y,finish==='holo'?x+width:x,y+height,stops);
  context.fillRect(x,y,width,height);
  context.strokeStyle='#fff9e529';context.lineWidth=.5;context.strokeRect(x+4,y+4,width-8,height-8);
  context.restore();
  context.strokeStyle=finish==='foil'?'#ba985f80':'#ac967d40';context.lineWidth=.6;context.strokeRect(x,y,width,height);
}

function drawStub(context,texture,descriptor) {
  context.save();context.beginPath();context.rect(0,250,184,58);context.clip();
  cover(context,texture,0,250,184,58,.5,.6);
  context.fillStyle='#faf8eecf';context.fillRect(0,250,184,58);
  context.restore();
  context.save();context.strokeStyle='#a8997370';context.lineWidth=.6;context.setLineDash([2.5,2]);
  context.beginPath();context.moveTo(0,250);context.lineTo(184,250);context.stroke();context.restore();
  text(context,'NO.',13,264,{size:6});
  text(context,descriptor.serial,28,264,{size:7,weight:600,color:'#576448'});
  text(context,descriptor.dateLabel,171,264,{size:5.7,align:'right'});
  context.save();context.beginPath();context.rect(13,270,158,14);context.clip();
  context.fillStyle='#46523c9e';
  const bars=[[0,1],[3,1],[5,2],[10,1],[12,3],[17,1]];
  for(let x=13;x<171;x+=21)for(const [offset,width] of bars)context.fillRect(x+offset,270,width,14);
  context.restore();
  text(context,'追剧纪念票 · 非观影凭证',92,295,{size:6,align:'center',color:'#958b73'});
}

function drawTicket(context,descriptor,poster,texture) {
  const finish=descriptor.finish;
  context.scale(SCALE,SCALE);context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
  drawPaper(context,finish);
  text(context,'追 剧 纪 念',12,14,{size:6.5,weight:600,color:'#7f785d'});
  text(context,`${String(descriptor.level).padStart(2,'0')} / 03`,172,14,{size:6.5,weight:600,align:'right',color:'#7f785d'});
  drawPoster(context,poster,finish);
  const ink=finish==='foil'?'#846321':finish==='holo'?'#365e52':'#3b5741';
  text(context,descriptor.name,13,201,{size:8,weight:600,color:finish==='holo'?'#5e7d70':'#916d46'});
  text(context,descriptor.finishName,171,201,{size:6,align:'right',color:'#9a8e70'});
  let titleSize=17;
  do{context.font=`600 ${titleSize}px ${FONT}`;if(context.measureText(descriptor.title).width<=158)break;titleSize-=.5;}while(titleSize>10);
  text(context,descriptor.title,13,224,{size:titleSize,weight:600,color:ink,maxWidth:158});
  text(context,'一颗荔枝 · 一路相伴',13,241,{size:6,color:'#8c826a'});
  text(context,finish==='holo'?'✦':finish==='foil'?'✧':'◇',171,242,{size:10,align:'right',color:'#9a7a4c'});
  drawStub(context,texture,descriptor);
  context.strokeStyle=finish==='foil'?'#b29349':finish==='holo'?'#89a997':'#b5aa8980';
  context.lineWidth=.7;context.strokeRect(6,5,172,298);
  context.strokeStyle=finish==='foil'?'#b59b5b':finish==='holo'?'#a1b5a1':'#c7b990';
  context.lineWidth=.6;context.beginPath();context.moveTo(0,.3);context.lineTo(184,.3);context.moveTo(0,307.7);context.lineTo(184,307.7);context.stroke();
  // Cut holes after painting so the PNG has true transparent scalloped edges.
  context.save();context.globalCompositeOperation='destination-out';context.fillStyle='#000';
  for(let y=5.5;y<308;y+=11){
    for(const x of [0,184]){context.beginPath();context.arc(x,y,2.8,0,Math.PI*2);context.fill();}
  }
  for(const x of [0,184]){context.beginPath();context.arc(x,250,5,0,Math.PI*2);context.fill();}
  context.restore();
}

export async function createTicketDownload(args) {
  const descriptor=getTicketDownloadDescriptor(args);
  if(typeof document==='undefined'||typeof Image==='undefined')throw new Error('当前环境不支持电子票图片导出，请使用浏览器重试。');
  if(document.fonts?.ready){
    try{await within(document.fonts.ready,10000,'票面字体加载超时，请稍后重试。');}catch{throw new Error('票面字体未能完成加载，请稍后重试。');}
  }
  const [poster,texture]=await Promise.all([
    loadImage(new URL('./assets/calendar-art.png',import.meta.url),'票面海报'),
    loadImage(new URL('./assets/lychee-journey-skin.jpg',import.meta.url),'票根底图'),
  ]);
  const canvas=document.createElement('canvas');canvas.width=descriptor.width;canvas.height=descriptor.height;
  const context=canvas.getContext('2d',{alpha:true});
  if(!context||typeof canvas.toBlob!=='function')throw new Error('当前浏览器不支持高清图片导出，请更换浏览器重试。');
  try{drawTicket(context,descriptor,poster,texture);}catch{throw new Error('电子票绘制失败，请刷新后重试。');}
  const blob=await within(new Promise((resolve,reject)=>{
    try{
      canvas.toBlob(result=>result?.type==='image/png'&&result.size>0?resolve(result):reject(new Error('电子票图片生成失败，请重试。')),'image/png');
    }catch{reject(new Error('电子票图片生成失败，请确认素材可正常加载后重试。'));}
  }),10000,'电子票图片生成超时，请稍后重试。');
  return {blob,filename:descriptor.filename,width:descriptor.width,height:descriptor.height};
}
