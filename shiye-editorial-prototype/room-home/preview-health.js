// Keep the unmodified base model concealed until every approved scene replacement is ready.
const previewIntro=document.querySelector('.preloader__intro');
const previewPreloader=document.querySelector('.preloader');
const sceneCanvas=document.querySelector('#experience-canvas');
const entryButtons=[document.querySelector('#enter-btn'),document.querySelector('#enter-silent-btn')];
const preparationStatus=document.querySelector('#room-preparation-status');
const preparationRetry=document.querySelector('#room-load-retry');
let revealPending=false;
const notify=type=>{if(parent!==window)parent.postMessage({type},location.origin);};
function failPreparation(reason){
 if(document.documentElement.dataset.sceneReady==='true')return;
 entryButtons.forEach(button=>button.disabled=true);
 previewPreloader?.classList.remove('preloader--scene-ready');
 preparationStatus.textContent=`手账房间加载失败：${reason}。请重新加载。`;
 preparationStatus.setAttribute('role','alert');preparationStatus.hidden=false;preparationRetry.hidden=false;
 document.documentElement.dataset.sceneReady='failed';
 document.documentElement.dataset.sceneError=reason;
 notify('shiye-room-error');
}
function checkPreparation(){
 if(sceneCanvas.dataset.bookError){failPreparation(sceneCanvas.dataset.bookError);return;}
 if(sceneCanvas.dataset.bookReady!=='true'||previewIntro.style.display!=='flex'||revealPending)return;
 revealPending=true;
 // Let the renderer commit the replaced geometry before exposing the canvas.
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
  revealPending=false;
  if(sceneCanvas.dataset.bookError)return;
  document.documentElement.dataset.sceneReady='true';
  delete document.documentElement.dataset.sceneError;
  previewPreloader.classList.add('preloader--scene-ready');
  entryButtons.forEach(button=>button.disabled=false);
  preparationStatus.hidden=true;preparationRetry.hidden=true;
  preparationObserver.disconnect();
  notify('shiye-room-ready');
 }));
}
const preparationObserver=new MutationObserver(checkPreparation);
preparationObserver.observe(sceneCanvas,{attributes:true,attributeFilter:['data-book-ready','data-book-error']});
preparationObserver.observe(previewIntro,{attributes:true,attributeFilter:['style']});
preparationRetry.onclick=()=>location.reload();
// Only failures in this scene's entry scripts/styles can block preparation.
// Optional images, audio, extensions and unrelated scripts must not lock entry.
window.addEventListener('error',event=>{
 const target=event.target;
 const resource=target instanceof HTMLScriptElement?target.src:
  target instanceof HTMLLinkElement&&target.rel==='stylesheet'?target.href:'';
 const source=resource||(event instanceof ErrorEvent?event.filename:'');
 if(!source.startsWith(`${location.origin}/room-home/`))return;
 const path=new URL(source).pathname.replace('/room-home/','');
 failPreparation(resource?`资源未能加载（${path}）`:`场景运行出错（${path}）`);
 checkPreparation();
},true);
checkPreparation();
