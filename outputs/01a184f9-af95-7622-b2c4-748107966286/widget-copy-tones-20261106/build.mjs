import fs from 'node:fs/promises';
import path from 'node:path';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';

const out=import.meta.dirname;
const eyes={1:'含泪忍住',2:'单滴眼泪',3:'双滴眼泪',4:'泪流不止',5:'委屈下垂',6:'汪汪大眼',7:'哭到眯眼',8:'泪眼斜看',9:'困得半眯',10:'睡着弯眼',11:'左右打盹',12:'一眼醒一眼睡',13:'等到翻白眼',14:'冷漠横眼',15:'震惊圆眼',16:'瞳孔地震',17:'左右张望',18:'偷偷侧瞄',19:'委屈内八',20:'一眼大一眼小',21:'阴阳挑眉',22:'气鼓鼓',23:'星光闪闪',24:'心动眼',25:'笑成月牙',26:'开心眨眼',27:'得意眯眼',28:'期待大眼',29:'疑惑高低眉',30:'紧张冒汗',31:'无语豆豆眼',32:'晕乎乎'};
const eye=n=>`${String(n).padStart(2,'0')} ${eyes[n]}`;
const cheeky=[
 ['看到哪儿，\n就从哪儿接班。',28],
 ['进度已就位，\n就差你动手了。',26],
 ['我没催，\n我就探个头。',18],
 ['看不看随你，\n我先占个位置。',27],
 ['4天没续上，\n我都坐麻了。',21],
 ['进度停这儿，\n我都混成保安了。',17],
 ['不急着开演，\n我先练个白眼。',13],
 ['7天没续上，\n我快长蘑菇了。',8],
 ['蘑菇先别管，\n进度还替你留着。',18],
 ['我这双眼睛，\n快等成省略号。',31],
 ['10天没续上，\n进度开始包浆。',21],
 ['别误会，\n我只是路过催一下。',18],
 ['我不说话，\n就拿眼神碰瓷。',6],
 ['进度没挪窝，\n我倒换了个姿势。',20],
 ['14天没续上，\n我成进度钉子户。',31],
 ['点不点随你，\n我先把眼睛摆好。',28],
 ['别看我这样，\n我真没偷偷催。',2],
 ['我已学会，\n用眼神打招呼。',26],
 ['进度没退休，\n只是坐得比较稳。',9],
 ['今天也没挪窝，\n稳得像个钉子户。',27],
 ['这位置不错，\n我先续租一天。',21],
 ['21天没续上，\n我都混成邻居了。',26],
 ['熟人路过，\n要不要顺手续上？',18],
 ['要不你先挑时间，\n我负责瞪大眼。',28],
 ['不催不催，\n我就眨两下眼。',26],
 ['进度我来守，\n主打一个靠谱。',27],
 ['你慢慢安排，\n我继续原地待机。',12],
 ['我先眯一会儿，\n想续了戳醒我。',10],
 ['进度有我守着，\n你先忙你的。',9],
 ['不用给我面子，\n想看再接着看。',25],
 ['30天没续上，\n想续了再叫我。',10],
];
const calm=[
 ['已记住看到哪里，\n随时可以继续。',28],
 ['接着上次的故事，\n按你的节奏看。',26],
 ['上次停在这里，\n有空再接着看。',28],
 ['先忙手边的事，\n想看时再继续。',10],
 ['4天没接着看了，\n进度为你留着。',28],
 ['不用重新寻找，\n从这里继续。',26],
 ['上次还没看完的，\n有空再续。',28],
 ['一周没接着看了，\n想看时接着上次。',9],
 ['上次的故事，\n随时可以接着看。',28],
 ['这里留着你的进度，\n按自己的时间来。',10],
 ['10天未续看，\n仍可从断点继续。',9],
 ['不必重新找进度，\n接着上次就好。',26],
 ['留一点自己的时间，\n继续这段故事。',28],
 ['今天想看时，\n可以从这里开始。',26],
 ['两周没接着看了，\n上次进度还在。',10],
 ['这段故事，\n留给有空的时候。',28],
 ['不急着看完，\n按你的节奏来。',25],
 ['想继续的时候，\n这里可以接上。',26],
 ['上次停下的地方，\n已经替你记住。',28],
 ['有空再看一段，\n进度不用重找。',26],
 ['按自己的安排，\n继续上次的故事。',28],
 ['三周未续看，\n想起时再继续。',10],
 ['想回到这个故事，\n点这里就好。',26],
 ['不赶进度，\n有空再接着看。',25],
 ['先留在这里，\n等你想看时继续。',10],
 ['从上次的位置，\n再看一段故事。',28],
 ['这部还没看完，\n想续时再回来。',26],
 ['也可以先放一放，\n想看时再回来。',10],
 ['现在不想看也没关系，\n进度依然留着。',25],
 ['什么时候想看，\n就什么时候继续。',10],
 ['30天未续看，\n上次的进度还在。',10],
];
const cheekyLong=[
 ['我还在老位置，\n主打一个稳当。',27],
 ['你慢慢挑时间，\n我先保持省电。',12],
 ['想看再点我，\n我随时切回营业。',26],
 ['进度代保管，\n我还挺有职业操守。',21],
 ['进度不跑，\n我也不加戏。',9],
 ['今天先躺平，\n想续了再叫醒我。',10],
 ['没什么大事，\n就是探头看看你。',18],
];
const calmLong=[
 ['上次停在这里，\n想看时再继续。',28],
 ['有空再来看看，\n按自己的节奏。',26],
 ['不着急，\n故事可以慢慢看。',10],
 ['想接着看的时候，\n从这里开始。',28],
 ['进度已经记下，\n随时接着看。',26],
 ['今天不看也没关系，\n想看再继续。',25],
 ['留给有空的时候，\n接着上次的故事。',10],
];
for(const [name,list,expected] of [['cheeky',cheeky,31],['calm',calm,31],['cheekyLong',cheekyLong,7],['calmLong',calmLong,7]]){
 if(list.length!==expected)throw new Error(`${name}: count mismatch`);
 if(new Set(list.map(x=>x[0])).size!==list.length)throw new Error(`${name}: duplicate copy`);
 for(const [text,id] of list){
  if(!eyes[id])throw new Error(`${name}: missing eye ${id}`);
  if(text.split('\n').length!==2||text.split('\n').some(line=>[...line].length>12))throw new Error(`${name}: long line ${text}`);
 }
}
const stage=day=>day<4?'普通续看':day<7?'轻轻提醒':day<10?'一周未续':day<14?'俏皮等待':day<21?'两周未续':day<30?'逐渐放缓':'长期温和';
const rows=cheeky.map(([text,id],day)=>[day,stage(day),text,eye(id),calm[day][0],eye(calm[day][1])]);
cheekyLong.forEach(([text,id],i)=>rows.push([`31天后池${i+1}`,'7条循环',text,eye(id),calmLong[i][0],eye(calmLong[i][1])]));

