'use strict';

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
// Keep legacy font IDs so saved pages retain their typography.
const textFonts=[
 {id:'serif',name:'宋体',family:'var(--serif)'},
 {id:'sans',name:'黑体',family:'var(--sans)'},
 {id:'hand',name:'楷体 · 手写感',family:"KaiTi,STKaiti,'Kaiti SC',var(--serif)"},
 {id:'fangsong',name:'仿宋',family:"FangSong,STFangsong,'FangSong SC',var(--serif)"},
 {id:'rounded',name:'圆体',family:"'Yuanti SC',STYuanti,YouYuan,var(--sans)"}
];
let newTextFont='serif';
const textFont=id=>textFonts.find(f=>f.id===id)||textFonts[0];
const textFontOptions=id=>textFonts.map(f=>`<option value="${f.id}" ${f.id===textFont(id).id?'selected':''}>${f.name}</option>`).join('');
const textFontSelect=(id,value,label)=>`<label class="text-font-field"><span>${label}</span><select id="${id}">${textFontOptions(value)}</select></label>`;
const paths={book:'M3 4h7c1.5 0 2 1 2 2v15c0-2-2-3-4-3H3z M21 4h-7c-1.5 0-2 1-2 2v15c0-2 2-3 4-3h5z',spark:'m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3z',sticker:'M20 13V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h8z M13 20v-5a2 2 0 0 1 2-2h5',plus:'M12 5v14M5 12h14',arrow:'M4 12h16m-6-6 6 6-6 6',left:'m15 6-6 6 6 6',right:'m9 6 6 6-6 6',up:'m6 15 6-6 6 6',down:'m6 9 6 6 6-6',close:'m6 6 12 12M6 18 18 6',more:'M5 12h.01M12 12h.01M19 12h.01',lock:'M6 10h12v10H6zM8 10V7a4 4 0 0 1 8 0v3',info:'M12 11v6m0-10v.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',list:'M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01',search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',image:'M3 3h18v18H3zM3 17l6-6 4 4 3-3 5 5M7 7h.01',text:'M4 5V3h16v2M12 3v18M8 21h8',paper:'M5 3h11l3 3v15H5zM15 3v5h4M8 12h8M8 16h6',undo:'M8 4 3 9l5 5M3 9h11a6 6 0 0 1 0 12',redo:'m16 4 5 5-5 5M21 9H10a6 6 0 0 0 0 12',copy:'M8 8h13v13H8zM16 8V3H3v13h5',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',rotate:'M3 10a9 9 0 1 1 2 8M3 4v6h6',minus:'M5 12h14',layers:'m12 3 10 6-10 6L2 9zM2 13l10 6 10-6M2 17l10 6 10-6',check:'m5 12 4 4L19 6',upload:'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',download:'M12 3v13m-5-5 5 5 5-5M4 18v3h16v-3',flip:'M12 3v18M8 5 3 19h5zM16 5l5 14h-5z',pen:'m3 21 1-5L16 4l4 4L8 20zM14 6l4 4'};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.spark}"/></svg>`;
const ib = (action,name,title,extra='') => `<button class="icon-button" data-action="${action}" aria-label="${title}" title="${title}" ${extra}>${icon(name)}</button>`;
const svgSticker = (body,w=200,h=220) => 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><defs><filter id="s" x="-25%" y="-25%" width="150%" height="150%"><feMorphology in="SourceAlpha" operator="dilate" radius="4" result="d"/><feFlood flood-color="#fffdf6"/><feComposite in2="d" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g filter="url(#s)">${body}</g></svg>`);
const builtin=[
 {id:'flower',name:'一束小野花',category:'植物',src:svgSticker('<path d="M92 197 102 46M95 169 56 83M98 133l45-58M92 188l-32-47" fill="none" stroke="#627450" stroke-width="4"/><path d="M96 145q-43-30-45-5 18 24 43 17M99 117q39-36 45-10-14 27-46 20M93 180q-27-21-27-4 13 18 27 16" fill="#798764"/><g fill="#e3a640"><ellipse cx="101" cy="36" rx="12" ry="22"/><ellipse cx="101" cy="36" rx="12" ry="22" transform="rotate(60 101 36)"/><ellipse cx="101" cy="36" rx="12" ry="22" transform="rotate(120 101 36)"/></g><circle cx="101" cy="36" r="9" fill="#70573b"/><g fill="#e6c6b1"><ellipse cx="53" cy="78" rx="10" ry="18"/><ellipse cx="53" cy="78" rx="10" ry="18" transform="rotate(60 53 78)"/><ellipse cx="53" cy="78" rx="10" ry="18" transform="rotate(120 53 78)"/></g><circle cx="53" cy="78" r="7" fill="#ae7051"/><g fill="#bd654c"><ellipse cx="150" cy="69" rx="10" ry="17"/><ellipse cx="150" cy="69" rx="10" ry="17" transform="rotate(60 150 69)"/><ellipse cx="150" cy="69" rx="10" ry="17" transform="rotate(120 150 69)"/></g><circle cx="150" cy="69" r="6" fill="#eed19e"/>')},
 {id:'coffee',name:'今天也喝一杯',category:'物品',src:svgSticker('<ellipse cx="95" cy="176" rx="69" ry="18" fill="#bfbea7"/><ellipse cx="95" cy="172" rx="62" ry="14" fill="#e9e3ce"/><path d="M140 77h16q28 0 24 34-3 28-37 20" fill="none" stroke="#6a7a58" stroke-width="14"/><path d="M36 69h115l-9 81q-8 32-48 32t-48-32z" fill="#6a7a58"/><path d="M41 81q6 8 10 66" fill="none" stroke="#899976" stroke-width="6"/><ellipse cx="93" cy="70" rx="57" ry="19" fill="#eae0c1"/><ellipse cx="93" cy="70" rx="48" ry="13" fill="#6d4430"/><path d="M75 70q18-18 36 0-18 21-36 0" fill="#d4b789"/><path d="M81 21q-14 12 0 26M108 16q-15 11 0 28" stroke="#b8b6a1" stroke-width="3" fill="none"/>')},
 {id:'camera',name:'随身小相机',category:'物品',src:svgSticker('<path d="M42 59h29l12-17h41l12 17h26q15 0 15 16v93q0 16-15 16H36q-14 0-14-16V76q0-17 20-17" fill="#454b47"/><path d="M28 78h143v38H28z" fill="#bbb9a6"/><rect x="37" y="68" width="28" height="14" rx="3" fill="#7d8479"/><rect x="135" y="70" width="24" height="16" rx="2" fill="#d9c789"/><circle cx="103" cy="124" r="42" fill="#272f2c" stroke="#d5d0ba" stroke-width="6"/><circle cx="103" cy="124" r="28" fill="#657b78" stroke="#161f1c" stroke-width="5"/><circle cx="103" cy="124" r="16" fill="#1c302b"/><circle cx="93" cy="113" r="7" fill="#a1b6a080"/><path d="M42 157h19" stroke="#a3a995" stroke-width="3"/><path d="M37 60V50h18v10" fill="#343d37"/>')},
 {id:'orange',name:'一颗好心情',category:'物品',src:svgSticker('<path d="M96 71q-38-57 21-40-4 22-21 40" fill="#697e4e"/><path d="M100 72q41-60 58-16-20 25-58 16" fill="#8e9b56"/><path d="M99 86q4-24 14-39" stroke="#766242" stroke-width="5" fill="none"/><path d="M102 81c-81-29-114 106-12 119 97 1 95-129 12-119" fill="#dc8b36"/><path d="M65 109q-20 24-8 51" stroke="#efae56" stroke-width="13" fill="none" stroke-linecap="round"/><g fill="#c9772d"><circle cx="113" cy="166" r="2"/><circle cx="136" cy="140" r="2"/><circle cx="115" cy="109" r="2"/><circle cx="85" cy="184" r="2"/><circle cx="145" cy="165" r="2"/></g>')},
 {id:'ticket',name:'下一站，慢生活',category:'旅行',src:svgSticker('<path d="M20 47h160v24q-16 8 0 17v68q-16 8 0 17v22H20v-22q16-9 0-17V88q16-9 0-17z" fill="#e6b78f"/><rect x="31" y="58" width="138" height="126" fill="none" stroke="#a96343"/><path d="M126 59v124" stroke="#b57753" stroke-dasharray="3 4"/><text x="41" y="84" font-size="9" fill="#75412f" font-family="monospace">ONE WAY TICKET</text><text x="43" y="119" font-size="25" fill="#75412f" font-family="serif">SLOW</text><text x="44" y="143" font-size="19" fill="#75412f" font-family="serif">DAYS.</text><path d="M43 162h68M45 159v12M50 159v12M54 159v12M63 159v12M69 159v12M75 159v12M81 159v12M90 159v12M100 159v12M108 159v12" stroke="#75412f"/><text x="148" y="146" transform="rotate(-90 148 146)" font-size="10" fill="#75412f" font-family="monospace">NO. 0926</text>')},
 {id:'leaf',name:'把绿色留下',category:'植物',src:svgSticker('<path d="M58 201Q76 93 146 22" stroke="#677e51" stroke-width="4" fill="none"/><path d="M72 162Q10 145 25 109q48-6 50 47M86 128Q40 99 64 66q36 8 26 56M111 82q-21-46 17-57 17 26-12 55M77 151q15-62 61-47 5 39-61 53M96 108q37-47 63-16-10 32-62 25M126 60q20-46 47-27-4 30-47 33" fill="#7d9164"/><path d="m31 120 42 38m1-77 15 43m44-10-52 38m73-52-54 16" fill="none" stroke="#adbc8e" stroke-width="2"/>')},
 {id:'stamp',name:'记忆已签收',category:'装饰',src:svgSticker('<path d="M32 39h136v150H32z" fill="#f2ead4" stroke="#899780" stroke-width="9" stroke-dasharray="1 10"/><rect x="42" y="49" width="116" height="129" fill="#d5ddc5"/><path d="m47 142 37-64 33 46 23-23 14 41z" fill="#728870"/><path d="m70 103 15-26 21 31-16-6-8 9z" fill="#f4ecd7"/><circle cx="132" cy="72" r="11" fill="#e1b165"/><text x="100" y="166" text-anchor="middle" font-family="serif" font-size="12" fill="#42543f">KEEP EXPLORING</text>')},
 {id:'tape',name:'奶油格纹胶带',category:'装饰',src:svgSticker('<path d="m14 22 170-7-5 9 7 8-7 10 7 8-4 11L13 68l4-9-7-7 7-9-7-8z" fill="#d3ba84" opacity=".85"/><path d="M35 22v41M57 20v42M79 19v43M101 19v41M123 17v42M145 17v41M167 16v42M17 36l163-6M17 51l163-6" stroke="#f6ecd1" stroke-width="7" opacity=".45"/>',200,85)},
 {id:'star',name:'闪闪发光的日子',category:'装饰',src:svgSticker('<path d="m100 14 11 57 43-37-27 49 59 5-54 24 45 33-59-9 7 60-31-50-24 52-3-60-54 20 40-43-55-16 59-5-30-48 47 35z" fill="#bb6047"/><circle cx="99" cy="105" r="12" fill="#eed8ac"/>')},
];
const art = id => builtin.find(a=>a.id===id)?.src || '';
const asset = id => {const a=state.assets.find(a=>a.id===id)||(state.archivedAssets||[]).find(a=>a.id===id)||builtin.find(a=>a.id===id);return a?{...a,src:assetSource(a)}:a;};
const node = (type,opts) => ({id:uid(),type,x:15,y:15,w:35,rotation:0,...opts});
const blankPage = () => ({id:uid(),paper:'plain',elements:[]});
const paperGroups=[
 {name:'基础书写',items:[['plain','奶油空白','安静留白'],['dots','细点纸','轻巧定位'],['grid','方格纸','整齐记录'],['lines','横线纸','慢慢写下']]},
 {name:'纸张材质',items:[['cotton','棉纸','细纤维 · 暖白'],['watercolor','水彩纸','淡彩晕染'],['kraft','浅牛皮纸','温暖纤维'],['letter','旧信纸','泛旧的信笺']]},
 {name:'轻装饰',items:[['botanical','植物边饰','枝叶留在页角'],['postmark','邮戳信笺','旅行来信'],['collage','淡拼贴','轻叠纸片'],['album','相册边框','留住一页回忆'],["texture-0381", "金箔便笺", "复古边框与横线"],["texture-newsprint-corner", "报纸页角", "报纸与方格页角"],["texture-dried-flower-note", "干花旧笺", "干花、撕边与回形针"],["texture-layered-paper", "层叠纸片", "复古纸片拼贴"],["texture-floral-margin", "小花边笺", "细花侧边装饰"],["texture-coffee-scrapbook", "咖啡拼笺", "咖啡渍与撕纸框"],["texture-navy-check-note", "蓝格便笺", "深蓝格纹拼贴"],["texture-star-heart-grid", "星心方格", "蓝紫星星与爱心"],["texture-butterfly-botanical", "蝶影花笺", "蝴蝶与植物拼贴"]]},
 {name:"暖色质感",items:[["texture-0297", "暮棕纸", "深棕细纹"], ["texture-0427", "米色牛皮", "柔和米黄"], ["texture-0445", "蜜蜡纸", "暖金细纹"], ["texture-0454", "鼠尾草纸", "浅绿灰纹"],["texture-0259", "奶杏柔纹", "浅奶油晕染"],["texture-0321", "燕麦纸", "柔暖米棕"],["texture-0344", "旧玫瑰纸", "灰粉复古纹"],["texture-0366", "浅粉棉纹", "柔粉细颗粒"],["texture-0411", "芥黄纸", "柔黄细纹"],["texture-0420", "焦糖旧纸", "暖棕斑驳"],["texture-0433", "鎏金砂纹", "金黄砂粒"],["texture-aged-parchment", "泛黄旧纸", "暖黄岁月痕迹"],["texture-weathered-sepia", "褐色斑驳", "深浅交错旧纸纹"]]},
 {name:"彩色纸面",items:[["texture-0302", "新绿渐染", "草绿到嫩黄"], ["texture-0431", "雾蓝砂纹", "蓝灰颗粒"], ["texture-0444", "落日渐染", "金黄到朱红"], ["texture-0452", "砖红砂纹", "复古红褐"],["texture-0292", "春野流彩", "青绿到暖粉"],["texture-0303", "苔绿渐染", "苔绿到米灰"],["texture-0330", "桃雾渐染", "杏桃到雾紫"],["texture-0336", "蓝紫流光", "蓝紫纤维纹"],["texture-0339", "晚霞织纹", "粉红到靛蓝"],["texture-0362", "晴空渐染", "浅黄到湖蓝"],["texture-0369", "薄荷渐染", "清青到嫩绿"],["texture-0405", "湖蓝棉纹", "清蓝细纹"],["texture-0406", "嫩绿棉纹", "鲜绿细纹"]]},
 {name:"手作纹理",items:[["texture-0518", "岩纹纸", "自然斑驳"], ["texture-0521", "云白纤维", "柔白细纤维"], ["texture-0526", "青灰长纤", "浅青纤维纹"], ["texture-0527", "墨色长纤", "深色底 · 适合浅色字"],["texture-0290", "云絮纸", "浅白云絮纹"],["texture-0375", "麦金纤维", "暖金粗纤维"],["texture-0377", "青金纤维", "青绿金黄长纤"],["texture-0401", "米白碎纤", "细碎纤维点"],["texture-0402", "银灰棉纹", "中性灰棉纤维"],["texture-0428", "雪白长纤", "浅白长纤维"],["texture-0429", "朱红长纤", "深红底 · 适合浅色字"],["texture-white-relief", "浮纹白纸", "厚实白色纤维纹"],["texture-creased-white", "折痕白纸", "泛白旧纸与折痕"]]},
 {name:"面料质感",items:[["texture-0476", "米白亚麻", "浅米白粗织纹"], ["texture-0474", "奶黄绒纹", "柔黄绒面织纹"], ["texture-0485", "浅绿织纹", "浅绿横向织纹"], ["texture-0483", "卡其织纹", "灰卡其细织纹"], ["texture-0486", "雾紫格织", "紫灰方格织纹"], ["texture-0487", "靛灰细织", "深蓝灰密织纹"], ["texture-0477", "深棕格布", "深棕复古格纹"]]}
];
let paperCategory='0';
const paperPreferenceKey=(kind,id)=>`shiye-paper-preference-v1:${kind}:${id}`;
function paperPreference(kind,id){try{return localStorage.getItem(paperPreferenceKey(kind,id))==='1';}catch{return false;}}
function paperDrawerHTML(){
 const all=paperGroups.flatMap(g=>g.items),favorites=all.filter(([id])=>paperPreference('favorite',id));
 const items=[...(paperCategory==='favorites'?favorites:paperGroups[Number(paperCategory)].items)];
 items.sort((a,b)=>Number(paperPreference('pin',b[0]))-Number(paperPreference('pin',a[0])));
 const categories=[['favorites','☆ 收藏'],...paperGroups.map((g,i)=>[String(i),g.name])];
 return `<section class="drawer paper-drawer"><div class="paper-panel-header"><div class="drawer-head"><h3>挑一张纸</h3>${ib('close-drawer','close','关闭工具面板')}</div>${paperScopeHTML()}<div class="paper-categories" role="group" aria-label="纸张分类">${categories.map(([id,name])=>`<button class="paper-category ${paperCategory===id?'active':''}" data-action="paper-category" data-value="${id}" aria-pressed="${paperCategory===id}">${name}</button>`).join('')}</div><p class="paper-note">${paperCategory==='favorites'?`已收藏 ${items.length} 种`:`${paperGroups[Number(paperCategory)].name} · ${items.length} 种`} · 点击纸面应用</p></div><div class="paper-panel-body"><div class="paper-options">${items.map(([id,name,hint])=>{
 const favorite=paperPreference('favorite',id),pinned=paperPreference('pin',id),chosen=(currentPage().paperSpread?.paper||currentPage().paper)===id;
 return `<article class="paper-card"><button class="paper-choice ${chosen?'active':''}" data-action="paper" data-value="${id}" aria-label="${name}" aria-pressed="${chosen}" title="${name} · ${hint}"><span class="paper-preview" aria-hidden="true"><span class="paper-swatch canvas-page ${id}"></span>${chosen?`<span class="paper-chosen">${icon('check')}</span>`:''}</span><span class="paper-choice-name">${name}</span><small>${hint}</small></button><div class="paper-card-actions"><button class="paper-favorite ${favorite?'active':''}" data-action="paper-favorite" data-value="${id}" aria-label="${favorite?'取消收藏':'收藏'}${name}" aria-pressed="${favorite}" title="${favorite?'取消收藏':'收藏'}">${favorite?'★':'☆'}</button>${pinned?'<span class="paper-pin-label">已置顶</span>':''}<details class="paper-card-menu"><summary aria-label="${name}的更多操作" title="更多操作">⋯</summary><button data-action="paper-pin" data-value="${id}">${pinned?'取消置顶':'置顶'}</button></details></div></article>`;
 }).join('')}</div>${items.length?'':'<div class="paper-empty"><span>☆</span><p>还没有收藏的纸张</p><small>点击纸张下方的星标，收好喜欢的纸。</small></div>'}</div></section>`;
}
function refreshPaperDrawer(action,value,scroll=0){
 const panel=$('.paper-drawer');if(!panel)return;
 panel.outerHTML=paperDrawerHTML();$('.paper-panel-body').scrollTop=scroll;
 const target=$(`[data-action="${action}"][data-value="${value}"]`,$('.paper-drawer'))||$('.paper-category.active');
 target?.focus({preventScroll:true});
}
window.addEventListener('storage',e=>{if((e.key===null||e.key.startsWith('shiye-paper-preference-v1:'))&&currentView==='editor'&&editing&&drawer==='paper')refreshPaperDrawer('paper-category',paperCategory,$('.paper-panel-body')?.scrollTop||0);});

const samplePage = kind => {
 const p=blankPage();
 if(kind==='lake') p.elements=[node('text',{text:'一些山野，\n一些自由。',x:9,y:6,w:75,size:30,color:'#425b42'}),node('text',{text:'INTO THE QUIET  /  2026',x:10,y:23,w:73,size:8,font:'sans',color:'#8c917c'}),node('photo',{src:'assets/lake.jpg',x:10,y:30,w:78,rotation:-4,frame:true}),node('sticker',{assetId:'tape',x:31,y:27,w:30,rotation:-7}),node('sticker',{assetId:'flower',x:61,y:58,w:32,rotation:12}),node('text',{text:'风吹过山谷，\n我们也没有急着赶路。',x:11,y:76,w:58,size:15,color:'#6d715e',rotation:-3}),node('text',{text:'09 / 07     留给自己的片刻',x:11,y:91,w:75,size:8,font:'sans',color:'#959782'})];
 else if(kind==='coffee') p.elements=[node('text',{text:'A little pause.',x:10,y:8,w:80,size:31,color:'#69533e',font:'serif',italic:true}),node('text',{text:'不赶时间的星期天',x:11,y:19,w:78,size:13,color:'#86785f'}),node('photo',{src:'assets/coffee.jpg',x:13,y:29,w:66,rotation:5,frame:true}),node('sticker',{assetId:'coffee',x:55,y:53,w:39,rotation:-11}),node('sticker',{assetId:'ticket',x:6,y:53,w:31,rotation:-12}),node('text',{text:'阳光刚好，咖啡也刚好。\n把今天过得松一点。',x:12,y:82,w:75,size:16,color:'#7b6f5b'})];
 else p.elements=[node('text',{text:'沿着有光的地方走',x:10,y:7,w:85,size:25,color:'#536146'}),node('photo',{src:'assets/forest.jpg',x:13,y:21,w:71,rotation:-3,frame:true}),node('sticker',{assetId:'leaf',x:63,y:53,w:34,rotation:10}),node('text',{text:'没有目的地，也是一种抵达。',x:10,y:80,w:83,size:16,color:'#738162'}),node('text',{text:'FIELD NOTES  ·  VOL. 02',x:11,y:91,w:80,size:8,font:'sans',color:'#8b9382'})];
 return p;
};
function seed(){return {version:1,assets:[],books:[{id:uid(),title:'山野来信',subtitle:'LETTERS FROM THE WILD',cover:'olive',sample:true,updated:Date.now()-4000,pages:[samplePage('lake'),samplePage('forest')],page:0},{id:uid(),title:'日常的小确幸',subtitle:'THE LITTLE THINGS',cover:'cream',sample:true,updated:Date.now()-5000,pages:[samplePage('coffee')],page:0},{id:uid(),title:'慢慢生活',subtitle:'SLOW DAYS, GOOD DAYS',cover:'coral',sample:true,updated:Date.now()-6000,pages:[samplePage('coffee'),blankPage()],page:0}]};}
let state,db,currentView='home',activeBookId=null,editing=false,selectedId=null,drawer=null,filter='全部',collectionTab='builtin',search='',bookFilter='all',bookView='grid',sort='recent',saveStatus='已保存到本机',saveTimer,savePromise=Promise.resolve(),toastTimer,history=[],future=[],dragState=null,resizeObserver;
let workshop={step:0,selected:['coffee','flower'],preview:0,border:4,source:null,crops:[],results:[],demo:true};
let workshopReturn=null;
let workshopOrigin=null,pendingUseIds=[],savingStickers=false;
const pendingAssetBlobs=new Map(),assetURLs=new Map();
let segmentedWorkshop=null;
const assetSource=a=>a.src||(a.blobKey?assetURLs.get(a.blobKey):'')||'';
async function hydrateBlobAssets(workspace){
 const rows=[...workspace.assets,...(workspace.archivedAssets||[])].filter(a=>a.blobKey&&!assetURLs.has(a.blobKey));
 if(!rows.length||!db)return;
 await new Promise((resolve,reject)=>{const tx=db.transaction('data'),store=tx.objectStore('data');
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  for(const a of rows){const req=store.get(a.blobKey);req.onsuccess=()=>{if(req.result instanceof Blob)assetURLs.set(a.blobKey,URL.createObjectURL(req.result));};}
 });
}
let savedWorkspace=null,mutationVersion=0,navigationVersion=0,photoTaskVersion=0;
const clone=value=>JSON.parse(JSON.stringify(value));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// Merge against the last successful read/commit, inside one read-write transaction.
// Only locally changed records are applied; a conflicting book becomes a separate copy.
function mergeWorkspace(base,local,remote){
 const merged=clone(remote),copies=new Map();
 for(const key of ['books','assets','archivedAssets']){
  const before=new Map((base[key]||[]).map(x=>[x.id,x]));
  const after=new Map((local[key]||[]).map(x=>[x.id,x]));
  const rows=new Map((remote[key]||[]).map(x=>[x.id,x]));
  for(const id of new Set([...before.keys(),...after.keys()])){
   const old=before.get(id),next=after.get(id),latest=rows.get(id);
   if(same(old,next))continue;
   if(!same(old,latest)&&!same(next,latest)){
    if(key==='books'&&next){
     const copy={...clone(next),id:uid(),title:`${next.title}（冲突副本）`,sample:false};
     rows.set(copy.id,copy);copies.set(id,copy.id);continue;
    }
    throw new Error('workspace-conflict');
   }
   if(next)rows.set(id,clone(next));else rows.delete(id);
  }
  if(rows.size||key!=='archivedAssets')merged[key]=[...rows.values()];
 }
 merged.revision=(remote.revision||0)+1;
 return {merged,copies};
}
// Changes made while the transaction was pending stay in memory for the next save.
function rebasePending(snapshot,current,committed,copies){
 const result=clone(committed),baseline=clone(committed),remapped=new Map(copies);
 for(const key of ['books','assets','archivedAssets']){
  const before=new Map((snapshot[key]||[]).map(x=>[x.id,x]));
  const after=new Map((current[key]||[]).map(x=>[x.id,x]));
  const rows=new Map((result[key]||[]).map(x=>[x.id,x]));
  for(const id of new Set([...before.keys(),...after.keys()])){
   if(same(before.get(id),after.get(id)))continue;
   const target=key==='books'?(copies.get(id)||id):id,next=after.get(id);
   if(target===id&&!same(before.get(id),rows.get(id))&&!same(next,rows.get(id))){
    if(key==='books'&&next){const copy={...clone(next),id:uid(),title:`${next.title}（冲突副本）`,sample:false};rows.set(copy.id,copy);remapped.set(id,copy.id);continue;}
    // Keep the original comparison base for unresolved asset/delete conflicts;
    // the next transaction must reject them rather than silently overwrite.
    const baseRows=new Map((baseline[key]||[]).map(x=>[x.id,x]));
    if(before.has(id))baseRows.set(id,clone(before.get(id)));else baseRows.delete(id);
    baseline[key]=[...baseRows.values()];
   }
   if(next){const row=clone(next);row.id=target;if(target!==id)row.title=rows.get(target)?.title||`${row.title}（冲突副本）`;rows.set(target,row);}
   else rows.delete(target);
  }
  if(rows.size||key!=='archivedAssets')result[key]=[...rows.values()];
 }
 return {state:result,baseline,copies:remapped};
}
const currentBook = ()=>state.books.find(b=>b.id===activeBookId);
const currentPage = ()=>currentBook()?.pages[currentBook().page||0];
const currentElement = ()=>elementPage()?.elements.find(e=>e.id===selectedId);
// Physical spreads retain page IDs when reordered. Legacy books keep their original pairing.
function bookSpreads(b=currentBook()){
 const groups=[];
 (b?.pages||[]).forEach((p,i)=>{
  const key=p.spreadKey||`legacy-${Math.floor((i+1)/2)}`;
  let group=groups.find(g=>g.key===key);
  if(!group){group={key,left:null,right:null};groups.push(group);}
  group[p.spreadSide||(i%2?'left':'right')]=p;
 });return groups;
}
const spreadPages=g=>[g?.left,g?.right].filter(Boolean);
const pageSpread=(p=currentPage(),b=currentBook())=>bookSpreads(b).find(g=>spreadPages(g).some(pg=>pg.id===p?.id));
function ensurePagePairs(){for(const g of bookSpreads()){const key=g.key.startsWith('legacy-')?uid():g.key;for(const side of ['left','right'])if(g[side]){g[side].spreadKey=key;g[side].spreadSide=side;}}}
const spreadEditing=()=>currentBook()?.editorLayout==='spread';
const elementPage=(id=selectedId)=>currentBook()?.pages.find(p=>p.elements.some(e=>e.id===id));
const matePage=p=>spreadPages(pageSpread(p)).find(pg=>pg.id!==p.id);
function paperLayer(p){
 if(!p.paperSpread)return '';
 return `<div class="spread-paper-clip" aria-hidden="true"><div class="spread-paper canvas-page ${p.paperSpread.paper}" style="left:${p.paperSpread.side==='right'?-100:0}%"></div></div>`;
}
function pageElements(p){
 const g=pageSpread(p);if(!g)return p.elements;
 const side=g.left?.id===p.id?'left':'right';
 return spreadPages(g).flatMap(owner=>owner.elements.filter(e=>owner.id===p.id||e.spreadWith===p.id).map(e=>({...e,x:e.x+(owner.id===p.id?0:side==='left'?100:-100)})));
}
function chooseEditorPage(p){
 if(!p||p.id===currentPage()?.id)return;
 finishInlineText();$('#canvas-page')?.removeAttribute('id');currentBook().page=currentBook().pages.findIndex(pg=>pg.id===p.id);selectedId=null;
 const canvas=$(`[data-edit-page="${p.id}"]`);if(canvas)canvas.id='canvas-page';
 $$('.edit-leaf').forEach(el=>el.classList.toggle('active-leaf',el.dataset.editPage===p.id));
 $$('.page-thumb').forEach(el=>el.classList.toggle('active',el.dataset.pageId===p.id));
 const label=$('.active-page-label');if(label)label.textContent=`正在编辑第 ${currentBook().page+1} 页`;
 dirty();refreshSelection();if(drawer==='paper')refreshPaperDrawer('paper-category',paperCategory);
}
function spreadStageHTML(){
 const b=currentBook(),g=pageSpread(),groups=bookSpreads(),index=groups.findIndex(x=>x.key===g.key);
 const leaves=['left','right'].map(side=>{const p=g[side];return p?`<div id="${p.id===currentPage().id?'canvas-page':''}" class="canvas-page edit-leaf ${p.paper} ${p.id===currentPage().id?'active-leaf':''}" data-edit-page="${p.id}" data-side="${side}" aria-label="第 ${b.pages.indexOf(p)+1} 页，可直接编辑">${elementsHTML(p)}<span class="edit-page-label">${b.pages.indexOf(p)+1}</span></div>`:`<div class="edit-endpaper"><span>${side==='left'?'首页单独成页':'这半页，还等着你的故事'}</span>${side==='right'?'<button class="button outline small" data-action="add-mate">添加右页</button>':'<button class="button outline small" data-action="add-spread">新建双页</button>'}</div>`;}).join('');
 return `<div class="stage-wrap spread-edit-stage"><button class="page-arrow prev" data-action="page-prev" aria-label="上一组书页" ${index===0?'disabled':''}>${icon('left')}</button><div class="page-frame edit-spread">${leaves}<div class="edit-binding" aria-hidden="true"></div></div><button class="page-arrow next" data-action="page-next" aria-label="下一组书页" ${index===groups.length-1?'disabled':''}>${icon('right')}</button></div>`;
}
function layoutControlsHTML(){return `<div class="layout-controls"><div class="mode-switch" role="group" aria-label="编辑页数"><button data-action="editor-layout" data-value="single" aria-pressed="${!spreadEditing()}" class="${!spreadEditing()?'active':''}">单页</button><button data-action="editor-layout" data-value="spread" aria-pressed="${spreadEditing()}" class="${spreadEditing()?'active':''}">双页</button></div><span class="active-page-label">正在编辑第 ${currentBook().page+1} 页</span>${spreadEditing()?'<span class="layout-hint">点击左页或右页直接编辑</span>':''}</div>`;}
function paperScopeHTML(){const g=pageSpread(),both=g?.left&&g?.right;return `<div class="paper-scope"><div class="mode-switch" role="group" aria-label="纸张铺法"><button data-action="paper-scope" data-value="page" aria-pressed="${!currentPage().paperSpread}" class="${!currentPage().paperSpread?'active':''}">左右分别选纸</button><button data-action="paper-scope" data-value="spread" ${both?'':'disabled'} aria-pressed="${!!currentPage().paperSpread}" class="${currentPage().paperSpread?'active':''}">一张铺满双页</button></div><small>${both?`当前第 ${currentBook().page+1} 页 · ${currentPage().paperSpread?'整幅背景，单页显示对应半幅':'点另一页，可为它选择不同的纸'}`:'需要完整双页才可铺满，可在双页视图中添加'}</small></div>`;}
function stickerScopeHTML(item=null){const cross=item?!!item.spreadWith:currentBook().stickerPlacement==='spread';return `<label class="sticker-scope"><span>${item?'这枚贴纸':'新贴纸放置范围'}</span><select id="${item?'selected-sticker-scope':'new-sticker-scope'}"><option value="page" ${cross?'':'selected'}>只在一页内</option><option value="spread" ${cross?'selected':''} ${matePage(item?elementPage(item.id):currentPage())?'':'disabled'}>允许跨书缝</option></select></label>`;}
function setSpreadPaper(paper){const g=pageSpread();if(!g?.left||!g?.right)return;for(const side of ['left','right'])g[side].paperSpread={paper,side};}
function clearSpreadPaper(){for(const p of spreadPages(pageSpread()))delete p.paperSpread;}
function setStickerScope(item,value){
 const owner=elementPage(item.id),mate=matePage(owner);
 if(value==='spread'&&mate)item.spreadWith=mate.id;else delete item.spreadWith;
 constrainSticker(item,owner);
}
function constrainSticker(item,owner=elementPage(item.id)){
 if(item.type!=='sticker'||!owner)return;
 const mate=matePage(owner),cross=mate&&item.spreadWith===mate.id,side=pageSpread(owner).left?.id===owner.id?'left':'right';
 const min=cross&&side==='right'?-100:0,max=cross&&side==='left'?200:100;
 const img=$(`[data-element="${item.id}"] img`),ratio=img?.naturalWidth?img.naturalHeight/img.naturalWidth:1;
 const angle=(item.rotation||0)*Math.PI/180,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
 const fullW=item.w*(c+ratio*s),fullH=item.w*(s+ratio*c)*420/540;
 const factor=Math.min(1,(max-min)/fullW,100/fullH);item.w*=factor;
 const h=item.w*ratio*420/540,rotW=fullW*factor,rotH=fullH*factor;
 item.x=Math.max(min+(rotW-item.w)/2,Math.min(max-(rotW+item.w)/2,item.x));
 item.y=Math.max((rotH-h)/2,Math.min(100-(rotH+h)/2,item.y));
}
function projectedX(item,p){const owner=elementPage(item.id);if(!owner||owner.id===p.id)return item.x;return item.x+(pageSpread(p).left?.id===p.id?100:-100);}
function insertPages(double=false){
 ensurePagePairs();const b=currentBook(),g=pageSpread(),members=spreadPages(g),after=Math.max(...members.map(p=>b.pages.indexOf(p)))+1;
 if(!double&&g.left&&!g.right){const p={...blankPage(),spreadKey:g.key,spreadSide:'right'};b.pages.splice(after,0,p);b.page=after;}
 else{const key=uid(),pages=[{...blankPage(),spreadKey:key,spreadSide:'left'}];if(double)pages.push({...blankPage(),spreadKey:key,spreadSide:'right'});b.pages.splice(after,0,...pages);b.page=after;}
 selectedId=null;
}
function moveSpread(from,to){
 const b=currentBook();ensurePagePairs();const groups=bookSpreads(),g=pageSpread(b.pages[from]),target=pageSpread(b.pages[to]);if(!g||!target||g.key===target.key)return;
 const active=currentPage().id,source=groups.findIndex(x=>x.key===g.key),destination=groups.findIndex(x=>x.key===target.key);groups.splice(source,1);groups.splice(destination,0,g);b.pages=groups.flatMap(spreadPages);b.page=b.pages.findIndex(p=>p.id===active);
}
function duplicateSpread(){
 ensurePagePairs();const b=currentBook(),g=pageSpread(),pages=spreadPages(g),key=uid(),ids=new Map(pages.map(p=>[p.id,uid()]));
 const copies=clone(pages);for(const p of copies){p.id=ids.get(p.id);p.spreadKey=key;for(const e of p.elements){e.id=uid();if(e.spreadWith)e.spreadWith=ids.get(e.spreadWith);}}
 const at=Math.max(...pages.map(p=>b.pages.indexOf(p)))+1;b.pages.splice(at,0,...copies);b.page=at;selectedId=null;
}
function pagesToDelete(){const p=currentPage(),g=pageSpread();return spreadPages(g).some(pg=>pg.paperSpread||pg.elements.some(e=>e.spreadWith))?spreadPages(g):[p];}

function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3200);}
function updateStatus(){ $$('.local-status').forEach(el=>{el.textContent=saveStatus;el.classList.toggle('save-error',saveStatus==='保存失败，请重试');}); }
function saveNow(){
 clearTimeout(saveTimer);saveStatus='正在保存…';updateStatus();
 savePromise=savePromise.catch(()=>{}).then(async()=>{
  if(!db||!savedWorkspace)throw new Error('storage unavailable');
  const snapshot=clone(state),base=clone(savedWorkspace),version=mutationVersion,blobSnapshot=new Map(pendingAssetBlobs);
  const {merged,copies}=await new Promise((resolve,reject)=>{
   const tx=db.transaction('data','readwrite'),store=tx.objectStore('data');let result,error;
   tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(error||tx.error);tx.onabort=()=>reject(error||tx.error);
   const request=store.get('workspace');
   request.onsuccess=()=>{try{
    if(!request.result)throw new Error('workspace-conflict');
    result=mergeWorkspace(base,snapshot,request.result);
    for(const a of [...result.merged.assets,...(result.merged.archivedAssets||[])])if(a.blobKey&&blobSnapshot.has(a.blobKey))store.put(blobSnapshot.get(a.blobKey),a.blobKey);
    store.put(result.merged,'workspace');
   }catch(e){error=e;tx.abort();}};
  });
  const pending=rebasePending(snapshot,state,merged,copies);state=pending.state;savedWorkspace=pending.baseline;
  for(const [key,value] of blobSnapshot)if(pendingAssetBlobs.get(key)===value)pendingAssetBlobs.delete(key);
  await hydrateBlobAssets(state);
  if(pending.copies.has(activeBookId)){if(inlineText?.bookId===activeBookId)inlineText.bookId=pending.copies.get(activeBookId);activeBookId=pending.copies.get(activeBookId);if($('#book-title'))$('#book-title').value=currentBook().title;}
  saveStatus=mutationVersion===version?'已保存到本机':'正在保存…';updateStatus();
  if(pending.copies.size)toast(saveStatus==='已保存到本机'?'检测到另一页面的修改，两个版本均已保留；当前版本已另存为冲突副本。':'检测到另一页面的修改，正在保存当前冲突副本，请保持页面打开。');
  return true;
 }).catch(error=>{saveStatus='保存失败，请重试';updateStatus();toast(error?.message==='workspace-conflict'?'另一页面修改了相同内容，已阻止覆盖。当前改动仍在本页，请勿刷新或关闭。':'未能保存到本机，请保持当前页面打开并重试。');return false;});
 return savePromise;
}
function dirty(){mutationVersion++;if(currentBook()&&currentView==='editor')currentBook().updated=Date.now();saveStatus='正在保存…';updateStatus();clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,500);}
function checkpoint(){history.push(JSON.stringify(currentBook()?.pages||[]));if(history.length>30)history.shift();future=[];}
function change(fn){checkpoint();fn();dirty();renderEditor();}
const statusHTML=()=>`<span class="local-status ${saveStatus.startsWith('保存失败')?'save-error':''}" role="status">${saveStatus}</span>`;
function sidebar(){return `<aside class="sidebar"><button class="brand" data-action="nav" data-view="home" aria-label="拾页首页"><span class="brand-mark"></span><span class="brand-word">拾页<small>SHIYE</small></span></button><div class="sidebar-tagline">把日子，慢慢收好。</div><nav class="nav" aria-label="主导航">${[['shelf','book','我的书架'],['workshop','spark','贴纸工坊'],['collection','sticker','贴纸收藏']].map(([v,i,t])=>`<button data-action="nav" data-view="${v}" class="${currentView===v||currentView==='editor'&&v==='shelf'?'active':''}">${icon(i)}<span>${t}</span></button>`).join('')}</nav><div class="side-note"><div class="asterisk">✳</div>留住那些<br>舍不得忘记的小事。</div><button class="profile" data-action="about"><span class="avatar">S</span><span class="profile-name">我的私人角落<small>本机访客 · 无需登录</small></span></button></aside>`;}
function topbar(name){return `<header class="topbar"><div class="breadcrumb">我的空间 <span style="margin:0 11px;color:#b6b5a7">/</span> <b>${name}</b></div><div class="top-right">${statusHTML()}<button class="prototype-tag" data-action="about">交互原型</button>${ib('about','info','原型使用说明')}</div></header>`;}
function coverHTML(book){return `<div class="cover ${book.cover}"><div class="cover-inner"><div class="cover-kicker">A PERSONAL COLLECTION</div><h3>${book.cover==='coral'&&book.sample?'Slow<br>days.':esc(book.title)}</h3><div class="cover-sub">${esc(book.subtitle||'MOMENTS TO KEEP')}</div>${book.cover==='olive'||book.cover==='blue'?`<img class="cover-photo" src="assets/${book.cover==='olive'?'lake':'forest'}.jpg" alt="风景封面"/>`:book.cover==='cream'?`<img class="cover-plant" src="${art('flower')}" alt="野花插画"/>`:'<div class="cover-star">✳</div>'}<div class="cover-foot">SHIYE &nbsp; · &nbsp; VOL. ${String(state.books.indexOf(book)+1||1).padStart(2,'0')}</div></div></div>`;}
function footer(){return `<footer class="footer-note"><span>${icon('lock')} 只属于你的记忆，安静地保存在这里。</span><span>MADE OF LITTLE MOMENTS &nbsp; © SHIYE</span></footer>`;}
function shell(content,name){if(name==='贴纸工坊')content=workshopBackHTML()+content;$('#app').innerHTML=`<div class="shell">${sidebar()}${topbar(name)}<main class="content">${content}</main></div>`;}
function render(){window.ShiyeEdge?.beforeRender();stickerDragCleanup?.();resizeObserver?.disconnect();if(currentView==='home')renderHome();else if(currentView==='editor')renderEditor();else if(currentView==='collection')renderCollection();else if(currentView==='workshop')renderWorkshop();else renderShelf();}
function renderShelf(){
 let books=state.books.filter(b=>bookFilter==='all'||!b.sample);books=[...books].sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||(sort==='name'?a.title.localeCompare(b.title,'zh'):b.updated-a.updated));
 shell(`<div class="page-heading"><div><h1>我的书架<span style="color:var(--accent)">.</span></h1><p>日子一页一页，慢慢有了形状。</p></div><button class="button primary" data-action="new-book">${icon('plus')} 新建手帐</button></div><section class="hero"><div class="hero-copy"><div class="eyebrow">A HOME FOR YOUR MEMORIES</div><h2>值得记住的，<br>不必是大事。</h2><p>一杯咖啡，一段旅途，一朵路边的小花。<br>把生活拾起来，收进自己的书里。</p><button class="text-link" data-action="nav" data-view="workshop">拾起今天的小事 ${icon('arrow')}</button></div><div class="hero-art" aria-hidden="true"><div class="hero-star">✳</div><div class="mini-spread"><div><div class="mini-title">Dear little days,</div><img class="spread-photo" src="assets/lake.jpg" alt=""><div class="mini-writing">把脚步放慢，<br>好风景就在身边。</div></div><div><img class="mini-sticker" src="${art('coffee')}" alt=""><img class="mini-flower" src="${art('flower')}" alt=""></div></div><div class="hero-caption handwritten">a little piece of life ↗</div></div></section><div class="section-bar"><div class="tabs"><button class="tab ${bookFilter==='all'?'active':''}" data-action="book-filter" data-filter="all">全部手帐 <span class="count">${state.books.length}</span></button><button class="tab ${bookFilter==='mine'?'active':''}" data-action="book-filter" data-filter="mine">我的创作 <span class="count">${state.books.filter(b=>!b.sample).length}</span></button></div><div class="view-tools"><select class="select-clean" id="book-sort" aria-label="手帐排序"><option value="recent" ${sort==='recent'?'selected':''}>最近编辑优先</option><option value="name" ${sort==='name'?'selected':''}>按书名排列</option></select><div class="view-toggle"><button data-action="book-view" data-value="grid" class="${bookView==='grid'?'active':''}" aria-label="封面视图">${icon('grid')}</button><button data-action="book-view" data-value="list" class="${bookView==='list'?'active':''}" aria-label="列表视图">${icon('list')}</button></div></div></div><div class="books-grid ${bookView==='list'?'list':''}">${books.map(b=>`<article class="book-item"><button class="book-open" data-action="open-book" data-id="${b.id}" aria-label="打开${esc(b.title)}">${coverHTML(b)}</button><div class="book-meta"><div class="book-name"><h3>${b.pinned?'<span class="book-pin-mark" title="已置顶" aria-label="已置顶"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 3 8 0-1 6 3 4v2H6v-2l3-4zM12 15v7"/></svg></span>':''}${esc(b.title)}</h3><p>${b.pages.length} 页 &nbsp;·&nbsp; ${b.sample?'示例作品':'我的创作'} &nbsp;·&nbsp; ${relativeDate(b.updated)}</p></div><button class="icon-button book-more" popovertarget="book-menu-${b.id}" data-book-more="${b.id}" aria-label="${esc(b.title)}的更多操作" aria-expanded="false"><span aria-hidden="true">⋯</span></button><div class="book-popover" id="book-menu-${b.id}" popover="auto" role="group" aria-label="${esc(b.title)}的操作"><button data-action="pin-book" data-id="${b.id}">${icon('up')} ${b.pinned?'取消置顶':'置顶'}</button><button data-action="book-menu" data-id="${b.id}">${icon('pen')} 重命名</button><button class="book-menu-delete" data-action="delete-book-confirm" data-id="${b.id}">${icon('trash')} 删除</button></div></div></article>`).join('')}<article class="book-item new-book"><button class="new-cover" data-action="new-book"><span class="plus">${icon('plus')}</span><span>下一段故事</span><small>从一本空白手帐开始</small></button><div class="book-meta"><div><h3 class="muted">给新的回忆，留个位置</h3></div></div></article></div>${footer()}`,'我的书架');
}
function relativeDate(time){let d=Date.now()-time;return d<86400000?'今天':d<172800000?'昨天':new Date(time).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'});}
function stickerCard(a,mode='library'){const owned=state.assets.some(s=>s.id===a.id);return `<article class="sticker-card"><button class="sticker-display" data-action="${mode==='editor'?'insert-sticker':'sticker-detail'}" data-id="${a.id}" aria-label="${mode==='editor'?'添加':'查看'}${esc(a.name)}"><img src="${assetSource(a)}" alt="${esc(a.name)}" loading="lazy" draggable="false"><span class="add-badge">${icon(mode==='editor'?'plus':owned?'check':'plus')}</span></button><div class="sticker-label"><span>${esc(a.name)}</span><small>${esc(a.category)}</small></div>${mode==='library'&&owned?`<button class="sticker-use" data-action="use-collected" data-id="${a.id}">用于创作 ${icon('arrow')}</button>`:''}</article>`;}
function filteredAssets(){return (collectionTab==='mine'?state.assets:builtin).filter(a=>(filter==='全部'||a.category===filter)&&(a.name.includes(search)||a.category.includes(search)));}
function renderCollection(){shell(`<div class="page-heading"><div><h1>贴纸收藏<span style="color:var(--accent)">.</span></h1><p>生活里的小碎片，可以被一次次喜欢。</p></div><button class="button primary" data-action="nav" data-view="workshop">${icon('plus')} 制作贴纸</button></div><div class="collection-banner">${icon('sticker')}<p>把照片里的喜欢，变成自己的贴纸。<br>收入收藏后，可以放进任何一本手帐。</p><button class="button outline small" data-action="enter-creation">进入创作 ${icon('arrow')}</button></div><div class="collection-header"><div class="tabs"><button class="tab ${collectionTab==='mine'?'active':''}" data-action="collection-tab" data-value="mine">我的收藏 <span class="count">${state.assets.length}</span></button><button class="tab ${collectionTab==='builtin'?'active':''}" data-action="collection-tab" data-value="builtin">拾页素材 <span class="count">${builtin.length}</span></button></div><label class="searchbox">${icon('search')}<input id="sticker-search" aria-label="搜索贴纸" placeholder="找一枚贴纸…" value="${esc(search)}"></label></div><div class="chips">${['全部','植物','物品','旅行','装饰','照片'].map(c=>`<button class="chip ${filter===c?'active':''}" data-action="filter" data-value="${c}">${c}</button>`).join('')}</div><div id="collection-results">${collectionResults()}</div>${footer()}`,'贴纸收藏');}
function collectionResults(){let a=filteredAssets();return a.length?`<div class="sticker-grid">${a.map(s=>stickerCard(s)).join('')}</div>`:`<div class="empty">${icon('sticker')}<h2>${search?'还没找到这枚贴纸':'这里等着你的第一枚收藏'}</h2><p>从拾页素材中收藏，或把自己的照片变成贴纸。</p><button class="button outline" data-action="nav" data-view="workshop">去制作贴纸 ${icon('arrow')}</button></div>`;}
function workshopBackHTML(){
 const destination=segmentedWorkshop?.active?'返回上一制作步骤':workshop.step===2?'返回选区修正':workshop.step===1?'返回选择照片':'返回进入工坊前的页面';
 return `<button class="text-link workshop-back" data-action="workshop-back" title="${destination}" ${savingStickers||segmentedWorkshop?.busy?'disabled':''}>${icon('left')} 返回上一步</button>`;
}
async function goBackWorkshop(){
 if(savingStickers)return;
 if(segmentedWorkshop?.active){segmentedWorkshop.back();window.scrollTo(0,0);return;}
 photoTaskVersion++;window.ShiyeEdge?.cancel();
 if(workshop.step===2){workshop.step=1;renderWorkshop();window.scrollTo(0,0);return;}
 if(workshop.step===1){workshop.resumeStep=1;workshop.step=0;renderWorkshop();window.scrollTo(0,0);return;}
 const destination=workshopReturn||{view:'home'};
 if(destination.view==='editor'){
  const book=state.books.find(b=>b.id===destination.bookId),page=book?.pages.findIndex(p=>p.id===destination.pageId);
  if(book&&page>=0){navigationVersion++;book.page=page;activeBookId=book.id;editing=destination.editing;selectedId=destination.selectedId;drawer=destination.drawer;currentView='editor';render();window.scrollTo(0,0);return;}
 }
 await navigate(['home','shelf','collection'].includes(destination.view)?destination.view:'shelf');
}
function renderWorkshop(){window.ShiyeEdge?.beforeRender();if(segmentedWorkshop?.active){segmentedWorkshop.render();return;}let w=workshop;let main='',aside='';
 if(!w.demo&&w.step===1&&window.ShiyeEdge?.isManual(w)){
  w.cropMode=w.scissorPoints?.length||!w.crops.length?'outline':'edit';
  if(w.crops.length&&!w.crops[w.activeCrop])w.activeCrop=w.crops.length-1;
 }
 if(w.step===0){main=`<div class="upload-zone" id="upload-zone"><div class="upload-symbol">${icon('image')}</div><h2>今天，想留住什么？</h2><p>放进一张照片，把喜欢的部分留下来。<br>支持 JPG、PNG、WebP，最大 10 MB。</p><button class="button dark" data-action="upload">${icon('upload')} 选择一张照片</button>${w.resumeStep?'<button class="sample-link" data-action="workshop-resume">继续上次制作</button>':''}<button class="sample-link" data-action="seg-open">进入自动抠图工坊</button></div>`;aside=`<div class="eyebrow">FROM PHOTO TO STICKER</div><h3 style="margin-top:13px">从照片里，<br>拾出一点喜欢。</h3><p>选出主体，调一圈白边，<br>就有了独一无二的收藏。</p><div class="note-rule"></div><button class="text-link" data-action="crop-example">用山湖照片试试圈选 ${icon('arrow')}</button>`;}
 if(w.step===1){main=w.demo?`<div class="sample-scene">${[{id:'coffee',left:9,top:16,width:40,height:53,r:-10},{id:'flower',left:50,top:4,width:37,height:66,r:18},{id:'camera',left:37,top:48,width:43,height:47,r:9}].map((a,i)=>`<button class="scene-subject ${w.selected.includes(a.id)?'chosen':''}" style="left:${a.left}%;top:${a.top}%;width:${a.width}%;height:${a.height}%;transform:rotate(${a.r}deg)" data-action="subject" data-id="${a.id}" aria-label="选择${builtin.find(b=>b.id===a.id).name}" aria-pressed="${w.selected.includes(a.id)}"><img src="${art(a.id)}" alt="${builtin.find(b=>b.id===a.id).name}">${w.selected.includes(a.id)?`<span class="check">${w.selected.indexOf(a.id)+1}</span>`:''}</button>`).join('')}</div>`:`<div class="crop-stage ${w.cropMode==='outline'?'scissors-mode':''}" id="crop-stage"><img id="crop-source" src="${w.source}" alt="待裁切的照片">${w.crops.map((r,i)=>r.points?`<svg class="crop-outline" viewBox="0 0 1 1" preserveAspectRatio="none"><polygon points="${r.points.map(p=>p.x+','+p.y).join(' ')}"/></svg>`:`<div class="crop-box" style="left:${r.x*100}%;top:${r.y*100}%;width:${r.w*100}%;height:${r.h*100}%"><span>${i+1}</span></div>`).join('')}</div>`;
 aside=`<div class="eyebrow">01 — PICK YOUR MOMENTS</div><h3 style="margin-top:15px">${w.demo?'哪些想带走？':'先圈好，再慢慢调整。'}</h3><p>${w.demo?'点击画面中的咖啡、野花或相机。每个选中的主体都会变成独立贴纸。':'沿物体周围点几下，再点“完成圈选”；也可以按住画一圈。画完留在原图，点“调整边界”可拖动圆点。满意后再确认预览。'}</p>${w.demo?'<div class="demo-label">演示素材 · 使用预制透明主体，展示多选操作。</div>':''}<div class="subject-buttons">${w.demo?['coffee','flower','camera'].map(id=>`<button class="chip ${w.selected.includes(id)?'active':''}" data-action="subject" data-id="${id}">${esc(builtin.find(b=>b.id===id).name)}</button>`).join(''):`<button class="chip ${w.cropMode==='edit'?'active':''}" data-action="crop-mode" data-value="edit" ${!w.crops.length?'disabled':''}>调整边界</button><button class="chip" data-action="redo-crop" ${!w.cropFuture?.length?'disabled':''}>恢复撤销</button><button class="chip" data-action="undo-crop" ${!w.cropHistory?.length?'disabled':''}>撤销</button><button class="chip" data-action="clear-crops" ${!w.crops.length&&!w.scissorPoints?.length?'disabled':''}>清除选区</button><button class="chip" data-action="finish-scissors" ${(w.scissorPoints?.length||0)<3?'disabled':''}>完成圈选</button>`}</div>${!w.demo?`<div class="crop-selection-list">${w.crops.map((r,i)=>`<button class="chip ${w.activeCrop===i?'active':''}" data-action="select-crop" data-value="${i}">选区 ${i+1}</button>`).join('')}${w.crops.length?'<button class="text-link" data-action="delete-crop">移除当前选区</button>':''}</div>`:''}<p id="selected-count">${w.demo?`已选择 ${w.selected.length} 个主体`:`已圈好 ${w.crops.length} 个区域${w.scissorPoints?.length?` · ${w.scissorPoints.length} 个待完成点`:w.cropMode==='edit'?' · 拖动圆点调整':''}`}</p><button class="button primary" id="generate-button" data-action="generate" ${!(w.demo?w.selected.length:w.crops.length||(w.scissorPoints?.length>=3))?'disabled':''}>${w.demo?'生成贴纸':'确认选区，预览贴纸'} ${icon('arrow')}</button><div style="margin-top:18px"><button class="text-link muted" data-action="workshop-reset">换一张照片</button></div>`;}
 if(w.step===2){const a=w.results[w.preview];main=`<div class="preview-stage"><img src="${a.src}" id="sticker-preview" alt="${esc(a.name)}" style="${borderStyle(w.border)}"></div><div class="preview-switch">${w.results.map((s,i)=>`<button data-action="preview-sticker" data-value="${i}" class="${i===w.preview?'active':''}" aria-label="预览第${i+1}枚贴纸"><img src="${s.src}" alt="${esc(s.name)}"></button>`).join('')}</div>`;aside=`<div class="eyebrow">02 — MAKE IT YOURS</div><h3 style="margin-top:15px">添一圈白边，<br>就很有贴纸的样子。</h3><label class="field"><span>贴纸名称</span><input id="preview-name" value="${esc(a.name)}" maxlength="30"></label><div class="range-label"><span>白边厚度</span><span id="border-value">${w.border}px</span></div><input id="border-range" type="range" min="0" max="10" value="${w.border}" aria-label="白边厚度"><p style="font-size:10px">白边设置应用到本次所有贴纸。</p><div class="note-rule"></div><button class="button primary" data-action="save-stickers">${icon('sticker')} 收藏 ${w.results.length} 枚贴纸</button><button class="button outline save-use" data-action="save-and-use">收藏并用于创作 ${icon('arrow')}</button><div style="margin-top:18px"><button class="text-link muted" data-action="back-subjects">返回选择主体</button></div>`;}
 shell(`<div class="page-heading"><div><h1>贴纸工坊<span style="color:var(--accent)">.</span></h1><p>从一张照片，到一枚舍不得丢的小收藏。</p></div></div><div class="steps">${['放进照片','选择主体','收好贴纸'].map((s,i)=>`${i?'<span class="step-line"></span>':''}<span class="step ${w.step===i?'active':''}"><b>${i+1}</b>${s}</span>`).join('')}</div><div class="workshop-layout"><div>${main}</div><aside class="workshop-aside">${aside}</aside></div><input type="file" accept="image/jpeg,image/png,image/webp" id="photo-input" hidden>${footer()}`,'贴纸工坊');
 if(!w.demo&&w.step===1){bindCrop();window.ShiyeEdge?.mount(w);}
 if(!w.demo&&w.step===2)window.ShiyeEdge?.mountPreview(w);
 const zone=$('#upload-zone');if(zone){zone.ondragover=e=>{e.preventDefault();zone.style.borderColor='var(--accent)';};zone.ondragleave=()=>zone.style.borderColor='';zone.ondrop=e=>{e.preventDefault();zone.style.borderColor='';if(e.dataTransfer.files[0])loadPhoto(e.dataTransfer.files[0]);};}
}
function borderStyle(n){return `filter:drop-shadow(${n/2}px 0 0 #fffdf6) drop-shadow(-${n/2}px 0 0 #fffdf6) drop-shadow(0 ${n/2}px 0 #fffdf6) drop-shadow(0 -${n/2}px 0 #fffdf6) drop-shadow(2px 5px 3px #0002)`;}
function transformHandles(){return `<span class="selection-handles" aria-hidden="true">${['nw','ne','sw','se'].map(c=>`<span class="transform-handle handle-${c}" data-transform="resize" data-corner="${c}"></span>`).join('')}<span class="rotation-stem"></span><span class="transform-handle handle-rotate" data-transform="rotate">${icon('rotate')}</span></span>`;}
function elementsHTML(page,read=false,mini=false){return paperLayer(page)+pageElements(page).map(e=>`<div class="element ${e.type==='text'?'text':''} ${selectedId===e.id&&!read?'selected':''} ${read?'readonly':''} ${e.direction==='vertical'?'vertical-text':''}" data-element="${e.id}" ${!read?`tabindex="0" role="button" aria-label="${esc(e.type==='text'?e.text:'页面贴纸')}"`:''} style="left:${e.x}%;top:${e.y}%;width:${e.w}%;transform:rotate(${e.rotation||0}deg);${e.type==='text'?`font-size:calc(${e.size||18}px * var(--scale,1));color:${e.color||'#4c5341'};font-family:${textFont(e.font).family};font-style:${e.italic?'italic':'normal'};${e.direction==='vertical'?`height:${e.h||60}%;writing-mode:vertical-rl;text-orientation:mixed;`:''}`:''}">${e.type==='text'?`<span class="text-content">${esc(e.text)}</span>`:`<img src="${e.type==='sticker'?asset(e.assetId)?.src||'':e.src}" alt="${esc(e.type==='sticker'?asset(e.assetId)?.name:'相片')}" draggable="false" style="${e.frame?'border:calc(7px * var(--scale,1)) solid #fffdf8;box-shadow:0 2px 5px #0002;':''}${e.flip?'transform:scaleX(-1);':''}${e.type==='sticker'?borderStyle(asset(e.assetId)?.borderBaked?0:asset(e.assetId)?.border||0):''}">`}${!read&&e.id===selectedId?transformHandles():''}</div>`).join('')+(mini?'':`<div class="page-number">${String(Math.max(0,currentBook()?.pages.findIndex(p=>p.id===page.id)??0)+1).padStart(2,'0')} &nbsp; / &nbsp; SHIYE</div>`);}

function renderEditor(){
 finishInlineText();
 stickerDragCleanup?.();cancelEditingTurn();cancelReaderTurn();
 if(!editing&&currentBook()){renderReading();return;}
 const b=currentBook();if(!b){currentView='shelf';render();return;}b.page=Math.max(0,Math.min(b.page||0,b.pages.length-1));const p=currentPage();
 $('#app').innerHTML=`<div class="shell editor-mode">${sidebar()}<header class="editor-top"><div class="editor-title">${ib('shelve','left','放回书架')}<input id="book-title" aria-label="手帐名称" maxlength="40" value="${esc(b.title)}"></div><div class="editor-top-actions">${statusHTML()}<div class="mode-switch"><button data-action="mode" data-value="read" class="${!editing?'active':''}">翻阅</button><button data-action="mode" data-value="edit" class="${editing?'active':''}">编辑</button></div><button class="button dark small" data-action="shelve">${icon('book')} 放回书架</button></div></header><main class="editor-workspace ${!editing?'read-mode':''}"><div class="workspace-meta"><span>${b.sample?'示例手帐 · 可自由编辑':'我的手帐'} &nbsp; / &nbsp; ${String(b.page+1).padStart(2,'0')} — ${String(b.pages.length).padStart(2,'0')}</span>${editing?`<div class="undo-bar">${ib('undo','undo','撤销',history.length?'':'disabled')}${ib('redo','redo','重做',future.length?'':'disabled')}<span class="no-selection">${selectedId?'正在编辑选中元素':'点击空白处写字 · 双击文字修改'}</span></div>`:'<span>给回忆，一点慢慢翻阅的时间。</span>'}</div>${layoutControlsHTML()}${spreadEditing()?spreadStageHTML():`<div class="stage-wrap"> <button class="page-arrow prev" data-action="page-prev" aria-label="上一页" ${b.page===0?'disabled':''}>${icon('left')}</button><div class="page-frame"><div id="canvas-page" class="canvas-page ${p.paper}">${elementsHTML(p,!editing)}</div></div><button class="page-arrow next" data-action="page-next" aria-label="下一页" ${b.page===b.pages.length-1?'disabled':''}>${icon('right')}</button></div>`}${editing?`<div class="editor-dock" role="toolbar" aria-label="页面工具">${[['sticker','sticker','贴纸'],['text','text','文字'],['paper','paper','纸张'],['pages','book','页面']].map(([a,i,t])=>`<button class="tool ${drawer===a?'active':''}" data-action="drawer" data-value="${a}">${icon(i)}<span>${t}</span></button>`).join('')}<div class="dock-divider"></div><button class="tool" data-action="workshop-from-editor">${icon('spark')}<span>制贴纸</span></button></div>`:'<div class="read-caption">日子被认真收藏，就有了不一样的分量。</div>'}<div class="page-strip" aria-label="页面缩略图">${b.pages.map((pg,i)=>`<button class="page-thumb ${i===b.page?'active':''}" data-action="page-goto" data-value="${i}" draggable="${editing}" data-page-id="${pg.id}" aria-label="第${i+1}页"><div class="thumb-content canvas-page ${pg.paper}" style="--scale:1">${elementsHTML(pg,true,true)}</div><small>${i+1}</small></button>`).join('')}${editing?`<button class="page-add" data-action="page-add" aria-label="新增一页">${icon('plus')}</button>`:''}</div>${editing&&drawer?drawerHTML():''}${editing&&selectedId?contextHTML():''}</main></div>`;
 fitPage();resizeObserver?.disconnect();resizeObserver=new ResizeObserver(fitPage);resizeObserver.observe($('.stage-wrap'));if(editing){if(spreadEditing())$$('.edit-leaf').forEach(bindDrag);else bindDrag();bindPageSort();bindStickerDrag();}
}
function fitPage(){const wrap=$('.stage-wrap'),frame=$('.page-frame');if(!wrap||!frame)return;if(spreadEditing()){const w=Math.max(100,Math.min(420,(wrap.clientWidth-(innerWidth<560?54:120))/2,(wrap.clientHeight-55)*420/540));frame.style.width=w*2+'px';frame.style.height=w*540/420+'px';frame.style.setProperty('--scale',w/420);return;}const mobile=window.innerWidth<560;let availableWidth=wrap.clientWidth-(mobile?38:window.innerWidth<800?100:window.innerWidth<1150&&editing?260:145);const availableHeight=wrap.clientHeight-(editing?52:36);let width=Math.max(170,Math.min(440,availableWidth,availableHeight*420/540));frame.style.width=width+'px';frame.style.height=(width*540/420)+'px';frame.style.setProperty('--scale',width/420);}
function contextHTML(){let e=currentElement();if(!e)return '';return `<div class="context-toolbar" role="toolbar" aria-label="选中元素操作"><span class="label">${e.type==='text'?'文字设置':'贴纸设置'}</span><div class="context-row">${ib('smaller','minus','缩小')}<span>${Math.round(e.w)}%</span>${ib('larger','plus','放大')}</div><div class="context-row">${ib('rotate-left','rotate','向左旋转')}<span>${Math.round(e.rotation||0)}°</span>${ib('rotate-right','redo','向右旋转')}</div><div class="separator"></div>${e.type==='text'?`${textFontSelect('selected-text-font',e.font,'字体')}<button class="small-action" data-action="edit-text">${icon('pen')} 编辑文字</button>`:` ${e.type==='sticker'?stickerScopeHTML(e):''}<button class="small-action" data-action="flip">${icon('flip')} 水平翻转</button>`}<button class="small-action" data-action="duplicate">${icon('copy')} 复制</button><button class="small-action" data-action="layer-up">${icon('layers')} 上移一层</button><button class="small-action" data-action="layer-down">${icon('down')} 下移一层</button><button class="small-action" data-action="delete-element" style="color:var(--accent)">${icon('trash')} 删除</button></div>`;}
function drawerHTML(){let inner='';if(drawer==='sticker')inner=`${stickerScopeHTML()}<p class="muted" style="font-size:10px;line-height:1.7">拖到纸页放置，或点击添加。手机可长按拖入；拾页素材同时收入收藏。</p><div class="sticker-grid">${[...state.assets,...builtin.filter(b=>!state.assets.some(a=>a.id===b.id))].map(a=>stickerCard(a,'editor')).join('')}</div>`;
 if(drawer==='text')inner=`<p class="muted" style="font-size:11px">点击纸面任意空白处，直接输入文字。</p>${textFontSelect('new-text-font',newTextFont,'新文字字体')}<div class="text-font-preview" aria-hidden="true" style="font-family:${textFont(newTextFont).family}">把日子，慢慢收好。</div><button class="button outline" data-action="add-text" style="width:100%">${icon('plus')} 添加文字</button><p class="muted" style="font-size:10px">双击文字可原位输入；选中后可拖动或调整样式。</p>`;
 if(drawer==='paper')return paperDrawerHTML();
 if(drawer==='pages')inner=`<p class="muted" style="font-size:11px">左右页固定配对，调整顺序时整组移动。</p><button class="button outline small" data-action="add-spread">${icon('plus')} 新增双页</button><div>${currentBook().pages.map((p,i)=>`<div class="page-list"><button data-action="page-goto" data-value="${i}">第 ${i+1} 页 ${i===currentBook().page?'· 当前':''}</button><div>${ib('move-page-up','up','页面前移',`data-value="${i}" ${i===0?'disabled':''}`)}${ib('move-page-down','down','页面后移',`data-value="${i}" ${i===currentBook().pages.length-1?'disabled':''}`)}</div></div>`).join('')}</div><div style="display:flex;gap:6px;margin-top:13px"><button class="button soft small" data-action="page-add">${icon('plus')} 新增</button><button class="button soft small" data-action="duplicate-page">${icon('copy')} ${spreadPages(pageSpread()).length>1?'复制双页':'复制页'}</button>${ib('delete-page','trash','删除当前页',pagesToDelete().length>=currentBook().pages.length?'disabled':'')}</div>`;
 return `<section class="drawer ${drawer==='paper'?'paper-drawer':''}"><div class="drawer-head"><h3>${{sticker:'我的贴纸匣',text:'写下这一刻',paper:'挑一张纸',pages:'整理页面'}[drawer]}</h3>${ib('close-drawer','close','关闭工具面板')}</div>${inner}</section>`;
}
function refreshSelection(){
 const undo=$('[data-action="undo"]'),redo=$('[data-action="redo"]');if(undo)undo.disabled=!history.length;if(redo)redo.disabled=!future.length;
 const canvas=spreadEditing()?$('.edit-spread'):$('#canvas-page');if(!canvas)return;
 $$('.element',canvas).forEach(el=>{const selected=el.dataset.element===selectedId;el.classList.toggle('selected',selected);if(!selected)el.querySelector('.selection-handles')?.remove();else if(!el.querySelector('.selection-handles'))el.insertAdjacentHTML('beforeend',transformHandles());});
 $('.context-toolbar')?.remove();
 if(selectedId&&currentElement())$('.editor-workspace').insertAdjacentHTML('beforeend',contextHTML());
 if($('.no-selection'))$('.no-selection').textContent=selectedId?'拖动角点缩放 · 上方圆柄旋转':'点击空白处写字 · 双击文字修改';
}
// Inline text stays a normal structured page element; the input is only its editor.
let inlineText=null;
function syncInlineText(){
 const s=inlineText;if(!s)return;
 const book=state.books.find(b=>b.id===s.bookId),page=book?.pages.find(p=>p.id===s.pageId);if(!page)return;
 const text=s.input.value.slice(0,800),existing=page.elements.find(e=>e.id===s.item.id);
 if((existing?.text||'')===text)return;
 if(!s.checkpointed){checkpoint();s.checkpointed=true;}
 if(existing)existing.text=text;else if(text){page.elements.push({...s.item,text});}
 dirty();
}
function finishInlineText(){
 const s=inlineText;if(!s)return;syncInlineText();inlineText=null;
 const page=state.books.find(b=>b.id===s.bookId)?.pages.find(p=>p.id===s.pageId),item=page?.elements.find(e=>e.id===s.item.id);
 if(item&&!item.text.trim()){
  if(!s.checkpointed)checkpoint();page.elements=page.elements.filter(e=>e.id!==item.id);dirty();
 }
 const kept=page?.elements.find(e=>e.id===s.item.id);
 s.input.remove();s.host.classList.remove('inline-text-editing');
 if(kept){const text=s.host.querySelector('.text-content');if(text)text.textContent=kept.text;s.host.setAttribute('aria-label',kept.text);}
 else{s.host.remove();if(selectedId===s.item.id)selectedId=null;}
 if(currentView==='editor'&&editing){refreshSelection();const thumb=$(`[data-page-id="${s.pageId}"] .thumb-content`);if(thumb&&page)thumb.innerHTML=elementsHTML(page,true,true);}
}
function startInlineText(existing=null,x=15,y=20){
 if(currentView!=='editor'||!editing||editingPageTurn||!currentPage())return;
 finishInlineText();
 const item=existing?currentPage().elements.find(e=>e.id===existing.id):node('text',{text:'',font:newTextFont,direction:'horizontal',x:Math.max(0,Math.min(95,x)),y:Math.max(0,Math.min(95,y)),w:Math.max(5,Math.min(70,100-x)),size:23,color:'#505b46'});
 if(!item||item.type!=='text')return;
 selectedId=item.id;drawer=null;$('.drawer')?.remove();refreshSelection();
 let host=$(`[data-element="${item.id}"]`,$('#canvas-page'));
 if(!host){const temp=document.createElement('div');temp.innerHTML=elementsHTML({elements:[item]},false,true);host=temp.firstElementChild;$('#canvas-page').appendChild(host);}
 host.classList.add('inline-text-editing');host.querySelector('.selection-handles')?.remove();
 const input=document.createElement('textarea');input.className='inline-text-input';input.setAttribute('aria-label','在纸面输入文字');input.maxLength=800;input.value=item.text;input.spellcheck=false;input.rows=1;host.appendChild(input);
 inlineText={bookId:activeBookId,pageId:currentPage().id,item:clone(item),host,input,checkpointed:false,composing:false};
 const size=()=>{if(item.direction==='vertical'){input.style.height='100%';return;}input.style.height='0px';input.style.height=Math.max(input.scrollHeight,parseFloat(getComputedStyle(input).lineHeight)||24)+'px';};
 input.addEventListener('compositionstart',()=>{if(inlineText?.input===input)inlineText.composing=true;});
 input.addEventListener('compositionend',()=>{if(inlineText?.input===input){inlineText.composing=false;syncInlineText();size();}});
 input.addEventListener('input',()=>{if(inlineText?.input!==input)return;if(!inlineText.composing)syncInlineText();size();});
 input.addEventListener('keydown',e=>{e.stopPropagation();if(e.isComposing||inlineText?.composing)return;if(e.key==='Escape'||((e.ctrlKey||e.metaKey)&&e.key==='Enter')){e.preventDefault();finishInlineText();$('#canvas-page')?.focus({preventScroll:true});}});
 input.addEventListener('blur',()=>{if(inlineText?.input===input)finishInlineText();});
 size();input.focus({preventScroll:true});input.setSelectionRange(input.value.length,input.value.length);
 if($('.no-selection'))$('.no-selection').textContent='直接输入 · 点击别处结束';
}
document.addEventListener('pointerdown',e=>{if(inlineText&&!inlineText.host.contains(e.target))finishInlineText();},true);

function bindDrag(target=null){
 const canvas=target||$('#canvas-page'),points=new Map();let gesture=null,changed=false,started=false,blankTap=null;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const paint=()=>{const item=currentElement(),el=canvas.querySelector(`[data-element="${selectedId}"]`);if(!item||!el)return;el.style.left=projectedX(item,currentBook().pages.find(p=>p.id===canvas.dataset.editPage)||currentPage())+'%';el.style.top=item.y+'%';el.style.width=item.w+'%';el.style.transform=`rotate(${item.rotation||0}deg)`;if(item.type==='text'){el.style.fontSize=`calc(${item.size||18}px * var(--scale,1))`;if(item.direction==='vertical')el.style.height=(item.h||60)+'%';}if(item.type==='sticker')$$('.edit-leaf').forEach(leaf=>{const other=leaf.querySelector(`[data-element="${item.id}"]`);if(other&&other!==el){other.style.cssText=el.style.cssText;other.style.left=projectedX(item,currentBook().pages.find(p=>p.id===leaf.dataset.editPage))+'%';}});};
 const begin=(mode,event)=>{
  const item=currentElement(),el=canvas.querySelector(`[data-element="${selectedId}"]`),r=canvas.getBoundingClientRect(),b=el.getBoundingClientRect(),p=[...points.values()];
  gesture={mode,base:clone(item),rect:r,point:p[0],center:{x:b.x+b.width/2,y:b.y+b.height/2},radius:Math.hypot(event.clientX-b.x-b.width/2,event.clientY-b.y-b.height/2)};
  if(mode==='pinch'){gesture.distance=Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y);gesture.angle=Math.atan2(p[1].y-p[0].y,p[1].x-p[0].x);gesture.mid={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};}
  else gesture.angle=Math.atan2(event.clientY-gesture.center.y,event.clientX-gesture.center.x);
 };
 canvas.onpointerdown=e=>{
  if(e.target.closest('.inline-text-input'))return;
  if(canvas.dataset.editPage)chooseEditorPage(currentBook().pages.find(p=>p.id===canvas.dataset.editPage));
  if(e.isPrimary===false&&blankTap){blankTap=null;return;}
  if(e.button!==0||points.size>=2)return;
  const el=e.target.closest('[data-element]');
  if(points.size){points.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);begin('pinch',e);e.preventDefault();return;}
  if(!el){selectedId=null;refreshSelection();blankTap={id:e.pointerId,x:e.clientX,y:e.clientY};return;}
  selectedId=el.dataset.element;refreshSelection();changed=false;started=false;
  points.set(e.pointerId,{x:e.clientX,y:e.clientY});el.setPointerCapture(e.pointerId);begin(e.target.closest('[data-transform]')?.dataset.transform||'drag',e);e.preventDefault();
 };
 canvas.onpointermove=e=>{
  if(blankTap&&Math.hypot(e.clientX-blankTap.x,e.clientY-blankTap.y)>6)blankTap=null;
  if(!points.has(e.pointerId)||!gesture)return;
  points.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const g=gesture,b=g.base,item=currentElement(),p=[...points.values()],r=g.rect;if(!item)return;
  let factor=1,angle=b.rotation||0,dx=0,dy=0;
  if(g.mode==='drag'){dx=p[0].x-g.point.x;dy=p[0].y-g.point.y;if(!started&&Math.hypot(dx,dy)<3)return;}
  else if(g.mode==='rotate'){angle+= (Math.atan2(e.clientY-g.center.y,e.clientX-g.center.x)-g.angle)*180/Math.PI;}
  else if(g.mode==='resize')factor=Math.hypot(e.clientX-g.center.x,e.clientY-g.center.y)/Math.max(8,g.radius);
  else if(p.length===2){factor=Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y)/Math.max(8,g.distance);angle+=(Math.atan2(p[1].y-p[0].y,p[1].x-p[0].x)-g.angle)*180/Math.PI;dx=(p[0].x+p[1].x)/2-g.mid.x;dy=(p[0].y+p[1].y)/2-g.mid.y;}
  if(!started){checkpoint();started=true;}changed=true;
  factor=clamp(b.w*factor,8,110)/b.w;item.w=b.w*factor;item.rotation=Math.round(((angle+540)%360)-180);
  // Scale about the element centre, keeping aspect ratio and the pinch midpoint stable.
  const el=canvas.querySelector(`[data-element="${selectedId}"]`),baseHeight=el.offsetHeight/(item.type==='text'?Math.max(.01,(item.size||18)/(b.size||18)):Math.max(.01,parseFloat(el.style.width)/b.w));
  item.x=clamp(b.x+dx/r.width*100-(item.w-b.w)/2,item.spreadWith?-100:-item.w*.65,item.spreadWith?195:95);
  item.y=clamp(b.y+dy/r.height*100-baseHeight*(factor-1)/r.height*50,-8,92);
  if(item.type==='text'){item.size=(b.size||18)*factor;if(b.direction==='vertical')item.h=(b.h||60)*factor;}
  constrainSticker(item);paint();e.preventDefault();
 };
 const end=e=>{
  if(blankTap?.id===e.pointerId){const tap=blankTap;blankTap=null;if(e.type==='pointerup'){const r=canvas.getBoundingClientRect();startInlineText(null,(tap.x-r.left)/r.width*100,(tap.y-r.top)/r.height*100);}return;}
  if(!points.has(e.pointerId))return;points.delete(e.pointerId);
  if(points.size){const p=[...points.values()][0];begin('drag',{clientX:p.x,clientY:p.y});return;}
  gesture=null;if(changed){dirty();renderEditor();}else refreshSelection();
 };
 canvas.onpointerup=end;canvas.onpointercancel=end;canvas.onlostpointercapture=end;
 canvas.ondblclick=e=>{const el=e.target.closest('[data-element]');if(el&&!e.target.closest('[data-transform]')){selectedId=el.dataset.element;if(currentElement()?.type==='text')startInlineText(currentElement());}};
}
let stickerDragCleanup=null,suppressStickerClickUntil=0;
function bindStickerDrag(){
 stickerDragCleanup?.();const buttons=$$('.drawer [data-action="insert-sticker"]');let drag=null,timer;
 const clear=()=>{clearTimeout(timer);drag?.ghost?.remove();document.body.classList.remove('sticker-dragging');drag=null;};
 const activate=()=>{if(!drag)return;drag.active=true;const ghost=document.createElement('img');ghost.src=asset(drag.id).src;ghost.className='sticker-drag-ghost';ghost.alt='';document.body.classList.add('sticker-dragging');document.body.appendChild(ghost);drag.ghost=ghost;position();};
 const position=()=>{if(drag?.ghost){drag.ghost.style.left=drag.x+'px';drag.ghost.style.top=drag.y+'px';}};
 const move=e=>{if(!drag||drag.pointer!==e.pointerId)return;drag.x=e.clientX;drag.y=e.clientY;const distance=Math.hypot(drag.x-drag.sx,drag.y-drag.sy);if(!drag.active&&distance>7){if(drag.touch){clearTimeout(timer);drag.scrolling=true;suppressStickerClickUntil=Date.now()+500;$('.drawer').scrollTop=drag.scrollTop+drag.sy-drag.y;e.preventDefault();return;}activate();}if(drag.active){position();e.preventDefault();}};
 const up=e=>{if(!drag||drag.pointer!==e.pointerId)return;const d=drag;clear();if(!d.active)return;suppressStickerClickUntil=Date.now()+500;const leaf=(spreadEditing()?$$('.edit-leaf'):[$('#canvas-page')]).find(el=>{const r=el?.getBoundingClientRect();return r&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;});if(leaf?.dataset.editPage)chooseEditorPage(currentBook().pages.find(p=>p.id===leaf.dataset.editPage));const r=leaf?.getBoundingClientRect();if(r&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom)insertStickers([d.id],{x:Math.max(currentBook().stickerPlacement==='spread'&&matePage(currentPage())?-16:0,Math.min(currentBook().stickerPlacement==='spread'&&matePage(currentPage())?84:68,(e.clientX-r.left)/r.width*100-16)),y:Math.max(0,Math.min(75,(e.clientY-r.top)/r.height*100-12))});else toast('未放入纸页，贴纸仍在收藏中');};
 buttons.forEach(button=>{button.ondragstart=e=>e.preventDefault();button.onpointerdown=e=>{if(e.button!==0)return;drag={id:button.dataset.id,pointer:e.pointerId,x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,scrollTop:$('.drawer').scrollTop,touch:e.pointerType==='touch',active:false};if(drag.touch)timer=setTimeout(activate,300);};});
 document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',up);document.addEventListener('pointercancel',clear);
 stickerDragCleanup=()=>{clear();document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',clear);stickerDragCleanup=null;};
}

function bindPageSort(){$$('.page-thumb').forEach(t=>{t.ondragstart=e=>e.dataTransfer.setData('text/plain',t.dataset.pageId);t.ondragover=e=>e.preventDefault();t.ondrop=e=>{e.preventDefault();const id=e.dataTransfer.getData('text/plain'),from=currentBook().pages.findIndex(p=>p.id===id),to=Number(t.dataset.value);if(from<0||from===to)return;change(()=>moveSpread(from,to));};});}
function showDialog(title,html,actions=''){const d=$('#dialog');d.innerHTML=`<div class="dialog-heading"><h2>${title}</h2>${ib('close-dialog','close','关闭对话框')}</div>${html}${actions?`<div class="dialog-actions">${actions}</div>`:''}`;if(!d.open)d.showModal();}
function closeDialog(){$('#dialog').close();}
function newBookDialog(){showDialog('给回忆，取个名字',`<p class="dialog-description">挑一张封面。从这里，开始下一段故事。</p><label class="field"><span>手帐名称</span><input id="new-title" placeholder="例如：山风与周末" maxlength="40" value=""></label><div class="cover-options">${['olive','cream','coral','blue'].map((c,i)=>`<button class="cover-choice ${c} ${i===0?'active':''}" data-action="choose-cover" data-value="${c}" aria-label="${['苔绿','奶油','陶红','雾蓝'][i]}封面" aria-pressed="${i===0}">拾页</button>`).join('')}</div><p class="muted" style="font-size:10px">从一页空白开始，随时都可以续写。</p>`,`<button class="button outline" data-action="close-dialog">再想想</button><button class="button primary" data-action="create-book">打开这本书 ${icon('arrow')}</button>`);setTimeout(()=>$('#new-title')?.focus(),50);}
function bookMenu(id){const b=state.books.find(a=>a.id===id);if(!b)return;showDialog('修改手帐名称',`<label class="field"><span>手帐名称</span><input id="rename-title" value="${esc(b.title)}" maxlength="40"></label>`,`<button class="button outline" data-action="close-dialog">取消</button><button class="button primary" data-action="rename-book" data-id="${id}">保存名称</button>`);}
function textDialog(existing=false){const e=existing?currentElement():null;showDialog(existing?'再写一点':'写下这一刻',`<label class="field"><span>文字内容</span><textarea id="text-content" maxlength="800" placeholder="有些小事，值得被记下来。">${esc(e?.text||'')}</textarea></label><label class="field"><span>排列方向</span><select id="text-direction"><option value="horizontal" ${e?.direction!=='vertical'?'selected':''}>横排 · 从左向右</option><option value="vertical" ${e?.direction==='vertical'?'selected':''}>竖排 · 从上向下，列从右向左</option></select></label><label class="field"><span>文字风格</span><select id="text-font">${textFontOptions(e?.font||newTextFont)}</select></label>`,`<button class="button outline" data-action="close-dialog">取消</button><button class="button primary" data-action="save-text" data-id="${e?.id||''}">${existing?'保存文字':'添加到这一页'}</button>`);setTimeout(()=>$('#text-content')?.focus(),50);}
function about(){showDialog('一点使用说明',`<p class="dialog-description">拾页 · 高保真交互原型<br>把日子，慢慢收好。</p><ul class="about-list"><li><b>可以真正操作</b>创建手帐、翻页、拖动贴纸、缩放旋转、编辑文字、切换纸张、整理页面、撤销重做与本机保存。</li><li><b>贴纸工坊</b>示例使用预制透明素材体验多主体选择。上传个人照片后可框选或轮廓裁切。正式流程为自动提取所有主要物体，再圈选纠错并自动贴边；真实 AI 分割尚未接入。</li><li><b>你的内容留在本机</b>使用浏览器 IndexedDB 保存，清理网站数据会移除作品。原型没有账号、云同步或后台服务。</li><li><b>先从一本示例书开始</b>书架前三本为可编辑示例。点击封面翻阅，再切换到“编辑”；双击文字可以修改。</li></ul>`,`<button class="button primary" data-action="close-dialog">知道了，开始拾页</button>`);}
async function navigate(view,origin=null){const version=++navigationVersion;if(currentView==='editor'&&!(await saveNow()))return;if(version!==navigationVersion)return;photoTaskVersion++;stopHomeDemo();cancelEditingTurn();cancelReaderTurn();if(view==='workshop'&&currentView!=='workshop'){workshopReturn={view:currentView,bookId:activeBookId,pageId:currentPage()?.id,editing,selectedId,drawer};workshopOrigin=origin;}currentView=view;selectedId=null;drawer=null;render();window.scrollTo(0,0);}
async function openBook(id,edit=false){cancelReaderTurn();readerCover=null;activeBookId=id;currentView='editor';editing=edit;selectedId=null;drawer=null;history=[];future=[];render();window.scrollTo(0,0);}
function selectPage(i){const b=currentBook();b.page=Math.max(0,Math.min(b.pages.length-1,i));selectedId=null;dirty();renderEditor();$('#canvas-page')?.classList.add('flip-in');}
// Homepage demo is presentation-only: never write it into the user's books or assets.
const homeDemo={open:false,spread:0,busy:false,frame:0,timer:0};
const homeSticker='assets/home-landscape-sticker.png';
const homePages=[
 {kind:'intro',label:'FIELD NOTES / 01',title:'把山风，\n夹进书里。',copy:'那天没有赶路。\n只是在湖边坐了很久，\n看云慢慢越过山顶。',foot:'一些山野，一些自由。'},
 {kind:'landscape',label:'A LITTLE PIECE OF THE WILD',title:'山野来信',copy:'离开的时候，\n偷偷带走一小片风景。',foot:'09.07 / 晴 · 山间漫游'},
 {kind:'forest',label:'FIELD NOTES / 02',title:'沿着有光的地方走',copy:'树影摇晃，风有了形状。\n这一页，留给绿色。',foot:'没有目的地，也是一种抵达。'},
 {kind:'notes',label:'COLLECT THE LITTLE THINGS',title:'今天，拾到了',copy:'01  清晨的第一阵山风\n02  一整片安静的湖水\n03  不用看时间的下午',foot:'值得收藏的，不必是大事。'},
 {kind:'coffee',label:'FIELD NOTES / 03',title:'给日子，留一点白。',copy:'一杯咖啡，一段空闲。\n把今天过得松一点。',foot:'A LITTLE PAUSE / SUNDAY'},
 {kind:'ending',label:'YOUR STORY STARTS HERE',title:'下一页，\n就写你的故事。',copy:'把照片里的喜欢，\n变成书里的一枚贴纸。',foot:'拾页 SHIYE · 把日子，慢慢收好。'}
];
function homePageHTML(index){
 const p=homePages[index];
 const picture=p.kind==='landscape'||p.kind==='notes'?`<img class="demo-landscape-cutout" src="${homeSticker}" alt="山峰、森林与湖水组成的白边风景贴纸" draggable="false">`:p.kind==='forest'||p.kind==='coffee'?`<figure class="demo-photo"><img src="assets/${p.kind}.jpg" alt="${p.kind==='forest'?'阳光穿过森林的小路':'桌上的一杯咖啡'}" draggable="false"><figcaption>${p.kind==='forest'?'a walk with no destination':'slow mornings, good days'}</figcaption></figure>`:'';
 return `<article class="demo-page-content page-${p.kind}"><div class="demo-page-label">${p.label}</div><h2>${esc(p.title).replace(/\n/g,'<br>')}</h2>${picture}<p>${esc(p.copy).replace(/\n/g,'<br>')}</p>${p.kind==='intro'?'<div class="demo-date"><span>SEP</span><b>07</b><span>山风 / 晴</span></div>':''}${p.kind==='ending'?`<img class="demo-ending-sticker" src="${homeSticker}" alt="白边山湖贴纸" draggable="false">`:''}<footer><span>${p.foot}</span><span>${String(index+1).padStart(2,'0')}</span></footer></article>`;
}
function renderHome(){
 Object.assign(homeDemo,{open:false,spread:0,busy:false});
 $('#app').innerHTML=`<div class="home-shell"><header class="home-header"><a class="home-wordmark" href="#" data-action="nav" data-view="home" aria-label="拾页首页">拾页<span>SHIYE</span></a><nav aria-label="首页导航"><button data-action="nav" data-view="shelf">我的书架 ${icon('arrow')}</button></nav></header><main class="home-main"><section class="home-copy" aria-labelledby="home-title"><div class="home-brand"><span class="brand-mark" aria-hidden="true"></span><span>拾页<small>SHIYE</small></span></div><div class="home-kicker">A HOME FOR YOUR LITTLE MOMENTS</div><h1 id="home-title">把日子，<br>慢慢<span>收好。</span></h1><p class="home-description">从照片里拾起一点喜欢，<br>做成贴纸，收进只属于你的手帐。</p><div class="home-actions"><button class="button primary" data-action="home-create-sticker">${icon('sticker')} 开始创作贴纸 ${icon('arrow')}</button><button class="home-watch" data-action="home-demo" aria-controls="home-book" aria-expanded="false"><span class="play-symbol" aria-hidden="true">▷</span><span>观看演示</span></button></div><button class="home-new-book" data-action="new-book">或者，从一本空白手帐开始 ${icon('arrow')}</button><div class="home-copy-foot"><span></span>一张照片 · 一枚贴纸 · 一本自己的书</div></section><section class="home-stage" aria-label="拾页手帐翻阅演示"><div class="home-stage-caption">LITTLE MOMENTS, BOUND TOGETHER.</div><div class="floating-stickers" aria-hidden="true"><img class="float-sticker float-landscape" src="${homeSticker}" alt="" draggable="false"><div class="float-photo float-forest"><img src="assets/forest.jpg" alt="" draggable="false"><span>去有风的地方</span></div><div class="float-photo float-coffee"><img src="assets/coffee.jpg" alt="" draggable="false"><span>a little pause.</span></div><span class="float-label">山风，已收藏。</span></div><div class="home-book-scene"><div id="home-book" class="home-book" role="group" aria-label="合上的示例手帐：山野来信"><div class="demo-book-board"></div><div class="demo-spread" aria-hidden="true"><div class="demo-left">${homePageHTML(0)}</div><div class="demo-right">${homePageHTML(1)}</div><div class="demo-binding"></div></div><div class="demo-turn-layer" aria-hidden="true"></div><button class="demo-cover" data-action="home-demo" aria-label="打开山野来信，观看演示"><span class="cover-front"><span class="home-cover-top">A PERSONAL COLLECTION<br>OF LITTLE MOMENTS</span><span class="home-cover-title">山野来信</span><span class="home-cover-subtitle">Letters from<br><i>the wild.</i></span><img src="assets/lake.jpg" alt="山野来信封面上的湖景" draggable="false"><span class="home-cover-bottom">拾页 SHIYE<span>VOL. 001</span></span></span><span class="cover-back" aria-hidden="true"></span></button></div></div><div class="home-demo-controls" hidden><button class="demo-prev icon-button" data-action="home-prev" aria-label="上一组页面" disabled>${icon('left')}</button><span class="demo-progress" role="status" aria-live="polite">01 — 02 / 06</span><button class="demo-next icon-button" data-action="home-next" aria-label="下一组页面">${icon('right')}</button><span class="demo-control-divider"></span><button class="demo-close" data-action="home-close">合上手帐</button></div><p class="home-stage-hint">有些瞬间，值得一页一页地翻。</p><p class="home-demo-disclosure" hidden>示例手帐 · 风景照片与预制贴纸</p></section></main><footer class="home-footer"><span>生活的碎片，在这里成书。</span><span>MADE OF LITTLE MOMENTS <i>✳</i> SHIYE</span></footer></div>`;
 $('.demo-book-board').insertAdjacentHTML('afterend','<div class="home-page-stack stack-left" aria-hidden="true"></div><div class="home-page-stack stack-right" aria-hidden="true"></div>');
 bindHomeBook();
}
function stopHomeDemo(){cancelAnimationFrame(homeDemo.frame);clearTimeout(homeDemo.timer);Object.assign(homeDemo,{frame:0,timer:0,busy:false});}
function updateHomeDemo(){
 const book=$('#home-book');if(!book)return;
 book.style.setProperty('--left-stack',`${2+homeDemo.spread*2}px`);
 book.style.setProperty('--right-stack',`${6-homeDemo.spread*2}px`);
 book.setAttribute('aria-label',homeDemo.open?`山野来信，第 ${homeDemo.spread*2+1} 至 ${homeDemo.spread*2+2} 页`:'合上的示例手帐：山野来信');
 book.tabIndex=homeDemo.open?0:-1;
 $('.demo-progress').textContent=`${String(homeDemo.spread*2+1).padStart(2,'0')} — ${String(homeDemo.spread*2+2).padStart(2,'0')} / 06`;
 $('.demo-prev').disabled=homeDemo.busy||homeDemo.spread===0;
 $('.demo-next').disabled=homeDemo.busy||homeDemo.spread===2;
 $('.demo-close').disabled=homeDemo.busy;
 const watch=$('.home-watch');watch.disabled=homeDemo.busy;watch.setAttribute('aria-expanded',String(homeDemo.open));
 watch.querySelector('span:last-child').textContent=homeDemo.open?'重新观看':'观看演示';
 $('.demo-spread').setAttribute('aria-hidden',String(!homeDemo.open));
 $('.demo-cover').disabled=homeDemo.open;
 $('.demo-cover').setAttribute('aria-hidden',String(homeDemo.open));
 $('.demo-cover').tabIndex=homeDemo.open?-1:0;
}
function showHomeSpread(){
 $('.demo-left').innerHTML=homePageHTML(homeDemo.spread*2);
 $('.demo-right').innerHTML=homePageHTML(homeDemo.spread*2+1);
 $('.demo-turn-layer').innerHTML='';updateHomeDemo();
}
function openHomeDemo(){
 if(homeDemo.busy)return;
 if(homeDemo.open){homeDemo.spread=0;showHomeSpread();return;}
 homeDemo.open=true;homeDemo.busy=true;
 $('.home-stage').classList.add('is-open');$('#home-book').classList.add('is-open');
 $('.home-demo-controls').hidden=false;$('.home-demo-disclosure').hidden=false;
 $('.home-stage-hint').textContent='轻拖书页侧边翻页，也可以点击左右箭头。';updateHomeDemo();
 homeDemo.timer=setTimeout(()=>{if(currentView!=='home')return;homeDemo.busy=false;updateHomeDemo();$('.demo-next').focus({preventScroll:true});},matchMedia('(prefers-reduced-motion: reduce)').matches?0:1250);
}
function closeHomeDemo(){
 if(homeDemo.busy)return;stopHomeDemo();homeDemo.open=false;homeDemo.spread=0;showHomeSpread();
 $('.home-stage').classList.remove('is-open');$('#home-book').classList.remove('is-open');
 $('.home-demo-controls').hidden=true;$('.home-demo-disclosure').hidden=true;
 $('.home-stage-hint').textContent='有些瞬间，值得一页一页地翻。';$('.home-watch').focus({preventScroll:true});
}
function prepareHomeTurn(direction){
 const s=homeDemo.spread,target=s+direction,layer=$('.demo-turn-layer');
 if(target<0||target>2||homeDemo.busy)return null;
 const right=direction===1,front=right?s*2+1:s*2,back=right?target*2:target*2+1;
 const rect={width:$('.demo-right').offsetWidth,height:$('.demo-right').offsetHeight};
 layer.innerHTML=`<div class="demo-fold-front">${homePageHTML(front)}</div><div class="demo-fold-back"><div class="demo-fold-back-content">${homePageHTML(back)}</div><div class="demo-fold-light"></div></div>`;
 layer.style.left=right?'50%':'0';layer.style.width='50%';
 (right?$('.demo-right'):$('.demo-left')).innerHTML=homePageHTML(right?target*2+1:target*2);
 homeDemo.busy=true;updateHomeDemo();
 return {direction,target,w:rect.width,h:rect.height,front:$('.demo-fold-front'),back:$('.demo-fold-back'),progress:0};
}
// Song-approved soft-paper motion, shared by homepage, reader and editor.
// Each tangent follows a continuous arc;
// the free edge leads while the binding stays attached (no diagonal corner fold).
function drawSideTurn(turn,progress){
 const p=Math.max(0,Math.min(1,progress)),n=40,dir=turn.direction,w=turn.w,h=turn.h;
 if(!turn.strips){
  const layer=turn.front.parentElement,frontHTML=turn.front.innerHTML,backHTML=turn.back.querySelector('.demo-fold-back-content').innerHTML;
  turn.front.hidden=true;turn.back.hidden=true;layer.classList.add('side-turn-layer','soft-home-turn');
  layer.style.perspectiveOrigin=dir>0?'0 50%':'100% 50%';
  const shadow=document.createElement('div');shadow.className='soft-paper-shadow';layer.appendChild(shadow);turn.shadow=shadow;
  const root=document.createElement('div');root.className='side-sheet';root.style.cssText=`left:${dir>0?0:w}px;width:${w/n}px;height:${h}px;`;
  layer.appendChild(root);turn.strips=[];let parent=root;
  for(let i=0;i<n;i++){
   const strip=document.createElement('div');strip.className='side-strip';
   strip.style.cssText=`width:${w/n}px;left:${i?(dir>0?w/n:-w/n):(dir>0?0:-w/n)}px;transform-origin:${dir>0?'left':'right'} center;`;
   const x=dir>0?i*w/n:w-(i+1)*w/n,bx=w-x-w/n;
   strip.innerHTML=`<div class="side-face side-front"><div class="side-content" style="width:${w}px;left:${-x}px">${frontHTML}</div><i></i></div><div class="side-face side-back"><div class="side-content" style="width:${w}px;left:${-bx}px">${backHTML}</div><i></i></div>`;
   parent.appendChild(strip);turn.strips.push(strip);parent=strip;
  }
 }
 // Curvature grows and then relaxes. The entire sheet is never a rotating board:
 // at mid-turn its tangents span ~150 degrees, with an arched free edge.
 const base=180*p,bend=Math.min(base,180-base,76*Math.sin(Math.PI*p));
 let lastAngle=0,tipX=0,tipZ=0;
 turn.strips.forEach((strip,i)=>{
  const s=(i+.5)/n,angle=base+bend*(2*s-1),radians=angle*Math.PI/180;
  strip.style.transform=`rotateY(${-dir*(angle-lastAngle)}deg)`;lastAngle=angle;
  tipX+=Math.cos(radians)*w/n;tipZ+=Math.sin(radians)*w/n;
  const shade=.025+.19*Math.pow(Math.sin(radians),2);
  strip.style.setProperty('--turn-shade',shade.toFixed(3));
 });
 const lift=Math.sin(Math.PI*p),shadow=turn.shadow;
 shadow.style.cssText=`width:${w*(.16+.65*lift)}px;left:${(dir>0?0:w)+dir*tipX*.4-w*(.16+.65*lift)/2}px;opacity:${.20*lift};filter:blur(${3+tipZ*.055}px);transform:skewY(${-dir*2*lift}deg);`;
 turn.progress=p;
}

function finishHomeTurn(turn,commit=true){
 if(commit)homeDemo.spread=turn.target;homeDemo.busy=false;showHomeSpread();
}
function animateHomeTurn(turn,commit=true){
 const from=turn.progress,to=commit?1:0,duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:Math.max(240,1450*Math.abs(to-from));let start;
 const tick=now=>{if(currentView!=='home')return;if(start===undefined)start=now;const t=duration?Math.min(1,(now-start)/duration):1,ease=t*t*(3-2*t);drawSideTurn(turn,from+(to-from)*ease);if(t<1)homeDemo.frame=requestAnimationFrame(tick);else finishHomeTurn(turn,commit);};
 homeDemo.frame=requestAnimationFrame(tick);
}
function turnHomePage(direction){if(!homeDemo.open||homeDemo.busy)return;const turn=prepareHomeTurn(direction);if(turn)animateHomeTurn(turn);}
function bindHomeBook(){
 const book=$('#home-book');let gesture=null,suppressClick=false;
 book.onpointerdown=e=>{
  if(!homeDemo.open||homeDemo.busy||e.button!==0)return;
  const r=book.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
  if(y<0||y>r.height)return;
  const direction=x>r.width*.80?1:x<r.width*.20?-1:0;if(!direction)return;
  const turn=prepareHomeTurn(direction);if(!turn)return;
  gesture={turn,startX:e.clientX,startY:e.clientY,moved:false,pointerId:e.pointerId};
  drawSideTurn(turn,.001);book.setPointerCapture(e.pointerId);e.preventDefault();
 };
 book.onpointermove=e=>{
  if(!gesture)return;const {turn,startX,startY}=gesture,dx=(startX-e.clientX)*turn.direction;
  if(!turn.front.isConnected)return; // Resize/navigation may already have discarded this sheet.
  if(Math.abs(dx)>5)gesture.moved=true;
  drawSideTurn(turn,Math.max(.001,Math.min(1,dx/(2*turn.w))));
 };
 const release=(e,cancel=false)=>{if(!gesture)return;const {turn,moved,pointerId}=gesture;gesture=null;suppressClick=true;if(book.hasPointerCapture(pointerId))book.releasePointerCapture(pointerId);if(turn.front.isConnected)animateHomeTurn(turn,!cancel&&(!moved||turn.progress>.23));};
 book.onpointerup=e=>release(e);book.onpointercancel=e=>release(e,true);
 book.onlostpointercapture=e=>{if(gesture)release(e,true);};
 book.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopPropagation();suppressClick=false;}},true);
}

