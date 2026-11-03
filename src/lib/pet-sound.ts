// Short, locally synthesized notes; no sound files, network requests or microphone.
let context:AudioContext|null=null
let lastPlayed=0
export function preparePetSound(){
  try{
    context??=new AudioContext()
    if(context.state==='suspended')void context.resume().catch(()=>{})
  }catch{/* Audio can be unavailable on a muted or disconnected output device. */}
}
export function playPetSound(){
  preparePetSound()
  if(!context||context.state!=='running'||performance.now()-lastPlayed<100)return
  lastPlayed=performance.now()
  const now=context.currentTime
  for(const [offset,frequency] of [[0,660],[.07,990]]){
    const oscillator=context.createOscillator(),gain=context.createGain(),start=now+offset
    oscillator.type='sine'
    oscillator.frequency.setValueAtTime(frequency*.78,start)
    oscillator.frequency.exponentialRampToValueAtTime(frequency,start+.045)
    gain.gain.setValueAtTime(0,start)
    gain.gain.linearRampToValueAtTime(.12,start+.008)
    gain.gain.exponentialRampToValueAtTime(.001,start+.13)
    oscillator.connect(gain);gain.connect(context.destination)
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()}
    oscillator.start(start);oscillator.stop(start+.14)
  }
}
