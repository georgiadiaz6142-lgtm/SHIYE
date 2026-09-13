'use strict';

// This experiment is attached to the existing scissors and its save flow.
// No uploads, API credentials, model requests, or IndexedDB writes happen here.
window.ShiyeEdge = (() => {
  const sessions = new WeakMap(); let running = null, queued = null, engine = null, requestId = 0;
  const LOAD_TIMEOUT = 60000, COMPUTE_TIMEOUT = 20000;
  function stopEngine(entry, error) {
    if(!entry)return;
    clearTimeout(entry.timer);clearTimeout(entry.pending?.timer);
    entry.worker.terminate();entry.rejectReady(error);entry.pending?.reject(error);entry.pending=null;
    if(engine===entry)engine=null;
  }
  function prepareEngine(w) {
    if(engine?.owner===w)return engine;
    stopEngine(engine,Error('已切换照片'));
    const entry={owner:w,worker:new Worker('edgecut-worker.js?v=20260912-reuse-1'),initialized:false,pending:null,timer:null};
    engine=entry;
    entry.ready=new Promise((resolve,reject)=>{entry.resolveReady=resolve;entry.rejectReady=reject;});
    entry.timer=setTimeout(()=>stopEngine(entry,Error('贴边工具加载超时，请检查网络后重试。照片和选区已保留。')),LOAD_TIMEOUT);
    entry.worker.onerror=()=>stopEngine(entry,Error(entry.initialized?'贴边计算中断，请重试。':'贴边工具加载失败，请检查网络后重试。'));
    entry.worker.onmessage=({data})=>{
      if(engine!==entry)return;
      if(data.type==='ready'){
        clearTimeout(entry.timer);entry.initialized=true;entry.resolveReady();
      }else if(data.type==='load-error'){
        stopEngine(entry,Error('贴边工具初始化失败，请重新加载工具后重试。'));
      }else if(data.type==='result'&&entry.pending?.id===data.id){
        const pending=entry.pending;entry.pending=null;clearTimeout(pending.timer);
        if(data.ok)pending.resolve(data);else pending.reject(Error(data.message||'分割计算失败，请调整选区后重试。'));
      }
    };
    return entry;
  }
  function segment(entry, input) {
    return new Promise((resolve,reject)=>{
      const id=++requestId;
      entry.pending={id,resolve,reject,timer:setTimeout(()=>stopEngine(entry,Error('贴边计算超过 20 秒，请调整选区后重试。照片和上次结果已保留。')),COMPUTE_TIMEOUT)};
      try{entry.worker.postMessage({type:'segment',id,input},[input.rgba.buffer]);}
      catch(error){stopEngine(entry,error);}
    });
  }
  const session = w => { if (!sessions.has(w)) sessions.set(w, { cache: new Map(), confirmed: new Map(), last: new Map(), enabled: true, tool: null, message: '', blocked: null, more: false }); return sessions.get(w); };
  const signature = r => JSON.stringify({ x:r.x, y:r.y, w:r.w, h:r.h, points:r.points, seeds:r.edgeSeeds || [] });
  const current = w => w === workshop && currentView === 'workshop' && w.step === 1 && !segmentedWorkshop?.active;
  const result = (w, r) => {if(!r)return;const s=session(w),key=signature(r),saved=s.confirmed.get(r.edgeId);return s.cache.get(key)||(saved?.key===key?saved.result:undefined);};
  const active = w => w.crops[w.activeCrop ?? w.crops.length - 1];
  const cancel = (release=true) => { if(queued){clearTimeout(queued.timer);queued=null;} if(running||release)stopEngine(engine,Error('已取消本次计算'));running=null; };
  window.addEventListener('pagehide',()=>cancel());
  const button = (action, label, disabled=false, selected=false) => `<button class="chip ${selected?'active':''}" data-action="edge-${action}" ${disabled?'disabled':''}>${label}</button>`;

  function mount(w) {
    const s=session(w),r=active(w);w.crops.forEach(r=>{r.edgeId ||= uid();});
    const cached=result(w,r),busy=running?.w===w,previous=r&&s.last.get(r.edgeId),display=cached||previous;
    if(!r)s.tool=null;
    const generate=document.querySelector('#generate-button'),aside=generate.closest('aside');
    if(!s.enabled){
      const stage=document.querySelector('#crop-stage');
      stage.closest('.workshop-layout').classList.add('manual-crop-workshop');
      const panel=document.createElement('div');panel.id='edge-panel';panel.className='manual-crop-panel';
      const pendingPoints=w.scissorPoints?.length||0;
      panel.innerHTML=`<div class="manual-selection-row"><p id="selected-count">${w.crops.length?`已圈好 ${w.crops.length} 个区域 · 拖动圆点调整边界`:'沿景物点选，或按住画一圈。'}</p>${w.crops.length>1?`<div class="crop-selection-list" role="group" aria-label="选择要调整的区域">${w.crops.map((r,i)=>`<button class="chip ${w.activeCrop===i?'active':''}" data-action="select-crop" data-value="${i}" aria-pressed="${w.activeCrop===i}">选区 ${i+1}</button>`).join('')}</div>`:''}</div><div class="manual-crop-tools" role="group" aria-label="选区操作">${pendingPoints?`<button class="chip" data-action="finish-scissors" ${pendingPoints<3?'disabled':''}>完成圈选</button>`:''}<div class="manual-history"><button class="chip" data-action="undo-crop" ${!w.cropHistory?.length?'disabled':''}>撤销</button><button class="chip" data-action="redo-crop" ${!w.cropFuture?.length?'disabled':''}>恢复撤销</button></div>${w.crops.length>1?'<button class="chip" data-action="delete-crop">移除当前选区</button>':''}<button class="chip manual-clear" data-action="clear-crops" ${!w.crops.length&&!pendingPoints?'disabled':''}>清除选区</button></div><div class="manual-crop-actions"><div class="manual-secondary"><button class="text-link" data-action="edge-enable">返回自动贴边</button><button class="text-link muted" data-action="workshop-reset">换一张照片</button></div></div>`;
      generate.textContent='确认选区，预览贴纸';
      panel.querySelector('.manual-crop-actions').appendChild(generate);
      stage.after(panel);aside.remove();return;
    }
    const selectionList=aside.querySelector('.crop-selection-list');
    const hint=busy?(running.phase==='loading'?'正在准备贴边工具，首次加载可能需要一点时间…':'正在更新边缘…'):s.tool==='keep'?'在漏掉的地方点一下，自动补回来。':s.tool==='remove'?'在多余的地方点一下，自动去掉。':r?'绿色部分会留下。看看有没有多了或少了。':(w.cropMode==='rect'?'拖出一个框，松手后自动贴边。':'大致圈住想留下的东西，不必贴着边缘。');
    aside.innerHTML=`<div id="edge-picked"></div><details class="edge-more" ${s.more?'open':''}><summary>更多调整</summary><div class="edge-more-buttons">${button('range','调整圈选',busy||!r)}${button('redraw','重新圈',busy||!r)}${button('clear','清空修正点',busy||!r?.edgeSeeds?.length)}<button class="chip" data-action="redo-crop" ${busy||!w.cropFuture?.length?'disabled':''}>恢复撤销</button></div></details>`;
    aside.querySelector('details').addEventListener('toggle',e=>{s.more=e.target.open;});
    if(selectionList&&w.crops.length>1)aside.querySelector('details').appendChild(selectionList);
    if(s.confirmed.size){const count=w.crops.filter(r=>s.confirmed.get(r.edgeId)?.key===signature(r)).length;if(count)aside.querySelector('#edge-picked').textContent=`已选好 ${count} 枚，确认后一起收藏。`;}
    const stage=document.querySelector('#crop-stage'),image=document.querySelector('#crop-source');
    const panel=document.createElement('div');panel.className='edge-panel edge-simple';panel.id='edge-panel';
    const canConfirm=!!r&&!!cached&&!busy&&!w.scissorPoints?.length&&w.crops.every(r=>result(w,r));
    const selectionMode=['rect','outline'].includes(w.cropMode)?w.cropMode:(r&&!r.points?'rect':'outline');
    panel.innerHTML=`<div class="edge-selection-tools" role="group" aria-label="选取方式"><button class="chip ${selectionMode==='rect'&&!s.tool?'active':''}" data-action="crop-mode" data-value="rect" aria-pressed="${selectionMode==='rect'&&!s.tool}" ${busy?'disabled':''}>框选</button><button class="chip ${selectionMode==='outline'&&!s.tool?'active':''}" data-action="crop-mode" data-value="outline" aria-pressed="${selectionMode==='outline'&&!s.tool}" ${busy?'disabled':''}>✂ 圈选</button>${button('disable','手工裁切',busy)}</div><div class="edge-main-actions">${r?`${button('keep','少了，补回来',busy,s.tool==='keep')}${button('remove','多了，去掉',busy,s.tool==='remove')}<button class="button primary" data-action="edge-confirm" ${!canConfirm?'disabled':''}>满意，做成贴纸</button>`:(w.scissorPoints?.length>=3?button('finish','圈好了'): '')}</div><div class="edge-help"><span role="status" id="edge-status">${esc(s.blocked&&r&&s.blocked===signature(r)?s.message:hint)}</span><button class="text-link" data-action="undo-crop" ${!w.cropHistory?.length?'disabled':''}>撤销</button>${busy?button('cancel','取消'):''}${r&&s.blocked===signature(r)?button('run','再试一次'):''}</div>${busy&&previous?'<small class="edge-previous-note">暂时显示上一次结果，完成后更新。</small>':''}`;
    stage.closest('.workshop-layout').classList.add('edge-workshop');
    const photoTools=document.createElement('div');photoTools.className='edge-photo-tools';
    photoTools.innerHTML='<button class="text-link muted edge-change-photo" data-action="workshop-reset">换一张照片</button>';
    stage.before(photoTools);
    panel.appendChild(aside.querySelector('#edge-picked'));
    panel.appendChild(aside.querySelector('.edge-more'));
    aside.classList.add('edge-sidebar');aside.setAttribute('aria-label','照片修边工具');aside.replaceChildren(panel);
    const overlay=document.createElement('div');overlay.className='edge-overlay';stage.appendChild(overlay);
    if(display){const img=document.createElement('img');img.src=display.overlay;img.alt='分割后保留区域';img.className='edge-mask';overlay.appendChild(img);}
    for(const [i,p] of (r?.edgeSeeds||[]).entries()){
      const mark=document.createElement('span');mark.className=`edge-seed ${p.kind}`;mark.style.left=p.x*100+'%';mark.style.top=p.y*100+'%';mark.textContent=p.kind==='keep'?'+':'−';mark.title=`${p.kind==='keep'?'保留':'排除'}点 ${i+1}`;overlay.appendChild(mark);
    }
    // Hide completed guide polygons except while explicitly adjusting the range.
    if(w.cropMode!=='outline')stage.classList.add('edge-result-mode');
    if(s.tool||!s.adjusting||w.cropMode!=='edit')stage.classList.add('edge-point-mode');
    if(!s.adjusting&&w.cropMode!=='rect')stage.classList.add('edge-hide-guides');
    const sync=()=>{if(image.naturalWidth&&stage.isConnected)placeCropOverlay(overlay,cropGeometry());};
    image.addEventListener('load',sync,{once:true});sync();
    const observer=new ResizeObserver(()=>{if(!stage.isConnected)observer.disconnect();else sync();});observer.observe(stage);panel._edgeCleanup=()=>observer.disconnect();
    let down=null;
    for(const eventName of ['pointerdown','pointermove','pointerup','pointercancel'])stage.addEventListener(eventName,e=>{
      if(!s.tool&&!busy)return;
      e.stopImmediatePropagation();e.preventDefault();if(busy)return;
      if(e.type==='pointerdown'&&e.button===0){down={id:e.pointerId,x:e.clientX,y:e.clientY};stage.setPointerCapture(e.pointerId);}
      if(e.type==='pointercancel')down=null;
      if(e.type==='pointerup'&&down?.id===e.pointerId){const tap=Math.hypot(e.clientX-down.x,e.clientY-down.y)<12;down=null;if(!tap)return;
        const p=window.ShiyeSelection.point(e,cropGeometry());if(!p||!r)return;
        if((r.edgeSeeds?.length||0)>=100){toast('修正点已达 100 个，可撤销或在更多调整中清空');return;}
        cropCheckpoint();r.edgeSeeds=[...(r.edgeSeeds||[]),{...p,kind:s.tool}];s.blocked=null;renderWorkshop();
      }
    },true);
    if(r&&!cached&&!busy&&s.blocked!==signature(r)&&!w.scissorPoints?.length){
      const key=signature(r);queued={w,key,timer:setTimeout(()=>{queued=null;if(current(w)&&signature(active(w)||{})===key)compute(w);},220)};
    }
  }

  async function compute(w) {
    cancel(false); const s=session(w),r=active(w);if(!r)return;
    const key=signature(r),navigation=navigationVersion,job={w,key,phase:engine?.initialized?'computing':'loading'};running=job;
    const valid=()=>running===job&&current(w)&&navigationVersion===navigation&&signature(active(w)||{})===key;
    s.blocked=null;s.message='正在更新边缘…';renderWorkshop();
    try {
      const image=await readImage(w.source);if(!valid())return;
      const scale=Math.min(1,720/Math.max(image.width,image.height)),input=document.createElement('canvas');
      input.width=Math.max(8,Math.round(image.width*scale));input.height=Math.max(8,Math.round(image.height*scale));
      const context=input.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0,input.width,input.height);
      const pixels=context.getImageData(0,0,input.width,input.height);
      const entry=prepareEngine(w);await entry.ready;
      if(!valid())return;
      job.phase='computing';renderWorkshop();
      const output=await segment(entry,{rgba:pixels.data,width:input.width,height:input.height,region:clone(r),seeds:r.edgeSeeds||[]});
      if(!valid())return;
      // Alpha is computed by GrabCut. RGB comes exclusively from the existing
      // normalized photo; the rough polygon is never used as a Canvas clip.
      const small=document.createElement('canvas');small.width=output.width;small.height=output.height;
      const mask=small.getContext('2d').createImageData(output.width,output.height);
      for(let i=0;i<output.alpha.length;i++)mask.data.set([255,255,255,output.alpha[i]],i*4);
      small.getContext('2d').putImageData(mask,0,0);
      const full=document.createElement('canvas');full.width=image.width;full.height=image.height;
      const ctx=full.getContext('2d',{willReadFrequently:true});ctx.drawImage(small,0,0,full.width,full.height);
      const alpha=ctx.getImageData(0,0,full.width,full.height);ctx.clearRect(0,0,full.width,full.height);ctx.drawImage(image,0,0);
      const photo=ctx.getImageData(0,0,full.width,full.height),tint=ctx.createImageData(full.width,full.height);
      let left=full.width,top=full.height,right=-1,bottom=-1;
      for(let y=0;y<full.height;y++)for(let x=0;x<full.width;x++){
        const i=(y*full.width+x)*4,a=Math.min(photo.data[i+3],alpha.data[i+3]);photo.data[i+3]=a;
        if(a){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);tint.data.set([70,155,101,Math.round(a*.45)],i);}
      }
      if(right<left||bottom<top)throw Error('结果为空，请添加保留点后重试');
      ctx.putImageData(photo,0,0);
      const cut=document.createElement('canvas');cut.width=right-left+1;cut.height=bottom-top+1;cut.getContext('2d').drawImage(full,left,top,cut.width,cut.height,0,0,cut.width,cut.height);
      ctx.putImageData(tint,0,0);
      s.cache.set(key,{src:cut.toDataURL('image/png'),overlay:full.toDataURL('image/png'),algorithm:output.algorithm,elapsedMs:output.elapsedMs,bounds:{left,top,width:cut.width,height:cut.height},analysisSize:{width:output.width,height:output.height}});
      s.last.set(r.edgeId,s.cache.get(key));
      if(s.cache.size>16)s.cache.delete(s.cache.keys().next().value);
      s.message='绿色是计算出的保留区域。多余部分点“排除”，漏掉部分点“保留”，再重新计算。';
    } catch(error) { if(valid()){s.blocked=key;s.message=error.message||'计算未完成，请调整选区后重试';} }
    finally {if(running===job){running=null;if(current(w))renderWorkshop();}}
  }

  async function action(name) {
    const w=workshop,s=session(w),r=active(w);
    if(name==='enable'){s.enabled=true;s.blocked=null;s.tool=null;}
    if(name==='disable'){cancel();s.enabled=false;s.tool=null;}
    if(name==='keep'||name==='remove'){s.adjusting=false;s.tool=name;w.cropMode='edit';}
    if(name==='range'){s.adjusting=true;s.tool=null;w.cropMode=w.crops.length?'edit':'outline';}
    if(name==='finish'){finishScissors(w.scissorPoints||[]);return;}
    if(name==='redraw'&&r){s.adjusting=false;cancel();cropCheckpoint();w.crops.splice(w.activeCrop,1);w.activeCrop=-1;w.scissorPoints=[];w.cropMode='outline';s.tool=null;s.blocked=null;}
    if(name==='clear'&&r){cropCheckpoint();r.edgeSeeds=[];s.blocked=null;}
    if(name==='cancel'){s.blocked=r?signature(r):null;cancel();s.message='已取消，选区和上一次结果仍保留。';}
    if(name==='run'){s.blocked=null;await compute(w);return;}
    if(name==='next'){s.adjusting=false;w.step=1;w.activeCrop=-1;w.scissorPoints=[];w.cropMode='outline';s.tool=null;s.blocked=null;}
    if(name==='confirm'){
      if(running||!w.crops.length||w.scissorPoints?.length||!w.crops.every(r=>result(w,r)))return;
      const old=new Map(w.results.map(a=>[a.id,a]));
      w.results=w.crops.map((r,i)=>{const data=result(w,r);r.edgeAssetId ||= uid();s.confirmed.set(r.edgeId,{key:signature(r),result:data});return{id:r.edgeAssetId,src:data.src,name:old.get(r.edgeAssetId)?.name||`照片里的片刻 ${i+1}`,category:'照片',provenance:{kind:'classical-segmentation',algorithm:data.algorithm,analysisSize:data.analysisSize}};});
      w.step=2;w.preview=Math.max(0,w.activeCrop);
    }
    renderWorkshop();
  }
  function mountPreview(w){
    if(!session(w).enabled||w.demo||!w.results.some(a=>a.provenance?.kind==='classical-segmentation'))return;
    const back=document.querySelector('[data-action="back-subjects"]');
    const next=document.createElement('button');next.className='button outline edge-next';next.dataset.action='edge-next';next.textContent='继续提取下一枚';next.disabled=w.crops.length>=8;back.parentElement.before(next);
    back.textContent='返回修正';
  }
  function beforeRender() {
    document.querySelector('#edge-panel')?._edgeCleanup?.();
    if(queued){clearTimeout(queued.timer);queued=null;}
    if(running&&(!current(running.w)||signature(active(running.w)||{})!==running.key))cancel();
    if(engine&&(engine.owner!==workshop||currentView!=='workshop'||workshop.step===0||segmentedWorkshop?.active||!session(workshop).enabled))cancel();
  }
  return {mount,mountPreview,action,beforeRender,cancel,isManual:w=>!session(w).enabled,resetTool:()=>{if(workshop)session(workshop).tool=null;session(workshop).adjusting=false;}};
})();
