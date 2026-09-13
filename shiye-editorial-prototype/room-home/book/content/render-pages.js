import {chapters} from './pages.js';
import {CanvasTexture,SRGBColorSpace} from '../../assets/room-custom-photos.js';

const BASE=new URL('./',import.meta.url),WIDTH=420,HEIGHT=570;
const images=new Map();
export async function loadPreviewImage(path,label='图片'){
  const image=new Image();image.src=path;
  try{await image.decode();}catch{
    // Embedded browsers may reject decode() for an ordinary cached image.
    // Read a fresh static response once and decode its independent blob instead.
    const name=new URL(path,location.href).pathname.split('/').pop();
    let response;
    try{response=await fetch(path,{cache:'reload',credentials:'same-origin',signal:AbortSignal.timeout(15000)});}
    catch{throw Error(`${label}请求未完成（${name}），请检查本地服务连接`);}
    if(!response.ok)throw Error(`${label}请求被拒绝或文件不可用（HTTP ${response.status}：${name}）`);
    const url=URL.createObjectURL(await response.blob());
    try{image.src=url;await image.decode();}
    catch{throw Error(`${label}已收到，但当前浏览器无法解码（${name}）`);}
    finally{URL.revokeObjectURL(url);}
  }
  return image;
}
async function imageFor(url){
  url=new URL(url,BASE).href;
  if(!images.has(url))images.set(url,loadPreviewImage(url,'书页图片'));
  return images.get(url);
}
const imageURL=style=>style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
const colorVisible=c=>c&&c!=='transparent'&&c!=='rgba(0, 0, 0, 0)';
function cover(ctx,image,x,y,w,h){
  const scale=Math.max(w/image.width,h/image.height),sw=w/scale,sh=h/scale;
  ctx.drawImage(image,(image.width-sw)/2,(image.height-sh)/2,sw,sh,x,y,w,h);
}
function paperPattern(ctx,element,x,y,w,h){
  const c=element.classList;
  const fill=color=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
  if(c.contains('cotton')){
    fill('#f7f3e9');ctx.strokeStyle='#d2c8b11c';ctx.lineWidth=.7;
    for(let i=0;i<w;i+=7){ctx.beginPath();ctx.moveTo(x+i,y);ctx.lineTo(x+i+3,y+h);ctx.stroke();}
    for(let i=0;i<h;i+=6){ctx.beginPath();ctx.moveTo(x,y+i);ctx.lineTo(x+w,y+i+2);ctx.stroke();}
  }
  if(c.contains('kraft')){
    fill('#e4d0ac');ctx.strokeStyle='#9b80531a';ctx.lineWidth=.7;
    for(let i=0;i<h;i+=13){ctx.beginPath();ctx.moveTo(x,y+i);ctx.lineTo(x+w,y+i+7);ctx.stroke();}
  }
  if(c.contains('letter')){fill('#f2e8cf');ctx.strokeStyle='#ab9c7933';ctx.lineWidth=1;for(let i=35;i<h;i+=28){ctx.beginPath();ctx.moveTo(x,y+i);ctx.lineTo(x+w,y+i);ctx.stroke();}}
  if(c.contains('dots')){ctx.fillStyle='#bfbda8';for(let i=7.5;i<w;i+=15)for(let j=7.5;j<h;j+=15){ctx.beginPath();ctx.arc(x+i,y+j,.65,0,Math.PI*2);ctx.fill();}}
  if(c.contains('grid')){ctx.strokeStyle='#bdc6b53b';ctx.lineWidth=1;for(let i=0;i<w;i+=20){ctx.beginPath();ctx.moveTo(x+i,y);ctx.lineTo(x+i,y+h);ctx.stroke();}for(let i=0;i<h;i+=20){ctx.beginPath();ctx.moveTo(x,y+i);ctx.lineTo(x+w,y+i);ctx.stroke();}}
}
function drawText(ctx,node,origin){
  const style=getComputedStyle(node.parentElement);
  ctx.font=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  ctx.fillStyle=style.color;ctx.textBaseline='alphabetic';
  const range=document.createRange(),size=parseFloat(style.fontSize);
  // Browser layout supplies glyph positions, preserving the approved line breaks,
  // fonts and spacing without running another layout engine or a screenshot service.
  for(let i=0;i<node.textContent.length;i++){
    const char=node.textContent[i];if(/\s/.test(char))continue;
    range.setStart(node,i);range.setEnd(node,i+1);const rect=range.getBoundingClientRect();if(!rect.width||!rect.height)continue;
    const metrics=ctx.measureText(char),ascent=metrics.fontBoundingBoxAscent??size*.86;
    ctx.fillText(char,rect.left-origin.left,rect.top-origin.top+ascent);
  }
}
async function paintElement(ctx,element,origin){
  const style=getComputedStyle(element);if(style.display==='none'||style.visibility==='hidden')return;
  const rect=element.getBoundingClientRect(),x=rect.left-origin.left,y=rect.top-origin.top,w=rect.width,h=rect.height;
  ctx.save();
  if(element.classList.contains('photo')||element.classList.contains('note-card')||element.classList.contains('tiny-book')){
    ctx.shadowColor='#38352022';ctx.shadowBlur=6;ctx.shadowOffsetY=3;ctx.fillStyle='#fffaf0';ctx.fillRect(x,y,w,h);ctx.shadowColor='transparent';
  }
  if(colorVisible(style.backgroundColor)){ctx.fillStyle=style.backgroundColor;ctx.fillRect(x,y,w,h);}
  if(element.classList.contains('paper'))paperPattern(ctx,element,x,y,w,h);
  const url=imageURL(style);
  if(url){const image=await imageFor(url);if(style.backgroundSize==='cover')cover(ctx,image,x,y,w,h);else ctx.drawImage(image,x,y,w,h);}
  for(const side of ['Top','Right','Bottom','Left']){
    const width=parseFloat(style[`border${side}Width`]);if(!width||style[`border${side}Style`]==='none')continue;
    ctx.strokeStyle=style[`border${side}Color`];ctx.lineWidth=width;ctx.setLineDash(style[`border${side}Style`]==='dashed'?[4,4]:[]);
    ctx.beginPath();if(side==='Top'){ctx.moveTo(x,y+width/2);ctx.lineTo(x+w,y+width/2);}if(side==='Bottom'){ctx.moveTo(x,y+h-width/2);ctx.lineTo(x+w,y+h-width/2);}if(side==='Left'){ctx.moveTo(x+width/2,y);ctx.lineTo(x+width/2,y+h);}if(side==='Right'){ctx.moveTo(x+w-width/2,y);ctx.lineTo(x+w-width/2,y+h);}ctx.stroke();
  }
  ctx.setLineDash([]);
  if(element.tagName==='IMG'){
    const image=await imageFor(element.src);const pl=parseFloat(style.paddingLeft),pt=parseFloat(style.paddingTop),iw=w-pl-parseFloat(style.paddingRight),ih=h-pt-parseFloat(style.paddingBottom);
    if(element.classList.contains('sticker')){ctx.shadowColor='#34362725';ctx.shadowBlur=2;ctx.shadowOffsetY=3;}
    if(style.objectFit==='cover')cover(ctx,image,x+pl,y+pt,iw,ih);
    else if(style.objectFit==='contain'){const ratio=Math.min(iw/image.width,ih/image.height);ctx.drawImage(image,x+pl+(iw-image.width*ratio)/2,y+pt+(ih-image.height*ratio)/2,image.width*ratio,image.height*ratio);}
    else ctx.drawImage(image,x+pl,y+pt,iw,ih);
    ctx.shadowColor='transparent';
  }
  if(element.tagName==='LI'){
    ctx.fillStyle='#7e8a6c';ctx.font=`${style.fontSize} ${style.fontFamily}`;ctx.fillText('□',x,y+parseFloat(style.paddingTop)+parseFloat(style.fontSize));
  }
  for(const child of element.childNodes){if(child.nodeType===Node.TEXT_NODE)drawText(ctx,child,origin);else if(child.nodeType===Node.ELEMENT_NODE)await paintElement(ctx,child,origin);}
  if(element.classList.contains('photo')){ctx.fillStyle='#c7b78380';ctx.fillRect(x+w/2-35,y-9,70,20);}
  if(element.classList.contains('folio')){ctx.fillStyle=element.closest('.texture-dark')?'#e6dfc833':'#777c6733';ctx.fillRect(x,y-10,w,1);}
  ctx.restore();
}

