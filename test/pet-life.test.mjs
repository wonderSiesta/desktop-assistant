import test from 'node:test'
import assert from 'node:assert/strict'
import {createPetLife,reactPet,petLifeSave} from '../electron/pet-life.mjs'
test('sleep and wake are independent of collection and preserve relationship across restart',()=>{
  const life=createPetLife({},1000)
  reactPet(life,'pat',2000);reactPet(life,'sleep',3000)
  assert.equal(life.sleeping,true);assert.equal(life.affection,21)
  const restored=createPetLife(petLifeSave(life),4000)
  assert.equal(restored.sleeping,true);reactPet(restored,'pat',5000)
  assert.equal(restored.sleeping,false);assert.equal(restored.action,'wake')
})
test('rapid clicks cannot farm affection; feeding restores energy and exhausted play rests',()=>{
  const life=createPetLife({energy:0},1000)
  reactPet(life,'play',2000);assert.equal(life.action,'doze');assert.equal(life.energy,0)
  assert.equal(reactPet(life,'feed',2100),false)
  reactPet(life,'feed',3000);assert.equal(life.energy,15)
  reactPet(life,'play',4000);assert.equal(life.energy,7)
  assert.equal(life.affection,24)
})
test('idle actions never wake a sleeping pet or change saved stats; invalid actions are rejected',()=>{
  const life=createPetLife({},1000),before=petLifeSave(life)
  assert.equal(reactPet(life,'idle',10000),false)
  assert.equal(reactPet(life,'idle',40000),true);assert.equal(life.action,'stretch')
  reactPet(life,'idle',200000);assert.equal(life.action,'doze')
  assert.deepEqual(petLifeSave(life),before)
  reactPet(life,'sleep',201000);assert.equal(reactPet(life,'idle',250000),false)
  assert.equal(reactPet(life,'unknown',260000),false)
  const normalized=createPetLife({affection:900,energy:-1});assert.equal(normalized.affection,100);assert.equal(normalized.energy,0)
})
