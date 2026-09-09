import { readFile,open,rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const queues=new Map<string,Promise<unknown>>();
export async function editJson<T,R>(file:string,parse:(value:unknown)=>T,change:(data:T)=>R|Promise<R>):Promise<R>{
 const work=(queues.get(file)||Promise.resolve()).then(async()=>{
  const data=parse(JSON.parse(await readFile(file,'utf8'))),result=await change(data);parse(data);
  const temp=file+'.'+randomUUID()+'.tmp',handle=await open(temp,'wx',0o600);
  try{await handle.writeFile(JSON.stringify(data));await handle.sync();}finally{await handle.close();}
  await rename(temp,file);return result;
 });queues.set(file,work.catch(()=>{}));return work;
}
