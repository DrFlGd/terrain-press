/* global TPPanel, TPCore, THREE */
'use strict';
const $=id=>document.getElementById(id);
let panel, model, settings, scene, camera, renderer, controls, object;
const source=new Image();
function preview(){
  const canvas=$('map');canvas.width=panel.width;canvas.height=panel.height;
  const ctx=canvas.getContext('2d'), image=ctx.createImageData(panel.width,panel.height);
  panel.labels.forEach((k,i)=>image.data.set([...panel.palette[k],255],i*4));ctx.putImageData(image,0,0);
  const steps=TPPanel.schedule(panel.palette,settings.layer,settings.bands,settings.backing);
  $('schedule').replaceChildren(...steps.map(s=>{const tr=document.createElement('tr');for(const text of [s.color+' · '+s.hex,s.startLayer,s.startHeightMM.toFixed(2)+' mm']){const td=document.createElement('td');td.textContent=text;tr.append(td);}return tr;}));
  if(!renderer)return;
  if(object){scene.remove(object);object.geometry.dispose();object.material.dispose();}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(model.tris,3));
  const colors=new Float32Array(model.tris.length);
  model.colors.forEach((k,i)=>{const c=new THREE.Color(...panel.palette[k].map(v=>v/255));for(let j=0;j<3;j++)colors.set([c.r,c.g,c.b],i*9+j*3);});
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.computeVertexNormals();
  object=new THREE.Mesh(geo,new THREE.MeshPhongMaterial({vertexColors:true,shininess:5}));scene.add(object);
}
async function build(event){
  if(event)event.preventDefault();if(!$('settings').reportValidity())return;
  $('download').disabled=true;$('build').disabled=true;$('status').textContent='Building panel…';
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  try{
    settings={width:+$('width').value,layer:+$('layer').value,bands:+$('bands').value,backing:+$('backing').value};
    const c=document.createElement('canvas');c.width=+$('detail').value;c.height=Math.round(c.width*source.height/source.width);
    const ctx=c.getContext('2d');ctx.drawImage(source,0,0,c.width,c.height);
    panel=TPPanel.quantize(ctx.getImageData(0,0,c.width,c.height).data,c.width,c.height,+$('count').value);
    model=TPPanel.mesh(panel,settings.width,settings.layer,settings.bands,settings.backing);
    $('palette').replaceChildren(...panel.palette.map((rgb,k)=>{const input=document.createElement('input');input.type='color';input.value='#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('');input.setAttribute('aria-label','Filament color '+(k+1));input.oninput=()=>{panel.palette[k]=input.value.slice(1).match(/../g).map(v=>parseInt(v,16));preview();};return input;}));
    if(camera){camera.position.set(0,-settings.width*.8,settings.width);controls.target.set(0,0,0);controls.update();}
    preview();$('status').textContent=`${model.widthMM.toFixed(1)} × ${model.heightMM.toFixed(1)} mm · ${(model.levels.at(-1)).toFixed(2)} mm maximum height · ${(settings.width/c.width).toFixed(2)} mm grid cells. ${panel.removed} diagonal contacts simplified. Small features and filament opacity need a test print.`;
    $('download').disabled=false;
  }catch(e){$('status').textContent='Unable to build panel: '+e.message;}finally{$('build').disabled=false;}
}
$('settings').onsubmit=build;
$('settings').oninput=()=>{$('download').disabled=true;$('status').textContent='Settings changed — update the panel to export.';};
$('download').onclick=async()=>{ $('download').disabled=true;try{
  const schedule=TPPanel.schedule(panel.palette,settings.layer,settings.bands,settings.backing);
  const readme=`Jupiter layered color panel — Terrain Press\n\nSTL is one solid and does not store colors. Use the CSV schedule to add filament changes in your slicer. Start-layer numbers are 1-based: change before printing that layer, after reaching the listed Z. Use ${settings.layer} mm for ALL layers, including the first; disable adaptive layers. Backing uses color 1. Later colors occupy successively smaller footprints; no supports are intended.\n\nDimensions: ${model.widthMM} x ${model.heightMM} mm. Check bed fit, small features and filament opacity. Colors shown are approximate; translucent filament can blend. No printer-specific G-code is supplied.\n\nSource: Hubble OPAL, Jupiter, 2015-01-19. Filter composite 395/502/631 nm. Color-band heights are artistic, not terrain.\nCredit: NASA, ESA, A. Simon (GSFC), M. Wong (UC Berkeley), and G. Orton (JPL-Caltech).\nhttps://science.nasa.gov/asset/hubble/jupiter-global-map-from-hubble-opal-data-rotation-1/\nhttps://www.nasa.gov/nasa-brand-center/images-and-media/\nImage resized, quantized and diagonal contacts simplified by Terrain Press. No agency endorsement.\n`;
  const csv='color,hex,start_layer,change_at_z_mm\n'+schedule.map(s=>[s.color,s.hex,s.startLayer,s.startHeightMM.toFixed(3)].join(',')).join('\n');
  const data=await TPCore.zip([['jupiter-panel.stl',TPCore.stl([model])],['color-changes.csv',csv],['README.txt',readme],['settings.json',JSON.stringify({...settings,palette:panel.palette,grid:[panel.width,panel.height],source:'opal-2015'},null,2)]]);
  const url=URL.createObjectURL(new Blob([data],{type:'application/zip'})),a=document.createElement('a');a.href=url;a.download='jupiter-color-panel.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}catch(e){$('status').textContent='Export failed: '+e.message;}finally{$('download').disabled=false;}};
try{
  renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));$('view').append(renderer.domElement);
  scene=new THREE.Scene();scene.background=new THREE.Color('#1b2631');camera=new THREE.PerspectiveCamera(45,1,.1,2000);camera.up.set(0,0,1);
  scene.add(new THREE.AmbientLight(0xffffff,.8));const light=new THREE.DirectionalLight(0xffffff,.7);light.position.set(-40,-80,180);scene.add(light);
  controls=new THREE.OrbitControls(camera,renderer.domElement);
  new ResizeObserver(()=>{const w=$('view').clientWidth,h=$('view').clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe($('view'));
  renderer.setAnimationLoop(()=>renderer.render(scene,camera));
}catch(e){renderer=null;$('view').textContent='3D preview unavailable. The color preview and STL export still work.';}
source.onload=()=>{$('build').disabled=false;build();};source.onerror=()=>{$('status').textContent='Bundled Jupiter map could not be loaded. Reinstall or rebuild the application.';};source.src='data/jupiter/opal-2015-3600.jpg';
