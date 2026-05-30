"""
把用户提供的精致插画处理成 App 图标三件套。
- icon.png        : 1024x1024，裁掉外圈留白让角色占满，去透明、平铺奶油底（iOS 要求不透明）
- adaptive-icon   : 1024x1024，角色缩进 Android 圆形遮罩安全区
- splash.png      : 1242x2436 竖版，插画居中于奶油底
"""
import os
from PIL import Image

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "assets"))
# 源图归档在 assets/icon_source.png；换图时替换它再重跑本脚本即可。
SRC = os.path.join(OUT, "icon_source.png")
CREAM = (245, 239, 230)  # #F5EFE6


def load_flat():
    img = Image.open(SRC).convert("RGBA")
    bg = Image.new("RGBA", img.size, CREAM + (255,))
    bg.alpha_composite(img)
    return bg.convert("RGB")


def main():
    os.makedirs(OUT, exist_ok=True)
    img = load_flat()
    w, h = img.size
    side = min(w, h)
    # 居中正方裁切
    left, top = (w - side) // 2, (h - side) // 2
    sq = img.crop((left, top, left + side, top + side))

    # icon：裁掉约 6% 外圈奶油留白，让圆角框/角色更饱满（系统会再加圆角）
    crop = int(side * 0.06)
    icon = sq.crop((crop, crop, side - crop, side - crop)).resize((1024, 1024), Image.LANCZOS)
    icon.save(os.path.join(OUT, "icon.png"))
    print("wrote icon.png")

    # adaptive：插画整体缩进圆形安全区（约占 78%），四周补奶油
    canvas = Image.new("RGB", (1024, 1024), CREAM)
    inner = sq.resize((int(1024 * 0.86), int(1024 * 0.86)), Image.LANCZOS)
    off = (1024 - inner.width) // 2
    canvas.paste(inner, (off, off))
    canvas.save(os.path.join(OUT, "adaptive-icon.png"))
    print("wrote adaptive-icon.png")

    # splash：竖版，插画居中
    splash = Image.new("RGB", (1242, 2436), CREAM)
    art = sq.resize((900, 900), Image.LANCZOS)
    splash.paste(art, ((1242 - 900) // 2, (2436 - 900) // 2))
    splash.save(os.path.join(OUT, "splash.png"))
    print("wrote splash.png")


if __name__ == "__main__":
    main()
