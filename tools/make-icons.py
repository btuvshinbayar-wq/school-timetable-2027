"""
public/icon.svg-ээс Windows, Linux-д хэрэгтэй дүрсүүдийг үүсгэнэ.
  build/icon.ico   — 16, 20, 24, 32, 40, 48, 64, 128, 256 (Windows exe, суулгагч)
  build/icon.png   — 512
  public/apple-touch-icon.png — 180
Ажиллуулах: python3 tools/make-icons.py   (Playwright + Chromium шаардлагатай)
"""
import os
import struct
import sys
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
svg = open(os.path.join(ROOT, 'public', 'icon.svg'), encoding='utf-8').read()
os.makedirs(os.path.join(ROOT, 'build'), exist_ok=True)

SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]


def render(page, size: int) -> bytes:
    page.set_viewport_size({'width': size, 'height': size})
    page.set_content(
        f'<html><body style="margin:0;background:transparent">'
        f'<div style="width:{size}px;height:{size}px">{svg.replace("width=\"512\" height=\"512\"", f"width=\"{size}\" height=\"{size}\"", 1)}</div>'
        f'</body></html>'
    )
    return page.locator('svg').screenshot(omit_background=True)


def build_ico(images: list[tuple[int, bytes]]) -> bytes:
    # PNG агуулсан ICO (Windows Vista+)
    header = struct.pack('<HHH', 0, 1, len(images))
    entries = b''
    data = b''
    offset = 6 + 16 * len(images)
    for size, png in images:
        w = 0 if size >= 256 else size
        entries += struct.pack('<BBBBHHII', w, w, 0, 0, 1, 32, len(png), offset)
        data += png
        offset += len(png)
    return header + entries + data


with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(device_scale_factor=1)
    pngs = [(s, render(page, s)) for s in SIZES]
    open(os.path.join(ROOT, 'build', 'icon.ico'), 'wb').write(build_ico(pngs))
    open(os.path.join(ROOT, 'build', 'icon.png'), 'wb').write(render(page, 512))
    open(os.path.join(ROOT, 'public', 'apple-touch-icon.png'), 'wb').write(render(page, 180))
    open(os.path.join(ROOT, 'build', 'icon-preview-32.png'), 'wb').write(dict(pngs)[32])
    b.close()
print('ok:', ', '.join(str(s) for s in SIZES))
