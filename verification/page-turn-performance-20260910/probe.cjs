const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('/Users/song/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root='/Users/song/Documents/拾页',checks=[],errors=[];let browser,server,p;
(async()=>{
 const {Admin}=await import(path.join(root,'dist/server/admin.js')),{InviteAccess,generateInvites}=await import(path.join(root,'dist/server/access.js')),{createApp}=await import(path.join(root,'dist/server/app.js'));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shiye-editor-gestures-')),batch=generateInvites(1),file=path.join(dir,'invites.json');fs.writeFileSync(file,JSON.stringify(batch.config));const access=new InviteAccess(file),admin=new Admin(path.join(dir,'admin.json'),access);await admin.init({apiKey:'fixture',secretKey:'fixture',cutout:false,naming:false},path.join(dir,'receipt'));
 const grant=await access.verify(batch.codes[0],'fixture','local');await admin.register(grant.token,{username:'style-user',password:'fixture-password-123'});
 const {app}=await createApp({runtime:path.join(dir,'runtime'),staticRoot:path.join(root,'shiye-editorial-prototype'),admin,access,copyProvider:{generate:async()=>({text:'把今天慢慢收好。',provider:'test',model:'fixture'})}});server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());await context.request.get(base+'/api/access/session');await context.request.post(base+'/api/access/login',{headers:{origin:base},data:{username:'style-user',password:'fixture-password-123'}});
 p=await context.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));await p.goto(base);const ready=()=>p.waitForFunction(()=>workSync&&!workSync.running&&workSync.label==='已同步到当前服务');await ready();
 await p.evaluate(async()=>{const b=seed().books[0];b.id='menu-book';b.page=0;b.editorLayout='single';state.assets=[clone(builtin.find(a=>a.id==='orange'))];b.pages=[{id:'p0',paper:'plain',spreadKey:'pair-a',spreadSide:'left',elements:[{id:'text',type:'text',text:'保留文字样式',font:'fangsong',size:30.5,bold:true,color:'#315b90',direction:'horizontal',x:12,y:12,w:45,rotation:2},{id:'sticker',type:'sticker',assetId:'orange',x:65,y:65,w:20,rotation:5}]},{id:'p1',paper:'plain',spreadKey:'pair-a',spreadSide:'right',elements:[]},{id:'p2',paper:'plain',spreadKey:'pair-b',spreadSide:'left',elements:[]},{id:'p3',paper:'plain',spreadKey:'pair-b',spreadSide:'right',elements:[]}];state.books=[b];dirty();await saveNow();openBook(b.id,true);});await ready();


 await p.emulateMedia({reducedMotion:'no-preference'});
 for(const count of [2,24]){
 const result=await p.evaluate(async count=>{
 cancelReaderTurn();editing=false;readerCover=null;currentBook().page=0;
 const items=Array.from({length:count},(_,i)=>i%2?{id:'probe'+i,type:'text',text:'山野来信 · 测试文字',font:'serif',size:23,x:(i%4)*22,y:Math.floor(i/4)*12,w:25,color:'#505b46'}:{id:'probe'+i,type:'sticker',assetId:'orange',x:(i%4)*22,y:Math.floor(i/4)*12,w:20});
 currentBook().pages[1].elements=items;currentBook().pages[2].elements=items.map((e,i)=>({...e,id:'back'+i}));renderEditor();
 await Promise.all([...document.images].map(im=>im.decode().catch(()=>{})));
 const leaves=[...document.querySelectorAll('.reader-spread>.reader-leaf')].map(e=>e.getBoundingClientRect());const gap=leaves[1].left-leaves[0].right;
 const before=document.querySelectorAll('*').length;const t=performance.now(),turn=prepareReaderTurn(1);drawSideTurn(turn,0);await new Promise(resolve=>{const check=()=>turn.ready?resolve():setTimeout(check,10);check();});const buildMs=performance.now()-t;const added=document.querySelectorAll('*').length-before;
 const frames=[];await new Promise(resolve=>{let start,last;function tick(now){if(start===undefined)start=now;if(last!==undefined)frames.push(now-last);last=now;const p=Math.min(1,(now-start)/1450);drawSideTurn(turn,p);if(p<1)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});
 drawSideTurn(turn,.5);const sorted=[...frames].sort((a,b)=>a-b);
 return {elementsPerFace:count,addedNodes:added,buildMs:Math.round(buildMs),frames:frames.length,p95FrameMs:Math.round(sorted[Math.floor(sorted.length*.95)]),over33ms:frames.filter(x=>x>33.5).length,maxFrameMs:Math.round(Math.max(...frames)),staticGutterPx:gap,textureMode:!turn.simple,strips:turn.strips?.length||0};
 },count);checks.push(result);console.log(JSON.stringify(result));await p.screenshot({path:'/Users/song/Documents/拾页/verification/page-turn-performance-20260910/mid-turn-'+count+'.png'});
 }
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(async()=>{fs.writeFileSync('/Users/song/Documents/拾页/verification/page-turn-performance-20260910/performance.json',JSON.stringify(checks,null,2));await browser?.close();if(server)await new Promise(r=>server.close(r));});
