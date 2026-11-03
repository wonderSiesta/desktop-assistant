import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {PET_PRESETS,presetId,animationFor} from '../electron/pet-presets.mjs'
test('legacy default migrates to animated whale; custom images never resolve as built-in paths',()=>{
  assert.equal(presetId(null),'shenshen');assert.equal(presetId('default'),'shenshen')
  assert.equal(presetId('builtin:classic'),'classic');assert.equal(presetId('builtin:../../secret'),null)
  assert.equal(presetId('a'.repeat(64)+'.png'),null);assert.equal(PET_PRESETS.length,5)
})
test('actual role clips follow interaction, drag and sleep; animation-off always uses idle',()=>{
  assert.equal(animationFor('shenshen',{action:'feed'}),'feed')
  assert.equal(animationFor('shenshen',{action:'play'}),'play')
  assert.equal(animationFor('shenshen',{held:true,sleeping:true}),'drag')
  assert.equal(animationFor('shenshen',{sleeping:true,phase:'happy'}),'sleep')
  assert.equal(animationFor('shenshen',{held:true,motion:false}),'idle')
  assert.notEqual(animationFor('shenshen',{action:'pat',serial:1}),animationFor('shenshen',{action:'pat',serial:2}))
  assert.equal(animationFor('fox',{sleeping:true}),'lie')
  assert.equal(animationFor('duck',{action:'play'}),'with_ball')
})
test('every downloaded animation exactly matches its recorded upstream Git blob',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../scripts/pet-assets-manifest.json',import.meta.url),'utf8'))
  assert.equal(manifest.length,20)
  for(const file of manifest){
    const data=await readFile(new URL('../'+file.destination,import.meta.url))
    assert.equal(data.length,file.size,file.destination)
    assert.equal(createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex'),file.sha,file.destination)
  }
})
