from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.opc.constants import RELATIONSHIP_TYPE as RT

ROOT = Path('.')
OUT = ROOT / 'output/documents/腾讯视频长视频续看小组件PRD_v0.1_20261102.docx'
OUT.parent.mkdir(parents=True, exist_ok=True)
doc = Document()
for style in doc.styles:
    for border in list(style._element.iter(qn('w:pBdr'))):
        border.getparent().remove(border)
    for fonts in style._element.iter(qn('w:rFonts')):
        for attr in ['asciiTheme','hAnsiTheme','eastAsiaTheme','cstheme']:
            fonts.attrib.pop(qn('w:'+attr),None)
section = doc.sections[0]
section.page_width, section.page_height = Inches(8.5), Inches(11)
section.top_margin, section.bottom_margin = Inches(.65), Inches(.65)
section.left_margin, section.right_margin = Inches(.75), Inches(.75)
for grid in list(section._sectPr.findall(qn('w:docGrid'))):
    section._sectPr.remove(grid)

def set_font(run, size=11, bold=False, color='000000'):
    run.font.name = 'Arial'
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = RGBColor.from_string(color)
    fonts = run._element.get_or_add_rPr().get_or_add_rFonts()
    fonts.set(qn('w:eastAsia'), 'PingFang SC')
    return run

for name in ['Normal', 'Title', 'Heading 1', 'Heading 2']:
    style = doc.styles[name]
    style.font.name = 'Arial'
    style.font.color.rgb = RGBColor(0,0,0)
    style._element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'), 'PingFang SC')
    style.paragraph_format.line_spacing = Pt(14)
    snap=OxmlElement('w:snapToGrid'); snap.set(qn('w:val'),'0'); style._element.get_or_add_pPr().append(snap)
    style.paragraph_format.space_after = Pt(5)
    if name.startswith('Heading'):
        style.paragraph_format.keep_with_next = True
        style.paragraph_format.space_before = Pt(11)
        style.paragraph_format.space_after = Pt(5)
        style.font.size = Pt(12)
    elif name == 'Title':
        style.font.size = Pt(20)
        style.paragraph_format.line_spacing = Pt(25)
        style.paragraph_format.space_after = Pt(7)
    else:
        style.font.size = Pt(11)

def p(text='', size=11, bold=False, after=5, color='000000'):
    para = doc.add_paragraph()
    para.paragraph_format.space_after = Pt(after)
    set_font(para.add_run(text), size, bold, color)
    return para

def h(text):
    para = doc.add_paragraph(text, 'Heading 1')
    for run in para.runs:
        set_font(run, 12, True)
    return para

def link(para, label, url, size=9):
    node = OxmlElement('w:hyperlink')
    node.set(qn('r:id'), para.part.relate_to(url, RT.HYPERLINK, is_external=True))
    run = OxmlElement('w:r')
    props = OxmlElement('w:rPr')
    fonts = OxmlElement('w:rFonts')
    for key, value in [('ascii','Arial'),('hAnsi','Arial'),('eastAsia','PingFang SC')]:
        fonts.set(qn('w:'+key),value)
    props.append(fonts)
    sz = OxmlElement('w:sz'); sz.set(qn('w:val'),str(int(size*2))); props.append(sz)
    color=OxmlElement('w:color'); color.set(qn('w:val'),'285B88'); props.append(color)
    run.append(props)
    text=OxmlElement('w:t'); text.text=label; run.append(text)
    node.append(run); para._p.append(node)

