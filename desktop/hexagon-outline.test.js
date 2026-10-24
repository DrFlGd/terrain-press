'use strict';
// Regression: a 405 mm Pluto hexagon ornament failed with
// "poly2tri EdgeEvent: Collinear not supported!". The hexagon outline was
// built from Math.cos/Math.sin, so its two flat edges were one ulp off
// horizontal; the densified edge points then carried floating-point y noise
// and poly2tri saw a vertex collinear with a constrained edge.
const {test}=require('node:test'),assert=require('node:assert/strict');
global.ClipperLib=require('clipper-lib');global.poly2tri=require('poly2tri');
require('../source/core.js');require('../source/panel-core.js');
function heights(N,seed=7){let s=seed;const h=new Float32Array(N*N);for(let i=0;i<h.length;i++){s=(s*1664525+1013904223)>>>0;h[i]=(s>>>8)/16777216*8000-2878;}return h;}
function params(W,N,extra){return {widthMm:W,exag:4.1,baseMm:2,frameMm:7,rimMm:3,rimAuto:false,back:true,backMm:1.6,pieces:5,gapMm:.3,stepMm:W/N,seed:42,panelLayer:.2,panelBand:3,panelBacking:8,separate:false,loop:false,hexLayout:'edge',hexAcross:5,hexEdge:'terrain',hexRings:2,shape:'hexagon',product:'ornament',border:'none',mergeText:true,textMm:.8,textTop:'',textBottom:'',...extra};}
function watertight(t){const edges=new Map();let volume=0;
for(let i=0;i<t.length;i+=9){const v=[0,3,6].map(j=>Array.from(t.slice(i+j,i+j+3)));volume+=(v[0][0]*(v[1][1]*v[2][2]-v[1][2]*v[2][1])+v[0][1]*(v[1][2]*v[2][0]-v[1][0]*v[2][2])+v[0][2]*(v[1][0]*v[2][1]-v[1][1]*v[2][0]))/6;
for(let j=0;j<3;j++){const a=v[j].map(x=>x.toFixed(4)).join(','),b=v[(j+1)%3].map(x=>x.toFixed(4)).join(',');assert.notEqual(a,b);const key=[a,b].sort().join('|'),e=edges.get(key)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(key,e);}}
for(const [key,e] of edges)assert.deepEqual(e,[2,0],key);assert.ok(volume>0);}

test('hexagon outline has bit-exact flat edges and mirror symmetry',()=>{
  for(const W of [60,100,405,500]){
    const pts=TPCore.shapeOutline('hexagon',W);
    assert.equal(pts.length,6);
    const h=W/2*Math.sqrt(3)/2;
    assert.deepEqual(pts,[[W/2,0],[W/4,h],[-W/4,h],[-W/2,0],[-W/4,-h],[W/4,-h]]);
    assert.equal(pts[1][1],pts[2][1],'top edge is exactly horizontal');
    assert.equal(pts[4][1],pts[5][1],'bottom edge is exactly horizontal');
  }
});

for(const [W,N] of [[100,144],[405,580]])for(const border of ['none','plain'])
test(`hexagon ornament ${W} mm on a ${N} grid with ${border} border triangulates`,()=>{
  const N2=N;
  const model=TPCore.buildModel(params(W,N2,{border}),{heights:heights(N2),N:N2,sizeKm:500},null);
  const terrain=model.parts.filter(p=>p.role==='terrain');
  assert.equal(terrain.length,1);
  assert.ok(terrain[0].tris.length>0);
  if(N2<=144)watertight(terrain[0].tris);
});

test('hexagon puzzle and circle/square ornaments still build at the preview grid',()=>{
  const W=405,N=580,h=heights(N);
  for(const [shape,product] of [['hexagon','puzzle'],['circle','ornament'],['square','ornament']]){
    const model=TPCore.buildModel(params(W,N,{shape,product,border:'plain'}),{heights:h,N,sizeKm:500},null);
    assert.ok(model.parts.filter(p=>p.role==='terrain').length>=1,shape+' '+product);
  }
});
