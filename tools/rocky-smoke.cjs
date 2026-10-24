const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
const root=path.resolve(__dirname,'../site'),output=path.resolve(__dirname,'../rocky-smoke-output');fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.json':'application/json','.jpg':'image/jpeg','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(data);});});await new Promise(r=>server.listen(8128,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(300000);const earthTiles=[];page.on('request',r=>{if(r.url().includes('/earth/color-21600/'))earthTiles.push(r.url());});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8128');
await page.locator('label[for="b-none"]').click();
await page.locator('#width-num').fill('60');await page.locator('#width-num').dispatchEvent('change');
for(const world of ['earth','mars','mercury','venus']){
 await page.locator('#w-'+world).click();
 await page.locator('#surface-color').check();
 await page.selectOption('#surface-grid',world==='earth'?'1024':'128');
 await page.selectOption('#surface-count',world==='earth'?'2':'8');
 const name=world[0].toUpperCase()+world.slice(1);
 await page.waitForFunction(({name,count})=>document.querySelectorAll('#surface-palette input').length===count&&document.querySelector('#surface-palette input')?.getAttribute('aria-label')===name+' filament 1'&&document.getElementById('busy').hidden,{name,count:world==='earth'?2:8});
 assert.equal(await page.locator('#c-terrain').isEnabled(),false);
 assert.ok((await page.locator('#surface-source-text').innerText()).length>30);
 await page.locator('#tab-globe').click();await page.waitForFunction(()=>document.getElementById('gbusy').hidden);await page.screenshot({path:path.join(output,world+'-globe.png')});await page.locator('#tab-model').click();
 await page.locator('#surface-palette input').first().fill('#ff0000');await page.locator('#surface-palette input').first().dispatchEvent('change');
 const dl=page.waitForEvent('download',{timeout:180000});await page.locator('#export').click();const zip=path.join(output,world+'-export.zip');await (await dl).saveAs(zip);
 require('node:child_process').execFileSync('python',['-c',`import zipfile,sys,json,io,xml.etree.ElementTree as ET
with zipfile.ZipFile(sys.argv[1]) as z:
 world=sys.argv[2]
 names=z.namelist()
 settings=json.loads(z.read(world+'-surface-settings.json'))
 assert settings['query']['world']==world
 if world=='earth':
  assert settings['query']['surfaceGrid']==1024
  assert settings['imagery']['width']==21600
  assert settings['imagery']['globeWidth']==8192
 assert settings['imagery']['name'].lower()==world
 assert world.upper()+'-COLOR-PRINTING.txt' in names
 assert '#ff0000' in z.read('surface-palette.csv').decode()
 assert any(n.endswith('-print-guide.pdf') for n in names)
 assert 'color-changes.csv' not in names
 models=[n for n in names if n.endswith('.3mf')]
 assert models
 with zipfile.ZipFile(io.BytesIO(z.read(models[0]))) as m:
  root=ET.fromstring(m.read('3D/3dmodel.model'))
  ns={'m':'http://schemas.microsoft.com/3dmanufacturing/core/2015/02'}
  assert any(t.get('pid')=='100000' for t in root.findall('.//m:triangle',ns))
`,zip,world]);
 await page.screenshot({path:path.join(output,world+'-surface.png'),fullPage:true});
}
assert.ok(earthTiles.length>0,'painting requested native Earth tiles');
await page.locator('#w-earth').click();
const seamRequests=Promise.all(['0_1.jpg','5_1.jpg'].map(name=>page.waitForRequest(r=>r.url().endsWith('/earth/color-21600/'+name))));
await page.locator('#lat').fill('0');await page.locator('#lat').dispatchEvent('change');
await page.locator('#lon').fill('179.9');await page.locator('#lon').dispatchEvent('change');
await page.locator('#size').fill('1000');await page.locator('#size').dispatchEvent('change');
await page.waitForFunction(()=>document.getElementById('busy').hidden&&document.querySelector('#surface-palette input')?.getAttribute('aria-label')==='Earth filament 1');
await seamRequests;
await page.waitForFunction(()=>document.getElementById('busy').hidden);
assert.ok(earthTiles.some(u=>u.endsWith('/0_1.jpg'))&&earthTiles.some(u=>u.endsWith('/5_1.jpg')),'both sides of the dateline are sampled');
await page.locator('#w-ceres').click();assert.equal(await page.locator('#surface-color-options').isVisible(),false);assert.equal(await page.locator('#c-terrain').isEnabled(),true);
assert.deepEqual(errors,[]);console.log('Rocky-world surface color browser smoke passed');
}catch(e){if(browser){const pages=browser.contexts()[0]?.pages();if(pages?.[0]){await pages[0].screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});console.error(await pages[0].locator('body').innerText());}}throw e;}finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
