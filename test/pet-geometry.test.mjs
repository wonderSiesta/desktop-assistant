import test from 'node:test'
import assert from 'node:assert/strict'
import {fitBounds,anchorFor,restoreAnchor,panelBounds,movedEnough} from '../electron/pet-geometry.mjs'
test('dragging clamps to work area and snaps near edges, including negative monitor coordinates',()=>{
  const area={x:-1920,y:0,width:1920,height:1040},size={width:114,height:114}
  assert.deepEqual(fitBounds({x:-1910,y:934},size,area,20),{x:-1920,y:926,...size})
  assert.deepEqual(fitBounds({x:100,y:-30},size,area),{x:-114,y:0,...size})
})
test('position restores proportionally after resolution and monitor changes without going off-screen',()=>{
  const size={width:114,height:114},old={x:0,y:0,width:1920,height:1040},bounds={x:1806,y:463,...size}
  const anchor=anchorFor(bounds,old,1),next={x:-1280,y:-100,width:1280,height:680}
  const restored=restoreAnchor(anchor,size,next)
  assert.equal(restored.x,-114);assert.equal(restored.y,183)
  const oversized=restoreAnchor(anchor,{width:2000,height:2000},next)
  assert.deepEqual(oversized,{x:-1280,y:-100,width:1280,height:680})
})
test('quick panel flips sides and stays within work area on short displays',()=>{
  const area={x:0,y:0,width:1280,height:720},size={width:364,height:554}
  const right=panelBounds({x:1166,y:606,width:114,height:114},size,area)
  assert.equal(right.x,790);assert.equal(right.y,166)
  const left=panelBounds({x:0,y:0,width:114,height:114},size,area)
  assert.equal(left.x,126);assert.equal(left.y,0)
})
test('small pointer movements stay a click; dragging requires six DIP of movement',()=>{
  assert.equal(movedEnough({x:0,y:0},{x:3,y:4}),false)
  assert.equal(movedEnough({x:0,y:0},{x:6,y:0}),true)
})
