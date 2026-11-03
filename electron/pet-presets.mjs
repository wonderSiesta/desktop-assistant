export const PET_PRESETS=[
  {id:'shenshen',name:'鲸鱼娘 · 深深',description:'10 段透明角色动画',kind:'video',folder:'shenshen'},
  {id:'fox',name:'小狐狸',description:'像素动画 · 摸摸与玩球',kind:'gif',folder:'fox'},
  {id:'duck',name:'小黄鸭',description:'像素动画 · 摆头与玩球',kind:'gif',folder:'rubber-duck'},
  {id:'crab',name:'小螃蟹',description:'像素动画 · 挥钳与玩球',kind:'gif',folder:'crab'},
  {id:'classic',name:'静态鲸鱼娘',description:'角色预览图 · 弹性反馈',kind:'image',folder:''}
]
export function presetId(key){if(!key||key==='default')return 'shenshen';return key.startsWith('builtin:')&&PET_PRESETS.some(p=>p.id===key.slice(8))?key.slice(8):null}
export function animationFor(id,{sleeping=false,held=false,motion=true,action='idle',serial=0,phase='idle'}={}){
  if(!motion)return 'idle'
  if(id==='shenshen'){
    if(held)return 'drag'
    if(sleeping)return 'sleep'
    if(action==='pat')return serial%2?'pat':'wave'
    if(['feed','play','wake','stretch'].includes(action))return action
    if(action==='land'||phase==='happy'&&action==='idle')return 'happy'
    if(action==='doze')return 'sleep'
    return 'idle'
  }
  if(sleeping||action==='doze')return id==='fox'?'lie':'idle'
  if(held||action==='pat'||action==='wake')return 'swipe'
  if(action==='play'||action==='feed'||phase==='happy')return 'with_ball'
  return 'idle'
}
