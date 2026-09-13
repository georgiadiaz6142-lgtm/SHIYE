import { createHash } from 'node:crypto';
import type { Admin } from './admin.js';
import { Fault } from '../shared/contracts.js';
import { taskGrant,type TaskGrant } from './cloud-tasks.js';
import type { CopyIdentity } from './ai-copy.js';

export async function captureTaskGrant(admin:Admin,accountToken?:string,inviteToken?:string):Promise<TaskGrant>{
  if(accountToken&&await admin.resolveSession(accountToken))return {type:'account',digest:createHash('sha256').update(accountToken).digest('hex')};
  return taskGrant.parse(await admin.access.taskGrant(inviteToken));
}
export async function resolveTaskIdentity(admin:Admin,value:TaskGrant,owner:string):Promise<CopyIdentity>{
  const grant=taskGrant.parse(value);
  if(grant.type==='account'){
    const account=await admin.resolveSessionDigest(grant.digest);
    if(account&&owner==='account:'+account.accountId){
      const user=(await admin.access.snapshot())?.users?.find(u=>u.id===account.accountId);
      return {owner,...(user?{inviteId:user.inviteId,registeredAt:user.createdAt,...(user.memberUntil&&user.memberUntil>Date.now()?{member:true}:{})}:{})};
    }
  }else if((owner==='invite:'+grant.inviteId||/^[a-f0-9]{64}$/.test(owner))&&await admin.access.resolveTaskGrant(grant))return {owner};
  throw new Fault(401,'TASK_ACCESS_REVOKED','登录或邀请资格已失效，本次任务已停止，请重新登录后操作。');
}
