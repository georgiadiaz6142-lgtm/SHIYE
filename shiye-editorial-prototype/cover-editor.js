'use strict';
// Front covers share page elements and the save pipeline, but never enter page ordering.
let coverEditingBookId=null,coverPhotoTask=0;
const isCoverEditing=()=>editing&&currentView==='editor'&&coverEditingBookId===activeBookId&&!!activeBookId;
function editorSnapshot(){const b=currentBook();return JSON.stringify({pages:b.pages,coverDesign:b.coverDesign,title:b.title,subtitle:b.subtitle,coverEditing:isCoverEditing()});}
function restoreEditorSnapshot(value){const snapshot=JSON.parse(value),b=currentBook();b.pages=snapshot.pages;b.title=snapshot.title;b.subtitle=snapshot.subtitle;if(snapshot.coverDesign)b.coverDesign=snapshot.coverDesign;else delete b.coverDesign;coverEditingBookId=snapshot.coverEditing?b.id:null;if(isCoverEditing()){ensureCoverDesign();if(['paper','pages'].includes(drawer))drawer=null;}else if(drawer==='cover')drawer=null;}
function defaultCoverDesign(b){
 const dark=['olive','blue'].includes(b.cover),color={olive:'#63735b',blue:'#587681',coral:'#c47861',cream:'#eee6d4'}[b.cover]||'#eee6d4',ink=dark?'#fff7df':'#494d3f';
 const title=node('text',{text:b.title,x:13,y:16,w:76,size:38,font:'serif',color:ink}),elements=[
  node('text',{text:'A PERSONAL COLLECTION',x:13,y:9,w:76,size:10,font:'sans',color:ink}),title,
  node('text',{text:b.subtitle||'MOMENTS TO KEEP',x:13,y:35,w:76,size:12,font:'sans',color:ink}),
 ];
 if(dark)elements.push(node('photo',{src:`assets/${b.cover==='olive'?'lake':'forest'}.jpg`,x:15,y:46,w:70,frame:true,crop:{aspect:1.5,zoom:1,x:50,y:50}}));
 else elements.push(node('sticker',{assetId:b.cover==='cream'?'flower':'star',x:29,y:45,w:43}));
 elements.push(node('text',{text:'SHIYE · MOMENTS TO KEEP',x:13,y:90,w:76,size:10,font:'sans',color:ink}));
 return {id:uid(),paper:'plain',color,material:dark?'cloth':'paper',titleId:title.id,titleVisible:true,elements};
}
function ensureCoverDesign(){const b=currentBook();if(!b.coverDesign){b.coverDesign=defaultCoverDesign(b);dirty();}return b.coverDesign;}
function updateCoverTitle(b){const title=b?.coverDesign?.elements.find(e=>e.id===b.coverDesign.titleId&&e.type==='text');if(title)title.text=b.title;}
function syncCoverTitle(){if(!isCoverEditing())return;const b=currentBook(),c=b.coverDesign,title=c?.elements.find(e=>e.id===c.titleId&&e.type==='text');if(title?.text.trim()){b.title=title.text.trim().slice(0,40);if(title.text.length>40)title.text=b.title;const input=document.getElementById('book-title');if(input)input.value=b.title;}}
function croppedPhotoHTML(e){const c=e.crop;return `<span class="cover-photo-crop ${e.frame?'photo-framed':''}" style="aspect-ratio:${c.aspect}"><img src="${esc(e.src)}" alt="照片" draggable="false" style="object-position:${c.x}% ${c.y}%;transform:scale(${c.zoom}) scaleX(${e.flip?-1:1})"></span>`;}
function coverElementsHTML(c,read=true){
 const visible=c.elements.filter(e=>e.id!==c.titleId||c.titleVisible);
 // The same percentage geometry renders in the editor, shelf, and reader.
 return visible.map(e=>{
  const text=e.type==='text',source=text?'':e.type==='sticker'?asset(e.assetId)?.src||'':e.src,crop=e.type==='photo'?e.crop:null;
  const content=text?`<span class="text-content">${esc(e.text)}</span>`:crop?croppedPhotoHTML(e):`<img src="${esc(source)}" alt="${esc(asset(e.assetId)?.name||'封面照片')}" draggable="false" style="${e.flip?'transform:scaleX(-1);':''}${e.type==='sticker'?borderStyle(asset(e.assetId)?.borderBaked?0:asset(e.assetId)?.border||0):''}">`;
  return `<div class="element ${text?'text':''} ${read?'readonly':''} ${!read&&selectedId===e.id?'selected':''} ${e.direction==='vertical'?'vertical-text':''}" data-element="${e.id}" ${read?'':`tabindex="0" role="button" aria-label="${esc(text?e.text:'封面图片')}"`} style="left:${e.x}%;top:${e.y}%;width:${e.w}%;transform:rotate(${e.rotation||0}deg);${text?`font-size:${(e.size||18)/4.2}cqw;font-family:${textFont(e.font).family};color:${textColorValue(e.color)};font-weight:${e.bold?700:400};font-style:${e.italic?'italic':'normal'};${e.direction==='vertical'?`height:${e.h||60}%;writing-mode:vertical-rl;text-orientation:mixed;`:''}`:''}">${content}${!read&&selectedId===e.id?transformHandles():''}</div>`;
 }).join('');
}
function customCoverHTML(b){const c=b.coverDesign;return `<div class="cover custom-cover cover-material-${c.material}" style="background-color:${c.color}"><div class="cover-art">${coverElementsHTML(c)}</div></div>`;}
function coverThumbnailHTML(b){return `<button class="page-thumb cover-thumb ${isCoverEditing()?'active':''}" data-action="edit-cover" aria-label="编辑封面" aria-current="${isCoverEditing()?'page':'false'}"><div class="cover-thumb-art">${coverHTML(b)}</div><small>封面</small></button>`;}
function coverDrawerHTML(){const c=currentBook().coverDesign;return `<section class="drawer cover-drawer"><div class="drawer-head"><h3>设计封面</h3>${ib('close-drawer','close','关闭工具面板')}</div>
 <label class="field"><span>封面底色</span><input type="color" id="cover-color" value="${c.color}"></label>
 <label class="field"><span>封面质感</span><select id="cover-material">${[['plain','纯色'],['paper','纸张'],['cloth','布纹']].map(([v,t])=>`<option value="${v}" ${c.material===v?'selected':''}>${t}</option>`).join('')}</select></label>
 <label class="cover-title-toggle"><input type="checkbox" id="cover-title-visible" ${c.titleVisible&&c.elements.some(e=>e.id===c.titleId)?'checked':''}> 显示手账名称</label><p class="muted">封面标题与手账名称同步；隐藏标题不会删除名称。其他文字可在“文字”中编辑。</p>
 <button class="button outline" data-action="cover-upload">${icon('plus')} ${currentElement()?.type==='photo'?'替换选中照片':'添加封面照片'}</button>
 <input id="cover-photo-input" type="file" accept="image/jpeg,image/png,image/webp" hidden>
 <p class="muted">选中照片可调整裁切；拖动角点缩放，圆柄旋转。</p>
 <button class="text-link" data-action="cover-reset">恢复原始封面</button></section>`;}
