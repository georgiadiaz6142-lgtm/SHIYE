import { isAbsolute, resolve } from 'node:path';
import { publicOrigin } from './http-policy.js';

export function runtimeConfig(env: NodeJS.ProcessEnv) {
  const deployment = env.SHIYE_DEPLOYMENT || 'local';
  if (!['local', 'cloud-test'].includes(deployment)) throw new Error('尚未完成生产持久化验证，仅支持 local 或 cloud-test。');
  const cloud = deployment === 'cloud-test';
  const host = env.SHIYE_HOST || (cloud ? '0.0.0.0' : '127.0.0.1');
  if (host !== (cloud ? '0.0.0.0' : '127.0.0.1')) throw new Error('监听地址与部署模式不匹配。');
  const port = Number(env.SHIYE_PORT || (cloud ? '3000' : '4176'));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('端口配置无效。');
  if (!cloud && env.SHIYE_PUBLIC_ORIGIN) throw new Error('本机模式不能配置公网来源。');
  const origin = cloud ? publicOrigin(env.SHIYE_PUBLIC_ORIGIN || '') : undefined;
  if (cloud && (!env.SHIYE_RUNTIME_DIR || !isAbsolute(env.SHIYE_RUNTIME_DIR))) throw new Error('云端测试必须指定独立的绝对运行目录。');
  if (cloud && env.SHIYE_ALLOW_EPHEMERAL_TEST_DATA !== 'true') throw new Error('云端持久化尚未接入；仅可显式启用可丢弃数据的技术测试。');
  if (cloud && (!env.SHIYE_INITIAL_ADMIN_USERNAME || !env.SHIYE_INITIAL_ADMIN_PASSWORD)) throw new Error('云端测试需要通过受控环境配置初始管理员。');
  return { deployment, host, port, origin, runtime: resolve(env.SHIYE_RUNTIME_DIR || '.local/shiye'),
    administrator: cloud ? { username: env.SHIYE_INITIAL_ADMIN_USERNAME!, password: env.SHIYE_INITIAL_ADMIN_PASSWORD! } : resolve('.local/admin-account.txt') };
}
