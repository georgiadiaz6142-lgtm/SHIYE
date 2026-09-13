// @ts-check
'use strict';

// Display-only thumbnails. Never writes to assets, IndexedDB or the editable book.
var ShiyeStickerPreview = (() => {
  /** @type {Map<string, Promise<string|null>>} */
  const cache = new Map();
  /** @type {WeakSet<HTMLImageElement>} */
  const pending = new WeakSet(), prepared = new WeakSet();
  let generation = 0;

  /** @param {HTMLImageElement} image @returns {Promise<string|null>} */
  async function thumbnail(image) {
    const width = image.naturalWidth, height = image.naturalHeight;
    if (!width || !height) return null;
    // Bound alpha scanning and thumbnail memory even for full-resolution photos.
    const ratio = Math.min(1, 1024 / Math.max(width, height));
    const scan = document.createElement('canvas');
    scan.width = Math.max(1, Math.round(width * ratio));
    scan.height = Math.max(1, Math.round(height * ratio));
    const context = scan.getContext('2d', {willReadFrequently:true});
    if (!context) return null;
    context.drawImage(image, 0, 0, scan.width, scan.height);
    const pixels = context.getImageData(0, 0, scan.width, scan.height).data;
    let left = scan.width, top = scan.height, right = -1, bottom = -1;
    for (let y = 0; y < scan.height; y++) for (let x = 0; x < scan.width; x++) {
      if (pixels[(y * scan.width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    if (right < left || bottom < top) return null;
    // Include all nonzero alpha, with sampling padding for soft edges and white borders.
    left = Math.max(0, left - 2); top = Math.max(0, top - 2);
    right = Math.min(scan.width, right + 3); bottom = Math.min(scan.height, bottom + 3);
    const sx = left / scan.width * width, sy = top / scan.height * height;
    const sw = (right - left) / scan.width * width, sh = (bottom - top) / scan.height * height;
    const scale = Math.min(1, 512 / Math.max(sw, sh));
    const result = document.createElement('canvas');
    result.width = Math.max(1, Math.round(sw * scale));
    result.height = Math.max(1, Math.round(sh * scale));
    const output = result.getContext('2d');
    if (!output) return null;
    output.drawImage(image, sx, sy, sw, sh, 0, 0, result.width, result.height);
    return result.toDataURL('image/png');
  }

  /** @param {HTMLImageElement} image */
  async function prepare(image) {
    if (prepared.has(image) || pending.has(image) || !image.naturalWidth) return;
    const source = image.currentSrc || image.src, version = generation;
    pending.add(image);
    try {
      if (!cache.has(source)) {
        // Yield so a grid of newly loaded cards does not monopolize a single frame.
        cache.set(source, new Promise(resolve => setTimeout(resolve, 0)).then(() => thumbnail(image)).catch(() => null));
        while (cache.size > 32) cache.delete(/** @type {string} */ (cache.keys().next().value));
      }
      const url = await cache.get(source);
      if (!url) return;
      const decoded = new Image(); decoded.src = url; await decoded.decode();
      if (version !== generation || !image.isConnected || (image.currentSrc || image.src) !== source) return;
      prepared.add(image);
      image.src = url;
      image.dataset.previewReady = 'true';
    } catch {
      // Unsupported/cross-origin images retain the original contained preview.
    } finally { pending.delete(image); }
  }
  document.addEventListener('load', event => {
    const image = event.target;
    if (image instanceof HTMLImageElement && image.hasAttribute('data-sticker-preview')) void prepare(image);
  }, true);
  return {clear() {generation++;cache.clear();}};
})();
