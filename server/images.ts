import sharp from 'sharp';
import { Fault } from '../shared/contracts.js';

export const WIDTH = 600, HEIGHT = 400;
const shapes = [
  '<ellipse cx="155" cy="175" rx="80" ry="110"/>',
  '<path d="M310 65L410 150L365 285L255 210Z"/>',
  '<path d="M480 250L515 275L505 325L460 337L438 290Z"/>',
];
export async function fixture() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#eee5d2"/><g fill="#bd674e">${shapes[0]}</g><g fill="#6d8056">${shapes[1]}</g><g fill="#d3a249">${shapes[2]}</g></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
export async function mask(index: number) {
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="black"/><g fill="white">${shapes[index]}</g></svg>`)).png().toBuffer();
}
export async function normalize(bytes: Buffer) {
  const image = sharp(bytes, { limitInputPixels: 24_000_000, failOn: 'warning' });
  const metadata = await image.metadata();
  if (!['jpeg', 'png', 'webp'].includes(metadata.format || '') || (metadata.pages || 1) > 1)
    throw new Fault(422, 'INVALID_IMAGE', '请选择静态 JPG、PNG 或 WebP 图片。');
  return image.toColourspace('srgb').rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
}
export async function compose(source: Buffer, bytes: Buffer) {
  const img = await sharp(source, {limitInputPixels:24_000_000}).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const m = await sharp(bytes, {limitInputPixels:24_000_000}).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = img.info;
  if (m.info.width !== width || m.info.height !== height) throw new Fault(422, 'INVALID_MASK', '蒙版尺寸与原图不一致。');
  let x = width, y = height, right = -1, bottom = -1;
  for (let i = 0; i < width * height; i++) {
    const alpha = Math.round(img.data[i * 4 + 3] * m.data[i] / 255);
    img.data[i * 4 + 3] = alpha;
    if (alpha > 0) { const px = i % width, py = Math.floor(i / width); x = Math.min(x, px); y = Math.min(y, py); right = Math.max(right, px); bottom = Math.max(bottom, py); }
  }
  if (right < x) throw new Fault(422, 'INVALID_MASK', '结果没有可用主体。');
  const box = { x, y, width: right - x + 1, height: bottom - y + 1 };
  const png = await sharp(img.data, { raw: {width, height, channels:4} }).extract({left:x, top:y, width:box.width, height:box.height}).png().toBuffer();
  return { png, box };
}
export function fixtureTarget(points: {x:number;y:number}[]) {
  const p = points.reduce((a,p)=>({x:a.x+p.x/points.length,y:a.y+p.y/points.length}),{x:0,y:0});
  const centers=[{x:155/600,y:175/400},{x:330/600,y:175/400},{x:480/600,y:293/400}];
  return centers.map((c,i)=>({i,d:(c.x-p.x)**2+(c.y-p.y)**2})).sort((a,b)=>a.d-b.d)[0].i;
}

// Keep the exact normalized PNG as the source for both model coordinates and sticker RGB.
export async function normalizeBaidu(bytes: Buffer) {
  if(!bytes.length||bytes.length>10*1024*1024)throw new Fault(413,'INPUT_TOO_LARGE','图片不能超过 10 MB。');
  try {
    const input=await sharp(bytes,{limitInputPixels:false}).metadata();
    if(input.width!*input.height!>24_000_000)throw new Fault(422,'IMAGE_PIXEL_LIMIT','图片超过 2400 万像素，请降低分辨率后重新选择。');
    const png=await normalize(bytes), meta=await sharp(png).metadata();
    if(Math.min(meta.width!,meta.height!)<128)throw new Fault(422,'IMAGE_TOO_SMALL','规范化后的图片最短边需至少 128 像素。');
    if(4*Math.ceil(png.length/3)>10_000_000)throw new Fault(413,'PROVIDER_IMAGE_LIMIT','图片转换并编码后超过百度 10 MB 限制；原文件小于 10 MB 也可能出现。请降低分辨率后重新选择，照片尚未发送至百度。');
    return {png,width:meta.width!,height:meta.height!};
  }catch(e){if(e instanceof Fault)throw e;throw new Fault(422,'INVALID_IMAGE','图片无法读取，请选择静态 JPG、PNG 或 WebP。');}
}
