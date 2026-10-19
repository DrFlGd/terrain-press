/* Terrain Press layered image panels. Heights are artistic color bands, not elevation. */
(function(root) {
'use strict';
const luminance = c => .2126*c[0]+.7152*c[1]+.0722*c[2];
function quantize(rgba, width, height, count) {
  if (!Number.isInteger(count)||count<2||count>8||rgba.length!==width*height*4) throw Error('Invalid palette or image');
  const pixels=Array.from({length:width*height},(_,i)=>Array.from(rgba.slice(i*4,i*4+3)));
  const sorted=pixels.slice().sort((a,b)=>luminance(a)-luminance(b));
  let palette=Array.from({length:count},(_,i)=>sorted[Math.floor((i+.5)*sorted.length/count)].slice());
  const nearest=p=>{let best=0,d=Infinity;palette.forEach((c,k)=>{const v=c.reduce((s,x,j)=>s+(x-p[j])**2,0);if(v<d){d=v;best=k;}});return best;};
  for(let pass=0;pass<12;pass++) {
    const sums=palette.map(()=>[0,0,0,0]);
    pixels.forEach(p=>{const s=sums[nearest(p)];p.forEach((v,j)=>s[j]+=v);s[3]++;});
    palette=palette.map((c,k)=>sums[k][3]?sums[k].slice(0,3).map(x=>x/sums[k][3]):c);
  }
  palette.sort((a,b)=>luminance(a)-luminance(b));
  const labels=Uint8Array.from(pixels,nearest);
  // Remove diagonal-only connections at every threshold. Lowering terminates,
  // preserves nested masks and avoids four faces meeting along one vertical edge.
  let changed=true, removed=0;
  while(changed){changed=false;for(let y=0;y<height-1;y++)for(let x=0;x<width-1;x++){
    const a=y*width+x,b=a+1,c=a+width,d=c+1;
    for(const [u,v,r,s] of [[a,d,b,c],[b,c,a,d]]) {
      const floor=Math.max(labels[r],labels[s]);
      if(Math.min(labels[u],labels[v])>floor){labels[u]=floor;removed++;changed=true;}
    }
  }}
  return {labels,palette:palette.map(c=>c.map(Math.round)),width,height,removed};
}
function mesh(panel, widthMM, layerHeight, bandLayers, backingLayers) {
  if(!Number.isFinite(widthMM)||widthMM<40||widthMM>250||!Number.isFinite(layerHeight)||layerHeight<.1||layerHeight>.4||!Number.isInteger(bandLayers)||bandLayers<1||bandLayers>10||!Number.isInteger(backingLayers)||backingLayers<2||backingLayers>30) throw Error('Invalid panel dimensions');
  const {labels,width:w,height:h,palette}=panel, step=widthMM/w;
  const levels=[0,...palette.map((_,k)=>(backingLayers+k*bandLayers)*layerHeight)];
  const tris=[], colors=[];
  const vertex=(x,y,z)=>[x*step-widthMM/2,(h-y)*step-h*step/2,levels[z]];
  const quad=(a,b,c,d,color)=>{tris.push(...a,...b,...c,...a,...c,...d);colors.push(color,color);};
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
  return {tris:new Float32Array(tris),colors,widthMM,heightMM:h*step,levels,role:'panel',name:'Jupiter layered color panel'};
}
function schedule(palette,layerHeight,bandLayers,backingLayers){
  return palette.map((rgb,i)=>({color:i+1,hex:'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join(''),startLayer:i===0?1:backingLayers+(i-1)*bandLayers+1,startHeightMM:i===0?0:(backingLayers+(i-1)*bandLayers)*layerHeight}));
}
root.TPPanel={quantize,mesh,schedule};
})(typeof self!=='undefined'?self:globalThis);