const wb=Workbook.create();
const sheet=wb.worksheets.add('双风格文案对照');
sheet.showGridLines=false;
sheet.tabColor='#445F53';
const full=sheet.getRange('A1:F57');
full.format.font={name:'Arial',size:11,color:'#25332C'};
full.format.rowHeightPx=28;
full.format.verticalAlignment='center';
[96,116,282,150,282,150].forEach((width,i)=>sheet.getRange(`${String.fromCharCode(65+i)}1:${String.fromCharCode(65+i)}57`).format.columnWidthPx=width);
sheet.getRange('A2').values=[['连续未续看文案：贱嗖嗖版与平静版']];
sheet.getRange('A2:F2').format.font={name:'Arial',size:16,bold:true,color:'#25332C'};
sheet.getRange('A2:F2').format.rowHeightPx=36;
sheet.getRange('A3:F3').format.borders={bottom:{style:'thin',color:'#DAE2DC'}};
sheet.getRange('A4').values=[['同一天数、同一触发规则，只比较语气。每版0—30天各一条，31天起各有7条循环。']];
sheet.getRange('A4:F4').format.font={name:'Arial',size:11,color:'#6E7B73'};
sheet.getRange('A6:F6').values=[['未续看天数','阶段','贱嗖嗖版','搭配眼睛','平静版','搭配眼睛']];
sheet.getRange('A6:F6').format={fill:'#2C3D34',font:{name:'Arial',size:11,bold:true,color:'#FFFFFF'},horizontalAlignment:'center',verticalAlignment:'center',rowHeightPx:38};
sheet.getRange('C6:D6').format.fill='#624351';
sheet.getRange('E6:F6').format.fill='#445F53';
sheet.getRange('A7:F44').values=rows;
sheet.getRange('A7:F44').format.wrapText=true;
sheet.getRange('A7:F44').format.rowHeightPx=63;
sheet.getRange('A7:A37').setNumberFormat('0"天"');
for(let row=7;row<=44;row++){
 if(row%2===0)sheet.getRange(`A${row}:F${row}`).format.fill='#F3F6F2';
 sheet.getRange(`A${row}:F${row}`).format.borders={bottom:{style:'thin',color:'#DFE5DF'}};
 if([4,7,10,14,21,30].includes(row-7))sheet.getRange(`A${row}:B${row}`).format.fill='#FFF2D9';
}
sheet.freezePanes.freezeRows(6);
sheet.getRange('A47').values=[['共用规则']];
sheet.getRange('A47:F47').format.font={name:'Arial',size:12,bold:true,color:'#445F53'};
const notes=[
 '只对有待看正片且观看记录可信的用户启用。已追平、单纯等更新或全剧看完时，不用本催看池。',
 '天数指本轮出现待看内容后，连续未有效观看本剧的自然日数，不是未打开App或安装天数。',
 '本轮待看起始时间与本剧最近有效观看时间取较晚者计时；有效观看后重置，追平后清空。',
 '实际上新当天（含收官）优先基础更新或收官文案；其余日期4天起用日池。0—3天为候选基础文案。',
 '31天起按天轮换7条长期池。每自然日保持一条，业务状态改变时重新选，不增加系统刷新或通知。',
 '建议同一用户先保持同一种人设，句子按天变化，不每天随机切换两套性格。正式策略和字段需研发对齐。',
 '贱嗖嗖版以自嘲和撒娇为主，30天后也放缓；不使用羞辱、权益威胁或“没看越久哭越惨”的升级链。',
 '平静版以续看便利和用户自己的节奏为主，不配夸张哭泣或生气表情。眼睛编号对应新增32款素材包。',
 '右侧只替换文案与表情；剧名、实际上线信息、真实观看进度仍固定左下角。无可靠计时时回退基础文案。',
];
notes.forEach((text,i)=>sheet.getRange(`A${48+i}`).values=[[text]]);
sheet.getRange('A48:F56').format.font={name:'Arial',size:11,color:'#69776E'};

wb.recalculate();
console.log((await wb.inspect({kind:'table',range:'双风格文案对照!A11:F17',include:'values,formulas',tableMaxRows:7,tableMaxCols:6,maxChars:2200})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:20},summary:'final error scan',maxChars:500})).ndjson);
for(const [range,file] of [['A1:F18','top-preview.png'],['A19:F32','middle-preview.png'],['A33:F57','end-preview.png']]){
 const preview=await wb.render({sheetName:'双风格文案对照',range,scale:1.25,format:'png'});
 await fs.writeFile(path.join(out,file),new Uint8Array(await preview.arrayBuffer()));
}
await fs.writeFile(path.join(out,'copy-data.json'),JSON.stringify({cheeky,calm,cheekyLong,calmLong},null,2)+'\n');
const file=path.join(out,'连续未续看文案_贱嗖嗖与平静双版本_20261106.xlsx');
const xlsx=await SpreadsheetFile.exportXlsx(wb); await xlsx.save(file);
console.log(JSON.stringify({file,styles:2,dailyPerStyle:31,longTermPerStyle:7,copyCount:76}));
