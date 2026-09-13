'use strict';
// Only the versioned client receives lifecycle messages; an already open older
// page can still finish using the original one-message request/response contract.
const lifecycle = new URL(self.location.href).searchParams.get('v') === '20260912-reuse-1';
const ready = new Promise((resolve, reject) => {
  try {
    importScripts('edgecut-core.js', 'vendor/opencv-4.13.0/opencv.js?v=63366510248a');
    if (cv.Mat) resolve();
    else if (cv.then) cv.then(() => resolve(), reject);
    else { cv.onRuntimeInitialized = () => resolve(); cv.onAbort = () => reject(Error('初始化失败')); }
  } catch (error) { reject(error); }
});
ready.then(() => { if(lifecycle)self.postMessage({type:'ready'}); }, () => { if(lifecycle)self.postMessage({type:'load-error'}); });
self.onmessage = async ({ data }) => {
  const input = data.type === 'segment' ? data.input : data;
  try {
    await ready;
    const result = ShiyeGrabCut.segment(cv, input);
    self.postMessage({ type:'result', id:data.id, ok: true, ...result }, [result.alpha.buffer]);
  } catch (error) {
    self.postMessage({ type:'result', id:data.id, ok: false, message: typeof error?.message === 'string' ? error.message : '分割计算失败，请调整圈选或提示点后重试' });
  }
};
