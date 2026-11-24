import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Workbook,SpreadsheetFile,FileBlob} from '@oai/artifact-tool';
import {getStudyPalette,FIGMA_COLOR_SOURCE} from '../../dist/widget-atlas-palettes.mjs';

const base='./tmp/widget_copy_strategy_20261102';
const outputDir='./outputs/01a184f9-af95-7622-b2c4-748107966286';
const outputPath=`${outputDir}/腾讯视频小组件每日文案策略_v0.2_20261102.xlsx`;
const early=JSON.parse(await fs.readFile(`${base}/days_01_13.json`,'utf8'));
const late=JSON.parse(await fs.readFile(`${base}/days_14_30.json`,'utf8'));
const days=[...early,...late].map(item=>({
  day:item.day,line1:item.line1,line2:item.line2,
  eye:item.eye_action||item.eyeAction,intent:item.design_intent||item.intent,
}));
// Avoid repeating D8's settling-in joke at D18.
Object.assign(days.find(item=>item.day===18),{line1:'摆得很正，',line2:'态度很松。',eye:'静态：眼形端正，双瞳轻轻侧偏。可选一次慢眨。',intent:'用端正姿态和松弛态度制造反差。'});

const phases=[
  {id:'P1',name:'顺手续看',start:1,end:2,mood:'ready',theme:'保存进度，像熟人接话',eye:'正常眼／轻侧目',line:'人是走了，\n进度还在这。'},
  {id:'P2',name:'轻轻试探',start:3,end:6,mood:'waiting',theme:'把等待写成自己的小动作',eye:'偷瞄／半眯／轻失焦',line:'我不着急，\n眼睛先急了。'},
  {id:'P3',name:'桌面住户',start:7,end:13,mood:'resting',theme:'开始在桌面安顿的小故事',eye:'环顾／放松／装淡定',line:'一周过去，\n我熟悉这儿了。'},
  {id:'P4',name:'摆件营业',start:14,end:20,mood:'evening',theme:'14天换身份，自封桌面摆件',eye:'节点睁圆，其余半眯／发呆',line:'本摆件，\n正式营业。'},
  {id:'P5',name:'久别熟人',start:21,end:29,mood:'waiting',theme:'21天换关系，像老朋友招呼',eye:'单眼招呼／歪眼／轻失焦',line:'老熟人了，\n眨眼算招呼。'},
  {id:'P6',name:'长期常驻',start:30,end:Infinity,mood:'returned',theme:'30天自夸开场，之后轻松常驻',eye:'节点笑弧，之后温和变换',line:'隆重宣布：\n我还挺可爱。'},
];
const phaseFor=day=>phases.find(item=>day>=item.start&&day<=item.end);
const colorLabel=phase=>`H${getStudyPalette(phase.mood).hue}`;
const phaseById=Object.fromEntries(phases.map(item=>[item.id,item]));

const loopLines=[
  ['今日状态：','可爱且待机。','半眯眼，瞳孔居中'],
  ['别紧张，','我只占桌面。','双瞳小幅侧偏'],
  ['我很忙的，','忙着不打扰。','一眼略抬，一眼放松'],
  ['眼神已就位，','台词慢点来。','圆眼，双瞳向上'],
  ['今天的风格，','安静地抢眼。','上眼睑略弯，轻侧目'],
  ['没啥新事情，','先眨个眼。','静态单眼闭弧'],
  ['躺平这方面，','我略懂一点。','两眼轻斜，半眯'],
  ['今天也在，','并没有很得意。','一眼睁圆，一眼笑弯'],
  ['本组件，','情绪很稳定。','平静细长眼'],
  ['你忙你的，','我先练个眼神。','两眼高低错位'],
  ['没别的安排，','就在这儿待着。','自然圆眼，视线居中'],
  ['别看我小，','我挺能待机。','半眯眼，瞳孔微向内'],
  ['进度替你留，','我先歇一下。','双眼放松成细弧'],
  ['熟面孔了，','不用重新介绍。','一眼笑弯，一眼看向前'],
];

