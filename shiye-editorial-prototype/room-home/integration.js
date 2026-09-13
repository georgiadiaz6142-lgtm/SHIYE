// Only a pause flag crosses the frame boundary. No credentials or user work enter this scene.
let controller=null,modalPaused=false,paused=false,restoreMusic=false;
const notify=type=>{if(parent!==window)parent.postMessage({type},location.origin);};
function refresh(){
 const next=modalPaused||document.hidden;if(next===paused)return;paused=next;
 document.documentElement.dataset.productPaused=String(paused);
 if(!controller)return;
 const {ray,gsap,pause,resume}=controller;
 if(paused){pause();gsap.globalTimeline.pause();restoreMusic=ray.musicPlaying;ray.music.pause();}
 else{gsap.globalTimeline.resume();if(restoreMusic&&ray.musicPlaying)ray.music.play();restoreMusic=false;resume();}
}
window.addEventListener('message',event=>{
 if(event.source!==parent||event.origin!==location.origin||event.data?.type!=='shiye-room-state'||typeof event.data.paused!=='boolean')return;
 document.documentElement.classList.toggle('has-account',event.data.account===true);
 modalPaused=event.data.paused;refresh();
});
document.addEventListener('visibilitychange',refresh);
for(const type of ['pointerdown','pointermove','pointerup','click','wheel','keydown']){
 window.addEventListener(type,event=>{if(paused){event.stopImmediatePropagation();if(event.cancelable)event.preventDefault();}},{capture:true,passive:false});
}
export const roomBridge={
 get paused(){return paused;},
 connect(value){controller=value;const wasPaused=paused;paused=false;if(wasPaused||modalPaused||document.hidden)refresh();},
 ready(){notify('shiye-room-ready');},
};
