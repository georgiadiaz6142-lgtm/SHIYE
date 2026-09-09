const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const sharp=require('../../node_modules/sharp');
const root=path.resolve(__dirname,'../../shiye-editorial-prototype');
const file=path.join(root,'vendor/opencv-4.13.0/opencv.js'),m=new Module(file);m.filename=file;m.paths=module.paths;m._compile(fs.readFileSync(file,'utf8'),file);
require(path.join(root,'edgecut-core.js'));
const cv=m.exports,report={algorithm:'OpenCV GrabCut 4.13.0',networkCalls:0,checks:[],samples:[],qualityAcceptance:false};
const region={x:.15,y:.15,w:.7,h:.7};
(async()=>{
 await new Promise(resolve=>cv.Mat?resolve():cv.then(()=>resolve()));
 report.build=cv.getBuildInformation().split('\n').slice(0,4);
 // A known silhouette tests the actual algorithm, not a supplied result mask.
 const w=128,h=128,rgba=new Uint8Array(w*h*4),truth=new Uint8Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,on=(x-64)**2+(y-64)**2<32**2;truth[i]=+on;rgba.set(on?[195,58,38,255]:[35,145,171,255],i*4);}
 const result=ShiyeGrabCut.segment(cv,{rgba,width:w,height:h,region});let overlap=0,union=0;
 for(let i=0;i<truth.length;i++){if(truth[i]&&result.alpha[i])overlap++;if(truth[i]||result.alpha[i])union++;}
 assert.ok(overlap/union>.98);report.checks.push({name:'image-derived curved mask differs from rough box',iou:overlap/union});
 const corrected=ShiyeGrabCut.segment(cv,{rgba,width:w,height:h,region,seeds:[{x:.5,y:.5,kind:'remove'}]});assert.equal(corrected.alpha[64*w+64],0);report.checks.push({name:'negative seed recomputes mask',passed:true});
 const restored=ShiyeGrabCut.segment(cv,{rgba,width:w,height:h,region,seeds:[{x:.5,y:.5,kind:'remove'},{x:.5,y:.5,kind:'keep'}]});assert.equal(restored.alpha[64*w+64],255);report.checks.push({name:'latest positive correction takes precedence',passed:true});
 assert.throws(()=>ShiyeGrabCut.segment(cv,{rgba,width:w,height:h,region,seeds:[{x:2,y:0,kind:'keep'}]}));report.checks.push({name:'invalid prompts rejected',passed:true});
 const samples=[
  {name:'coffee-initial',file:'coffee.jpg',region:{x:.35,y:.115,w:.27,h:.35},seeds:[]},
  {name:'coffee-corrected',file:'coffee.jpg',region:{x:.35,y:.115,w:.27,h:.35},seeds:[{x:.49,y:.29,kind:'keep'},{x:.35,y:.22,kind:'remove'},{x:.58,y:.44,kind:'remove'}]},
  {name:'boat-corrected',file:'lake.jpg',region:{points:[{x:0,y:.72},{x:.52,y:.50},{x:1,y:.70},{x:1,y:1},{x:0,y:1}]},seeds:[{x:.5,y:.78,kind:'keep'},{x:.35,y:.70,kind:'keep'},{x:.65,y:.73,kind:'keep'},{x:.3,y:.58,kind:'remove'},{x:.8,y:.62,kind:'remove'}]}
 ];
 for(const s of samples){
  const {data,info}=await sharp(path.join(root,'assets',s.file)).resize({width:720,height:720,fit:'inside',withoutEnlargement:true}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const r=ShiyeGrabCut.segment(cv,{rgba:data,width:info.width,height:info.height,region:s.region,seeds:s.seeds});
  const output=Buffer.from(data);for(let i=0;i<r.alpha.length;i++)output[4*i+3]=r.alpha[i];
  await sharp(output,{raw:{width:info.width,height:info.height,channels:4}}).png().toFile(path.join(__dirname,s.name+'.png'));
  const raw={width:info.width,height:info.height,channels:4};
  const left=await sharp(data,{raw}).png().toBuffer(),right=await sharp(output,{raw}).flatten({background:'#eee9df'}).png().toBuffer();
  await sharp({create:{width:info.width*2,height:info.height,channels:3,background:'#eee9df'}}).composite([{input:left,left:0,top:0},{input:right,left:info.width,top:0}]).png().toFile(path.join(__dirname,s.name+'-comparison.png'));
  report.samples.push({...s,width:info.width,height:info.height,elapsedMs:r.elapsedMs,foregroundPixels:r.foregroundPixels,manualReview:'pending'});
 }
})().catch(e=>{report.error=e?.message||String(e);if(typeof e==='number'&&cv.exceptionFromPtr){try{report.detail=cv.exceptionFromPtr(e).msg;}catch{}};process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(__dirname,'algorithm-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));});
