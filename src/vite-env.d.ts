/// <reference types="vite/client" />

interface ElectronAPI {
  getSchedules: () => Promise<unknown[]>
  addSchedule: (schedule: unknown) => Promise<unknown>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
