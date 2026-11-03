import {app,BrowserWindow,clipboard,dialog,ipcMain,nativeImage,shell} from 'electron'
import {join} from 'node:path'
import {CaptureStore} from './capture-store.mjs'
import {createCollector} from './capture-collector.mjs'
import {createClipboardRevision} from './clipboard-revision.mjs'
import {EventEmitter} from 'node:events'
type CaptureEvent={kind:'captured';id:string}|{kind:'changed'}|{kind:'problem';message:string}
const events=new EventEmitter()
let snipping:()=>Promise<boolean>=async()=>{if(process.platform!=='win32')throw new Error('请使用当前系统截图快捷键');await shell.openExternal('ms-screenclip:');return true}
export function setSnippingHandler(handler:()=>Promise<boolean>){snipping=handler}
export function onCaptureEvent(listener:(event:CaptureEvent)=>void){events.on('activity',listener);return ()=>{events.off('activity',listener)}}
export async function setCaptureEnabled(enabled:boolean){if(enabled)collector.baseline();await store.configure({enabled});notify();return capturesState()}

let store:CaptureStore
let collector:ReturnType<typeof createCollector>
const revision=createClipboardRevision()
let lastFallback=0
let message='',monitor:ReturnType<typeof setInterval>|null=null
function notify(){for(const win of BrowserWindow.getAllWindows())if(!win.isDestroyed())win.webContents.send('captures-changed');events.emit('activity',{kind:'changed'})}
function errorText(e:unknown){return e instanceof Error?e.message:'操作失败，请检查本机磁盘空间和权限。'}
export function capturesState(){return {...store.state(),message}}
export function capturesSummary(since:number){return {enabled:store.settings.enabled,unread:store.records.reduce((n,r)=>n+Number(!r.deletedAt&&r.timestamp>since),0)}}
export function suspendCaptureWork(value:boolean){collector?.setSuspended(value);if(!value)pollCapture()}
export function pollCapture(){
  // Restricted PowerShell policies can disable the helper: keep a slower fallback.
  if(revision.read()===null){if(Date.now()-lastFallback<1200)return;lastFallback=Date.now()}
  void collector.poll()
}
export async function startCaptures(){
  store=new CaptureStore(join(app.getPath('userData'),'captures'));await store.load()
  await revision.start()
  collector=createCollector({store,readImage:()=>clipboard.readImage(),readRevision:()=>revision.read(),onChange:()=>notify(),onError:e=>{message=errorText(e);events.emit('activity',{kind:'problem',message});notify()},onSaved:record=>{message='新截图已收纳';events.emit('activity',{kind:'captured',id:record.id})}})
  // Do not silently import a picture left on the clipboard before the app started.
  try{collector.baseline()}catch{message='剪贴板暂时被占用，稍后会重试。'}
  monitor=setInterval(pollCapture,350)
  ipcMain.handle('captures-get',()=>capturesState())
  ipcMain.handle('captures-import',async()=>{
    await collector.importCurrent();message='当前图片已导入';return capturesState()
  })
  ipcMain.handle('captures-configure',async(_e,patch:unknown)=>{
    const value=patch as {enabled?:boolean;textEnabled?:boolean}
    const safe:{enabled?:boolean;textEnabled?:boolean}={}
    if(typeof value.enabled==='boolean')safe.enabled=value.enabled
    if(typeof value.textEnabled==='boolean')safe.textEnabled=value.textEnabled
    // Resume starts from the current clipboard; paused images are not imported.
    if(safe.enabled)collector.baseline()
    await store.configure(safe);notify();return capturesState()
  })
  ipcMain.handle('captures-update',async(_e,ids:string[],patch:{title?:string;favorite?:boolean;deletedAt?:number|null})=>{
    const safe:{title?:string;favorite?:boolean;deletedAt?:number|null}={}
    if(typeof patch.title==='string')safe.title=patch.title.trim().slice(0,100)||'未命名截图'
    if(typeof patch.favorite==='boolean')safe.favorite=patch.favorite
    if(patch.deletedAt===null)safe.deletedAt=null
    else if(typeof patch.deletedAt==='number')safe.deletedAt=Date.now()
    await store.update(ids,safe);notify();return capturesState()
  })
  ipcMain.handle('captures-image',async(_e,id:string)=>'data:image/png;base64,'+(await store.image(id)).toString('base64'))
  ipcMain.handle('captures-copy',async(_e,id:string)=>{
    const data=await store.image(id),image=nativeImage.createFromBuffer(data)
    if(image.isEmpty())throw new Error('原图无法读取')
    collector.ownCopy(image);clipboard.writeImage(image);return true
  })
  ipcMain.handle('captures-export',async(_e,ids:string[])=>{
    if(!Array.isArray(ids)||ids.length>10000)throw new Error('无效选择')
    const result=await dialog.showOpenDialog({title:'选择导出位置（自动新建截图文件夹）',properties:['openDirectory','createDirectory']})
    if(result.canceled)return null
    return store.export(ids,result.filePaths[0])
  })
  ipcMain.handle('captures-folder',()=>shell.openPath(store.root))
  ipcMain.handle('captures-empty-trash',async()=>{
    const choice=await dialog.showMessageBox({type:'warning',title:'永久清空截图回收站',message:'将永久删除回收站中的原图，无法撤销。',buttons:['取消','永久删除'],defaultId:0,cancelId:0})
    if(choice.response===1){await store.emptyTrash();notify()}return capturesState()
  })
  ipcMain.handle('captures-snipping',()=>snipping())
  ipcMain.handle('captures-topmost',(_e,enabled:boolean)=>{const win=BrowserWindow.getFocusedWindow();win?.setAlwaysOnTop(enabled===true);return win?.isAlwaysOnTop()||false})
}
export function textHistoryEnabled(){return store?.settings.textEnabled===true}
export function stopCaptures(){if(monitor)clearInterval(monitor);revision.stop()}
