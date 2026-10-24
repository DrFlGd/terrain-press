/* global TPPanel, TPCore, THREE */
'use strict';
const $=id=>document.getElementById(id);
let panel, model, settings, scene, camera, renderer, controls, object;
const requested=new URLSearchParams(location.search).get('world')||'jupiter';
const world=Object.hasOwn(TPGiants.maps,requested)?requested:'jupiter',imagery=TPGiants.maps[world];
$('title').textContent=imagery.name+' / color panel';document.title=imagery.name+' color panels · Terrain Press';
$('source-credit').textContent=TPGiants.description(world)+' Full-map panels use the continuous latitude band '+imagery.panelBand.join('° to ')+'°. No agency endorsement.';
$('source-link').href=imagery.source;$('source-image').src=imagery.path;
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
  const displayColors=panel.palette.map(rgb=>new THREE.Color(...rgb.map(v=>v/255)));
  model.colors.forEach((k,i)=>{const c=displayColors[k];for(let j=0;j<3;j++)colors.set([c.r,c.g,c.b],i*9+j*3);});
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.computeVertexNormals();
  object=new THREE.Mesh(geo,new THREE.MeshPhongMaterial({vertexColors:true,shininess:5}));scene.add(object);
}
async function build(event){
  if(event)event.preventDefault();if(!$('settings').reportValidity())return;
  $('download').disabled=true;$('build').disabled=true;$('status').textContent='Building panel…';
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  try{
    settings={width:+$('width').value,layer:+$('layer').value,bands:+$('bands').value,backing:+$('backing').value,contrast:+$('contrast').value};
    const c=document.createElement('canvas');c.width=+$('detail').value;const [south,north]=imagery.panelBand;const sy=(imagery.north-north)/(imagery.north-imagery.south)*source.height,sh=(north-south)/(imagery.north-imagery.south)*source.height;c.height=Math.round(c.width*sh/source.width);
    const ctx=c.getContext('2d');ctx.drawImage(source,0,sy,source.width,sh,0,0,c.width,c.height);
    panel=TPPanel.quantize(ctx.getImageData(0,0,c.width,c.height).data,c.width,c.height,+$('count').value);panel.palette=TPPanel.contrast(panel.palette,+$('contrast').value);
    model=TPPanel.mesh(panel,settings.width,settings.layer,settings.bands,settings.backing);
    $('palette').replaceChildren(...panel.palette.map((rgb,k)=>{const input=document.createElement('input');input.type='color';input.value='#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('');input.setAttribute('aria-label','Filament color '+(k+1));input.oninput=()=>{panel.palette[k]=input.value.slice(1).match(/../g).map(v=>parseInt(v,16));preview();};return input;}));
    if(camera){camera.position.set(0,-settings.width*.8,settings.width);controls.target.set(0,0,0);controls.update();}
    preview();$('status').textContent=`${model.widthMM.toFixed(1)} × ${model.heightMM.toFixed(1)} mm · ${(model.levels.at(-1)).toFixed(2)} mm maximum height · ${(settings.width/c.width).toFixed(2)} mm grid cells. ${panel.removed} diagonal contacts simplified. Small features and filament opacity need a test print.`;
    $('download').disabled=false;
  }catch(e){$('status').textContent='Unable to build panel: '+e.message;}finally{$('build').disabled=false;}
}
$('settings').onsubmit=build;
$('contrast').oninput=()=>{$('o-contrast').textContent=(1+$('contrast').value/50).toFixed(1)+'×';};
$('settings').oninput=()=>{$('download').disabled=true;$('status').textContent='Settings changed — update the panel to export.';};
$('download').onclick=async()=>{ $('download').disabled=true;try{
  const schedule=TPPanel.schedule(panel.palette,settings.layer,settings.bands,settings.backing);
  const readme=`${imagery.name} layered color panel — Terrain Press\n\nSTL is one solid and does not store colors. Use the CSV schedule to add filament changes in your slicer. Start-layer numbers are 1-based: change before printing that layer, after reaching the listed Z. Use ${settings.layer} mm for ALL layers, including the first; disable adaptive layers. Backing uses color 1. Later colors occupy successively smaller footprints; no supports are intended.\n\nDimensions: ${model.widthMM} x ${model.heightMM} mm. Check bed fit, small features and filament opacity. Colors shown are approximate; translucent filament can blend. No printer-specific G-code is supplied.\n\nSource: ${TPGiants.description(world)}\n${imagery.acknowledgement}\nImage resized, quantized and diagonal contacts simplified by Terrain Press. No agency endorsement.\n`;
  const csv='color,hex,start_layer,change_at_z_mm\n'+schedule.map(s=>[s.color,s.hex,s.startLayer,s.startHeightMM.toFixed(3)].join(',')).join('\n');
  const data=await TPCore.zip([[world+'-panel.stl',TPCore.stl([model])],['color-changes.csv',csv],['README.txt',readme],['settings.json',JSON.stringify({...settings,palette:panel.palette,grid:[panel.width,panel.height],world,imagery},null,2)]]);
  const url=URL.createObjectURL(new Blob([data],{type:'application/zip'})),a=document.createElement('a');a.href=url;a.download=world+'-color-panel.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}catch(e){$('status').textContent='Export failed: '+e.message;}finally{$('download').disabled=false;}};
try{
  renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));$('view').append(renderer.domElement);
  scene=new THREE.Scene();scene.background=new THREE.Color('#1b2631');camera=new THREE.PerspectiveCamera(45,1,.1,2000);camera.up.set(0,0,1);
  scene.add(new THREE.AmbientLight(0xffffff,.8));const light=new THREE.DirectionalLight(0xffffff,.7);light.position.set(-40,-80,180);scene.add(light);
  controls=new THREE.OrbitControls(camera,renderer.domElement);
  new ResizeObserver(()=>{const w=$('view').clientWidth,h=$('view').clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe($('view'));
  renderer.setAnimationLoop(()=>renderer.render(scene,camera));
}catch(e){renderer=null;$('view').textContent='3D preview unavailable. The color preview and STL export still work.';}
source.onload=()=>{$('build').disabled=false;build();};source.onerror=()=>{$('status').textContent='Bundled '+imagery.name+' map could not be loaded. Reinstall or rebuild the application.';};source.src=imagery.path;
