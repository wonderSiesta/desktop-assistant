import test from 'node:test'
import assert from 'node:assert/strict'
import {createCollector} from '../electron/capture-collector.mjs'
function picture(value){return {isEmpty:()=>!value,toPNG:()=>Buffer.from(value),getSize:()=>({width:1200,height:800}),resize(){return {toDataURL:()=>value}}}}
function setup(){let current=picture('before-start'),fail=false;const images=[],errors=[];const store={settings:{enabled:true},add:async data=>{if(fail)throw new Error('disk full');images.push(data.toString());return data},configure:async patch=>Object.assign(store.settings,patch)};const collector=createCollector({store,readImage:()=>current,onChange:()=>{},onError:e=>errors.push(e)});return {collector,store,images,errors,set:value=>{current=picture(value)},fail:()=>{fail=true}}}
test('captures sequential images, ignores pre-start clipboard and repeated own-copy updates',async()=>{
  const f=setup();f.collector.baseline();await f.collector.poll();assert.deepEqual(f.images,[])
  f.set('one');await f.collector.poll();f.set('two');await f.collector.poll();assert.deepEqual(f.images,['one','two'])
  f.collector.ownCopy(picture('one'));f.set('one');await f.collector.poll();await f.collector.poll();assert.deepEqual(f.images,['one','two'])
  f.set('three');await f.collector.poll();assert.equal(f.images.length,3)
})
test('paused clipboard content is not imported on resume; explicit import still works',async()=>{
  const f=setup();f.collector.baseline();f.store.settings.enabled=false;f.set('paused');await f.collector.poll();assert.equal(f.images.length,0)
  f.collector.baseline();f.store.settings.enabled=true;await f.collector.poll();assert.equal(f.images.length,0)
  await f.collector.importCurrent();assert.deepEqual(f.images,['paused'])
})
test('storage failure pauses capture and surfaces the error instead of silently dropping originals',async()=>{
  const f=setup();f.fail();await f.collector.poll();assert.equal(f.store.settings.enabled,false);assert.equal(f.errors[0].message,'disk full');assert.deepEqual(f.images,[])
})
test('pet success notification fires after persistence and never on duplicate reads or save failures',async()=>{
  const events=[];let fail=false,current=picture('image A')
  const store={settings:{enabled:true},add:async()=>{events.push('saved');if(fail)throw new Error('full');return {id:'one'}},configure:async patch=>Object.assign(store.settings,patch)}
  const collector=createCollector({store,readImage:()=>current,onChange:()=>events.push('changed'),onError:()=>events.push('error'),onSaved:()=>events.push('pet-notified')})
  await collector.poll();assert.deepEqual(events,['saved','pet-notified','changed'])
  await collector.poll();assert.equal(events.length,3)
  fail=true;current=picture('image B');await collector.poll();assert.deepEqual(events.slice(3),['saved','error','changed'])
})

test('1000 unchanged sequence checks perform no additional image reads or PNG encodes',async()=>{
  let revision='1',reads=0,encodes=0
  const image={...picture('large screenshot'),toPNG:()=>{encodes++;return Buffer.from('large screenshot')}}
  const collector=createCollector({store:{settings:{enabled:true}},readImage:()=>{reads++;return image},readRevision:()=>revision,onChange:()=>{},onError:e=>{throw e}})
  collector.baseline()
  for(let i=0;i<1000;i++)await collector.poll()
  assert.equal(reads,1);assert.equal(encodes,1)
  // A clipboard sequence can change while the actual image stays the same.
  revision='2';await collector.poll();assert.equal(reads,2);assert.equal(encodes,2)
})

test('drag suspension leaves a changed revision pending until release',async()=>{
  let revision='1',current=picture('old'),reads=0
  const images=[],store={settings:{enabled:true},add:async png=>{images.push(png.toString());return {id:'new'}}}
  const collector=createCollector({store,readImage:()=>{reads++;return current},readRevision:()=>revision,onChange:()=>{},onError:e=>{throw e}})
  collector.baseline();collector.setSuspended(true);revision='2';current=picture('during drag')
  for(let i=0;i<100;i++)await collector.poll()
  assert.equal(reads,1);assert.deepEqual(images,[])
  collector.setSuspended(false);await collector.poll();await collector.poll()
  assert.deepEqual(images,['during drag']);assert.equal(reads,2)
  collector.setSuspended(true);collector.setSuspended(false);await collector.poll()
  assert.equal(reads,2)
})

test('locked clipboard is retried without consuming the revision; lost helper falls back',async()=>{
  let revision='1',locked=true,reads=0
  const errors=[],images=[],store={settings:{enabled:true},add:async png=>{images.push(png.toString());return {id:'new'}}}
  const collector=createCollector({store,readRevision:()=>revision,readImage:()=>{reads++;if(locked)throw new Error('locked');return picture('new')},onChange:()=>{},onError:e=>errors.push(e)})
  await collector.poll();assert.equal(errors.length,1)
  locked=false;await collector.poll();assert.equal(reads,2);assert.deepEqual(images,['new'])
  revision=null;await collector.poll();assert.equal(reads,3)
  revision='1';await collector.poll();assert.equal(reads,4)
  assert.deepEqual(images,['new'])
})

test('an in-flight save is not re-encoded by overlapping polling ticks',async()=>{
  let release,reads=0
  const done=new Promise(resolve=>{release=resolve})
  const collector=createCollector({store:{settings:{enabled:true},add:async()=>{await done;return {id:'one'}}},readImage:()=>{reads++;return picture('image')},onChange:()=>{},onError:e=>{throw e}})
  const first=collector.poll();await collector.poll();await collector.poll()
  assert.equal(reads,1);release();await first
})
