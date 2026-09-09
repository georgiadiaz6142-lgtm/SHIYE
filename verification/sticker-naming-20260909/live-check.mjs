import {readFile,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {BaiduProvider} from '../../dist/server/baidu.js';
const record={kind:'one explicit naming acceptance call; no segmentation',source:'previously approved night-building-box-0.png',attemptedAt:new Date().toISOString()};
const path=new URL('./live-check.json',import.meta.url);
await writeFile(path,JSON.stringify(record,null,2),{flag:'wx',mode:0o600});
try{
 const image=await sharp(await readFile(new URL('../real-photo-acceptance-20260909/night-building-box-0.png',import.meta.url))).resize(600,600,{fit:'contain',background:'#ffffff'}).flatten({background:'#ffffff'}).jpeg({quality:85}).toBuffer();
 const provider=new BaiduProvider(process.env.BAIDU_API_KEY,process.env.BAIDU_SECRET_KEY);
 Object.assign(record,{status:'succeeded',...await provider.name(image)});
}catch(e){Object.assign(record,{status:'failed',errorType:e.errorType||'UNKNOWN',message:e.errorType?e.message:'Naming request failed'});}
await writeFile(path,JSON.stringify(record,null,2));console.log(JSON.stringify(record));
