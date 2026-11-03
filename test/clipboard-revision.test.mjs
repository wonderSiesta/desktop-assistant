import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {createClipboardRevision} from '../electron/clipboard-revision.mjs'

function setup(){
  let invocation,killed=false
  const child=new EventEmitter();child.stdout=new EventEmitter();child.kill=()=>{killed=true;child.emit('exit',0)}
  const monitor=createClipboardRevision({platform:'win32',spawnProcess:(...args)=>{invocation=args;return child}})
  return {monitor,child,get invocation(){return invocation},get killed(){return killed}}
}
test('hidden native sequence helper handles chunked stdout and stops its owned child',async()=>{
  const f=setup(),ready=f.monitor.start()
  try{
    assert.equal(f.invocation[2].windowsHide,true)
    const script=Buffer.from(f.invocation[1].at(-1),'base64').toString('utf16le')
    assert.match(script,/GetClipboardSequenceNumber/);assert.match(script,/HasExited/)
    assert.doesNotMatch(script,/readImage|Get-Clipboard|http/i)
    f.child.stdout.emit('data',Buffer.from('0\r'));f.child.stdout.emit('data',Buffer.from('\n'))
    await ready;assert.equal(f.monitor.read(),'1:0')
    f.child.stdout.emit('data',Buffer.from('noise\r\n12\r\n'));assert.equal(f.monitor.read(),'1:12')
    f.monitor.stop();assert.equal(f.killed,true);assert.equal(f.monitor.read(),null)
  }finally{f.monitor.stop()}
})
test('unavailable native helper falls back and can be shut down cleanly',async()=>{
  const f=setup(),ready=f.monitor.start()
  try{f.child.emit('error',new Error('not available'));await ready;assert.equal(f.monitor.read(),null)}finally{f.monitor.stop()}
})
test('non-Windows systems use fallback without spawning PowerShell',async()=>{
  const monitor=createClipboardRevision({platform:'linux',spawnProcess:()=>{throw new Error('must not spawn')}})
  await monitor.start();assert.equal(monitor.read(),null);monitor.stop()
})
