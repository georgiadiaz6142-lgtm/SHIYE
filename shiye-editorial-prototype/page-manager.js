'use strict';
// Page ordering and thumbnail controls; document edits use the editor's existing history/save path.
let pageSortCleanup=null,pageSortClickUntil=0,pageRemovalUndo=null;
function pageUnits(){
 const b=currentBook(),locked=new Map();
 for(const g of bookSpreads()){
  const pages=spreadPages(g);if(pages.some(p=>p.paperSpread||p.elements.some(e=>e.spreadWith)))for(const p of pages)locked.set(p.id,pages);
 }
 const seen=new Set();return b.pages.flatMap(p=>{if(seen.has(p.id))return [];const unit=locked.get(p.id)||[p];unit.forEach(pg=>seen.add(pg.id));return [unit];});
}
function pageUnit(id){return pageUnits().find(unit=>unit.some(p=>p.id===id));}
function arrangePageUnits(units,active){
 coverEditingBookId=null;
 ensurePagePairs();
 // Linked paper/stickers keep their original sides; unlinked pages may form new pairs.
 let pending=null;const pages=[];
 for(const unit of units){
  if(unit.length>1){pending=null;pages.push(...unit);continue;}
  const p=unit[0];
  if(p.paperSpread||p.elements.some(e=>e.spreadWith)){pending=null;pages.push(p);continue;}
  if(pending){p.spreadKey=pending.spreadKey;p.spreadSide='right';pending=null;}
  else{p.spreadKey=uid();p.spreadSide='left';pending=p;}
  pages.push(p);
 }
 const b=currentBook();b.pages=pages;b.page=Math.max(0,pages.findIndex(p=>p.id===active));selectedId=null;
}
function movePageUnit(id,targetId,after){
 const units=pageUnits(),from=units.findIndex(u=>u.some(p=>p.id===id)),target=units.findIndex(u=>u.some(p=>p.id===targetId));
 if(from<0||target<0||from===target)return;
 const active=currentPage().id,unit=units[from],at=target+(after?1:0);units.splice(from,1);units.splice(at-(from<at?1:0),0,unit);
 if(units.flat().every((p,i)=>p.id===currentBook().pages[i].id))return;
 change(()=>arrangePageUnits(units,active));
}
function shiftPageUnit(id,direction){
 if(!editing||currentView!=='editor'||editingPageTurn)return;
 finishInlineText();
 const units=pageUnits(),index=units.findIndex(u=>u.some(p=>p.id===id)),target=units[index+direction];
 if(!target)return;
 movePageUnit(id,target[0].id,direction>0);
 const button=$$('.page-thumb').find(el=>el.dataset.pageId===id);
 button?.focus({preventScroll:true});button?.scrollIntoView({block:'nearest',inline:'nearest'});
 toast(`已移到第 ${currentBook().pages.findIndex(p=>p.id===id)+1} 页`);
}
function insertPageAt(id,after){
 finishInlineText();const units=pageUnits(),index=units.findIndex(u=>u.some(p=>p.id===id));if(index<0)return;
 const p=blankPage();units.splice(index+(after?1:0),0,[p]);change(()=>arrangePageUnits(units,p.id));revealPageThumb();
}
function removePageUnit(id){
 finishInlineText();const b=currentBook(),units=pageUnits(),index=units.findIndex(u=>u.some(p=>p.id===id));if(index<0||units.length<=1)return;
 const removed=units.splice(index,1)[0],active=currentPage().id,before=JSON.stringify(b.pages);
 const selected=removed.some(p=>p.id===active)?(units[index]||units[index-1])[0].id:active;
 change(()=>arrangePageUnits(units,selected));
 pageRemovalUndo={workspace:workspaceKey,bookId:b.id,before,after:JSON.stringify(b.pages),active};
 toast(removed.length>1?'已删除这两页':'已删除此页');const button=document.createElement('button');button.textContent='撤销';button.dataset.action='page-removal-undo';$('#toast').append(button);clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),8000);revealPageThumb();
}
function revealPageThumb(){const strip=$('.page-strip'),thumb=$('.page-thumb.active',strip);if(!strip||!thumb)return;const r=thumb.getBoundingClientRect(),s=strip.getBoundingClientRect();if(r.left<s.left+8)strip.scrollLeft-=s.left-r.left+8;else if(r.right>s.right-8)strip.scrollLeft+=r.right-s.right+8;}
function pageManagerHTML(){
 const b=currentBook(),units=pageUnits();
 return `<div class="page-manager"><div class="page-manager-heading"><span class="page-count" aria-live="polite">共 ${b.pages.length} 页 · ${isCoverEditing()?'正在编辑封面':`当前第 ${b.page+1} 页`}</span></div><div class="page-strip" aria-label="页面缩略图，可按住拖动排序">${coverThumbnailHTML(b)}${b.pages.map((p,i)=>{
  const unit=units.find(u=>u.includes(p)),unitIndex=units.indexOf(unit),linked=unit.length>1,group=linked?`第 ${unit.map(pg=>b.pages.indexOf(pg)+1).join('、')} 页一起操作`:'';
  return `<div class="page-thumb-item ${linked?'linked-page':''}" data-page-id="${p.id}" ${linked?`title="${group}"`:''}><button class="page-thumb ${!isCoverEditing()&&i===b.page?'active':''}" data-action="page-goto" data-value="${i}" data-page-id="${p.id}" aria-label="第 ${i+1} 页${linked?'，与相邻页关联':''}" aria-keyshortcuts="Alt+Shift+ArrowLeft Alt+Shift+ArrowRight" title="按住拖动排序，或按 Alt+Shift+左右方向键" aria-current="${!isCoverEditing()&&i===b.page?'page':'false'}"><div class="thumb-content canvas-page ${p.paper}" style="--scale:1">${elementsHTML(p,true,true)}</div><small>${i+1}${linked?' · 连页':''}</small></button><button class="page-thumb-more" popovertarget="page-menu-${p.id}" aria-label="第 ${i+1} 页的操作" aria-expanded="false"><svg width="12" height="4" viewBox="0 0 12 4" aria-hidden="true"><circle cx="1.5" cy="2" r="1"/><circle cx="6" cy="2" r="1"/><circle cx="10.5" cy="2" r="1"/></svg></button><div class="book-popover page-popover" id="page-menu-${p.id}" popover="auto" role="group" aria-label="第 ${i+1} 页的操作">${linked?`<small>${group}</small>`:''}<button data-action="page-insert-before" data-id="${p.id}">${icon('plus')} ${linked?'在这两页前添加':'在前面加一页'}</button><button data-action="page-insert-after" data-id="${p.id}">${icon('plus')} ${linked?'在这两页后添加':'在后面加一页'}</button><button data-action="page-shift-before" data-id="${p.id}" ${unitIndex===0?'disabled':''}>${icon('left')} ${linked?'这两页前移':'前移一页'}</button><button data-action="page-shift-after" data-id="${p.id}" ${unitIndex===units.length-1?'disabled':''}>${icon('arrow')} ${linked?'这两页后移':'后移一页'}</button><button class="book-menu-delete" data-action="page-remove" data-id="${p.id}" ${units.length<=1?'disabled title="至少保留一页；跨页内容须一起保留"':''}>${icon('trash')} ${linked?'删除这两页':'删除此页'}</button></div></div>`;
 }).join('')}<button class="page-add" data-action="page-append" aria-label="在最后新增一页">${icon('plus')}</button></div></div>`;
}
function bindPageSort(){
 const strip=$('.page-manager .page-strip');if(!strip)return;let drag=null,frame=0,timer=0;
 const clear=()=>{clearTimeout(timer);cancelAnimationFrame(frame);strip.classList.remove('sorting');$$('.page-thumb-item',strip).forEach(el=>el.classList.remove('drag-source','drop-before','drop-after'));drag=null;};
 const locate=()=>{
  if(!drag?.active)return;const bounds=strip.getBoundingClientRect();
  if(drag.x<bounds.left+32)strip.scrollLeft-=10;else if(drag.x>bounds.right-32)strip.scrollLeft+=10;
  const items=$$('.page-thumb-item',strip);items.forEach(el=>el.classList.remove('drop-before','drop-after'));drag.target=null;
  if(drag.y>=bounds.top-32&&drag.y<=bounds.bottom+32){
   const target=items.find(el=>drag.x<el.getBoundingClientRect().right)||items.at(-1);
   if(target){const unit=pageUnit(target.dataset.pageId),r=target.getBoundingClientRect(),after=drag.x>r.left+r.width/2;
    const edge=items.find(el=>el.dataset.pageId===(after?unit.at(-1):unit[0]).id);
    if(!drag.ids.includes(target.dataset.pageId)){edge.classList.add(after?'drop-after':'drop-before');drag.target={id:target.dataset.pageId,after};}
   }
  }
  frame=requestAnimationFrame(locate);
 };
 const activate=()=>{if(!drag)return;drag.active=true;finishInlineText();$$('.book-popover:popover-open').forEach(el=>el.hidePopover());strip.classList.add('sorting');for(const el of $$('.page-thumb-item',strip))el.classList.toggle('drag-source',drag.ids.includes(el.dataset.pageId));strip.setPointerCapture(drag.pointer);locate();};
 const down=e=>{const thumb=e.target.closest('.page-thumb');if(!thumb?.dataset.pageId||e.button!==0||e.isPrimary===false||editingPageTurn)return;clear();drag={id:thumb.dataset.pageId,ids:pageUnit(thumb.dataset.pageId).map(p=>p.id),pointer:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,touch:e.pointerType==='touch',active:false};if(drag.touch)timer=setTimeout(activate,350);};
 const move=e=>{if(!drag||drag.pointer!==e.pointerId)return;const dx=e.clientX-drag.x;drag.x=e.clientX;drag.y=e.clientY;if(drag.scrolling){strip.scrollLeft-=dx;e.preventDefault();return;}const distance=Math.hypot(drag.x-drag.startX,drag.y-drag.startY);if(!drag.active&&distance>7){if(drag.touch){clearTimeout(timer);drag.scrolling=true;strip.setPointerCapture(drag.pointer);strip.scrollLeft-=dx;e.preventDefault();return;}activate();}if(drag?.active)e.preventDefault();};
 const up=e=>{if(!drag||drag.pointer!==e.pointerId)return;const d=drag;clear();if(d.scrolling)pageSortClickUntil=Date.now()+500;if(d.active){pageSortClickUntil=Date.now()+500;if(d.target){movePageUnit(d.id,d.target.id,d.target.after);revealPageThumb();}}};
 const cancel=()=>{if(drag?.active)pageSortClickUntil=Date.now()+500;clear();};
 strip.addEventListener('pointerdown',down);strip.addEventListener('pointermove',move);strip.addEventListener('pointerup',up);strip.addEventListener('pointercancel',cancel);strip.addEventListener('lostpointercapture',cancel);
 const key=e=>{if(e.key==='Escape'&&drag){e.preventDefault();e.stopImmediatePropagation();cancel();}};document.addEventListener('keydown',key,true);
 pageSortCleanup=()=>{clear();document.removeEventListener('keydown',key,true);pageSortCleanup=null;};
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const menu=$('.page-popover:popover-open');if(menu){menu.hidePopover();e.preventDefault();e.stopImmediatePropagation();}}},true);
document.addEventListener('click',e=>{if(Date.now()<pageSortClickUntil&&e.target.closest('.page-manager')){e.preventDefault();e.stopImmediatePropagation();}},true);


document.addEventListener('keydown',event=>{
 const thumb=event.target.closest?.('.page-thumb');
 if(!thumb?.dataset.pageId||!event.altKey||!event.shiftKey||!['ArrowLeft','ArrowRight'].includes(event.key))return;
 if(!editing||currentView!=='editor'||editingPageTurn||$('#dialog').open)return;
 event.preventDefault();event.stopImmediatePropagation();
 shiftPageUnit(thumb.dataset.pageId,event.key==='ArrowLeft'?-1:1);
},true);
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-action="page-shift-before"],[data-action="page-shift-after"]');
 if(button&&!button.disabled)shiftPageUnit(button.dataset.id,button.dataset.action==='page-shift-before'?-1:1);
});