let readerCover=null,readerTurn=null,readerFrame=0;
const readerMobile=()=>innerWidth<700;
function cancelReaderTurn(){cancelAnimationFrame(readerFrame);readerFrame=0;readerTurn=null;$('.reader-turn-layer')?.remove();}
function readerFace(index,active=false){
 const b=currentBook(),p=b.pages[index];
 if(!p)return `<div class="reader-leaf reader-endpaper"><span>${index<0?'此间，收藏生活':'故事还在继续'}</span><small>拾页 · SHIYE</small></div>`;
 return `<div ${active?'id="canvas-page"':''} class="reader-leaf canvas-page ${p.paper}" data-reader-page="${index}" aria-label="第 ${index+1} 页">${elementsHTML(p,true,true)}<div class="page-number">${String(index+1).padStart(2,'0')} / SHIYE</div></div>`;
}
function renderReading(){
 const b=currentBook();b.page=Math.max(0,Math.min(b.page||0,b.pages.length-1));
 const mobile=readerMobile(),group=pageSpread(),left=b.pages.indexOf(group.left),right=b.pages.indexOf(group.right);
 const pages=mobile?readerFace(b.page,true):readerFace(left,b.page===left)+readerFace(right,b.page===right);
 $('#app').innerHTML=`<div class="shell editor-mode">${sidebar()}<header class="editor-top"><div class="editor-title">${ib('shelve','left','放回书架')}<input id="book-title" aria-label="手帐名称" maxlength="40" value="${esc(b.title)}"></div><div class="editor-top-actions">${statusHTML()}<div class="mode-switch"><button data-action="mode" data-value="read" class="active">翻阅</button><button data-action="mode" data-value="edit">编辑</button></div><button class="button dark small" data-action="shelve">${icon('book')} 放回书架</button></div></header><main class="editor-workspace read-mode"><div class="workspace-meta"><span>${esc(b.title)} · ${readerCover?(readerCover==='front'?'封面':'封底'):`第 ${mobile?b.page+1:`${spreadPages(group).map(p=>b.pages.indexOf(p)+1).join(' — ')}`} 页 / ${b.pages.length}`}</span><button class="text-link" data-action="reader-cover">查看封面</button></div><div class="stage-wrap reader-stage"><button class="page-arrow prev" data-action="page-prev" aria-label="上一页" ${readerCover==='front'?'disabled':''}>${icon('left')}</button><div class="reader-spread ${mobile?'single':''} ${readerCover?'is-cover':''}" tabindex="0" aria-label="手帐翻阅，使用左右方向键或拖动书页侧边">${readerCover?`<button class="reader-cover-button" data-action="reader-open" data-value="${readerCover}" aria-label="打开手帐">${readerCover==='front'?coverHTML(b):`<div class="reader-back cover ${b.cover}"><h3>${esc(b.title)}</h3><p>把日子，慢慢收好。</p><small>拾页 SHIYE</small></div>`}</button>`:pages}${!mobile&&!readerCover?'<div class="reader-binding"></div>':''}</div><button class="page-arrow next" data-action="page-next" aria-label="下一页" ${readerCover==='back'?'disabled':''}>${icon('right')}</button></div><div class="read-caption">${readerCover?'点击封面，打开这本手帐。':'拖动书页侧边翻阅 · 点击页内空白选择要编辑的一页'}</div><div class="page-strip" aria-label="页面缩略图">${b.pages.map((p,i)=>`<button class="page-thumb ${i===b.page&&!readerCover?'active':''}" data-action="page-goto" data-value="${i}" aria-label="第${i+1}页"><div class="thumb-content canvas-page ${p.paper}" style="--scale:1">${elementsHTML(p,true,true)}</div><small>${i+1}</small></button>`).join('')}</div></main></div>`;
 fitReading();resizeObserver?.disconnect();resizeObserver=new ResizeObserver(()=>{if(readerMobile()!==mobile){cancelReaderTurn();renderEditor();}else fitReading();});resizeObserver.observe($('.reader-stage'));bindReading();
}
function fitReading(){
 const wrap=$('.reader-stage'),spread=$('.reader-spread');if(!wrap||!spread)return;
 const cols=spread.classList.contains('single')||readerCover?1:2;
 const css=getComputedStyle(wrap),arrows=$$('.page-arrow',wrap).reduce((n,e)=>n+e.getBoundingClientRect().width,0);
 const available=wrap.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)-arrows-2*parseFloat(css.gap||0);
 const w=Math.max(120,Math.min(420,available/cols,(wrap.clientHeight-42)*420/540));
 spread.style.width=w*cols+'px';spread.style.height=w*540/420+'px';spread.style.setProperty('--scale',w/420);
}
function prepareReaderTurn(direction){
 if(readerTurn||readerCover)return null;
 const b=currentBook(),mobile=readerMobile(),groups=bookSpreads(),s=groups.findIndex(g=>g.key===pageSpread().key),target=mobile?b.page+direction:s+direction;
 const limit=mobile?b.pages.length-1:groups.length-1;
 if(target<0||target>limit){readerCover=direction>0?'back':'front';renderEditor();return null;}
 const root=$('.reader-spread'),faces=$$('.reader-leaf',root),forward=direction===1,frontIndex=mobile?b.page:b.pages.indexOf(groups[s][forward?'right':'left']),backIndex=mobile?target:b.pages.indexOf(groups[target][forward?'left':'right']);
 const face=mobile?faces[0]:faces[forward?1:0],r=face.getBoundingClientRect();
 const layer=document.createElement('div');layer.className='reader-turn-layer';
 layer.style.left=mobile||!forward?'0':'50%';layer.style.width=mobile?'100%':'50%';
 layer.innerHTML=`<div class="demo-fold-front">${readerFace(frontIndex)}</div><div class="demo-fold-back"><div class="demo-fold-back-content">${readerFace(backIndex)}</div><div class="demo-fold-light"></div></div>`;
 const under=mobile?target:b.pages.indexOf(groups[target][forward?'right':'left']);
 face.outerHTML=readerFace(under);root.appendChild(layer);
 readerTurn={direction,target,mobile,bookId:b.id,w:r.width,h:r.height,front:$('.demo-fold-front',layer),back:$('.demo-fold-back',layer),progress:0,layer};
 return readerTurn;
}
function animateReaderTurn(turn,commit=true){
 const from=turn.progress,to=commit?1:0,duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:Math.max(240,1450*Math.abs(to-from));let start;
 const tick=now=>{
  if(readerTurn!==turn||currentView!=='editor'||editing||activeBookId!==turn.bookId)return;
  if(start===undefined)start=now;const t=duration?Math.min(1,(now-start)/duration):1;
  drawSideTurn(turn,from+(to-from)*t*t*(3-2*t));
  if(t<1)readerFrame=requestAnimationFrame(tick);else{if(commit){const b=currentBook();b.page=turn.mobile?turn.target:b.pages.indexOf(spreadPages(bookSpreads()[turn.target])[0]);dirty();}renderEditor();}
 };readerFrame=requestAnimationFrame(tick);
}
function turnReader(direction){
 if(readerTurn)return;
 if(readerCover){if(readerCover==='front'&&direction>0){readerCover=null;selectPage(0);}else if(readerCover==='back'&&direction<0){readerCover=null;selectPage(currentBook().pages.length-1);}return;}
 const turn=prepareReaderTurn(direction);if(turn)animateReaderTurn(turn);
}
function bindReading(){
 const root=$('.reader-spread');let gesture=null,blockClick=false;
 root.onpointerdown=e=>{
  if(e.button!==0||readerCover||readerTurn)return;
  const r=root.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
  if(y<0||y>1)return;const direction=x>.82?1:x<.18?-1:0;if(!direction)return;
  const turn=prepareReaderTurn(direction);if(!turn)return;gesture={turn,x:e.clientX,y:e.clientY,pointer:e.pointerId};root.setPointerCapture(e.pointerId);drawSideTurn(turn,.001,1);e.preventDefault();
 };
 root.onpointermove=e=>{if(!gesture||gesture.pointer!==e.pointerId)return;const g=gesture;drawSideTurn(g.turn,Math.max(.001,Math.min(1,(g.x-e.clientX)*g.turn.direction/(2*g.turn.w))),g.y-e.clientY);e.preventDefault();};
 const release=(e,cancel=false)=>{if(!gesture||gesture.pointer!==e.pointerId)return;const {turn}=gesture;gesture=null;blockClick=true;animateReaderTurn(turn,!cancel&&turn.progress>.2);};
 root.onpointerup=e=>release(e);root.onpointercancel=e=>release(e,true);root.onlostpointercapture=e=>release(e,true);
 root.onclick=e=>{if(blockClick){blockClick=false;return;}if(readerTurn||readerCover||e.target.closest('[data-element]'))return;const leaf=e.target.closest('[data-reader-page]');if(leaf){const i=Number(leaf.dataset.readerPage);if(i!==currentBook().page)selectPage(i);}};
}
document.addEventListener('keydown',e=>{if(currentView!=='editor'||editing||$('#dialog').open||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();turnReader(e.key==='ArrowRight'?1:-1);}});
window.addEventListener('resize',()=>{if(readerTurn){cancelReaderTurn();if(currentView==='editor'&&!editing)renderEditor();}});

