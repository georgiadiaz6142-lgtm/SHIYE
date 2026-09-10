import { z } from 'zod';

// Versioned service representation. Browser blob:/data: URLs are never durable image references.
export const workId=z.string().min(1).max(96).regex(/^[A-Za-z0-9_-]+$/);
const finite=z.number().finite();
const token=z.string().min(1).max(96).regex(/^[A-Za-z0-9_-]+$/);
const position={id:workId,x:finite.min(-1000).max(1000),y:finite.min(-1000).max(1000),w:finite.positive().max(2000),h:finite.positive().max(2000).optional(),rotation:finite.min(-36000).max(36000),locked:z.boolean().optional(),flip:z.boolean().optional(),spreadWith:workId.optional()};
const imageReference=z.union([
  z.object({imageId:z.string().uuid()}).strict(),
  z.object({builtinPath:z.string().regex(/^assets\/[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp|svg)$/)}).strict(),
  z.object({builtinId:z.enum(['flower','coffee','camera','orange','ticket','leaf','stamp','tape','star'])}).strict(),
]);
const element=z.discriminatedUnion('type',[
  z.object({...position,type:z.literal('text'),text:z.string().max(20000),size:finite.positive().max(500),font:z.enum(['serif','sans','hand','fangsong','rounded']).optional(),color:z.string().regex(/^#[\da-fA-F]{3,8}$/).optional(),direction:z.enum(['horizontal','vertical']).optional(),bold:z.boolean().optional(),italic:z.boolean().optional()}).strict(),
  z.object({...position,type:z.literal('sticker'),assetId:workId}).strict(),
  z.object({...position,type:z.literal('photo'),image:imageReference,frame:z.boolean().optional()}).strict(),
]);
const page=z.object({id:workId,paper:token,spreadKey:workId.optional(),spreadSide:z.enum(['left','right']).optional(),paperSpread:z.object({paper:token,side:z.enum(['left','right'])}).strict().optional(),elements:z.array(element).max(1000)}).strict();
export const bookDocument=z.object({id:workId,title:z.string().min(1).max(200),subtitle:z.string().max(500).optional(),cover:token,sample:z.boolean().optional(),pinned:z.boolean().optional(),updated:finite.nonnegative().optional(),page:z.number().int().nonnegative().optional(),editorLayout:z.enum(['single','spread']).optional(),stickerPlacement:z.enum(['page','spread']).optional(),pages:z.array(page).min(1).max(500)}).strict();
const provenance=z.object({mock:z.boolean(),provider:z.enum(['baidu','mock']),providerRequestId:z.string().max(80).optional(),imageSessionId:z.string().uuid(),sourceRevision:z.number().int().nonnegative(),candidateId:z.string().uuid(),candidateRevision:z.number().int().nonnegative(),localRetouch:z.object({version:z.literal(1),editedAt:finite.nonnegative()}).strict().optional()}).strict();
export const savedAsset=z.object({id:workId,name:z.string().min(1).max(200),category:z.string().max(40),createdAt:finite.nonnegative().optional(),pinned:z.boolean().optional(),favorite:z.boolean().optional(),archived:z.boolean().optional(),border:finite.min(0).max(500).optional(),borderBaked:z.boolean().optional(),width:finite.positive().max(24000000).optional(),height:finite.positive().max(24000000).optional(),image:imageReference,provenance:provenance.optional()}).strict();
export const bookPackage=z.object({schemaVersion:z.literal(1),book:bookDocument,assets:z.array(savedAsset).max(2000)}).strict().superRefine((v,ctx)=>{
 const issue=(message:string)=>ctx.addIssue({code:'custom',message});
 const groups=new Map<string,Map<string,string>>(),pair=new Map<string,string>();
 v.book.pages.forEach((p,i)=>{const key=p.spreadKey||`legacy-${Math.floor((i+1)/2)}`,side=p.spreadSide||(i%2?'left':'right'),group=groups.get(key)||new Map<string,string>();if(group.has(side))issue('同一展开页的位置重复。');group.set(side,p.id);groups.set(key,group);pair.set(p.id,key);if(p.paperSpread&&p.paperSpread.side!==side)issue('跨页纸张方向不一致。');});
 const pages=new Set(v.book.pages.map(p=>p.id)),assets=new Set(v.assets.map(a=>a.id)),elements=new Set<string>();
 if(pages.size!==v.book.pages.length||assets.size!==v.assets.length)issue('页面或素材 ID 重复。');
 if(v.book.page!==undefined&&v.book.page>=v.book.pages.length)issue('当前页不存在。');
 for(const p of v.book.pages){
  if(p.paperSpread){const mates=v.book.pages.filter(other=>pair.get(other.id)===pair.get(p.id));if(mates.length!==2||mates.some(other=>other.paperSpread?.paper!==p.paperSpread!.paper))issue('跨页纸张需要完整、匹配的左右两页。');}
  for(const e of p.elements){
   if(elements.has(e.id))issue('元素 ID 重复。');elements.add(e.id);
   if(e.type==='sticker'&&!assets.has(e.assetId))issue('缺少书页引用的贴纸，包括已归档素材。');
   if(e.spreadWith&&(e.type!=='sticker'||!pages.has(e.spreadWith)||e.spreadWith===p.id||pair.get(e.spreadWith)!==pair.get(p.id)))issue('跨页贴纸引用无效。');
  }
 }
});
export const saveBookInput=z.object({operationId:z.string().uuid(),baseRevision:z.number().int().nonnegative(),content:bookPackage}).strict();
export type BookPackage=z.infer<typeof bookPackage>;
export type SaveBookInput=z.infer<typeof saveBookInput>;
export function packageImages(content:BookPackage){
 const ids=new Set<string>(),builtins=new Set<string>();
 const references=[...content.assets.map(a=>a.image),...content.book.pages.flatMap(p=>p.elements.flatMap(e=>e.type==='photo'?[e.image]:[]))];
 for(const ref of references){if('imageId' in ref)ids.add(ref.imageId);else if('builtinPath' in ref)builtins.add(ref.builtinPath);}
 return {ids:[...ids],builtins:[...builtins]};
}