function coverPhotoControls(e){if(e.type!=='photo')return '';const c=e.crop||{aspect:1.5,zoom:1,x:50,y:50};return `<div class="cover-crop-controls"><label>照片比例<select id="cover-photo-aspect">${[[1.5,'横向'],[1,'正方形'],[0.75,'竖向'],[420/540,'与封面一致']].map(([v,t])=>`<option value="${v}" ${Math.abs(c.aspect-v)<.01?'selected':''}>${t}</option>`).join('')}</select></label>${[['zoom','裁切放大',1,3,.05],['x','裁切左右',0,100,1],['y','裁切上下',0,100,1]].map(([key,name,min,max,step])=>`<label>${name}<input id="cover-crop-${key}" aria-label="${name}" type="range" min="${min}" max="${max}" step="${step}" value="${c[key]}"></label>`).join('')}<label><input id="cover-photo-frame" type="checkbox" ${e.frame?'checked':''}> 照片白边</label><button class="small-action" data-action="cover-photo-fill">铺满封面</button><button class="small-action" data-action="cover-upload">替换这张照片</button></div>`;}
function renderCoverEditor(){
 const b=currentBook(),c=ensureCoverDesign(),scroll=$('.editor-tools-content')?.scrollTop||0;
 $('#app').innerHTML=`<div class="shell editor-mode">${sidebar()}<header class="editor-top"><div class="editor-title">${ib('shelve','left','放回书架')}<input id="book-title" aria-label="手帐名称" maxlength="40" value="${esc(b.title)}"></div><div class="editor-top-actions">${statusHTML()}<div class="mode-switch"><button data-action="mode" data-value="read">翻阅</button><button class="active" data-action="mode" data-value="edit">编辑</button></div><button class="button dark small" data-action="shelve">${icon('book')} 放回书架</button></div></header>
 <main class="editor-workspace has-editor-tools cover-workspace ${drawer?'tools-open':''}"><div class="workspace-meta"><span>正面封面 · 共 ${b.pages.length} 页内页</span><div class="undo-bar">${ib('undo','undo','撤销',history.length?'':'disabled')}${ib('redo','redo','重做',future.length?'':'disabled')}<span class="no-selection">点击空白处写字 · 双击元素显示菜单</span></div></div><div class="layout-controls"><span>正在编辑封面</span><button class="text-link" data-action="page-goto" data-value="${b.page||0}">返回内页 ${icon('right')}</button></div>
 <div class="stage-wrap"><div class="page-frame"><div id="canvas-page" class="canvas-page custom-cover cover-material-${c.material}" style="background-color:${c.color}"><div class="cover-art">${coverElementsHTML(c,false)}</div></div></div></div>
 <div class="editor-dock" role="toolbar" aria-label="封面工具">${[['sticker','sticker','贴纸'],['text','text','文字'],['cover','book','封面']].map(([a,i,t])=>`<button class="tool ${drawer===a?'active':''}" data-action="drawer" data-value="${a}">${icon(i)}<span>${t}</span></button>`).join('')}<div class="dock-divider"></div><button class="tool" data-action="page-goto" data-value="${b.page||0}">${icon('paper')}<span>内页</span></button></div>${pageManagerHTML()}${editorToolsHTML()}</main></div>`;
 if($('.editor-tools-content'))$('.editor-tools-content').scrollTop=scroll;
 fitPage();resizeObserver?.disconnect();resizeObserver=new ResizeObserver(fitPage);resizeObserver.observe($('.stage-wrap'));bindDrag();bindPageSort();bindStickerDrag();revealPageThumb();
}
function handleCoverAction(a,id,v){
 if(a==='edit-cover'&&currentView==='editor'){
  coverPhotoTask++;finishInlineText();cancelEditingTurn();cancelReaderTurn();editing=true;readerCover=null;coverEditingBookId=activeBookId;ensureCoverDesign();selectedId=null;drawer=null;renderEditor();return true;
 }
 if(!isCoverEditing())return false;
 if(['mode','page-goto','shelve','nav','cover-reset-confirm'].includes(a))coverPhotoTask++;
 if(a==='cover-upload'){$('#cover-photo-input')?.click();return true;}
 if(a==='cover-photo-fill'&&currentElement()?.type==='photo'){change(()=>{const e=currentElement(),items=currentBook().coverDesign.elements;Object.assign(e,{x:0,y:0,w:100,rotation:0,frame:false,crop:{aspect:420/540,zoom:1,x:50,y:50}});items.splice(items.indexOf(e),1);items.unshift(e);});return true;}
 if(a==='cover-reset'){showDialog('恢复原始封面？','<p class="dialog-description">封面的照片、贴纸和文字排布将恢复为初始样式，保留当前手账名称。恢复后可撤销。</p>','<button class="button outline" data-action="close-dialog">取消</button><button class="button primary" data-action="cover-reset-confirm">恢复封面</button>');return true;}
 if(a==='cover-reset-confirm'){closeDialog();change(()=>{currentBook().coverDesign=defaultCoverDesign(currentBook());selectedId=null;});return true;}
 if(a==='ai-copy-open'){toast('封面文字请直接编辑；AI 写作可在内页使用。');return true;}
 if(a==='page-goto'||a==='editor-layout'){finishInlineText();coverEditingBookId=null;if(drawer==='cover')drawer=null;}
 return false;
}
document.addEventListener('change',event=>{
 if(!isCoverEditing())return;const input=event.target,c=currentBook().coverDesign,id=input.id,e=currentElement();
 if(id==='cover-photo-input'){if(input.files[0])loadCoverPhoto(input.files[0]);return;}
 if(id==='cover-color')change(()=>c.color=input.value);
 if(id==='cover-material'&&['plain','paper','cloth'].includes(input.value))change(()=>c.material=input.value);
 if(id==='cover-title-visible')change(()=>{c.titleVisible=input.checked;if(input.checked&&!c.elements.some(e=>e.id===c.titleId)){const initial=defaultCoverDesign(currentBook()),title=initial.elements.find(e=>e.id===initial.titleId);title.id=c.titleId;c.elements.push(title);}});
 if(e?.type==='photo'&&['cover-photo-aspect','cover-photo-frame','cover-crop-zoom','cover-crop-x','cover-crop-y'].includes(id))change(()=>{e.crop={aspect:1.5,zoom:1,x:50,y:50,...e.crop};if(id==='cover-photo-frame')e.frame=input.checked;else e.crop[id==='cover-photo-aspect'?'aspect':id.slice(11)]=Number(input.value);});
});
async function loadCoverPhoto(file){
 const task=++coverPhotoTask,bookId=activeBookId,owner=workspaceKey,coverId=currentBook().coverDesign.id,replace=currentElement()?.type==='photo'?selectedId:null;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){toast('请选择不超过 10 MB 的 JPG、PNG 或 WebP 照片。');return;}
 const url=URL.createObjectURL(file),img=new Image();
 try{
  img.src=url;await img.decode();if(img.naturalWidth*img.naturalHeight>24000000)throw Error('图片超过 2400 万像素，请先缩小图片。');
  const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);const src=canvas.toDataURL('image/webp',.9);
  if(task!==coverPhotoTask||!isCoverEditing()||activeBookId!==bookId||workspaceKey!==owner||currentBook().coverDesign.id!==coverId)return;
  change(()=>{const c=currentBook().coverDesign,existing=c.elements.find(e=>e.id===replace);if(existing){existing.src=src;existing.crop={aspect:1.5,...existing.crop,zoom:1,x:50,y:50};selectedId=existing.id;}else{const e=node('photo',{src,x:15,y:43,w:70,frame:true,crop:{aspect:1.5,zoom:1,x:50,y:50}});c.elements.push(e);selectedId=e.id;}drawer='cover';});
 }catch(error){if(activeBookId===bookId&&workspaceKey===owner)toast(error.message?.includes('2400')?error.message:'照片无法读取，请换一张静态图片重试。');}
 finally{URL.revokeObjectURL(url);}
}
