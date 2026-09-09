'use strict';

// One workshop, explicit mock/live provenance; upload is only triggered by the explicit submit button.
window.ShiyeSegmentation = function createWorkshop(bridge) {
  const esc = bridge.esc;
  const media = id => '/api/media/' + encodeURIComponent(id);
  const makeId = () => crypto.randomUUID();
  const data = { active:false, mode:'mock', health:null, file:null, previewUrl:null, previewSize:null, selectionMode:false, box:null, session:null, job:null, candidates:[], selected:new Set(), target:null, tool:'outline', outline:[], positive:[], negative:[], stage:1, results:[], preview:0, busy:false, error:'', generation:0, booted:false, borderVersion:0 };
  let operations = {}, pollId = null, fileVersion=0;
  const corrections=new Map();let retouch=null;
  const nameDrafts=new Map();
  const correctionKey=c=>[c.imageSessionId,c.sourceRevision,c.candidateId,c.candidateRevision].join(':');
  const corrected=c=>{const edit=corrections.get(correctionKey(c));return edit?.expiresAt>Date.now()?edit:undefined;};
  function correctionDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('shiye-retouch-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('edits',{keyPath:'key'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('无法打开本机修正记录，请重试。'));});}
  async function loadCorrections(){
    for(const [key,value] of corrections)if(value.expiresAt<=Date.now()||!data.candidates.some(c=>correctionKey(c)===key)){URL.revokeObjectURL(value.url);corrections.delete(key);}
    const db=await correctionDB();
    try{await new Promise((resolve,reject)=>{const tx=db.transaction('edits','readwrite'),store=tx.objectStore('edits'),r=store.getAll();
      r.onsuccess=()=>{for(const v of r.result){if(v.expiresAt<=Date.now()){store.delete(v.key);continue;}if(!data.candidates.some(c=>correctionKey(c)===v.key)||corrections.has(v.key))continue;corrections.set(v.key,{...v,url:URL.createObjectURL(v.blob)});}};
      tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(Error('无法读取本机修正记录，请重试。'));
    });}finally{db.close();}
  }
  async function storeCorrection(value){const db=await correctionDB();try{await new Promise((resolve,reject)=>{const tx=db.transaction('edits','readwrite');tx.objectStore('edits').put(value);tx.oncomplete=resolve;tx.onerror=tx.onabort=reject;});}catch{throw Error('本机保存失败，修正仍在画布上，请重试。');}finally{db.close();}}
  async function localImage(id){const response=await fetch(media(id));if(!response.ok)throw Error('临时原图或蒙版已过期，无法继续修边。已收藏的贴纸仍可使用。');return createImageBitmap(await response.blob());}
  async function openRetouch(c){
    if(c.expiresAt<=Date.now())throw Error('临时原图已过期，请重新选择照片。');
    const loaded=[];
    try{loaded.push(await localImage(data.session.objectKey));loaded.push(await localImage(c.maskRef));const edit=corrected(c);if(edit)loaded.push(await createImageBitmap(edit.mask));
      retouch={candidate:c,editor:createLocalMaskEditor(...loaded)};
    }catch(e){for(const img of loaded)img.close();throw e;}
  }
  function leaveRetouch(){if(!retouch)return true;if(retouch.editor.changed&&!confirm('尚未应用的修边会丢失，确定返回吗？'))return false;retouch.editor.dispose();retouch=null;return true;}
  function mountRetouch(pending){
    if(!retouch)return;const e=retouch.editor,plane=document.querySelector('.retouch-plane');if(!plane)return;plane.append(e.canvas);e.enabled=!pending;e.canvas.style.cursor=e.tool==='pan'?'grab':'crosshair';
    const viewport=document.querySelector('.retouch-viewport');if(e.scroll){viewport.scrollLeft=e.scroll.x;viewport.scrollTop=e.scroll.y;}
    e.onchange=()=>{const u=document.querySelector('[data-action="seg-retouch-undo"]'),r=document.querySelector('[data-action="seg-retouch-redo"]');if(u)u.disabled=!e.canUndo;if(r)r.disabled=!e.canRedo;};e.render();
  }
  async function api(path, body, signal) {
    let response;
    try { response = await fetch('/api'+path, { method:body===undefined?'GET':'POST', headers:body===undefined?{}:{'Content-Type':'application/json'}, body:body===undefined?undefined:JSON.stringify(body), signal }); }
    catch { throw Error('无法连接本机服务。请保留页面，恢复连接后查询原任务。'); }
    let value;try {value=await response.json();}catch{throw Error('当前预览未连接任务后端。本地小剪刀仍可使用。');}
    if(!response.ok)throw Error(value.error?.message||'操作未完成，请重试。');
    return value;
  }
  const live=()=>data.mode==='live';
  const button=(name,label,disabled=false)=>`<button class="button outline small" data-action="seg-${name}" ${disabled?'disabled':''}>${label}</button>`;
  const busy=()=>data.busy||['queued','running'].includes(data.job?.status);
  function persistOrigin() {
    // Only IDs; no photos, masks, credentials, or image URLs in localStorage.
    try { if(data.session)localStorage.setItem('shiye-seg-origin',JSON.stringify({imageSessionId:data.session.imageSessionId,origin:bridge.origin()})); } catch {}
  }
  function draw() {
    if(!data.active||!bridge.visible())return;
    const s=data.session, pending=busy(), real=live();
    const viewport=document.querySelector('.retouch-viewport');if(retouch&&viewport)retouch.editor.scroll={x:viewport.scrollLeft,y:viewport.scrollTop};
    let main='', aside='';
    if(retouch){
      const e=retouch.editor;
      main=`<div class="retouch-toolbar"><label>查看 <select id="seg-retouch-view" ${pending?'disabled':''}>${[['result','修正结果'],['source','原照片'],['initial','原抠图']].map(([v,t])=>`<option value="${v}" ${e.view===v?'selected':''}>${t}</option>`).join('')}</select></label><label>缩放 <select id="seg-retouch-zoom" ${pending?'disabled':''}>${[1,1.5,2,3,4].map(v=>`<option value="${v}" ${e.zoom===v?'selected':''}>${v*100}%</option>`).join('')}</select></label></div><div class="retouch-viewport"><div class="retouch-plane" style="width:${e.zoom*100}%"></div></div>`;
      aside=`<div class="eyebrow">修整这一枚</div><h3>把想留下的，<br>慢慢修好。</h3><div class="retouch-tools">${[['restore','恢复'],['erase','擦除'],['pan','移动画布']].map(([v,t])=>`<button class="button outline small ${e.tool===v?'active':''}" data-action="seg-retouch-tool" data-tool="${v}" aria-pressed="${e.tool===v}" ${pending?'disabled':''}>${t}</button>`).join('')}</div><label class="field"><span>笔刷大小 <output id="seg-brush-value">${e.size}</output> px</span><input id="seg-retouch-size" type="range" min="2" max="${Math.max(80,Math.round(s.width*.2))}" value="${e.size}" ${pending?'disabled':''}></label><div class="seg-actions">${button('retouch-undo','撤销',pending||!e.canUndo)}${button('retouch-redo','重做',pending||!e.canRedo)}${button('retouch-reset','还原原抠图',pending)}</div><p>恢复原照片中被误删的部分，或擦掉多余背景。放大后可切换“移动画布”。</p>${e.view==='result'?'':'<p>正在对比查看，切回“修正结果”后可继续涂画。</p>'}<button class="button primary" data-action="seg-retouch-apply" ${pending?'disabled':''}>应用修正</button>${button('retouch-cancel','返回候选',pending)}<p class="retouch-hint">应用后会暂存修正；未应用的笔画刷新后会丢失。确认满意后保存到我的素材。</p>`;
    }else if(!s&&real){
      const preview=data.previewUrl&&data.previewSize;
      const picture=preview?`<div class="seg-source seg-upload-preview" style="aspect-ratio:${data.previewSize.width}/${data.previewSize.height};--photo-ratio:${data.previewSize.width/data.previewSize.height}"><img id="seg-source" src="${esc(data.previewUrl)}" alt="${esc(data.file.name)}">${data.selectionMode?`<svg id="seg-prompts" viewBox="0 0 ${data.previewSize.width} ${data.previewSize.height}" preserveAspectRatio="none" aria-label="上传前框选景物"></svg>`:''}</div>`:'<div class="upload-symbol" aria-hidden="true">✂</div>';
      main=`<div class="upload-zone ${preview?'has-photo':''}">${picture}${data.selectionMode?'<p class="seg-box-hint">拖出选框，包住想留下的景物。</p>':''}<label class="button outline">${preview?'更换照片':'选择照片'}<input id="seg-photo" type="file" accept="image/jpeg,image/png,image/webp" hidden ${pending?'disabled':''}></label><p>${esc(data.file?.name||'尚未选择照片')}</p><div class="seg-upload-actions"><button class="button outline" data-action="seg-pick-box" aria-pressed="${data.selectionMode}" ${pending||!preview?'disabled':''}>${data.selectionMode?'取消框选':'框选具体景物'}</button><button class="button dark" data-action="seg-upload" ${pending||!data.file||!data.health?.liveAvailable?'disabled':''}>${pending?'正在提交…':data.selectionMode?'上传并框选抠图':'上传并自动抠图'}</button></div></div>`;
      main+='<details class="seg-help"><summary>操作说明</summary><p>直接上传可自动抠图；只想留下某个景物，可以先框选。结果返回后，可用手动修边恢复或擦除内容。</p></details>';
    }else if(!s){
      main=`<div class="upload-zone"><div class="upload-symbol">✂</div><h2>先把流程走一遍</h2><p>用三个合成形状验证候选、修正和收藏。<br>不使用个人照片，不验证 AI 提取效果。</p><button class="button dark" data-action="seg-start" ${pending?'disabled':''}>${pending?'正在准备…':'开始模拟流程'}</button></div>`;
      aside='<div class="eyebrow">WORKSHOP TEST</div><h3>每一步，<br>都能看清楚。</h3><p>百度真实测试尚未启用。当前测试图和蒙版由本机程序制作，没有识别照片。</p><p>真实自动发现和自动贴边仍待模型验收。</p>';
    }else if(data.stage===2){
      const item=data.results[data.preview];
      main=`<div class="preview-stage"><img id="seg-sticker-preview" src="${esc(item.url)}" alt="${esc(item.name)}"></div><div class="preview-switch">${data.results.map((r,i)=>`<button data-action="seg-preview" data-index="${i}" class="${i===data.preview?'active':''}" aria-label="预览${real?'':'模拟'}贴纸 ${i+1}"><img src="${esc(r.url)}" alt="${esc(r.name)}"></button>`).join('')}</div>`;
      aside=`<div class="eyebrow">02 — MAKE IT YOURS</div><h3>确认后，<br>再存入素材。</h3><label class="field"><span>贴纸名称</span><input id="seg-name" maxlength="30" value="${esc(item.name)}"></label><div class="range-label"><span>这一枚的白边</span><span>${item.border}px</span></div><input id="seg-border" type="range" min="0" max="10" value="${item.border}" aria-label="这一枚的白边"><p>白边已合成进 PNG，只改变当前贴纸，不调用模型。</p><button class="button primary" data-action="seg-save" ${pending?'disabled':''}>保存 ${data.results.length} 枚${real?'':'模拟'}贴纸</button><button class="button outline save-use" data-action="seg-use" ${pending?'disabled':''}>保存并用于创作</button>${button('back','返回候选',pending)}`;
    }else if(real){
      const c=data.candidates[0];
      main=`<div class="seg-source seg-main-photo ${c?'seg-result-stage seg-candidate':''}" style="aspect-ratio:${s.width}/${s.height};--photo-ratio:${s.width/s.height}"><img id="${c?'seg-cutout':'seg-source'}" src="${c?(corrected(c)?.url||media(c.transparentRef)):media(s.objectKey)}" alt="${c?'抠图后的透明贴纸':'正在处理的照片'}"></div>${c?`<div class="seg-result-actions"><button class="button outline" data-action="seg-retouch-open" data-id="${c.candidateId}" ${pending?'disabled':''}>手动修边${corrected(c)?' · 已修正':''}</button><button class="button primary" data-action="seg-confirm" ${pending||!data.selected.size?'disabled':''}>确认透明贴纸</button></div>`:''}`;
    }else{
      main=`<div class="seg-source" style="aspect-ratio:${s.width}/${s.height}"><img id="seg-source" src="${media(s.objectKey)}" alt="${real?'本张获准处理的照片':'合成测试图，三个彩色几何形状，不是照片'}">${real?'':`<svg id="seg-prompts" viewBox="0 0 ${s.width} ${s.height}" preserveAspectRatio="none" aria-label="小剪刀提示区域"></svg>`}</div><div class="seg-candidates">${data.candidates.map(c=>`<article class="seg-candidate ${data.selected.has(c.candidateId)?'chosen':''}"><button class="seg-pick" data-action="seg-select" data-id="${c.candidateId}" aria-pressed="${data.selected.has(c.candidateId)}" ${pending?'disabled':''}><img src="${corrected(c)?.url||media(c.transparentRef)}" alt="${esc(c.name)}"><span>${esc(c.name)}</span><small>${data.selected.has(c.candidateId)?'已选中':'选择'}</small></button>${real?'':`<button class="text-link" data-action="seg-target" data-id="${c.candidateId}" ${pending?'disabled':''}>修正这一枚</button>`}<button class="text-link" data-action="seg-retouch-open" data-id="${c.candidateId}" ${pending?'disabled':''}>手动修边${corrected(c)?' · 已修正':''}</button></article>`).join('')}</div>`;
      aside=`<div class="eyebrow">01 — PICK YOUR MOMENTS</div><h3>${data.target?'修正这一枚':'把遗漏的，也带上。'}</h3><p>模拟首次返回两个候选，第三个形状用于练习补提。用小剪刀圈一圈，或标记要保留的位置。</p><div class="seg-tools">${[['outline','✂ 小剪刀'],['positive','保留点'],['negative','排除点']].map(([v,t])=>`<button class="chip ${data.tool===v?'active':''}" data-action="seg-tool" data-tool="${v}" ${pending?'disabled':''}>${t}</button>`).join('')}${button('undo','撤销提示',pending)}${button('clear','清除提示',pending)}</div><p>${data.target?'正在修正选定候选；其他候选保留。':'当前为补提新对象。'}<br>测试程序只演示提示传递，点和圈线不证明真实自动贴边。</p><div class="seg-actions">${button('refine',data.target?'提交模拟修正':'补提模拟对象',pending)}${data.target?button('add','改为补提',pending):''}${button('auto','重新模拟发现',pending)}</div><p>已选择 ${data.selected.size} 枚</p><button class="button primary" data-action="seg-confirm" ${pending||!data.selected.size?'disabled':''}>确认透明贴纸</button>${button('new','换一张测试图',pending)}`;
    }
    const stateText=data.job?({queued:'等待处理',running:real?'百度正在处理':'正在处理模拟任务',succeeded:real?'百度结果已返回，请检查边缘':'模拟任务完成',failed:'任务未完成',cancelled:'任务已取消',expired:'临时结果已过期'}[data.job.status]):'';
    const compact=real&&!retouch&&data.stage!==2;
    const status=stateText&&!(real&&data.job?.status==='succeeded')?`<div class="seg-status" role="status">${esc(stateText)} ${['queued','running'].includes(data.job?.status)?button('cancel','取消任务'):''}</div>`:'';
    bridge.shell(`${real?'':`<div class="page-heading"><div><h1>贴纸工坊<span style="color:var(--accent)">.</span></h1><p>从一张照片，到一枚舍不得丢的小收藏。</p></div></div><div class="seg-notice" role="note"><b>${real?'百度智能抠图 · 能力试验':'模拟流程测试 · 非 AI 分割'}</b><span>${real?'先预览和框选，再制作贴纸。':'仅本机合成图，未上传照片、未调用模型。'}</span></div>`}${status}${data.error?`<div class="seg-error" role="alert">${esc(data.error)} ${s?button('restore','查询原任务'):''}</div>`:''}<div class="workshop-layout ${compact?'seg-workspace':''}"><div>${main}</div>${aside?`<aside class="workshop-aside">${aside}${real?'':`<div class="note-rule"></div>${button('exit','返回本地小剪刀',pending)}`}</aside>`:''}</div>`,'贴纸工坊');
    bindPrompts();mountRetouch(pending);
  }
  function paint() {
    const svg=document.querySelector('#seg-prompts'),size=data.session||data.previewSize;if(!svg||!size)return;
    const {width:w,height:h}=size;
    if(live()){
      const b=data.box;svg.innerHTML=b?`<rect x="${b.x*w}" y="${b.y*h}" width="${b.width*w}" height="${b.height*h}" fill="#44674118" stroke="#446741" stroke-width="2"/>`:'';return;
    }
    svg.innerHTML=`${data.outline.length?`<polyline points="${data.outline.map(p=>`${p.x*w},${p.y*h}`).join(' ')}" fill="none" stroke="#c65740" stroke-width="2"/>`:''}${[['positive','#446741'],['negative','#b44738']].map(([key,color])=>data[key].map(p=>`<circle cx="${p.x*w}" cy="${p.y*h}" r="5" fill="${color}" stroke="white" stroke-width="2"/>`).join('')).join('')}`;
  }
  function bindPrompts() {
    const svg=document.querySelector('#seg-prompts');if(!svg)return;paint();let active=null,points=[],last=[];
    const point=e=>{const r=svg.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};};
    if(live()){
      let anchor=null,previous=null;
      svg.onpointerdown=e=>{if(busy()||e.button!==0||active!==null)return;active=e.pointerId;svg.setPointerCapture(active);anchor=point(e);previous=data.box;data.box=null;paint();e.preventDefault();};
      svg.onpointermove=e=>{if(e.pointerId!==active)return;const p=point(e);data.box={x:Math.min(anchor.x,p.x),y:Math.min(anchor.y,p.y),width:Math.abs(p.x-anchor.x),height:Math.abs(p.y-anchor.y)};paint();};
      svg.onpointerup=e=>{if(e.pointerId!==active)return;svg.onpointermove(e);active=null;paint();if(data.error&&!data.session){data.error='';draw();}};
      svg.onpointercancel=()=>{active=null;data.box=previous;paint();};return;
    }
    svg.onpointerdown=e=>{
      if(busy()||e.button!==0||active!==null)return;active=e.pointerId;svg.setPointerCapture(e.pointerId);points=[point(e)];last=data.outline;
      if(data.tool==='outline')data.outline=points;else data[data.tool].push(points[0]);paint();e.preventDefault();
    };
    svg.onpointermove=e=>{if(e.pointerId!==active||data.tool!=='outline')return;const p=point(e),old=points.at(-1);if(Math.hypot(p.x-old.x,p.y-old.y)>.004&&points.length<2048)points.push(p);paint();};
    svg.onpointerup=e=>{if(e.pointerId!==active)return;active=null;if(data.tool==='outline'){if(points.length<3)data.outline=[...last,...points];else data.outline=points;}paint();};
    svg.onpointercancel=()=>{active=null;data.outline=last;paint();};
  }
  function accept(job) {
    data.job=job;
    if(job.status==='succeeded'){
      if(job.kind==='auto')data.candidates=job.candidates||[];
      else data.candidates=[...data.candidates.filter(c=>c.candidateId!==job.input.targetCandidateId),...(job.candidates||[])];
      data.selected=new Set([...data.selected].filter(id=>data.candidates.some(c=>c.candidateId===id)));
      for(const c of job.candidates||[])data.selected.add(c.candidateId);
      data.session.promptRevision=Math.max(data.session.promptRevision||0,job.input.promptRevision||0);
      data.target=null;data.box=null;data.outline=[];data.positive=[];data.negative=[];
    }else if(job.error)data.error=job.error.message;
  }
  async function poll(jobId,generation) {
    clearTimeout(pollId);
    if(generation!==data.generation||!data.active)return;
    try {
      const result=await api('/jobs/'+jobId);
      if(generation!==data.generation)return;accept(result);draw();
      if(['queued','running'].includes(result.status))pollId=setTimeout(()=>poll(jobId,generation),350);
    }catch(e){if(generation===data.generation){data.error=e.message;draw();}}
  }
  function resetCompletedRound(){
    data.generation++;clearTimeout(pollId);clearPreview();
    for(const r of data.results)URL.revokeObjectURL(r.url);
    for(const c of corrections.values())URL.revokeObjectURL(c.url);
    corrections.clear();nameDrafts.clear();operations={};
    Object.assign(data,{session:null,job:null,file:null,selectionMode:false,box:null,candidates:[],selected:new Set(),target:null,outline:[],positive:[],negative:[],stage:1,results:[],preview:0,error:''});
  }
  async function restore() {
    const g=data.generation;
    const health=await api('/health');
    if(g!==data.generation)return;data.health=health;data.mode=health.mode;
    const value=await api('/session');
    if(g!==data.generation)return;
    if(value.session&&bridge.completed?.(value.session.imageSessionId)){
      resetCompletedRound();
    }else if(value.session){
      data.session=value.session;data.candidates=value.session.candidates;data.selected=new Set(data.candidates.map(c=>c.candidateId));
      try {const saved=JSON.parse(localStorage.getItem('shiye-seg-origin')||'null');if(saved?.imageSessionId===data.session.imageSessionId)bridge.restoreOrigin(saved.origin);}catch{}
      await loadCorrections();
      data.job=value.job||null;
      if(value.job){if(['queued','running'].includes(value.job.status))poll(value.job.jobId,g);}
    }else{data.session=null;data.job=null;data.candidates=[];data.selected.clear();data.stage=1;}
    draw();
  }
  async function start() {
    const operationId=operations.upload||=makeId();
    await api('/session');
    data.session=await api('/uploads/photo/init',{operationId,fixture:true});
    delete operations.upload;data.candidates=[];data.selected.clear();data.stage=1;data.job=null;persistOrigin();
    await submit('auto');
  }
  async function uploadPhoto() {
    if(!live()||!data.health?.liveAvailable||!data.file)throw Error('请先选择照片。');
    if(data.file.size>10*1024*1024)throw Error('图片不能超过 10 MB。');
    const kind=data.selectionMode?'refine':'auto';
    if(kind==='refine'){
      const b=data.box,size=data.previewSize,scale=Math.min(1,2000/Math.max(size.width,size.height));
      if(!b||b.width*size.width*scale<10||b.height*size.height*scale<10)throw Error('请先在照片上框出完整的景物，选框不能太小。');
    }
    await api('/session');
    const response=await fetch('/api/uploads/photo',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Shiye-Operation-Id':operations.upload||=makeId()},body:data.file,signal:AbortSignal.timeout(30000)});
    let value;try{value=await response.json();}catch{throw Error('上传未完成，请保留照片后重试。');}
    if(!response.ok)throw Error(value.error?.message||'上传未完成。');
    data.session=value;data.file=null;clearPreview();delete operations.upload;data.candidates=[];data.selected.clear();data.target=null;data.stage=1;data.job=null;persistOrigin();
    await submit(kind);
  }
  function clearPreview(){if(data.previewUrl)URL.revokeObjectURL(data.previewUrl);data.previewUrl=null;data.previewSize=null;}
  async function choosePhoto(file){
    const version=++fileVersion;clearPreview();data.file=null;data.box=null;data.selectionMode=false;data.error='';delete operations.upload;
    if(!file){draw();return;}
    data.busy=true;draw();
    try{
      if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('格式不支持');
      if(file.size>10*1024*1024)throw Error('图片不能超过 10 MB。');
      const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'}),size={width:bitmap.width,height:bitmap.height};bitmap.close();
      if(version!==fileVersion)return;
      data.file=file;data.previewSize=size;data.previewUrl=URL.createObjectURL(file);
    }catch(e){if(version===fileVersion)data.error=e.message.includes('10 MB')?e.message:'这张图片无法读取，请选择静态 JPG、PNG 或 WebP，大小不超过 10 MB。';}
    finally{if(version===fileVersion){data.busy=false;draw();}}
  }
  async function submit(kind) {
    if(!data.session)return;
    const s=data.session;
    const body={imageSessionId:s.imageSessionId,objectKey:s.objectKey,sourceRevision:s.sourceRevision};
    if(kind==='refine'){
      if(live()){if(!data.box?.width||!data.box?.height)throw Error('请先拖出一个完整包住主体的框。');body.box=data.box;}
      if(!live()&&data.outline.length<3&&!data.positive.length)throw Error('请先粗圈选，或标记至少一个保留点。');
      Object.assign(body,{promptRevision:(s.promptRevision||0)+1});
      if(data.target){const c=data.candidates.find(c=>c.candidateId===data.target);Object.assign(body,{targetCandidateId:c.candidateId,candidateRevision:c.candidateRevision});}
      if(data.outline.length>=3)body.outlinePoints=data.outline;
      if(data.positive.length)body.positivePoints=data.positive;
      if(data.negative.length)body.negativePoints=data.negative;
    }
    const fingerprint=JSON.stringify({kind,body});
    if(operations.task?.fingerprint!==fingerprint)operations.task={fingerprint,id:makeId()};
    body.operationId=operations.task.id;
    const job=await api(kind==='auto'?'/segmentation/jobs':'/segmentation/refine',body);
    delete operations.task;data.job=job;draw();poll(job.jobId,data.generation);
  }
  async function imageFrom(blob) {
    return createImageBitmap(blob);
  }
  async function bordered(base, size) {
    const img=await imageFrom(base),c=document.createElement('canvas');c.width=img.width+size*2;c.height=img.height+size*2;
    const ctx=c.getContext('2d');
    if(size){
      const alpha=document.createElement('canvas');alpha.width=img.width;alpha.height=img.height;
      const a=alpha.getContext('2d');a.drawImage(img,0,0);a.globalCompositeOperation='source-in';a.fillStyle='#fffdf6';a.fillRect(0,0,alpha.width,alpha.height);
      for(let x=-size;x<=size;x++)for(let y=-size;y<=size;y++)if(x*x+y*y<=size*size)ctx.drawImage(alpha,x+size,y+size);
    }
    ctx.drawImage(img,size,size);img.close();
    return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve({blob:b,width:c.width,height:c.height}):reject(Error('无法生成透明 PNG。')),'image/png'));
  }
  async function makeResults() {
    const results=[];
    for(const c of data.candidates.filter(c=>data.selected.has(c.candidateId))){
      const edit=corrected(c);let base=edit?.blob;
      if(!base){const response=await fetch(media(c.transparentRef));if(!response.ok)throw Error('临时结果已不可用，请重新处理。');base=await response.blob();}
      const out=await bordered(base,4);
      const draft=nameDrafts.get(correctionKey(c));
      results.push({id:makeId(),nameKey:correctionKey(c),nameEdited:!!draft,name:draft?.name??(c.mock?c.name+'（模拟）':'照片贴纸'),category:'照片',base,blob:out.blob,url:URL.createObjectURL(out.blob),border:4,width:out.width,height:out.height,provenance:{mock:c.mock,provider:c.mock?'mock':'baidu',providerRequestId:c.providerRequestId,imageSessionId:c.imageSessionId,sourceRevision:c.sourceRevision,candidateId:c.candidateId,candidateRevision:c.candidateRevision,...(edit?{localRetouch:{version:1,editedAt:edit.editedAt}}:{})}});
    }
    for(const r of data.results)URL.revokeObjectURL(r.url);
    data.results=results;data.preview=0;data.stage=2;
    for(const item of results)if(!item.nameEdited&&!item.provenance.mock&&data.health?.namingAvailable)void autoName(item);
  }
  async function autoName(item){
    try{
      const bitmap=await createImageBitmap(item.base),canvas=document.createElement('canvas');canvas.width=canvas.height=640;
      const ctx=canvas.getContext('2d'),scale=Math.min(600/bitmap.width,600/bitmap.height);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,640,640);ctx.drawImage(bitmap,(640-bitmap.width*scale)/2,(640-bitmap.height*scale)/2,bitmap.width*scale,bitmap.height*scale);bitmap.close();
      const body=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.85));if(!body||!data.results.includes(item)||item.nameEdited)return;
      const p=item.provenance,response=await fetch(`/api/stickers/name/${p.imageSessionId}/${p.candidateId}/${p.candidateRevision}`,{method:'POST',headers:{'Content-Type':'image/jpeg'},body,signal:AbortSignal.timeout(12_000)});
      if(!response.ok)return;const value=await response.json();
      if(!data.results.includes(item)||item.nameEdited||typeof value.name!=='string'||!value.name.trim())return;
      item.name=value.name.trim().slice(0,30);
      const input=document.querySelector('#seg-name');if(data.stage===2&&data.results[data.preview]===item&&input)input.value=item.name;
    }catch{/* Naming must not interrupt sticker editing or saving. */}
  }
  async function act(action,element) {
    data.error='';
    if(action==='retouch-open'){const c=data.candidates.find(c=>c.candidateId===element.dataset.id);if(c)await openRetouch(c);return;}
    if(action==='retouch-tool'){if(retouch&&!retouch.editor.drawing)retouch.editor.tool=element.dataset.tool;return;}
    if(action==='retouch-undo'){retouch?.editor.undo();return;}
    if(action==='retouch-redo'){retouch?.editor.redo();return;}
    if(action==='retouch-reset'){retouch?.editor.reset();return;}
    if(action==='retouch-cancel'){leaveRetouch();return;}
    if(action==='retouch-apply'){
      if(!retouch)return;const {candidate:c,editor}=retouch,out=await editor.export(),key=correctionKey(c);
      if(c.expiresAt<=Date.now())throw Error('临时修正记录已到期，请重新选择照片。');
      const value={key,...out,expiresAt:c.expiresAt,editedAt:Date.now()};await storeCorrection(value);
      const old=corrections.get(key);if(old)URL.revokeObjectURL(old.url);corrections.set(key,{...value,url:URL.createObjectURL(value.blob)});
      data.selected.add(c.candidateId);editor.dispose();retouch=null;return;
    }
    if(action==='open'){data.active=true;draw();data.booted=true;await restore();return;}
    if(action==='select'){const id=element.dataset.id;data.selected.has(id)?data.selected.delete(id):data.selected.add(id);return;}
    if(action==='tool'){data.tool=element.dataset.tool;return;}
    if(action==='target'){data.target=element.dataset.id;data.box=null;data.outline=[];data.positive=[];data.negative=[];return;}
    if(action==='add'){data.target=null;return;}
    if(action==='clear'){data.box=null;data.outline=[];data.positive=[];data.negative=[];return;}
    if(action==='undo'){const a=data.tool==='outline'?data.outline:data[data.tool];a.pop();return;}
    if(action==='preview'){data.preview=Number(element.dataset.index);return;}
    if(action==='back'){data.stage=1;return;}
    if(action==='exit'){if(!leaveRetouch())return;data.active=false;data.generation++;clearTimeout(pollId);bridge.renderLegacy();return;}
    if(action==='cancel'){data.generation++;clearTimeout(pollId);data.job=await api('/jobs/'+data.job.jobId+'/cancel',{operationId:makeId()});return;}
    if(action==='restore'){await restore();return;}
    if(action==='pick-box'){data.selectionMode=!data.selectionMode;data.box=null;return;}
    if(action==='upload'){data.generation++;await uploadPhoto();return;}
    if(action==='new'&&live()){data.generation++;clearTimeout(pollId);data.session=null;data.job=null;data.box=null;data.file=null;data.selectionMode=false;clearPreview();delete operations.upload;return;}
    if(action==='start'||action==='new'){data.generation++;clearTimeout(pollId);await start();return;}
    if(action==='auto'||action==='refine'){await submit(action);return;}
    if(action==='confirm'){await makeResults();return;}
    if(action==='save'||action==='use'){
      const ok=await bridge.save(data.results,action==='use');
      if(ok){data.active=false;resetCompletedRound();}
    }
  }
  document.addEventListener('click',async e=>{
    const el=e.target.closest('[data-action^="seg-"]');if(!el)return;
    const action=el.dataset.action.slice(4);if(el.disabled||data.busy||retouch?.editor.drawing)return;
    const immediate=['retouch-tool','retouch-undo','retouch-redo','retouch-reset','retouch-cancel','pick-box','select','tool','target','add','clear','undo','preview','back','exit'];
    data.busy=!immediate.includes(action);draw();
    try {await act(action,el);}catch(error){data.error=error.message;}
    finally{data.busy=false;draw();}
  });
  document.addEventListener('input',e=>{if(e.target.id==='seg-name'){const item=data.results[data.preview];if(!item)return;item.nameEdited=true;item.name=e.target.value;nameDrafts.set(item.nameKey,{name:item.name});}});
  document.addEventListener('change',e=>{if(e.target.id==='seg-name'){const item=data.results[data.preview];item.name=e.target.value.trim()||(live()?'照片贴纸':'模拟贴纸');if(item.nameEdited)nameDrafts.set(item.nameKey,{name:item.name});}});
  document.addEventListener('change',e=>{
    if(e.target.id==='seg-retouch-view'&&retouch){retouch.editor.view=e.target.value;draw();}
    if(e.target.id==='seg-retouch-zoom'&&retouch){retouch.editor.zoom=Number(e.target.value);draw();}
    if(e.target.id==='seg-photo')void choosePhoto(e.target.files?.[0]||null);
  });
  document.addEventListener('input',async e=>{
    if(e.target.id==='seg-retouch-size'&&retouch){retouch.editor.size=Number(e.target.value);document.querySelector('#seg-brush-value').textContent=e.target.value;return;}
    if(e.target.id!=='seg-border')return;
    const index=data.preview,item=data.results[index],version=++data.borderVersion;
    data.busy=true;
    try {
      const size=Number(e.target.value),out=await bordered(item.base,size);
      if(version!==data.borderVersion)return;
      URL.revokeObjectURL(item.url);Object.assign(item,{border:size,blob:out.blob,url:URL.createObjectURL(out.blob),width:out.width,height:out.height});
    }catch(error){data.error=error.message;}finally{if(version===data.borderVersion){data.busy=false;draw();}}
  });
  return { get active(){return data.active;},get busy(){return data.busy;},render:draw,
    back(){
      if(data.busy||retouch?.editor.drawing)return;
      if(retouch){leaveRetouch();draw();return;}
      if(data.stage===2){data.stage=1;draw();return;}
      if(live()&&data.session){data.generation++;clearTimeout(pollId);data.session=null;data.job=null;data.candidates=[];data.selected.clear();data.box=null;data.file=null;data.selectionMode=false;data.error='';clearPreview();delete operations.upload;draw();return;}
      data.active=false;data.generation++;clearTimeout(pollId);bridge.renderLegacy();
    }
  };
};

