import {app,BrowserWindow,ipcMain,Menu,screen,shell,dialog} from 'electron'
import {join} from 'node:path'
import {readFile,writeFile,rename,stat} from 'node:fs/promises'
import {anchorFor,fitBounds,movedEnough,panelBounds,restoreAnchor} from './pet-geometry.mjs'
import type {Anchor} from './pet-geometry.mjs'
import {capturesSummary,onCaptureEvent,setCaptureEnabled,suspendCaptureWork} from './captures'
import {createPetLife,reactPet,petLifeSave} from './pet-life.mjs'
import type {PetLife} from './pet-life.mjs'
import {PET_PRESETS,presetId} from './pet-presets.mjs'
import {readSkin,saveSkin} from './pet-skin.mjs'

type Target={id?:string;filter?:'all'|'favorites';nonce:number}
type Hooks={openMain:(target:Target)=>void;quit:()=>void;snip:()=>Promise<boolean>}
interface Config{size:number;motion:boolean;sound:boolean;clickSound:boolean;autoLaunch:boolean;lastViewedAt:number;anchor:Anchor|null;skin:string|null;autonomy:boolean;life?:ReturnType<typeof petLifeSave>}
export interface PetState{version:string;size:number;motion:boolean;sound:boolean;clickSound:boolean;autoLaunch:boolean;unread:number;enabled:boolean;problem:string;phase:'idle'|'happy';serial:number;mirrored:boolean;panelMode:'recent'|'settings';bubble:string;hidden:boolean;skinKey:string;autonomy:boolean;life:PetLife}
let pet:BrowserWindow|null=null,panel:BrowserWindow|null=null,bubble:BrowserWindow|null=null
let config:Config={size:160,motion:true,sound:false,clickSound:true,autoLaunch:false,lastViewedAt:Date.now(),anchor:null,skin:null,autonomy:true}
let life=createPetLife(),lifeTimer:ReturnType<typeof setInterval>|null=null
let skinData:string|null=null,choosingSkin=false
let hooks:Hooks,configFile='',writeQueue=Promise.resolve(),disposed=false,phase:'idle'|'happy'='idle',serial=0,panelMode:'recent'|'settings'='recent',bubbleText='',latestProblem=''
let restoreTimer:ReturnType<typeof setTimeout>|null=null,bubbleTimer:ReturnType<typeof setTimeout>|null=null,happyTimer:ReturnType<typeof setTimeout>|null=null,dragTimer:ReturnType<typeof setInterval>|null=null
let drag:{cursor:{x:number;y:number};bounds:Electron.Rectangle;moved:boolean;started:number}|null=null
let unsubscribe:()=>void=()=>{}
function alive(win:BrowserWindow|null):win is BrowserWindow{return !!win&&!win.isDestroyed()}
function size(){return {width:config.size+24,height:config.size+24}}
function display(){return alive(pet)?screen.getDisplayMatching(pet.getBounds()):screen.getPrimaryDisplay()}
function state():PetState{const capture=capturesSummary(config.lastViewedAt);return {version:app.getVersion(),size:config.size,motion:config.motion,sound:config.sound,clickSound:config.clickSound,autoLaunch:config.autoLaunch,unread:capture.unread,enabled:capture.enabled,problem:latestProblem,phase,serial,mirrored:alive(pet)&&pet.getBounds().x<display().workArea.x+display().workArea.width/2,panelMode,bubble:bubbleText,hidden:!alive(pet)||!pet.isVisible(),skinKey:config.skin||'builtin:shenshen',autonomy:config.autonomy,life:{...life}}}
function broadcast(){const snapshot=state();for(const win of [pet,panel,bubble])if(alive(win))win.webContents.send('pet-state',snapshot)}
function persist(){const snapshot=JSON.stringify({...config,life:petLifeSave(life)},null,2);const action=writeQueue.then(async()=>{await writeFile(configFile+'.tmp',snapshot,'utf8');await rename(configFile+'.tmp',configFile)});writeQueue=action.catch(()=>{});return action}
function loadView(win:BrowserWindow,view:string){win.setTitle((view==='pet'?'桌面助手':view==='pet-panel'?'桌面助手':'桌面助手提示')+(process.env.CAPTURE_DEMO==='1'?' · 演示':''));win.on('page-title-updated',event=>event.preventDefault());win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());if(process.env.VITE_DEV_SERVER_URL)void win.loadURL(`${process.env.VITE_DEV_SERVER_URL}?view=${view}`);else void win.loadFile(join(__dirname,'../dist/index.html'),{query:{view}});win.webContents.on('did-finish-load',()=>win.webContents.send('pet-state',state()))}
function prefs(){return {preload:join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}}
function placeOtherWindows(){if(!alive(pet))return;const area=display().workArea;if(alive(panel))panel.setBounds(panelBounds(pet.getBounds(),{width:364,height:Math.min(554,area.height-24)},area));if(alive(bubble)){const p=pet.getBounds();bubble.setBounds(fitBounds({x:p.x+p.width/2-119,y:p.y-72},{width:238,height:68},area))}}
function remember(){if(!alive(pet))return Promise.resolve();config.anchor=anchorFor(pet.getBounds(),display().workArea,display().id);return persist()}
function reconcile(){if(!alive(pet))return;const target=screen.getAllDisplays().find(d=>d.id===config.anchor?.displayId)||screen.getPrimaryDisplay();pet.setBounds(restoreAnchor(config.anchor,size(),target.workArea));placeOtherWindows();broadcast()}
export function restorePet(){if(restoreTimer)clearTimeout(restoreTimer);restoreTimer=null;if(alive(pet)){pet.showInactive();reconcile();broadcast()}}
export function hidePetFor(ms=10*60_000){if(restoreTimer)clearTimeout(restoreTimer);if(alive(panel))panel.hide();if(alive(bubble))bubble.hide();if(alive(pet))pet.hide();restoreTimer=setTimeout(()=>restorePet(),ms);broadcast()}
function say(text:string){bubbleText=text;if(!alive(pet)||!pet.isVisible()||disposed)return;if(bubbleTimer)clearTimeout(bubbleTimer);if(!alive(bubble)){bubble=new BrowserWindow({width:238,height:68,show:false,frame:false,transparent:true,hasShadow:false,resizable:false,skipTaskbar:true,alwaysOnTop:true,focusable:false,webPreferences:prefs()});bubble.setIgnoreMouseEvents(true);loadView(bubble,'pet-bubble');bubble.once('ready-to-show',()=>{placeOtherWindows();if(alive(bubble)&&alive(pet)&&pet.isVisible())bubble.showInactive()})}else {placeOtherWindows();bubble.showInactive()}broadcast();bubbleTimer=setTimeout(()=>{if(alive(bubble))bubble.hide()},3600)}
export async function markPetSeen(){config.lastViewedAt=Date.now();await persist();broadcast()}
export async function openLibrary(id?:string,filter:'all'|'favorites'='all'){if(alive(panel))panel.hide();await markPetSeen();hooks.openMain({id,filter,nonce:Date.now()})}
function openPanel(mode:'recent'|'settings'='recent',toggle=false){if(!alive(pet))return;panelMode=mode;restorePet();if(toggle&&alive(panel)&&panel.isVisible()){panel.hide();return}if(!alive(panel)){panel=new BrowserWindow({width:364,height:554,show:false,frame:false,transparent:true,hasShadow:true,resizable:false,skipTaskbar:true,alwaysOnTop:true,webPreferences:prefs()});loadView(panel,'pet-panel');panel.once('ready-to-show',()=>{placeOtherWindows();if(alive(panel))panel.show()});panel.on('blur',()=>{if(alive(panel)&&!choosingSkin)panel.hide()});panel.on('close',e=>{if(!disposed){e.preventDefault();panel?.hide()}})}else {placeOtherWindows();panel.show();panel.focus()}broadcast()}
async function configure(patch:Partial<Config>){const next={...config};if(typeof patch.size==='number'&&Number.isFinite(patch.size))next.size=Math.round(Math.max(64,Math.min(240,patch.size)));if(typeof patch.motion==='boolean')next.motion=patch.motion;if(typeof patch.autonomy==='boolean')next.autonomy=patch.autonomy;if(typeof patch.sound==='boolean')next.sound=patch.sound;if(typeof patch.clickSound==='boolean')next.clickSound=patch.clickSound;if(typeof patch.autoLaunch==='boolean'){if(!app.isPackaged)throw new Error('开机启动请使用打包后的应用。');app.setLoginItemSettings({openAtLogin:patch.autoLaunch,path:process.execPath,args:['--pet-autostart']});next.autoLaunch=patch.autoLaunch}config=next;reconcile();await persist();broadcast();return state()}
async function selectPreset(id:string){
    if(!PET_PRESETS.some(p=>p.id===id))throw new Error('未知基础形象')
    const previous={...config},previousData=skinData;config={...config,skin:'builtin:'+id,motion:id==='classic'?config.motion:true};skinData=null
    try{await persist()}catch(e){config=previous;skinData=previousData;throw e}
    broadcast();return state()
  }
