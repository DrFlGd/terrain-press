'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
globalThis.ClipperLib=require('clipper-lib');
globalThis.poly2tri=require('poly2tri');
require('../source/core.js');
const C=globalThis.TPCore;
const src=path.join(__dirname,'..','source');
const html=fs.readFileSync(path.join(src,'src.html'),'utf8');
const app=fs.readFileSync(path.join(src,'app.js'),'utf8');

function makeHeights(N) {
  const data=new Float32Array(N*N);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++)
    data[y*N+x]=1500 + 360*Math.sin(x*.46)+220*Math.cos(y*.32);
  return data;
}
function wallBoundarySamples(tris) {
  const samples=new Map();
  for(let i=0;i<tris.length;i+=9){
    const vs=Array.from({length:3},(_,j)=>[tris[i+j*3],tris[i+j*3+1],tris[i+j*3+2]]);
    // Wall triangle has vertical paired XY vertices and height discontinuity,
    // versus a legitimate sloping triangle on the terrain surface.
    let vertical=false;
    for(let j=0;j<3;j++)for(let k=j+1;k<3;k++)
      if(Math.hypot(vs[j][0]-vs[k][0],vs[j][1]-vs[k][1])<1e-5 &&
        Math.abs(vs[j][2]-vs[k][2])>.01) vertical=true;
    if(!vertical)continue;
    for(const [x,y,z] of vs)if(z>0.01) {
      const key=x.toFixed(4)+','+y.toFixed(4);
      samples.set(key,{x,y,z});
    }
  }
  return [...samples.values()];
}
function surfaceVertices(tris) {
  const data=new Map();
  for(let i=0;i<tris.length;i+=9){
    const zs=[tris[i+2],tris[i+5],tris[i+8]];
    if(!zs.every(z=>z>.01))continue; // top, not wall or underside
    for(let j=0;j<3;j++){
      const x=tris[i+j*3], y=tris[i+j*3+1],z=tris[i+j*3+2];
      data.set(x.toFixed(4)+','+y.toFixed(4),z);
    }
  }
  return data;
}
test('sampled sidewalls follow fine-grained elevation, not a straight corner-to-corner height curtain',()=>{
  const W=120,N=81,hf={heights:makeHeights(N),N,sizeKm:100};
  const common={shape:'hexgrid',widthMm:W,product:'puzzle',border:'none',
    exag:20,baseMm:2,frameMm:7,rimMm:3,rimAuto:false,back:false,
    pieces:19,hexLayout:'round',hexAcross:5,gapMm:0.3,stepMm:2};
  const model=C.buildModel(common,hf,null);
  assert.equal(model.parts.length,19);
  const idx=model.parts.findIndex(p=>p.cell[0]===0 && p.cell[1]===0);
  assert.ok(idx>=0,'center hex found');
  const piece=model.parts[idx];
  const side=wallBoundarySamples(piece.tris);
  const top=surfaceVertices(piece.tris);
  assert.ok(side.length>20,
    'boundary should be sampled at the terrain step rather than only six polygon corners: '+side.length);
  for(const {x,y,z} of side){
    const actual=top.get(x.toFixed(4)+','+y.toFixed(4));
    assert.ok(actual!==undefined,
      'each sidewall top must be a shared mesh vertex on the terrain face');
    assert.ok(Math.abs(actual-z)<.0001,'no mismatched edge heights');
    const fi=(W/2-y)/W*(N-1),fj=(x+W/2)/W*(N-1);
    const i0=Math.max(0,Math.min(N-2,Math.floor(fi)));
    const j0=Math.max(0,Math.min(N-2,Math.floor(fj)));
    const tx=Math.max(0,Math.min(1,fj-j0)),ty=Math.max(0,Math.min(1,fi-i0));
    const h=hf.heights;
    const measured=(h[i0*N+j0]*(1-tx)+h[i0*N+j0+1]*tx)*(1-ty)+
      (h[(i0+1)*N+j0]*(1-tx)+h[(i0+1)*N+j0+1]*tx)*ty;
    const expected=2+Math.max(0,measured-model.hMin)*W/(100*1000)*20;
    assert.ok(Math.abs(z-expected)<.002,
      'height along wall must follow DEM at x='+x+', y='+y);
  }
});
test('all Hex Grid layout edges preserve subdivided terrain boundaries',()=>{
  const N=31,hf={N,sizeKm:100,heights:makeHeights(N)};
  for(const layout of ['edge','alternating','round','square']){
    const m=C.buildModel({shape:'hexgrid',widthMm:100,product:'puzzle',
      exag:8,baseMm:2,frameMm:7,rimMm:3,rimAuto:false,back:false,
      border:'none',pieces:19,hexAcross:5,hexLayout:layout,hexEdge:'terrain',
      gapMm:0.3,stepMm:4},hf,null);
    assert.ok(m.parts.length>=19);
    const p=m.parts.find(x=>!x.partial);
    assert.ok(p,'full hex piece exists');
    assert.ok(wallBoundarySamples(p.tris).length>6,'sampled wall in '+layout);
  }
});
test('coordinates and both widths are directly editable with persistent up/down arrow buttons',()=>{
  for(const id of ['lat','lon','size','width-num']){
    assert.match(html,new RegExp('id="'+id+'"[^>]*type="number"|type="number"[^>]*id="'+id+'"'));
    assert.ok(html.includes('data-step-target="'+id+'" data-step-direction="up"'),
      id+' increment button');
    assert.ok(html.includes('data-step-target="'+id+'" data-step-direction="down"'),
      id+' decrement button');
  }
  assert.match(html,/id="lat"[^>]*step="0\.01"/);
  assert.match(html,/id="lon"[^>]*step="0\.01"/);
  assert.match(html,/id="width-num"[^>]*step="1"/);
  assert.match(app,/field\.stepUp\(\)/);
  assert.match(app,/field\.stepDown\(\)/);
  assert.match(app,/field\.dispatchEvent\(new Event\('change'/);
  assert.match(app,/widthMm: \+\$\('width-num'\)\.value/);
});
test('typed exact model width stays exact even with a five-mm range-slider increment',()=>{
  const match=app.match(/const updateWidth = value => \{[\s\S]*?\n\};/);
  assert.ok(match,'separate width update helper');
  const ctl={
    'unlock-size':{checked:false},width:{value:'100',max:'1000'},
    'width-num':{value:'100',max:'1000'},'o-width':{textContent:''},
    'size-warning':{hidden:true}
  };
  let calls=0;
  const update=Function('$','clamp','schedule',match[0]+'\nreturn updateWidth;')(
    id=>ctl[id],(v,a,b,d)=>Number.isFinite(v)?Math.min(b,Math.max(a,v)):d,()=>calls++);
  update('463');
  assert.equal(ctl['width-num'].value,'463');
  assert.equal(ctl.width.value,'465');
  assert.equal(ctl['o-width'].textContent,'463 mm');
  ctl['unlock-size'].checked=true;
  update('1201');
  assert.equal(ctl['width-num'].value,'1201');
  assert.equal(ctl.width.value,'1200');
  assert.equal(ctl['size-warning'].hidden,false);
  ctl['unlock-size'].checked=false;
  update('1201');
  assert.equal(ctl['width-num'].value,'1000');
  assert.equal(calls,3);
});
