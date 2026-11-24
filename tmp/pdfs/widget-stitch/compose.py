from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path('.')
TMP = ROOT / 'tmp/pdfs/widget-stitch'
OUT = ROOT / 'output/images'
OUT.mkdir(parents=True, exist_ok=True)

W, H = 2400, 7160
M, GAP = 112, 48
BG = '#F5F7F6'
INK = '#152D30'
MUTED = '#687B7D'
LINE = '#E0E7E4'
ACCENT = '#1A7462'
FONT = '/System/Library/Fonts/Hiragino Sans GB.ttc'
FONTS = {}

def font(size, bold=False):
    key = (size, bold)
    if key not in FONTS:
        FONTS[key] = ImageFont.truetype(FONT, size, index=2 if bold else 0)
    return FONTS[key]

canvas = Image.new('RGB', (W, H), BG)
draw = ImageDraw.Draw(canvas)

def text(x, y, value, size=36, fill=INK, bold=False):
    draw.text((x, y), value, font=font(size, bold), fill=fill, anchor='lt')

def centered(cx, y, value, size=36, fill=INK, bold=False):
    box = draw.textbbox((0, 0), value, font=font(size, bold))
    text(cx - (box[2] - box[0]) / 2, y, value, size, fill, bold)

def card(x, y, w, h):
    draw.rounded_rectangle((x, y, x+w, y+h), radius=28, fill='white', outline=LINE, width=2)

def section(y, number, title, subtitle, color):
    draw.rounded_rectangle((M, y, M+86, y+86), radius=22, fill=color)
    centered(M+43, y+23, number, 40, ACCENT, True)
    text(M+114, y+3, title, 57, bold=True)
    text(M+114, y+81, subtitle, 31, MUTED)

pages = {i: Image.open(TMP / f'hi-{i}.png').convert('RGB') for i in range(2, 6)}

def crop(page, box):
    im = pages[page]
    sx, sy = im.width/842, im.height/595
    return im.crop(tuple(round(v * (sx if i%2 == 0 else sy)) for i,v in enumerate(box)))

def place(im, x, y, width=None, height=None):
    if width is not None:
        height = round(im.height * width / im.width)
    elif height is not None:
        width = round(im.width * height / im.height)
    else:
        width, height = im.size
    im = im.resize((round(width), round(height)), Image.Resampling.LANCZOS)
    canvas.paste(im, (round(x), round(y)))
    return round(height)

assets = {
    'duo_top': crop(2, (42.04,133.758,247.207,267.110)),
    'duo_bottom': crop(2, (42.04,277.631,247.207,497.947)),
    'template_palette': crop(2, (393.439,147.527,737.052,288.115)),
    'template_phones': crop(2, (393.439,303.751,737.052,472.729)),
    'small': crop(3, (49.131,128.816,241.618,477.447)),
    'wide': crop(3, (262.4,128.816,454.9,477.447)),
    'light': crop(4, (22.805,159.807,192.177,487.464)),
    'dark': crop(4, (200.133,159.807,367.069,487.464)),
    'variants': crop(4, (379.0,119.597,812.816,502.685)),
    'copy_watch': crop(5, (60.165,141.320,731.635,297.000)),
    'copy_usage': crop(5, (60.165,340.633,731.635,498.818)),
}

# The image is assembled from the source PDF's widget pages only.
# Original designs are preserved; only surrounding whitespace and titles change.
draw.rectangle((0, 0, W, 490), fill='white')
draw.rounded_rectangle((M, 76, M+80, 88), radius=6, fill=ACCENT)
text(M, 122, '腾讯视频 · 桌面小组件', 37, ACCENT, True)
text(M, 194, '小组件设计方案', 100, bold=True)
text(M, 328, '设计参考 → 组件构成 → 配色适配 → 文案方案', 37, MUTED)
swatches = ['#E4EECD', '#FADCCF', '#E2D6FA', '#D3F2E8', '#CFEAF7']
for i, color in enumerate(swatches):
    x = 1924 + i*70
    draw.rounded_rectangle((x, 207, x+54, 261), radius=16, fill=color)