export async function makeAcceptedPageTextures(){
  const mount=document.createElement('div');mount.style.cssText='position:fixed;left:-10000px;top:0;width:840px;pointer-events:none;opacity:0;contain:layout style;';
  const shadow=mount.attachShadow({mode:'closed'});document.body.append(mount);
  try{
    await Promise.all(['papers.css','style.css'].map(name=>new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href=new URL(name,BASE).href;link.onload=resolve;link.onerror=()=>reject(Error(`书页样式加载失败: ${name}`));shadow.append(link);})));
    const style=document.createElement('style');style.textContent=':host{--serif:"Songti SC",STSong,"Noto Serif CJK SC",serif;font-family:var(--serif);color:#3d4937;font-size:16px}.page{position:relative!important;display:block!important;flex:none!important;width:420px!important;height:570px!important}.page::after{display:none!important}';shadow.append(style);
    const pages=chapters.flatMap(c=>c.pages),elements=[];
    for(const [i,p] of pages.entries()){
      const element=document.createElement('article');element.className=`page paper ${p.paper}`;
      element.innerHTML=p.html.replaceAll('src="assets/',`src="${new URL('assets/',BASE).href}`)+`<div class="folio"><span>拾页 · ${p.name}</span><span>${String(i+1).padStart(2,'0')}</span></div>`;
      shadow.append(element);elements.push(element);
    }
    const sources=new Set();for(const element of elements)for(const e of [element,...element.querySelectorAll('*')]){if(e.tagName==='IMG')sources.add(e.src);const url=imageURL(getComputedStyle(e));if(url)sources.add(url);}
    await Promise.all([...sources].map(imageFor));await document.fonts.ready;
    const textures=[];
    for(const element of elements){
      const canvas=document.createElement('canvas');canvas.width=WIDTH*2;canvas.height=HEIGHT*2;const ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.fillStyle='#fbf8eb';ctx.fillRect(0,0,WIDTH,HEIGHT);
      await paintElement(ctx,element,element.getBoundingClientRect());
      const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;texture.anisotropy=4;textures.push(texture);
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    return {frontLining:textures[0],pages:textures.slice(1,-1),backLining:textures.at(-1),pageTitles:pages.map(p=>p.title)};
  }finally{mount.remove();}
}
