import boardData from './board-geometry.js';
import * as THREE from '../assets/room-custom-photos.js';

const W=2.12,H=2.91,SEGMENTS=40,ROWS=12;
function roundedBoard(){
  const geometry=new THREE.BufferGeometry();
  for(const [key,value] of Object.entries(boardData))geometry.setAttribute(key,new THREE.BufferAttribute(new Float32Array(value.array),value.itemSize));
  return geometry;
}
export class Book {
  constructor(textures,decorate){
    this.count=textures.pages.length/2;
    if(!Number.isInteger(this.count)||this.count<1)throw Error('书页必须包含完整正反面');
    this.root=new THREE.Group();this.root.rotation.y=0;this.open=0;this.turns=Array(this.count).fill(0);this.textures=textures;this.sheets=[];
    const material=(options)=>decorate(new THREE.MeshStandardMaterial({roughness:.94,...options}));
    const cloth=material({map:textures.cloth,bumpMap:textures.cloth,bumpScale:.012});
    this.cover=new THREE.Group();this.root.add(this.cover);
    const shell=new THREE.Mesh(roundedBoard(W+.045,H+.08),cloth);shell.castShadow=shell.receiveShadow=true;shell.userData.kind='cover';this.cover.add(shell);
    const plane=(map,side=THREE.FrontSide)=>{
      const m=material({map,side});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(W+.025,H+.06),m);mesh.rotation.x=-Math.PI/2;mesh.position.x=(W+.045)/2;mesh.castShadow=mesh.receiveShadow=true;return mesh;
    };
    const face=plane(textures.cover);face.position.y=.04;face.userData.kind='cover';this.cover.add(face);
    const mirrored=textures.lining.clone();mirrored.repeat.x=-1;mirrored.offset.x=1;
    const inside=plane(mirrored,THREE.BackSide);inside.position.y=-.04;inside.userData.kind='left';this.cover.add(inside);
    const back=new THREE.Mesh(roundedBoard(W+.045,H+.08),cloth);back.position.y=.038;back.castShadow=back.receiveShadow=true;this.root.add(back);
    const endpaper=(map,side)=>{
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(W-.055,H-.055),material({map}));
      mesh.rotation.x=-Math.PI/2;mesh.position.set(side*(.055+(W-.055)/2),.168,0);mesh.userData.kind=side<0?'left':'right';this.root.add(mesh);return mesh;
    };
    this.firstPaper=endpaper(textures.frontLining||textures.lining,-1);
    endpaper(textures.backLining||textures.lining,1);
    const edgeM=material({map:textures.edge,color:'#ede3c5'});
    const block=new THREE.Mesh(new THREE.BoxGeometry(W-.045,.10,H-.045),[edgeM,edgeM,material({color:'#e8dec3'}),edgeM,edgeM,edgeM]);block.position.set(W/2,.105,0);block.receiveShadow=block.castShadow=true;this.root.add(block);
    this.leftBlock=new THREE.Mesh(new THREE.BoxGeometry(W-.055,.068,H-.055),[edgeM,edgeM,material({color:'#e8dec3'}),edgeM,edgeM,edgeM]);
    this.leftBlock.position.set(-(.055+(W-.055)/2),.13,0);this.root.add(this.leftBlock);
    // A rounded fabric spine remains visible along the binding.
    const spine=new THREE.Mesh(new THREE.CylinderGeometry(.139,.139,H+.06,20),cloth);spine.rotation.x=Math.PI/2;spine.position.set(.003,.16,0);spine.scale.x=.48;spine.castShadow=spine.receiveShadow=true;this.root.add(spine);this.spine=spine;
    const ribbonGeo=new THREE.PlaneGeometry(.09,.6,1,12);ribbonGeo.rotateX(-Math.PI/2);
    const rp=ribbonGeo.attributes.position;for(let i=0;i<rp.count;i++){const z=rp.getZ(i);rp.setY(i,.04*Math.cos(z*7));}ribbonGeo.computeVertexNormals();
    const ribbon=new THREE.Mesh(ribbonGeo,material({color:'#a05c35',side:THREE.DoubleSide}));ribbon.position.set(W*.79,.06,H/2+.18);ribbon.castShadow=ribbon.receiveShadow=true;this.root.add(ribbon);
    for(let i=0;i<this.count;i++){
      const geo=new THREE.PlaneGeometry(W-.055,H-.055,SEGMENTS,ROWS);
      const front=new THREE.Mesh(geo,material({map:textures.pages[i*2],side:THREE.FrontSide}));
      const backMap=textures.pages[i*2+1].clone();backMap.repeat.x=-1;backMap.offset.x=1;
      const reverse=new THREE.Mesh(geo,material({map:backMap,side:THREE.BackSide}));
      front.castShadow=front.receiveShadow=reverse.castShadow=reverse.receiveShadow=true;
      front.material.shadowSide=THREE.DoubleSide;reverse.material.shadowSide=THREE.DoubleSide;
      front.userData.kind=reverse.userData.kind='page';front.userData.sheet=reverse.userData.sheet=i;
      this.root.add(front,reverse);this.sheets.push({geo,front,reverse});
    }
    // Small local contact shadows avoid expensive scene-wide shadow maps.
    const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
    ctx.filter='blur(7px)';ctx.fillStyle='#000';ctx.fillRect(10,10,108,108);
    const shadowMap=new THREE.CanvasTexture(c);
    this.pageShadows=[-1,1].map(side=>{
      const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicNodeMaterial({map:shadowMap,color:0x000000,transparent:true,opacity:.2,depthWrite:false}));
      m.rotation.x=-Math.PI/2;m.userData.decoration=true;m.visible=false;this.root.add(m);return {mesh:m,side};
    });
    this.update();
  }
  update(){
    this.root.position.x=-W*.5;
    this.cover.position.y=.29*(1-this.open)+.055*this.open;
    this.cover.rotation.z=Math.PI*this.open;
    this.spine.position.y=.16*(1-this.open)+.085*this.open;
    this.spine.scale.z=1-.68*this.open;
    this.firstPaper.visible=this.open>.93;
    this.leftBlock.visible=this.open>.93;
    for(let i=0;i<this.count;i++)this.updateSheet(i);
    this.updateShadows();
  }
  updateSheet(i){
    const t=this.turns[i],sheet=this.sheets[i];sheet.front.visible=sheet.reverse.visible=this.open>.04;
    if(sheet.lastT===t)return;sheet.lastT=t;
    const w=W-.055,h=H-.055,baseY=(.168+(this.count-i)*.004)*(1-t)+(.168+(i+1)*.004)*t;
    const p=sheet.geo.attributes.position,theta=Math.PI*t,flex=Math.sin(Math.PI*t);
    // Integrate each row along its arc length: the free edge leads the binding,
    // and the lower corner leads the upper edge instead of rotating a rigid plane.
    for(let row=0;row<=ROWS;row++){
      const v=row/ROWS;let x=.055*(1-2*t),y=baseY;
      for(let j=0;j<=SEGMENTS;j++){
        const u=j/SEGMENTS;
        if(j){
          const s=(j-.5)/SEGMENTS;
          const bend=1.6*(s-.5)+.42*(v-.5)*s+.14*Math.sin(2*Math.PI*t)*Math.sin(Math.PI*s);
          const angle=Math.max(0,Math.min(Math.PI,theta+flex*bend));
          x+=Math.cos(angle)*w/SEGMENTS;y+=Math.sin(angle)*w/SEGMENTS;
        }
        const binding=.012*Math.sin(u*Math.PI)*Math.exp(-u*3);
        const corner=flex*.07*Math.sin(v*Math.PI)*u*u;
        p.setXYZ(row*(SEGMENTS+1)+j,x,y+binding+corner,-h/2+v*h);
      }
    }
    p.needsUpdate=true;sheet.geo.computeVertexNormals();sheet.geo.computeBoundingSphere();
  }
  updateShadows(){
    const i=this.turns.findIndex(t=>t>.001&&t<.999);
    for(const {mesh} of this.pageShadows)mesh.visible=false;
    if(i<0||this.open<.95)return;
    const p=this.sheets[i].geo.attributes.position;let min=Infinity,max=-Infinity,peak=.2;
    for(let j=0;j<p.count;j++){min=Math.min(min,p.getX(j));max=Math.max(max,p.getX(j));peak=Math.max(peak,p.getY(j));}
    const lift=peak-.2,offset=-lift*.12;
    for(const {mesh,side} of this.pageShadows){
      const left=Math.max(side<0?-W:.055,min+offset-.035),right=Math.min(side<0?-.055:W,max+offset+.035);
      if(right<=left)continue;
      mesh.visible=true;mesh.position.set((left+right)/2,.169+(side<0?i:this.count-i-1)*.004,lift*.05);
      mesh.scale.set(right-left,H-.025,1);mesh.material.opacity=.08+.26*Math.max(0,1-lift/2);
    }
  }
  dispose(){this.root.traverse(o=>{o.geometry?.dispose();if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});}
}
