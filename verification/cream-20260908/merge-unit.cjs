// Pure-function edge cases complement the real IndexedDB/browser regression.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const app=fs.readFileSync(path.resolve(__dirname,'../../shiye-editorial-prototype/app.js'),'utf8');
let serial=0;
const api=vm.runInNewContext(app.slice(app.indexOf('const clone='),app.indexOf('const currentBook ='))+'\n({mergeWorkspace,rebasePending})',{uid:()=>`copy-${++serial}`});
const clone=x=>JSON.parse(JSON.stringify(x));
const seed={version:1,assets:[{id:'asset',name:'original'}],books:[{id:'book',title:'原书',pages:[{id:'page',elements:[]}]}]};
const cases=[];
function test(name,fn){fn();cases.push({name,status:'PASS'});}
test('legacy workspace without revision remains readable',()=>{const r=api.mergeWorkspace(seed,seed,seed);assert.equal(r.merged.revision,1);assert.equal(r.merged.books[0].id,'book');});
test('independent new books merge',()=>{const a=clone(seed),b=clone(seed);a.books.push({id:'a',title:'A'});b.books.push({id:'b',title:'B'});assert.equal(api.mergeWorkspace(seed,a,b).merged.books.length,3);});
test('same book conflict keeps remote and local copy',()=>{const a=clone(seed),b=clone(seed);a.books[0].title='A';b.books[0].title='B';const r=api.mergeWorkspace(seed,a,b);assert.equal(r.merged.books[0].title,'B');assert.equal(r.merged.books[1].title,'A（冲突副本）');assert.equal(r.copies.size,1);});
test('stale delete cannot remove remotely modified book',()=>{const a=clone(seed),b=clone(seed);a.books=[];b.books[0].title='new';assert.throws(()=>api.mergeWorkspace(seed,a,b),/workspace-conflict/);});
test('stale edit after remote delete is preserved as a copy',()=>{const a=clone(seed),b=clone(seed);a.books[0].title='edit';b.books=[];const r=api.mergeWorkspace(seed,a,b);assert.equal(r.merged.books.length,1);assert.notEqual(r.merged.books[0].id,'book');});
test('conflicting asset edit rejects rather than overwrites',()=>{const a=clone(seed),b=clone(seed);a.assets[0].name='A';b.assets[0].name='B';assert.throws(()=>api.mergeWorkspace(seed,a,b),/workspace-conflict/);});
test('changes made during commit remain pending',()=>{const pending=clone(seed);pending.books[0].title='typed while saving';const committed=api.mergeWorkspace(seed,seed,seed);const r=api.rebasePending(seed,pending,committed.merged,committed.copies);assert.equal(r.state.books[0].title,'typed while saving');assert.equal(r.baseline.books[0].title,'原书');});
test('pending edit cannot overwrite newly merged remote book',()=>{const pending=clone(seed),remote=clone(seed);pending.books[0].title='pending';remote.books[0].title='remote';const committed=api.mergeWorkspace(seed,seed,remote);const r=api.rebasePending(seed,pending,committed.merged,committed.copies);assert.equal(r.state.books.length,2);assert.equal(r.state.books[0].title,'remote');assert.equal(r.state.books[1].title,'pending（冲突副本）');const next=api.mergeWorkspace(r.baseline,r.state,committed.merged);assert.equal(next.merged.books.length,2);});
test('pending asset conflict remains blocked on next commit',()=>{const pending=clone(seed),remote=clone(seed);pending.assets[0].name='pending';remote.assets[0].name='remote';const committed=api.mergeWorkspace(seed,seed,remote);const r=api.rebasePending(seed,pending,committed.merged,committed.copies);assert.throws(()=>api.mergeWorkspace(r.baseline,r.state,committed.merged),/workspace-conflict/);});
test('retry after conflict copy does not duplicate copies',()=>{const a=clone(seed),b=clone(seed);a.books[0].title='A';b.books[0].title='B';const first=api.mergeWorkspace(seed,a,b),r=api.rebasePending(a,a,first.merged,first.copies);const next=api.mergeWorkspace(r.baseline,r.state,first.merged);assert.equal(next.merged.books.length,2);assert.equal(next.copies.size,0);});
console.log(JSON.stringify({cases,total:cases.length},null,2));
