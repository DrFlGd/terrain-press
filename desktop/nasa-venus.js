'use strict';
// NASA PDS4 Magellan stereo topography (Herrick et al.). Original 32-bit
// float, little-endian, equirectangular raw IMG: observed coverage ~20%.
// Unmeasured source pixels remain transparent for bundled-DEM fallback.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Readable,Transform}=require('node:stream'),{pipeline}=require('node:stream/promises');
const {PNG}=require('pngjs');
const ID='venus-magellan-stereo-600m';
const ROOT='https://pds-geosciences.wustl.edu/mgn/urn-nasa-pds-magellan_stereo_topography/data/';
const COLS=34505, ROWS=21549, BYTES=COLS*ROWS*4, RES=600;
const RADIUS=6051800, X0=-1690078.35735304, Y0=8143885.38509742;
const VALUE_OFFSET=6040000, TARGET_RADIUS=6051000;
const MAP_W=64800,MAP_H=32400,TILE=1024;
function trusted(res){
  try { const u=new URL(res.url);return u.protocol==='https:'&&u.hostname==='pds-geosciences.wustl.edu'&&!u.username&&!u.password; }
  catch {return false;}
}
function field(hdr,key) {
  const line=hdr.split(/\r?\n/).find(s=>s.split('=')[0]?.trim().toLowerCase()===key.toLowerCase());
  if(!line)throw Error('Missing Venus ENVI header field: '+key);
  return line.slice(line.indexOf('=')+1).trim();
}
function parseMetadata(hdr,xml){
  for(const [k,v] of [['samples',COLS],['lines',ROWS],['bands',1],['header offset',0],
    ['data type',4],['byte order',0]])
    if(Number(field(hdr,k))!==v)throw Error('Unexpected Venus raster '+k);
  if(field(hdr,'interleave').toLowerCase()!=='bsq'||
     !/ENVI Standard/i.test(field(hdr,'file type')))throw Error('Unsupported Venus raster layout');
  const info=field(hdr,'map info').replace(/[{}]/g,'').split(',').map(v=>v.trim());
  if(info[0]!=='Equirectangular'||Number(info[1])!==1||Number(info[2])!==1||
     Math.abs(Number(info[3])-X0)>0.01||Math.abs(Number(info[4])-Y0)>0.01||
     Number(info[5])!==RES||Number(info[6])!==RES)
    throw Error('Venus raster does not match published equirectangular map');
  if(!/Venus_2000/i.test(hdr)||!/6051800/.test(hdr)||
     !/<data_type>IEEE754LSBSingle<\/data_type>/.test(xml)||
     !/<value_offset>\s*6040000(?:\.0+)?\s*<\/value_offset>/.test(xml)||
     !/<latitude_type>planetocentric<\/latitude_type>/.test(xml)||
     !/<longitude_direction>Positive East<\/longitude_direction>/.test(xml)||
     !/<pixel_resolution_x[^>]*>\s*600\s*<\/pixel_resolution_x>/.test(xml))
    throw Error('NASA Venus PDS4 label disagrees with expected reference/height metadata');
  return {cols:COLS,rows:ROWS,bytes:BYTES,scale:1,valueOffset:VALUE_OFFSET,
    sampleType:'IEEE754LSBSingle',radius:RADIUS,spacingMeters:RES,origin:[X0,Y0]};
}
// Zero (a raw radius of only 6,040 km) is not plausible Venus topography.
 // A sparse/zero-filled input must not accidentally mark blank cells observed.
