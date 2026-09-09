import sharp from 'sharp';
import { z } from 'zod';
import { Fault } from '../shared/contracts.js';
export const usernameSchema=z.string().transform(v=>v.normalize('NFKC').trim()).pipe(z.string().min(2).max(32).regex(/^[\p{L}\p{N}_.-]+$/u,'用户名可使用文字、数字、下划线、点或短横线。'));
export const usernameKey=(s:string)=>s.normalize('NFKC').trim().toLowerCase();
export const newPassword=z.string().min(12).max(128);
export async function cleanAvatar(value:unknown):Promise<string|null|undefined>{
 if(value===undefined)return undefined;if(value===null)return null;
 if(typeof value!=='string'||value.length>3_000_000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value))throw new Fault(422,'INVALID_AVATAR','请使用 2 MB 以内的 JPG、PNG 或 WebP 图片。');
 try{const input=Buffer.from(value.split(',')[1],'base64');if(input.length>2*1024*1024)throw Error();const output=await sharp(input,{limitInputPixels:16_000_000,animated:false}).rotate().resize(256,256,{fit:'cover'}).png().toBuffer();return 'data:image/png;base64,'+output.toString('base64');}
 catch{throw new Fault(422,'INVALID_AVATAR','头像无法读取，请换一张较小的图片。');}
}
