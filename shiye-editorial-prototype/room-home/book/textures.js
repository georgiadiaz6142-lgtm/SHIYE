import * as THREE from '../assets/room-custom-photos.js';
import {makeAcceptedPageTextures,loadPreviewImage} from './content/render-pages.js';

const PW=768, PH=1056;
let seed=1729;
function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
function canvas(w=PW,h=PH){const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')];}
function texture(c){const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
function type(ctx,s,x,y,size=24,color='#615a44',align='left',family='"Songti SC",STSong,serif'){
  ctx.font=`${size}px ${family}`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(s,x,y);
}
function rule(c,x,y,w,color='#b9af8f'){c.strokeStyle=color;c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.lineTo(x+w,y);c.stroke();}
function photo(c,img,x,y,w,h,angle=0){
  c.save();c.translate(x+w/2,y+h/2);c.rotate(angle);
  c.shadowColor='#3d341b35';c.shadowBlur=11;c.shadowOffsetY=5;c.fillStyle='#fcf6e7';c.fillRect(-w/2-12,-h/2-12,w+24,h+40);c.shadowColor='transparent';
  const crop=Math.max(w/img.width,h/img.height),sw=w/crop,sh=h/crop;
  c.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,-w/2,-h/2,w,h);c.restore();
}
function tape(c,x,y,w,angle=-.07){c.save();c.translate(x,y);c.rotate(angle);c.fillStyle='#c5b68f95';c.fillRect(-w/2,-13,w,26);c.strokeStyle='#e7dcc04d';for(let i=-w/2;i<w/2;i+=7){c.beginPath();c.moveTo(i,-12);c.lineTo(i+8,12);c.stroke();}c.restore();}
function sprig(c,x,y,scale=1,color='#657452'){
  c.save();c.translate(x,y);c.scale(scale,scale);c.lineWidth=2;c.strokeStyle=color;c.fillStyle=color;c.beginPath();c.moveTo(0,0);c.bezierCurveTo(-20,-70,18,-120,-8,-210);c.stroke();
  for(let i=0;i<8;i++){const yy=-25-i*23,side=i%2?1:-1,xx=Math.sin(i*.8)*8;c.save();c.translate(xx,yy);c.rotate(side*.58);c.beginPath();c.ellipse(side*17,-15,11,28,side*.55,0,Math.PI*2);c.globalAlpha=.75;c.fill();c.restore();}c.restore();
}
function paper(page){
  const [c,g]=canvas();g.fillStyle='#eee6ce';g.fillRect(0,0,PW,PH);
  for(let i=0;i<19000;i++){const a=random()*.035;g.fillStyle=`rgba(95,71,36,${a})`;g.fillRect(random()*PW,random()*PH,random()*2+1,1);}
  const edge=g.createLinearGradient(0,0,PW,0);edge.addColorStop(0,'#6b553a20');edge.addColorStop(.09,'#6b553a00');edge.addColorStop(.92,'#6b553a00');edge.addColorStop(1,'#6b553a0c');g.fillStyle=edge;g.fillRect(0,0,PW,PH);
  if(page!==null){rule(g,70,975,628,'#bcb19570');type(g,'拾页 · 生活收藏',72,1009,14,'#8b8269');type(g,String(page).padStart(2,'0'),696,1009,16,'#8b8269','right','Georgia,serif');}
  return [c,g];
}
const load=src=>loadPreviewImage(src,'书本图片');

export async function makeTextures(){
  const [mountain,dogs,sheep]=await Promise.all(['mountains','dogs','sheep'].map(s=>load(`/room-home/book/assets/${s}.jpg`)));
  const [cloth,cc]=canvas(256,256);cc.fillStyle='#647054';cc.fillRect(0,0,256,256);
  for(let i=0;i<256;i+=2){cc.strokeStyle=i%4?'#ffffff0d':'#1929161c';cc.lineWidth=.7;cc.beginPath();cc.moveTo(i,0);cc.lineTo(i,256);cc.stroke();cc.beginPath();cc.moveTo(0,i);cc.lineTo(256,i);cc.stroke();}
  const clothTex=texture(cloth);clothTex.wrapS=clothTex.wrapT=THREE.RepeatWrapping;clothTex.repeat.set(5,7);
  const [cover,c]=canvas();c.fillStyle=c.createPattern(cloth,'repeat');c.fillRect(0,0,PW,PH);
  const grad=c.createLinearGradient(0,0,90,0);grad.addColorStop(0,'#15251290');grad.addColorStop(.25,'#a5ac7660');grad.addColorStop(.42,'#1c321851');grad.addColorStop(1,'#18301800');c.fillStyle=grad;c.fillRect(0,0,90,PH);
  c.strokeStyle='#cdbb8490';c.lineWidth=1.3;c.strokeRect(76,67,620,920);c.strokeStyle='#cdbb8435';c.strokeRect(83,74,606,906);
  type(c,'SHIYE',402,145,21,'#dfd0a5','center','Georgia,serif');
  type(c,'拾页',400,296,104,'#e8ddbc','center');
  type(c,'把日子，慢慢收好。',400,354,27,'#d6cda9','center');
  c.save();c.beginPath();c.roundRect(222,425,358,352,[170,170,2,2]);c.clip();const sc=Math.max(358/mountain.width,352/mountain.height);c.drawImage(mountain,222+(358-mountain.width*sc)/2,425+(352-mountain.height*sc)/2,mountain.width*sc,mountain.height*sc);c.fillStyle='#89976b23';c.fillRect(222,425,358,352);c.restore();
  c.strokeStyle='#d5c797';c.lineWidth=2;c.beginPath();c.roundRect(219,422,364,358,[173,173,2,2]);c.stroke();
  type(c,'A COLLECTION OF LITTLE MOMENTS',402,846,15,'#cec7a3','center','Georgia,serif');rule(c,366,878,72,'#c7bb8c');type(c,'VOL. 01',402,929,17,'#d6cbaa','center','Georgia,serif');
  const coverTex=texture(cover);
  const [lining,l]=paper(null);l.fillStyle='#79836820';for(let y=0;y<PH;y+=90)for(let x=0;x<PW;x+=90){l.beginPath();l.ellipse(x+45,y+45,5,18,-.6,0,6.29);l.fill();}
  l.fillStyle='#f2ebd7';l.fillRect(169,377,430,240);l.strokeStyle='#aca78d';l.strokeRect(183,391,402,212);type(l,'此间，收藏生活。',384,482,30,'#686e55','center');type(l,'THIS BOOK BELONGS TO',384,533,12,'#8e8c72','center','Georgia,serif');rule(l,257,572,254,'#b7ae8d');
  const liningTex=texture(lining);
  const pages=[];
  {
    const [c,g]=paper(1);type(g,'拾页 / PERSONAL JOURNAL',76,109,15,'#8b8a6a');
    type(g,'把日子，',82,269,65,'#4c563e');type(g,'慢慢收好。',82,354,65,'#4c563e');
    sprig(g,603,714,1.22,'#7b8663');
    type(g,'从照片里拾起喜欢的片刻，',84,477,26);type(g,'做成贴纸，',84,525,26);type(g,'收进只属于你的手帐。',84,573,26);
    rule(g,84,720,80);type(g,'山野、日常，和那些舍不得忘记的小事。',84,778,22);type(g,'一张照片 · 一枚贴纸 · 一本自己的书',84,837,19,'#8b8167');pages.push(texture(c));
  }
  {
    const [c,g]=paper(2);type(g,'01  /  山野来信',76,103,17,'#7b805d');photo(g,mountain,94,160,568,536,-.025);tape(g,374,151,155,.06);
    type(g,'那天，云很低。',94,792,41,'#535e43');type(g,'没有赶路，只看云慢慢越过山顶。',96,854,23);type(g,'一些山野，一些自由。',96,898,20,'#8a846b');pages.push(texture(c));
  }
  {
    const [c,g]=paper(3);type(g,'把山风，',81,169,55,'#566147');type(g,'夹进书里。',81,245,55,'#566147');
    g.fillStyle='#d4d3b260';g.save();g.translate(150,387);g.rotate(.04);g.fillRect(0,0,492,400);g.restore();photo(g,mountain,144,391,457,358,.045);tape(g,350,395,119,-.12);sprig(g,106,908,.65,'#8c8d69');
    type(g,'收藏的不是风景，',258,855,24);type(g,'是当时的自己。',258,899,24);pages.push(texture(c));
  }
  {
    const [c,g]=paper(4);type(g,'02  /  普通日子的礼物',76,103,17,'#7b805d');photo(g,dogs,92,172,575,486,.025);tape(g,177,165,128,-.17);tape(g,586,662,126,-.17);
    type(g,'阳光正好。',100,789,49,'#5e6346');type(g,'躺一会儿，也算认真生活。',100,852,25);type(g,'这一页，留给无所事事的快乐。',100,903,21,'#8a8167');pages.push(texture(c));
  }
  {
    const [c,g]=paper(5);type(g,'一些小事，',80,165,48,'#5b6147');type(g,'也值得一页。',80,230,48,'#5b6147');
    photo(g,sheep,155,325,442,359,-.03);tape(g,390,317,133,.12);
    type(g,'今天的小小清单',91,800,25);for(const [i,s] of ['慢一点，看看身边。','把喜欢，留下来。'].entries()){g.strokeStyle='#a6a584';g.strokeRect(95,837+i*51,16,16);type(g,s,130,854+i*51,23);}pages.push(texture(c));
  }
  {
    const [c,g]=paper(6);type(g,'下一页，',384,316,60,'#5a644a','center');type(g,'就写你的故事。',384,404,51,'#5a644a','center');sprig(g,407,739,1.02,'#818c69');type(g,'把照片里的喜欢，变成书里的一枚贴纸。',384,854,23,'#756b53','center');type(g,'拾页 SHIYE',384,913,18,'#8c846b','center');pages.push(texture(c));
  }
  const [wood,w]=canvas(1024,1024);w.fillStyle='#ad9575';w.fillRect(0,0,1024,1024);
  for(let y=0;y<1024;y++){w.strokeStyle=`rgba(${random()>.5?'69,39,18':'235,199,145'},${.02+random()*.11})`;w.lineWidth=.5+random()*1.5;w.beginPath();for(let x=0;x<=1024;x+=12){const yy=y+Math.sin(x*.009+y*.023)*2.4+Math.sin(x*.025+y)*.7;x?w.lineTo(x,yy):w.moveTo(x,yy);}w.stroke();}
  const woodTex=texture(wood);woodTex.wrapS=woodTex.wrapT=THREE.RepeatWrapping;woodTex.repeat.set(12,12);
  const [edge,e]=canvas(128,256);e.fillStyle='#e2d7b7';e.fillRect(0,0,128,256);for(let y=0;y<256;y+=5){e.strokeStyle=y%10?'#b5a58490':'#f5e9cc';e.lineWidth=1;e.beginPath();e.moveTo(0,y);e.lineTo(128,y+random());e.stroke();}
  const accepted=await makeAcceptedPageTextures();
  pages.forEach(page=>page.dispose());
  return {cover:coverTex,cloth:clothTex,lining:liningTex,wood:woodTex,edge:texture(edge),...accepted};
}
