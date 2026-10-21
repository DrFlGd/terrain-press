#!/usr/bin/env python3
"""Convert NASA's 2025 8K sRGB TIFF to the offline RGB8 JPEG (Pillow required).
Download source separately; pass the local TIFF as the only argument.
No resizing, reprojection, contrast enhancement or geographic cropping.
"""
from pathlib import Path
import sys
from PIL import Image
src = Image.open(sys.argv[1])
assert src.size == (8192, 4096), src.size
assert src.tag_v2.get(258) == (16, 16, 16), src.tag_v2.get(258)
# Pillow's RGB TIFF decoder reduces each 16-bit sRGB channel to its high byte.
assert src.mode == 'RGB', src.mode
out = Path(__file__).resolve().parents[2] / 'site/data/moon/lroc-color-2025-8k.jpg'
src.save(out, quality=95, subsampling=0)
print(out)
