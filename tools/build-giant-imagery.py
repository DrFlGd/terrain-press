#!/usr/bin/env python3
"""Reproduce bundled OPAL derivatives. Requires Pillow and NumPy; downloads ~6 MB."""
from pathlib import Path
import hashlib
import io
import urllib.request
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    ('saturn', '2024', 'https://archive.stsci.edu/hlsps/opal/cycle31/saturn/',
     'hlsp_opal_hst_wfc3-uvis_saturn-2024', 'f395n-f502n-f631n',
     (1800, 900), [(-65, -8), (5, 75)], False),
    ('uranus', '2023', 'https://archive.stsci.edu/hlsps/opal/cycle31/uranus/',
     'hlsp_opal_hst_wfc3-uvis_uranus-2023', 'f467m-f547m-f657n',
     (721, 361), [(-4, 90)], False),
    ('neptune', '2025', 'https://archive.stsci.edu/missions/hlsp/opal/cycle31/neptune/',
     'hlsp_opal_hst_wfc3-uvis_neptune-2025', 'f467m-f547m-f657n',
     (721, 361), [(-90, 30)], True),
]

if __name__ == '__main__':
    for world, year, base, stem, filters, size, bands, readme_rotation in SOURCES:
        url = base + stem + 'a_' + filters + '_v1_globalmap.tif'
        with urllib.request.urlopen(url, timeout=120) as response:
            raw = response.read()
        im = Image.open(io.BytesIO(raw)).convert('RGBA')
        if im.size != size:
            raise ValueError(f'{world}: unexpected source dimensions {im.size}')
        a = np.array(im)
        lat = 90 - (np.arange(im.height) + .5) / im.height * 180
        valid = np.zeros(im.height, dtype=bool)
        for south, north in bands:
            valid |= (lat >= south) & (lat <= north)
        a[~valid, :, :3] = 0
        a[~valid, :, 3] = 0
        out = ROOT / 'site' / 'data' / world
        out.mkdir(parents=True, exist_ok=True)
        Image.fromarray(a).save(out / f'opal-{year}.png', optimize=True)
        readme = base + stem + ('a' if readme_rotation else '') + '_all_v1_readme.txt'
        with urllib.request.urlopen(readme, timeout=120) as response:
            (out / 'OPAL-README.txt').write_bytes(response.read())
        print(world, 'source SHA256:', hashlib.sha256(raw).hexdigest())
