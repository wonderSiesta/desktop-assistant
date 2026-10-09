import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getSchedules: () => ipcRenderer.invoke('get-schedules'),
  addSchedule: (schedule: unknown) => ipcRenderer.invoke('add-schedule', schedule),
})