let editingPageFrame=0,editingPageTurn=null;
function cancelEditingTurn(){cancelAnimationFrame(editingPageFrame);editingPageFrame=0;editingPageTurn=null;$('.editing-turn-layer')?.remove();const f=$('.page-frame');if(f)f.inert=false;if(currentView==='editor'&&editing&&!spreadEditing()&&$('#canvas-page')&&currentPage()){$('#canvas-page').innerHTML=elementsHTML(currentPage());$('#canvas-page').className='canvas-page '+currentPage().paper;}}
async function turnEditingPage(direction){
 if(spreadEditing()){await turnEditingSpread(direction);return;}
 if(editingPageTurn)return;const book=currentBook(),from=book.page,target=from+direction,version=navigationVersion;
 if(target<0||target>=book.pages.length)return;
 const pending={pending:true};editingPageTurn=pending;const saved=await saveNow();
 if(editingPageTurn!==pending)return;
 if(!saved||currentView!=='editor'||!editing||navigationVersion!==version||currentBook()?.id!==book.id||currentBook().page!==from){cancelEditingTurn();return;}
 const frame=$('.page-frame'),r=frame.getBoundingClientRect(),layer=document.createElement('div');layer.className='reader-turn-layer editing-turn-layer';
 layer.style.cssText='left:0;width:100%';
 layer.innerHTML=`<div class="demo-fold-front"><div class="reader-leaf canvas-page ${currentPage().paper}">${elementsHTML(currentPage(),true,true)}</div></div><div class="demo-fold-back"><div class="demo-fold-back-content"><div class="reader-leaf canvas-page ${book.pages[target].paper}">${elementsHTML(book.pages[target],true,true)}</div></div><div class="demo-fold-light"></div></div>`;
 frame.appendChild(layer);frame.inert=true;$('#canvas-page').innerHTML=elementsHTML(book.pages[target],true,true);$('#canvas-page').className='canvas-page '+book.pages[target].paper;
 const turn={direction,w:r.width,h:r.height,front:$('.demo-fold-front',layer),back:$('.demo-fold-back',layer),progress:0};editingPageTurn=turn;
 let start;const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:1450;
 const tick=now=>{if(editingPageTurn!==turn)return;if(currentView!=='editor'||!editing||currentBook()?.id!==book.id){cancelEditingTurn();return;}if(start===undefined)start=now;const t=duration?Math.min(1,(now-start)/duration):1;drawSideTurn(turn,t*t*(3-2*t));if(t<1)editingPageFrame=requestAnimationFrame(tick);else{cancelEditingTurn();selectPage(target);}};editingPageFrame=requestAnimationFrame(tick);
}

