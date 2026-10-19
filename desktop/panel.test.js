const {test}=require('node:test'); const assert=require('node:assert/strict');
require('../source/panel-core.js');require('../source/core.js');
function closed(mesh){const edges=new Map();let volume=0;const t=mesh.tris;
for(let i=0;i<t.length;i+=9){const v=[0,3,6].map(j=>Array.from(t.slice(i+j,i+j+3)));volume+=(v[0][0]*(v[1][1]*v[2][2]-v[1][2]*v[2][1])+v[0][1]*(v[1][2]*v[2][0]-v[1][0]*v[2][2])+v[0][2]*(v[1][0]*v[2][1]-v[1][1]*v[2][0]))/6;
for(let j=0;j<3;j++){const a=v[j].join(','),b=v[(j+1)%3].join(',');assert.notEqual(a,b);const key=[a,b].sort().join('|');const e=edges.get(key)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(key,e);}}
for(const [key,e] of edges){assert.deepEqual(e,[2,0],key);}assert.ok(volume>0);return volume;}
test('2–8 color panels are watertight with consistent winding and expected volume',()=>{
let seed=7;for(let count=2;count<=8;count++){const rgba=Uint8Array.from({length:13*9*4},()=>{seed=(seed*1664525+1013904223)>>>0;return seed>>>24;});const p=TPPanel.quantize(rgba,13,9,count),m=TPPanel.mesh(p,130,.2,3,8);const volume=closed(m);const expected=Array.from(p.labels).reduce((s,k)=>s+(8+k*3)*.2*100,0);assert.ok(Math.abs(volume-expected)<.02);const stl=TPCore.stl([m]);assert.equal(new DataView(stl.buffer).getUint32(80,true),m.tris.length/9);}
});
test('uniform images, schedules and invalid sizes',()=>{const p=TPPanel.quantize(new Uint8Array(4*16).fill(128),4,4,4);closed(TPPanel.mesh(p,80,.2,3,8));assert.deepEqual(TPPanel.schedule([[0,0,0],[255,255,255],[128,128,128]],.2,3,8).map(s=>s.startLayer),[1,9,12]);assert.throws(()=>TPPanel.mesh(p,NaN,.2,3,8));assert.throws(()=>TPPanel.quantize([],1,1,9));});
