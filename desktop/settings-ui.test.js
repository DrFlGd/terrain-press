'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
global.ClipperLib=require('clipper-lib');global.poly2tri=require('poly2tri');require('../source/core.js');require('../source/panel-core.js');
const src=name=>fs.readFileSync(path.join(__dirname,'..','source',name),'utf8');
const html=src('src.html'),app=src('app.js'),built=fs.readFileSync(path.join(__dirname,'..','site','index.html'),'utf8');
const PANES=['place','model','colors','frame','print'];
test('palette contrast spreads colors around their mean, keeps luminance order and clamps',()=>{
 const palette=[[100,110,120],[120,130,140],[140,150,160]];
 assert.deepEqual(TPPanel.contrast(palette,0),palette);assert.deepEqual(TPPanel.contrast(palette,NaN),palette);
 assert.deepEqual(TPPanel.contrast(palette,50),[[80,90,100],[120,130,140],[160,170,180]]);
 assert.deepEqual(TPPanel.contrast(palette,100),[[60,70,80],[120,130,140],[180,190,200]]);
 assert.deepEqual(TPPanel.contrast(palette,500),TPPanel.contrast(palette,100));
 assert.deepEqual(TPPanel.contrast([[10,10,10],[250,250,250]],100),[[0,0,0],[255,255,255]]);
 const lum=c=>.2126*c[0]+.7152*c[1]+.0722*c[2],spread=TPPanel.contrast([[40,60,80],[90,70,50],[120,140,160]],100);
 for(let i=1;i<spread.length;i++)assert.ok(lum(spread[i])>lum(spread[i-1]));
 assert.notEqual(TPPanel.contrast(palette,50),palette,'returns a copy');
});
function workerContext(pixels){
 const messages=[];
 const ctx=vm.createContext({console,Uint8Array,Uint32Array,Float32Array,Float64Array,ArrayBuffer,DataView,TextEncoder,Response,Blob,ClipperLib:global.ClipperLib,poly2tri:global.poly2tri,fetch:async url=>({ok:true,blob:async()=>({url})}),createImageBitmap:async()=>({width:16,height:8,close(){}}),OffscreenCanvas:class{getContext(){return{drawImage(){},getImageData(){return{data:pixels};}};}}});
 ctx.self=ctx;ctx.location={search:''};ctx.postMessage=m=>messages.push(m);ctx.importScripts=(...urls)=>urls.forEach(u=>{if(u.includes('core.js'))vm.runInContext(src(u),ctx);});vm.runInContext(src('worker.js'),ctx);
 return {ctx,messages,built:id=>{const m=messages.find(m=>m.id===id&&m.type!=='progress');assert.equal(m.type,'built',m.text);return m.parts.find(p=>p.palette).palette;}};
}
const pixels=new Uint8Array(16*8*4);for(let y=0;y<8;y++)for(let x=0;x<16;x++)pixels.set([40+x*12,60+y*20,90+x*6,255],(y*16+x)*4);
const print={widthMm:60,exag:1,baseMm:2,frameMm:7,rimMm:3,rimAuto:false,back:false,backMm:1.6,pieces:2,gapMm:.3,stepMm:5,seed:42,separate:true,hexLayout:'round',hexAcross:3,hexEdge:'terrain',shape:'circle',product:'ornament',border:'none',panelLayer:.2,panelBand:3,panelBacking:8};
test('giant color bands apply the contrast value before any edited palette',async()=>{
 const {ctx,built}=workerContext(pixels);await ctx.onmessage({data:{type:'init',meta:{jupiter:{radiusKm:71492}}}});
 const q={world:'jupiter',lat:-22,lon:54,size:10000,widthMm:60,panelCount:4,panelGrid:16};
 await ctx.onmessage({data:{type:'build',id:1,q,p:{...print,colorPanel:true}}});const plain=built(1);
 await ctx.onmessage({data:{type:'build',id:2,q:{...q,colorContrast:100},p:{...print,colorPanel:true}}});const spread=built(2);
 assert.equal(plain.length,4);assert.notDeepEqual(spread,plain);
 const rgb=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16)),mean=p=>p.map(rgb).reduce((s,c)=>s+c[1],0)/p.length;
 const range=p=>Math.max(...p.map(c=>rgb(c)[1]))-Math.min(...p.map(c=>rgb(c)[1]));
 assert.ok(range(spread)>range(plain),'green channel spread grows');assert.ok(Math.abs(mean(spread)-mean(plain))<2,'mean color stays put');
 const edited=['#010203','#040506','#070809','#0a0b0c'];
 await ctx.onmessage({data:{type:'build',id:3,q:{...q,colorContrast:100,panelPalette:edited},p:{...print,colorPanel:true}}});assert.deepEqual(built(3),edited);
});
test('surface painting applies contrast without re-sampling and edited swatches win',async()=>{
 const {ctx,built}=workerContext(pixels);
 const N=9,heights=Float32Array.from({length:N*N},(_,i)=>i*5);let samples=0;
 ctx.TPCore.makeStore=()=>({chooseSource:()=>({kind:'tiles',label:'test DEM',pxKm:1}),sample:async()=>({heights,source:{kind:'tiles',label:'test DEM',pxKm:1}})});
 ctx.TPCore.meshPlan=()=>({N,stepMm:5,limited:false,cap:721,featureMm:.4,sourceStepMm:.5,samplingLimit:721});
 const quantize=ctx.TPPanel.quantize;ctx.TPPanel.quantize=(...a)=>{samples++;return quantize(...a);};
 await ctx.onmessage({data:{type:'init',meta:{moon:{radiusKm:1737.4}}}});
 const q={world:'moon',lat:0,lon:20,size:3000,widthMm:60,step:5,surfaceColors:true,surfaceCount:4,surfaceGrid:128};
 await ctx.onmessage({data:{type:'build',id:1,q,p:{...print,surfaceColors:true}}});const plain=built(1);
 await ctx.onmessage({data:{type:'build',id:2,q:{...q,colorContrast:60},p:{...print,surfaceColors:true}}});const spread=built(2);
 assert.equal(samples,1,'contrast reuses the quantized crop');assert.notDeepEqual(spread,plain);assert.equal(spread.length,4);
 const edited=['#111111','#222222','#333333','#444444'];
 await ctx.onmessage({data:{type:'build',id:3,q:{...q,colorContrast:60,surfacePalette:edited},p:{...print,surfaceColors:true}}});assert.deepEqual(built(3),edited);
});
test('settings rail is tabbed, each control lives in one pane and the data manager sits in the top bar',()=>{
 for(const page of [html,built]){
  for(const k of PANES){assert.match(page,new RegExp('id="side-'+k+'" role="tab"'));assert.match(page,new RegExp('id="pane-'+k+'" role="tabpanel"'));}
  const nav=page.slice(page.indexOf('<nav class="tp-nav'),page.indexOf('</nav>'));
  const at=nav.indexOf('id="manage-data"');assert.ok(at>0&&at>nav.indexOf('id="worlds"')&&at<nav.indexOf('aria-label="Colour theme"'),'data manager button sits between the worlds and the theme buttons');
  assert.match(page,/id="color-contrast" min="0" max="100"/);assert.match(page,/id="tab-model"[^>]*>Preview</);
  for(const id of ['marks','p-ornament','exag','jp-grid','surface-color','color-contrast','c-terrain','b-none','frame','t-top','resolution-auto','preview-high','export','manage-data'])assert.equal((page.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
  assert.ok(!page.includes('frame-options-section'));
 }
 const paneOf=id=>{const i=html.indexOf('id="'+id+'"');let best=null,bi=-1;for(const k of PANES){const j=html.lastIndexOf('id="pane-'+k+'"',i);if(j>bi){bi=j;best=k;}}return best;};
 const expect={marks:'place',lat:'place',credits:'place','p-ornament':'model',width:'model','hex-opts':'model',exag:'model',base:'model',pieces:'model','jupiter-options':'colors','surface-color':'colors','color-contrast':'colors','c-terrain':'colors','b-none':'frame',frame:'frame',rim:'frame',separate:'frame',back:'frame','letter-opts':'frame','t-top':'frame','resolution-auto':'print','sampling-limit':'print','preview-high':'print','grid-plan':'print'};
 for(const [id,pane] of Object.entries(expect))assert.equal(paneOf(id),pane,id);
 assert.ok(html.indexOf('id="export"')>html.lastIndexOf('</div>',html.indexOf('class="tp-cta"')),'download button follows every pane');
 assert.match(app,/const PANES = \['place', 'model', 'colors', 'frame', 'print'\]/);
 assert.match(app,/\$\('side-frame'\)\.hidden = hex; if \(hex && \$\('side-frame'\)\.classList\.contains\('active'\)\) showPane\('model'\)/);
 assert.equal((app.match(/colorContrast:\+\$\('color-contrast'\)\.value/g)||[]).length,2,'contrast rides with both sampled palettes');
 assert.match(app,/\$\('contrast-wrap'\)\.hidden=!\(TPGiants\.maps\[state\.world\]\|\|surfaceColorEnabled\(\)\)/);
 assert.match(app,/jupiterPalette=null;surfacePalette=null;schedule\(\);\}\);/);
 assert.match(src('jupiter.html'),/id="contrast" type="range"/);assert.match(src('panel-app.js'),/TPPanel\.contrast\(panel\.palette,\+\$\('contrast'\)\.value\)/);
 for(const smoke of ['giants','jupiter','moon','rocky'])assert.match(fs.readFileSync(path.join(__dirname,'..','tools',smoke+'-smoke.cjs'),'utf8'),/#side-'\+t/,smoke+' smoke switches settings tabs');
});
