/* Native adaptation of the pointer/proximity interaction supplied with Vue Bits
 * SpecularButton (https://vue-bits.dev/components/specular-button).
 * CSS draws the paired rim highlights; no Vue or per-button WebGL context.
 */
(()=>{
 const selector='button:is(.primary,.button.dark,.room-create,.room-account:not(.is-account),.preloader__btn,.save-use):not(.danger):not([data-no-specular])';
 const motion=matchMedia('(prefers-reduced-motion: reduce)'),items=new Map();
 let pointer=null,frame=0,last=0,needsScan=true;
 const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
 function request(){if(!frame&&!document.hidden)frame=requestAnimationFrame(update);}
 function scan(){
  needsScan=false;
  for(const [button,item] of items){
   if(!button.isConnected||!button.matches(selector)){
    item.rim.remove();button.classList.remove('specular-button','specular-position');items.delete(button);
   }
  }
  for(const button of document.querySelectorAll(selector)){
   let item=items.get(button);
   if(!item){
    const rim=document.createElement('span');rim.className='specular-rim';rim.setAttribute('aria-hidden','true');
    if(getComputedStyle(button).position==='static')button.classList.add('specular-position');
    button.classList.add('specular-button');item={rim,angle:2.4,brightness:0};items.set(button,item);
   }
   // Existing code may replace a button's label while retaining the button.
   if(item.rim.parentNode!==button)button.append(item.rim);
  }
 }
 function update(now){
  frame=0;
  if(needsScan)scan();
  const dt=Math.min((now-last)/1000||.016,.05);last=now;
  let unsettled=false;
  for(const [button,item] of items){
   const rect=button.getBoundingClientRect();let target=0,angle=item.angle;
   const enabled=!button.matches(':disabled,[aria-disabled="true"]');
   if(pointer&&!motion.matches&&enabled&&rect.width&&rect.height&&rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth&&getComputedStyle(button).visibility==='visible'){
    const dx=Math.max(rect.left-pointer.x,0,pointer.x-rect.right),dy=Math.max(rect.top-pointer.y,0,pointer.y-rect.bottom);
    const distance=Math.hypot(dx,dy),t=Math.max(0,1-distance/250);
    target=t*t*(3-2*t);
    if(target>0){
     const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
     angle=distance===0?Math.atan2(2/rect.height,-2/rect.width)+(pointer.x-cx)/(rect.width/2)*.3+(cy-pointer.y)/(rect.height/2)*.15:Math.atan2(cy-pointer.y,pointer.x-cx);
    }
   }
   const diff=wrap(angle-item.angle);
   item.angle+=diff*(1-Math.exp(-dt*7));
   item.brightness+= (target-item.brightness)*(1-Math.exp(-dt*8));
   if(!enabled||motion.matches)item.brightness=0;
   if(Math.abs(target-item.brightness)<.002)item.brightness=target;
   item.rim.style.setProperty('--specular-angle',`${90-item.angle*180/Math.PI}deg`);
   item.rim.style.setProperty('--specular-brightness',String(item.brightness));
   if(Math.abs(target-item.brightness)>.002||(target>0&&Math.abs(diff)>.002))unsettled=true;
  }
  if(unsettled)request(); // No perpetual animation when the pointer is still.
 }
 document.addEventListener('pointermove',event=>{
  pointer=event.pointerType==='touch'?null:{x:event.clientX,y:event.clientY};request();
 },{passive:true});
 const clear=()=>{pointer=null;request();};
 document.documentElement.addEventListener('pointerleave',clear);
 window.addEventListener('blur',clear);
 window.addEventListener('resize',request,{passive:true});
 document.addEventListener('scroll',request,{capture:true,passive:true});
 motion.addEventListener('change',clear);
 document.addEventListener('visibilitychange',()=>{
  pointer=null;
  if(document.hidden){cancelAnimationFrame(frame);frame=0;for(const item of items.values()){item.brightness=0;item.rim.style.setProperty('--specular-brightness','0');}}
  else request();
 });
 new MutationObserver(()=>{needsScan=true;request();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','disabled','aria-disabled']});
 request();
})();
