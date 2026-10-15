#!/usr/bin/env python3
"""Build Earth assets from NOAA's original ETOPO 2022 60s surface GeoTIFF.
Usage: python tools/earth/build.py /path/to/source.tif
Requires numpy, rasterio and Pillow. Does not download data implicitly.
"""
import hashlib, io, json, sys
from pathlib import Path
import numpy as np
import rasterio
from rasterio.enums import Resampling
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
source=Path(sys.argv[1])
with source.open('rb') as f: digest=hashlib.file_digest(f,'sha256').hexdigest()
assert digest=='9d27d4b8ea8e76977e2988bca667d7c8fa68b927355feffcddd6b4875a7fd08e', 'Unexpected NOAA source checksum'
out=ROOT/'site/data/earth';out.mkdir(parents=True,exist_ok=True)
with rasterio.open(source) as src:
    assert (src.width,src.height,src.count)==(21600,10800,1)
    assert src.crs.to_epsg()==9518 # WGS84 + EGM2008 compound CRS
    assert np.allclose(tuple(src.bounds),(-180,-90,180,90))
    assert np.allclose(tuple(src.res),(1/60,1/60))
    def read(w,h):
        a=src.read(1,out_shape=(h,w),resampling=Resampling.average,masked=True)
        assert not np.any(np.ma.getmaskarray(a))
        a=np.rint(a).astype(np.int32)
        assert a.min()>-32768 and a.max()<32768
        return a
    base=read(4096,2048); overview=read(2048,1024)
    reference=[]
    for name,lon,lat in [('Himalayas',86.925,27.9881),('Pacific',-150,0),('Andes',-70.0109,-32.6532),('Mariana',142.2,11.35)]:
        reference.append(dict(name=name,lon=lon,lat=lat,nativeHeightM=float(next(src.sample([(lon,lat)]))[0])))
def encode(a,p):
    n=a+32768
    rgb=np.stack((n>>8,n&255,np.zeros_like(n)),axis=-1).astype('uint8')
    buffer=io.BytesIO()
    Image.fromarray(rgb).save(buffer,format='WEBP',lossless=True,exact=True)
    p.write_bytes(buffer.getvalue())
    decoded=np.array(Image.open(p)).astype(np.int32)
    assert np.array_equal(decoded[:,:,0]*256+decoded[:,:,1]-32768,a)
encode(overview,out/'overview.webp')
for r in range(2):
    for c in range(4): encode(base[r*1024:(r+1)*1024,c*1024:(c+1)*1024],out/f't{r}_{c}.webp')
# Elevation-colored globe, deliberately not represented as satellite imagery.
levels=[-11000,-6000,-1000,-1,0,500,2000,4500,8500]
colors=np.array([[5,18,48],[15,55,100],[35,112,156],[85,170,195],[53,105,61],[111,139,75],[160,140,94],[181,174,156],[245,246,245]])
rgb=np.stack([np.interp(overview,levels,colors[:,i]) for i in range(3)],axis=-1).astype('uint8')
buffer=io.BytesIO();Image.fromarray(rgb).save(buffer,format='JPEG',quality=90);(out/'globe.jpg').write_bytes(buffer.getvalue())
meta_path=ROOT/'site/data/meta.json';meta=json.loads(meta_path.read_text())
meta['earth']=dict(radiusKm=6371.0088,w=4096,h=2048,tile=1024,ovw=2048,ovh=1024,min=int(base.min()),max=int(base.max()),check=int(overview[512].sum()))
meta_path.write_text(json.dumps(meta)+'\n')
cat_path=ROOT/'desktop/packs/catalog.json';cat=json.loads(cat_path.read_text())
cat['builtIn']=[p for p in cat['builtIn'] if p['body']!='earth']+[dict(body='earth',name='Earth · NOAA ETOPO 2022',w=4096,h=2048,bytes=sum(p.stat().st_size for p in out.glob('*.webp')))]
cat['packs']=[p for p in cat['packs'] if p['body']!='earth']+[dict(id='earth-etopo-60',body='earth',name='Earth ETOPO 2022 · 60 arc-seconds · beta',w=21600,h=10800,tile=1024,status='published',format='noaa-geotiff',downloadBytes=465969062,note='NOAA NCEI · ~1.85 km grid at equator · 466 MB · ice surface + ocean depths relative to EGM2008; varying source detail; Windows acceptance pending')]
cat_path.write_text(json.dumps(cat,indent=2,ensure_ascii=False)+'\n')
receipt=dict(source='https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/60s/60s_surface_elev_gtif/ETOPO_2022_v1_60s_N90W180_surface.tif',sha256=digest,bytes=source.stat().st_size,datum='EGM2008 metres; WGS84 geographic pixel registration',processing='Area-average to 4096x2048 and 2048x1024, round to metres; lossless signed int16 RGB WebP',coverage='Global composite; grid spacing does not imply uniformly measured detail',referenceSamples=reference)
(out/'provenance.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt,indent=2))
