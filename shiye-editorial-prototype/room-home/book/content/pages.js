const box=(x,y,w,html,cls='',extra='')=>`<div class="piece ${cls}" style="left:${x}px;top:${y}px;width:${w}px;${extra}">${html}</div>`;
const sticker=(id,x,y,w,h)=>`<img class="sticker" src="assets/sticker-${id}.svg" alt="${({flower:'小野花',leaf:'叶子',camera:'相机',coffee:'咖啡',ticket:'慢生活车票',stamp:'山野邮票',orange:'橘子'})[id]||'装饰贴纸'}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">`;
const photo=(src,x,y,w,h,caption='')=>`<figure class="photo" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;margin:0"><img src="assets/${src}" alt="${caption||'生活照片'}"><figcaption>${caption}</figcaption></figure>`;
const heading=(eyebrow,title)=>box(38,35,342,`<small>${eyebrow}</small><h2 style="margin-top:13px">${title}</h2>`);
const page=(paper,name,title,html)=>({paper,name,title,html});
const chapters=[
 {title:'从这里开始',purpose:'先用一句话说明拾页，再以目录邀请继续翻阅。保持原书安静、自然的气质。',paperNote:'左：棉纸 cotton；右：米白亚麻 texture-0476。织纹上垫浅色纸片，保证文字清楚。',pages:[
  page('cotton','棉纸','拾页',box(40,42,340,'<small>SHIYE · 私人生活收藏册</small>')+box(46,135,315,'<h2 style="font-size:68px;letter-spacing:10px">拾页</h2><h3>把日子，慢慢收好。</h3>')+box(46,322,300,'<p>从照片里拾起喜欢的片刻，<br>做成贴纸，配上纸张与文字，<br>收进只属于你的数字手帐。</p>','body-copy')+sticker('leaf',282,300,106,160)+box(46,475,295,'<small>每一页，都是你看待生活的方式。</small>')),
  page('texture-linen','米白亚麻','这本书里有什么',box(42,62,336,'<small>此间，收藏生活。</small><h3 style="margin:17px 0">这本书里，<br>有一些小事。</h3><div class="rule"></div><p>一张照片的另一种模样　03</p><p>走远一点，看云和山　　05</p><p>一杯咖啡的时间　　　　07</p><p>和它们待在一起　　　　09</p><p>给未来的自己　　　　　11</p><p>为心情挑一张纸　　　　13</p><p>下一页，留给你　　　　15</p>','note-card toc','font-size:15px;line-height:1.6')+sticker('flower',289,421,79,102))
 ]},
 {title:'照片变贴纸',purpose:'用项目现有湖景原图与透明景物素材说明“照片 → 贴纸 → 手帐”。这是内容示意，不调用抠图服务。',paperNote:'左：奶油空白 plain；右：云白纤维 texture-0521。对照清楚，透明轮廓落在纸上更有手作感。',pages:[
  page('plain','奶油空白','从一张照片开始',heading('01 / 收集','从一张照片开始。')+photo('lake.jpg',36,153,348,265,'那天，船慢慢驶向山里。')+box(42,442,330,'<p>相册里的一次旅行，<br>也可以成为下一页的开始。</p>','body-copy')),
  page('texture-cloud','云白纤维','把喜欢的部分留下',heading('02 / 留下','把喜欢的部分留下。')+`<img class="sticker" src="assets/home-landscape-sticker.png" alt="项目已有的透明湖景贴纸示例" style="left:25px;top:153px;width:370px;height:260px">`+box(42,419,335,'<p>做成贴纸，收入自己的收藏。<br>再配一句话，让片刻有了页码。</p>','body-copy')+box(42,490,330,'<small>照片 → 贴纸 → 你的手帐</small>'))
 ]},
 {title:'山野与旅程',purpose:'旅行示例：风景大图与途中随记形成呼应，延续你提供的山脉、旅程两张图片。',paperNote:'左：鼠尾草纸 texture-0454；右：邮戳信笺 postmark。绿色衬山野，信笺承载途中感受。',pages:[
  page('texture-sage','鼠尾草纸','云很低，山很近',heading('03 / 山野来信','云很低，山很近。')+photo('mountains.jpg',40,150,338,299,'没有赶路，只看云越过山顶。')+box(45,467,325,'<p>走到风里，心也跟着松了一点。</p>','hand body-copy')),
  page('postmark','邮戳信笺','路上的一页',heading('TRAVEL NOTES','路上的一页。')+photo('journey.jpg',45,157,260,206,'一切终有回甘。')+sticker('ticket',281,278,96,124)+box(47,393,315,'<p>记住的不是走了多远，<br>是那扇窗外，忽然出现的山。</p>','hand body-copy')+box(47,474,325,'<small>有些风景，值得慢慢翻回来。</small>'))
 ]},
 {title:'慢慢过日常',purpose:'展示低门槛日常记录：一张照片、一枚咖啡贴纸、几行文字就能成页。清单是手帐文案，不是新增待办功能。',paperNote:'左：浅牛皮纸 kraft；右：方格纸 grid。暖色适合咖啡，方格适合短句与小清单。',pages:[
  page('kraft','浅牛皮纸','把下午留长一点',heading('04 / 普通日子的光','把下午留长一点。')+photo('coffee.jpg',38,155,341,238,'一杯咖啡，一段没有安排的时间。')+sticker('coffee',266,346,123,132)+box(44,432,218,'<p>今天没有特别的事。<br>但阳光刚好，咖啡也刚好。</p>','hand body-copy')),
  page('grid','方格纸','今天的小确幸',heading('LITTLE JOYS','今天的小确幸。')+box(44,165,327,'<ul class="checklist"><li>喝到喜欢的咖啡</li><li>给窗边的植物浇水</li><li>绕一点路，慢慢回家</li><li>把这一刻收进手帐</li></ul>','body-copy')+sticker('orange',266,390,91,110)+box(46,430,218,'<p>日子不必特别，<br>也值得认真收藏。</p>','hand body-copy'))
 ]},
 {title:'毛孩子日记',purpose:'加入宠物陪伴主题，使用你提供的小狗和小羊图片。保留图片本身的样貌，以相片和短句组合。',paperNote:'左：浅绿织纹 texture-0485；右：植物边饰 botanical。织纹增加温度，右页轻装饰给主体留白。',pages:[
  page('texture-weave','浅绿织纹','阳光正好',heading('05 / 和它们在一起','阳光正好。')+photo('dogs.jpg',35,151,350,300,'最擅长的事：把普通日子过得很开心。')+box(43,473,330,'<p>躺一会儿，也算认真生活。</p>','hand body-copy')),
  page('botanical','植物边饰','一起发会儿呆',heading('SOFT LITTLE MOMENTS','一起发会儿呆。')+photo('sheep.jpg',50,168,320,214,'不着急，今天可以慢一点。')+box(50,415,318,'<p>不用每一天都很厉害。<br>有时候，被陪着就很好。</p>','hand body-copy')+box(52,489,280,'<small>把熟悉的小小身影，留在书里。</small>'))
 ]},
 {title:'写给自己',purpose:'留一组以文字为主的书页，让用户知道拾页也容得下私人感受；用松一点的留白调整翻阅节奏。',paperNote:'左：旧信纸 letter；右：旧玫瑰纸 texture-0344。旧信纸承载长一点的文字，灰粉纸衬一句安静的话。',pages:[
  page('letter','旧信纸','给以后的我',heading('06 / 一封慢信','给以后的我：')+box(44,170,324,'<p>如果你又翻到了这一页，<br>希望你还记得，<br>那时也有很多细小的快乐。</p><p>一段散步，一顿热饭，<br>一个可以安心说话的人。</p><p>不用把每一天写得漂亮，<br>写得像自己，就已经很好。</p>','hand body-copy','line-height:2.1')+box(258,466,112,'此刻的我','hand','font-size:20px')),
  page('texture-rose','旧玫瑰纸','为自己留一点空白',box(48,83,320,'<small>A NOTE TO MYSELF</small>')+box(61,197,296,'<h2>慢一点，<br>也没有关系。</h2><div class="rule"></div><p>不是每一页都要填满。<br>给心情留一点空白，<br>也给下一次回来留一个位置。</p>','note-card body-copy')+sticker('flower',263,411,105,105))
 ]},
 {title:'纸张的性格',purpose:'集中展示已有纸库的丰富度：一页选纸小样，一页深色纸成品。避免每页都堆装饰，同时让深色纸的用途一眼可见。',paperNote:'左：棉纸 cotton，搭配六款真实纸样；右：墨色长纤 texture-0527，使用浅色文字与留白。当前纸库共有 7 类、67 种。',pages:[
  page('cotton','棉纸与六款纸样','为心情挑一张纸',heading('07 / 纸张也有性格','为心情挑一张纸。')+box(40,155,340,`<div class="swatches">${[['dots','细点纸'],['texture-sage','鼠尾草纸'],['texture-linen','米白亚麻'],['texture-blue','雾蓝砂纹'],['letter','旧信纸'],['texture-rose','旧玫瑰纸']].map(([cls,name])=>`<div class="paper swatch ${cls}"><span>${name}</span></div>`).join('')}</div>`)+box(42,493,336,'<small>不同的纸，收下不同心情。</small>')),
  page('texture-dark','墨色长纤','夜色也可以很温柔',box(43,44,328,'<small>AFTER THE DAY</small>')+box(55,166,310,'<h2 style="font-size:38px">夜色，<br>也可以很温柔。</h2><p style="margin-top:35px">把白天没说完的话，<br>留在这一页。<br>等明天，再轻轻翻过去。</p>','body-copy')+box(54,460,313,'<div class="rule" style="background:#e1d9b77a"></div><small>今天就到这里。晚安。</small>'))
 ]},
 {title:'下一页是你',purpose:'用私人书架收束故事，再留一页邀请用户创作。末页先审文案与构图；未来接入时才绑定创建手帐入口。',paperNote:'左：云白纤维 texture-0521；右：细点纸 dots。用清淡纸面结束，让用户自己的内容成为主角。',pages:[
  page('texture-cloud','云白纤维','把日子放回书架',heading('08 / 私人收藏','把日子放回书架。')+box(42,177,337,'<div class="shelf"><div class="tiny-book texture-sage">山野<br>来信</div><div class="tiny-book kraft">平凡<br>日常</div><div class="tiny-book texture-rose">写给<br>自己</div></div>')+box(46,361,325,'<p>一本放旅行，一本放日常。<br>把喜欢的照片、贴纸和文字收好。</p><p>下次回来，再翻一翻，<br>也可以接着写。</p>','body-copy')),
  page('dots','细点纸','下一页，留给你',heading('YOUR STORY BEGINS HERE','下一页，留给你。')+box(61,176,298,'放一张喜欢的照片<br><span style="font-size:31px;font-weight:200">＋</span>','empty-frame','height:203px')+box(59,415,304,'<p>不必等一场盛大的旅行。<br>今天，就有值得留下的片刻。</p>','body-copy')+box(59,488,304,'从一张喜欢的照片开始 →','hand','font-size:17px;color:#576746'))
 ]}
];

export {chapters};
