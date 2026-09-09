'use strict';

// Classical GrabCut, not a semantic model. The polygon initializes probabilities;
// only distant background and explicit correction seeds are fixed labels.
globalThis.ShiyeGrabCut = {
  segment(cv, { rgba, width, height, region, seeds = [] }) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 8 || height < 8 ||
        width > 800 || height > 800 || rgba.length !== width * height * 4) throw Error('图片尺寸无效');
    const valid = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
    const points = region.points || [
      { x: region.x, y: region.y }, { x: region.x + region.w, y: region.y },
      { x: region.x + region.w, y: region.y + region.h }, { x: region.x, y: region.y + region.h }
    ];
    if (points.length < 3 || points.length > 2048 || !points.every(valid) || seeds.length > 100 ||
        !seeds.every(p => valid(p) && ['keep', 'remove'].includes(p.kind))) throw Error('选区或提示点无效');
    const inside = (x, y) => {
      let hit = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i], b = points[j];
        if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) hit = !hit;
      }
      return hit;
    };
    const extents = [...points, ...seeds.filter(p => p.kind === 'keep')];
    const left = Math.min(...extents.map(p => p.x)) - .04, right = Math.max(...extents.map(p => p.x)) + .04;
    const top = Math.min(...extents.map(p => p.y)) - .04, bottom = Math.max(...extents.map(p => p.y)) + .04;
    const owned = [], mat = (r, c, type) => { const m = new cv.Mat(r, c, type); owned.push(m); return m; };
    const started = performance.now();
    try {
      const input = mat(height, width, cv.CV_8UC4); input.data.set(rgba);
      const rgb = mat(height, width, cv.CV_8UC3); cv.cvtColor(input, rgb, cv.COLOR_RGBA2RGB);
      const mask = mat(height, width, cv.CV_8UC1);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const nx = (x + .5) / width, ny = (y + .5) / height, i = y * width + x;
        mask.data[i] = !rgba[i * 4 + 3] || nx < left || nx > right || ny < top || ny > bottom ? cv.GC_BGD :
          inside(nx, ny) ? cv.GC_PR_FGD : cv.GC_PR_BGD;
      }
      // A click labels a small neighborhood; it never traces or cuts a contour.
      const radius = Math.max(2, Math.round(Math.min(width, height) * .009));
      for (const seed of seeds) {
        const cx = Math.min(width - 1, Math.floor(seed.x * width)), cy = Math.min(height - 1, Math.floor(seed.y * height));
        for (let y = Math.max(0, cy - radius); y <= Math.min(height - 1, cy + radius); y++)
          for (let x = Math.max(0, cx - radius); x <= Math.min(width - 1, cx + radius); x++)
            if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2 && rgba[(y * width + x) * 4 + 3])
              mask.data[y * width + x] = seed.kind === 'keep' ? cv.GC_FGD : cv.GC_BGD;
      }
      let fg = 0, bg = 0;
      for (const label of mask.data) { if (label === cv.GC_FGD || label === cv.GC_PR_FGD) fg++; else bg++; }
      if (fg < 5 || bg < 5) throw Error('请缩小圈选范围，留出一部分背景');
      const bgModel = mat(1, 65, cv.CV_64FC1), fgModel = mat(1, 65, cv.CV_64FC1);
      bgModel.data64F.fill(0); fgModel.data64F.fill(0);
      cv.setRNGSeed(1701);
      cv.grabCut(rgb, mask, new cv.Rect(), bgModel, fgModel, 5, cv.GC_INIT_WITH_MASK);
      const alpha = new Uint8Array(width * height); let count = 0;
      for (let i = 0; i < alpha.length; i++) if ((mask.data[i] === cv.GC_FGD || mask.data[i] === cv.GC_PR_FGD) && rgba[i * 4 + 3]) {
        alpha[i] = rgba[i * 4 + 3]; count++;
      }
      if (count < 12) throw Error('还没找到完整主体，请在主体上添加保留点后重试');
      return { alpha, width, height, foregroundPixels: count, elapsedMs: Math.round(performance.now() - started), algorithm: 'opencv-grabcut-4.13.0' };
    } finally { for (const m of owned.reverse()) m.delete(); }
  }
};
