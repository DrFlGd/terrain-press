'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
require('../source/surface-core.js');
const S=global.TPSurface;
test('tiled imagery preserves exact pixels at seams, corners, wrapped longitudes and poles',async()=>{
 const m={width:12,height:6,tileSize:3,tiles:'test'},requests=[];
 const grid={lats:[90,89,-90,0,0,0,0,0,45,-45],lons:[-180,180,540,-180,-90,-.001,0,179.999,-90,90]};
 const load=async path=>{requests.push(path);const [,tx,ty]=/\/(\d+)_(\d+)\.jpg/.exec(path);const rgba=new Uint8Array(36);
  for(let y=0;y<3;y++)for(let x=0;x<3;x++)rgba.set([+tx*3+x,+ty*3+y,123,255],(y*3+x)*4);
  return{rgba,w:3,h:3};};
 const pixels=await S.tiledPixels(grid,m,load);
 const expected=[[0,0],[0,0],[0,5],[0,3],[3,3],[5,3],[6,3],[11,3],[3,1],[9,4]];
 expected.forEach(([x,y],k)=>assert.deepEqual(Array.from(pixels.slice(k*4,k*4+4)),[x,y,123,255]));
 assert.equal(new Set(requests).size,requests.length,'load each used tile once');
 assert.ok(requests.length<8,'unused tiles are not requested');
});
test('missing and malformed image tiles fail clearly instead of painting fallback pixels',async()=>{
 const grid={lats:[0],lons:[0]},m={width:12,height:6,tileSize:3,tiles:'test'};
 await assert.rejects(S.tiledPixels(grid,m,async()=>{throw Error('unavailable');}),/unavailable/);
 await assert.rejects(S.tiledPixels(grid,m,async()=>({w:2,h:2,rgba:new Uint8Array(16)})),/dimensions/);
});
test('Earth advertises native 21.6K paint detail independently of the 8K globe',()=>{
 const m=S.maps.earth;assert.equal(m.width,21600);assert.equal(m.height,10800);assert.equal(m.globeWidth,8192);
 assert.equal(m.width/m.tileSize,6);assert.equal(m.height/m.tileSize,3);assert.match(S.description('earth'),/21600 × 10800.*8192 × 4096/);
});
