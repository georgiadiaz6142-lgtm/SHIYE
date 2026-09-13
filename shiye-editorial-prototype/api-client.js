// @ts-check
'use strict';

/** @typedef {{code?:string,status?:number,requestId?:string,retryable?:boolean,outcomeUnknown?:boolean}} ErrorDetails */
/** @typedef {RequestInit & {timeoutMs?:number}} RequestOptions */
// Shared transport only. Each feature retains its own identity, task and retry rules.
var ShiyeAPI = (() => {
  class RequestError extends Error {
    /** @param {string} message @param {ErrorDetails} [details] */
    constructor(message, details = {}) {
      super(message);
      this.name = 'RequestError';
      this.code = details.code || 'REQUEST_FAILED';
      this.errorType = this.code;
      this.status = details.status || 0;
      this.requestId = details.requestId;
      this.retryable = details.retryable === true;
      this.outcomeUnknown = details.outcomeUnknown === true;
    }
  }
  /** @param {unknown} value @returns {Record<string, unknown>} */
  function record(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? /** @type {Record<string, unknown>} */ (value) : {};
  }
  /** @param {Response} response */
  async function readJSON(response) {
    try { return /** @type {unknown} */ (await response.json()); }
    catch (error) {
      // Let cancellation reach the transport so timeout and cancellation stay distinct.
      if (error instanceof Error && error.name === 'AbortError') throw error;
      throw new RequestError('服务返回异常，请保留当前内容，稍后再试。', {
        code: 'INVALID_RESPONSE', status: response.status, outcomeUnknown: true,
      });
    }
  }
  /** @param {string} path @param {RequestOptions} options @param {boolean} parseJSON */
  async function send(path, options, parseJSON) {
    if (!path.startsWith('/api/') || path.includes('\\')) {
      throw new RequestError('请求地址无效。', {code: 'INVALID_REQUEST'});
    }
    const {timeoutMs = 15000, signal, ...init} = options;
    const controller = new AbortController();
    let timedOut = false;
    const cancel = () => controller.abort();
    if (signal?.aborted) cancel();
    else signal?.addEventListener('abort', cancel, {once: true});
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    const write = !['GET', 'HEAD'].includes((init.method || 'GET').toUpperCase());
    try {
      const response = await fetch(path, {...init, credentials: 'same-origin', cache: 'no-store', signal: controller.signal});
      if (!response.ok) {
        const data = record(await readJSON(response)), error = record(data.error);
        const fallback = response.status === 401 ? '登录状态已失效，请保留当前内容并重新登录。'
          : response.status === 403 ? '当前账号没有此操作权限。'
          : response.status === 429 ? '操作过于频繁，请稍后再试。'
          : '操作暂未完成，请保留当前内容，稍后再试。';
        throw new RequestError(typeof error.message === 'string' ? error.message : fallback, {
          code: typeof error.errorType === 'string' ? error.errorType : 'HTTP_ERROR',
          status: response.status,
          requestId: typeof data.requestId === 'string' ? data.requestId : undefined,
          retryable: error.retryable === true,
        });
      }
      return parseJSON ? await readJSON(response) : response;
    } catch (error) {
      if (timedOut) throw new RequestError(write
        ? '等待服务响应超时，提交结果尚未确认。请保留当前内容，先检查原操作结果。'
        : '连接服务超时，请检查网络后重试。', {code:'REQUEST_TIMEOUT', outcomeUnknown:write, retryable:!write});
      if (signal?.aborted) throw new RequestError('已停止等待，已提交的操作可能仍在处理。', {code:'REQUEST_CANCELLED', outcomeUnknown:write});
      if (error instanceof RequestError) throw error;
      throw new RequestError(write
        ? '连接中断，提交结果尚未确认。请保留当前内容，先检查原操作结果。'
        : '暂时无法连接服务，请检查网络后重试。', {code:'LOCAL_CONNECTION_FAILED',outcomeUnknown:write,retryable:!write});
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }
  /** @param {string} path @param {RequestOptions} [options] */
  async function json(path, options = {}) { return send(path, options, true); }
  /** @param {string} path @param {RequestOptions} [options] @returns {Promise<Response>} */
  async function response(path, options = {}) { return /** @type {Response} */ (await send(path, options, false)); }
  return {json, response, RequestError};
})();
