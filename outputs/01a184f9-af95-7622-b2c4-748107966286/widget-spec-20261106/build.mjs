import fs from 'node:fs/promises';
import path from 'node:path';
import {Workbook, SpreadsheetFile} from '@oai/artifact-tool';

const out=import.meta.dirname;
const wb=Workbook.create();
const rules=wb.worksheets.add('状态规则');
const copy=wb.worksheets.add('每日文案池');
const colors={ink:'#25332C',green:'#365448',line:'#DDE5DF',pale:'#F2F6F2',muted:'#65736B',gold:'#FFF4DB'};
function setup(sheet,columns,lastRow){
  sheet.showGridLines=false;
  const lastCol=String.fromCharCode(64+columns.length);
  const area=sheet.getRange(`A1:${lastCol}${lastRow}`);
  area.format.font={name:'Arial',size:11,color:colors.ink};
  area.format.verticalAlignment='center';
  area.format.rowHeightPx=28;
  columns.forEach((width,i)=>sheet.getRange(`${String.fromCharCode(65+i)}1:${String.fromCharCode(65+i)}${lastRow}`).format.columnWidthPx=width);
  sheet.getRange(`A2:${lastCol}2`).format.font={name:'Arial',size:16,bold:true,color:colors.ink};
  sheet.getRange(`A2:${lastCol}2`).format.rowHeightPx=35;
  sheet.getRange(`A3:${lastCol}3`).format.borders={bottom:{style:'thin',color:colors.line}};
  sheet.getRange(`A6:${lastCol}6`).format={fill:colors.green,font:{name:'Arial',size:11,bold:true,color:'#FFFFFF'},wrapText:true,horizontalAlignment:'center',verticalAlignment:'center',rowHeightPx:38};
  sheet.freezePanes.freezeRows(6);
  sheet.tabColor=colors.green;
}

setup(rules,[66,90,170,132,282,242,112,158],32);
rules.getRange('A2').values=[['小组件状态与展示规则 V0.3（草案）']];
rules.getRange('A4').values=[['先确定剧集阶段和观看进度，再按今日排播细分。表中《花开锦绣》、集数和时间均为示例。']];
rules.getRange('A4:H4').format.font={name:'Arial',size:11,color:colors.muted};
rules.getRange('A6:H6').values=[['编号','剧集阶段','今天的更新情况','用户进度','左下角固定信息','右侧基础文案','小眼睛','主操作']];
const matrix=[
 ['U1','更新期','有计划，尚未实际上线','有待看','花开锦绣\n今晚20:00预计更9—10集\n第8集 · 已看13:32','新集还在路上，\n先接着上次看。','02 期待等你','继续观看\n回真实断点'],
 ['U2','更新期','有计划，尚未实际上线','已追平','花开锦绣\n今晚20:00预计更9—10集\n已看完第8集 · 已追平','新集还在路上，\n我先替你等。','05 放松躺平','查看排期'],
 ['U3','更新期','今天已有新集实际上线','有待看','花开锦绣\n今日更新至第10集\n第8集 · 已看13:32','新集到了，\n就差你了。','01 机灵侧目','继续观看\n回真实断点'],
 ['U4','更新期','今天已有新集实际上线','已追平','花开锦绣\n今日更新至第10集\n已看完第10集 · 已追平','今天的份看完，\n我先躺会儿。','04 星星眼','查看后续排期'],
 ['U5','更新期','今天确认无更新计划','有待看','花开锦绣\n今日休更 · 更新至第10集\n第8集 · 已看13:32','今天不更新，\n进度还在这。','01 机灵侧目','继续观看\n回真实断点'],
 ['U6','更新期','今天确认无更新计划','已追平','花开锦绣\n周四20:00预计更9—10集\n已看完第8集 · 已追平','你已追平，\n我陪你等更新。','05 放松躺平','查看排期'],
 ['F1','完结期','全部正片已实际上线','未看完','花开锦绣\n全24集已完结\n第18集 · 已看13:32','故事已到终点，\n你还差一段。','02 期待等你','继续观看\n回真实断点'],
 ['F2','完结期','全部正片已实际上线','全剧看完','花开锦绣\n全24集已完结\n已看完24/24集','这部收工，\n下部再约。','04 星星眼','本剧详情\n不再催看本剧'],
];
rules.getRange('A7:H14').values=matrix;
rules.getRange('A7:H14').format.wrapText=true;
rules.getRange('A7:H14').format.rowHeightPx=94;
for(let row=7;row<=14;row++) {
  if(row%2===0) rules.getRange(`A${row}:H${row}`).format.fill=colors.pale;
  rules.getRange(`A${row}:H${row}`).format.borders={bottom:{style:'thin',color:colors.line}};
}
rules.getRange('A16').values=[['布局与判断口径']];
rules.getRange('A16:H16').format.font={name:'Arial',size:12,bold:true,color:colors.green};
const notes=[
 '左下角统一三行：剧名、更新或完结信息、个人观看进度。两种尺寸保持同字段、同顺序。',
 '右侧只放短文案和表情；首页、下载入口沿用现有结构。主操作指文案区或续看区点击。',
 '已追平指已看完目前实际上线的全部正片；全剧看完指全部正片均看完，不能仅凭最后一集判断。',
 '优先级：官方确认完结且全部正片实际上线，先用F1/F2；否则再按更新期U1—U6判断。',
 '到预计时间不等于实际上线。今天分批更新时，已上线写事实，后续批次仍标“预计”。',
 '有待看即存在未看完的已上线正片；当前集未看完优先续当前集，不直接跳最新集。',
 '缺排期不写“今日休更”；缺观看历史不写“已追平”。保留可信信息，不判断未知状态。',
 '下架失效内容退出续看催促；会员权限不足不算已追平，点击沿用客户端既有鉴权与兜底。',
 '完结未看完可加经审核且无剧透的剧情钩子；首版先用通用故事文案，不依赖逐剧运营素材。',
 '4天起有待看可换日池，但实际上新当天优先更新或收官文案；已追平和全剧看完不启用日池。',
 '首期目标剧来自追剧日历当前在追剧；扩展多剧轮播和跨品类切换另行定义，不混入本表。',
 '研发需对齐：剧集阶段、今日预计排播、实际上线正片、单集观看记录、后续排播、提醒计时。',
 '本表为2026-11-06讨论草案。阈值、计时起点、有效观看标准、播放及跳转能力需与研发确认。',
];
notes.forEach((note,i)=>rules.getRange(`A${17+i}`).values=[[note]]);
rules.getRange('A17:H29').format.font={name:'Arial',size:11,color:colors.muted};

