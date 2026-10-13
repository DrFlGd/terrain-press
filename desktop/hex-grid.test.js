'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
globalThis.ClipperLib=require('clipper-lib');
globalThis.poly2tri=require('poly2tri');
require('../source/core.js');
const C=globalThis.TPCore, root=path.join(__dirname,'..');
const src=path.join(root,'source');
const html=fs.readFileSync(path.join(src,'src.html'),'utf8');
const app=fs.readFileSync(path.join(src,'app.js'),'utf8');
const worker=fs.readFileSync(path.join(src,'worker.js'),'utf8');
const geomArea=poly=>Math.abs(poly.reduce((a,p,i)=>{const q=poly[(i+1)%poly.length];return a+p[0]*q[1]-q[0]*p[1]},0)/2);
const fullArea=side=>1.5*Math.sqrt(3)*side*side;

test('Hex Grid is a separate overall shape with all four tessellation choices',()=>{
  assert.match(html,/id="s-hexgrid" value="hexgrid"/);
  assert.match(html,/id="hex-opts"/);
  for (const layout of ['edge','alternating','round','square'])
    assert.match(html,new RegExp('<option value="'+layout+'">'));
  assert.match(html,/id="hex-edge"[\s\S]*value="flat"/);
  assert.match(app,/hexLayout: \$\('hex-layout'\)\.value/);
  assert.match(app,/hexEdge: \$\('hex-edge'\)\.value/);
  assert.match(app,/state\.shape === 'hexgrid' \? 'none' : radio\('border'\)/);
  assert.match(app,/\$\('p-puzzle'\)\.checked = true/);
  assert.match(app,/\$\('pieces'\)\.max = hex \? '150' : '12'/);
});
test('size unlock is opt-in with exact widths and a 5000mm cap',()=>{
  assert.match(html,/id="width" min="60" max="1000"/);
  assert.match(html,/id="unlock-size"/);
  assert.match(html,/id="width-num" min="60" max="1000"/);
  assert.match(app,/const max = \$\('unlock-size'\)\.checked \? 5000 : 1000;/);
  assert.match(app,/p\.widthMm > 1000 && !confirm/);
  assert.match(app,/\$\('width'\)\.max = \$\('width-num'\)\.max = String\(max\)/);
  assert.match(app,/widthMm: \+\$\('width'\)\.value/);
});
test('round whole hex clusters obey actual hex ring count and tile area',()=>{
  for(const [target,expected] of [[7,7],[19,19],[37,37],[60,61],[100,91],[150,127]]){
    const g=C.hexGridCells(460,target,'round');
    assert.equal(g.cells.length,expected);
    assert.equal(g.clip,false);
    assert.equal(g.cells.every(p=>!p.partial),true);
    for (const tile of g.cells) {
      assert.equal(tile.pts.length,6);
      assert.ok(Math.abs(geomArea(tile.pts)-fullArea(g.side))<1e-5);
    }
    assert.ok(g.width<=460.0001);
  }
});
test('square whole hex clusters are gapless regular hexagon tessellations',()=>{
  for(const count of [9,25,40,100,150]) {
    const g=C.hexGridCells(460,count,'square');
    assert.equal(g.cells.length,Math.round(Math.sqrt(count))*Math.max(2,Math.round(count/Math.round(Math.sqrt(count)))));
    assert.equal(g.cells.every(c=>c.pts.length===6&&!c.partial),true);
    const total=g.cells.reduce((n,c)=>n+geomArea(c.pts),0);
    assert.ok(Math.abs(total/g.cells.length-fullArea(g.side))<1e-5);
    assert.ok(g.width<=460.001 && g.depth<=460.001);
    assert.ok(g.outline.length>=6,'union creates a single board boundary');
  }
});
test('hex outline with cropped edge pieces has full hexes and fractional border hexes',()=>{
  for(const layout of ['edge','alternating']) {
    const g=C.hexGridCells(460,37,layout);
    assert.equal(g.clip,true);
    assert.ok(g.cells.length>10);
    assert.ok(g.cells.some(c=>c.partial),layout+' must have partial hex borders');
    assert.ok(g.cells.some(c=>!c.partial),layout+' must have complete interior hexes');
    assert.equal(g.outline.length,6,'outer shape remains a regular hexagon');
    assert.ok(g.cells.every(c=>c.pts.length>=3&&c.pts.flat().every(Number.isFinite)));
  }
});
test('sampled hex pieces extrude watertight and support flat/terrain border variants',()=>{
  const N=21,heights=new Float32Array(N*N);
  for (let i=0;i<N;i++) for(let j=0;j<N;j++) heights[i*N+j]=1000 + i*10 + j*5;
  const hf={N,sizeKm:100,heights};
  const basic={
    shape:'hexgrid',widthMm:120,product:'puzzle',exag:4,baseMm:2,
    frameMm:7,rimMm:3,rimAuto:false,back:false,border:'none',
    pieces:19,gapMm:.3,stepMm:8,seed:12,hexEdge:'terrain'
  };
  for(const layout of ['edge','alternating','round','square']){
    const m=C.buildModel({...basic,hexLayout:layout},hf,null);
    const g=C.hexGridCells(120,19,layout);
    assert.ok(m.parts.length>0);
    const lost=g.cells.filter(c=>!m.parts.some(p=>p.cell[0]===c.i && p.cell[1]===c.j))
      .map(c=>({i:c.i,j:c.j,partial:c.partial,area:geomArea(c.pts)}));
    assert.equal(m.parts.length,g.cells.length,
      layout+': no tessellation cells disappear; missing '+JSON.stringify(lost));
    assert.ok(m.parts.every(p=>p.role==='terrain'&&p.cell&&p.ring&&p.tris.length>0));
    assert.ok(m.parts.every(p=>p.tris.every(Number.isFinite)));
    const spread=C.spreadPieces(m.parts,m.grid,3);
    assert.equal(spread.parts.length,m.parts.length);
    assert.ok(spread.parts.every(p=>p.tris.every(Number.isFinite)));
    if(layout==='edge'){
      const flat=C.buildModel({...basic,hexLayout:layout,hexEdge:'flat'},hf,null);
      assert.ok(flat.parts.some(p=>p.flat && p.partial));
      const one=flat.parts.find(p=>p.flat);
      const heights=new Set();
      for(let i=2;i<one.tris.length;i+=3) {
        const z=one.tris[i];
        assert.ok(Math.abs(z)<1e-5 || Math.abs(z-2)<1e-5,
          'flat border vertex must be on its bottom (0 mm) or flat top (2 mm)');
        heights.add(Math.round(z));
      }
      assert.deepEqual([...heights].sort((a,b)=>a-b),[0,2],
        'flat border needs both a bottom and a top surface');
    }
  }
});
test('preview and export integrate Hex Grid in existing worker paths',()=>{
  assert.match(worker,/C\.buildModel\(\{ \.\.\.m\.p, stepMm: hf\.stepMm \}, hf/);
  assert.match(worker,/C\.buildModel\(printParams, hf/);
  assert.match(worker,/C\.spreadPreview\(model\.parts, model\.grid/);
  assert.match(worker,/C\.spreadPieces\(model\.parts, model\.grid/);
  assert.match(worker,/model\.actualPieces/);
});
