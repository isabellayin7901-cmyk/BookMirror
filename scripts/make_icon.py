"""
生成 BookMirror App 图标 / 自适应图标 / 启动屏。
角色：Mico（兔子，举着星星、夹着一本书）+ Miki（猫，拿狗尾巴草仰望星空）。
用 Pillow 直接绘制（3x 超采样抗锯齿），配色取自 frontend/src/theme.ts。
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

# ---- 主题配色（与 theme.ts 完全一致）----
BG_TOP      = (236, 230, 238)  # 顶部淡紫夜空感
BG_BOT      = (245, 239, 230)  # 底部暖奶油 #F5EFE6
PRIMARY     = (122, 107, 93)   # 旧木头色 描边 #7A6B5D
BUNNY_BODY  = (243, 230, 215)  # #F3E6D7
BUNNY_EAR   = (232, 213, 189)  # #E8D5BD
BLUSH       = (232, 181, 168)  # #E8B5A8
CAT_BODY    = (212, 197, 176)  # #D4C5B0
ROSE        = (212, 165, 165)
SAGE        = (168, 184, 155)
SKY         = (168, 184, 200)
LAVENDER    = (196, 181, 197)
BUTTER      = (232, 200, 147)
TERRACOTTA  = (201, 132, 107)
SURFACE     = (255, 251, 244)

S = 3                      # 超采样倍数
SIZE = 1024
N = SIZE * S


def sc(v):
    return v * S


class Pen:
    def __init__(self, draw):
        self.d = draw

    def ellipse(self, cx, cy, rx, ry, fill=None, outline=PRIMARY, width=2):
        self.d.ellipse(
            [sc(cx - rx), sc(cy - ry), sc(cx + rx), sc(cy + ry)],
            fill=fill, outline=outline, width=sc(width) if outline else 0,
        )

    def poly(self, pts, fill=None, outline=PRIMARY, width=2):
        self.d.polygon([(sc(x), sc(y)) for x, y in pts],
                       fill=fill, outline=outline, width=sc(width) if outline else 0)

    def line(self, pts, fill=PRIMARY, width=2):
        self.d.line([(sc(x), sc(y)) for x, y in pts], fill=fill,
                    width=sc(width), joint="curve")

    def arc(self, cx, cy, rx, ry, a0, a1, fill=PRIMARY, width=2):
        self.d.arc([sc(cx - rx), sc(cy - ry), sc(cx + rx), sc(cy + ry)],
                   a0, a1, fill=fill, width=sc(width))

    def dot(self, cx, cy, r, fill):
        self.d.ellipse([sc(cx - r), sc(cy - r), sc(cx + r), sc(cy + r)], fill=fill)


def star_points(cx, cy, outer, inner, n=5, rot=-90):
    pts = []
    for i in range(n * 2):
        r = outer if i % 2 == 0 else inner
        a = math.radians(rot + i * 180 / n)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def sparkle(p, cx, cy, s, color):
    """四角星闪光"""
    p.poly([(cx, cy - s), (cx + s * 0.22, cy - s * 0.22),
            (cx + s, cy), (cx + s * 0.22, cy + s * 0.22),
            (cx, cy + s), (cx - s * 0.22, cy + s * 0.22),
            (cx - s, cy), (cx - s * 0.22, cy - s * 0.22)],
           fill=color, outline=None)


def draw_background(img):
    """竖向渐变 + 顶部圆弧夜空"""
    top = Image.new("RGB", (1, N))
    for y in range(N):
        t = y / N
        # 上 1/2 偏淡紫，下半奶油
        tt = min(1.0, t * 1.15)
        r = int(BG_TOP[0] + (BG_BOT[0] - BG_TOP[0]) * tt)
        g = int(BG_TOP[1] + (BG_BOT[1] - BG_TOP[1]) * tt)
        b = int(BG_TOP[2] + (BG_BOT[2] - BG_TOP[2]) * tt)
        top.putpixel((0, y), (r, g, b))
    img.paste(top.resize((N, N)), (0, 0))


def draw_mico(p, ox=0, oy=0):
    """兔子 Mico：左手举星星，右臂夹书。坐标基于中心 ~ (360,560)"""
    def E(cx, cy, *a, **k): p.ellipse(cx + ox, cy + oy, *a, **k)
    def PO(pts, **k): p.poly([(x + ox, y + oy) for x, y in pts], **k)
    def L(pts, **k): p.line([(x + ox, y + oy) for x, y in pts], **k)
    def D(cx, cy, *a, **k): p.dot(cx + ox, cy + oy, *a, **k)
    def A(cx, cy, *a, **k): p.arc(cx + ox, cy + oy, *a, **k)
    sw = 5

    # 耳朵（左、右，略外八）
    E(322, 372, 28, 78, fill=BUNNY_BODY, width=sw)
    E(322, 378, 12, 52, fill=BUNNY_EAR, outline=None)
    E(412, 366, 28, 78, fill=BUNNY_BODY, width=sw)
    E(412, 372, 12, 52, fill=BUNNY_EAR, outline=None)

    # 身体
    PO([(300, 640), (296, 540), (368, 500), (440, 540), (444, 640),
        (430, 700), (368, 712), (310, 700)],
       fill=BUNNY_BODY, width=sw)
    # 头
    E(368, 470, 96, 86, fill=BUNNY_BODY, width=sw)
    # 腮红
    E(316, 492, 17, 10, fill=BLUSH, outline=None)
    E(420, 492, 17, 10, fill=BLUSH, outline=None)
    # 眼睛
    D(338, 470, 7, PRIMARY)
    D(398, 470, 7, PRIMARY)
    # 鼻+嘴
    A(368, 486, 8, 6, 20, 160, fill=PRIMARY, width=sw)
    L([(368, 492), (368, 504)], fill=PRIMARY, width=sw)

    # 右臂夹着书（书在身体右侧）
    # 书
    PO([(430, 560), (520, 540), (524, 612), (434, 632)], fill=SURFACE, width=sw)
    L([(430, 560), (434, 632)], fill=TERRACOTTA, width=6)   # 书脊
    L([(452, 566), (510, 554)], fill=BLUSH, width=4)
    L([(454, 582), (512, 570)], fill=BLUSH, width=4)
    # 右手压在书上
    E(450, 612, 20, 15, fill=BUNNY_BODY, width=sw)

    # 左臂高举（举到星星）
    L([(300, 560), (250, 430), (250, 360)], fill=BUNNY_BODY, width=24)
    E(248, 352, 20, 16, fill=BUNNY_BODY, width=sw)
    # 举着的大星星
    star = star_points(250 + ox, 300 + oy, 60, 26)
    p.poly(star, fill=BUTTER, width=sw)
    # 星星上的小高光
    p.dot(236 + ox, 290 + oy, 7, SURFACE)


def draw_miki(p, ox=0, oy=0):
    """猫 Miki：拿狗尾巴草，仰望。中心 ~ (700,560)"""
    def E(cx, cy, *a, **k): p.ellipse(cx + ox, cy + oy, *a, **k)
    def PO(pts, **k): p.poly([(x + ox, y + oy) for x, y in pts], **k)
    def L(pts, **k): p.line([(x + ox, y + oy) for x, y in pts], **k)
    def D(cx, cy, *a, **k): p.dot(cx + ox, cy + oy, *a, **k)
    def A(cx, cy, *a, **k): p.arc(cx + ox, cy + oy, *a, **k)
    sw = 5

    # 尾巴
    L([(770, 660), (812, 612), (800, 548)], fill=CAT_BODY, width=18)
    # 身体
    E(700, 632, 78, 62, fill=CAT_BODY, width=sw)
    # 头（微微上仰）
    E(700, 500, 70, 66, fill=CAT_BODY, width=sw)
    # 三角耳
    PO([(652, 462), (640, 410), (684, 448)], fill=CAT_BODY, width=sw)
    PO([(748, 462), (760, 410), (716, 448)], fill=CAT_BODY, width=sw)
    PO([(656, 452), (650, 426), (672, 446)], fill=BLUSH, outline=None)
    PO([(744, 452), (750, 426), (728, 446)], fill=BLUSH, outline=None)
    # 腮红
    E(664, 512, 13, 8, fill=BLUSH, outline=None)
    E(736, 512, 13, 8, fill=BLUSH, outline=None)
    # 眯眯眼（仰望）
    A(666, 496, 12, 9, 200, 340, fill=PRIMARY, width=sw)
    A(722, 496, 12, 9, 200, 340, fill=PRIMARY, width=sw)
    # 鼻嘴
    PO([(694, 512), (706, 512), (700, 519)], fill=PRIMARY, outline=None)
    L([(700, 519), (700, 528)], fill=PRIMARY, width=sw)
    # 胡须
    for dy in (-4, 4):
        L([(640, 514 + dy), (606, 510 + dy)], fill=PRIMARY, width=3)
        L([(760, 514 + dy), (794, 510 + dy)], fill=PRIMARY, width=3)

    # 前爪举着狗尾巴草
    E(660, 636, 18, 14, fill=CAT_BODY, width=sw)
    # 草杆（从爪子斜向上）
    stalk = [(660, 632), (628, 540), (612, 440), (606, 360)]
    L(stalk, fill=SAGE, width=7)
    # 毛茸茸的穗（沿顶端两侧排小斜线）
    for i in range(14):
        t = i / 13
        x = 612 + (606 - 612) * t
        y = 440 + (350 - 440) * t
        ln = 26 - i  # 越往上越短
        L([(x, y), (x - ln, y - 6)], fill=SAGE, width=4)
        L([(x, y), (x + ln, y - 6)], fill=SAGE, width=4)


def compose(safe_scale=1.0):
    img = Image.new("RGB", (N, N), BG_BOT)
    draw_background(img)
    d = ImageDraw.Draw(img)
    p = Pen(d)

    # 背景闪光（夜空）
    sparkle(p, 150, 150, 26, LAVENDER)
    sparkle(p, 860, 220, 34, BUTTER)
    sparkle(p, 770, 110, 20, TERRACOTTA)
    sparkle(p, 470, 110, 16, SKY)
    sparkle(p, 900, 470, 18, ROSE)
    sparkle(p, 120, 470, 16, SAGE)

    # 角色画在透明层上，统一缩放 + 垂直居中，避免底部留白
    layer = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    lp = Pen(ImageDraw.Draw(layer))
    draw_mico(lp)
    draw_miki(lp)
    # 角色实际包围盒约 y:220~712 (含举起的星星)，水平 240~824
    new = int(N * safe_scale)
    layer = layer.resize((new, new), Image.LANCZOS)
    cx = N // 2
    # 角色原图中心偏上，往下推让其在画面里垂直居中
    y_nudge = int(N * (0.085 if safe_scale >= 1.0 else 0.03))
    img.paste(layer, (cx - new // 2, cx - new // 2 + y_nudge), layer)

    return img.resize((SIZE, SIZE), Image.LANCZOS)


def main():
    out = os.path.join(os.path.dirname(__file__), "..", "frontend", "assets")
    out = os.path.abspath(out)
    os.makedirs(out, exist_ok=True)

    icon = compose(safe_scale=1.14)
    icon.save(os.path.join(out, "icon.png"))
    print("wrote icon.png")

    # Android 自适应图标：留安全区（圆形遮罩会裁掉四角）
    adaptive = compose(safe_scale=0.62)
    adaptive.save(os.path.join(out, "adaptive-icon.png"))
    print("wrote adaptive-icon.png")

    # 启动屏：竖图，角色居中
    splash = Image.new("RGB", (1242, 2436), BG_BOT)
    sd = ImageDraw.Draw(splash)
    # 简单渐变顶
    for y in range(900):
        t = y / 900
        r = int(BG_TOP[0] + (BG_BOT[0] - BG_TOP[0]) * t)
        g = int(BG_TOP[1] + (BG_BOT[1] - BG_TOP[1]) * t)
        b = int(BG_TOP[2] + (BG_BOT[2] - BG_TOP[2]) * t)
        sd.line([(0, y), (1242, y)], fill=(r, g, b))
    art = icon.resize((760, 760), Image.LANCZOS)
    splash.paste(art, (1242 // 2 - 380, 2436 // 2 - 480))
    splash.save(os.path.join(out, "splash.png"))
    print("wrote splash.png")


if __name__ == "__main__":
    main()
