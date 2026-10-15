'use strict';
// Source-controlled NOAA Earth and USGS planetary elevation GeoTIFFs. Source-specific
// vertical datum and longitudinal origin are part of the fixed, audited config.
// This path is deliberately separate from NASA LOLA/MOLA native IMG decoding.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { PNG } = require('pngjs');
const HOST = 'planetarymaps.usgs.gov';
const PRODUCTS = Object.freeze({
  'earth-etopo-30': Object.freeze({
    body:'earth', file:'ETOPO_2022_v1_30s_N90W180_surface.tif',
    url:'https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/30s/30s_surface_elev_gtif/ETOPO_2022_v1_30s_N90W180_surface.tif',
    sha256:'8630abc401cc6bdd30b507a68d3eb9eda5b65f5636f7199e4b1eefd476b5a9e2',
    provider:'NOAA NCEI', w:43200, h:21600, longitudeStart:-180,
    encoding:'int24', kind:'relative', originM:0, expectedBytes:1585813987,
    dataCoverage:'global composite; measured and interpolated elevations',
    verticalDatum:'metres relative to EGM2008 geoid; ice surface and ocean floor'
  }),
  'earth-etopo-60': Object.freeze({
    body: 'earth', file: 'ETOPO_2022_v1_60s_N90W180_surface.tif',
    url: 'https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/60s/60s_surface_elev_gtif/ETOPO_2022_v1_60s_N90W180_surface.tif',
    sha256: '9d27d4b8ea8e76977e2988bca667d7c8fa68b927355feffcddd6b4875a7fd08e',
    provider: 'NOAA NCEI', w: 21600, h: 10800, longitudeStart: -180,
    encoding: 'int24', kind: 'relative', originM: 0, expectedBytes: 465969062,
    dataCoverage: 'global composite; measured and interpolated elevations',
    verticalDatum: 'metres relative to EGM2008 geoid; ice surface and ocean floor'
  }),
  'mercury-messenger-64': Object.freeze({
    body: 'mercury', file: 'Mercury_Messenger_USGS_DEM_Global_665m_v2.tif',
    w: 23040, h: 11520, longitudeStart: 0, encoding: 'int24', kind: 'relative',
    originM: 0, expectedBytes: 506000000, dataCoverage: 'global'
  }),
  'ceres-dawn-60': Object.freeze({
    body: 'ceres', file: 'Ceres_Dawn_FC_HAMO_DTM_DLR_Global_60ppd_Oct2016.tif',
    w: 21600, h: 10800, longitudeStart: 0, encoding: 'int24', kind: 'relative',
    originM: 0, expectedBytes: 446000000, dataCoverage: '~98% observed; shadows interpolated'
  }),
  'vesta-dawn-48': Object.freeze({
    body: 'vesta', file: 'Vesta_Dawn_HAMO_DTM_DLR_Global_48ppd.tif',
    w: 17280, h: 8640, longitudeStart: -180, encoding: 'int24', kind: 'radius',
    originM: 255000, expectedBytes: 570000000, dataCoverage: '~95% stereo coverage'
  })
});
const TIFF_NAME = 'elevation.tif';
function product(id) {
  if (!Object.hasOwn(PRODUCTS,id)) throw new Error('Unsupported terrain GeoTIFF product');
  return PRODUCTS[id];
}
function urlFor(id) { return product(id).url || 'https://' + HOST + '/mosaic/' + product(id).file; }
function trustedResponse(res, p) {
  try {
    const u = new URL(res.url);
    return u.protocol === 'https:' &&
      (p?.body === 'earth' ? u.href === p.url :
        [HOST, 'asc-pds-services.s3.us-west-2.amazonaws.com'].includes(u.hostname)) &&
      !u.username && !u.password && !u.hash;
  } catch { return false; }
}
function encodeHeight(value, p) {
  if (!Number.isFinite(value)) throw new Error('NoData elevation in ' + p.body + ' terrain');
  const h = Math.round(value - p.originM);
  if (!Number.isSafeInteger(h) || Math.abs(h) > 8388607)
    throw new Error('Out-of-range elevation in ' + p.body + ' dataset');
  return h + 8388608;
}
function decodeHeight(rgb) { return rgb - 8388608; }
function isMissingSample(value, noData, p) {
  return !Number.isFinite(value) || (noData !== null && value === Number(noData)) ||
    value === -32768 || Math.abs(value) > 1e7 ||
    (p.kind === 'radius' && value < 100000);
}
function fileSignature(f) {
  const fd=fs.openSync(f,'r');
  try {
    const b=Buffer.alloc(4);
    if (fs.readSync(fd,b,0,4,0)!==4 ||
      !(b.equals(Buffer.from([73,73,42,0])) || b.equals(Buffer.from([77,77,0,42])) ||
        b.equals(Buffer.from([73,73,43,0])) || b.equals(Buffer.from([77,77,0,43]))))
      throw new Error('Terrain download is not a TIFF elevation raster');
  } finally { fs.closeSync(fd); }
}
async function openImage(file,p) {
  const { fromFile } = await import('geotiff');
  const tif = await fromFile(file);
  try {
    const image=await tif.getImage();
    if (image.getWidth()!==p.w || image.getHeight()!==p.h ||
      image.getSamplesPerPixel()!==1)
      throw new Error('Incorrect GeoTIFF dimensions or band count for '+p.body);
    // Global raster is pixel registered and north-up; the source catalog fixes
    // its longitude domain. Avoid silently importing a flipped image.
    const res = typeof image.getResolution==='function' ? image.getResolution() : null;
    if (res && (!Number.isFinite(res[0]) || !Number.isFinite(res[1]) || res[1]>=0))
      throw new Error('Unexpected GeoTIFF vertical orientation for '+p.body);
    if (p.body === 'earth') validateEarthImage(image,p);
    return { tif, image };
  } catch (e) { await tif.close(); throw e; }
}
function validateEarthImage(image,p=PRODUCTS['earth-etopo-60']) {
  const origin = image.getOrigin(), resolution = image.getResolution();
  const keys = image.getGeoKeys();
  const near = (a,b) => Number.isFinite(a) && Math.abs(a-b)<1e-8;
  if (!near(origin[0],-180) || !near(origin[1],90) ||
      !near(resolution[0],360/p.w) || !near(resolution[1],-180/p.h) ||
      keys.GeographicTypeGeoKey !== 4326 || keys.VerticalCSTypeGeoKey !== 3855 ||
      keys.GTRasterTypeGeoKey !== 1)
    throw new Error('Earth ETOPO must be pixel-registered WGS84/EGM2008, north-up, -180..180');
}
function complete(dir,id) {
  try {
    const p=product(id), receipt=JSON.parse(fs.readFileSync(path.join(dir,'receipt.json'),'utf8'));
    return receipt.id===id && receipt.body===p.body &&
      /^[a-f0-9]{64}$/.test(receipt.sha256) &&
      Number.isSafeInteger(receipt.bytes) && receipt.bytes>0 &&
      (!p.sha256 || (receipt.sha256===p.sha256 && receipt.bytes===p.expectedBytes)) &&
      fs.statSync(path.join(dir,TIFF_NAME)).size===receipt.bytes;
  } catch { return false; }
}
async function fetchRaster(p,id,staging,signal,onBytes) {
  const target=path.join(staging,TIFF_NAME), partial=target+'.part';
  if (fs.existsSync(target)) {
    fileSignature(target);
    onBytes(fs.statSync(target).size); return target;
  }
  let offset=fs.existsSync(partial)?fs.statSync(partial).size:0;
  if (offset>p.expectedBytes*3) {fs.rmSync(partial,{force:true}); offset=0;}
  const response=await fetch(urlFor(id),{signal,headers:offset?{Range:'bytes='+offset+'-'}:{}});
  if(!trustedResponse(response,p)||!response.body||![200,206].includes(response.status))
    throw new Error('Terrain GeoTIFF download failed (HTTP '+response.status+')');
  if (offset && response.status===206) {
    const range=response.headers.get('content-range')||'';
    if(!range.startsWith('bytes '+offset+'-')) throw new Error('Unexpected terrain resume response');
  } else if (offset && response.status===200) offset=0;
  else if (!offset && response.status===206) throw new Error('Unexpected partial terrain response');
  let total=offset;
  const inspect=new Transform({transform(chunk,enc,callback){
    total+=chunk.length;
    if(total>p.expectedBytes*3) return callback(new Error('Terrain TIFF exceeds safety size'));
    onBytes(total);callback(null,chunk);
  }});
  await pipeline(Readable.fromWeb(response.body),inspect,
    fs.createWriteStream(partial,{flags:offset?'a':'w'}),{signal});
  if (p.body === 'earth' && total !== p.expectedBytes)
    throw new Error('Incomplete NOAA ETOPO download; retry to resume');
  fs.renameSync(partial,target);
  fileSignature(target);
  return target;
}
async function install({id,staging,signal,progress,report}) {
  const p=product(id);
  fs.mkdirSync(staging,{recursive:true});
  progress.totalFiles=1; progress.totalBytes=p.expectedBytes;
  progress.phase='downloading from '+(p.provider || 'USGS');report();
  let last=0;
  const raster=await fetchRaster(p,id,staging,signal,n=>{
    progress.currentFileBytes=n;
    const now=Date.now();
    if(now-last>350){last=now;report();}
  });
  progress.phase='validating GeoTIFF';report();
  const {tif,image}=await openImage(raster,p);
  try {
    // Probe spatially separated pixels to catch corrupt or mismatched files.
    for(const [x,y] of [[0,0],[Math.floor(p.w/2),Math.floor(p.h/2)],[p.w-1,p.h-1]]) {
      const values=await image.readRasters({window:[x,y,x+1,y+1],samples:[0],interleave:true});
      const v=Number(values[0]);
      if(Number.isFinite(v)) encodeHeight(v,p);
    }
  } finally {await tif.close();}
  const hash=crypto.createHash('sha256');
  await new Promise((resolve,reject)=>{
    const s=fs.createReadStream(raster);
    s.on('data',v=>hash.update(v));s.on('error',reject);s.on('end',resolve);
  });
  const receipt={schemaVersion:1,id,body:p.body,source:urlFor(id),
    provider:p.provider || 'USGS Astrogeology Science Center',bytes:fs.statSync(raster).size,
    sha256:hash.digest('hex'),verticalDatum:p.verticalDatum || (p.kind==='radius'
      ? 'radii in metres above body center; app subtracts '+p.originM+' m'
      : 'elevation relative to product reference surface, in metres'),
    longitudeStart:p.longitudeStart,downloadedAt:new Date().toISOString()};
  if (p.sha256 && receipt.sha256 !== p.sha256) {
    fs.rmSync(raster, {force:true});
    throw new Error('NOAA ETOPO checksum mismatch; retry to download the pinned source');
  }
  fs.writeFileSync(path.join(staging,'receipt.json'),JSON.stringify(receipt,null,2));
  progress.downloadedBytes=receipt.bytes;progress.currentFileBytes=0;progress.doneFiles=1;
  report();
  return receipt;
}
function tileInfo(id,tileName) {
  const p=product(id),m=/^t(\d+)_(\d+)\.png$/.exec(tileName);
  if(!m) throw new Error('Unexpected GeoTIFF tile name');
  const row=Number(m[1]),col=Number(m[2]);
  if(!Number.isSafeInteger(row)||!Number.isSafeInteger(col)||
      row>=Math.ceil(p.h/1024)||col>=Math.ceil(p.w/1024))
    throw new Error('Tile outside '+p.body+' global grid');
  const x=col*1024,y=row*1024;
  return {x,y,width:Math.min(1024,p.w-x),height:Math.min(1024,p.h-y)};
}
async function generateTile(dir,id,tileName) {
  const p=product(id),{x,y,width,height}=tileInfo(id,tileName);
  const {tif,image}=await openImage(path.join(dir,TIFF_NAME),p);
  try {
    const png=new PNG({width,height,colorType:6,inputColorType:6,bitDepth:8});
    // Source longitude domain 0..360 E starts 180° across our -180..180 grid.
    // Read up to two windows if a tile straddles the 0/360 source seam.
    let k=0;
    while(k<width) {
      const sx=(x+k+(p.longitudeStart===0?p.w/2:0))%p.w;
      const run=Math.min(width-k,p.w-sx);
      const values=await image.readRasters({
        window:[sx,y,sx+run,y+height],samples:[0],interleave:true
      });
      const nodata=typeof image.getGDALNoData==='function' ? image.getGDALNoData() : null;
      for(let iy=0;iy<height;iy++)for(let ix=0;ix<run;ix++){
        const raw=Number(values[iy*run+ix]),at=4*(iy*width+k+ix);
        if(isMissingSample(raw,nodata,p)) {
          // Transparent samples allow the consumer to fall back to bundled DEM
          // for unmapped areas; alpha is retained through OffscreenCanvas.
          png.data[at]=png.data[at+1]=png.data[at+2]=0;png.data[at+3]=0;
          continue;
        }
        const num=encodeHeight(raw,p);
        png.data[at]=(num>>16)&255;png.data[at+1]=(num>>8)&255;
        png.data[at+2]=num&255;png.data[at+3]=255;
      }
      k+=run;
    }
    return PNG.sync.write(png,{colorType:6});
  } finally {await tif.close();}
}
module.exports={PRODUCTS,product,urlFor,trustedResponse,encodeHeight,decodeHeight,
  complete,install,tileInfo,generateTile,openImage,isMissingSample,validateEarthImage};