def table(headers, rows, widths):
    t = doc.add_table(rows=1, cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    for col, width in zip(t.columns, widths): col.width = Inches(width)
    props = t._tbl.tblPr
    borders = OxmlElement('w:tblBorders')
    for name in ['top','left','bottom','right','insideH','insideV']:
        edge = OxmlElement('w:'+name)
        for k,v in [('val','single'),('sz','4'),('color','D9D9D9')]: edge.set(qn('w:'+k),v)
        borders.append(edge)
    props.append(borders)
    margins=OxmlElement('w:tblCellMar')
    for name, value in [('top','80'),('bottom','80'),('left','105'),('right','105')]:
        el=OxmlElement('w:'+name); el.set(qn('w:w'),value); el.set(qn('w:type'),'dxa'); margins.append(el)
    props.append(margins)
    repeat=OxmlElement('w:tblHeader'); t.rows[0]._tr.get_or_add_trPr().append(repeat)
    all_rows=[headers]+rows
    for idx, values in enumerate(all_rows):
        cells=t.rows[0].cells if idx==0 else t.add_row().cells
        no_split=OxmlElement('w:cantSplit'); cells[0]._tc.getparent().get_or_add_trPr().append(no_split)
        for ci,(cell,text) in enumerate(zip(cells,values)):
            cell.width=Inches(widths[ci]); cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
            para=cell.paragraphs[0]
            para.paragraph_format.space_after=Pt(0)
            para.paragraph_format.line_spacing=Pt(13.5)
            snap=OxmlElement('w:snapToGrid'); snap.set(qn('w:val'),'0'); para._p.get_or_add_pPr().append(snap)
            if ci==0: para.alignment=WD_ALIGN_PARAGRAPH.CENTER
            set_font(para.add_run(text),10.5,idx==0)
            if idx==0:
                shade=OxmlElement('w:shd'); shade.set(qn('w:fill'),'E7EDF2'); cell._tc.get_or_add_tcPr().append(shade)
    spacer=doc.add_paragraph()
    spacer.paragraph_format.line_spacing=Pt(4)
    spacer.paragraph_format.space_after=Pt(0)
    return t

title=doc.add_paragraph('腾讯视频长视频续看小组件 PRD','Title')
for run in title.runs: set_font(run,20,True)
p('V0.1  |  2026.11.02  |  待评审',9,color='666666',after=9)
p('面向有长视频观看历史的用户，在桌面展示最近可续看的内容与进度，通过文案和表情吸引回访，点击后接着看。本文用于运营、设计和研发确认首期范围与规则。')

h('1 背景与目标')
p('原需求从追剧日历改造出发，包含观看进度与激励、剧集排播、会员营销三部分。10月28日与研发、设计对齐后，拆为通用桌面小组件和追剧日历两条需求：小组件基于用户观看历史，不绑定某一部剧；日历参考会员月历样式，单独交付HTML方案。')
p('本期仅覆盖小组件，沿用现有组件框架，优先验证“近期长视频续看”方向。目标是降低续看成本、提升组件点击后的有效播放转化，不以连续观看或累计时长作为任务。')
p('不含：排播日历、会员营销、签到与电子票奖励、App累计使用时长方案。IP形象暂不作为前置依赖，先以大字、眼神和色彩呈现。',10.5)

h('2 多邻国参考与设计方向')
p('多邻国官方介绍中，组件以“当天是否学习”和连续记录为核心信息，角色表情随时段和完成状态变化，完成后转为放松、开心。[1]')
p('我们借鉴“状态驱动的文案、表情与色彩”和轻量桌面入口，将其改为观看历史驱动的续看提醒；不照搬学习连胜、每日任务或临近午夜加压，也不复用其图形资产与文案。该参考不代表本项目已验证留存提升。')
p('视觉沿用项目Figma小组件色卡，提供浅／深色及纯色／轻渐变比较；色彩角色与渐变为提案，最终由设计确认。',10.5)

h('3 核心功能')
table(['功能','首期要求'],[
    ['内容范围','电视剧、综艺、电影、动漫、纪录片等长视频正片；排除广告、预告、短视频和误触预览。'],
    ['双尺寸展示','1×1与1×3同一时刻使用同一份内容、状态、文案和进度。顺序统一为品牌 → 品牌下内容标题 → 文案与眼神 → 底部进度。长标题截断，不能省略已看时间。'],
    ['进度字段','剧集：第8集 · 已看13:32；综艺：第3期（上）· 已看23:10；电影：已看42:18。下一集未开始：第9集 · 待观看。'],
    ['点击续看','整块组件进入对应内容及播放位置；沿用客户端权限校验。点击或打开App不等于有效观看，不修改完成状态。'],
],[1.0,6.0])
p('内容选择：按有效观看时间倒序，取最近可续看的内容；当前集／期完成后接下一可播单元；整部无待看或不可播时，再找其他内容。电影看完不从头推荐。',10.5)
p('当前Demo仅验证界面与策略，使用虚构数据，未安装原生组件或接入真实账号；文案轮换不承诺零点实时刷新。',9,color='666666')

doc.add_page_break()
h('4 状态与文案策略')
p('展示目标看“最近可续看内容”，情绪看“全站最近一次有效长视频观看”。今天看过综艺，不能因某部电视剧七天未看而显示久未观看。',after=5)
p('以下阈值均为待评审提案；间隔暂按UTC+8自然日计算，不按满24小时累计。',10.5)
table(['状态','触发条件','表达示例'],[
    ['今天已看','今天有有效长视频观看，仍有续看目标','开心、不催\n行，来过就行。今天不闹你。'],
    ['普通续看','距最近有效观看1–2天，非18:00–22:00','平常等待\n人是走了，进度还在这。'],
    ['晚间等待','距最近有效观看1–2天，18:00≤时间＜22:00','轻松邀请\n今晚有空？给你留了位置。'],
    ['久未观看','距最近有效观看3–6天','轻度俏皮\n你再不来，我要长蘑菇了。'],
    ['温和等待','距最近有效观看≥7天','柔和陪伴\n有空再来，位置给你留着。'],
],[1.0,2.65,3.35])
p('优先级：账号／数据／可播及无待续看兜底 → 今天已看 → 久未／温和等待 → 晚间等待 → 普通续看。无待续看时优先休息，不按离开天数催看。',10.5)
p('安静时段暂定22:00–次日08:00，久未状态改用温和文案。每个状态准备3–5条静态文案；同用户、内容目标、状态和时段下，同日固定、次日轮换。真实观看、目标／状态变化或进出安静时段可换词，两尺寸始终一致。',10.5)

h('5 异常与接入边界')
table(['情况','处理要求'],[
    ['未登录／无历史','分别展示登录或欢迎态，不虚构内容与进度；登录、发现内容的落地由客户端承接。'],
    ['无待看／不可播','优先回退其他可续看记录；仍无目标时展示休息或暂不可用态，不绕过会员、版权及地区限制。'],
    ['账号／数据变化','登出、切账号不展示旧账号历史；删除历史后更新。有效观看、完成、跨端同步、缓存与刷新失败口径需研发确认。'],
],[1.3,5.7])

h('6 验收与效果观察')
p('验收重点：双尺寸字段一致；电视剧转综艺及电影续看正确；下一集显示待观看；3／7天、18／22／08点边界正确；今天已看及无待续看优先；同日稳定、跨天轮换；点击不记为观看，异常不泄露旧账号数据。',10.5)
p('建议关注组件点击后的有效播放转化，并按尺寸、状态和内容类型拆分。有效播放定义、归因窗口与组件曝光是否可采集需确认；首期不预设提升幅度或实验流量。',10.5)

h('7 评审待确认')
p('产品与运营确认阈值、时段和文案池；设计确认正式尺寸、长字段、深浅模式和表情资产；研发确认有效观看／完成、集期及可播接口、跨端历史、刷新缓存与点击落地。排期与实验方案待评审后对齐。',10.5)

sources=p('',size=9,after=0)
link(sources,'[1] 多邻国官方组件介绍','https://blog.duolingo.com/widget-feature/')
set_font(sources.add_run('   '),9)
link(sources,'[2] 项目Figma色卡','https://www.figma.com/design/tV18dEXdgZUV82W4PfmukO/Untitled?node-id=4-1337')
set_font(sources.add_run('   '),9)
link(sources,'本地Demo','http://127.0.0.1:4173/widget-atlas.html')

doc.core_properties.title='腾讯视频长视频续看小组件 PRD'
doc.core_properties.subject='近期长视频续看桌面小组件需求'
doc.core_properties.author=''
doc.core_properties.keywords='PRD,长视频,桌面小组件,续看'
doc.save(OUT)
print(OUT)