setup(copy,[86,142,364,142,394],55);
copy.tabColor='#7D9A88';
copy.getRange('A2').values=[['每日文案池']];
copy.getRange('A4').values=[['仅有待看时启用。实际上新当天优先状态文案；其他日期4天起可换每日文案与表情。']];
copy.getRange('A4:E4').format.font={name:'Arial',size:11,color:colors.muted};
copy.getRange('A6:E6').values=[['天数','阶段','右侧文案','主用小眼睛','使用规则']];
const daily=[
 ['进度还在，\n接着上次看。','01 机灵侧目'],
 ['上次没看完的，\n今天接着？','02 期待等你'],
 ['剧情先暂停，\n进度替你存着。','01 机灵侧目'],
 ['你先忙，\n有空回来接着看。','02 期待等你'],
 ['4天没续上，\n进度还在这。','02 期待等你'],
 ['座位留好了，\n就等你坐下。','01 机灵侧目'],
 ['进度替你守着，\n要来接班吗？','01 机灵侧目'],
 ['一周没续上，\n我还在原地等。','03 半眯无语'],
 ['再不接着看，\n我要长蘑菇了。','03 半眯无语'],
 ['剧情先按住，\n等你来继续。','03 半眯无语'],
 ['10天没续上，\n进度可没跑路。','03 半眯无语'],
 ['我都坐热了，\n你来换个班？','03 半眯无语'],
 ['上次停在这，\n今天再走一段？','01 机灵侧目'],
 ['等得眼睛都眯了，\n还不来看看？','03 半眯无语'],
 ['两周没续上，\n进度还认得你。','03 半眯无语'],
 ['你忙你的，\n故事替你留着。','02 期待等你'],
 ['不是催你，\n就是探个头。','01 机灵侧目'],
 ['进度存好了，\n想看就回来。','02 期待等你'],
 ['上次的故事，\n还等你接下句。','02 期待等你'],
 ['今天路过，\n要不要接着看？','01 机灵侧目'],
 ['不用从头来，\n咱们接着上次。','01 机灵侧目'],
 ['三周没续上，\n要回来坐坐吗？','02 期待等你'],
 ['好久没接上，\n进度还在这。','02 期待等你'],
 ['不着急，\n有空再看也行。','05 放松躺平'],
 ['你挑时间，\n我留进度。','01 机灵侧目'],
 ['想续的时候，\n这里还有一段。','02 期待等你'],
 ['故事没忘，\n等你想起来。','02 期待等你'],
 ['路过看看，\n不续也没关系。','05 放松躺平'],
 ['不催啦，\n想看再来找我。','05 放松躺平'],
 ['先留个位置，\n有空再来。','02 期待等你'],
 ['30天没续上，\n想看时我还在。','05 放松躺平'],
];
const stage=day=>day<4?'普通续看':day<7?'轻轻提醒':day<10?'一周未续':day<14?'俏皮等待':day<21?'两周未续':day<30?'三周未续':'温和长期';
const rows=daily.map(([text,eyes],day)=>[day,stage(day),text,eyes,day<4?'候选基础文案；当日更新或等待文案优先':'非实际上新当天可用；只换右侧，不改更新事实与进度']);
const longCopies=[
 ['进度留在这，\n想看随时来。','02 期待等你'],
 ['慢慢来，\n故事等得起。','05 放松躺平'],
 ['有空的时候，\n接着上次看。','01 机灵侧目'],
 ['今天打个照面，\n不催你。','05 放松躺平'],
 ['你选时间，\n我守进度。','02 期待等你'],
 ['路过这里，\n要坐一会儿吗？','01 机灵侧目'],
 ['想起来再看，\n也来得及。','02 期待等你'],
];
longCopies.forEach(([text,eyes],i)=>rows.push([`31天后池${i+1}`,'温和长期',text,eyes,'第31天起每自然日切换一条，7条循环；不升级恐吓或损失暗示']));
copy.getRange(`A7:E${6+rows.length}`).values=rows;
copy.getRange(`A7:E${6+rows.length}`).format.wrapText=true;
copy.getRange(`A7:E${6+rows.length}`).format.rowHeightPx=60;
for(let row=7;row<=6+rows.length;row++){
  if(row%2===0)copy.getRange(`A${row}:E${row}`).format.fill=colors.pale;
  if([4,7,10,14,21,30].includes(row-7))copy.getRange(`A${row}:B${row}`).format.fill=colors.gold;
  copy.getRange(`A${row}:E${row}`).format.borders={bottom:{style:'thin',color:colors.line}};
}
copy.getRange('A7:A37').setNumberFormat('0"天"');
copy.getRange('A47').values=[['计时与轮换规则']];
copy.getRange('A47:E47').format.font={name:'Arial',size:12,bold:true,color:colors.green};
const clockNotes=[
 '天数建议：本轮有待看内容后，连续未有效观看本剧的自然日数。按北京时间日期计算，不是未打开App天数。',
 '计时起点取“本轮首次出现待看内容时间”和“本剧最近有效观看时间”中较晚者。有效观看后回到0天。',
 '已追平时清空本轮计时，等待更新期间不积累；出现新待看内容后重新开始。看完全剧后停用此池。',
 '同一自然日保持同一条；同日若更新状态或观看进度改变，立即按新业务状态重新选择，不强行锁旧文案。',
 '本剧正片实际上线当天（含收官）优先基础更新或收官文案，其余有待看日期再按天数取日池。',
 '没有可靠计时字段时不显示具体天数，回退到状态基础文案；有效观看阈值沿用客户端口径，需研发确认。',
 '此表控制文案内容，不增加系统刷新次数或主动通知。日更表现取决于系统实际刷新机会。',
];
clockNotes.forEach((value,i)=>copy.getRange(`A${48+i}`).values=[[value]]);
copy.getRange('A48:E54').format.font={name:'Arial',size:11,color:colors.muted};

