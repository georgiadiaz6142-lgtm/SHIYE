const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/Users/song/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.join(__dirname,process.argv[2]);fs.mkdirSync(out);const report={checks:[],errors:[]};
const A=(p,a,v)=>p.locator(`[data-action="${a}"]${v===undefined?'':`[data-value="${v}"]`}`).first();
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{for(const width of [1440,390]){
const c=await b.newContext({viewport:{width,height:1000},hasTouch:width===390,isMobile:width===390});
await c.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4176'&&r.request().method()==='GET'?r.continue():r.abort());
const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto('http://127.0.0.1:4176');
await A(p,'new-book').click();await p.locator('#new-title').fill('字体隔离验证');await A(p,'create-book').click();await p.locator('#canvas-page').waitFor();
await A(p,'drawer','text').click();assert.equal(await p.locator('#new-text-font option').count(),5);await p.locator('#new-text-font').selectOption('sans');assert.equal(await p.evaluate(()=>currentPage().elements.length),0);
await p.screenshot({path:path.join(out,`picker-${width}.png`)});
await A(p,'add-text').click();const input=p.locator('.inline-text-input');await input.fill('把日子，慢慢收好。\n选择喜欢的字体');assert.equal(await input.evaluate(n=>getComputedStyle(n).outlineStyle),'none');assert.equal(await p.locator('#dialog').evaluate(n=>n.open),false);await p.keyboard.press('Escape');
const original=await p.evaluate(()=>({...currentPage().elements[0]}));assert.equal(original.font,'sans');
const fonts=['serif','sans','hand','fangsong','rounded'];const families={};
for(const font of fonts){await p.locator('#selected-text-font').selectOption(font);assert.deepEqual(await p.evaluate(()=>({...currentPage().elements[0]})),{...original,font});
const el=p.locator(`#canvas-page [data-element="${original.id}"]`);families[font]=await el.evaluate(n=>getComputedStyle(n).fontFamily);
assert.equal(await p.locator(`.thumb-content [data-element="${original.id}"]`).evaluate(n=>getComputedStyle(n).fontFamily),families[font]);
await el.locator('.text-content').dblclick();assert.equal(await input.evaluate(n=>getComputedStyle(n).fontFamily),families[font]);assert.equal(await input.inputValue(),original.text);await p.keyboard.press('Escape');}
await A(p,'undo').click();assert.equal(await p.evaluate(()=>currentPage().elements[0].font),'fangsong');await A(p,'redo').click();assert.equal(await p.evaluate(()=>currentPage().elements[0].font),'rounded');
// The legacy style dialog shares the same options and retains vertical layout.
await p.locator(`#canvas-page [data-element="${original.id}"] .text-content`).click();await A(p,'edit-text').click();assert.equal(await p.locator('#text-font').inputValue(),'rounded');await p.locator('#text-direction').selectOption('vertical');await A(p,'save-text').click();
const vertical=await p.evaluate(()=>({...currentPage().elements[0]}));await p.locator('#selected-text-font').selectOption('hand');assert.deepEqual(await p.evaluate(()=>({...currentPage().elements[0]})),{...vertical,font:'hand'});
await p.screenshot({path:path.join(out,`selected-${width}.png`)});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await A(p,'mode','read').click();await p.locator('.read-mode').waitFor();assert.equal(await p.locator(`.reader-spread [data-element="${original.id}"]`).first().evaluate(n=>getComputedStyle(n).fontFamily),families.hand);
const bookId=await p.evaluate(()=>currentBook().id);await p.reload();await p.locator('[data-action="nav"][data-view="shelf"]').click();await p.locator(`[data-action="open-book"][data-id="${bookId}"]`).click();await A(p,'mode','edit').click();assert.deepEqual(await p.evaluate(()=>({...currentPage().elements[0]})),{...vertical,font:'hand'});
// Observe actual glyph fonts without assuming every system has each family.
const session=await c.newCDPSession(p);await session.send('DOM.enable');await session.send('CSS.enable');const actual={};for(const font of fonts){await p.locator(`#canvas-page [data-element="${original.id}"]`).click();await p.locator('#selected-text-font').selectOption(font);const {root}=await session.send('DOM.getDocument');const {nodeId}=await session.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#canvas-page .text-content'});actual[font]=(await session.send('CSS.getPlatformFontsForNode',{nodeId})).fonts.map(f=>f.familyName);}
report.checks.push({width,status:'PASS',families,actual,checks:'5 options; default does not create text; inline inheritance; only font changes; thumbnail/read parity; undo/redo; vertical; reload; no viewport overflow'});console.log(width+' PASS '+JSON.stringify(actual));await c.close();
}}finally{await b.close();}assert.deepEqual(report.errors,[]);})().catch(e=>{report.failure=e.stack;process.exitCode=1;console.error(e);}).finally(()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)));
