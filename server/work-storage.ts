import { mkdir,readFile,open,rename,unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
import { z } from 'zod';
import { bookPackage } from '../shared/works.js';
import { editJson } from './local-json.js';

const imageRecord=z.object({id:z.string().uuid(),hash:z.string().regex(/^[a-f0-9]{64}$/),width:z.number().int().positive(),height:z.number().int().positive(),bytes:z.number().int().positive(),createdAt:z.number()}).strict();
const receipt=z.object({bookId:z.string(),revision:z.number().int().positive(),updatedAt:z.number()}).strict();
const stateSchema=z.object({schemaVersion:z.literal(1),images:z.array(imageRecord),books:z.array(z.object({content:bookPackage,revision:z.number().int().positive(),updatedAt:z.number()})),operations:z.array(z.object({id:z.string().uuid(),fingerprint:z.string(),result:receipt}))}).strict();
export type WorkState=z.infer<typeof stateSchema>;
export type ImageRecord=z.infer<typeof imageRecord>;
export interface WorkRepository{
 read(owner:string):Promise<WorkState>;
 transaction<T>(owner:string,change:(state:WorkState)=>T|Promise<T>):Promise<T>;
}
export interface WorkObjectStorage{
 put(owner:string,hash:string,bytes:Buffer):Promise<void>;
 get(owner:string,hash:string):Promise<Buffer>;
}
const empty=():WorkState=>({schemaVersion:1,images:[],books:[],operations:[]});
const account=(owner:string)=>z.string().uuid().parse(owner);
const digest=(hash:string)=>z.string().regex(/^[a-f0-9]{64}$/).parse(hash);

// Local development only: one service writer, atomic JSON metadata and durable image files.
// Production PostgreSQL/TOS adapters must implement the interfaces, not use serverless /tmp.
export class LocalWorkRepository implements WorkRepository{
 constructor(readonly directory:string){}
 private file(owner:string){return join(this.directory,account(owner)+'.json');}
 async read(owner:string){try{return stateSchema.parse(JSON.parse(await readFile(this.file(owner),'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return empty();throw e;}}
 async transaction<T>(owner:string,change:(state:WorkState)=>T|Promise<T>){
  await mkdir(this.directory,{recursive:true,mode:0o700});
  const file=this.file(owner);
  // rename publishes a complete initial file; init is serialized with all writes below.
  return this.serialInitialize(file,()=>editJson(file,v=>stateSchema.parse(v),change));
 }
 private static initializations=new Map<string,Promise<unknown>>();
 private async serialInitialize<T>(file:string,run:()=>Promise<T>):Promise<T>{
  const task=(LocalWorkRepository.initializations.get(file)||Promise.resolve()).then(async()=>{
   try{await readFile(file);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;await atomicWrite(file,Buffer.from(JSON.stringify(empty())));}
   return run();
  });LocalWorkRepository.initializations.set(file,task.catch(()=>{}));return task;
 }
}
async function atomicWrite(file:string,bytes:Buffer){
 const temp=file+'.'+randomUUID()+'.tmp';let handle;
 try{handle=await open(temp,'wx',0o600);await handle.writeFile(bytes);await handle.sync();await handle.close();handle=undefined;await rename(temp,file);}
 finally{await handle?.close();await unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
export class LocalWorkObjects implements WorkObjectStorage{
 constructor(readonly directory:string){}
 private file(owner:string,hash:string){return join(this.directory,account(owner),digest(hash)+'.png');}
 async put(owner:string,hash:string,bytes:Buffer){
  if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('图片校验失败。');
  const file=this.file(owner,hash);await mkdir(join(this.directory,account(owner)),{recursive:true,mode:0o700});
  try{const old=await this.get(owner,hash);if(!old.equals(bytes))throw Error('图片内容不一致。');return;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  await atomicWrite(file,bytes);
 }
 async get(owner:string,hash:string){const bytes=await readFile(this.file(owner,hash));if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('图片校验失败。');return bytes;}
}
