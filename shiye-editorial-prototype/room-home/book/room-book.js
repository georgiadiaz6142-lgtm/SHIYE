import * as T from '../assets/room-custom-photos.js';
import { Book } from './book.js';
import { makeTextures } from './textures.js';
import { roomBridge } from '../integration.js';
import { loadPreviewImage } from './content/render-pages.js';

const {experience: app, gsap}=T;
const canvas=document.querySelector('#experience-canvas');
const loadRoomTexture=path=>loadPreviewImage(path,'房间贴图');
const waitForRoom=()=>new Promise(resolve=>{
  const check=()=>app.world?.raycaster && app.world?.room?.bookGoboNode ? resolve() : setTimeout(check,40);
  check();
});

// Restore the printed grid beneath the removed house. Keep the original atlas
// everywhere outside its baked house footprint (including scissors and rulers).
async function cleanHouseShadow(mode){
  const image=await loadRoomTexture(`/room-home/textures/${mode}/first-house_${mode}.webp`);
  const c=document.createElement('canvas');c.width=c.height=4096;
  const g=c.getContext('2d');g.drawImage(image,0,0);
  g.scale(2.56,2.56);g.save();g.beginPath();
  [[310,812],[720,812],[816,1040],[808,1162],[751,1242],[741,1310],[630,1310],[608,1272],[517,1272],[512,1238],[464,1238],[423,1127]].forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.clip();
  const gradient=g.createLinearGradient(300,810,800,1320);
  gradient.addColorStop(0,mode==='day'?'#306b76':'#082d39');gradient.addColorStop(1,mode==='day'?'#316b77':'#082c38');
  g.fillStyle=gradient;g.fillRect(300,810,530,520);
  g.strokeStyle=mode==='day'?'#adae95':'#626961';g.lineWidth=1.6;
  for(let i=0;i<=33;i++){const top=75+i*(1163/33);g.beginPath();g.moveTo(top,874);g.lineTo(top-37,1540);g.stroke();}
  for(let i=0;i<=14;i++){const y=874+i*(666/14);g.beginPath();g.moveTo(75-(y-874)*37/666,y);g.lineTo(1238-(y-874)*37/666,y);g.stroke();}
  for(const [x1,y1,x2,y2] of [[111,874,968,1493],[567,874,39,1493],[744,874,1204,1493],[40,1493,1238,874]]){
    g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();
  }
  g.restore();const tex=new T.CanvasTexture(c);tex.flipY=false;tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;return tex;
}

async function cleanWallShadow(mode){
  const image=await loadRoomTexture(`/room-home/textures/${mode}/fifth-background_${mode}.webp`);
  const c=document.createElement('canvas');c.width=c.height=4096;const g=c.getContext('2d');g.drawImage(image,0,0);
  const patch=document.createElement('canvas');patch.width=244;patch.height=141;const ctx=patch.getContext('2d');
  ctx.drawImage(image,340*2.56,407*2.56,95*2.56,55*2.56,0,0,244,141);
  ctx.globalCompositeOperation='destination-in';ctx.filter='blur(5px)';ctx.fillStyle='#000';ctx.fillRect(7,7,230,127);
  g.drawImage(patch,708*2.56,407*2.56);
  // Replace the old wall lettering in its atlas region with the product wordmark.
  g.save();g.scale(2.56,2.56);
  g.drawImage(image,760*2.56,735*2.56,76*2.56,52*2.56,778,443,76,52);
  g.translate(816,470);g.rotate(Math.PI);g.textAlign='center';g.fillStyle=mode==='day'?'#51482f':'#34382c';
  g.font='19px "Songti SC", STSong, serif';g.fillText('拾页',0,0);
  g.font='7px Georgia,serif';g.fillText('S H I Y E',0,14);g.restore();
  const texture=new T.CanvasTexture(c);texture.flipY=false;texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return texture;
}

