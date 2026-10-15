'use strict';
// Public Copernicus COGs: WGS84 point samples, EGM2008 surface heights.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Readable,Transform}=require('node:stream'),{pipeline}=require('node:stream/promises');
const {PNG}=require('pngjs');
const MAX_CELLS=64,MAX_FILE=100*1024*1024,REGION=/^earth-cop(?:30|90)-[a-f0-9]{16}$/;
const wrap=x=>((x+180)%360+360)%360-180;
function ppd(r){if(![30,90].includes(r))throw Error('Choose 30 m or 90 m terrain');return r===30?3600:1200;}
function cellName(r,south,west){
 ppd(r);if(!Number.isInteger(south)||south< -90||south>89||!Number.isInteger(west)||west< -180||west>179)throw Error('Invalid Copernicus cell');
 return `Copernicus_DSM_COG_${r===30?'10':'30'}_${south<0?'S':'N'}${String(Math.abs(south)).padStart(2,'0')}_00_${west<0?'W':'E'}${String(Math.abs(west)).padStart(3,'0')}_00_DEM`;
}
function urlFor(r,c){const n=cellName(r,c.south,c.west);return `https://copernicus-dem-${r}m.s3.amazonaws.com/${n}/${n}.tif`;}
function regionCells(q){
 if(!q||![q.lat,q.lon,q.sizeKm].every(Number.isFinite)||Math.abs(q.lat)>90||q.lon< -180||q.lon>180||q.sizeKm<1||q.sizeKm>500)throw Error('Choose Earth coordinates and a region width between 1 and 500 km');
 const n=ppd(q.resolution),rad=Math.PI/180,d=q.sizeKm/Math.SQRT2/6371.0088/rad+2/n;
 const south=Math.max(-90,q.lat-d),north=Math.min(90,q.lat+d);
 const dx=(north>=90||south<=-90)?180:Math.asin(Math.min(1,Math.sin(d*rad)/Math.cos(q.lat*rad)))/rad;
 const cells=[],seen=new Set();
 for(let y=Math.floor(south);y<=Math.min(89,Math.floor(north));y++)for(let x=Math.floor(q.lon-dx);x<=Math.floor(q.lon+dx);x++){
  const west=wrap(x),key=y+','+west;if(seen.has(key))continue;seen.add(key);cells.push({south:y,west});
  if(cells.length>MAX_CELLS)throw Error('This selection needs more than 64 source cells. Choose a smaller region, especially near a pole.');
 }
 return cells.sort((a,b)=>a.south-b.south||a.west-b.west);
}
async function boundedBody(response,limit){let size=0;const chunks=[];for await(const c of Readable.fromWeb(response.body)){size+=c.length;if(size>limit)throw Error('Source response exceeds size limit');chunks.push(c);}return Buffer.concat(chunks);}
async function plan(q,{fetcher=fetch,signal}={}){
 const cells=regionCells(q),base=`https://copernicus-dem-${q.resolution}m.s3.amazonaws.com/`;
 const r=await fetcher(base+'tileList.txt',{signal});
 if(!r.ok||r.url!==base+'tileList.txt'||!r.body)throw Error('Could not read Copernicus public coverage index');
 const index=new Set((await boundedBody(r,8*1024*1024)).toString('utf8').split(/\r?\n/).map(s=>s.trim().replace(/\/$/,'')));
 const listed=cells.filter(c=>index.has(cellName(q.resolution,c.south,c.west)));
 if(!listed.length)throw Error('No public land tiles cover this area at the selected resolution. Try 90 m or retain NOAA ocean terrain.');
 const files=[];
 for(const c of listed){const url=urlFor(q.resolution,c),h=await fetcher(url,{method:'HEAD',signal}),bytes=Number(h.headers.get('content-length')),etag=h.headers.get('etag');
  if(!h.ok||h.url!==url||!Number.isSafeInteger(bytes)||bytes<=0||bytes>MAX_FILE||!etag||etag.length>200)throw Error('Could not verify source tile size/version');
  files.push({...c,name:cellName(q.resolution,c.south,c.west)+'.tif',bytes,etag});
 }
 const id='earth-cop'+q.resolution+'-'+crypto.createHash('sha256').update(JSON.stringify({resolution:q.resolution,cells:cells.map(c=>[c.south,c.west])})).digest('hex').slice(0,16);
 return {schemaVersion:1,id,resolution:q.resolution,query:{lat:q.lat,lon:q.lon,sizeKm:q.sizeKm},files,missingCells:cells.length-files.length,downloadBytes:files.reduce((s,f)=>s+f.bytes,0)};
}
function validatePlan(p){
 if(!p||p.schemaVersion!==1||!REGION.test(p.id)||!p.id.startsWith('earth-cop'+p.resolution+'-')||!Array.isArray(p.files)||p.files.length<1||p.files.length>MAX_CELLS)throw Error('Invalid saved region');
 regionCells({...p.query,resolution:p.resolution});const seen=new Set();
 for(const f of p.files){if(f.name!==cellName(p.resolution,f.south,f.west)+'.tif'||seen.has(f.name)||!Number.isSafeInteger(f.bytes)||f.bytes<1||f.bytes>MAX_FILE||typeof f.etag!=='string'||!f.etag||f.etag.length>200)throw Error('Invalid saved terrain file');seen.add(f.name);}
 if(p.downloadBytes!==p.files.reduce((s,f)=>s+f.bytes,0)||!Number.isInteger(p.missingCells)||p.missingCells<0||p.missingCells+p.files.length>MAX_CELLS)throw Error('Invalid regional size/coverage');
 return p;
}
function describe(p){validatePlan(p);const n=ppd(p.resolution);return {id:p.id,body:'earth',format:'copernicus-region',regional:true,resolution:p.resolution,w:360*n,h:180*n,tile:1024,status:'published',name:`Earth Copernicus ${p.resolution} m · ${p.query.lat.toFixed(2)}°, ${p.query.lon.toFixed(2)}° · ${p.query.sizeKm} km`,note:`Saved regional surface model · ${p.files.length} land cells · ${p.missingCells} unavailable cells use lower-resolution terrain`,downloadBytes:p.downloadBytes,coverage:p.files.map(f=>({west:f.west,east:f.west+1,south:f.south,north:f.south+1}))};}
function read(dir){return validatePlan(JSON.parse(fs.readFileSync(path.join(dir,'region.json'),'utf8')));}
function complete(dir,id){try{const p=read(dir);return p.id===id&&p.files.every(f=>/^[a-f0-9]{64}$/.test(f.sha256)&&fs.statSync(path.join(dir,f.name)).size===f.bytes);}catch{return false;}}
function longitudeFactor(south){const lat=Math.abs(south<0?south+1:south);return lat<50?1:lat<60?1.5:lat<70?2:lat<80?3:lat<85?5:10;}
function validateImage(image,resolution,cell){
 const n=ppd(resolution),w=n/longitudeFactor(cell.south),o=image.getOrigin(),r=image.getResolution(),k=image.getGeoKeys(),near=(a,b)=>Number.isFinite(a)&&Math.abs(a-b)<1e-8;
 // The mirror strips east/south overlap; tiepoint is the NW sample center.
 if(image.getWidth()!==w||image.getHeight()!==n||image.getSamplesPerPixel()!==1||k.GeographicTypeGeoKey!==4326||k.GTRasterTypeGeoKey!==2||!near(o[0],cell.west)||!near(o[1],cell.south+1)||!near(r[0],1/w)||!near(r[1],-1/n))throw Error('Unexpected Copernicus grid, origin, registration or coordinates');
 // Mirror omits vertical CRS GeoKey. EGM2008 comes from source specification.
 return {w,h:n,origin:o,resolution:r};
}
async function open(file,resolution,cell){const {fromFile}=await import('geotiff'),tif=await fromFile(file);try{const image=await tif.getImage();validateImage(image,resolution,cell);return {tif,image};}catch(e){await tif.close();throw e;}}
async function hashFile(file,signal){const hash=crypto.createHash('sha256');for await(const c of fs.createReadStream(file)){signal?.throwIfAborted();hash.update(c);}return hash.digest('hex');}
async function downloadFile(p,f,dir,signal,notify,fetcher=fetch){
 const target=path.join(dir,f.name),partial=target+'.part',version=partial+'.etag';
 if(fs.existsSync(target)&&fs.statSync(target).size===f.bytes&&f.sha256&&await hashFile(target,signal)===f.sha256){notify(f.bytes);return f.sha256;}
 let offset=0;if(fs.existsSync(partial)&&fs.existsSync(version)&&fs.readFileSync(version,'utf8')===f.etag)offset=fs.statSync(partial).size;if(offset>f.bytes)offset=0;
 if(offset!==f.bytes){
  const url=urlFor(p.resolution,f),response=await fetcher(url,{signal,headers:{'If-Match':f.etag,...(offset?{Range:`bytes=${offset}-`}:{})}});
  if(response.url!==url||!response.body||![200,206].includes(response.status)||response.headers.get('etag')!==f.etag)throw Error('Regional download failed or source changed; check area again');
  if(response.status===206){if(response.headers.get('content-range')!==`bytes ${offset}-${f.bytes-1}/${f.bytes}`)throw Error('Unexpected regional resume range');}else offset=0;
  fs.writeFileSync(version,f.etag);let total=offset,last=0;
  const inspect=new Transform({transform(chunk,enc,cb){total+=chunk.length;if(total>f.bytes)return cb(Error('Terrain tile exceeds expected size'));if(Date.now()-last>300){last=Date.now();notify(total);}cb(null,chunk);}});
  await pipeline(Readable.fromWeb(response.body),inspect,fs.createWriteStream(partial,{flags:offset?'a':'w'}),{signal});if(total!==f.bytes)throw Error('Terrain tile incomplete; retry to resume');
 }
 const {tif}=await open(partial,p.resolution,f);await tif.close();const sha=await hashFile(partial,signal);fs.renameSync(partial,target);fs.rmSync(version,{force:true});notify(f.bytes);return sha;
}
async function install(p,dir,{signal,progress,report,fetcher=fetch}){
 validatePlan(p);fs.mkdirSync(dir,{recursive:true});let old;try{old=read(dir);}catch{}const result=JSON.parse(JSON.stringify(p));
 progress.totalFiles=p.files.length;progress.totalBytes=p.downloadBytes;
 for(const f of result.files){signal.throwIfAborted();const previous=old?.files.find(x=>x.name===f.name&&x.etag===f.etag&&x.bytes===f.bytes);if(previous)f.sha256=previous.sha256;
  progress.phase='downloading regional terrain';report();f.sha256=await downloadFile(p,f,dir,signal,n=>{progress.currentFileBytes=n;report();},fetcher);
  progress.downloadedBytes+=f.bytes;progress.currentFileBytes=0;progress.doneFiles++;
  const temp=path.join(dir,'region.json.tmp');fs.writeFileSync(temp,JSON.stringify(result,null,2));fs.renameSync(temp,path.join(dir,'region.json'));report();
 }
 return result;
}
function tileInfo(p,name){const n=ppd(p.resolution),w=360*n,h=180*n,m=/^t(\d+)_(\d+)\.png$/.exec(name);if(!m)throw Error('Invalid regional tile path');const y=Number(m[1])*1024,x=Number(m[2])*1024;if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||x>=w||y>=h)throw Error('Regional tile outside Earth');return {x,y,width:Math.min(1024,w-x),height:Math.min(1024,h-y),ppd:n};}
function interpolate(a,w,h,x,y,nodata){
 x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,y));const x0=Math.floor(x),y0=Math.floor(y),tx=x-x0,ty=y-y0;
 const v=[a[y0*w+x0],a[y0*w+Math.min(w-1,x0+1)],a[Math.min(h-1,y0+1)*w+x0],a[Math.min(h-1,y0+1)*w+Math.min(w-1,x0+1)]];
 if(v.some(v=>!Number.isFinite(v)||v< -12000||v>10000||(nodata!==null&&v===nodata)))return NaN;
 return (v[0]*(1-tx)+v[1]*tx)*(1-ty)+(v[2]*(1-tx)+v[3]*tx)*ty;
}
async function generateTile(dir,p,name){
 const t=tileInfo(p,name),png=new PNG({width:t.width,height:t.height});png.data.fill(0);
 const west=-180+(t.x+.5)/t.ppd,east=-180+(t.x+t.width-.5)/t.ppd,north=90-(t.y+.5)/t.ppd,south=90-(t.y+t.height-.5)/t.ppd;
 for(const f of read(dir).files){
  if(f.west>east||f.west+1<=west||f.south>=north||f.south+1<south)continue;
  const {tif,image}=await open(path.join(dir,f.name),p.resolution,f);
  try{const [ox,oy]=image.getOrigin(),[dx,dy]=image.getResolution(),iw=image.getWidth(),ih=image.getHeight();
   const x0=Math.max(0,Math.floor((Math.max(west,f.west)-ox)/dx)),x1=Math.min(iw,Math.ceil((Math.min(east,f.west+1)-ox)/dx)+2);
   const y0=Math.max(0,Math.floor((Math.min(north,f.south+1)-oy)/dy)),y1=Math.min(ih,Math.ceil((Math.max(south,f.south)-oy)/dy)+2);
   const a=await image.readRasters({window:[x0,y0,x1,y1],samples:[0],interleave:true}),nd=image.getGDALNoData();
   for(let row=0;row<t.height;row++){const lat=90-(t.y+row+.5)/t.ppd;if(lat<=f.south||lat>f.south+1)continue;
    for(let col=0;col<t.width;col++){const lon=-180+(t.x+col+.5)/t.ppd;if(lon<f.west||lon>=f.west+1)continue;
     const value=interpolate(a,x1-x0,y1-y0,(lon-ox)/dx-x0,(lat-oy)/dy-y0,nd);if(!Number.isFinite(value))continue;
     const k=4*(row*t.width+col),v=Math.round(value)+8388608;png.data[k]=(v>>16)&255;png.data[k+1]=(v>>8)&255;png.data[k+2]=v&255;png.data[k+3]=255;
    }
   }
  }finally{await tif.close();}
 }
 return PNG.sync.write(png,{colorType:6});
}
module.exports={REGION,MAX_CELLS,ppd,cellName,urlFor,regionCells,plan,validatePlan,describe,read,complete,longitudeFactor,validateImage,open,hashFile,downloadFile,install,tileInfo,interpolate,generateTile};
