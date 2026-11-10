import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  hide: () => ipcRenderer.send('window-hide'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // Popup window
  popupOpen: (appNames: string[]) => ipcRenderer.send('popup-open', appNames),
  popupClose: () => ipcRenderer.send('popup-close'),
  popupIsOpen: () => ipcRenderer.invoke('popup-is-open'),

  // Global hotkey
  hotkeyGet: () => ipcRenderer.invoke('hotkey-get'),
  hotkeySet: (id: string, enabled: boolean, accelerator: string) => ipcRenderer.invoke('hotkey-set', id, enabled, accelerator),
  hotkeyPause: () => ipcRenderer.send('hotkey-pause'),
  hotkeyResume: () => ipcRenderer.send('hotkey-resume'),

  // 主进程 → 渲染层：快捷键请求跳转到某个系统工具
  onNavigateTool: (cb: (payload: { tool: string; wasFocused: boolean }) => void) => {
    const listener = (_e: unknown, payload: { tool: string; wasFocused: boolean }) => cb(payload)
    ipcRenderer.on('navigate-tool', listener)
    return () => { ipcRenderer.removeListener('navigate-tool', listener) }
  },

  // 主进程 → 渲染层：提醒通知被点击，跳转到日程页
  onNavigateSchedule: (cb: () => void) => {
    const listener = () => cb()
    ipcRenderer.on('navigate-schedule', listener)
    return () => { ipcRenderer.removeListener('navigate-schedule', listener) }
  },

  // System tools
  launchApp: (cmd: string) => ipcRenderer.invoke('launch-app', cmd),
  clipboardRead: () => ipcRenderer.invoke('clipboard-read'),
  clipboardWrite: (text: string) => ipcRenderer.invoke('clipboard-write', text),
  clipboardReadImage: () => ipcRenderer.invoke('clipboard-read-image'),
  clipboardWriteImage: (dataUrl: string) => ipcRenderer.invoke('clipboard-write-image', dataUrl),
  clipboardHistoryGet: () => ipcRenderer.invoke('clipboard-history-get'),
  clipboardHistoryDelete: (id: string) => ipcRenderer.invoke('clipboard-history-delete', id),
  clipboardHistoryClear: () => ipcRenderer.invoke('clipboard-history-clear'),
  clipboardHistoryDeleteBefore: (cutoff: number) => ipcRenderer.invoke('clipboard-history-delete-before', cutoff),
  fileSearch: (query: string) => ipcRenderer.invoke('file-search', query),
  showInFolder: (path: string) => ipcRenderer.send('show-in-folder', path),

  // Schedules
  getSchedules: () => ipcRenderer.invoke('get-schedules'),
  addSchedule: (schedule: unknown) => ipcRenderer.invoke('add-schedule', schedule),

  // 日程提醒：把日程列表同步给主进程调度器 + 提醒总开关
  schedulesSync: (list: unknown[]) => ipcRenderer.send('schedules-sync', list),
  remindersGet: () => ipcRenderer.invoke('reminders-get'),
  remindersSet: (enabled: boolean) => ipcRenderer.invoke('reminders-set', enabled),
})
