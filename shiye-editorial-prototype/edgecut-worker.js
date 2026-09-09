'use strict';
importScripts('edgecut-core.js', 'vendor/opencv-4.13.0/opencv.js');
const ready = new Promise(resolve => {
  if (cv.Mat) resolve();
  else if (cv.then) cv.then(() => resolve());
  else cv.onRuntimeInitialized = () => resolve();
});
self.onmessage = async ({ data }) => {
  try {
    await ready;
    const result = ShiyeGrabCut.segment(cv, data);
    self.postMessage({ ok: true, ...result }, [result.alpha.buffer]);
  } catch (error) {
    self.postMessage({ ok: false, message: typeof error?.message === 'string' ? error.message : '分割计算失败，请调整圈选或提示点后重试' });
  }
};
