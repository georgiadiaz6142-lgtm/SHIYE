const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('/Users/song/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url='http://127.0.0.1:4176',src=path.resolve(__dirname,'../../shiye-editorial-prototype'),label=process.argv[2];
if(!/^[a-z0-9-]+$/.test(label||''))throw Error('unique label required');const out=path.join(__dirname,label);fs.mkdirSync(out);
const report={checks:[],errors:[],hashes:{},screenshots:[],external:[]};let browser;
const A=(p,a,v)=>p.locator(`[data-action="${a}"]${v===undefined?'':`[data-value="${v}"]`}`).first();
const click=(p,a,v)=>A(p,a,v).click();
const shot=async(p,n)=>{await p.screenshot({path:path.join(out,n+'.png'),fullPage:false});report.screenshots.push(n+'.png');};
const ready=p=>p.waitForFunction(()=>document.querySelector('.brush-overlay')?.width===document.querySelector('#crop-source')?.naturalWidth&&document.querySelector('#crop-source')?.naturalWidth>0);
const alpha=(p,x,y)=>p.locator('.brush-overlay').evaluate((c,[x,y])=>c.getContext('2d').getImageData(Math.floor(x*c.width),Math.floor(y*c.height),1,1).data[3],[x,y]);
const star=Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,r=i%2?.15:.36;return [.5+Math.cos(a)*r*2/3,.5+Math.sin(a)*r];});
const bounds=p=>p.locator('.brush-overlay').boundingBox();
async function stroke(p,pts){const r=await bounds(p);await p.mouse.move(r.x+pts[0][0]*r.width,r.y+pts[0][1]*r.height);await p.mouse.down();for(const [x,y]of pts.slice(1))await p.mouse.move(r.x+x*r.width,r.y+y*r.height,{steps:5});await p.mouse.up();}
async function upload(p,fixture=false){await click(p,'home-create-sticker');if(fixture){const data=await p.evaluate(points=>{const c=document.createElement('canvas');c.width=1200;c.height=800;const x=c.getContext('2d');x.fillStyle='#eae4d3';x.fillRect(0,0,1200,800);x.fillStyle='#b45b40';x.beginPath();points.forEach(([a,b],i)=>i?x.lineTo(a*1200,b*800):x.moveTo(a*1200,b*800));x.closePath();x.fill();return c.toDataURL('image/png').split(',')[1];},star);await p.locator('#photo-input').setInputFiles({name:'star-fixture.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});}else await p.locator('#photo-input').setInputFiles(path.join(src,'assets/lake.jpg'));await ready(p);}
const saved=p=>p.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('shiye-concept-v1',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('data').objectStore('data').get('workspace');q.onsuccess=()=>{db.close();resolve(q.result)};};}));
async function test(name,fn,options={}){const c=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',...options}),p=await c.newPage();p.setDefaultTimeout(8000);p.on('pageerror',e=>report.errors.push({name,error:e.message}));await c.route('**/*',r=>new URL(r.request().url()).origin===url?r.continue():(report.external.push(r.request().url()),r.abort()));try{await p.goto(url,{waitUntil:'networkidle'});await fn(p,c);report.checks.push({name,status:'PASS'});console.log('PASS',name);}catch(e){report.checks.push({name,status:'FAIL',error:e.stack});console.log('FAIL',name,e.message);await shot(p,name+'-failure');}finally{await c.close();}}
async function main(){for(const file of ['app.js','styles.css','index.html']){const b=fs.readFileSync(path.join(src,file)),r=await fetch(url+'/'+file);assert.equal(r.status,200);assert.ok(b.equals(Buffer.from(await r.arrayBuffer())));report.hashes[file]=crypto.createHash('sha256').update(b).digest('hex');}browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version();
 await test('star-add-erase-undo-confirm-save',async p=>{
  await upload(p,true);assert.equal(await A(p,'generate').isDisabled(),true);await shot(p,'01-brush-workshop');
  await stroke(p,[...star,star[0]]);assert.equal(await p.locator('#sticker-preview').count(),0);assert.ok(await alpha(p,.5,.5)>240);assert.equal(await alpha(p,.1,.1),0);assert.ok(await alpha(p,.5,.16)>0);await shot(p,'02-star-selection');
  await click(p,'brush-tool','add');await ready(p);await stroke(p,[[.76,.5],[.85,.5]]);assert.ok(await alpha(p,.8,.5)>0);
  await click(p,'brush-tool','erase');await ready(p);await stroke(p,[[.5,.45],[.5,.55]]);assert.equal(await alpha(p,.5,.5),0);await shot(p,'03-erase-detail');
  await click(p,'undo-crop');await ready(p);assert.ok(await alpha(p,.5,.5)>240);await click(p,'undo-crop');await ready(p);assert.equal(await alpha(p,.8,.5),0);
  await click(p,'generate');await p.locator('#sticker-preview').waitFor();const result=await p.locator('#sticker-preview').evaluate(async img=>{await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const x=c.getContext('2d');x.drawImage(img,0,0);return {corner:x.getImageData(0,0,1,1).data[3],middle:x.getImageData(c.width/2,c.height/2,1,1).data[3],width:c.width};});assert.equal(result.corner,0);assert.equal(result.middle,255);assert.ok(result.width>400);await shot(p,'04-transparent-result');
  await click(p,'back-subjects');await ready(p);assert.ok(await alpha(p,.5,.5)>240);await click(p,'generate');await p.locator('#sticker-preview').waitFor();await click(p,'save-and-use');await p.locator('.creation-books').waitFor();assert.equal((await saved(p)).assets.length,1);
  await click(p,'creation-new-book');await p.locator('#new-title').fill('画笔验收');await click(p,'create-book');await p.locator('#canvas-page .element img').waitFor();await p.waitForFunction(()=>document.querySelector('.local-status')?.textContent==='已保存到本机');const before=await saved(p);assert.equal(before.books.find(b=>b.title==='画笔验收').pages[0].elements.length,1);
  await p.reload({waitUntil:'networkidle'});assert.deepEqual((await saved(p)).assets,before.assets);
 });
 await test('clear-full-empty-and-resize',async p=>{
  await upload(p);await stroke(p,[[.2,.2],[.7,.2],[.7,.7],[.2,.7],[.2,.2]]);const before=await p.locator('.brush-overlay').evaluate(c=>c.toDataURL());await p.setViewportSize({width:900,height:950});await p.waitForTimeout(150);assert.equal(await p.locator('.brush-overlay').evaluate(c=>c.toDataURL()),before);
  await click(p,'clear-crops');await ready(p);assert.equal(await A(p,'generate').isDisabled(),true);await click(p,'undo-crop');await ready(p);assert.ok(await alpha(p,.5,.5)>240);await click(p,'full-crop');await ready(p);assert.ok(await alpha(p,.05,.05)>240);
  await click(p,'clear-crops');await click(p,'brush-tool','erase');await ready(p);await stroke(p,[[.5,.5],[.6,.5]]);assert.equal(await A(p,'generate').isDisabled(),true);
 });
 await test('cancel-stroke-and-switch-rectangle',async p=>{
  await upload(p);const r=await bounds(p);await p.mouse.move(r.x+r.width*.2,r.y+r.height*.2);await p.mouse.down();await p.mouse.move(r.x+r.width*.6,r.y+r.height*.7,{steps:15});await p.locator('.brush-loupe:not([hidden])').waitFor();await shot(p,'05-magnifier');await p.locator('#crop-stage').dispatchEvent('pointercancel');await p.mouse.up();assert.equal(await A(p,'generate').isDisabled(),true);
  await stroke(p,[[.3,.3],[.7,.3],[.5,.7],[.3,.3]]);await click(p,'crop-mode','rect');const rect=await p.locator('#crop-stage').boundingBox();await p.mouse.move(rect.x+rect.width*.2,rect.y+rect.height*.2);await p.mouse.down();await p.mouse.move(rect.x+rect.width*.7,rect.y+rect.height*.7,{steps:10});await p.mouse.up();await click(p,'generate');await p.locator('#sticker-preview').waitFor();await click(p,'back-subjects');await click(p,'brush-tool','loop');await ready(p);assert.ok(await alpha(p,.5,.4)>240);
 });
 await test('mobile-touch-star-and-brush-size',async(p,c)=>{
  await upload(p,true);await p.locator('#brush-size').fill('32');assert.match(await p.locator('#brush-size-value').innerText(),/32/);await p.locator('#crop-stage').scrollIntoViewIfNeeded();await p.waitForTimeout(150);const r=await bounds(p),cdp=await c.newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+star[0][0]*r.width,y:r.y+star[0][1]*r.height}]});for(const [x,y]of [...star.slice(1),star[0]])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+x*r.width,y:r.y+y*r.height}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok(await alpha(p,.5,.5)>0);await shot(p,'06-mobile-star');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);await click(p,'generate');await p.locator('#sticker-preview').waitFor();
 },{viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 await test('hole-export-single-dab-and-stale-result',async p=>{
  await upload(p);await click(p,'full-crop');await click(p,'brush-tool','erase');await ready(p);await stroke(p,[[.5,.4],[.5,.6]]);
  await click(p,'generate');await p.locator('#sticker-preview').waitFor();assert.equal(await p.locator('#sticker-preview').evaluate(async img=>{await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const x=c.getContext('2d');x.drawImage(img,0,0);return x.getImageData(c.width/2,c.height/2,1,1).data[3];}),0);
  await click(p,'back-subjects');await click(p,'brush-tool','add');await ready(p);await stroke(p,[[.5,.5]]);assert.ok(await alpha(p,.5,.5)>240);
  await p.evaluate(()=>{const original=readImage;readImage=async src=>{const image=await original(src);await new Promise(r=>setTimeout(r,400));return image;};});
  await click(p,'generate');await click(p,'clear-crops');await ready(p);await p.waitForTimeout(600);assert.equal(await p.locator('#sticker-preview').count(),0);assert.equal(await A(p,'generate').isDisabled(),true);
 });
 await test('new-photo-resets-mask-and-demo-stays',async p=>{
  await upload(p);await stroke(p,[[.2,.2],[.8,.2],[.5,.8],[.2,.2]]);await click(p,'workshop-reset');await p.locator('#photo-input').setInputFiles(path.join(src,'assets/coffee.jpg'));await ready(p);assert.equal(await A(p,'generate').isDisabled(),true);await click(p,'workshop-reset');await click(p,'sample');await click(p,'generate');await p.locator('#sticker-preview').waitFor();assert.equal(await p.locator('.preview-switch button').count(),2);
 });
}
main().catch(e=>{report.fatal=e.stack;console.error(e);}).finally(async()=>{await browser?.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,checks:report.checks,errors:report.errors,fatal:report.fatal}));process.exitCode=report.fatal||report.errors.length||report.checks.some(x=>x.status==='FAIL')?1:0;});
