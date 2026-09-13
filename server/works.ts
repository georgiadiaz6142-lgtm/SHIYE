import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { Fault } from '../shared/contracts.js';
import { saveBookInput,documentPages,packageImages,workId,saveWorkspaceInput,workspaceImages,type WorkspaceDocument } from '../shared/works.js';
import type { WorkRepository,WorkObjectStorage } from './work-storage.js';

const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
function canonical(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
 return JSON.stringify(value);
}
export class Works{
 constructor(private repository:WorkRepository,private objects:WorkObjectStorage,private builtinExists:(path:string)=>Promise<boolean>){}
 async upload(owner:string,imageId:string,bytes:Buffer){
  z.string().uuid().parse(owner);z.string().uuid().parse(imageId);
  if(!bytes.length||bytes.length>10*1024*1024)throw new Fault(413,'WORK_IMAGE_TOO_LARGE','作品图片不能为空或超过 10 MB。');
  let png:Buffer,width:number,height:number;
  try{
   const image=sharp(bytes,{limitInputPixels:24_000_000,failOn:'warning'}),meta=await image.metadata();
   if(!['jpeg','png','webp'].includes(meta.format||'')||(meta.pages||1)>1)throw Error('format');
   const normalized=await image.rotate().toColourspace('srgb').png().toBuffer({resolveWithObject:true});
   png=normalized.data;width=normalized.info.width;height=normalized.info.height;
   if(png.length>32*1024*1024)throw new Fault(413,'WORK_IMAGE_TOO_LARGE','图片转换后超过 32 MB，请缩小图片。');
  }catch(e){if(e instanceof Fault)throw e;throw new Fault(422,'INVALID_WORK_IMAGE','图片无法读取，请使用不超过 2400 万像素的静态 JPG、PNG 或 WebP。');}
  const hash=sha(png);
  return this.repository.transaction(owner,async state=>{
   const old=state.images.find(i=>i.id===imageId);
   if(old&&old.hash!==hash)throw new Fault(409,'IMAGE_ID_CONFLICT','该图片编号已保存其他内容，请为新图片使用新编号。');
   // Publish the file before the metadata. An interrupted metadata write cannot create a visible broken image.
   await this.objects.put(owner,hash,png);
   const record=old||{id:imageId,hash,width,height,bytes:png.length,createdAt:Date.now()};
   if(!old)state.images.push(record);
   const {hash:_,...result}=record;return result;
  });
 }
 async image(owner:string,imageId:string){
  z.string().uuid().parse(owner);z.string().uuid().parse(imageId);
  const state=await this.repository.read(owner),record=state.images.find(i=>i.id===imageId);
  if(!record)throw new Fault(404,'WORK_IMAGE_NOT_FOUND','作品图片不存在。');
  try{return await this.objects.get(owner,record.hash);}catch{throw new Fault(503,'WORK_IMAGE_UNAVAILABLE','作品图片暂时无法读取，请保留本机副本并稍后重试。');}
 }
 async save(owner:string,bookId:string,value:unknown){
  z.string().uuid().parse(owner);workId.parse(bookId);const input=saveBookInput.parse(value);
  if(input.content.book.id!==bookId)throw new Fault(422,'BOOK_ID_MISMATCH','手账编号与保存地址不一致。');
  const fingerprint=sha(canonical(input));
  return this.repository.transaction(owner,async state=>{
   const previous=state.operations.find(o=>o.id===input.operationId);
   if(previous){if(previous.fingerprint!==fingerprint)throw new Fault(409,'OPERATION_CONFLICT','同一次保存请求不能更换内容。');return {...previous.result};}
   const book=state.books.find(b=>b.content.book.id===bookId);
   if((book?.revision||0)!==input.baseRevision)throw new Fault(409,'WORK_REVISION_CONFLICT','手账已有新版本，尚未覆盖。请保留当前内容，读取新版本后合并或另存副本。');
   if(state.workspace)throw new Fault(409,'WORKSPACE_SYNC_ACTIVE','当前账号已启用自动同步，请使用作品空间保存接口。');
   await this.checkImages(owner,packageImages(input.content),state.images);
   const result={bookId,revision:input.baseRevision+1,updatedAt:Date.now()},saved={content:input.content,revision:result.revision,updatedAt:result.updatedAt};
   if(book)state.books[state.books.indexOf(book)]=saved;else state.books.push(saved);
   state.operations.push({id:input.operationId,fingerprint,result});return {...result};
  });
 }
 private async checkImages(owner:string,references:{ids:string[];builtins:string[]},records:{id:string;hash:string}[]){
  const {ids,builtins}=references;
  for(const imageId of ids){const image=records.find(i=>i.id===imageId);if(!image)throw new Fault(422,'WORK_IMAGE_MISSING','图片尚未上传完成或不属于当前账号，手账未保存。');
   try{await this.objects.get(owner,image.hash);}catch{throw new Fault(503,'WORK_IMAGE_UNAVAILABLE','图片文件暂时不可用，手账未保存。请保留本机内容后重试。');}}
  for(const path of builtins)if(!await this.builtinExists(path))throw new Fault(422,'BUILTIN_IMAGE_MISSING','作品引用的官方图片不存在，手账未保存。');
 }
 async workspace(owner:string){
  z.string().uuid().parse(owner);const state=await this.repository.read(owner);
  if(state.workspace)return structuredClone(state.workspace);
  const assets=new Map(state.books.flatMap(b=>b.content.assets).map(a=>[a.id,a]));
  return {revision:state.books.reduce((sum,b)=>sum+b.revision,0),updatedAt:Math.max(0,...state.books.map(b=>b.updatedAt)),content:{schemaVersion:1 as const,books:state.books.map(b=>b.content.book),assets:[...assets.values()].filter(a=>!a.archived),archivedAssets:[...assets.values()].filter(a=>a.archived)}};
 }
 async saveWorkspace(owner:string,value:unknown){
  z.string().uuid().parse(owner);const input=saveWorkspaceInput.parse(value),fingerprint=sha('workspace:'+canonical(input));
  return this.repository.transaction(owner,async state=>{
   const previous=state.operations.find(o=>o.id===input.operationId);
   if(previous){if(previous.fingerprint!==fingerprint)throw new Fault(409,'OPERATION_CONFLICT','同一次同步请求不能更换内容。');return {...previous.result};}
   if((state.workspace?.revision??state.books.reduce((sum,b)=>sum+b.revision,0))!==input.baseRevision)throw new Fault(409,'WORK_REVISION_CONFLICT','作品已有新版本，请合并后同步。');
   await this.checkImages(owner,workspaceImages(input.content),state.images);
   const result={bookId:'workspace',revision:input.baseRevision+1,updatedAt:Date.now()};
   state.workspace={content:input.content,revision:result.revision,updatedAt:result.updatedAt};
   // Keep read-only per-book endpoints compatible with automatic shelf deletion and edits.
   state.books=input.content.books.map(book=>({content:this.bookContent(input.content,book.id),revision:result.revision,updatedAt:result.updatedAt}));
   state.operations.push({id:input.operationId,fingerprint,result});return {...result};
  });
 }
 private bookContent(content:WorkspaceDocument,id:string){
  const book=content.books.find(b=>b.id===id)!;
  const used=new Set(documentPages(book).flatMap(p=>p.elements.flatMap(e=>e.type==='sticker'?[e.assetId]:[])));
  const all=new Map([...content.assets,...content.archivedAssets].map(a=>[a.id,a]));
  const assets=[...used].map(id=>all.get(id)||{id,name:id,category:'',image:{builtinId:id as 'flower'}});
  return {schemaVersion:1 as const,book,assets};
 }
 async list(owner:string){z.string().uuid().parse(owner);const state=await this.repository.read(owner);return state.books.map(b=>({bookId:b.content.book.id,title:b.content.book.title,revision:b.revision,updatedAt:b.updatedAt})).sort((a,b)=>b.updatedAt-a.updatedAt);}
 async get(owner:string,bookId:string){z.string().uuid().parse(owner);workId.parse(bookId);const state=await this.repository.read(owner),book=state.books.find(b=>b.content.book.id===bookId);if(!book)throw new Fault(404,'WORK_NOT_FOUND','手账不存在。');return structuredClone(book);}
}
