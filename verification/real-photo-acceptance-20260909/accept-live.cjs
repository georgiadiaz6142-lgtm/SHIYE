// Explicitly authorized live acceptance. Interactive commands prevent automatic retries.
const fs=require('node:fs'),path=require('node:path'),readline=require('node:readline');
const {chromium}=require('/Users/song/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sharp=require('sharp');
const base='http://127.0.0.1:4176',out=__dirname;
const files=JSON.parse(fs.readFileSync('/private/tmp/shiye-acceptance-inputs.json'));
const report={startedAt:new Date().toISOString(),requests:[],jobs:[],checks:[],errors:[],external:[]};
let browser,page,ctx,current,lastJob;
const A=a=>page.locator(`[data-action="${a}"]`).first();
const audit=()=>{const d=JSON.parse(fs.readFileSync(path.join(out,'../../.local/baidu-live-trial-20260908/state.json')));return {attempted:d.jobs.filter(j=>j.provider==='baidu'&&j.providerAttemptedAt).length,inflight:d.jobs.filter(j=>['queued','running'].includes(j.status)).length};};
const persist=()=>fs.writeFileSync(path.join(out,'live-results.json'),JSON.stringify({...report,audit:audit()},null,2)+'\n');
async function shot(label){await page.screenshot({path:path.join(out,label+'.png'),fullPage:true});}
async function ready(){await page.waitForFunction(()=>{const s=document.querySelector('.seg-status')?.textContent||'';return /结果已返回|任务未完成/.test(s)||!!document.querySelector('.seg-error');},{},{timeout:120000});await page.waitForTimeout(500);}
async function capture(label){
 await shot(label);const status=await page.locator('.seg-status').innerText(),error=await page.locator('.seg-error').allTextContents();
 const imgs=await page.locator('.seg-candidate img').evaluateAll(es=>es.map(e=>e.getAttribute('src'))),outputs=[];
 for(let i=0;i<imgs.length;i++){
  const r=await ctx.request.get(base+imgs[i]);const bytes=await r.body();fs.writeFileSync(path.join(out,`${label}-${i}.png`),bytes);
  const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});let zero=0,partial=0,opaque=0;
  for(let n=3;n<data.length;n+=4){if(data[n]===0)zero++;else if(data[n]===255)opaque++;else partial++;}
  outputs.push({file:`${label}-${i}.png`,width:info.width,height:info.height,alpha:{zero,partial,opaque}});
 }
 const result={label,status,error,outputs,audit:audit()};report.checks.push(result);persist();console.log(JSON.stringify(result));
}
async function command(c){
 if(c.action==='auto'){
  const budget=audit();if(budget.attempted>=10||budget.inflight||Date.now()>=Date.parse('2026-09-09T12:10:11Z'))throw Error('Budget/time/inflight gate');
  if(!Object.hasOwn(files,c.sample))throw Error('Unapproved sample');current=c.sample;lastJob=null;
  if(await A('seg-new').count())await A('seg-new').click();
  await page.locator('#seg-photo').setInputFiles(files[c.sample]);await page.locator('#seg-consent').check();
  await A('seg-upload').click();await ready();await capture(current+'-auto');
 }else if(c.action==='refine'){
  const budget=audit();if(budget.attempted>=10||budget.inflight||Date.now()>=Date.parse('2026-09-09T12:10:11Z'))throw Error('Budget/time/inflight gate');
  if(c.target!==undefined)await page.locator('[data-action="seg-target"]').nth(c.target).click();
  const r=await page.locator('#seg-prompts').boundingBox(),[x,y,w,h]=c.box;
  await page.mouse.move(r.x+r.width*x,r.y+r.height*y);await page.mouse.down();await page.mouse.move(r.x+r.width*(x+w),r.y+r.height*(y+h),{steps:12});await page.mouse.up();
  await A('seg-refine').click();await page.waitForTimeout(700);await ready();await capture(c.label);
 }else if(c.action==='inspect'){
  console.log((await page.locator('body').innerText()).slice(-12000));
 }else if(c.action==='preview'){
  await A('seg-confirm').click();await page.locator('#seg-sticker-preview').waitFor();await page.locator('#seg-border').fill('8');await page.waitForTimeout(1000);await shot(current+'-border');
  const src=await page.locator('#seg-sticker-preview').getAttribute('src');const bytes=await page.evaluate(async u=>Array.from(new Uint8Array(await(await fetch(u)).arrayBuffer())),src);fs.writeFileSync(path.join(out,current+'-border-output.png'),Buffer.from(bytes));
  report.checks.push({action:'preview-white-border',audit:audit()});persist();console.log('PREVIEW_READY');
 }else if(c.action==='save'){
  await A('seg-save').click();await page.locator('.collection-header').waitFor();await page.waitForFunction(()=>document.querySelector('.local-status')?.textContent==='已保存到本机');await shot(current+'-collection');
  console.log('SAVED');
 }else if(c.action==='eval'){
  const result=await page.evaluate(c.code);console.log(JSON.stringify(result));
 }else if(c.action==='click'){
  await page.locator(c.selector).first().click();await page.waitForTimeout(600);console.log('CLICKED');
 }else if(c.action==='reload'){
  await page.reload({waitUntil:'networkidle'});console.log('RELOADED');
 }else if(c.action==='shot'){await shot(c.label);console.log('SCREENSHOT');
 }else if(c.action==='close'){persist();await browser.close();process.exit(0);}
 else throw Error('Unknown command');
}
(async()=>{
 report.before=audit();browser=await chromium.launch({channel:'chrome',headless:true});ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page=await ctx.newPage();page.setDefaultTimeout(15000);
 await ctx.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==base){report.external.push(u.origin);return r.abort();}return r.continue();});
 page.on('pageerror',e=>{report.errors.push(e.message);persist();});
 page.on('response',async r=>{try{const u=new URL(r.url());if(!u.pathname.startsWith('/api/'))return;
  if(r.request().method()==='POST'){report.requests.push({at:new Date().toISOString(),sample:current,path:u.pathname,status:r.status()});persist();}
  if(u.pathname.startsWith('/api/jobs/')){const j=await r.json();if(['succeeded','failed','expired','cancelled'].includes(j.status)&&!report.jobs.some(v=>v.jobId===j.jobId)){lastJob=j;report.jobs.push({sample:current,jobId:j.jobId,kind:j.kind,status:j.status,createdAt:j.createdAt,updatedAt:j.updatedAt,providerAttemptedAt:j.providerAttemptedAt,providerRequestId:j.providerRequestId,error:j.error,candidates:j.candidates});persist();}}
 }catch(e){console.log('OBSERVER',e.message);}});
 await page.goto(base,{waitUntil:'networkidle'});report.health=await page.evaluate(async()=>await(await fetch('/api/health')).json());if(!report.health.liveAvailable)throw Error('live unavailable');
 await A('home-create-sticker').click();await A('seg-open').click();await page.locator('#seg-photo').waitFor({state:'attached'});persist();console.log('READY '+JSON.stringify(audit()));
 const rl=readline.createInterface({input:process.stdin});for await(const line of rl){try{await command(JSON.parse(line));}catch(e){report.checks.push({failure:e.message});persist();console.log('COMMAND_ERROR '+e.message);}}
 await browser.close();
})().catch(async e=>{console.error(e);report.fatal=e.message;persist();await browser?.close();process.exitCode=1;});
