import { z } from 'zod';
export const copySource=z.object({version:z.literal(1),kind:z.literal('copy'),operationId:z.string().uuid(),provider:z.enum(['ark','qwen','test']),model:z.string().max(120),generatedAt:z.number().int().nonnegative()}).strict();
