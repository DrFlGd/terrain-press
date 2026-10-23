#!/usr/bin/env python3
"""Prepare bundled imagery: python3 tools/surface/prepare.py /path/to/downloads.
Earth is prepared separately by prepare-earth.py.
Requires Pillow (with JPEG2000 for the Venus archival mirror). No color stretching,
longitude rotation or crop. Input hashes make accidental source changes fail.
"""
import hashlib, json, sys
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
Image.MAX_IMAGE_PIXELS = None
specs = [
 ('mars', 'mars-color.jpg', 'viking-color-8k.jpg', (21339,10670), (8192,4096), 'https://upload.wikimedia.org/wikipedia/commons/1/1f/Mars_Viking_MDIM21_ClrMosaic_1km.jpg'),
 ('mercury', 'mercury-color.jpg', 'messenger-enhanced-8k.jpg', (11520,5760), (8192,4096), 'https://planetarydata.jpl.nasa.gov/img/data/test/messenger/MDIS_MAPS/EXTRAS/BROWSE/Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_665m.jpg'),
 ('venus', 'venus-color.jp2', 'magellan-synthetic-8k.jpg', (16384,8192), (8192,4096), 'https://www.davidrumsey.com/rumsey/download.pl?image=/185/10606000.jp2'),
]
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
manifest_path = ROOT/'tools/surface/imagery.json'
previous = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
manifest = {}
for world, src, dest, original, size, url in specs:
    source = Path(sys.argv[1])/src
    source_hash = sha(source)
    if world in previous:
        assert source_hash == previous[world]['input_sha256'], f'{world}: source changed'
    im = Image.open(source)
    assert im.size == original, (world, im.size)
    im = im.convert('RGB')
    if im.size != size: im = im.resize(size, Image.Resampling.LANCZOS)
    target = ROOT/'site/data'/world/dest
    quality = 80 if world == 'mercury' else 90
    subsampling = 2 if world in ('mercury','venus') else 0
    im.save(target, 'JPEG', quality=quality, subsampling=subsampling, optimize=True)
    manifest[world] = dict(download=url,input_sha256=source_hash,input_dimensions=original,
        output=str(target.relative_to(ROOT)),output_sha256=sha(target),output_dimensions=size,
        projection='Equirectangular; north-up; east-positive; longitude -180..180; latitude 90..-90',
        processing=f'RGB8; full-frame Lanczos resize where needed; JPEG quality {quality}, chroma subsampling {subsampling}')
    print(world, size, target.stat().st_size, flush=True)
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