const exceptions=[
  ['今天已看','全站今天已有有效长视频观看；有可续看目标','行，来过就行。','今天不闹你。','开心圆眼／星形眼','H160','发生有效观看后当日可切换；不是只打开App'],
  ['今天已看','同上，次日不再符合则按当前D命中','进度往前了，','我也开心了。','笑弯眼','H160','今天池3条，同账号同日固定一条'],
  ['今天已看','同上','刚刚看过，','先歇一会儿吧。','放松圆眼','H160','不以连续观看作为奖励'],
  ['晚间等待','D为1或2；18:00≤当前时间＜22:00','今晚有空？','给你留了位置。','轻期待，侧目','H20','覆盖D1–2日间台词，不覆盖D3及以后阶段'],
  ['晚间等待','同上','白天辛苦了，','有空坐一会儿。','放松抬眼','H20','晚间池3条，同账号同日固定一条'],
  ['晚间等待','同上','你的进度，','还在原地等你。','看向底部进度','H20','不声称手机已打开或用户正在划屏'],
  ['安静时段','有续看目标且今天未看；22:00至次日08:00','先好好休息，','有空再接着看。','柔和半眯眼','沿用当前阶段','优先换温和台词，保留阶段颜色，不因深色模式加重情绪'],
  ['安静时段','同上','我先安静，','进度替你留着。','瞳孔居中，放松眼','沿用当前阶段','通用夜间池3条，同日稳定；允许进出时段换池'],
  ['安静时段','同上','晚点再见，','不用赶着来。','静态闭弧眼','沿用当前阶段','今天已看／无待续看／异常态不被夜间覆盖'],
  ['暂无待续看','所有可用历史均无可续看目标','进度先放好，','我也歇会儿。','舒展笑弧眼','H200','优先于离开天数；不伪造更新或新剧情'],
  ['无有效历史','已登录但没有有效长视频历史','初次见面，','先混个眼熟。','正常圆眼','H80','不展示虚构标题、期数或进度'],
  ['尚未登录','未登录，或已登出','先认个门，','登录后接着看。','轻期待圆眼','H80','不展示前账号历史'],
  ['暂无可播','没有其他可播续看目标','这会儿播不了，','先歇一会儿吧。','柔和半眯眼','H200','不绕过会员、版权或地区限制'],
];

assert.equal(days.length,30);
assert.deepEqual(days.map(d=>d.day),Array.from({length:30},(_,i)=>i+1));
for(const row of [...days,...loopLines.map(([line1,line2])=>({line1,line2})),...exceptions.map(item=>({line1:item[2],line2:item[3]}))]) {
  assert.ok([...row.line1].length<=8,`too long: ${row.line1}`);
  assert.ok([...row.line2].length<=8,`too long: ${row.line2}`);
}
const combined=days.map(item=>item.line1+item.line2);
assert.equal(new Set(combined).size,30,'every day has a distinct full line pair');
assert.equal(new Set(loopLines.map(item=>item[0]+item[1])).size,14);
assert.notEqual(combined.at(-1),loopLines[0][0]+loopLines[0][1]);
assert.notEqual(loopLines[13][0]+loopLines[13][1],loopLines[0][0]+loopLines[0][1]);
for(let d=1;d<=365;d++) {
  const current=d<=30?days[d-1]:{line1:loopLines[(d-31)%14][0],line2:loopLines[(d-31)%14][1]};
  if(d>1) {
    const previous=d-1<=30?days[d-2]:{line1:loopLines[(d-32)%14][0],line2:loopLines[(d-32)%14][1]};
    assert.notEqual(current.line1+current.line2,previous.line1+previous.line2,`adjacent repeat D${d}`);
  }
}

const wb=Workbook.create();
const overview=wb.worksheets.add('阶段策略');
const daily=wb.worksheets.add('每日文案');
const rules=wb.worksheets.add('触发与兜底');

function formatSheet(sheet,title,note,widths,rows=50) {
  sheet.showGridLines=false;
  const col=String.fromCharCode(64+widths.length);
  const used=sheet.getRange(`A1:${col}${rows}`);
  used.format.font={name:'Arial',size:11,color:'#26332E'};
  used.format.verticalAlignment='center';
  used.format.rowHeight=30;
  widths.forEach((width,i)=>sheet.getRange(`${String.fromCharCode(65+i)}1:${String.fromCharCode(65+i)}${rows}`).format.columnWidthPx=width);
  sheet.getRange('A2').values=[[title]];
  sheet.getRange('A2').format.font={name:'Arial',size:16,bold:true,color:'#1D2924'};
  sheet.getRange('A2').format.rowHeight=34;
  sheet.getRange('A3').values=[[note]];
  sheet.getRange('A3').format.font={name:'Arial',size:10,color:'#68776D'};
  sheet.getRange('A3').format.rowHeight=30;
  sheet.getRange(`A4:${col}4`).format.borders={bottom:{style:'thin',color:'#D5DDD6'}};
}

