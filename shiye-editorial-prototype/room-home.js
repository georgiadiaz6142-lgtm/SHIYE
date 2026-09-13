'use strict';
// The presentation lives in an isolated document; identity and navigation stay in the product.
window.ShiyeRoomHome=(()=>{
 let frame=null,observer=null,actions=null,account=null;
 const send=()=>{if(frame?.isConnected)frame.contentWindow?.postMessage({type:'shiye-room-state',paused:document.querySelector('#dialog').open,account:account?.classList.contains('is-account')===true},location.origin);};
 const receive=event=>{
  if(!frame?.isConnected||event.origin!==location.origin||event.source!==frame.contentWindow)return;
  if(event.data?.type==='shiye-room-ready'){
   const status=document.querySelector('.room-load-status');
   if(status)status.hidden=true;
   send();
  }
  if(event.data?.type==='shiye-room-error'){
   const status=document.querySelector('.room-load-status');
   if(status){status.hidden=false;status.textContent='房间暂时未能加载，你仍可登录并开始创作。';}
  }
 };
 function update(identity){
  if(!account?.isConnected)return;
  const authorized=identity?.authorized===true;
  account.classList.toggle('is-account',authorized);
  account.setAttribute('aria-label',authorized?'账户信息':'登录/注册');
  account.title=authorized?'账户信息':'登录/注册';
  account.replaceChildren();
  if(authorized){
   if(identity.avatar){const image=document.createElement('img');image.src=identity.avatar;image.alt='个人头像';account.append(image);}
   else account.textContent=(identity.username||'S').slice(0,1);
  }else account.textContent='登录/注册';
  send();
 }
 function mount(root,options){
  actions=options;
  if(frame?.isConnected){update(options.identity);return;}
  document.body.classList.add('room-home-active');
  root.innerHTML='<main class="room-home" aria-label="拾页首页"><h1 class="room-sr-only">拾页，把日子慢慢收好。</h1><iframe class="room-home-frame" title="拾页的房间与示例手账" src="/room-home/index.html" allow="autoplay"></iframe><button type="button" class="room-account">登录/注册</button><button type="button" class="room-create">开始创作 <span aria-hidden="true">↗</span></button><p class="room-load-status" role="status" hidden></p></main>';
  frame=root.querySelector('iframe');account=root.querySelector('.room-account');
  account.onclick=()=>actions.onAccount();
  root.querySelector('.room-create').onclick=()=>actions.onCreate();
  frame.addEventListener('load',send);
  observer=new MutationObserver(send);observer.observe(document.querySelector('#dialog'),{attributes:true,attributeFilter:['open']});
  window.addEventListener('message',receive);update(options.identity);
 }
 function unmount(){
  observer?.disconnect();observer=null;window.removeEventListener('message',receive);
  frame?.remove();frame=null;account=null;actions=null;
  document.body.classList.remove('room-home-active');
 }
 return {mount,unmount,update};
})();
