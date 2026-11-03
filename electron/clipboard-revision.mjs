import {spawn} from 'node:child_process'

// Only a Windows sequence number crosses stdout. No clipboard content leaves Electron.
export function createClipboardRevision({platform=process.platform,spawnProcess=spawn}={}) {
  let child=null,revision=null,epoch=0,stopped=false,retry=null,readyTimer=null,settle=()=>{}
  function launch(){
    if(stopped||platform!=='win32'){settle();return}
    const generation=++epoch
    const script=`$ErrorActionPreference='Stop'
Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public static class ClipboardRevision { [DllImport("user32.dll")] public static extern uint GetClipboardSequenceNumber(); }'
$owner=Get-Process -Id ${process.pid}
$previous=$null
while($true){
  if($owner.HasExited){break}
  $sequence=[ClipboardRevision]::GetClipboardSequenceNumber()
  if($sequence -ne $previous){[Console]::Out.WriteLine($sequence);[Console]::Out.Flush();$previous=$sequence}
  Start-Sleep -Milliseconds 100
}`
    let buffer=''
    try{
      child=spawnProcess('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,stdio:['ignore','pipe','ignore']})
      const current=child
      const failed=()=>{
        if(child!==current)return
        child=null;revision=null;settle()
        if(!stopped)retry=setTimeout(launch,30_000)
      }
      current.stdout.on('data',data=>{
        if(child!==current)return
        buffer+=data.toString()
        const lines=buffer.split(/\r?\n/);buffer=lines.pop()||''
        for(const line of lines)if(/^\d+$/.test(line.trim())){revision=generation+':'+line.trim();settle()}
        if(buffer.length>128)buffer=''
      })
      current.once('error',failed);current.once('exit',failed)
    }catch{revision=null;settle();if(!stopped)retry=setTimeout(launch,30_000)}
  }
  return {
    read:()=>revision,
    start(){return new Promise(resolve=>{settle=()=>{if(readyTimer)clearTimeout(readyTimer);readyTimer=null;resolve()};readyTimer=setTimeout(settle,5000);launch()})},
    stop(){stopped=true;if(retry)clearTimeout(retry);settle();const current=child;child=null;revision=null;current?.kill()}
  }
}
