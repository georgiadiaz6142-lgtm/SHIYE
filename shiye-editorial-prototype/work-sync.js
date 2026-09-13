'use strict';
// Account-scoped, resumable synchronization. IndexedDB remains the first commit.
// No cookie, image data URL or temporary blob URL is sent as a durable reference.
const WorkSync = (() => {
 const bookPages = b=>[...(b.coverDesign?[b.coverDesign]:[]),...b.pages];
 const copy = value => structuredClone(value);
 const empty = () => ({schemaVersion:1,books:[],assets:[],archivedAssets:[]});
 function canonical(value) {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
 }
 const equal = (a,b) => canonical(a)===canonical(b);
 const ordered = value => ({...value,books:[...value.books].sort(byId),assets:[...value.assets].sort(byId),archivedAssets:[...value.archivedAssets].sort(byId)});
 const byId = (a,b) => a.id.localeCompare(b.id);
 function merge(base,local,remote) {
  const copies=new Map(),assetCopies=new Map();
  const assets=value=>[...value.assets.map(a=>({...a,archived:false})),...value.archivedAssets.map(a=>({...a,archived:true}))];
  function rows(before,after,latest,kind) {
   const b=new Map(before.map(x=>[x.id,x])),l=new Map(after.map(x=>[x.id,x])),r=new Map(latest.map(x=>[x.id,x]));
   for(const id of new Set([...b.keys(),...l.keys()])){
    const old=b.get(id),next=l.get(id),other=r.get(id);
    if(equal(old,next)||equal(next,other))continue;
    if(equal(old,other)){if(next)r.set(id,copy(next));else r.delete(id);continue;}
    // A delete cannot erase another browser's newer edits. Keep the edited version.
    if(!next)continue;
    const item=copy(next);item.id=crypto.randomUUID();
    if(kind==='book'){item.title=item.title.slice(0,190)+'（冲突副本）';item.sample=false;const title=item.coverDesign?.elements.find(e=>e.id===item.coverDesign.titleId&&e.type==='text');if(title)title.text=item.title;copies.set(id,item.id);}
    else{item.name=item.name.slice(0,190)+'（冲突副本）';assetCopies.set(id,item.id);}
    r.set(item.id,item);
   }
   return [...r.values()];
  }
  const all=rows(assets(base),assets(local),assets(remote),'asset');
  const localBooks=copy(local.books);
  for(const b of localBooks)for(const p of bookPages(b))for(const e of p.elements)if(e.type==='sticker'&&assetCopies.has(e.assetId))e.assetId=assetCopies.get(e.assetId);
  const books=rows(base.books,localBooks,remote.books,'book');
  return {content:ordered({schemaVersion:1,books,assets:all.filter(a=>!a.archived).map(({archived,...a})=>a),archivedAssets:all.filter(a=>a.archived).map(({archived,...a})=>a)}),copies};
 }
 const read = (db,key) => new Promise((resolve,reject)=>{const r=db.transaction('data').objectStore('data').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 class Sync {
  constructor(bridge){this.b=bridge;this.owner=bridge.owner;this.key=bridge.key;this.metaKey=this.key+':sync-v1';this.running=false;this.stopped=false;this.delay=3000;this.uploaded=new Set();this.downloads=new Map();this.label='等待同步';this.error='';this.online=()=>this.schedule(0);window.addEventListener('online',this.online);}
  current(){return !this.stopped&&this.b.isCurrent();}
  stop(){this.stopped=true;clearTimeout(this.timer);window.removeEventListener('online',this.online);this.controller?.abort();}
  status(label,error=''){if(!this.current())return;this.label=label;this.error=error;this.b.status();}
  changed(){this.status('本机已保存，等待同步');this.schedule();}
  schedule(delay=800){if(!this.current())return;if(this.running){this.again=true;return;}clearTimeout(this.timer);this.timer=setTimeout(()=>this.run(),delay);}
  async request(path,options={}){
   if(!this.current())throw Error('identity-changed');
   const controller=new AbortController();this.controller=controller;const timer=setTimeout(()=>controller.abort(),45000);
   try{
    const r=await ShiyeAPI.response('/api/works'+path,{...options,headers:{...options.headers,'X-Shiye-Work-Account':this.owner},signal:controller.signal,timeoutMs:45000});
    if(!this.current())throw Error('identity-changed');
    return r;
   }finally{clearTimeout(timer);}
  }
  async writeMeta(meta,expected){
   if(!this.current())throw Error('identity-changed');
   await new Promise((resolve,reject)=>{const tx=this.b.db.transaction('data','readwrite'),s=tx.objectStore('data');let error;tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(error||tx.error);const r=s.get(this.metaKey);r.onsuccess=()=>{if(!this.current()||!equal(r.result,expected)){error=Error('local-changed');tx.abort();return;}s.put(meta,this.metaKey);};});
  }
  async sourceBlob(src,blobKey){
   if(blobKey){const blob=await read(this.b.db,this.key+':'+blobKey);if(blob instanceof Blob)return blob;throw Error('本机素材图片缺失，请保留当前作品并重新添加该图片。');}
   if(!src?.startsWith('data:'))throw Error('有一张图片尚未保存在本机，暂时无法同步。');
   return (await fetch(src)).blob();
  }
  async image(src,blobKey){
   const builtin=this.b.builtins.find(a=>a.src===src);if(builtin)return {builtinId:builtin.id};
   if(/^assets\/[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp|svg)$/.test(src||''))return {builtinPath:src};
   if(/^sync-image:[0-9a-f-]{36}$/.test(blobKey||''))return {imageId:blobKey.slice(11)};
   const blob=await this.sourceBlob(src,blobKey);
   const bytes=await blob.arrayBuffer(),hex=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
   const imageId=hex.slice(0,8)+'-'+hex.slice(8,12)+'-4'+hex.slice(13,16)+'-a'+hex.slice(17,20)+'-'+hex.slice(20,32);
   if(!this.uploaded.has(imageId)){await this.request('/images/'+imageId,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:blob});this.uploaded.add(imageId);}
   return {imageId};
  }
  async encode(local){
   const content=empty();
   for(const key of ['assets','archivedAssets'])for(const row of local[key]||[]){if(key==='archivedAssets'&&local.assets.some(a=>a.id===row.id))continue;const {src,blobKey,archived,...rest}=row;content[key].push({...rest,image:await this.image(src,blobKey)});}
   for(const row of local.books){const book=copy(row);for(const page of bookPages(book))for(const e of page.elements)if(e.type==='photo'){e.image=await this.image(e.src);delete e.src;}content.books.push(book);}
   return ordered(content);
  }
  async download(ref,blobs){
   if(ref.builtinPath)return {src:ref.builtinPath};
   if(ref.builtinId){const a=this.b.builtins.find(a=>a.id===ref.builtinId);if(!a)throw Error('内置素材不存在。');return {src:a.src};}
   const blobKey='sync-image:'+ref.imageId;
   let blob=await read(this.b.db,this.key+':'+blobKey);
   if(!(blob instanceof Blob)){blob=this.downloads.get(ref.imageId);if(!blob){blob=await(await this.request('/images/'+ref.imageId)).blob();this.downloads.set(ref.imageId,blob);}blobs.set(blobKey,blob);}
   return {blobKey,blob};
  }
  async decode(content,local,encoded){
   const workspace={...copy(local),books:[],assets:[],archivedAssets:[]},blobs=new Map();
   const previous=new Map([...(local.archivedAssets||[]),...(local.assets||[])].map(a=>[a.id,a]));
   const refs=new Map([...encoded.assets,...encoded.archivedAssets].map(a=>[a.id,a.image]));
   for(const key of ['assets','archivedAssets'])for(const row of content[key]){
    const {image,...rest}=row,old=previous.get(row.id);
    if(old&&equal(refs.get(row.id),image)){workspace[key].push({...rest,...(old.blobKey?{blobKey:old.blobKey}:{src:old.src})});continue;}
    const {blob,...source}=await this.download(image,blobs);workspace[key].push({...rest,...source});
   }
   const localPhotos=new Map(local.books.flatMap(b=>bookPages(b).flatMap(p=>p.elements.filter(e=>e.type==='photo'))).map(e=>[e.id,e.src]));
   const photoRefs=new Map(encoded.books.flatMap(b=>bookPages(b).flatMap(p=>p.elements.filter(e=>e.type==='photo'))).map(e=>[e.id,e.image]));
   for(const row of content.books){const book=copy(row);for(const p of bookPages(book))for(const e of p.elements)if(e.type==='photo'){
    if(localPhotos.has(e.id)&&equal(photoRefs.get(e.id),e.image))e.src=localPhotos.get(e.id);
    else{const source=await this.download(e.image,blobs);e.src=source.src||await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(source.blob);});}
    delete e.image;
   }workspace.books.push(book);}
   return {workspace,blobs};
  }
  async acknowledge(meta){
   const receipt=await(await this.request('/workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(meta.pending)})).json();
   const next={revision:receipt.revision,base:meta.pending.content};await this.writeMeta(next,meta);return next;
  }
  async cycle(){
   if(!this.current())return;
   let meta=await read(this.b.db,this.metaKey);
   if(meta?.pending){try{meta=await this.acknowledge(meta);}catch(e){if(e.code!=='WORK_REVISION_CONFLICT')throw e;const next={revision:meta.revision,base:meta.base};await this.writeMeta(next,meta);meta=next;}}
   const remote=await(await this.request('/workspace')).json();
   // Previously published image references need no repeated binary upload on login.
   for(const a of [...remote.content.assets,...remote.content.archivedAssets])if(a.image.imageId)this.uploaded.add(a.image.imageId);
   for(const b of remote.content.books)for(const p of bookPages(b))for(const e of p.elements)if(e.type==='photo'&&e.image.imageId)this.uploaded.add(e.image.imageId);
   const local=await read(this.b.db,this.key);if(!local)throw Error('本机作品暂时无法读取。');
   let committedLocal=local;
   const encoded=await this.encode(local),{content,copies}=merge(meta?.base||empty(),encoded,ordered(remote.content));
   if(!equal(content,encoded)){
    // Never replace the canvas while the user is typing, dragging, or cutting a photo.
    if(this.b.busy()){this.status('本机已保存，待合并同步');return;}
    const {workspace,blobs}=await this.decode(content,local,encoded);
    const next={revision:remote.revision,base:ordered(remote.content)};
    await this.b.apply(local,workspace,blobs,copies,this.metaKey,next,meta,()=>this.current());meta=next;committedLocal=workspace;
   }
   if(equal(content,ordered(remote.content))){
    const next={revision:remote.revision,base:content};if(!equal(next,meta)){await this.writeMeta(next,meta);meta=next;}
   }else{
    const next={revision:remote.revision,base:ordered(remote.content),pending:{operationId:crypto.randomUUID(),baseRevision:remote.revision,content}};
    await this.writeMeta(next,meta);meta=await this.acknowledge(next);
   }
   if(this.current())this.status((!equal(await read(this.b.db,this.key),committedLocal)||this.b.unsaved())?'本机已保存，等待同步':'已同步到当前服务');
  }
  async run(){
   if(!this.current()||this.running)return;
   this.running=true;this.again=false;clearTimeout(this.timer);let wait=15000;
   try{
    this.status('正在同步…');
    if(navigator.locks)await navigator.locks.request(this.metaKey,{ifAvailable:true},lock=>lock?this.cycle():undefined);
    else await this.cycle();
    this.delay=3000;
   }catch(e){
    if(!this.current())return;
    if(e.message==='local-changed'||e.code==='WORK_REVISION_CONFLICT'){wait=800;this.status('本机已保存，等待同步');}
    else{wait=this.delay;this.delay=Math.min(60000,this.delay*2);this.status(e.status===401||e.code==='WORK_ACCOUNT_CHANGED'?'本机已保存，请重新登录':'本机已保存，等待重试',e.message);}
   }finally{this.running=false;if(this.current())this.schedule(this.again?800:wait);}
  }
 }
 return {Sync,merge,canonical,equal,empty};
})();