async function turnEditingSpread(direction){
 if(editingPageTurn)return;finishInlineText();
 const b=currentBook(),groups=bookSpreads(),from=groups.findIndex(g=>g.key===pageSpread().key),to=from+direction;if(to<0||to>=groups.length)return;
 const pending={pending:true};editingPageTurn=pending;
 if(!(await saveNow())||editingPageTurn!==pending||currentBook()?.id!==b.id||!editing||!spreadEditing()){cancelEditingTurn();return;}
 const frame=$('.edit-spread');if(!frame){cancelEditingTurn();return;}
 const forward=direction===1,index=p=>b.pages.findIndex(pg=>pg.id===p?.id),target=spreadPages(groups[to])[0],width=frame.clientWidth/2;
 const layer=document.createElement('div');layer.className='reader-turn-layer editing-turn-layer';layer.style.left=forward?'50%':'0';layer.style.width='50%';
 layer.innerHTML=`<div class="demo-fold-front">${readerFace(index(groups[from][forward?'right':'left']))}</div><div class="demo-fold-back"><div class="demo-fold-back-content">${readerFace(index(groups[to][forward?'left':'right']))}</div><div class="demo-fold-light"></div></div>`;
 const leaves=$$('.edit-leaf,.edit-endpaper',frame);leaves[forward?1:0].outerHTML=readerFace(index(groups[to][forward?'right':'left']));frame.appendChild(layer);frame.inert=true;
 const turn={direction,w:width,h:frame.clientHeight,front:$('.demo-fold-front',layer),back:$('.demo-fold-back',layer),progress:0};editingPageTurn=turn;
 let start;const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:1450;
 const tick=now=>{if(editingPageTurn!==turn)return;if(currentBook()?.id!==b.id||!editing){cancelEditingTurn();return;}if(start===undefined)start=now;const t=duration?Math.min(1,(now-start)/duration):1;drawSideTurn(turn,t*t*(3-2*t));if(t<1)editingPageFrame=requestAnimationFrame(tick);else{cancelEditingTurn();selectPage(currentBook().pages.findIndex(p=>p.id===target.id));}};editingPageFrame=requestAnimationFrame(tick);
}