function makeTable(sheet,name,start,headers,rows,rowHeight=66) {
  const end=start+rows.length, col=String.fromCharCode(64+headers.length);
  const range=sheet.getRange(`A${start}:${col}${end}`);
  range.values=[headers,...rows];
  range.format.wrapText=true;
  range.format.rowHeight=rowHeight;
  const table=sheet.tables.add(`A${start}:${col}${end}`,true,name);
  table.showFilterButton=true;
  table.style='TableStyleLight1';
  sheet.getRange(`A${start+1}:${col}${end}`).format.fill='#FFFFFF';
  rows.forEach((_,index)=>{
    if(index%2===0) sheet.getRange(`A${start+1+index}:${col}${start+1+index}`).format.fill='#F4F6F3';
  });
  const head=sheet.getRange(`A${start}:${col}${start}`);
  head.format.fill='#29372F';
  head.format.font={name:'Arial',size:11,bold:true,color:'#FFFFFF'};
  head.format.horizontalAlignment='center';
  head.format.rowHeight=32;
  head.format.borders={insideVertical:{style:'thin',color:'#FFFFFF'}};
  return {table,end,col};
}

formatSheet(overview,'小组件每日文案策略 V0.2','提案 2026.11.02。按未观看天数换情境与眼神，不逐步加重催促。新增14／21／30天分段，尚未同步Demo或PRD。',[126,102,210,170,196,70,122,122,186,94],23);
overview.tabColor='#29372F';
const phaseRows=phases.map(phase=>{
  const light=getStudyPalette(phase.mood,'light-solid');
  const dark=getStudyPalette(phase.mood,'dark-solid');
  return [phase.name,phase.start===30?'30天及以上':`${phase.start}–${phase.end}天`,phase.theme,phase.line,phase.eye,`H${light.hue}`,light.top,dark.top,phase.start===30?'D30节点台词；D31起14条循环':'阶段内逐日不同，按当前D直达', '待评审'];
});
makeTable(overview,'PhaseStrategy',5,['阶段','未观看间隔','表达方向','阶段起点文案','眼神方向','色相','浅色纯色','深色纯色','命中方式','审核状态'],phaseRows,60);
for(const col of ['B','F','J']) overview.getRange(`${col}6:${col}11`).format.horizontalAlignment='center';
phases.forEach((phase,i)=>{
  const row=i+6;
  const light=getStudyPalette(phase.mood,'light-solid'),dark=getStudyPalette(phase.mood,'dark-solid');
  overview.getRange(`G${row}`).format.fill=light.top;
  overview.getRange(`G${row}`).format.font={name:'Arial',size:11,color:light.ink};
  overview.getRange(`H${row}`).format.fill=dark.top;
  overview.getRange(`H${row}`).format.font={name:'Arial',size:11,color:dark.ink};
  overview.getRange(`D${row}`).format.font={name:'Arial',size:12,bold:true};
});
overview.getRange('J6:J11').dataValidation={rule:{type:'list',values:['待评审','通过','需修改']}};
overview.getRange('A13').values=[['D为距账号最近一次有效长视频观看的自然日差，暂按UTC+8；不是App未打开天数，也不是某部剧的离开天数。']];
overview.getRange('A14').values=[['1×1／1×3共用台词与进度。颜色随阶段变化，浅／深色是系统外观；静态表情为基准，可选动效需研发确认。']];
overview.getRange('A15').values=[['色值沿用项目Figma原色；上述阶段色彩分配为新提案。浅色渐变仍用C1到80% C1＋20% C2，深色渐变用C4到C3。']];
overview.getRange('A16').values=[['7天以后仍可有梗，通过换身份、姿态和语境保持变化；不把未观看包装成惩罚、任务、奖励损失或病态恐吓。']];
overview.getRange('A18').values=[['取色来源']];
overview.getRange('B18').values=[[FIGMA_COLOR_SOURCE]];
overview.getRange('A19').values=[['策略依据']];
overview.getRange('B19').values=[['老板反馈：每天可不同，14、21、30天可分阶段变化。全部台词为本项目原创提案。']];
overview.getRange('A13:J19').format.font={name:'Arial',size:10,color:'#69776D'};
overview.getRange('A13:J19').format.rowHeight=28;

