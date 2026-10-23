#!/usr/bin/env python3
"""Prepare 21,600px Earth imagery without loading a global bitmap in the app.
Usage: python3 tools/surface/prepare-earth.py /path/to/earth-21600.png
Requires Pillow. Source is the August 2004 NASA Blue Marble base map (no hillshade).
"""
import hashlib, json, sys
from pathlib import Path
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
root=Path(__file__).resolve().parents[2]
source=Path(sys.argv[1])
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest_path=root/'tools/surface/earth-imagery.json'
previous=json.loads(manifest_path.read_text()) if manifest_path.exists() else None
source_hash=sha(source)
if previous: assert source_hash==previous['input_sha256'], 'Earth source changed'
im=Image.open(source)
assert im.size==(21600,10800) and im.mode=='RGB', (im.size,im.mode)
outputs=[]
def save(image,relative):
 path=root/relative;path.parent.mkdir(parents=True,exist_ok=True)
 image.save(path,quality=90,subsampling=0,optimize=True)
 outputs.append(dict(path=relative,width=image.width,height=image.height,sha256=sha(path),bytes=path.stat().st_size))
# The globe remains a single GPU-friendly texture; printing samples native tiles.
save(im.resize((8192,4096),Image.Resampling.LANCZOS),'site/data/earth/blue-marble-200408-8k.jpg')
for y in range(3):
 for x in range(6):
  save(im.crop((x*3600,y*3600,(x+1)*3600,(y+1)*3600)),f'site/data/earth/color-21600/{x}_{y}.jpg')
manifest=dict(download='https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74117/world.200408.3x21600x10800.png',input_sha256=source_hash,input_dimensions=[21600,10800],tile_size=3600,columns=6,rows=3,projection='Equirectangular; north-up; east-positive; longitude -180..180; latitude 90..-90',processing='RGB8 JPEG quality 90, no chroma subsampling. Tiles preserve source pixel dimensions; globe reduced with Lanczos. No color stretch, longitude roll or geographic crop.',outputs=outputs)
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
print('Prepared',len(outputs),'files;',sum(o['bytes'] for o in outputs),'bytes')
