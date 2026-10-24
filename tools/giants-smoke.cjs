const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
const root=path.resolve(__dirname,'../site'),output=path.resolve(__dirname,'../giants-smoke-output');fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(data);});});await new Promise(r=>server.listen(8129,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(300000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8129');
for(const world of ['saturn','uranus','neptune']){
 await page.locator('#w-'+world).click();const name=world[0].toUpperCase()+world.slice(1);
 await page.waitForFunction(name=>document.querySelector('#jp-palette input')?.getAttribute('aria-label')===name+' filament 1'&&document.getElementById('busy').hidden,name);
 assert.equal(await page.locator('#exag').isEnabled(),false);
 assert.match(await page.locator('#giant-panel-link').getAttribute('href'),new RegExp('world='+world));
 await page.locator('#tab-globe').click();const box=await page.locator('#globe').boundingBox();await page.locator('#globe').click({position:{x:box.width/2,y:box.height/2}});await page.screenshot({path:path.join(output,world+'-globe.png')});await page.locator('#tab-model').click();
 await page.locator('label[for="p-puzzle"]').click();await page.locator('label[for="s-square"]').click();await page.selectOption('#jp-grid','80');
 await page.waitForFunction(()=>document.getElementById('busy').hidden);
 const dl=page.waitForEvent('download');await page.locator('#export').click();const zip=path.join(output,world+'-export.zip');await (await dl).saveAs(zip);
 require('node:child_process').execFileSync('python',['-c',`import zipfile,sys,json
with zipfile.ZipFile(sys.argv[1]) as z:
 world=sys.argv[2];names=z.namelist();s=json.loads(z.read(world+'-settings.json'))
 assert s['query']['world']==world and s['imagery']['name'].lower()==world
 assert world.upper()+'-PRINTING.txt' in names and 'color-changes.csv' in names
 assert any(n.endswith('-print-guide.pdf') for n in names)
 assert any(n.startswith('single-pieces/') for n in names)
 assert any(n.endswith('-piece-map.svg') for n in names)
 assert any(n.endswith('.3mf') for n in names)
`,zip,world]);
 const panel=await browser.newPage();panel.setDefaultTimeout(300000);panel.on('pageerror',e=>errors.push(e.message));await panel.goto('http://127.0.0.1:8129/jupiter.html?world='+world);await panel.waitForFunction(()=>!document.getElementById('download').disabled);assert.match(await panel.title(),new RegExp(name));await panel.close();
}
// Exercise the actual 1024 grid in the normal workflow, including preview packing.
await page.locator('#w-saturn').click();await page.locator('label[for="p-ornament"]').click();await page.locator('label[for="b-none"]').click();await page.selectOption('#jp-grid','1024');
await page.waitForFunction(()=>document.getElementById('chip-mesh').textContent.includes('1024 × 1024')&&document.getElementById('busy').hidden);
await page.screenshot({path:path.join(output,'saturn-1024.png')});
// A ring-obscured selection must fail, not manufacture a black color band.
await page.selectOption('#jp-grid','48');await page.locator('#size').fill('1000');await page.locator('#size').dispatchEvent('change');await page.locator('#lat').fill('0');await page.locator('#lat').dispatchEvent('change');
await page.waitForFunction(()=>document.body.innerText.includes('unmapped polar or obscured imagery'));
await page.locator('#w-moon').click();assert.equal(await page.locator('#exag').isEnabled(),true);
assert.deepEqual(errors,[]);console.log('Giant planets and 1024 browser smoke passed');
}catch(e){if(browser){const p=browser.contexts()[0]?.pages()[0];if(p){await p.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});console.error(await p.locator('body').innerText().catch(()=>''));}}throw e;}finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
