import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import type { RequestHandler } from 'express';

const compress = promisify(gzip);
const assetPath = '/vendor/opencv-4.13.0/opencv.js';

// Compress only this public, versioned dependency. User media and API responses
// never enter this cache. One preparation is shared by concurrent requests.
export function edgeToolAssets(staticRoot: string): RequestHandler {
  let prepared: Promise<{ source: Buffer; compressed: Buffer; hash: string }> | undefined;
  const load = () => prepared ??= readFile(resolve(staticRoot, '.' + assetPath)).then(async source => ({
    source, compressed: await compress(source, { level: 9 }), hash: createHash('sha256').update(source).digest('hex'),
  })).catch(error => { prepared = undefined; throw error; });
  return async (req, res, next) => {
    if (req.path !== assetPath || !['GET', 'HEAD'].includes(req.method)) { next(); return; }
    try {
      const asset = await load();
      const compressed = !!req.headers['accept-encoding'] && req.acceptsEncodings('gzip') === 'gzip';
      res.vary('Accept-Encoding');
      res.setHeader('Cache-Control', req.query.v === asset.hash.slice(0, 12)
        ? 'public, max-age=31536000, immutable' : 'public, max-age=0');
      res.setHeader('ETag', '"' + asset.hash + (compressed ? '-gzip' : '-identity') + '"');
      res.type('application/javascript');
      if (compressed) res.setHeader('Content-Encoding', 'gzip');
      res.send(compressed ? asset.compressed : asset.source);
    } catch (error) { next(error); }
  };
}