async function main(){
  const [textures,day,night,wallDay,wallNight]=await Promise.all([makeTextures(),cleanHouseShadow('day'),cleanHouseShadow('night'),cleanWallShadow('day'),cleanWallShadow('night'),waitForRoom()]);
  const room=app.world.room,ray=app.world.raycaster,camera=app.camera.instance;
  const original=room.model.getObjectByName('First_House_Baked');
  const geometry=original.geometry.clone(),p=geometry.attributes.position,uv=geometry.attributes.uv,index=geometry.index;
  const kept=[];let removed=0,letteringRemoved=0;
  for(let j=0;j<index.count;j+=3){
    const ids=[index.getX(j),index.getX(j+1),index.getX(j+2)];
    const inside=ids.every(i=>{
      const x=p.getX(i)+original.position.x,y=p.getY(i)+original.position.y,z=p.getZ(i)+original.position.z;
      return x>-3.05&&x<.85&&y>-1.37&&y<2.3&&z>-27.9&&z<-24.5;
    });
    const mat=ids.every(i=>Math.abs(p.getY(i)+original.position.y+1.3470928669)<.0001);
    const lettering=ids.every(i=>{const v=new T.Vector3().fromBufferAttribute(p,i);original.localToWorld(v);return v.x>-10.5&&v.x<-5.5&&v.y>1.0&&v.y<4.5&&v.z>-31.1&&v.z<-30.1;});
    if(lettering)letteringRemoved++;
    if(inside&&!mat||lettering)removed++;else kept.push(...ids);
  }
  geometry.setIndex(kept);geometry.computeBoundingSphere();original.geometry=geometry;
  original.children.filter(o=>o.userData.isOutline).forEach(outline=>{outline.geometry.setIndex(kept);outline.geometry.computeBoundingSphere();});
  const blend=T.mix(T.texture(day,T.uv()),T.texture(night,T.uv()),room.uDayNight);
  original.material.colorNode=blend.rgb.mul(room.bookGoboNode);original.material.opacityNode=blend.a;original.material.needsUpdate=true;
  const wall=room.model.getObjectByName('Fifth_Background_Baked');
  canvas.dataset.wallLetteringRemoved=String(letteringRemoved);
  const wallBlend=T.mix(T.texture(wallDay,T.uv()),T.texture(wallNight,T.uv()),room.uDayNight);
  wall.material.colorNode=wallBlend.rgb.mul(room.bookGoboNode);wall.material.opacityNode=wallBlend.a;wall.material.needsUpdate=true;

  const decorate=source=>{
    const material=new T.MeshBasicNodeMaterial({side:source.side});
    const map=source.map;
    const sampleUV=map?T.uv().mul(T.vec2(map.repeat.x,map.repeat.y)).add(T.vec2(map.offset.x,map.offset.y)):null;
    const base=map?T.texture(map,sampleUV).rgb:T.vec3(source.color.r,source.color.g,source.color.b);
    const light=T.normalWorld.y.abs().mul(.30).add(.70);
    const warmth=T.mix(T.vec3(.80,.72,.49),T.vec3(.13,.16,.12),room.uDayNight);
    material.colorNode=base.mul(light).mul(warmth).mul(room.bookGoboNode);
    source.dispose();return material;
  };
  const book=new Book(textures,decorate),placement=new T.Group();
  // Reuse the exact SHIYE cover on the existing standing book's two face triangles.
  // Keep its original body, lean and position; all other decor remains untouched.
  const decor=room.model.getObjectByName('Eighth_Decor_Baked');
  const coverPositions=[],coverNormals=[],coverUVs=[],bodyIndices=[];
  const dp=decor.geometry.attributes.position,dn=decor.geometry.attributes.normal,du=decor.geometry.attributes.uv,di=decor.geometry.index;
  for(let j=0;j<di.count;j+=3){
    const ids=[di.getX(j),di.getX(j+1),di.getX(j+2)];
    if(!ids.every(i=>du.getX(i)>.001&&du.getX(i)<.325&&du.getY(i)>.784&&du.getY(i)<.999)){bodyIndices.push(...ids);continue;}
    for(const i of ids){
      coverPositions.push(dp.getX(i),dp.getY(i),dp.getZ(i));
      coverNormals.push(dn.getX(i),dn.getY(i),dn.getZ(i));
      coverUVs.push(du.getY(i)>.89?1:0,du.getX(i)>.16?1:0);
    }
  }
  if(coverPositions.length!==18)throw Error('Standing book cover face changed; expected two triangles');
  // Replace the old face rather than layering over it. The room's animated
  // vertex jitter can otherwise move the white cover through the green cover.
  const bodyGeometry=decor.geometry.clone();bodyGeometry.setIndex(bodyIndices);bodyGeometry.computeBoundingSphere();decor.geometry=bodyGeometry;
  for(const outline of decor.children.filter(o=>o.userData.isOutline)){
    outline.geometry.setIndex(bodyIndices);outline.geometry.computeBoundingSphere();
  }
  canvas.dataset.standingBookOldFaceTrianglesRemoved=String((di.count-bodyIndices.length)/3);
  const coverGeometry=new T.BufferGeometry();
  coverGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(coverPositions),3));
  coverGeometry.setAttribute('normal',new T.BufferAttribute(new Float32Array(coverNormals),3));
  coverGeometry.setAttribute('uv',new T.BufferAttribute(new Float32Array(coverUVs),2));
  const standingCover=new T.Mesh(coverGeometry,decorate(new T.MeshStandardMaterial({map:textures.cover})));
  standingCover.name='SHIYE_Standing_Book_Cover';decor.add(standingCover);
  const explanationPaper=room.model.getObjectByName('Ninth_Attachment_Texts');
  if(explanationPaper){explanationPaper.visible=false;explanationPaper.removeFromParent();}
  ray._textsMesh=null;
  for(const name of ['Ninth_Attachment_John','Ninth_Attachment_Patricia']){const item=room.model.getObjectByName(name);if(item)item.visible=false;}
  canvas.dataset.standingBookCover='shiye';canvas.dataset.explanationPaperRemoved=String(Boolean(explanationPaper));
  const lastSpread=book.count,totalPages=(lastSpread+1)*2;
  // Straight along the desk: zero yaw and zero roll in every state.
  const sizeBoost=1.30,scale=1.40*sizeBoost;
  const center={x:.95,y:-1.334,z:-25.5};
  placement.position.set(center.x,center.y,center.z);placement.scale.setScalar(scale);placement.add(book.root);app.scene.add(placement);
  book.root.traverse(o=>{if(o.isMesh)o.castShadow=false;});
  const spineX=placement.position.x-2.12*.5*scale;

  // Soft contact shadow on the existing baked tabletop, expanding with the cover.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=256;
  const context=shadowCanvas.getContext('2d');context.fillStyle='#000';context.filter='blur(10px)';context.fillRect(24,28,208,200);
  const shadowMap=new T.CanvasTexture(shadowCanvas);
  const shadowMaterial=new T.MeshBasicNodeMaterial({map:shadowMap,transparent:true,opacity:.27,depthWrite:false,color:0x000000});
  const shadow=new T.Mesh(new T.PlaneGeometry(1,1),shadowMaterial);shadow.rotation.x=-Math.PI/2;shadow.position.set(center.x,-1.337,center.z+.02);app.scene.add(shadow);

  const controls=document.createElement('div');controls.id='book-controls';controls.hidden=true;
  controls.innerHTML='<div class="book-controls__hint">左右滑动书页 · 拖动桌面平移视角</div><div class="book-controls__row"><button id="book-prev" aria-label="上一页">←</button><span id="book-status" aria-live="polite"></span><button id="book-next" aria-label="下一页">→</button><span class="book-controls__divider"></span><button id="book-auto" aria-pressed="false">自动翻阅</button></div><div class="book-controls__secondary"><button id="book-music">音乐</button><button id="book-recenter" hidden>回到书本</button><button id="book-toggle">合上书本</button></div>';
  document.body.append(controls);
  const entryHint=document.createElement('button');entryHint.id='book-entry-hint';entryHint.textContent='打开手账，看看示例';entryHint.hidden=true;document.body.append(entryHint);
  const hintKey='shiye-room-book-opened';let hintDismissed=false;
  try{hintDismissed=sessionStorage.getItem(hintKey)==='true';}catch{}
  const preloader=document.querySelector('.preloader');
  const prev=document.querySelector('#book-prev'),next=document.querySelector('#book-next'),toggle=document.querySelector('#book-toggle'),status=document.querySelector('#book-status');
  const autoButton=controls.querySelector('#book-auto'),musicButton=controls.querySelector('#book-music'),recenter=controls.querySelector('#book-recenter');
  const dragHint=document.querySelector('#house-drag-hint');if(dragHint)dragHint.dataset.bookPan='true';
  let focused=false,busy=false,spread=0,auto=false,autoTimer=null,gesture=null;
  const pan={target:camera.position.x,velocity:0,active:false,lastTime:performance.now()};
  const stopPan=()=>{pan.active=false;pan.velocity=0;pan.target=camera.position.x;};
  const stopAuto=()=>{auto=false;clearTimeout(autoTimer);autoTimer=null;autoButton.textContent='自动翻阅';autoButton.setAttribute('aria-pressed','false');canvas.dataset.bookAuto='false';};
  const scheduleAuto=()=>{
    clearTimeout(autoTimer);autoTimer=null;
    if(!auto||busy||!focused||book.open<.95||roomBridge.paused||document.hidden)return;
    if(spread===lastSpread){stopAuto();return;}
    autoTimer=setTimeout(()=>turn(1,true),1800);
  };
  const sync=()=>{
    book.update();const width=(2.30+2.12*book.open)*scale;
    shadow.scale.set(width,3.16*scale,1);shadow.position.x=center.x-2.12*.5*scale*book.open;
    canvas.dataset.bookState=focused?(book.open>.95?'open':book.open<.05?'closed':'animating'):'room';
    canvas.dataset.bookBusy=String(busy);canvas.dataset.bookSpread=String(spread);canvas.dataset.bookYaw=String(book.root.rotation.y);canvas.dataset.removedHouseTriangles=String(removed);
    canvas.dataset.bookScale=String(scale);canvas.dataset.bookDepth=String(center.z);
    canvas.dataset.bookTotalPages=String(totalPages);canvas.dataset.bookPageTitles=JSON.stringify(textures.pageTitles.slice(spread*2,spread*2+2));
    canvas.dataset.bookPanX=String(camera.position.x-spineX);canvas.dataset.bookAuto=String(auto);
    app.bookMotionActive=focused&&(busy||Boolean(gesture)||pan.active);
    canvas.dataset.bookTurnDuration='1.4';canvas.dataset.bookDwell='1.8';
    canvas.dataset.bookGesture=gesture?.owner||'none';
    canvas.dataset.bookTurns=JSON.stringify(book.turns);canvas.dataset.bookMusic=String(ray.musicPlaying);
    canvas.style.cursor=focused?(gesture?'grabbing':'grab'):'';
    canvas.style.touchAction=focused?'none':'';
    dragHint?.classList.toggle('visible',focused&&!controls.hidden);
    recenter.hidden=!focused||Math.abs(camera.position.x-spineX)<.05;recenter.disabled=busy;
    musicButton.textContent=ray.musicPlaying?'暂停音乐':'播放音乐';musicButton.setAttribute('aria-pressed',String(Boolean(ray.musicPlaying)));
    autoButton.disabled=book.open<.95||(!auto&&spread===lastSpread);
    prev.disabled=busy||book.open<.95||spread===0;next.disabled=busy||book.open<.95||spread===lastSpread;toggle.disabled=busy;
    toggle.textContent=book.open>.5?'合上书本':'打开书本';status.textContent=book.open>.5?`${spread*2+1}–${spread*2+2} / ${totalPages}`:'拾页';
  };
  const animate=(target,props,duration=.8)=>new Promise(resolve=>gsap.to(target,{...props,duration,ease:'power2.inOut',onUpdate:sync,onComplete:()=>{sync();resolve();}}));
  const turn=async (direction,automatic=false)=>{
    if(!automatic)stopAuto();
    if(busy||gesture||book.open<.95||spread+direction<0||spread+direction>lastSpread)return;
    stopPan();
    busy=true;sync();const i=direction>0?spread:spread-1;
    await settle(i,direction>0?1:0,1.4);
    spread+=direction;busy=false;sync();scheduleAuto();
  };
  const settle=(i,value,duration)=>new Promise(resolve=>{
    const proxy={value:book.turns[i]};gsap.to(proxy,{value,duration,ease:'sine.inOut',onUpdate:()=>{book.turns[i]=proxy.value;sync();},onComplete:()=>{book.turns[i]=value;sync();resolve();}});
  });
  const close=async()=>{
    // Return turned sheets to the right while the cover closes, keeping the spine fixed.
    const start=book.turns.slice(),progress={value:0};
    await new Promise(resolve=>gsap.to(progress,{value:1,duration:.85,ease:'power2.inOut',onUpdate:()=>{book.turns=start.map(v=>v*(1-progress.value));book.open=1-progress.value;sync();},onComplete:resolve}));
    spread=0;book.open=0;book.turns.fill(0);sync();
  };
  const open=async()=>{await animate(book,{open:1},.95);};
  const focus=async()=>{
    if(busy||focused||ray.inFocus)return;focused=true;busy=true;ray.inFocus=true;app.camera.locked=true;ray.backBtn.classList.add('back-btn--visible');
    hintDismissed=true;entryHint.hidden=true;try{sessionStorage.setItem(hintKey,'true');}catch{}
    // Symmetric reading view: pitch only, no horizontal orbit or book rotation.
    const distance=Math.max(10.5,8.0/camera.aspect)*sizeBoost,height=distance*.92,z=distance*.43;
    await Promise.all([animate(camera.position,{x:spineX,y:placement.position.y+height,z:placement.position.z+z},1.25),animate(camera.rotation,{x:-Math.atan2(height,z),y:0,z:0},1.25)]);
    controls.hidden=false;await open();busy=false;sync();
  };
  const originalHome=ray.goHome.bind(ray);
  ray.goHome=async()=>{
    if(!focused)return originalHome();stopAuto();if(busy||gesture)return;stopPan();busy=true;controls.hidden=true;sync();
    if(book.open>.05)await close();focused=false;app.camera.zoomTarget=0;app.camera.zoomCurrent=0;originalHome();busy=false;sync();
  };
  ray.goToHouse=focus;
  entryHint.onclick=focus;
  const hitbox=ray.meshes.find(m=>m.name==='House_Raycaster_Hitbox');
  if(hitbox){hitbox.geometry=new T.BoxGeometry(2.3*scale,.65*sizeBoost,3.2*scale);hitbox.position.set(center.x,center.y+.325*sizeBoost,center.z);hitbox.rotation.set(0,0,0);hitbox.scale.set(1,1,1);}
  prev.onclick=()=>turn(-1);next.onclick=()=>turn(1);
  toggle.onclick=async()=>{stopAuto();if(busy||gesture)return;stopPan();busy=true;sync();if(book.open>.5)await close();else await open();busy=false;sync();};
  autoButton.onclick=()=>{if(auto){stopAuto();return;}if(busy||gesture||book.open<.95||spread===lastSpread)return;auto=true;autoButton.textContent='暂停翻阅';autoButton.setAttribute('aria-pressed','true');sync();scheduleAuto();};
  const originalToggleMusic=ray.toggleMusic.bind(ray);ray.toggleMusic=()=>{originalToggleMusic();sync();};
  musicButton.onclick=()=>ray.toggleMusic();
  document.querySelector('.top-right-controls').prepend(musicButton);
  musicButton.classList.add('room-music');
  ray.meshes=ray.meshes.filter(mesh=>['House_Raycaster_Hitbox','Music_Raycaster_Hitbox'].includes(mesh.name));
  roomBridge.connect({ray,gsap,pause:()=>{clearTimeout(autoTimer);autoTimer=null;},resume:()=>scheduleAuto()});
  recenter.onclick=async()=>{stopAuto();if(busy||gesture)return;stopPan();busy=true;await animate(camera.position,{x:spineX},.6);busy=false;sync();};
  // The surface chosen at pointer-down owns the entire gesture.
  const pick=event=>{
    const rect=canvas.getBoundingClientRect();ray.raycaster.setFromCamera(new T.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);
    return ray.raycaster.intersectObject(placement,true).find(h=>h.object.visible&&h.object.parent.visible&&!h.object.userData.decoration);
  };
  canvas.addEventListener('pointerdown',event=>{
    if(!focused||event.button!==0||gesture)return;stopAuto();if(busy)return;
    stopPan();
    const hit=pick(event),distance=camera.position.distanceTo(new T.Vector3(spineX,center.y,center.z));
    gesture={id:event.pointerId,owner:hit?'page':'pan',hit,x:event.clientX,y:event.clientY,cameraX:camera.position.x,units:2*distance*Math.tan(camera.fov*Math.PI/360)/canvas.clientHeight,index:null,direction:0,progress:0,lastX:event.clientX,lastTime:performance.now()};
    canvas.setPointerCapture(event.pointerId);sync();
  });
  canvas.addEventListener('pointermove',event=>{
    if(!gesture||gesture.id!==event.pointerId)return;
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    if(gesture.owner==='pan'){
      const now=performance.now(),dt=Math.max(.008,(now-gesture.lastTime)/1000);
      const speed=-(event.clientX-gesture.lastX)*gesture.units/dt;
      pan.velocity=pan.velocity*.6+Math.max(-12,Math.min(12,speed))*.4;
      // Compress the final metre progressively instead of hitting a hard stop.
      const raw=gesture.cameraX-spineX-dx*gesture.units,abs=Math.abs(raw);
      pan.target=spineX+Math.sign(raw)*(abs<=5?abs:5+2*(1-Math.exp(-(abs-5)/2)));
      pan.active=true;gesture.lastX=event.clientX;gesture.lastTime=now;sync();return;
    }
    if(book.open<.95||Math.abs(dx)<8||Math.abs(dy)>Math.abs(dx)*1.4)return;
    if(gesture.index===null){
      const direction=dx<0?1:-1;if(spread+direction<0||spread+direction>lastSpread)return;
      gesture.direction=direction;gesture.index=direction>0?spread:spread-1;busy=true;
    }
    const travel=Math.max(120,2.065*scale/gesture.units);
    gesture.progress=Math.max(0,Math.min(1,-dx*gesture.direction/travel));
    book.turns[gesture.index]=gesture.direction>0?gesture.progress:1-gesture.progress;sync();
  });
  const endGesture=async(event,cancelled=false)=>{
    if(!gesture||gesture.id!==event.pointerId)return;
    const g=gesture;gesture=null;
    if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    if(g.index!==null){
      const commit=!cancelled&&g.progress>.25,value=commit?(g.direction>0?1:0):(g.direction>0?0:1);
      await settle(g.index,value,Math.max(.38,1.1*Math.abs(value-book.turns[g.index])));
      if(commit)spread+=g.direction;busy=false;sync();
    }else{
      if(g.owner==='pan'){
        if(cancelled||performance.now()-g.lastTime>100)pan.velocity=0;
        pan.target=Math.max(spineX-7,Math.min(spineX+7,pan.target+pan.velocity*.065));pan.velocity=0;pan.active=true;
      }
      sync();if(!cancelled&&g.owner==='page'&&Math.hypot(event.clientX-g.x,event.clientY-g.y)<8){if(book.open<.05)toggle.click();else turn(g.hit.point.x<spineX?-1:1);}
    }
  };
  canvas.addEventListener('pointerup',event=>endGesture(event));
  canvas.addEventListener('pointercancel',event=>endGesture(event,true));
  canvas.addEventListener('lostpointercapture',event=>endGesture(event,true));
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopAuto();if(gesture)endGesture({pointerId:gesture.id},true);}});
  window.addEventListener('blur',()=>{if(gesture)endGesture({pointerId:gesture.id},true);});
  document.addEventListener('keydown',event=>{
    if(!focused||/INPUT|TEXTAREA/.test(event.target.tagName))return;
    if(['ArrowLeft','ArrowRight','Escape'].includes(event.key)){event.preventDefault();stopAuto();if(busy||gesture)return;if(event.key==='ArrowLeft')turn(-1);if(event.key==='ArrowRight')turn(1);if(event.key==='Escape')ray.goHome();}
  });
  // Reduce GPU work while reading; keep responsive motion during page turns/pans.
  const draw=app.renderer.update.bind(app.renderer);let lastDraw=0;
  app.renderer.update=()=>{
    if(roomBridge.paused)return;
    const now=performance.now(),dt=Math.min(.05,Math.max(0,(now-pan.lastTime)/1000));pan.lastTime=now;
    if(focused&&pan.active&&!busy){
      camera.position.x+=(pan.target-camera.position.x)*(1-Math.exp(-dt/(gesture?.owner==='pan'?.045:.11)));
      if(!gesture&&Math.abs(pan.target-camera.position.x)<.001){camera.position.x=pan.target;pan.active=false;}
      camera.updateMatrixWorld();sync();
    }
    if(focused&&!busy&&!gesture&&!pan.active&&now-lastDraw<80)return;lastDraw=now;draw();
  };
  app.renderer.renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));
  const resize=app.renderer.resize.bind(app.renderer);app.renderer.resize=()=>{resize();app.renderer.renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));};
  sync();canvas.dataset.bookReady='true';
  roomBridge.ready();
  // Projected location is exposed as DOM-only diagnostics for visual verification.
  const project=()=>{
    const v=new T.Vector3(center.x,center.y+.33*scale,center.z).project(camera);
    const x=(v.x+1)*innerWidth/2,y=(1-v.y)*innerHeight/2;
    canvas.dataset.bookScreen=JSON.stringify({x,y});
    entryHint.hidden=hintDismissed||focused||ray.inFocus||Boolean(preloader?.isConnected)||v.z>1||v.z<-1||x<0||x>innerWidth||y<0||y>innerHeight;
    if(!entryHint.hidden){entryHint.style.left=`${Math.min(innerWidth-100,Math.max(100,x))}px`;entryHint.style.top=`${y}px`;}
  };
  const update=app.camera.update.bind(app.camera);app.camera.update=()=>{update();project();};
}
main().catch(error=>{canvas.dataset.bookError=error.message;console.error('Room book integration:',error);});
