// Isolated renderer regression check. No desktop input, real clipboard or user library.
const {app,BrowserWindow,ipcMain}=require('electron')
const assert=require('node:assert/strict')
const {join}=require('node:path')
const {mkdir,writeFile}=require('node:fs/promises')
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required')
app.whenReady().then(async()=>{
  const {createPetLife,reactPet}=await import(require('node:url').pathToFileURL(join(__dirname,'../electron/pet-life.mjs')).href)
  let clock=10000
  const windows=[]
  let toggles=0,moved=false,configured=0,exitCode=0
  const state={size:110,motion:true,sound:false,clickSound:true,autoLaunch:false,unread:0,enabled:true,problem:'',phase:'idle',serial:0,mirrored:false,panelMode:'settings',bubble:'',hidden:false,version:'0.2.1',skinKey:'builtin:shenshen',autonomy:true,life:createPetLife({},1000)}
  const create=async(view,width,height)=>{
    const win=new BrowserWindow({width,height,show:false,frame:false,transparent:true,webPreferences:{preload:join(__dirname,'../dist-electron/preload.js'),contextIsolation:true,sandbox:true,backgroundThrottling:false}})
    windows.push(win)
    await win.loadFile(join(__dirname,'../dist/index.html'),{query:{view}})
    for(let i=0;i<50;i++){if(await win.webContents.executeJavaScript(view==='pet-panel'?'document.body.textContent.includes("点击互动音效")':'!!document.querySelector(".has-motion")'))return win;await wait(20)}
    throw new Error('Renderer did not become ready')
  }
  try{
    ipcMain.handle('pet-interact',(_e,action)=>{clock+=1000;reactPet(state.life,action,clock);for(const win of windows)win.webContents.send('pet-state',state);return state})
    ipcMain.handle('pet-preset-select',(_e,id)=>{state.skinKey='builtin:'+id;state.motion=true;for(const win of windows)win.webContents.send('pet-state',state);return state})
    ipcMain.handle('pet-get',()=>state)
    ipcMain.handle('pet-skin-get',()=>null)
    ipcMain.handle('pet-toggle',()=>{toggles++})
    ipcMain.handle('pet-drag-end',(_e,cancelled)=>({moved:moved||cancelled}))
    ipcMain.handle('pet-configure',(_e,patch)=>{Object.assign(state,patch);configured++;for(const win of windows)win.webContents.send('pet-state',state);return state})
    ipcMain.handle('captures-get',()=>({records:[],settings:{enabled:true,textEnabled:false},bytes:0,maxBytes:2*1024**3,warning:null,message:''}))
    const pet=await create('pet',134,134)
    await pet.webContents.executeJavaScript(`
      window.__notes=0;
      window.AudioContext=class extends AudioContext {
        constructor(){super();this.silent=super.createGain();this.silent.gain.value=0;this.silent.connect(super.destination)}
        get destination(){return this.silent||super.destination}
        createOscillator(){window.__notes++;return super.createOscillator()}
      };
      document.querySelector('button').setPointerCapture=()=>{};
      window.testPointer=()=>{const b=document.querySelector('button');b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:1}));b.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0,pointerId:1}))};
      window.testPointer();
    `)
    await wait(380)
    assert.equal(toggles,0)
    const click=await pet.webContents.executeJavaScript('({notes:window.__notes,stars:document.querySelectorAll(".pet-sparkles i").length,realAnimation:!!document.querySelector("video"),fits:document.querySelector(".whale-hit").getBoundingClientRect().right<=innerWidth})')
    assert.equal(click.notes,2);assert.equal(click.stars,5);assert.equal(click.realAnimation,true);assert.equal(click.fits,true)
    const frameChange=await pet.webContents.executeJavaScript(`(async()=>{
      const v=document.querySelector('video');if(v.readyState<2)await new Promise((resolve,reject)=>{v.onloadeddata=resolve;v.onerror=reject});
      const sample=()=>{const c=document.createElement('canvas');c.width=160;c.height=90;const x=c.getContext('2d');x.drawImage(v,0,0,160,90);const p=x.getImageData(0,0,160,90).data;let h=0;for(const byte of p)h=(Math.imul(h,31)+byte)|0;return h};
      const a=sample(),t=v.currentTime;await new Promise(r=>setTimeout(r,700));return {changed:a!==sample(),progress:v.currentTime-t,playing:!v.paused}
    })()`)
    assert.equal(frameChange.changed,true);assert.ok(frameChange.progress>.2);assert.equal(frameChange.playing,true)
    const output=join(__dirname,'../data/qa-0.6.1');await mkdir(output,{recursive:true});await writeFile(join(output,'pet-click.png'),(await pet.webContents.capturePage()).toPNG())
    await wait(800)
    assert.equal(await pet.webContents.executeJavaScript('document.querySelectorAll(".pet-sparkles").length'),0)
    moved=true
    await pet.webContents.executeJavaScript('document.querySelector(".whale-hit").dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,button:0,pointerId:1}))');await wait(150)
    assert.equal(await pet.webContents.executeJavaScript('document.querySelector(".pet-real-art").dataset.clip'),'drag')
    await pet.webContents.executeJavaScript('document.querySelector(".whale-hit").dispatchEvent(new PointerEvent("pointerup",{bubbles:true,button:0,pointerId:1}))');await wait(380)
    assert.equal(toggles,0);assert.equal(await pet.webContents.executeJavaScript('window.__notes'),2)
    moved=false;state.clickSound=false;pet.webContents.send('pet-state',state);await wait(50)
    await pet.webContents.executeJavaScript('window.testPointer()');await wait(380)
    assert.equal(toggles,0);assert.equal(await pet.webContents.executeJavaScript('window.__notes'),2)
    state.motion=false;pet.webContents.send('pet-state',state);await wait(50)
    await pet.webContents.executeJavaScript('window.testPointer()');await wait(380)
    assert.equal(toggles,0);assert.equal(await pet.webContents.executeJavaScript('document.querySelectorAll(".pet-sparkles").length'),0)
    await pet.webContents.executeJavaScript('window.testPointer();setTimeout(window.testPointer,80)');await wait(450);assert.equal(toggles,1)
    state.motion=true;pet.webContents.send('pet-state',state);await wait(50)
    await pet.webContents.executeJavaScript('document.querySelector("[aria-label=喂小鱼干]").click()');await wait(100);assert.equal(state.life.action,'feed')
    await wait(2300);assert.equal(await pet.webContents.executeJavaScript('document.querySelector(".pet-real-art").dataset.clip'),'feed')
    await pet.webContents.executeJavaScript('(async()=>{const v=document.querySelector("video");if(v.loop)throw new Error("Interaction must not loop");v.currentTime=v.duration-.2;await new Promise(r=>v.onseeked=r)})()');await wait(600);assert.equal(await pet.webContents.executeJavaScript('document.querySelector(".pet-real-art").dataset.clip'),'idle')
    const beforeHover={serial:state.life.serial,affection:state.life.affection,toggles,notes:await pet.webContents.executeJavaScript('window.__notes')}
    await pet.webContents.executeJavaScript('(async()=>{for(let i=0;i<100;i++){const b=document.querySelector(".whale-hit");b.dispatchEvent(new PointerEvent("pointermove",{bubbles:true,clientX:30+(i%2)*15,clientY:30,buttons:0}));b.dispatchEvent(new MouseEvent("mousemove",{bubbles:true,clientX:30+(i%2)*15,clientY:30,buttons:0}));await new Promise(r=>setTimeout(r,30))}})()');await wait(300)
    assert.equal(state.life.serial,beforeHover.serial);assert.equal(state.life.affection,beforeHover.affection);assert.equal(toggles,beforeHover.toggles);assert.equal(await pet.webContents.executeJavaScript('window.__notes'),beforeHover.notes);assert.equal(await pet.webContents.executeJavaScript('document.querySelectorAll(".pet-sparkles").length'),0)
    const panel=await create('pet-panel',364,554)
    await panel.webContents.executeJavaScript('Array.from(document.querySelectorAll("button")).find(x=>x.textContent==="睡一会儿").click()');await wait(100);assert.equal(state.life.sleeping,true);assert.equal(state.enabled,true)
    assert.equal(await pet.webContents.executeJavaScript('document.querySelector(".is-sleeping")!==null'),true)
    await panel.webContents.executeJavaScript('Array.from(document.querySelectorAll("button")).find(x=>x.textContent==="叫醒").click()');await wait(100);assert.equal(state.life.sleeping,false)

    await panel.webContents.executeJavaScript(`Array.from(document.querySelectorAll('label')).find(x=>x.textContent.includes('点击互动音效')).querySelector('input').click()`)
    await wait(100);assert.equal(configured,1);assert.equal(state.clickSound,true)
    for(const [name,id] of [['小狐狸','fox'],['小黄鸭','duck'],['小螃蟹','crab'],['静态鲸鱼娘','classic'],['鲸鱼娘 · 深深','shenshen']]){
      await panel.webContents.executeJavaScript('Array.from(document.querySelectorAll(".pet-gallery button")).find(b=>b.textContent.includes('+JSON.stringify(name)+')).click()');await wait(150)
      assert.equal(state.skinKey,'builtin:'+id)
      assert.equal(await panel.webContents.executeJavaScript('document.querySelector(".pet-gallery .selected").getAttribute("aria-pressed")'),'true')
      if(id!=='classic')assert.equal(await pet.webContents.executeJavaScript('document.querySelector(".pet-real-art").dataset.preset'),id)
    }
    console.log(JSON.stringify({passed:true,hoverDoesNotInteract:true,frameChange,presetChoices:5,click,dragDoesNotClick:true,mutedClickSilent:true,motionOffRespected:true,settingsToggleWorks:true,singleClickPets:true,doubleClickOpens:true,feedingWorks:true,sleepDoesNotPauseCollection:true}))
  }catch(error){console.error(error);exitCode=1}finally{for(const win of windows)win.destroy();app.exit(exitCode)}
})
