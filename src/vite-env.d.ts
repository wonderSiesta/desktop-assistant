/// <reference types="vite/client" />

import type { ClipboardEntry } from './types'

interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  popupOpen: (appNames: string[]) => void
  popupClose: () => void
  popupIsOpen: () => Promise<boolean>
  hotkeyGet: () => Promise<{ enabled: boolean; accelerator: string }>
  hotkeySet: (enabled: boolean, accelerator: string) => Promise<{ success: boolean; error?: string; enabled?: boolean; accelerator?: string }>
  hotkeyPause: () => void
  hotkeyResume: () => void
  launchApp: (cmd: string) => Promise<{ success: boolean; error?: string }>
  clipboardRead: () => Promise<string>
  clipboardWrite: (text: string) => Promise<boolean>
  clipboardReadImage: () => Promise<string | null>
  clipboardWriteImage: (dataUrl: string) => Promise<boolean>
  clipboardHistoryGet: () => Promise<ClipboardEntry[]>
  clipboardHistoryDelete: (id: string) => Promise<ClipboardEntry[]>
  clipboardHistoryClear: () => Promise<ClipboardEntry[]>
  clipboardHistoryDeleteBefore: (cutoff: number) => Promise<ClipboardEntry[]>
  fileSearch: (query: string) => Promise<{ name: string; path: string; size: number }[]>
  ocrImage: (dataUrl: string) => Promise<{ success: boolean; text?: string; error?: string }>
  getSchedules: () => Promise<unknown[]>
  addSchedule: (schedule: unknown) => Promise<unknown>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
