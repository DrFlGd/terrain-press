/* Terrain Press layered image panels. Heights are artistic color bands, not elevation. */
(function(root) {
'use strict';
const luminance = c => .2126*c[0]+.7152*c[1]+.0722*c[2];
function quantize(rgba, width, height, count, cleanDiagonals = true) {
  if (!Number.isInteger(count)||count<2||count>8||rgba.length!==width*height*4) throw Error('Invalid palette or image');
  // Typed pixel indices avoid one RGB array per cell at 1024² resolution.
  const size=width*height, order=new Uint32Array(size), light=new Float64Array(size);
  for(let i=0;i<size;i++){order[i]=i;light[i]=.2126*rgba[i*4]+.7152*rgba[i*4+1]+.0722*rgba[i*4+2];}
  order.sort((a,b)=>light[a]-light[b]);
  let palette=Array.from({length:count},(_,i)=>{const p=order[Math.floor((i+.5)*size/count)]*4;return [rgba[p],rgba[p+1],rgba[p+2]];});
  const nearest=i=>{let best=0,d=Infinity;const r=rgba[i*4],g=rgba[i*4+1],b=rgba[i*4+2];
    for(let k=0;k<count;k++){const c=palette[k],v=(c[0]-r)**2+(c[1]-g)**2+(c[2]-b)**2;if(v<d){d=v;best=k;}}return best;};
  for(let pass=0;pass<12;pass++){
    const sums=palette.map(()=>[0,0,0,0]);
    for(let i=0;i<size;i++){const s=sums[nearest(i)],p=i*4;s[0]+=rgba[p];s[1]+=rgba[p+1];s[2]+=rgba[p+2];s[3]++;}
    palette=palette.map((c,k)=>sums[k][3]?sums[k].slice(0,3).map(x=>x/sums[k][3]):c);
  }
  palette.sort((a,b)=>luminance(a)-luminance(b));
  const labels=new Uint8Array(size);for(let i=0;i<size;i++)labels[i]=nearest(i);
  // Remove diagonal-only connections at every threshold. Lowering terminates,
  // preserves nested masks and avoids four faces meeting along one vertical edge.
  let changed=cleanDiagonals, removed=0;
  while(changed){changed=false;for(let y=0;y<height-1;y++)for(let x=0;x<width-1;x++){
    const a=y*width+x,b=a+1,c=a+width,d=c+1;
    for(const [u,v,r,s] of [[a,d,b,c],[b,c,a,d]]) {
      const floor=Math.max(labels[r],labels[s]);
      if(Math.min(labels[u],labels[v])>floor){labels[u]=floor;removed++;changed=true;}
    }
  }}
  return {labels,palette:palette.map(c=>c.map(Math.round)),width,height,removed};
}
// Spread a palette apart from its mean color: 0 leaves it alone, 100 triples every difference.
// Luminance order is preserved, so band heights keep their meaning; channels clamp at 0 and 255.
function contrast(palette, amount) {
  const f=1+Math.max(0,Math.min(100,+amount||0))/50;
  const mean=[0,1,2].map(i=>palette.reduce((s,c)=>s+c[i],0)/palette.length);
  return palette.map(c=>c.map((v,i)=>Math.round(Math.max(0,Math.min(255,mean[i]+(v-mean[i])*f)))));
}
function mesh(panel, widthMM, layerHeight, bandLayers, backingLayers) {
  if(!Number.isFinite(widthMM)||widthMM<40||widthMM>250||!Number.isFinite(layerHeight)||layerHeight<.1||layerHeight>.4||!Number.isInteger(bandLayers)||bandLayers<1||bandLayers>10||!Number.isInteger(backingLayers)||backingLayers<2||backingLayers>30) throw Error('Invalid panel dimensions');
  const {labels,width:w,height:h,palette}=panel, step=widthMM/w;
  const levels=[0,...palette.map((_,k)=>(backingLayers+k*bandLayers)*layerHeight)];
  // Allocate once: boxed number arrays are costly at 1024 cells across.
  let quads=2*w*h;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const k=labels[y*w+x]+1;
    for(const [nx,ny] of [[x,y-1],[x+1,y],[x,y+1],[x-1,y]]){
      const low=nx<0||ny<0||nx>=w||ny>=h?0:labels[ny*w+nx]+1;
      quads+=Math.max(0,k-low);
    }
  }
  const tris=new Float32Array(quads*18),colors=new Uint8Array(quads*2);let ti=0,ci=0;
  const vertex=(x,y,z)=>[x*step-widthMM/2,(h-y)*step-h*step/2,levels[z]];
  const quad=(a,b,c,d,color)=>{tris.set(a,ti);tris.set(b,ti+3);tris.set(c,ti+6);tris.set(a,ti+9);tris.set(c,ti+12);tris.set(d,ti+15);ti+=18;colors[ci++]=color;colors[ci++]=color;};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const k=labels[y*w+x]+1;
    quad(vertex(x,y,k),vertex(x,y+1,k),vertex(x+1,y+1,k),vertex(x+1,y,k),k-1);
    quad(vertex(x,y,0),vertex(x+1,y,0),vertex(x+1,y+1,0),vertex(x,y+1,0),0);
    // Clockwise perimeter in image coordinates; outward-facing walls.
    for(const [nx,ny,ax,ay,bx,by] of [[x,y-1,x+1,y,x,y],[x+1,y,x+1,y+1,x+1,y],[x,y+1,x,y+1,x+1,y+1],[x-1,y,x,y,x,y+1]]){
      const low=nx<0||ny<0||nx>=w||ny>=h?0:labels[ny*w+nx]+1;
      for(let z=low;z<k;z++)quad(vertex(ax,ay,z),vertex(bx,by,z),vertex(bx,by,z+1),vertex(ax,ay,z+1),z);
    }
  }
  return {tris,colors,widthMM,heightMM:h*step,levels,role:'panel',name:'Layered color panel'};
}
function schedule(palette,layerHeight,bandLayers,backingLayers){
  return palette.map((rgb,i)=>({color:i+1,hex:'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join(''),startLayer:i===0?1:backingLayers+(i-1)*bandLayers+1,startHeightMM:i===0?0:(backingLayers+(i-1)*bandLayers)*layerHeight}));
}
// Image-relative longitude: image centre = 0, left edge = -180.
// Source latitude is planetographic; spherical selection distances are approximate.
function crop(rgba,w,h,q,n,imagery={radiusKm:71492,north:79.9,south:-79.9}) {
  const out=new Uint8Array(n*n*4),r=imagery.radiusKm,rad=Math.PI/180;
  const p=q.lat*rad,l=q.lon*rad;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
    const dx=((x+.5)/n-.5)*q.size,dy=(.5-(y+.5)/n)*q.size;
    const rho=Math.hypot(dx,dy),c=rho/r;
    const lat=rho?Math.asin(Math.max(-1,Math.min(1,Math.cos(c)*Math.sin(p)+dy*Math.sin(c)*Math.cos(p)/rho))):p;
    const lon=rho?l+Math.atan2(dx*Math.sin(c),rho*Math.cos(p)*Math.cos(c)-dy*Math.sin(p)*Math.sin(c)):l;
    if(lat/rad>imagery.north||lat/rad<imagery.south||(imagery.bands&&!imagery.bands.some(([s,n])=>lat/rad>=s&&lat/rad<=n)))throw Error('Selection crosses unmapped polar or obscured imagery. Move inside the printable latitude bands or reduce region width.');
    const u=((lon/rad+180)%360+360)%360/360;
    const ix=Math.min(w-1,Math.floor(u*w)),iy=Math.max(0,Math.min(h-1,Math.floor((imagery.north-lat/rad)/(imagery.north-imagery.south)*h)));
    if(rgba[(iy*w+ix)*4+3]===0)throw Error('Selection crosses unavailable imagery. Move inside the printable latitude bands or reduce region width.');
    out.set(rgba.subarray((iy*w+ix)*4,(iy*w+ix)*4+4),(y*n+x)*4);
  }
  return out;
}
root.TPPanel={quantize,mesh,schedule,crop,contrast};
})(typeof self!=='undefined'?self:globalThis);