wb.recalculate();
console.log((await wb.inspect({kind:'table',range:'状态规则!A6:H14',include:'values,formulas',tableMaxRows:9,tableMaxCols:8,maxChars:3500})).ndjson);
console.log((await wb.inspect({kind:'table',range:'每日文案池!A34:E44',include:'values',tableMaxRows:11,tableMaxCols:5,maxChars:1600})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:20},summary:'final error scan',maxChars:1000})).ndjson);
for(const [sheet,range,file] of [['状态规则','A1:H30','rules-preview.png'],['每日文案池','A1:E17','copy-preview.png'],['每日文案池','A18:E31','copy-middle-preview.png'],['每日文案池','A32:E55','copy-end-preview.png']]){
  const preview=await wb.render({sheetName:sheet,range,scale:1.4,format:'png'});
  await fs.writeFile(path.join(out,file),new Uint8Array(await preview.arrayBuffer()));
}
const result=await SpreadsheetFile.exportXlsx(wb);
const file=path.join(out,'小组件展示规则与文案池_20261106.xlsx');
await result.save(file);
if(matrix.length!==8||daily.length!==31||longCopies.length!==7)throw new Error('Specification row-count mismatch');
console.log(JSON.stringify({file,states:matrix.length,dailyCopy:daily.length,longTermPool:longCopies.length}));
