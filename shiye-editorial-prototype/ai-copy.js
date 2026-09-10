'use strict';
let aiCopyPanel=null;
const aiCopyOwner=()=>currentIdentity?.accountId?'account:'+currentIdentity.accountId:currentIdentity?.inviteId?'invite:'+currentIdentity.inviteId:null;
const aiCopyCanonical=value=>Array.isArray(value)?'['+value.map(aiCopyCanonical).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+aiCopyCanonical(value[k])).join(',')+'}':JSON.stringify(value);
function aiCopySnapshot(page=currentPage()){return {page,stickers:page? pageElements(page).filter(e=>e.type==='sticker').map(e=>{const a=asset(e.assetId);return {element:e,image:a?.blobKey||a?.src||''};}):[]};}
const aiCopyHash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(aiCopyCanonical(value))))].map(v=>v.toString(16).padStart(2,'0')).join('');
function aiCopyCurrent(panel){return aiCopyPanel===panel&&$('#dialog').open&&aiCopyOwner()===panel.owner&&currentView==='editor'&&editing&&activeBookId===panel.bookId&&currentPage()?.id===panel.pageId;}
async function aiCopyRequest(panel,path,body){
 if(!aiCopyCurrent(panel))throw Error('页面或账号已变化，请重新打开文案面板。');
 const response=await fetch('/api/ai/copy'+path,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:{'X-Shiye-Copy-Owner':panel.owner,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});
 const result=await response.json();if(!aiCopyCurrent(panel))throw Error('页面或账号已变化，请重新打开文案面板。');if(!response.ok){const e=Error(result.error?.message||'文案服务暂不可用。');e.status=response.status;throw e;}return result;
}
async function aiCopyThumbnail(page){
 const rows=pageElements(page).filter(e=>e.type==='sticker');if(!rows.length)return undefined;
 const canvas=document.createElement('canvas');canvas.width=398;canvas.height=512;const ctx=canvas.getContext('2d');ctx.fillStyle='#fffdf8';ctx.fillRect(0,0,398,512);
 for(const e of rows){const source=asset(e.assetId)?.src;if(!source)throw Error('当前页有贴纸尚未加载完成，请稍后再试。');const image=new Image();image.src=source;await image.decode();const w=e.w/100*398,h=w*image.naturalHeight/image.naturalWidth;ctx.save();ctx.translate(e.x/100*398+w/2,e.y/100*512+h/2);ctx.rotate((e.rotation||0)*Math.PI/180);if(e.flip)ctx.scale(-1,1);ctx.drawImage(image,-w/2,-h/2,w,h);ctx.restore();}
 return canvas.toDataURL('image/jpeg',.75);
}
function aiCopyRemember(panel){try{sessionStorage.setItem(panel.key,JSON.stringify({input:panel.input,targetId:panel.targetId,anchor:panel.anchor}));}catch{throw Error('浏览器无法保存本次请求，请先释放一些本机空间后再试。');}}
function aiCopyBusy(busy){$('#ai-copy-generate').disabled=busy;$('#ai-copy-form fieldset').disabled=busy;$('#ai-copy-progress').textContent=busy?'正在为这一页写几句话…':'';}
function aiCopyQuota(info){$('#ai-copy-quota').textContent=`${info.period}剩余 ${info.remaining} 次${info.pending?' · '+info.pending+' 次处理中':''}`;}
async function openAICopy(){
 if(currentView!=='editor'||!editing||!currentPage())return;
 finishInlineText();const selected=currentElement(),target=selected?.type==='text'?selected:null,page=currentPage();
 const panel={owner:aiCopyOwner(),bookId:activeBookId,pageId:page.id,targetId:target?.id||null,anchor:target?{x:target.x,y:target.y,w:target.w,font:target.font}:null,enabled:false,input:null,poll:null};
 if(!panel.owner){toast('请先登录账号或使用邀请码。');return;}
 panel.key='shiye-ai-copy:'+panel.owner+':'+panel.bookId+':'+panel.pageId;aiCopyPanel=panel;
 showDialog('AI 帮我',`<form id="ai-copy-form"><details id="ai-copy-requirements" open><summary>调整生成要求</summary><fieldset><label class="field"><span>${target?'想怎样润色？':'想记录什么？'}</span><textarea name="topic" maxlength="300" rows="2" placeholder="例如：周末去山里散步，想记下轻松的心情"></textarea></label><label class="field"><span>草稿（可选）</span><textarea name="draft" maxlength="800" rows="3" placeholder="写下几个词，或放入想润色的文字">${esc(target?.text||'')}</textarea></label><div class="ai-copy-fields"><label class="field"><span>日期（可选）</span><input name="date" type="date"></label><label class="field"><span>地点（可选）</span><input name="place" maxlength="60" placeholder="例如：郊外"></label><label class="field"><span>心情（可选）</span><input name="mood" maxlength="40" placeholder="例如：轻松"></label><label class="field"><span>语气</span><select name="tone"><option value="natural">自然记录</option><option value="gentle">温柔手账</option><option value="concise">简短克制</option></select></label></div></fieldset></details><p class="ai-copy-note">只参考当前选中页的贴纸缩略图和你填写的信息。</p><div class="ai-copy-generate-row"><span id="ai-copy-quota" class="muted">正在读取…</span><button id="ai-copy-generate" type="submit" class="button primary" disabled>${target?'帮我润色':'帮我写一段'}</button></div></form><p id="ai-copy-progress" class="muted" role="status"></p><p id="ai-copy-error" class="account-error" role="alert"></p><button id="ai-copy-recover" class="button outline small" hidden>查询原任务</button><section id="ai-copy-preview" hidden><label class="field"><span>AI 辅助 · 预览，可直接修改</span><textarea id="ai-copy-result" rows="5" maxlength="800"></textarea></label><p class="ai-copy-note">有效预览计 1 次；重新生成另计，手动修改不计次。</p><div class="ai-copy-preview-actions"><button id="ai-copy-again" class="button outline">再来一版</button><button id="ai-copy-apply" class="button primary">${target?'替换选中文字':'放到页面'}</button></div></section>`);
 $('#dialog').classList.add('ai-copy-dialog');
 $('#ai-copy-form').onsubmit=e=>{e.preventDefault();void generateAICopy(panel);};
 $('#ai-copy-again').onclick=()=>void generateAICopy(panel);
 $('#ai-copy-recover').onclick=()=>void recoverAICopy(panel);
 $('#ai-copy-apply').onclick=()=>void applyAICopy(panel);
 const draft=$('#ai-copy-form [name="draft"]');draft.oninput=()=>{$('#ai-copy-generate').textContent=draft.value.trim()?'帮我润色':'帮我写一段';};
 try{
  const status=await aiCopyRequest(panel,'/status');panel.enabled=status.enabled;panel.remaining=status.remaining;aiCopyQuota(status);
  $('#ai-copy-generate').disabled=!status.enabled||!status.remaining;
  if(!status.enabled)$('#ai-copy-error').textContent='AI 文案尚未启用，可以继续自己写字。';
  const raw=sessionStorage.getItem(panel.key);if(raw){const previous=JSON.parse(raw);if(previous.input?.pageId===panel.pageId){panel.input=previous.input;panel.targetId=previous.targetId;panel.anchor=previous.anchor;for(const name of ['topic','draft','date','place','mood','tone'])$('#ai-copy-form [name="'+name+'"]').value=panel.input[name]||'';$('#ai-copy-apply').textContent=panel.targetId?'替换选中文字':'放到页面';await recoverAICopy(panel);}}
 }catch(error){if(aiCopyCurrent(panel))$('#ai-copy-error').textContent=error.message;}
}
async function generateAICopy(panel){
 if(!aiCopyCurrent(panel)||!panel.enabled||!panel.remaining||panel.busy||panel.poll)return;
 panel.busy=true;aiCopyBusy(true);$('#ai-copy-preview').hidden=true;$('#ai-copy-recover').hidden=true;$('#ai-copy-error').textContent='';
 try{
  const page=clone(currentPage()),sourceRevision=await aiCopyHash(aiCopySnapshot(page)),form=Object.fromEntries(new FormData($('#ai-copy-form')));
  // Disabled fieldsets are omitted by FormData: read only the explicit user input fields.
  for(const name of ['topic','draft','date','place','mood','tone'])form[name]=$('#ai-copy-form [name="'+name+'"]').value;
  const thumbnail=await aiCopyThumbnail(page);
  const latestRevision=await aiCopyHash(aiCopySnapshot());
  if(!aiCopyCurrent(panel)||sourceRevision!==latestRevision)throw Error('页面已经变化，请再次生成。');
  panel.input={...form,operationId:crypto.randomUUID(),bookId:panel.bookId,pageId:panel.pageId,sourceRevision,mode:form.draft.trim()?'polish':'generate',...(thumbnail?{thumbnail}:{})};
  aiCopyRemember(panel);
  const result=await aiCopyRequest(panel,'',panel.input);await handleAICopy(panel,result);
 }catch(error){if(aiCopyCurrent(panel)){$('#ai-copy-error').textContent=error.message||'连接中断，可以查询原任务。';$('#ai-copy-recover').hidden=!panel.input;}}
 finally{panel.busy=false;if(aiCopyCurrent(panel)&&!panel.poll){aiCopyBusy(false);$('#ai-copy-generate').disabled=!panel.enabled||!panel.remaining;}}
}
async function recoverAICopy(panel){
 if(!aiCopyCurrent(panel)||!panel.input||panel.busy)return;
 panel.busy=true;aiCopyBusy(true);$('#ai-copy-error').textContent='';
 try{let result;try{result=await aiCopyRequest(panel,'/'+panel.input.operationId);}catch(e){if(e.status!==404)throw e;result=await aiCopyRequest(panel,'',panel.input);}await handleAICopy(panel,result);}
 catch(error){if(aiCopyCurrent(panel)){$('#ai-copy-error').textContent=error.message||'暂时无法连接，请稍后查询原任务。';$('#ai-copy-recover').hidden=false;}}
 finally{panel.busy=false;if(aiCopyCurrent(panel)&&!panel.poll){aiCopyBusy(false);$('#ai-copy-generate').disabled=!panel.enabled||!panel.remaining;}}
}
async function handleAICopy(panel,result){
 if(!aiCopyCurrent(panel))return;
 clearTimeout(panel.poll);panel.poll=null;
 if(result.status==='pending'){aiCopyBusy(true);panel.poll=setTimeout(()=>{panel.poll=null;void recoverAICopy(panel);},1000);return;}
 aiCopyBusy(false);$('#ai-copy-recover').hidden=true;
 const status=await aiCopyRequest(panel,'/status');aiCopyQuota(status);panel.enabled=status.enabled;panel.remaining=status.remaining;$('#ai-copy-generate').disabled=!status.enabled||!status.remaining;
 if(result.status==='failed'){$('#ai-copy-generate').hidden=false;$('#ai-copy-requirements').open=true;sessionStorage.removeItem(panel.key);$('#ai-copy-error').textContent=result.error?.message||'未能生成文案，本次不扣使用次数。';return;}
 if(result.previewExpired){$('#ai-copy-generate').hidden=false;$('#ai-copy-requirements').open=true;sessionStorage.removeItem(panel.key);$('#ai-copy-error').textContent='这次预览已过期，可以重新生成。原任务已计次，不会再次扣次。';return;}
 if(result.sourceRevision!==panel.input.sourceRevision||result.bookId!==panel.bookId||result.pageId!==panel.pageId)throw Error('结果与当前请求不匹配，请重新打开面板。');
 panel.result=result;$('#dialog').classList.add('has-copy-preview');$('#ai-copy-requirements').open=false;$('#ai-copy-generate').hidden=true;$('#ai-copy-preview').hidden=false;$('#ai-copy-result').value=result.text;$('#ai-copy-again').disabled=!status.enabled||!status.remaining;
 const latestRevision=await aiCopyHash(aiCopySnapshot());if(!aiCopyCurrent(panel))return;
 $('#ai-copy-apply').disabled=result.sourceRevision!==latestRevision;if($('#ai-copy-apply').disabled)$('#ai-copy-error').textContent='页面已发生修改，旧结果不会覆盖当前页面。请重新生成。';
}
async function applyAICopy(panel){
 if(!aiCopyCurrent(panel)||!panel.result)return;
 const text=$('#ai-copy-result').value.trim();if(!text){$('#ai-copy-error').textContent='先写一点内容再放到页面。';return;}
 $('#ai-copy-apply').disabled=true;
 try{
  await refreshIdentity();const latestRevision=await aiCopyHash(aiCopySnapshot());if(!aiCopyCurrent(panel)||panel.result.sourceRevision!==latestRevision)throw Error('账号或页面已发生变化，旧结果不能覆盖当前内容。');
  if(panel.targetId&&!currentPage().elements.some(e=>e.id===panel.targetId&&e.type==='text'))throw Error('原文字已不存在，请重新生成。');
  change(()=>{if(panel.targetId){const e=currentPage().elements.find(e=>e.id===panel.targetId);e.text=text;e.aiSource=clone(panel.result.source);selectedId=e.id;}else{const e=node('text',{text,font:panel.anchor?.font||newTextFont,direction:'horizontal',x:panel.anchor?.x??15,y:panel.anchor?.y??20,w:panel.anchor?.w??70,size:23,color:'#505b46',aiSource:clone(panel.result.source)});currentPage().elements.push(e);selectedId=e.id;}drawer=null;});
  sessionStorage.removeItem(panel.key);aiCopyPanel=null;closeDialog();await saveNow();
 }catch(error){if(aiCopyCurrent(panel)){$('#ai-copy-error').textContent=error.message;$('#ai-copy-apply').disabled=false;}}
}
document.addEventListener('click',e=>{if(e.target.closest('[data-action="ai-copy-open"]'))void openAICopy();});
document.addEventListener('DOMContentLoaded',()=>{$('#dialog').addEventListener('close',()=>{if(aiCopyPanel)clearTimeout(aiCopyPanel.poll);aiCopyPanel=null;$('#dialog').classList.remove('ai-copy-dialog','has-copy-preview');});});
