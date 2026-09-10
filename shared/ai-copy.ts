import { z } from 'zod';
import { workId } from './works.js';
export const copyInput=z.object({
 operationId:z.string().uuid(),bookId:workId,pageId:workId,sourceRevision:z.string().regex(/^[a-f0-9]{64}$/),
 mode:z.enum(['generate','polish']),draft:z.string().trim().max(800).default(''),topic:z.string().trim().max(300).default(''),
 date:z.string().max(10).regex(/^(?:\d{4}-\d{2}-\d{2})?$/).default(''),place:z.string().trim().max(60).default(''),mood:z.string().trim().max(40).default(''),
 tone:z.enum(['natural','gentle','concise']).default('natural'),thumbnail:z.string().max(200000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/).optional(),
}).strict().superRefine((v,c)=>{if(v.mode==='polish'&&!v.draft)c.addIssue({code:'custom',message:'请先写一点草稿。'});if(!v.thumbnail&&!v.draft&&!v.topic&&!v.place&&!v.mood)c.addIssue({code:'custom',message:'请填写想记录的内容，或在当前页放入贴纸。'});});
export type CopyInput=z.infer<typeof copyInput>;
export { copySource } from './copy-source.js';
export const copyUsage=z.object({inputTokens:z.number().int().nonnegative(),outputTokens:z.number().int().nonnegative()}).strict();
export type CopyUsage=z.infer<typeof copyUsage>;