formatSheet(daily,'每日文案明细','默认日间台词。D1–D30逐日命中；D31起14条循环。同日不随机跳词，节点不补播，全部文案与表情待评审。',[76,82,120,144,154,288,260,76,98],63);
daily.tabColor='#6A8574';
const dayRows=days.map(item=>{
  const phase=phaseFor(item.day);
  return [item.day,[7,14,21,30].includes(item.day)?'阶段起点':'日常',phase.name,item.line1,item.line2,item.eye,item.intent,colorLabel(phase),'待评审'];
});
makeTable(daily,'DailyCopy',5,['未观看天数','节点','阶段','上句','下句','眼神及可选动效','设计意图','色彩组','审核状态'],dayRows,70);
daily.getRange('A6:A35').setNumberFormat('0"天"');
daily.getRange('A6:B35').format.horizontalAlignment='center';
daily.getRange('H6:I35').format.horizontalAlignment='center';
daily.getRange('I6:I35').dataValidation={rule:{type:'list',values:['待评审','通过','需修改']}};
daily.freezePanes.freezeRows(5);
daily.freezePanes.freezeColumns(3);
for(const item of days) {
  const row=item.day+5, phase=phaseFor(item.day),palette=getStudyPalette(phase.mood,'light-solid');
  daily.getRange(`C${row}`).format.fill=palette.top;
  daily.getRange(`C${row}`).format.font={name:'Arial',size:11,color:palette.ink};
  if([7,14,21,30].includes(item.day)) {
    daily.getRange(`A${row}:I${row}`).format.borders={top:{style:'medium',color:'#8B9D90'}};
    daily.getRange(`B${row}`).format.fill=palette.top;
    daily.getRange(`B${row}`).format.font={name:'Arial',size:11,bold:true,color:palette.ink};
    daily.getRange(`D${row}:E${row}`).format.font={name:'Arial',size:12,bold:true};
  }
}
daily.getRange('A38').values=[['30天后循环池']];
daily.getRange('A38').format.font={name:'Arial',size:14,bold:true};
daily.getRange('A39').values=[['D31、45、59…用L01，D44、58、72…用L14。索引＝1＋MOD(D−31,14)；只在D≥31且未被高优先级状态覆盖时使用。']];
daily.getRange('A39').format.font={name:'Arial',size:10,color:'#69776D'};
const loopRows=loopLines.map((item,i)=>[`L${String(i+1).padStart(2,'0')}`,31+i,'长期常驻',item[0],item[1],`静态：${item[2]}。动效可选，不强依赖。`,'保持轻欠的自我调侃；不强调精确离开时长。',colorLabel(phaseById.P6),'待评审']);
makeTable(daily,'LongTermCopy',41,['文案ID','首轮命中日','阶段','上句','下句','眼神及可选动效','设计意图','色彩组','审核状态'],loopRows,60);
daily.getRange('B42:B55').setNumberFormat('0"天"');
daily.getRange('A42:B55').format.horizontalAlignment='center';
daily.getRange('H42:I55').format.horizontalAlignment='center';
daily.getRange('I42:I55').dataValidation={rule:{type:'list',values:['待评审','通过','需修改']}};