# 01: Source and supplied design system side by side.
section(550, '01', '设计参考', '多邻国官方设计方案 / 设计提供的小组件模板', '#E5EEDB')
body_y, body_h = 710, 1380
card(M, body_y, 830, body_h)
card(M+830+GAP, body_y, 1298, body_h)
text(M+44, body_y+42, '多邻国官方设计方案', 37, bold=True)
text(M+44, body_y+99, '表情与状态呈现参考', 29, MUTED)
duo_x = M+(830-674)//2
y = body_y+158
y += place(assets['duo_top'], duo_x, y, width=674)+28
place(assets['duo_bottom'], duo_x, y, width=674)
rx = M+830+GAP
text(rx+44, body_y+42, '设计提供的小组件模板', 37, bold=True)
text(rx+44, body_y+99, '色卡与既有组件样式', 29, MUTED)
y = body_y+158
y += place(assets['template_palette'], rx+49, y, width=1200)+48
place(assets['template_phones'], rx+49, y, width=1200)

# 02: Remove the large empty half of the original slide, preserving both sizes.
section(2170, '02', '组件构成', '核心元素：眼睛表情 · 文案 · 底色', '#EBE3F8')
body_y, body_h = 2330, 1325
cw = (W-2*M-GAP)//2
for i, (key,label) in enumerate([('small','1x1 方块'),('wide','2x3 方块')]):
    x = M+i*(cw+GAP)
    card(x, body_y, cw, body_h)
    text(x+48, body_y+42, label, 38, bold=True)
    place(assets[key], x+(cw-620)//2, body_y+139, width=620)

# 03: Keep the desktop previews and the full multi-shade palette together.
section(3736, '03', '配色与适配', '沿用设计提供的色卡，选取五种主色，并考虑手机黑白背景', '#DDF0E8')
body_y, body_h = 3896, 1250
lw, rw = 900, 1228
card(M, body_y, lw, body_h)
rx = M+lw+GAP
card(rx, body_y, rw, body_h)
text(M+44, body_y+42, '手机桌面适配', 37, bold=True)
text(M+44, body_y+100, '同一组件在两种背景下的效果', 29, MUTED)
place(assets['light'], M+38, body_y+235, width=396)
place(assets['dark'], M+466, body_y+235, width=396)
centered(M+236, body_y+1060, '浅色背景', 33, MUTED)
centered(M+664, body_y+1060, '深色背景', 33, MUTED)
text(rx+44, body_y+42, '五种主色与明暗变体', 37, bold=True)
place(assets['variants'], rx+44, body_y+135, width=1140)

# 04: The two independent copy directions remain in their original order.
section(5226, '04', '文案方案', '围绕剧集观看时长与 App 累计使用时长，设计两种文案方向', '#DEEAF3')
body_y = 5386
for i, (key,title,desc) in enumerate([
    ('copy_watch', '方向一 · 电视剧观看时长', '结合剧集观看进度，搭配表情与文案'),
    ('copy_usage', '方向二 · App 累计使用时长', '1 / 7 / 30 / 100 / 365 天的文案示例'),
]):
    y = body_y+i*748
    card(M, y, W-2*M, 704)
    text(M+44, y+38, title, 42, bold=True)
    text(M+44, y+102, desc, 30, MUTED)
    place(assets[key], M+44, y+163, width=W-2*M-88)

draw.line((M, 7010, W-M, 7010), fill=LINE, width=2)
text(M, 7052, '腾讯视频小组件设计方案', 28, MUTED)
right = '设计参考  /  组件构成  /  配色适配  /  文案方案'
b = draw.textbbox((0,0), right, font=font(26))
text(W-M-(b[2]-b[0]), 7053, right, 26, MUTED)

png = OUT/'腾讯视频小组件设计方案_汇报长图.png'
jpg = OUT/'腾讯视频小组件设计方案_汇报长图.jpg'
canvas.save(png, optimize=True)
canvas.save(jpg, quality=95, subsampling=0, optimize=True)
canvas.resize((960, round(H*960/W)), Image.Resampling.LANCZOS).save(TMP/'preview.jpg', quality=92)
for n,box in enumerate([(0,0,W,2140),(0,2130,W,3700),(0,3690,W,5190),(0,5180,W,H)], 1):
    part = canvas.crop(box)
    part.resize((1440,round(part.height*1440/W)), Image.Resampling.LANCZOS).save(TMP/f'qa-{n}.jpg',quality=95)
print(f'{W} x {H}')
for p in [jpg,png]:
    print(f'{p}  {p.stat().st_size/1024/1024:.2f} MiB')
