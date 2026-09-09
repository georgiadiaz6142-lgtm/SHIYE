'use strict';

// One workshop, explicit mock/live provenance; live upload requires both server approval and file consent.
window.ShiyeSegmentation = function createWorkshop(bridge) {
  const esc = bridge.esc;
  const media = id => '/api/media/' + encodeURIComponent(id);
  const makeId = () => crypto.randomUUID();
  const data = { active:false, mode:'mock', health:null, file:null, consent:false, box:null, session:null, job:null, candidates:[], selected:new Set(), target:null, tool:'outline', outline:[], positive:[], negative:[], stage:1, results:[], preview:0, busy:false, error:'', generation:0, booted:false, borderVersion:0 };
  let operations = {}, pollId = null;
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
    let main='', aside='';
    if(!s&&real){
      main=`<div class="upload-zone"><div class="upload-symbol">✂</div><h2>从照片里，留下喜欢的。</h2><p>百度自动抠图可能将多个物体合成一张前景。<br>支持静态 JPG、PNG、WebP，最大 10 MB；编码超限会提示。</p><label class="button outline">选择测试照片<input id="seg-photo" type="file" accept="image/jpeg,image/png,image/webp" hidden ${pending?'disabled':''}></label><p>${esc(data.file?.name||'尚未选择照片')}</p><label><input id="seg-consent" type="checkbox" ${data.consent?'checked':''} ${pending?'disabled':''}> 我确认将这张照片发送至百度智能抠图处理</label><p>本机临时图片最多保留 ${Math.round((data.health?.localTtlSeconds||0)/60)} 分钟；百度端保留与删除政策仍待核准。</p><button class="button dark" data-action="seg-upload" ${pending||!data.file||!data.consent||!data.health?.liveAvailable?'disabled':''}>${pending?'正在提交…':'上传并自动抠图'}</button></div>`;
      aside='<div class="eyebrow">BAIDU CUTOUT</div><h3>先看边缘，<br>再决定留下。</h3><p>自动结果是一张前景图。漏提或混在一起的对象，可再框选交给百度处理，每次提交会新增一次请求。</p><p>多主体独立发现与点选纠错尚未通过验证。</p>';
    }else if(!s){
      main=`<div class="upload-zone"><div class="upload-symbol">✂</div><h2>先把流程走一遍</h2><p>用三个合成形状验证候选、修正和收藏。<br>不使用个人照片，不验证 AI 提取效果。</p><button class="button dark" data-action="seg-start" ${pending?'disabled':''}>${pending?'正在准备…':'开始模拟流程'}</button></div>`;
      aside='<div class="eyebrow">WORKSHOP TEST</div><h3>每一步，<br>都能看清楚。</h3><p>百度真实测试尚未启用。当前测试图和蒙版由本机程序制作，没有识别照片。</p><p>真实自动发现和自动贴边仍待模型验收。</p>';
    }else if(data.stage===2){
      const item=data.results[data.preview];
      main=`<div class="preview-stage"><img id="seg-sticker-preview" src="${esc(item.url)}" alt="${esc(item.name)}"></div><div class="preview-switch">${data.results.map((r,i)=>`<button data-action="seg-preview" data-index="${i}" class="${i===data.preview?'active':''}" aria-label="预览${real?'':'模拟'}贴纸 ${i+1}"><img src="${esc(r.url)}" alt="${esc(r.name)}"></button>`).join('')}</div>`;
      aside=`<div class="eyebrow">02 — MAKE IT YOURS</div><h3>确认后，<br>再收入收藏。</h3><label class="field"><span>贴纸名称</span><input id="seg-name" maxlength="30" value="${esc(item.name)}"></label><div class="range-label"><span>这一枚的白边</span><span>${item.border}px</span></div><input id="seg-border" type="range" min="0" max="10" value="${item.border}" aria-label="这一枚的白边"><p>白边已合成进 PNG，只改变当前贴纸，不调用模型。</p><button class="button primary" data-action="seg-save" ${pending?'disabled':''}>收藏 ${data.results.length} 枚${real?'':'模拟'}贴纸</button><button class="button outline save-use" data-action="seg-use" ${pending?'disabled':''}>收藏并用于创作</button>${button('back','返回候选',pending)}`;
    }else{
      main=`<div class="seg-source" style="aspect-ratio:${s.width}/${s.height}"><img id="seg-source" src="${media(s.objectKey)}" alt="${real?'本张获准处理的照片':'合成测试图，三个彩色几何形状，不是照片'}"><svg id="seg-prompts" viewBox="0 0 ${s.width} ${s.height}" preserveAspectRatio="none" aria-label="小剪刀提示区域"></svg></div><div class="seg-candidates">${data.candidates.map(c=>`<article class="seg-candidate ${data.selected.has(c.candidateId)?'chosen':''}"><button class="seg-pick" data-action="seg-select" data-id="${c.candidateId}" aria-pressed="${data.selected.has(c.candidateId)}" ${pending?'disabled':''}><img src="${media(c.transparentRef)}" alt="${esc(c.name)}"><span>${esc(c.name)}</span><small>${data.selected.has(c.candidateId)?'已选中':'选择'}</small></button><button class="text-link" data-action="seg-target" data-id="${c.candidateId}" ${pending?'disabled':''}>修正这一枚</button></article>`).join('')}</div>`;
      if(real)aside=`<div class="eyebrow">01 — PICK YOUR MOMENTS</div><h3>${data.target?'重新框选这一枚':'框住想留下的。'}</h3><p>拖出一个框，尽量完整包住一个主体，再由百度生成贴边蒙版。框只是提示，最终边缘来自模型。</p><p>自动前景可能含多个物体，不代表已分别发现。百度暂不支持保留点、排除点或小剪刀圈线。</p><div class="seg-actions">${button('clear','清除框选',pending)}${button('refine',data.target?'提交框选重提':'框选补提一枚',pending)}${data.target?button('add','改为补提',pending):''}${button('auto','重新自动抠图',pending)}</div><p>每次提交各发起一次百度请求；不会自动重试。${data.target?'其他候选保留。':''}</p><p>已选择 ${data.selected.size} 枚</p><button class="button primary" data-action="seg-confirm" ${pending||!data.selected.size?'disabled':''}>确认透明贴纸</button>${button('new','换一张照片',pending)}`;
      else aside=`<div class="eyebrow">01 — PICK YOUR MOMENTS</div><h3>${data.target?'修正这一枚':'把遗漏的，也带上。'}</h3><p>模拟首次返回两个候选，第三个形状用于练习补提。用小剪刀圈一圈，或标记要保留的位置。</p><div class="seg-tools">${[['outline','✂ 小剪刀'],['positive','保留点'],['negative','排除点']].map(([v,t])=>`<button class="chip ${data.tool===v?'active':''}" data-action="seg-tool" data-tool="${v}" ${pending?'disabled':''}>${t}</button>`).join('')}${button('undo','撤销提示',pending)}${button('clear','清除提示',pending)}</div><p>${data.target?'正在修正选定候选；其他候选保留。':'当前为补提新对象。'}<br>测试程序只演示提示传递，点和圈线不证明真实自动贴边。</p><div class="seg-actions">${button('refine',data.target?'提交模拟修正':'补提模拟对象',pending)}${data.target?button('add','改为补提',pending):''}${button('auto','重新模拟发现',pending)}</div><p>已选择 ${data.selected.size} 枚</p><button class="button primary" data-action="seg-confirm" ${pending||!data.selected.size?'disabled':''}>确认透明贴纸</button>${button('new','换一张测试图',pending)}`;
    }
    const stateText=data.job?({queued:'等待处理',running:real?'百度正在处理':'正在处理模拟任务',succeeded:real?'百度结果已返回，请检查边缘':'模拟任务完成',failed:'任务未完成',cancelled:'任务已取消',expired:'临时结果已过期'}[data.job.status]):'';
    bridge.shell(`<div class="page-heading"><div><h1>贴纸工坊<span style="color:var(--accent)">.</span></h1><p>从一张照片，到一枚舍不得丢的小收藏。</p></div></div><div class="seg-notice" role="note"><b>${real?'百度智能抠图 · 能力试验':'模拟流程测试 · 非 AI 分割'}</b><span>${real?'一张自动前景；框选可补提。真实效果待验收。':'仅本机合成图，未上传照片、未调用模型。'}</span></div><div class="seg-status" role="status">${esc(stateText)} ${['queued','running'].includes(data.job?.status)?button('cancel','取消任务'):''}</div>${data.error?`<div class="seg-error" role="alert">${esc(data.error)} ${button('restore','查询原任务')}</div>`:''}<div class="workshop-layout"><div>${main}</div><aside class="workshop-aside">${aside}<div class="note-rule"></div>${button('exit','返回本地小剪刀',pending)}</aside></div>`,'贴纸工坊');
    bindPrompts();
  }
  function paint() {
    const svg=document.querySelector('#seg-prompts');if(!svg||!data.session)return;
    const {width:w,height:h}=data.session;
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
      svg.onpointerup=e=>{if(e.pointerId!==active)return;svg.onpointermove(e);active=null;paint();};
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
  async function restore() {
    const g=data.generation;
    const health=await api('/health');
    if(g!==data.generation)return;data.health=health;data.mode=health.mode;
    const value=await api('/session');
    if(g!==data.generation)return;
    if(value.session){
      data.session=value.session;data.candidates=value.session.candidates;data.selected=new Set(data.candidates.map(c=>c.candidateId));
      try {const saved=JSON.parse(localStorage.getItem('shiye-seg-origin')||'null');if(saved?.imageSessionId===data.session.imageSessionId)bridge.restoreOrigin(saved.origin);}catch{}
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
    if(!live()||!data.health?.liveAvailable||!data.file||!data.consent)throw Error('请先选择并确认测试照片。');
    if(data.file.size>10*1024*1024)throw Error('图片不能超过 10 MB。');
    await api('/session');
    const response=await fetch('/api/uploads/photo',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Shiye-Operation-Id':operations.upload||=makeId(),'X-Shiye-Baidu-Consent':'true'},body:data.file,signal:AbortSignal.timeout(30000)});
    let value;try{value=await response.json();}catch{throw Error('上传未完成，请保留照片后重试。');}
    if(!response.ok)throw Error(value.error?.message||'上传未完成。');
    data.session=value;data.file=null;data.consent=false;delete operations.upload;data.candidates=[];data.selected.clear();data.stage=1;data.job=null;persistOrigin();
    await submit('auto');
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
      const response=await fetch(media(c.transparentRef));if(!response.ok)throw Error('临时结果已不可用，请重新处理。');
      const base=await response.blob(),out=await bordered(base,4);
      results.push({id:makeId(),name:c.name+(c.mock?'（模拟）':''),category:'照片',base,blob:out.blob,url:URL.createObjectURL(out.blob),border:4,width:out.width,height:out.height,provenance:{mock:c.mock,provider:c.mock?'mock':'baidu',providerRequestId:c.providerRequestId,imageSessionId:c.imageSessionId,sourceRevision:c.sourceRevision,candidateId:c.candidateId,candidateRevision:c.candidateRevision}});
    }
    for(const r of data.results)URL.revokeObjectURL(r.url);
    data.results=results;data.preview=0;data.stage=2;
  }
  async function act(action,element) {
    data.error='';
    if(action==='open'){data.active=true;draw();data.booted=true;await restore();return;}
    if(action==='select'){const id=element.dataset.id;data.selected.has(id)?data.selected.delete(id):data.selected.add(id);return;}
    if(action==='tool'){data.tool=element.dataset.tool;return;}
    if(action==='target'){data.target=element.dataset.id;data.box=null;data.outline=[];data.positive=[];data.negative=[];return;}
    if(action==='add'){data.target=null;return;}
    if(action==='clear'){data.box=null;data.outline=[];data.positive=[];data.negative=[];return;}
    if(action==='undo'){const a=data.tool==='outline'?data.outline:data[data.tool];a.pop();return;}
    if(action==='preview'){data.preview=Number(element.dataset.index);return;}
    if(action==='back'){data.stage=1;return;}
    if(action==='exit'){data.active=false;data.generation++;clearTimeout(pollId);bridge.renderLegacy();return;}
    if(action==='cancel'){data.generation++;clearTimeout(pollId);data.job=await api('/jobs/'+data.job.jobId+'/cancel',{operationId:makeId()});return;}
    if(action==='restore'){await restore();return;}
    if(action==='upload'){data.generation++;await uploadPhoto();return;}
    if(action==='new'&&live()){data.generation++;clearTimeout(pollId);data.session=null;data.job=null;data.box=null;data.file=null;data.consent=false;delete operations.upload;return;}
    if(action==='start'||action==='new'){data.generation++;clearTimeout(pollId);await start();return;}
    if(action==='auto'||action==='refine'){await submit(action);return;}
    if(action==='confirm'){await makeResults();return;}
    if(action==='save'||action==='use'){
      const ok=await bridge.save(data.results,action==='use');
      if(ok){data.active=false;data.generation++;clearTimeout(pollId);}
    }
  }
  document.addEventListener('click',async e=>{
    const el=e.target.closest('[data-action^="seg-"]');if(!el)return;
    const action=el.dataset.action.slice(4);if(el.disabled||data.busy)return;
    const immediate=['select','tool','target','add','clear','undo','preview','back','exit'];
    data.busy=!immediate.includes(action);draw();
    try {await act(action,el);}catch(error){data.error=error.message;}
    finally{data.busy=false;draw();}
  });
  document.addEventListener('change',e=>{if(e.target.id==='seg-name')data.results[data.preview].name=e.target.value.trim()||(live()?'照片贴纸':'模拟贴纸');});
  document.addEventListener('change',e=>{
    if(e.target.id==='seg-photo'){data.file=e.target.files?.[0]||null;data.consent=false;delete operations.upload;draw();}
    if(e.target.id==='seg-consent'){data.consent=e.target.checked;draw();}
  });
  document.addEventListener('input',async e=>{
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
      if(data.busy)return;
      if(data.stage===2){data.stage=1;draw();return;}
      data.active=false;data.generation++;clearTimeout(pollId);bridge.renderLegacy();
    }
  };
};
