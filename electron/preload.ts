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

  // System tools
  launchApp: (cmd: string) => ipcRenderer.invoke('launch-app', cmd),
  clipboardRead: () => ipcRenderer.invoke('clipboard-read'),
  clipboardWrite: (text: string) => ipcRenderer.invoke('clipboard-write', text),
  clipboardReadImage: () => ipcRenderer.invoke('clipboard-read-image'),
  clipboardWriteImage: (dataUrl: string) => ipcRenderer.invoke('clipboard-write-image', dataUrl),
  fileSearch: (query: string) => ipcRenderer.invoke('file-search', query),
  ocrImage: (dataUrl: string) => ipcRenderer.invoke('ocr-image', dataUrl),

  // Schedules
  getSchedules: () => ipcRenderer.invoke('get-schedules'),
  addSchedule: (schedule: unknown) => ipcRenderer.invoke('add-schedule', schedule),
})