function isObserved(dn){return Number.isFinite(dn)&&dn>1000&&dn<35000;}
function toHeight(dn){return isObserved(dn)?Math.round(dn+VALUE_OFFSET-TARGET_RADIUS):NaN;}
function sourcePixel(lat,lon) {
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
  const x=(lon*Math.PI/180*RADIUS-X0)/RES,y=(Y0-lat*Math.PI/180*RADIUS)/RES;
  return x>=0&&y>=0&&x<COLS&&y<ROWS?{x,y}:null;
}
function mapCell(x,y){
  if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||x<0||y<0||x>=MAP_W||y>=MAP_H)
    throw Error('Venus global pixel out of bounds');
  return {lon:(x+0.5)/MAP_W*360-180,lat:90-(y+0.5)/MAP_H*180};
}
function tileInfo(name){
  const m=/^t(\d+)_(\d+)\.png$/.exec(name);
  if(!m)throw Error('Invalid Venus tile name');
  const row=Number(m[1]),col=Number(m[2]);
  if(!Number.isSafeInteger(row)||!Number.isSafeInteger(col)||
     row>=Math.ceil(MAP_H/TILE)||col>=Math.ceil(MAP_W/TILE))
    throw Error('Venus tile outside global grid');
  return {x:col*TILE,y:row*TILE,width:Math.min(TILE,MAP_W-col*TILE),
    height:Math.min(TILE,MAP_H-row*TILE)};
}
async function fetchSmall(name,signal,max=150000){
  const res=await fetch(ROOT+name,{signal});
  if(!res.ok||!trusted(res)||Number(res.headers.get('content-length')||0)>max)
    throw Error('NASA Venus metadata request failed: '+name);
  const body=await res.text();
  if(body.length>max)throw Error('Oversized NASA Venus metadata');
  return body;
}
function complete(dir) {
  try{
    const r=JSON.parse(fs.readFileSync(path.join(dir,'receipt.json'),'utf8'));
    return r.id===ID&&r.bytes===BYTES&&r.cols===COLS&&r.rows===ROWS&&
      r.valueOffset===VALUE_OFFSET&&/^[a-f0-9]{64}$/.test(r.sha256)&&
      fs.statSync(path.join(dir,'mosaic_allstereo.img')).size===BYTES&&
      fs.statSync(path.join(dir,'coverage.png')).size>100;
  }catch{return false;}
}
async function streamImg(dir,signal,progress,report){
  const target=path.join(dir,'mosaic_allstereo.img'),part=target+'.part';
  if(fs.existsSync(target)&&fs.statSync(target).size===BYTES)return target;
  let offset=fs.existsSync(part)?fs.statSync(part).size:0;
  if(offset>BYTES){fs.rmSync(part,{force:true});offset=0;}
  if(offset===BYTES){fs.renameSync(part,target);return target;}
  const res=await fetch(ROOT+'mosaic_allstereo.img',{signal,
    headers:offset?{Range:'bytes='+offset+'-'}:{}});
  if(!res.body||!trusted(res)||![200,206].includes(res.status))
    throw Error('NASA Venus IMG download failed (HTTP '+res.status+')');
  if(offset&&res.status===206){
    const range=res.headers.get('content-range')||'';
    if(!range.startsWith('bytes '+offset+'-')||!range.endsWith('/'+BYTES))
      throw Error('Unexpected Venus IMG resume response');
  }else if(offset&&res.status===200)offset=0;
  else if(!offset&&res.status===206)throw Error('Unexpected partial NASA image');
  let size=offset,last=0;
  await pipeline(Readable.fromWeb(res.body),new Transform({transform(chunk,enc,cb){
    size+=chunk.length;
    if(size>BYTES)return cb(Error('NASA raster larger than PDS label'));
    progress.currentFileBytes=size;
    if(Date.now()-last>350){last=Date.now();report();}
    cb(null,chunk);
  }}),fs.createWriteStream(part,{flags:offset?'a':'w'}),{signal});
  if(size!==BYTES)throw Error('Incomplete Venus IMG: '+size+'/'+BYTES);
  fs.renameSync(part,target);return target;
}
function readRow(fd,y){
  if(!Number.isInteger(y)||y<0||y>=ROWS)return null;
  const row=Buffer.allocUnsafe(COLS*4);
  if(fs.readSync(fd,row,0,row.length,y*COLS*4)!==row.length)
    throw Error('Incomplete Venus source row');
  return row;
}
// 0.5-degree atlas of 4x4 REAL native pixel probes per cell. Never color
// a rectangular raster extent as "measured". Coverage varies by location.
function coverageAtlas(dir){
  const fd=fs.openSync(path.join(dir,'mosaic_allstereo.img'),'r');
  const png=new PNG({width:720,height:360,colorType:6,inputColorType:6,bitDepth:8});
  const counts=new Uint8Array(720*360);
  try {
    for(let gy=0;gy<360;gy++)for(let sy=0;sy<4;sy++){
      const lat=90-(gy+(sy+.5)/4)*.5;
      const sr=Math.floor((Y0-lat*Math.PI/180*RADIUS)/RES);
      const row=readRow(fd,sr);
      if(!row)continue;
      for(let gx=0;gx<720;gx++){
        let hits=0;
        for(let sx=0;sx<4;sx++){
          const lon=-180+(gx+(sx+.5)/4)*.5;
          const sc=Math.floor((lon*Math.PI/180*RADIUS-X0)/RES);
          if(sc>=0&&sc<COLS&&isObserved(row.readFloatLE(sc*4)))hits++;
        }
        counts[gy*720+gx]+=hits; // 4 rows of 4 probes = 16 total per bin
      }
    }
  }finally{fs.closeSync(fd);}
  let any=0;
  for(let i=0;i<counts.length;i++){
    if(counts[i]>0)any++;
    const at=i*4;
    png.data[at]=Math.round(counts[i]/16*255);
    png.data[at+3]=255;
  }
  fs.writeFileSync(path.join(dir,'coverage.png'),PNG.sync.write(png,{colorType:6}));
  return {width:720,height:360,sourceCoverageBins:any,
    coveredPercent:+(any/259200*100).toFixed(2),binSizeDegrees:0.5,
    method:'4x4 observed sample fraction per cell; approximate coverage'};
}
async function install({staging,signal,progress,report}){
  fs.mkdirSync(staging,{recursive:true});progress.totalFiles=1;progress.totalBytes=BYTES;
  progress.phase='verifying NASA Venus metadata';report();
  const [hdr,xml]=await Promise.all([fetchSmall('mosaic_allstereo.hdr',signal),
    fetchSmall('mosaic_allstereo.xml',signal)]);
  parseMetadata(hdr,xml);
  fs.writeFileSync(path.join(staging,'mosaic_allstereo.hdr'),hdr);
  fs.writeFileSync(path.join(staging,'mosaic_allstereo.xml'),xml);
  progress.phase='downloading from NASA';report();
  const img=await streamImg(staging,signal,progress,report);
  progress.phase='mapping observed stereo coverage';report();
  const coverage=coverageAtlas(staging);
  progress.phase='verifying native raster checksum';report();
  const sha256=await new Promise((resolve,reject)=>{
    const hash=crypto.createHash('sha256'),stream=fs.createReadStream(img);
    stream.on('data',b=>hash.update(b));stream.on('error',reject);
    stream.on('end',()=>resolve(hash.digest('hex')));
  });
  const receipt={schemaVersion:1,id:ID,body:'venus',provider:'NASA PDS / Magellan / Herrick',
    source:ROOT,bytes:BYTES,cols:COLS,rows:ROWS,sha256,valueOffset:VALUE_OFFSET,
    heightReferenceMeters:TARGET_RADIUS,projection:'planetocentric positive-east equirectangular',
    sourcePixelMeters:600,effectiveDetailKm:'1-2',coverage,installedAt:new Date().toISOString()};
  fs.writeFileSync(path.join(staging,'receipt.json'),JSON.stringify(receipt,null,2));
  progress.doneFiles=1;progress.downloadedBytes=BYTES;progress.currentFileBytes=0;
  progress.phase='complete';report();return receipt;
}
function generateTile(dir,name){
  const {x,y,width,height}=tileInfo(name);
  const fd=fs.openSync(path.join(dir,'mosaic_allstereo.img'),'r');
  const png=new PNG({width,height,colorType:6,inputColorType:6,bitDepth:8});
  let cached=-1,row=null;
  try {
    for(let iy=0;iy<height;iy++){
      const lat=mapCell(x,y+iy).lat;
      const sy=Math.round((Y0-lat*Math.PI/180*RADIUS)/RES);
      if(sy<0||sy>=ROWS)continue;
      if(sy!==cached){row=readRow(fd,sy);cached=sy;}
      for(let ix=0;ix<width;ix++){
        const lon=mapCell(x+ix,y+iy).lon;
        const sx=Math.round((lon*Math.PI/180*RADIUS-X0)/RES);
        if(sx<0||sx>=COLS)continue;
        const heightM=toHeight(row.readFloatLE(sx*4));
        if(!Number.isFinite(heightM))continue; // alpha zero -> bundled fallback
        const value=heightM+8388608,at=(iy*width+ix)*4;
        if(value<0||value>16777215)throw Error('Venus elevation exceeds signed-24 encoding');
        png.data[at]=(value>>16)&255;png.data[at+1]=(value>>8)&255;
        png.data[at+2]=value&255;png.data[at+3]=255;
      }
    }
    return PNG.sync.write(png,{colorType:6});
  }finally{fs.closeSync(fd);}
}
module.exports={ID,ROOT,COLS,ROWS,BYTES,MAP_W,MAP_H,TILE,RADIUS,X0,Y0,
 VALUE_OFFSET,parseMetadata,isObserved,toHeight,sourcePixel,mapCell,tileInfo,
 trusted,complete,install,coverageAtlas,generateTile};
