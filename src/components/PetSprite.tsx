import {useEffect,useRef,useState} from 'react'
import type {ReactNode,PointerEvent} from 'react'
import type {PetState} from '../types'
import {presetId} from './PetArtwork'
import {playPetSound,preparePetSound} from '../lib/pet-sound'

export function PetSprite({state,renderArt}:{state:PetState|null;renderArt:(held:boolean,action:string)=>ReactNode}){
  const dragging=useRef(false),suppressClick=useRef(false),ignore=useRef<boolean|null>(null)
  const [reaction,setReaction]=useState(0),[held,setHeld]=useState(false),[action,setAction]=useState('idle')
  const clickTimer=useRef<ReturnType<typeof setTimeout>|null>(null),sleeping=state?.life?.sleeping===true
  const setIgnore=(value:boolean)=>{if(ignore.current!==value){ignore.current=value;window.electronAPI.petIgnore(value)}}
  useEffect(()=>{
    const move=(event:MouseEvent)=>{if(!dragging.current)setIgnore(!(event.target instanceof Element&&event.target.closest('[data-hit]')))}
    const leave=()=>{if(!dragging.current)setIgnore(true)}
    window.addEventListener('mousemove',move);document.documentElement.addEventListener('mouseleave',leave)
    return()=>{window.removeEventListener('mousemove',move);document.documentElement.removeEventListener('mouseleave',leave);if(clickTimer.current)clearTimeout(clickTimer.current)}
  },[])
  useEffect(()=>{if(!reaction)return;const timer=setTimeout(()=>setReaction(0),720);return()=>clearTimeout(timer)},[reaction])
  useEffect(()=>{if(!state?.life?.serial)return;setAction(state.life.action);if(presetId(state.skinKey)==='shenshen')return;const timer=setTimeout(()=>setAction('idle'),2200);return()=>clearTimeout(timer)},[state?.life?.serial,state?.skinKey])
  const interact=async(kind:'pat'|'feed'|'play'|'sleep'|'wake'|'land')=>{
    try{const result=await window.electronAPI.petInteract(kind);if(result.life.serial===state?.life?.serial)return;if(kind!=='land'&&state?.clickSound!==false)playPetSound();setReaction(value=>value+1)}catch{setAction('idle')}
  }
  const click=()=>{if(clickTimer.current){clearTimeout(clickTimer.current);clickTimer.current=null;void window.electronAPI.petToggle();return}clickTimer.current=setTimeout(()=>{clickTimer.current=null;void interact(sleeping?'wake':'pat')},240)}
  const end=async(cancelled=false)=>{
    if(!dragging.current)return
    dragging.current=false;setHeld(false);suppressClick.current=true
    const {moved}=await window.electronAPI.petDragEnd(cancelled);ignore.current=null
    if(cancelled)return
    if(moved){if(clickTimer.current)clearTimeout(clickTimer.current);clickTimer.current=null;void interact('land')}else click()
  }
  useEffect(()=>{const blur=()=>{if(dragging.current)void end(true)};window.addEventListener('blur',blur);return()=>window.removeEventListener('blur',blur)},[state?.clickSound,sleeping])
  const leanDuringDrag=(event:PointerEvent<HTMLButtonElement>)=>{
    if(!dragging.current)return
    const bounds=event.currentTarget.getBoundingClientRect()
    const lean=Math.max(-10,Math.min(10,(event.clientX-bounds.left-bounds.width/2)*.2))
    event.currentTarget.style.setProperty('--drag-lean',lean+'deg')
  }
  const classes=['pet-stage',state?.motion?'has-motion':'',state?.phase==='happy'?'is-happy':'',state?.mirrored?'is-mirrored':'',state?.problem?'has-problem':'',reaction?'is-petted':'',held?'is-held':'',sleeping?'is-sleeping':'','life-'+action,presetId(state?.skinKey)&&presetId(state?.skinKey)!=='classic'?'has-real-animation':''].join(' ')
  return <div className={classes} onContextMenu={event=>{event.preventDefault();window.electronAPI.petMenu()}}>
    <button data-hit className="whale-hit" aria-label="桌宠：单击摸摸，双击打开桌面助手" title="单击摸摸 · 双击打开助手 · 按住拖动搬家" onMouseEnter={()=>setIgnore(false)} onPointerMove={leanDuringDrag} onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();if(state?.clickSound!==false)preparePetSound();dragging.current=true;setHeld(true);suppressClick.current=false;event.currentTarget.setPointerCapture(event.pointerId);window.electronAPI.petDragStart()}} onPointerUp={()=>void end()} onPointerCancel={()=>void end(true)} onLostPointerCapture={()=>{if(dragging.current)void end(true)}} onClick={()=>{if(suppressClick.current){suppressClick.current=false;return}click()}}>
      <div className="pet-pose" key={state?.life?.serial||0}>{renderArt(held,action)}</div>
      {reaction>0&&state?.motion&&<span className="pet-sparkles" key={reaction} aria-hidden="true"><i>✦</i><i>✧</i><i>{action==='feed'?'🐟':'♡'}</i><i>✦</i><i>◦</i></span>}
      {sleeping&&<span className="pet-sleep-mark">z Z</span>}
      {(state?.unread||0)>0&&<span className="pet-badge">{state!.unread>99?'99+':state!.unread}</span>}
      {state?.problem&&<span className="pet-alert">!</span>}
    </button>
    <div className="pet-quick" aria-label="桌宠互动"><button data-hit aria-label="喂小鱼干" title="喂小鱼干" onClick={()=>void interact('feed')}>🐟</button><button data-hit aria-label="一起玩" title="一起玩" onClick={()=>void interact('play')}>✦</button><button data-hit aria-label="打开桌面助手" title="打开桌面助手" onClick={()=>void window.electronAPI.petToggle()}>▤</button></div>
  </div>
}

export function PetCompanion({pet}:{pet:PetState|null}){
  const [error,setError]=useState(''),[busy,setBusy]=useState(false)
  if(!pet?.life)return null
  const act=async(action:'pat'|'feed'|'play'|'sleep'|'wake')=>{setBusy(true);setError('');try{await window.electronAPI.petInteract(action)}catch{setError('互动暂时没有回应，请再试一次')}finally{setBusy(false)}}
  return <div className="pet-companion"><div><strong>{pet.life.sleeping?'正在睡觉':pet.life.affection>=60?'黏人的小伙伴':'你的桌面小伙伴'}</strong><span>亲密 {pet.life.affection} · 活力 {pet.life.energy}</span></div><p role="status">{error||pet.life.message}</p><div className="pet-care-actions"><button disabled={busy} onClick={()=>void act('pat')}>♡ 摸摸</button><button disabled={busy} onClick={()=>void act('feed')}>喂小鱼干</button><button disabled={busy} onClick={()=>void act('play')}>一起玩</button><button disabled={busy} onClick={()=>void act(pet.life.sleeping?'wake':'sleep')}>{pet.life.sleeping?'叫醒':'睡一会儿'}</button></div></div>
}
