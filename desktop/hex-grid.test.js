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
  assert.match(html,/id="hex-rings"/);
  assert.match(html,/id="hex-across"/);
  assert.match(html,/id="hex-square-wrap"/);
  assert.match(app,/hexAcross: Math\.round/);
  assert.match(app,/hexRings: \+\$\('hex-rings'\)\.value/);
  assert.match(app,/\$\('pieces-wrap'\)\.hidden = state\.product !== 'puzzle' \|\| hex/);

});
test('size unlock is opt-in with exact widths and a 5000mm cap',()=>{
  assert.match(html,/id="width" min="60" max="1000"/);
  assert.match(html,/id="unlock-size"/);
  assert.match(html,/id="width-num" min="60" max="1000"/);
  assert.match(app,/const max = \$\('unlock-size'\)\.checked \? 5000 : 1000;/);
  assert.match(app,/p\.widthMm > 1000 && !confirm/);
  assert.match(app,/\$\('width'\)\.max = \$\('width-num'\)\.max = String\(max\)/);
  assert.match(app,/widthMm: \+\$\('width-num'\)\.value/);
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
test('square whole hex clusters use exactly N columns and N rows',()=>{
  for(const n of [2,3,5,8,10,12]) {
    const g=C.hexGridCells(460,n*n,'square',0.3,n);
    assert.equal(g.cells.length,n*n);
    assert.equal(g.across,n);
    assert.equal(new Set(g.cells.map(c=>c.i)).size,n);
    assert.equal(new Set(g.cells.map(c=>c.j)).size,n);
    assert.equal(g.cells.every(c=>c.pts.length===6&&!c.partial),true);
    const total=g.cells.reduce((sum,c)=>sum+geomArea(c.pts),0);
    assert.ok(Math.abs(total/g.cells.length-fullArea(g.side))<1e-5);
    assert.ok(g.width<=460.001 && g.depth<=460.001);
    assert.ok(g.outline.length>=6,'union creates one stepped outer boundary');
  }
});
test('clipped hex board uses lattice-locked rings with no slivers or gaps',()=>{
  for(const layout of ['edge','alternating'])for(const rings of [1,2,3,4,5,6]) {
    const W=460, nominal=1+3*rings*(rings+1);
    const g=C.hexGridCells(W,nominal,layout,0.3);
    assert.equal(g.clip,true);
    assert.equal(g.rings,rings);
    const expected = layout==='alternating'
      ? [7,19,43,55,91,133][rings-1] : nominal;
    assert.equal(g.cells.length,expected,layout+' symmetric ring count');
    assert.ok(g.cells.some(c=>c.partial));
    assert.ok(g.cells.some(c=>!c.partial));
    assert.equal(g.outline.length,6);
    assert.ok(g.cells.every(c=>c.pts.length>=3&&c.pts.flat().every(Number.isFinite)));
    const occupied=g.cells.reduce((sum,c)=>sum+geomArea(c.pts),0);
    const board=geomArea(g.outline);
    assert.ok(Math.abs(occupied/board-1)<.0005,
      layout+' full board coverage '+occupied+'/'+board);
    const minimum=Math.min(...g.cells.map(c=>geomArea(c.pts)/fullArea(g.side)));
    assert.ok(minimum>.22,layout+' must avoid slivers (minimum '+minimum+')');
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
    const m=C.buildModel({...basic,hexLayout:layout,hexAcross:layout==='square'?5:null},hf,null);
    const g=C.hexGridCells(120,19,layout,0.3,layout==='square'?5:null);
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

test('a square layout exports exactly N by N printable cells at 460 mm',()=>{
  const N=11,hf={N,sizeKm:200,heights:new Float32Array(N*N).fill(1200)};
  for(const n of [2,3,5,7]){
    const model=C.buildModel({shape:'hexgrid',widthMm:460,product:'puzzle',
      exag:2,baseMm:2,frameMm:7,rimMm:3,rimAuto:false,back:false,
      border:'none',pieces:n*n,hexAcross:n,hexLayout:'square',
      gapMm:0.3,stepMm:35},hf,null);
    assert.equal(model.parts.length,n*n);
    assert.ok(model.parts.every(p=>!p.partial&&p.tris.every(Number.isFinite)));
  }
});

function polygonCentre(pts) {
  let sum=0,cx=0,cy=0;
  for(let i=0;i<pts.length;i++){
    const a=pts[i],b=pts[(i+1)%pts.length],cross=a[0]*b[1]-b[0]*a[1];
    sum+=cross;cx+=(a[0]+b[0])*cross;cy+=(a[1]+b[1])*cross;
  }
  return [cx/(3*sum),cy/(3*sum)];
}
test('both clipped hex boards have D6 rotational and bilateral mirror symmetry',()=>{
  const almost=(v,w,limit)=>Math.abs(v-w)<limit;
  for(const layout of ['edge','alternating']){
    for(const rings of [1,2,3,4,5,6]){
      const board=C.hexGridCells(460,1+3*rings*(rings+1),layout,.3);
      const pieces=board.cells.map(c=>({
        ...c, centre:polygonCentre(c.pts),area:geomArea(c.pts)
      }));
      // Every clipped or whole polygon must have a counterpart matching its
      // location and area after 60-degree rotation and each board reflection.
      // An off-centre grid can still fill the entire board without gaps; this
      // test specifically detects unequal left/right and top/bottom pieces.
      const transforms=[
        ([x,y])=>[x*Math.cos(Math.PI/3)-y*Math.sin(Math.PI/3),
          x*Math.sin(Math.PI/3)+y*Math.cos(Math.PI/3)],
        ([x,y])=>[-x,y],
        ([x,y])=>[x,-y]
      ];
      for(const transform of transforms)for(const cell of pieces){
        const c=transform(cell.centre);
        const peer=pieces.find(p=>
          almost(p.centre[0],c[0],.014) && almost(p.centre[1],c[1],.014) &&
          almost(p.area,cell.area,.15));
        assert.ok(peer,
          layout+' ring '+rings+': unmatched piece under board symmetry at '+
          JSON.stringify({centre:cell.centre,area:cell.area,transformed:c}));
        // A full hex must map to another full hex. A perimeter fraction must
        // always be paired with an equally sized fraction on the other side.
        assert.equal(peer.partial,cell.partial);
      }
      const centre=pieces.find(p=>Math.hypot(...p.centre)<.014);
      assert.ok(centre,'every pattern is centred on a real middle hexagon');
      assert.equal(centre.partial,false,'central hexagon is never clipped');
    }
  }
});
test('flat-top border and point-top alternating modes are distinct centred lattices',()=>{
  const flat=C.hexGridCells(460,37,'edge',.3);
  const point=C.hexGridCells(460,37,'alternating',.3);
  assert.equal(flat.rings,3);
  assert.equal(point.rings,3);
  const centroid=pts=>polygonCentre(pts);
  const a=flat.cells.find(c=>Math.hypot(...centroid(c.pts))<.014);
  const b=point.cells.find(c=>Math.hypot(...centroid(c.pts))<.014);
  assert.ok(a&&b,'central hex for both orientations');
  assert.equal(a.partial,false);assert.equal(b.partial,false);
  assert.ok(Math.abs(a.pts[0][0]-b.pts[0][0])>1,
    'alternating mode rotates cells rather than translating the grid');
  const strip=(cells,sign)=>cells.filter(c=>Math.sign(centroid(c.pts)[0])===sign
    && c.partial).reduce((total,c)=>total+geomArea(c.pts),0);
  assert.ok(Math.abs(strip(flat.cells,-1)-strip(flat.cells,1))<.1);
  assert.ok(Math.abs(strip(point.cells,-1)-strip(point.cells,1))<.1);
});
