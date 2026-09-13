import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { Works } from '../works.js';
import { LocalWorkObjects,LocalWorkRepository } from '../work-storage.js';
import { workspaceDocument,bookPackage,packageImages,workspaceImages } from '../../shared/works.js';
function fixture(imageId:string){return workspaceDocument.parse({schemaVersion:1,books:[{id:'cover-book',title:'封面手账',cover:'cream',page:0,pages:[{id:'inner',paper:'plain',elements:[]}],coverDesign:{id:'front',paper:'plain',color:'#eeddaa',material:'cloth',titleId:'title',titleVisible:false,elements:[{id:'title',type:'text',text:'封面手账',size:32,bold:true,color:'#334455',x:10,y:10,w:80,rotation:0},{id:'photo',type:'photo',image:{imageId},x:0,y:0,w:100,rotation:0,crop:{aspect:420/540,zoom:1.5,x:30,y:60}},{id:'sticker',type:'sticker',assetId:'archived',x:50,y:50,w:20,rotation:15}]}}],assets:[],archivedAssets:[{id:'archived',name:'封面仍在使用',category:'照片',image:{imageId}}]});}
test('cover-only image and archived sticker survive workspace save/restart and book export',async()=>{
 const root=await mkdtemp(join(tmpdir(),'shiye-cover-works-'));
 try{const repository=new LocalWorkRepository(join(root,'metadata')),objects=new LocalWorkObjects(join(root,'objects')),works=new Works(repository,objects,async()=>true),owner=randomUUID(),imageId=randomUUID(),content=fixture(imageId);
 await works.upload(owner,imageId,await sharp({create:{width:64,height:64,channels:4,background:'green'}}).png().toBuffer());
 await works.saveWorkspace(owner,{operationId:randomUUID(),baseRevision:0,content});
 const fresh=new Works(repository,objects,async()=>true),saved=await fresh.get(owner,'cover-book');
 assert.deepEqual(saved.content.book.coverDesign,content.books[0].coverDesign);assert.equal(saved.content.book.pages.length,1);assert.equal(saved.content.assets[0].id,'archived');assert.deepEqual(packageImages(saved.content).ids,[imageId]);assert.deepEqual(workspaceImages(content).ids,[imageId]);
 await assert.rejects(fresh.get(randomUUID(),'cover-book'));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('cover references reject invalid crossings, duplicates, missing assets, and unsafe crop values',()=>{
 const content=fixture(randomUUID()),base={schemaVersion:1,book:content.books[0],assets:content.archivedAssets};assert.equal(bookPackage.safeParse(base).success,true);
 const changed=(fn:(v:any)=>void)=>{const v=structuredClone(base);fn(v);assert.equal(bookPackage.safeParse(v).success,false);};
 changed(v=>v.book.coverDesign.elements[2].spreadWith='inner');changed(v=>v.book.pages[0].elements.push({...v.book.coverDesign.elements[0]}));changed(v=>v.assets=[]);changed(v=>v.book.coverDesign.elements[1].crop.zoom=99);changed(v=>v.book.coverDesign.id='inner');changed(v=>v.book.coverDesign.color='url(bad)');
});