window.addEventListener('resize',()=>{if(editingPageTurn){cancelEditingTurn();if(currentView==='editor'&&editing)renderEditor();}});
function chooseCreation(ids=[]){
 pendingUseIds=ids.filter(id=>asset(id));
 showDialog('继续哪一本故事？',`<p class="dialog-description">${pendingUseIds.length?`已收藏的 ${pendingUseIds.length} 枚贴纸将放入所选手帐的当前页。`:'选择一本手帐进入编辑，或从空白开始。'}</p><div class="creation-books">${state.books.map(b=>`<button class="button outline" data-action="insert-into-book" data-book="${b.id}">${esc(b.title)}<small>${b.sample?'示例 · ':''}第 ${(b.page||0)+1} 页</small>${icon('arrow')}</button>`).join('')}</div>`,`<button class="button primary" data-action="creation-new-book">${icon('plus')} 新建手帐</button>`);
}
function insertStickers(ids,position=null){
 const valid=ids.filter(id=>asset(id));if(!valid.length||!editing||!currentPage())return;
 change(()=>{valid.forEach((id,i)=>{
  if(!state.assets.some(s=>s.id===id))state.assets.push({...asset(id)});
  const e=node('sticker',{assetId:id,x:position?position.x:24+(i%3)*13,y:position?position.y:22+Math.floor(i/3)*12,w:32});
  currentPage().elements.push(e);selectedId=e.id;if(currentBook().stickerPlacement==='spread'&&matePage(currentPage()))e.spreadWith=matePage(currentPage()).id;
 });drawer=null;});toast(`${valid.length} 枚贴纸已放进这一页`);
}
function insertSticker(id){insertStickers([id]);}