formatSheet(rules,'触发与兜底','先判账号、可播和无待续看，再判今天是否有效观看，最后命中天数阶段。夜间只收敛等待态，不覆盖今天已看或兜底。',[134,306,154,154,196,122,350],50);
rules.tabColor='#A4B5A6';
const specialRows=exceptions.map(item=>[item[0],item[1],item[2],item[3],item[4],item[5],item[6]]);
makeTable(rules,'SpecialCopy',5,['状态','触发条件','上句','下句','静态眼神方向','色彩组','覆盖与边界'],specialRows,66);
rules.freezePanes.freezeRows(5);
const ops=[
  ['日数计算','D＝当前自然日减账号最近有效长视频观看自然日，暂按UTC+8；有效观看和完成标准沿用客户端。'],
  ['普通日间','D1–2且不在晚间／安静时段使用对应日文案；普通续看不要求每天观看。'],
  ['每日命中','直接按当前D查表，不依赖每天打开。缺席中间几天不补播，D20首次刷新直接取D20，不先演D14。'],
  ['同日稳定','D1–30同账号、同日、同状态与时段固定一条；尺寸切换、同账号刷新不换词，不用随机抽签。'],
  ['特殊池轮换','今天已看／晚间／夜间各3条，按账号固定偏移＋自然日序号对3取模；同日固定，不按打开次数计数。'],
  ['节点与循环','7／14／21／30只是阶段起点。D30仅节点日命中；D31起14条按D循环，跨轮首尾不相邻重复。'],
  ['有效观看后','有真实有效观看即转今天已看，并重算D；仅打开App、点击组件、看预告或手动换展示内容都不重置D。'],
  ['内容切换','续看目标取最近可续看的长视频；情绪取全站最近有效观看。今天看综艺不能仍因旧电视剧七天没看而催促。'],
  ['夜间覆盖','等待态在22:00–次日08:00用夜间池，阶段色保留，眼神放松。退出后按当前D恢复；这是同日固定规则的明确例外。'],
  ['账号与隐私','切账号／登出清除旧账号台词快照、日数和进度；不能沿用前账号历史。已删除或失效记录不继续展示。'],
  ['尺寸与内容','1×1／1×3同一份标题、台词、表情状态和进度。标题截断不丢已看时间；正文不引用特定剧名、集数或未验证更新。'],
  ['原生刷新','按系统允许的刷新时机展示当前策略，不承诺零点准时变更；动效仅设计想法，静态表情必须成立。'],
  ['上线前确认','待确认天数阈值、夜间时段、文案审核、内容合规、历史同步和原生尺寸／刷新能力。此表不代表已实现或已上线。'],
];
rules.getRange('A21').values=[['执行规则']];
rules.getRange('A21').format.font={name:'Arial',size:14,bold:true};
makeTable(rules,'DeliveryRules',23,['规则','执行口径'],ops,64);
rules.getRange('A24:A36').format.wrapText=true;
// Rule descriptions get a wide, dedicated column, rather than text spilling.
// Keep it on the same sheet without merging any working cells.
rules.getRange('B24:B36').format.wrapText=true;
rules.getRange('B24:B36').format.rowHeight=76;

wb.recalculate();
console.log((await wb.inspect({kind:'table',range:'阶段策略!A5:J11',include:'values',tableMaxRows:7,tableMaxCols:4,maxChars:2400})).ndjson);
console.log((await wb.inspect({kind:'table',range:'每日文案!A18:I19',include:'values',tableMaxRows:2,tableMaxCols:5,maxChars:1600})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:40},summary:'error scan'})).ndjson);
await fs.mkdir(outputDir,{recursive:true});
for(const [name,range,filename] of [
  ['阶段策略','A1:J19','phase-preview.png'],
  ['每日文案','A15:I21','daily-milestone-preview.png'],
  ['每日文案','A31:I35','day30-preview.png'],
  ['每日文案','A38:I45','longterm-preview.png'],
  ['触发与兜底','A1:G18','exceptions-preview.png'],
  ['触发与兜底','A21:B28','rules-preview.png'],
]) {
  const preview=await wb.render({sheetName:name,range,scale:1,format:'png'});
  await fs.writeFile(`${base}/${filename}`,new Uint8Array(await preview.arrayBuffer()));
}
const file=await SpreadsheetFile.exportXlsx(wb);
await file.save(outputPath);
const imported=await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));
assert.equal(imported.worksheets.items.length,3);
assert.deepEqual(imported.worksheets.getItem('每日文案').getRange('D19:E19').values,[['本摆件，','正式营业。']]);
assert.deepEqual(imported.worksheets.getItem('每日文案').getRange('D26:E26').values,[['老熟人了，','眨眼算招呼。']]);
assert.deepEqual(imported.worksheets.getItem('每日文案').getRange('D35:E35').values,[['隆重宣布：','我还挺可爱。']]);
console.log(JSON.stringify({outputPath,dailyCount:days.length,loopCount:loopLines.length,specialCount:exceptions.length,lineLimit:8,adjacentRepeatScan:'D1–D365 clear'}));
