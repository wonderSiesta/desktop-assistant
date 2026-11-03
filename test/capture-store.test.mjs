import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,rm,readFile,writeFile,readdir} from 'node:fs/promises'
import path from 'node:path'
import {CaptureStore} from '../electron/capture-store.mjs'
const png=Buffer.from('89504e470d0a1a0a0000000049454e44ae426082','hex')
async function fixture(run){const root=path.resolve('data','tests');await mkdir(root,{recursive:true});const dir=await mkdtemp(path.join(root,'run-'));assert.equal(path.dirname(dir),root);try{await run(dir)}finally{await rm(dir,{recursive:true,force:true})}}
test('concurrent collection persists more than twenty images and recovers all full-resolution bytes after restart',()=>fixture(async dir=>{
  const store=new CaptureStore(dir);await store.load()
  await Promise.all(Array.from({length:25},()=>store.add(png,'thumbnail',{width:1920,height:1080})))
  assert.equal(store.state().records.length,25)
  const reopened=new CaptureStore(dir);await reopened.load()
  assert.equal(reopened.state().records.length,25)
  assert.deepEqual(await reopened.image(reopened.records[0].id),png)
  assert.equal((await readdir(path.join(dir,'images'))).length,25)
}))
test('trash is reversible, title edits persist, and batch export preserves originals without overwriting',()=>fixture(async dir=>{
  const store=new CaptureStore(path.join(dir,'library'));await store.load()
  const a=await store.add(png,'thumb',{width:400,height:300}),b=await store.add(png,'thumb',{width:400,height:300})
  await store.update([a.id],{deletedAt:Date.now(),title:'First',favorite:true})
  assert.equal(store.records.find(r=>r.id===a.id).favorite,true)
  await store.update([a.id],{deletedAt:null})
  await mkdir(path.join(dir,'exports'));const first=await store.export([a.id,b.id],path.join(dir,'exports')),second=await store.export([a.id],path.join(dir,'exports'))
  assert.equal(first.count,2);assert.notEqual(first.destination,second.destination)
  const names=await readdir(first.destination);assert.deepEqual(await readFile(path.join(first.destination,names[0])),png)
  await store.update([b.id],{deletedAt:Date.now()});await store.emptyTrash()
  assert.equal(store.records.length,1);await assert.rejects(store.image(b.id),/不存在/)
  await assert.rejects(store.image('../../outside'),/不存在/)
}))
test('quota errors do not evict existing images, and invalid input never enters the library',()=>fixture(async dir=>{
  const store=new CaptureStore(dir,png.length);await store.load();await store.add(png,'thumb',{width:1,height:1})
  await assert.rejects(store.add(png,'thumb',{width:1,height:1}),/上限/)
  await assert.rejects(store.add(Buffer.from('not an image'),'thumb',{width:1,height:1}),/PNG/)
  assert.equal(store.records.length,1)
}))
test('corrupt index recovers backup instead of silently discarding history; privacy preferences survive restart',()=>fixture(async dir=>{
  const store=new CaptureStore(dir);await store.load();const image=await store.add(png,'thumb',{width:1,height:1});await store.configure({enabled:false,textEnabled:false})
  await writeFile(path.join(dir,'index.json'),'broken')
  const restored=new CaptureStore(dir);await restored.load()
  assert.equal(restored.records[0].id,image.id);assert.match(restored.warning,/备份/)
  assert.equal(restored.settings.textEnabled,false)
}))