async function interact(action:string){
  if(!reactPet(life,action))return state()
  broadcast()
  if(action!=='idle'){
    say(life.message)
    try{await persist()}catch{say('互动状态未能保存，截图功能不受影响。')}
  }
  return state()
}
export function petMenu(){const enabled=capturesSummary(config.lastViewedAt).enabled;Menu.buildFromTemplate([
  {label:'摸摸头',click:()=>{void interact('pat')}},{label:'喂小鱼干',click:()=>{void interact('feed')}},{label:'一起玩',click:()=>{void interact('play')}},{label:life.sleeping?'叫醒':'睡一会儿',click:()=>{void interact(life.sleeping?'wake':'sleep')}},{type:'separator'},
  {label:'截一张',click:()=>{void hooks.snip().catch(e=>say(String(e.message||e)))}},
  {label:'打开桌面助手',click:()=>{void openLibrary()}},{label:'打开收藏',click:()=>{void openLibrary(undefined,'favorites')}},
  {type:'separator'},{label:enabled?'暂停收集':'继续收集',click:()=>{void setCaptureEnabled(!enabled).catch(e=>say(String(e.message||e)))}},
  {label:'宠物设置',click:()=>openPanel('settings')},{label:'临时隐藏 10 分钟',click:()=>hidePetFor()},
  {type:'separator'},{label:'退出助手',click:()=>hooks.quit()}
]).popup({window:pet||undefined})}
function finishDrag(cancelled=false){
  if(dragTimer)clearInterval(dragTimer);dragTimer=null
  const active=drag,moved=active?.moved||false;drag=null
  if(active&&alive(pet)){
    if(moved){const p=pet.getBounds();pet.setBounds(fitBounds(p,p,display().workArea,20));placeOtherWindows();void remember().catch(()=>say('位置保存失败，下次启动可能恢复默认位置。'));broadcast()}
    pet.setIgnoreMouseEvents(true,{forward:true})
  }
  // Resume on a later turn so encoding a newly copied image cannot delay mouse-up.
  setTimeout(()=>{if(!disposed&&!drag)suspendCaptureWork(false)},0)
  return {moved:moved||cancelled||!active}
}
export async function startPet(options:Hooks){hooks=options;configFile=join(app.getPath('userData'),'pet-config.json');try{const saved=JSON.parse(await readFile(configFile,'utf8'));config={...config,...saved,size:Math.max(64,Math.min(240,Number(saved.size)||160)),lastViewedAt:Number(saved.lastViewedAt)||Date.now()};if(config.anchor&&(!Number.isFinite(config.anchor.xRatio)||!Number.isFinite(config.anchor.yRatio)))config.anchor=null}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')latestProblem='宠物设置无法读取，已使用默认外观；截图数据不受影响。'}
  if(!config.skin){config.skin='builtin:shenshen';config.motion=true;config.size=Math.max(config.size,160);await persist()}
  life=createPetLife(config.life)
  if(config.autoLaunch&&app.isPackaged){try{app.setLoginItemSettings({openAtLogin:true,path:process.execPath,args:['--pet-autostart']})}catch{latestProblem='开机启动路径更新失败，可在宠物设置中重新开启。'}}
  lifeTimer=setInterval(()=>{if(config.autonomy&&config.motion&&!drag&&alive(pet)&&pet.isVisible()&&!(alive(panel)&&panel.isVisible()))void interact('idle')},30000)
  ipcMain.handle('pet-interact',(_e,action)=>interact(typeof action==='string'?action:''))
  if(config.skin&&!presetId(config.skin)){try{skinData=await readSkin(join(app.getPath('userData'),'pet-skins'),config.skin)}catch{config.skin=null;skinData=null;latestProblem='自定义形象无法读取，已恢复默认鲸鱼娘。'}}
  pet=new BrowserWindow({...restoreAnchor(config.anchor,size(),screen.getPrimaryDisplay().workArea),title:'桌面助手',show:false,frame:false,transparent:true,hasShadow:false,resizable:false,skipTaskbar:true,alwaysOnTop:true,focusable:true,webPreferences:prefs()});pet.setIgnoreMouseEvents(true,{forward:true});loadView(pet,'pet');pet.once('ready-to-show',()=>restorePet())
  ipcMain.handle('pet-preset-select',(_e,id)=>selectPreset(id))
  ipcMain.handle('pet-skin-get',()=>skinData)
  ipcMain.handle('pet-skin-choose',async()=>{
    if(choosingSkin)return false
    choosingSkin=true
    try{
      const options:Electron.OpenDialogOptions={title:'上传桌面助手形象',properties:['openFile'],filters:[{name:'图片形象',extensions:['png','jpg','jpeg','gif','webp']}]}
      const picked=alive(panel)?await dialog.showOpenDialog(panel,options):await dialog.showOpenDialog(options)
      if(picked.canceled||!picked.filePaths[0])return false
      if((await stat(picked.filePaths[0])).size>10*1024*1024)throw new Error('形象图片不能超过 10 MB。')
      const saved=await saveSkin(join(app.getPath('userData'),'pet-skins'),await readFile(picked.filePaths[0]))
      const previous=config.skin,previousData=skinData;config.skin=saved.key;skinData=saved.dataUrl
      try{await persist()}catch(e){config.skin=previous;skinData=previousData;broadcast();throw e}
      broadcast();return true
    }finally{choosingSkin=false;if(alive(panel)&&!disposed){panel.show();panel.focus()}}
  })
  ipcMain.handle('pet-skin-reset',()=>selectPreset('shenshen'))
  ipcMain.handle('pet-get',()=>state());ipcMain.handle('pet-configure',(_e,patch)=>configure(patch));ipcMain.handle('pet-toggle',()=>openPanel('recent',true));ipcMain.on('pet-menu',()=>petMenu());ipcMain.on('pet-restore',()=>restorePet());ipcMain.handle('pet-hide',(_e,ms)=>hidePetFor(typeof ms==='number'?Math.max(1000,Math.min(ms,3600_000)):undefined));ipcMain.handle('pet-open-main',(_e,id,filter)=>openLibrary(typeof id==='string'?id:undefined,filter==='favorites'?'favorites':'all'));ipcMain.handle('pet-seen',()=>markPetSeen());ipcMain.handle('pet-panel-mode',(_e,mode)=>{panelMode=mode==='settings'?'settings':'recent';broadcast()});ipcMain.on('pet-panel-close',()=>{if(alive(panel))panel.hide()});ipcMain.on('pet-quit',()=>hooks.quit())
  ipcMain.on('pet-ignore',(_e,ignore)=>{if(alive(pet)&&!drag)pet.setIgnoreMouseEvents(ignore===true,{forward:true})})
  ipcMain.on('pet-drag-start',()=>{
    if(!alive(pet)||drag)return
    suspendCaptureWork(true)
    if(alive(panel))panel.hide();if(alive(bubble))bubble.hide()
    pet.setIgnoreMouseEvents(false)
    const origin=screen.getCursorScreenPoint();let last=origin
    drag={cursor:origin,bounds:pet.getBounds(),moved:false,started:Date.now()}
    dragTimer=setInterval(()=>{
      if(!drag||!alive(pet))return
      const cursor=screen.getCursorScreenPoint()
      if((cursor.x!==last.x||cursor.y!==last.y)&&(drag.moved||movedEnough(drag.cursor,cursor))){
        drag.moved=true;last=cursor
        pet.setPosition(Math.round(drag.bounds.x+cursor.x-drag.cursor.x),Math.round(drag.bounds.y+cursor.y-drag.cursor.y))
      }
      if(Date.now()-drag.started>15000)finishDrag(true)
    },16)
  })
  ipcMain.handle('pet-drag-end',(_e,cancelled)=>finishDrag(cancelled===true))
  unsubscribe=onCaptureEvent(event=>{if(event.kind==='captured'){latestProblem='';phase='happy';serial++;if(happyTimer)clearTimeout(happyTimer);happyTimer=setTimeout(()=>{phase='idle';broadcast()},1500);if(config.sound)shell.beep();say('收好啦，新增 1 张截图')}else if(event.kind==='problem'){latestProblem=event.message;say('保存遇到问题，点我查看原因')}broadcast()})
  screen.on('display-added',reconcile);screen.on('display-removed',reconcile);screen.on('display-metrics-changed',reconcile)
}
export function stopPet(){disposed=true;unsubscribe();if(lifeTimer)clearInterval(lifeTimer);if(dragTimer)clearInterval(dragTimer);for(const timer of [restoreTimer,bubbleTimer,happyTimer])if(timer)clearTimeout(timer);screen.removeListener('display-added',reconcile);screen.removeListener('display-removed',reconcile);screen.removeListener('display-metrics-changed',reconcile);for(const win of [panel,bubble,pet])if(alive(win))win.destroy()}
