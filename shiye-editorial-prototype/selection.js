'use strict';

// Coordinates are always relative to the decoded image, never the letterboxed stage.
window.ShiyeSelection = {
  geometry(stage, image) {
    const r=stage.getBoundingClientRect(),scale=Math.min(r.width/image.naturalWidth,r.height/image.naturalHeight);
    const width=image.naturalWidth*scale,height=image.naturalHeight*scale;
    return {left:(r.width-width)/2,top:(r.height-height)/2,width,height,rect:r};
  },
  point(event,g,clamp=false) {
    const x=(event.clientX-g.rect.left-g.left)/g.width,y=(event.clientY-g.rect.top-g.top)/g.height;
    if(!clamp&&(x<0||x>1||y<0||y>1))return null;
    return {x:Math.max(0,Math.min(1,x)),y:Math.max(0,Math.min(1,y))};
  },
  bounds(points) {
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);
    return {x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y,points};
  },
  simplify(points,width,height) {
    if(points.length<4)return points.map(p=>({...p}));
    const lineDistance=(p,a,b)=>{const x=p.x*width,y=p.y*height,ax=a.x*width,ay=a.y*height,bx=b.x*width,by=b.y*height;
      const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));
      return Math.hypot(x-ax-t*dx,y-ay-t*dy);};
    const reduce=(a,epsilon)=>{let d=0,index=0;for(let i=1;i<a.length-1;i++){const next=lineDistance(a[i],a[0],a.at(-1));if(next>d){d=next;index=i;}}
      if(d<=epsilon)return [a[0],a.at(-1)];return [...reduce(a.slice(0,index+1),epsilon).slice(0,-1),...reduce(a.slice(index),epsilon)];};
    let epsilon=2,result=reduce(points,epsilon);
    while(result.length>100){epsilon*=1.5;result=reduce(points,epsilon);}
    return result.length>=3?result.map(p=>({...p})):points.map(p=>({...p}));
  }
};