// A native popover provides outside-click/Escape dismissal without changing book actions.
document.addEventListener('beforetoggle',event=>{
 const menu=event.target;if(!menu.matches?.('.book-popover')||event.newState!=='open')return;
 const trigger=$(`[popovertarget="${menu.id}"]`);if(!trigger)return;
 const r=trigger.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(innerWidth-176,r.right-168))+'px';
 menu.style.top=(innerHeight-r.bottom>=158?r.bottom+6:Math.max(8,r.top-152))+'px';
},true);
document.addEventListener('toggle',event=>{
 if(event.target.matches?.('.book-popover'))$(`[popovertarget="${event.target.id}"]`)?.setAttribute('aria-expanded',String(event.newState==='open'));
},true);
document.addEventListener('click',event=>{event.target.closest('.book-popover')?.hidePopover();});
window.addEventListener('resize',()=>$$('.book-popover:popover-open').forEach(menu=>menu.hidePopover()));
document.addEventListener('scroll',event=>{if(!event.target.closest?.('.book-popover'))$$('.book-popover:popover-open').forEach(menu=>menu.hidePopover());},true);

document.addEventListener('click',async event=>{
 const btn=event.target.closest('[data-action]');if(!btn||btn.disabled)return;const a=btn.dataset.action,id=btn.dataset.id,v=btn.dataset.value;
 if(a==='home-demo'){openHomeDemo();return;}if(a==='home-close'){closeHomeDemo();return;}
 if(a==='home-next'||a==='home-prev'){turnHomePage(a==='home-next'?1:-1);return;}
 if(a==='home-create-sticker'){await navigate('workshop');return;}
 if(a==='nav'){event.preventDefault();await navigate(btn.dataset.view);return;}if(a==='about'){about();return;}if(a==='close-dialog'){pendingUseIds=[];closeDialog();return;}
 if(a==='new-book'){pendingUseIds=[];newBookDialog();return;}
 if(a==='creation-new-book'){newBookDialog();return;}if(a==='choose-cover'){$$('.cover-choice').forEach(b=>{b.classList.toggle('active',b===btn);b.setAttribute('aria-pressed',b===btn);});return;}
 if(a==='create-book'){let title=$('#new-title').value.trim()||'未命名的日子';const b={id:uid(),title,cover:$('.cover-choice.active').dataset.value,subtitle:'MOMENTS TO KEEP',sample:false,updated:Date.now(),page:0,pages:[blankPage()]};state.books.push(b);closeDialog();const ids=[...pendingUseIds];pendingUseIds=[];await openBook(b.id,true);insertStickers(ids);await saveNow();toast(saveStatus==='已保存到本机'?'新的一页，留给新的回忆':'手帐仍在当前页，请重试保存');return;}
 if(a==='open-book'){openBook(id);return;}if(a==='book-menu'){bookMenu(id);return;}
 if(a==='pin-book'){const b=state.books.find(b=>b.id===id);if(!b)return;b.pinned=!b.pinned;dirty();renderShelf();return;}
 if(a==='rename-book'){const b=state.books.find(b=>b.id===id);b.title=$('#rename-title').value.trim()||b.title;b.updated=Date.now();closeDialog();dirty();renderShelf();return;}
 if(a==='delete-book-confirm'){let b=state.books.find(b=>b.id===id);showDialog('删除这本手帐？',`<p class="dialog-description">将删除「${esc(b.title)}」及其中的 ${b.pages.length} 页内容。<br>删除后无法恢复；贴纸收藏会保留。</p>`,`<button class="button outline" data-action="close-dialog" autofocus>取消，保留手帐</button><button class="button danger" data-action="delete-book" data-id="${id}">确认删除</button>`);return;}
 if(a==='delete-book'){
  const index=state.books.findIndex(b=>b.id===id);if(index<0)return;const removed=state.books[index];btn.disabled=true;
  state.books.splice(index,1);mutationVersion++;const saved=await saveNow();
  if(!saved){if(!state.books.some(b=>b.id===id))state.books.splice(index,0,removed);btn.disabled=false;toast('删除未保存，手帐已保留。请稍后重试。');return;}
  closeDialog();renderShelf();toast('手帐已删除，贴纸收藏仍保留');return;
 }
 if(a==='book-filter'){bookFilter=btn.dataset.filter;renderShelf();return;}if(a==='book-view'){bookView=v;renderShelf();return;}
 if(a==='collection-tab'){collectionTab=v;filter='全部';renderCollection();return;}if(a==='filter'){filter=v;renderCollection();return;}
 if(a==='sticker-detail'){const s=asset(id),owned=state.assets.some(a=>a.id===id);showDialog(esc(s.name),`<div class="preview-stage" style="min-height:220px"><img src="${s.src}" alt="${esc(s.name)}" style="height:190px;width:70%;${borderStyle(s.borderBaked?0:s.border||0)}"></div><p class="dialog-description">${owned?'已经收入你的私人收藏，可以反复放进不同手帐。':'拾页提供的原创示例插画。收藏后，可以反复放进不同手帐。'}</p>`,`<button class="button outline" data-action="close-dialog">关闭</button>${owned?`<button class="button outline" data-action="manage-sticker" data-id="${id}">整理</button>`:''}${owned?`<button class="button primary" data-action="use-collected" data-id="${id}">放进手帐 ${icon('arrow')}</button>`:`<button class="button primary" data-action="collect" data-id="${id}">${icon('plus')} 收入收藏</button>`}`);return;}
 if(a==='manage-sticker'){const s=asset(id);showDialog('整理这枚收藏',`<label class="field"><span>贴纸名称</span><input id="sticker-rename" maxlength="30" value="${esc(s.name)}"></label><p class="dialog-description">移出收藏不会影响已经放进手帐的贴纸。</p>`,`<button class="button outline" data-action="remove-sticker" data-id="${id}" style="margin-right:auto;color:var(--accent)">移出收藏</button><button class="button primary" data-action="rename-sticker" data-id="${id}">保存名称</button>`);return;}
 if(a==='rename-sticker'){const s=state.assets.find(s=>s.id===id);s.name=$('#sticker-rename').value.trim()||s.name;closeDialog();dirty();renderCollection();return;}
 if(a==='remove-sticker'){const s=state.assets.find(s=>s.id===id);if(s){state.archivedAssets=state.archivedAssets||[];if(!state.archivedAssets.some(a=>a.id===id))state.archivedAssets.push({...s});state.assets=state.assets.filter(s=>s.id!==id);}closeDialog();dirty();renderCollection();toast('已移出收藏，页面中的贴纸仍保留');return;}
 if(a==='collect'){if(!state.assets.some(s=>s.id===id))state.assets.push({...asset(id)});closeDialog();dirty();renderCollection();toast('已收入你的贴纸收藏');return;}
 if(a==='use-collected'||a==='enter-creation'){chooseCreation(id?[id]:[]);return;}
 if(a==='insert-into-book'){const ids=[...pendingUseIds];pendingUseIds=[];closeDialog();await openBook(btn.dataset.book,true);insertStickers(ids);return;}
 if(a==='shelve'){cancelReaderTurn();if(!(await saveNow()))return;$('.editor-workspace').classList.add('closing');setTimeout(()=>{currentView='shelf';selectedId=null;drawer=null;render();toast('已收好，随时回来翻一翻');},330);return;}
 if(a==='mode'){const bookId=activeBookId;if(v==='read'&&editing){if(!(await saveNow())||saveStatus!=='已保存到本机'||currentView!=='editor'||activeBookId!==bookId)return;}readerCover=null;editing=v==='edit';selectedId=null;drawer=null;renderEditor();return;}
 if(a==='editor-layout'){if(!editing)return;finishInlineText();currentBook().editorLayout=v==='spread'?'spread':'single';selectedId=null;dirty();renderEditor();return;}
 if(a==='paper-scope'){if(!editing)return;change(()=>{ensurePagePairs();if(v==='spread')setSpreadPaper(currentPage().paper);else clearSpreadPaper();});return;}
 if(a==='add-spread'||a==='add-mate'){if(!editing)return;change(()=>insertPages(a==='add-spread'));return;}
 if(a==='drawer'){drawer=drawer===v?null:v;selectedId=null;renderEditor();return;}if(a==='close-drawer'){drawer=null;renderEditor();return;}
 if(a==='insert-sticker'){if(Date.now()>suppressStickerClickUntil)insertSticker(id);return;}if(a==='add-text'){startInlineText();return;}if(a==='edit-text'){textDialog(true);return;}
 if(a==='save-text'){const text=$('#text-content').value.trim(),font=$('#text-font').value,direction=$('#text-direction').value;if(!text){$('#text-content').focus();toast('先写一点内容吧');return;}change(()=>{if(id){let e=elementPage(id).elements.find(e=>e.id===id);e.text=text;e.font=font;if((e.direction||'horizontal')!==direction){e.w=direction==='vertical'?28:70;e.h=60;}e.direction=direction;}else{let e=node('text',{text,font,direction,x:15,y:20,w:direction==='vertical'?28:70,h:60,size:23,color:'#505b46'});currentPage().elements.push(e);selectedId=e.id;}drawer=null;});closeDialog();return;}
 if(a==='paper-category'){
  if(!editing||drawer!=='paper'||(v!=='favorites'&&!paperGroups.some((g,i)=>String(i)===v)))return;
  paperCategory=v;refreshPaperDrawer(a,v);return;
 }
 if(a==='paper-favorite'||a==='paper-pin'){
  if(!editing||drawer!=='paper'||!paperGroups.some(g=>g.items.some(p=>p[0]===v)))return;
  const kind=a==='paper-favorite'?'favorite':'pin',scroll=$('.paper-panel-body')?.scrollTop||0;
  try{localStorage.setItem(paperPreferenceKey(kind,v),paperPreference(kind,v)?'0':'1');}
  catch{toast('纸张偏好保存失败，请重试');return;}
  refreshPaperDrawer(a==='paper-pin'?'paper':a,v,scroll);return;
 }
 if(a==='paper'){if(!editing||!paperGroups.some(g=>g.items.some(p=>p[0]===v))||(currentPage().paperSpread?.paper||currentPage().paper)===v)return;const scroll=$('.paper-panel-body')?.scrollTop||0;change(()=>{if(currentPage().paperSpread)setSpreadPaper(v);else currentPage().paper=v;});const panel=$('.paper-panel-body');if(panel){panel.scrollTop=scroll;$(`[data-action="paper"][data-value="${v}"]`,panel)?.focus({preventScroll:true});}return;}
 if(a==='page-goto'){readerCover=null;selectPage(Number(v));return;}if(a==='page-prev'||a==='page-next'){const dir=a==='page-next'?1:-1;if(editing)turnEditingPage(dir);else turnReader(dir);return;}
 if(a==='reader-cover'){readerCover='front';renderEditor();return;}
 if(a==='reader-open'){readerCover=null;selectPage(v==='back'?currentBook().pages.length-1:0);return;}
 if(a==='page-add'){change(()=>insertPages(false));toast('新的一页，慢慢写');return;}
 if(a==='duplicate-page'){change(duplicateSpread);return;}
 if(a==='move-page-up'||a==='move-page-down'){const groups=bookSpreads(),g=pageSpread(currentBook().pages[Number(v)]),to=groups.findIndex(x=>x.key===g.key)+(a==='move-page-up'?-1:1);if(!groups[to])return;change(()=>moveSpread(Number(v),currentBook().pages.indexOf(spreadPages(groups[to])[0])));return;}
 if(a==='delete-page'){
  const pages=pagesToDelete();if(pages.length>=currentBook().pages.length)return;
  showDialog(pages.length>1?'删除这组双页？':'删除这一页？',`<p class="dialog-description">将删除第 ${pages.map(p=>currentBook().pages.indexOf(p)+1).join('、')} 页。${pages.length>1?'<br>这两页使用了连续背景或跨页贴纸，将一起删除，避免留下另一半。':''}<br>贴纸收藏保留，删除后可撤销恢复。</p>`,`<button class="button outline" data-action="close-dialog" autofocus>保留</button><button class="button danger" data-action="confirm-delete-page">${pages.length>1?'删除这组双页':'删除这一页'}</button>`);return;
 }
 if(a==='confirm-delete-page'){const ids=pagesToDelete().map(p=>p.id);if(ids.length>=currentBook().pages.length)return;change(()=>{ensurePagePairs();const b=currentBook();b.pages=b.pages.filter(p=>!ids.includes(p.id));b.page=Math.min(b.page,b.pages.length-1);selectedId=null;});closeDialog();return;}
 if(a==='undo'||a==='redo'){const source=a==='undo'?history:future,destination=a==='undo'?future:history;if(!source.length)return;destination.push(JSON.stringify(currentBook().pages));currentBook().pages=JSON.parse(source.pop());currentBook().page=Math.min(currentBook().page,currentBook().pages.length-1);selectedId=null;dirty();renderEditor();return;}
 if(['smaller','larger','rotate-left','rotate-right','flip','duplicate','layer-up','layer-down','delete-element'].includes(a)){if(!currentElement())return;change(()=>{let e=currentElement(),p=elementPage();if(a==='smaller'||a==='larger'){let old=e.w;e.w=Math.max(8,Math.min(110,e.w*(a==='larger'?1.1:1/1.1)));if(e.type==='text'){e.size=(e.size||18)*e.w/old;if(e.direction==='vertical')e.h=(e.h||60)*e.w/old;}}if(a==='rotate-left')e.rotation=(e.rotation||0)-5;if(a==='rotate-right')e.rotation=(e.rotation||0)+5;if(a==='flip')e.flip=!e.flip;if(a==='duplicate'){let copy={...e,id:uid(),x:Math.min(85,e.x+4),y:Math.min(85,e.y+4)};p.elements.push(copy);selectedId=copy.id;}if(a==='delete-element'){p.elements=p.elements.filter(n=>n.id!==e.id);selectedId=null;}if(a==='layer-up'||a==='layer-down'){let i=p.elements.indexOf(e),to=Math.max(0,Math.min(p.elements.length-1,i+(a==='layer-up'?1:-1)));p.elements.splice(i,1);p.elements.splice(to,0,e);}if(currentElement())constrainSticker(currentElement());});return;}
 if(a==='workshop-from-editor'){await navigate('workshop',{bookId:activeBookId,pageId:currentPage().id});return;}
 if(a==='upload'){$('#photo-input').click();return;}
 if(a==='crop-example'){const task=++photoTaskVersion,version=navigationVersion;try{btn.disabled=true;const response=await fetch('assets/lake.jpg');if(!response.ok)throw new Error('missing sample');const blob=await response.blob();if(!photoIsCurrent(task,version))return;await loadPhoto(new File([blob],'山湖示例.jpg',{type:'image/jpeg'}),task,version);}catch{if(photoIsCurrent(task,version)){toast('示例照片加载失败，请选择自己的照片');btn.disabled=false;}}return;}
 if(a==='sample'){photoTaskVersion++;workshop={step:1,selected:['coffee','flower'],preview:0,border:4,source:null,crops:[],results:[],demo:true};renderWorkshop();return;}
 if(a==='subject'){workshop.selected=workshop.selected.includes(id)?workshop.selected.filter(x=>x!==id):[...workshop.selected,id];renderWorkshop();return;}
 if(a==='workshop-back'){await goBackWorkshop();return;}
 if(a==='workshop-resume'){photoTaskVersion++;workshop.step=workshop.resumeStep||1;renderWorkshop();window.scrollTo(0,0);return;}
 if(a==='workshop-reset'){photoTaskVersion++;workshop.step=0;renderWorkshop();return;}if(a==='back-subjects'){photoTaskVersion++;workshop.step=1;renderWorkshop();return;}
 if(a.startsWith('edge-')){await window.ShiyeEdge.action(a.slice(5));return;}
 if(a==='crop-mode'){window.ShiyeEdge?.resetTool();if(v==='rect'&&workshop.scissorPoints?.length){cropCheckpoint();workshop.scissorPoints=[];}workshop.cropMode=v;if(v==='edit'&&workshop.activeCrop==null)workshop.activeCrop=workshop.crops.length-1;renderWorkshop();return;}
 if(a==='finish-scissors'){finishScissors(workshop.scissorPoints||[]);return;}
 if(a==='undo-crop'||a==='redo-crop'){const from=a==='undo-crop'?(workshop.cropHistory||=[]):(workshop.cropFuture||=[]),to=a==='undo-crop'?(workshop.cropFuture||=[]):(workshop.cropHistory||=[]);if(from.length){to.push(cropSnapshot());restoreCropSnapshot(from.pop());renderWorkshop();}return;}
 if(a==='select-crop'){workshop.activeCrop=Number(v);workshop.cropMode='edit';renderWorkshop();return;}
 if(a==='delete-crop'){if(workshop.crops.length){cropCheckpoint();workshop.crops.splice(workshop.activeCrop??workshop.crops.length-1,1);workshop.activeCrop=workshop.crops.length-1;renderWorkshop();}return;}
 if(a==='clear-crops'){cropCheckpoint();workshop.scissorPoints=[];workshop.crops=[];workshop.activeCrop=-1;renderWorkshop();return;}if(a==='full-crop'){cropCheckpoint();workshop.crops=[{x:0,y:0,w:1,h:1}];workshop.activeCrop=0;renderWorkshop();return;}
 if(a==='generate'){if(!workshop.demo&&workshop.scissorPoints?.length){if(!finishScissors(workshop.scissorPoints))return;}const task=++photoTaskVersion,version=navigationVersion;const generateButton=$('#generate-button')||btn;generateButton.disabled=true;generateButton.textContent='正在准备贴纸…';if($('#crop-stage'))$('#crop-stage').inert=true;try{const results=workshop.demo?workshop.selected.map(id=>({...builtin.find(b=>b.id===id),id:uid(),category:builtin.find(b=>b.id===id).category})):await cropResults();if(!photoIsCurrent(task,version))return;workshop.results=results;workshop.step=2;workshop.preview=0;renderWorkshop();}catch{if(photoIsCurrent(task,version)){toast('图片处理失败，请换一张照片重试');renderWorkshop();}}return;}
 if(a==='preview-sticker'){workshop.preview=Number(v);renderWorkshop();return;}
 if(a==='save-stickers'||a==='save-and-use'){
  if(savingStickers)return;savingStickers=true;
  const task=photoTaskVersion,version=navigationVersion,ids=workshop.results.map(s=>s.id),origin=workshopOrigin;
  $$('[data-action="save-stickers"],[data-action="save-and-use"]').forEach(b=>b.disabled=true);
  workshop.results.forEach(s=>{if(!state.assets.some(a=>a.id===s.id))state.assets.push({...s,border:workshop.border});});
  const ok=await saveNow();savingStickers=false;
  if(!photoIsCurrent(task,version))return;
  if(!ok){$$('[data-action="save-stickers"],[data-action="save-and-use"]').forEach(b=>b.disabled=false);return;}
  workshop.step=0;workshop.resumeStep=0;currentView='collection';collectionTab='mine';filter='全部';search='';render();
  if(a==='save-and-use'){
   const book=state.books.find(b=>b.id===origin?.bookId),page=book?.pages.findIndex(p=>p.id===origin.pageId);
   if(book&&page>=0){book.page=page;await openBook(book.id,true);insertStickers(ids);}
   else chooseCreation(ids);
  }else toast(`${ids.length} 枚贴纸已收入收藏`);
  return;
 }
});
document.addEventListener('keydown',e=>{if(currentView!=='home'||!homeDemo.open||$('#dialog').open||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();turnHomePage(e.key==='ArrowRight'?1:-1);}if(e.key==='Escape')closeHomeDemo();});
window.addEventListener('resize',()=>{if(currentView==='home'&&homeDemo.open&&homeDemo.busy){stopHomeDemo();showHomeSpread();}});
document.addEventListener('change',e=>{
 if(!editing||currentView!=='editor'||!['page','spread'].includes(e.target.value))return;
 if(e.target.id==='new-sticker-scope'){currentBook().stickerPlacement=e.target.value;dirty();}
 if(e.target.id==='selected-sticker-scope'&&currentElement()?.type==='sticker')change(()=>{ensurePagePairs();setStickerScope(currentElement(),e.target.value);});
});
document.addEventListener('change',e=>{
 if(e.target.id!=='new-text-font'&&e.target.id!=='selected-text-font')return;
 if(currentView!=='editor'||!editing||!textFonts.some(f=>f.id===e.target.value))return;
 const font=e.target.value;
 if(e.target.id==='new-text-font'){
  newTextFont=font;
  const preview=$('.text-font-preview');if(preview)preview.style.fontFamily=textFont(font).family;
 }else{
  const item=currentElement();if(item?.type!=='text'||item.font===font)return;
  change(()=>{item.font=font;});
  $('#selected-text-font')?.focus({preventScroll:true});
 }
});
document.addEventListener('change',e=>{if(e.target.id==='book-sort'){sort=e.target.value;renderShelf();}if(e.target.id==='book-title'){let b=currentBook();b.title=e.target.value.trim()||b.title;e.target.value=b.title;dirty();}if(e.target.id==='photo-input'&&e.target.files[0])loadPhoto(e.target.files[0]);if(e.target.id==='preview-name')workshop.results[workshop.preview].name=e.target.value.trim()||'我的贴纸';});
document.addEventListener('input',e=>{if(e.target.id==='sticker-search'){search=e.target.value;$('#collection-results').innerHTML=collectionResults();}if(e.target.id==='border-range'){workshop.border=Number(e.target.value);$('#border-value').textContent=workshop.border+'px';$('#sticker-preview').style.cssText=borderStyle(workshop.border);}});
document.addEventListener('keydown',e=>{if($('#dialog').open||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(currentView!=='editor'||!editing)return;if(e.key==='Escape'){selectedId=null;drawer=null;renderEditor();}if(e.key==='Enter'&&e.target.dataset.element){selectedId=e.target.dataset.element;renderEditor();}if((e.key==='Delete'||e.key==='Backspace')&&selectedId){e.preventDefault();$('[data-action="delete-element"]')?.click();}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$(`[data-action="${e.shiftKey?'redo':'undo'}"]`)?.click();}if(e.key.startsWith('Arrow')&&selectedId){e.preventDefault();change(()=>{let el=currentElement(),step=e.shiftKey?2:.4;el.x=Math.max(el.spreadWith?-100:-el.w*.65,Math.min(el.spreadWith?195:95,el.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0)));el.y=Math.max(-8,Math.min(92,el.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0)));constrainSticker(el);});}});
$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
function readImage(src){return new Promise((resolve,reject)=>{let img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
const photoIsCurrent=(task,version)=>task===photoTaskVersion&&version===navigationVersion&&currentView==='workshop';
async function loadPhoto(file,task=++photoTaskVersion,version=navigationVersion){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)){toast('请选择 JPG、PNG 或 WebP 图片');return;}
 if(file.size>10*1024*1024){toast('图片超过 10 MB，请选择小一些的照片');return;}
 try{
  const url=URL.createObjectURL(file);let img;try{img=await readImage(url);}finally{URL.revokeObjectURL(url);}
  if(!photoIsCurrent(task,version))return;
  const factor=Math.min(1,1400/Math.max(img.width,img.height)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(img.width*factor));canvas.height=Math.max(1,Math.round(img.height*factor));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  workshop={step:1,selected:[],preview:0,border:4,source:canvas.toDataURL('image/jpeg',.88),crops:[],scissorPoints:[],cropHistory:[],cropFuture:[],activeCrop:-1,cropMode:'outline',results:[],demo:false};renderWorkshop();if(window.innerWidth<800)$('#crop-stage')?.scrollIntoView({block:'center',behavior:'instant'});
 }catch{if(photoIsCurrent(task,version))toast('无法读取这张照片，请尝试其他图片');}
}
function cropSnapshot(){return clone({crops:workshop.crops,scissorPoints:workshop.scissorPoints||[],activeCrop:workshop.activeCrop??-1});}
function restoreCropSnapshot(value){Object.assign(workshop,clone(value));}
function cropCheckpoint(snapshot=cropSnapshot()){(workshop.cropHistory||=[]).push(snapshot);if(workshop.cropHistory.length>40)workshop.cropHistory.shift();workshop.cropFuture=[];}
function cropGeometry(){return window.ShiyeSelection.geometry($('#crop-stage'),$('#crop-source'));}
function placeCropOverlay(el,g){el.style.left=g.left+'px';el.style.top=g.top+'px';el.style.width=g.width+'px';el.style.height=g.height+'px';}
function paintScissorPath(stage,points){
 let svg=$('.scissor-path',stage);if(!svg){svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 1 1');svg.setAttribute('preserveAspectRatio','none');svg.classList.add('crop-outline','scissor-path');stage.appendChild(svg);}
 svg.innerHTML=`<polygon points="${points.map(p=>p.x+','+p.y).join(' ')}"/>${points.map(p=>`<circle cx="${p.x}" cy="${p.y}" r=".006"/>`).join('')}`;
 placeCropOverlay(svg,cropGeometry());
}
function finishScissors(points){
 if(points.length<3){toast('至少点三个位置，围出想保留的区域');return false;}
 const region=window.ShiyeSelection.bounds(points),{w,h}=region;
 const area=Math.abs(points.reduce((a,p,i)=>{const q=points[(i+1)%points.length];return a+p.x*q.y-q.x*p.y;},0))/2;
 if(w<.025||h<.025||area<.001){toast('还没有围出有效区域，可以继续点选或撤销调整');return false;}
 if(workshop.crops.length>=8){toast('已圈好 8 个区域，请先确认这些选区');return false;}
 cropCheckpoint();workshop.crops.push(clone(region));workshop.scissorPoints=[];workshop.activeCrop=workshop.crops.length-1;workshop.cropMode='edit';
 renderWorkshop();return true;
}
function bindCrop(){
 const stage=$('#crop-stage'),image=$('#crop-source'),scissors=workshop.cropMode==='outline',editingCrop=workshop.cropMode==='edit';
 let start=null,box=null,points=[],pointer=null,moved=false,loupe=null,handle=null,before=null;
 const sync=()=>{
  if(!image.naturalWidth||!stage.isConnected)return;const g=cropGeometry();
  $$('.crop-outline',stage).forEach(el=>placeCropOverlay(el,g));
  $$('.crop-box',stage).forEach((el,i)=>{const r=workshop.crops.filter(r=>!r.points)[i];if(r)el.style.cssText=`left:${g.left+r.x*g.width}px;top:${g.top+r.y*g.height}px;width:${r.w*g.width}px;height:${r.h*g.height}px`;});
  $('.crop-edit-handles',stage)?.remove();
  const r=workshop.crops[workshop.activeCrop];
  if(editingCrop&&r){const ps=r.points||[{x:r.x,y:r.y},{x:r.x+r.w,y:r.y},{x:r.x+r.w,y:r.y+r.h},{x:r.x,y:r.y+r.h}];
   const layer=document.createElement('div');layer.className='crop-edit-handles';
   ps.forEach((p,i)=>{const button=document.createElement('button');button.type='button';button.className='crop-vertex';button.dataset.vertex=i;button.setAttribute('aria-label',`边界点 ${i+1}，方向键微调`);button.style.left=(g.left+p.x*g.width)+'px';button.style.top=(g.top+p.y*g.height)+'px';layer.appendChild(button);});stage.appendChild(layer);
  }
 };
 const pos=(e,clamp=false)=>window.ShiyeSelection.point(e,cropGeometry(),clamp);
 const magnify=p=>{
  if(!loupe){loupe=document.createElement('div');loupe.className='scissor-loupe';loupe.setAttribute('aria-hidden','true');stage.appendChild(loupe);}
  const g=cropGeometry(),px=g.left+p.x*g.width,py=g.top+p.y*g.height,z=2.4;
  loupe.style.cssText=`left:${Math.max(4,Math.min(stage.clientWidth-102,px+24))}px;top:${Math.max(4,Math.min(stage.clientHeight-102,py-115))}px;background-image:url("${workshop.source}");background-size:${g.width*z}px ${g.height*z}px;background-position:${48-p.x*g.width*z}px ${48-p.y*g.height*z}px`;
 };
 const updateVertex=(index,p)=>{
  const r=workshop.crops[workshop.activeCrop];if(!r)return;
  const ps=r.points?clone(r.points):[{x:r.x,y:r.y},{x:r.x+r.w,y:r.y},{x:r.x+r.w,y:r.y+r.h},{x:r.x,y:r.y+r.h}];
  ps[index]=p;workshop.crops[workshop.activeCrop]={...r,...window.ShiyeSelection.bounds(ps)};
  const existing=$$('.crop-outline:not(.scissor-path)',stage)[workshop.crops.slice(0,workshop.activeCrop).filter(c=>c.points).length];
  if(r.points&&existing)$('polygon',existing).setAttribute('points',ps.map(p=>p.x+','+p.y).join(' '));
 };
 stage.onpointerdown=e=>{
  if(e.button!==0||pointer!==null)return;const p=pos(e);if(!p)return;
  if(editingCrop){const target=e.target.closest('[data-vertex]');if(!target)return;handle=Number(target.dataset.vertex);}
  pointer=e.pointerId;start=p;points=[p];moved=false;before=cropSnapshot();
  if(!scissors&&!editingCrop){box=document.createElement('div');box.className='crop-box';stage.appendChild(box);}else magnify(p);
  stage.setPointerCapture(e.pointerId);e.preventDefault();
 };
 stage.onpointermove=e=>{
  if(e.pointerId!==pointer||!start)return;const p=pos(e,true),g=cropGeometry();
  if(Math.hypot((p.x-start.x)*g.width,(p.y-start.y)*g.height)>3)moved=true;
  if(editingCrop){updateVertex(handle,p);const target=$(`[data-vertex="${handle}"]`,stage);if(target){target.style.left=(g.left+p.x*g.width)+'px';target.style.top=(g.top+p.y*g.height)+'px';}magnify(p);}
  else if(scissors){const last=points.at(-1);if(Math.hypot((last.x-p.x)*g.width,(last.y-p.y)*g.height)>2&&points.length<2048)points.push(p);if(moved)paintScissorPath(stage,points);magnify(p);}
  else{const crop={x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),w:Math.abs(p.x-start.x),h:Math.abs(p.y-start.y)};box.style.cssText=`left:${g.left+crop.x*g.width}px;top:${g.top+crop.y*g.height}px;width:${crop.w*g.width}px;height:${crop.h*g.height}px`;box._crop=crop;}e.preventDefault();
 };
 stage.onpointerup=e=>{
  if(e.pointerId!==pointer||!start)return;pointer=null;loupe?.remove();loupe=null;
  if(editingCrop){const r=workshop.crops[workshop.activeCrop];if(moved&&r.w>.005&&r.h>.005)cropCheckpoint(before);else restoreCropSnapshot(before);start=null;renderWorkshop();return;}
  if(scissors){if(moved){const g=cropGeometry();start=null;const simplified=window.ShiyeSelection.simplify(points,g.width,g.height);if(!finishScissors(simplified)){restoreCropSnapshot(before);renderWorkshop();}return;}
   const draft=workshop.scissorPoints||[],p=pos(e,true),g=cropGeometry();
   if(draft.length>=3&&Math.hypot((p.x-draft[0].x)*g.width,(p.y-draft[0].y)*g.height)<16){start=null;finishScissors(draft);return;}
   cropCheckpoint(before);workshop.scissorPoints=[...draft,p];start=null;renderWorkshop();return;
  }
  if(box._crop?.w>.035&&box._crop?.h>.035&&workshop.crops.length<8){cropCheckpoint(before);workshop.crops.push(box._crop);workshop.activeCrop=workshop.crops.length-1;}else toast('请围出更大的区域，最多保留 8 个本地选区');start=null;renderWorkshop();
 };
 stage.onpointercancel=()=>{if(before)restoreCropSnapshot(before);start=null;pointer=null;loupe?.remove();renderWorkshop();};
 stage.onkeydown=e=>{const button=e.target.closest('[data-vertex]');if(!button||!e.key.startsWith('Arrow'))return;e.preventDefault();const index=Number(button.dataset.vertex),g=cropGeometry(),r=workshop.crops[workshop.activeCrop],ps=r.points||[{x:r.x,y:r.y},{x:r.x+r.w,y:r.y},{x:r.x+r.w,y:r.y+r.h},{x:r.x,y:r.y+r.h}],p={...ps[index]},step=e.shiftKey?8:2;
  cropCheckpoint();p.x=Math.max(0,Math.min(1,p.x+(e.key==='ArrowRight'?step/g.width:e.key==='ArrowLeft'?-step/g.width:0)));p.y=Math.max(0,Math.min(1,p.y+(e.key==='ArrowDown'?step/g.height:e.key==='ArrowUp'?-step/g.height:0)));updateVertex(index,p);renderWorkshop();$(`[data-vertex="${index}"]`)?.focus();
 };
 const ready=()=>{if(scissors&&workshop.scissorPoints?.length)paintScissorPath(stage,workshop.scissorPoints);sync();};
 image.onload=ready;if(image.complete&&image.naturalWidth)ready();
 resizeObserver?.disconnect();resizeObserver=new ResizeObserver(sync);resizeObserver.observe(stage);
}
async function cropResults(){
 const img=await readImage(workshop.source),results=[];
 for(const [i,r] of workshop.crops.entries()){
  const sx=Math.max(0,r.x*img.width),sy=Math.max(0,r.y*img.height),ex=Math.min(img.width,(r.x+r.w)*img.width),ey=Math.min(img.height,(r.y+r.h)*img.height);
  if(ex-sx<4||ey-sy<4)continue;const c=document.createElement('canvas');c.width=Math.round(ex-sx);c.height=Math.round(ey-sy);const ctx=c.getContext('2d');
  if(r.points){ctx.beginPath();r.points.forEach((p,i)=>{const x=(p.x*img.width-sx)*c.width/(ex-sx),y=(p.y*img.height-sy)*c.height/(ey-sy);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.closePath();ctx.clip();}
  ctx.drawImage(img,sx,sy,ex-sx,ey-sy,0,0,c.width,c.height);results.push({id:uid(),src:c.toDataURL('image/png'),name:`照片里的片刻 ${i+1}`,category:'照片'});
 }
 if(!results.length)throw new Error('empty crop');return results;
}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state)saveNow();});
async function init(){
 $('#app').innerHTML='<div class="loading-screen">拾页 SHIYE</div>';
 try{
  db=await new Promise((resolve,reject)=>{const req=indexedDB.open('shiye-concept-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('data');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  // Atomically initialise only a genuinely empty workspace; preserve legacy rows as-is.
  state=await new Promise((resolve,reject)=>{
   const tx=db.transaction('data','readwrite'),store=tx.objectStore('data');let value,error;
   tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(error||tx.error);tx.onabort=()=>reject(error||tx.error);
   const req=store.get('workspace');
   req.onsuccess=()=>{try{value=req.result;if(!value){value=seed();store.put(value,'workspace');}}catch(e){error=e;tx.abort();}};
  });
  savedWorkspace=clone(state);
  await hydrateBlobAssets(state);
 }catch{state=seed();savedWorkspace=null;saveStatus='保存失败，请重试';}
 render();if(!savedWorkspace)toast('浏览器存储不可用，本次改动无法持久保存。');
}
async function saveSegmentedAssets(results,use){
 if(savingStickers)return false;savingStickers=true;
 const origin=workshopOrigin,ids=results.map(r=>r.id),version=navigationVersion;
 try{
  for(const r of results){
   if(state.assets.some(a=>a.id===r.id))continue;
   const blobKey='blob:'+r.id;
   pendingAssetBlobs.set(blobKey,r.blob);
   assetURLs.set(blobKey,URL.createObjectURL(r.blob));
   state.assets.push({id:r.id,name:r.name,category:r.category,blobKey,border:r.border,borderBaked:true,width:r.width,height:r.height,provenance:r.provenance});
  }
  mutationVersion++;
  if(!(await saveNow()))return false;
  if(version!==navigationVersion||currentView!=='workshop')return true;
  currentView='collection';collectionTab='mine';filter='全部';search='';render();
  if(use){const book=state.books.find(b=>b.id===origin?.bookId),page=book?.pages.findIndex(p=>p.id===origin.pageId);
   if(book&&page>=0){book.page=page;await openBook(book.id,true);insertStickers(ids);}
   else chooseCreation(ids);
  }else toast(`${ids.length} 枚${results.every(r=>r.provenance.mock)?'模拟':''}贴纸已收入收藏`);
  return true;
 }finally{savingStickers=false;}
}
segmentedWorkshop=window.ShiyeSegmentation?.({esc,shell,toast,visible:()=>currentView==='workshop',origin:()=>workshopOrigin,restoreOrigin:origin=>{if(!workshopOrigin)workshopOrigin=origin;},renderLegacy:renderWorkshop,save:saveSegmentedAssets,completed:id=>savedWorkspace?.assets.some(a=>a.provenance?.imageSessionId===id)||false});
init();
