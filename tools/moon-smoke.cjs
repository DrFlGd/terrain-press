const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
const root=path.resolve(__dirname,'../site'),output=path.resolve(__dirname,'../moon-smoke-output');fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.json':'application/json','.jpg':'image/jpeg','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(data);});});await new Promise(r=>server.listen(8127,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(300000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8127');const tab=t=>page.locator('#side-'+t).click();await page.locator('#w-moon').click();
await tab('frame');await page.locator('label[for="b-none"]').click();
await tab('colors');assert.equal(await page.locator('#contrast-wrap').isVisible(),false);await page.locator('#surface-color').check();assert.equal(await page.locator('#contrast-wrap').isVisible(),true);
await page.waitForFunction(()=>document.querySelectorAll('#surface-palette input').length===4&&document.getElementById('busy').hidden);
assert.equal(await page.locator('#exag').isEnabled(),true);assert.equal(await page.locator('#c-terrain').isEnabled(),false);
await page.locator('#tab-globe').click();await page.locator('#tab-model').click();
await page.selectOption('#surface-count','2');await page.waitForFunction(()=>document.querySelectorAll('#surface-palette input').length===2&&document.getElementById('busy').hidden);
await page.selectOption('#surface-count','8');await page.waitForFunction(()=>document.querySelectorAll('#surface-palette input').length===8&&document.getElementById('busy').hidden);
await page.locator('#surface-palette input').first().fill('#ff0000');await page.locator('#surface-palette input').first().dispatchEvent('change');
await tab('model');await page.locator('label[for="p-puzzle"]').click();await page.locator('label[for="s-square"]').click();await page.locator('#pieces').fill('2');await page.locator('#pieces').dispatchEvent('change');
await tab('print');await page.locator('#preview-high').check();await page.waitForFunction(()=>document.getElementById('busy').hidden&&document.getElementById('chip-mesh').textContent.includes('Export-matched'));
await page.screenshot({path:path.join(output,'moon-surface.png'),fullPage:true});
const dl=page.waitForEvent('download',{timeout:180000});await page.locator('#export').click();const zip=path.join(output,'moon-export.zip');await (await dl).saveAs(zip);
require('node:child_process').execFileSync('python',['-c',`import zipfile,sys,xml.etree.ElementTree as ET,io
with zipfile.ZipFile(sys.argv[1]) as z:
 names=z.namelist()
 assert 'surface-palette.csv' in names
 assert 'MOON-COLOR-PRINTING.txt' in names
 assert any(n.endswith('-print-guide.pdf') for n in names)
 parts=[n for n in names if n.startswith('single-pieces/') and n.endswith('.3mf')]
 assert len(parts)==4, parts
 for name in parts:
  with zipfile.ZipFile(io.BytesIO(z.read(name))) as m:
   root=ET.fromstring(m.read('3D/3dmodel.model'))
   ns={'m':'http://schemas.microsoft.com/3dmanufacturing/core/2015/02'}
   assert any(t.get('pid')=='100000' for t in root.findall('.//m:triangle',ns))
 assert '#ff0000' in z.read('surface-palette.csv').decode()
 assert 'color-changes.csv' not in names
`,zip]);
await tab('colors');await page.locator('#surface-color').uncheck();assert.equal(await page.locator('#c-terrain').isEnabled(),true);assert.equal(await page.locator('#contrast-wrap').isVisible(),false);assert.equal(await page.locator('#surface-color-controls').isVisible(),false);
assert.deepEqual(errors,[]);console.log('Moon surface color browser smoke passed');
}catch(e){if(browser){const pages=browser.contexts()[0]?.pages();if(pages?.[0]){await pages[0].screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});console.error(await pages[0].locator('body').innerText());}}throw e;}finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
