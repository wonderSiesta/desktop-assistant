import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {inspectSkin,saveSkin,readSkin} from '../electron/pet-skin.mjs'
test('accepts default PNG and rejects oversized files, unsupported formats and excessive dimensions',async()=>{
  const image=await readFile('src/assets/whale-girl.png'),info=inspectSkin(image)
  assert.equal(info.mime,'image/png');assert.equal(info.width,288);assert.equal(info.height,288)
  assert.throws(()=>inspectSkin(Buffer.from('<svg onload="bad()"></svg>')),/无法识别/)
  assert.throws(()=>inspectSkin(Buffer.alloc(10*1024*1024+1)),/10 MB/)
  const oversized=Buffer.from(image);oversized.writeUInt32BE(5000,16);assert.throws(()=>inspectSkin(oversized),/4096/)
})
test('GIF support preserves animation bytes without re-encoding',()=>{
  const gif=Buffer.from('47494638396102000300800000000000ffffff2c00000000020003000002024401003b','hex')
  const info=inspectSkin(gif);assert.equal(info.mime,'image/gif');assert.equal(info.width,2);assert.equal(info.height,3)
})
test('custom images persist under anonymous content hashes and traversal cannot read arbitrary files',async()=>{
  const root=path.resolve('data','tests');await mkdir(root,{recursive:true});const directory=await mkdtemp(path.join(root,'skin-'));assert.equal(path.dirname(directory),root)
  try{
    const image=await readFile('src/assets/whale-girl.png'),saved=await saveSkin(directory,image)
    assert.match(saved.key,/^[a-f0-9]{64}\.png$/);assert.equal(await readSkin(directory,saved.key),saved.dataUrl)
    await assert.rejects(readSkin(directory,'../../private.png'),/无效/)
    await writeFile(path.join(directory,saved.key),Buffer.from('broken'));await assert.rejects(readSkin(directory,saved.key))
  }finally{await rm(directory,{recursive:true,force:true})}
})
