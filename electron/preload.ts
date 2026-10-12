import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // Popup window
  popupOpen: (appNames: string[]) => ipcRenderer.send('popup-open', appNames),
  popupClose: () => ipcRenderer.send('popup-close'),
  popupIsOpen: () => ipcRenderer.invoke('popup-is-open'),

  // Global hotkey
  hotkeyGet: () => ipcRenderer.invoke('hotkey-get'),
  hotkeySet: (enabled: boolean, accelerator: string) => ipcRenderer.invoke('hotkey-set', enabled, accelerator),
  hotkeyPause: () => ipcRenderer.send('hotkey-pause'),
  hotkeyResume: () => ipcRenderer.send('hotkey-resume'),

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

  // Schedules
  getSchedules: () => ipcRenderer.invoke('get-schedules'),
  addSchedule: (schedule: unknown) => ipcRenderer.invoke('add-schedule', schedule),
})