// Local alpha editing: original RGB stays intact; no provider requests are made here.
function createLocalMaskEditor(source, providerMask, savedMask) {
  const width=source.width,height=source.height;
  if(providerMask.width!==width||providerMask.height!==height||savedMask&&(savedMask.width!==width||savedMask.height!==height))throw Error('图片与修正范围不一致，请返回重新选择。');
  const canvas=document.createElement('canvas'),mask=document.createElement('canvas'),initial=document.createElement('canvas');
  for(const c of [canvas,mask,initial]){c.width=width;c.height=height;}
  canvas.id='seg-retouch-canvas';canvas.tabIndex=0;canvas.setAttribute('aria-label','手动修边画布，拖动恢复或擦除，支持撤销');
  const ctx=canvas.getContext('2d'),m=mask.getContext('2d',{willReadFrequently:true}),ic=initial.getContext('2d');
  ic.drawImage(providerMask,0,0);const pixels=ic.getImageData(0,0,width,height);
  for(let i=0;i<pixels.data.length;i+=4){const a=pixels.data[i];pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=255;pixels.data[i+3]=a;}
  ic.putImageData(pixels,0,0);m.drawImage(savedMask||initial,0,0);
  const undo=[],redo=[];let active=null,last=null,tiles=null,historyBytes=0,frame=0;
  const editor={canvas,enabled:true,tool:'restore',size:Math.max(10,Math.round(width*.025)),zoom:1,view:'result',changed:false,onchange:()=>{},get drawing(){return active!==null;},get canUndo(){return undo.length>0;},get canRedo(){return redo.length>0;}};
  function paint(){frame=0;ctx.clearRect(0,0,width,height);ctx.globalCompositeOperation='source-over';ctx.drawImage(source,0,0);if(editor.view!=='source'){ctx.globalCompositeOperation='destination-in';ctx.drawImage(editor.view==='initial'?initial:mask,0,0);ctx.globalCompositeOperation='source-over';}}
  function render(){if(!frame)frame=requestAnimationFrame(paint);}
  const alpha=(image)=>{const a=new Uint8ClampedArray(image.data.length/4);for(let i=0;i<a.length;i++)a[i]=image.data[i*4+3];return a;};
  function put(t,bytes){const image=m.createImageData(t.w,t.h);for(let i=0;i<bytes.length;i++){image.data[i*4]=image.data[i*4+1]=image.data[i*4+2]=255;image.data[i*4+3]=bytes[i];}m.putImageData(image,t.x,t.y);}
  function remember(a,b){const radius=editor.size/2+2,x0=Math.max(0,Math.floor((Math.min(a.x,b.x)-radius)/128)),y0=Math.max(0,Math.floor((Math.min(a.y,b.y)-radius)/128));
    const x1=Math.min(Math.ceil(width/128)-1,Math.floor((Math.max(a.x,b.x)+radius)/128)),y1=Math.min(Math.ceil(height/128)-1,Math.floor((Math.max(a.y,b.y)+radius)/128));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const key=x+','+y;if(tiles.has(key))continue;const t={x:x*128,y:y*128,w:Math.min(128,width-x*128),h:Math.min(128,height-y*128)};t.before=alpha(m.getImageData(t.x,t.y,t.w,t.h));tiles.set(key,t);}
  }
  function stroke(a,b){remember(a,b);m.globalCompositeOperation=editor.tool==='erase'?'destination-out':'source-over';m.fillStyle=m.strokeStyle='#fff';m.lineWidth=editor.size;m.lineCap=m.lineJoin='round';m.beginPath();m.moveTo(a.x,a.y);m.lineTo(b.x,b.y);m.stroke();m.beginPath();m.arc(b.x,b.y,editor.size/2,0,Math.PI*2);m.fill();m.globalCompositeOperation='source-over';render();}
  const point=e=>{const r=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(width,(e.clientX-r.left)*width/r.width)),y:Math.max(0,Math.min(height,(e.clientY-r.top)*height/r.height))};};
  function finish(cancel=false){if(active===null)return;active=null;if(tiles){if(cancel){for(const t of tiles.values())put(t,t.before);}else{
    const entry=[];for(const t of tiles.values()){t.after=alpha(m.getImageData(t.x,t.y,t.w,t.h));if(t.before.some((v,i)=>v!==t.after[i]))entry.push(t);}
    if(entry.length){for(const e of redo)historyBytes-=e.bytes;redo.length=0;entry.bytes=entry.reduce((s,t)=>s+t.before.length+t.after.length,0);undo.push(entry);historyBytes+=entry.bytes;while(undo.length>1&&(undo.length>30||historyBytes>16*1024*1024))historyBytes-=undo.shift().bytes;editor.changed=true;}
  }}tiles=null;render();editor.onchange();}
  canvas.onpointerdown=e=>{if(!editor.enabled||active!==null||e.button!==0||editor.view!=='result'&&editor.tool!=='pan')return;active=e.pointerId;canvas.setPointerCapture(active);canvas.focus({preventScroll:true});if(editor.tool==='pan'){last={x:e.clientX,y:e.clientY};return;}tiles=new Map();last=point(e);stroke(last,last);e.preventDefault();};
  canvas.onpointermove=e=>{if(e.pointerId!==active)return;if(editor.tool==='pan'){canvas.parentElement.parentElement.scrollBy(last.x-e.clientX,last.y-e.clientY);last={x:e.clientX,y:e.clientY};return;}const p=point(e);stroke(last,p);last=p;e.preventDefault();};
  canvas.onpointerup=e=>{if(e.pointerId!==active)return;canvas.onpointermove(e);finish();};canvas.onpointercancel=e=>{if(e.pointerId===active)finish(true);};canvas.onlostpointercapture=e=>{if(e.pointerId===active)finish(true);};
  editor.undo=()=>{if(active!==null)return;const e=undo.pop();if(e){for(const t of e)put(t,t.before);redo.push(e);render();editor.onchange();}};
  editor.redo=()=>{if(active!==null)return;const e=redo.pop();if(e){for(const t of e)put(t,t.after);undo.push(e);render();editor.onchange();}};
  canvas.onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.stopPropagation();e.shiftKey?editor.redo():editor.undo();}};
  editor.reset=()=>{if(active!==null)return;active=-1;tiles=new Map();remember({x:0,y:0},{x:width,y:height});m.clearRect(0,0,width,height);m.drawImage(initial,0,0);finish();};
  editor.render=render;
  editor.export=async()=>{
    if(active!==null)throw Error('请先结束当前笔画。');
    const result=document.createElement('canvas');result.width=width;result.height=height;const r=result.getContext('2d');r.drawImage(source,0,0);r.globalCompositeOperation='destination-in';r.drawImage(mask,0,0);
    const rgba=r.getImageData(0,0,width,height).data;let left=width,top=height,right=-1,bottom=-1;
    for(let i=3;i<rgba.length;i+=4)if(rgba[i]){const p=(i-3)/4,x=p%width,y=Math.floor(p/width);left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
    if(right<left)throw Error('已经全部擦除了，请恢复一些内容后再应用。');
    const crop=document.createElement('canvas');crop.width=right-left+1;crop.height=bottom-top+1;crop.getContext('2d').drawImage(result,left,top,crop.width,crop.height,0,0,crop.width,crop.height);
    const blob=c=>new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('无法保存修正，请重试。')),'image/png'));
    return {blob:await blob(crop),mask:await blob(mask),width:crop.width,height:crop.height};
  };
  editor.dispose=()=>{cancelAnimationFrame(frame);source.close();providerMask.close();savedMask?.close();undo.length=redo.length=0;canvas.width=mask.width=initial.width=1;};
  paint();return editor;
}
