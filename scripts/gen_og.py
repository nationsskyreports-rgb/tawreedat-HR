import math
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
BG = (27, 30, 40)
TEAL = (58, 246, 199)
BLUE = (31, 161, 255)
MUTED = (140, 152, 173)
TEXT = (241, 245, 249)

img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img, "RGBA")

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i]-a[i])*t) for i in range(3))

def hexagon_points(cx, cy, r, rot=90):
    pts = []
    for i in range(6):
        ang = math.radians(60*i - rot)
        pts.append((cx + r*math.cos(ang), cy + r*math.sin(ang)))
    return pts

def draw_gradient_hexagon_outline(draw, cx, cy, r, width, c1, c2, rot=90, alpha=255):
    pts = hexagon_points(cx, cy, r, rot)
    n = len(pts)
    for i in range(n):
        p1 = pts[i]
        p2 = pts[(i+1) % n]
        t = i / n
        col = lerp(c1, c2, t)
        draw.line([p1, p2], fill=col+(alpha,), width=width)

cx, cy = 900, 300

# faint outer decorative rings (rotated slightly differently, low alpha)
for i, (r, rot, a) in enumerate([(260, 96, 40), (225, 84, 55), (195, 100, 70)]):
    draw_gradient_hexagon_outline(draw, cx, cy, r, 2, TEAL, BLUE, rot=rot, alpha=a)

# paste the transparent S mark (already has its own hexagon + dot), scaled up
mark = Image.open("../assets/logo-mark.png").convert("RGBA")
mark_size = 320
mark = mark.resize((mark_size, mark_size), Image.LANCZOS)
img.paste(mark, (cx - mark_size//2, cy - mark_size//2), mark)

# Text block (left side)
font_path_bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
font_path_reg = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
title_font = ImageFont.truetype(font_path_bold, 80)
sub_font = ImageFont.truetype(font_path_reg, 34)

tx, ty = 110, 250
draw.text((tx, ty), "SoloTe", font=title_font, fill=TEXT)
w_solotec = draw.textlength("SoloTe", font=title_font)
draw.text((tx + w_solotec, ty), "c", font=title_font, fill=TEAL)

draw.text((tx, ty + 100), "One developer.", font=sub_font, fill=MUTED)
draw.text((tx, ty + 145), "Complete systems.", font=sub_font, fill=MUTED)

# bottom gradient bar
bar_h = 8
for x in range(W):
    t = x / W
    col = lerp(TEAL, BLUE, t)
    draw.line([(x, H-bar_h), (x, H)], fill=col)

img.save("../assets/og-image.png")
print("saved", img.size)
