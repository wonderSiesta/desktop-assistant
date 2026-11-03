import {useEffect,useRef,useState} from 'react'
import {animationFor,PET_PRESETS,presetId} from '../../electron/pet-presets.mjs'
import classic from '../assets/whale-girl.png'
const files=import.meta.glob('../assets/pets/**/*.{webm,gif,png}',{eager:true,query:'?url',import:'default'}) as Record<string,string>
const asset=(folder:string,name:string)=>files['../assets/pets/'+folder+'/'+name]
export {PET_PRESETS,presetId}

export interface ArtView {held?:boolean;action?:string;serial?:number;phase?:string;sleeping?:boolean;motion?:boolean}
export function PetArtwork({skinKey,customSrc,view={},preview=false}:{skinKey?:string;customSrc?:string;view?:ArtView;preview?:boolean}){
  const id=presetId(skinKey),preset=PET_PRESETS.find(p=>p.id===id),video=useRef<HTMLVideoElement|null>(null)
  const [done,setDone]=useState(''),[failed,setFailed]=useState('')
  const clip=animationFor(id||'classic',view),token=[id,clip,view.serial||0].join(':'),ended=done===token
  const name=ended?'idle':clip,loop=['idle','drag'].includes(name)||view.sleeping===true
  const source=preset?.kind==='video'?asset(preset.folder,name+'.webm'):preset?.kind==='gif'?asset(preset.folder,(preview||view.motion===false?'idle.png':name+'.gif')):id==='classic'?classic:customSrc||classic
  useEffect(()=>{
    const element=video.current;if(!element)return
    const sync=()=>{if(view.motion===false||document.visibilityState==='hidden')element.pause();else void element.play().catch(()=>{})}
    // Play immediately; the OS visibility event pauses decoding when the pet is hidden.
    if(view.motion===false)element.pause();else void element.play().catch(()=>{})
    document.addEventListener('visibilitychange',sync);return()=>document.removeEventListener('visibilitychange',sync)
  },[source,view.motion,token])
  if(preset?.kind==='video')return <div className="pet-real-art" data-preset={id} data-clip={name}>
    {preview||failed===token?<img className="pet-video-poster" src={asset(preset.folder,'poster.png')||classic} alt={preset.name}/>:<video ref={video} key={source+token} className="pet-webm" src={source} poster={asset(preset.folder,'poster.png')} muted playsInline autoPlay={view.motion!==false} loop={loop} preload="auto" onEnded={()=>setDone(token)} onError={()=>setFailed(token)}/>}
    {failed===token&&!preview&&<span className="pet-art-error">动画加载失败</span>}
  </div>
  if(preset?.kind==='gif')return <div className="pet-real-art pixel-pet" data-preset={id} data-clip={name}><img key={source+token} src={source} alt={preset.name} draggable={false}/></div>
  return <div className={'character-art '+(view.sleeping?'sleeping':'')}><div className="character-motion"><img src={source} alt="" draggable={false} onError={event=>{if(event.currentTarget.src!==new URL(classic,location.href).href)event.currentTarget.src=classic}}/></div></div>
}

export function PetGallery({selected,busy,onSelect}:{selected?:string;busy:boolean;onSelect:(id:string)=>void}){
  return <div className="pet-gallery" aria-label="基础形象">{PET_PRESETS.map(p=><button key={p.id} aria-pressed={presetId(selected)===p.id} disabled={busy} onClick={()=>onSelect(p.id)} className={presetId(selected)===p.id?'selected':''}><span className="pet-gallery-art"><PetArtwork skinKey={'builtin:'+p.id} preview/></span><strong>{p.name}</strong><small>{p.description}</small></button>)}</div>
}
