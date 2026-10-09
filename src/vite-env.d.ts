/// <reference types="vite/client" />

interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  popupOpen: (appNames: string[]) => void
  popupClose: () => void
  popupIsOpen: () => Promise<boolean>
  launchApp: (cmd: string) => Promise<{ success: boolean; error?: string }>
  clipboardRead: () => Promise<string>
  clipboardWrite: (text: string) => Promise<boolean>
  clipboardReadImage: () => Promise<string | null>
  clipboardWriteImage: (dataUrl: string) => Promise<boolean>
  fileSearch: (query: string) => Promise<{ name: string; path: string; size: number }[]>
  getSchedules: () => Promise<unknown[]>
  addSchedule: (schedule: unknown) => Promise<unknown>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
