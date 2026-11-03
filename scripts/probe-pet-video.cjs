const {app,BrowserWindow}=require('electron')
const {writeFile,mkdir}=require('node:fs/promises')
const {join}=require('node:path')
const {pathToFileURL}=require('node:url')
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required')
app.whenReady().then(async()=>{
  let win,exitCode=0
  try{
    const folder=join(__dirname,'../data/qa-0.6.0');await mkdir(folder,{recursive:true})
    const fixture=join(folder,'video-probe.html')
    const source=pathToFileURL(join(__dirname,'../src/assets/pets/shenshen/idle.webm')).href
    await writeFile(fixture,'<html><body style="margin:0;background:transparent"><video muted src="'+source+'"></video></body></html>')
    win=new BrowserWindow({width:640,height:360,show:false,webPreferences:{offscreen:true,backgroundThrottling:false}})
    await win.loadFile(fixture)
    const result=await win.webContents.executeJavaScript(`(async()=>{
      const v=document.querySelector('video');if(v.readyState<2)await new Promise((resolve,reject)=>{v.onloadeddata=resolve;v.onerror=reject});
      v.currentTime=.3;await new Promise(resolve=>v.onseeked=resolve);
      const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);
      const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let left=c.width,right=0,top=c.height,bottom=0,clear=0;
      for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){if(p[(y*c.width+x)*4+3]>24){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}else clear++}
      return {width:v.videoWidth,height:v.videoHeight,duration:v.duration,left,right,top,bottom,clear,poster:c.toDataURL()}
    })()`)
    const poster=result.poster;delete result.poster
    await writeFile(join(__dirname,'../src/assets/pets/shenshen/poster.png'),Buffer.from(poster.split(',')[1],'base64'))
    console.log(JSON.stringify(result))
    if(result.clear<1000)throw new Error('Video transparency is missing')
  }catch(error){console.error(error);exitCode=1}finally{win?.destroy();app.exit(exitCode)}
})
