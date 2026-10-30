"""
Суулгагчийн (NSIS) зураг: зүүн талын хавтас (164x314) ба толгойн зураг (150x57), 24-bit BMP.
Ажиллуулах: python3 tools/make-installer-art.py   (Playwright + Chromium + Pillow)
"""
import io
import os
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
icon = open(os.path.join(ROOT, 'public', 'icon.svg'), encoding='utf-8').read()
icon_inline = icon.replace('width="512" height="512"', 'width="100%" height="100%"', 1)

SIDE = f"""
<div style="width:164px;height:314px;background:#2f5d52;font-family:'Segoe UI',system-ui,sans-serif;color:#fdfbf6;position:relative;overflow:hidden">
  <div style="position:absolute;left:30px;top:44px;width:104px;height:104px">{icon_inline}</div>
  <div style="position:absolute;left:0;right:0;top:170px;text-align:center;font-weight:600;font-size:15px;line-height:1.25">School<br>Timetable 2027</div>
  <div style="position:absolute;left:14px;right:14px;top:222px;text-align:center;font-size:11px;line-height:1.35;color:#c9dcd3">Хичээлийн хуваарь<br>зохиох программ</div>
  <div style="position:absolute;left:0;right:0;bottom:0;height:6px;background:#e7c873"></div>
</div>"""

HEADER = f"""
<div style="width:150px;height:57px;background:#ffffff;position:relative">
  <div style="position:absolute;right:10px;top:6px;width:45px;height:45px">{icon_inline}</div>
</div>"""


def shot(page, html, w, h):
    page.set_viewport_size({'width': w, 'height': h})
    page.set_content(f'<html><body style="margin:0">{html}</body></html>')
    png = page.locator('body > div').screenshot()
    return Image.open(io.BytesIO(png)).convert('RGB')


with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page()
    shot(page, SIDE, 164, 314).save(os.path.join(ROOT, 'build', 'installer-side.bmp'))
    shot(page, HEADER, 150, 57).save(os.path.join(ROOT, 'build', 'installer-header.bmp'))
    b.close()
print('ok')
