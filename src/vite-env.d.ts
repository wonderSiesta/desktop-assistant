/// <reference types="vite/client" />

import type { ClipboardEntry } from './types'

interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  hide: () => void
  isMaximized: () => Promise<boolean>
  popupOpen: (appNames: string[]) => void
  popupClose: () => void
  popupIsOpen: () => Promise<boolean>
  hotkeyGet: () => Promise<Record<string, { enabled: boolean; accelerator: string }>>
  hotkeySet: (id: string, enabled: boolean, accelerator: string) => Promise<{ success: boolean; error?: string; enabled?: boolean; accelerator?: string }>
  hotkeyPause: () => void
  hotkeyResume: () => void
  onNavigateTool: (cb: (payload: { tool: string; wasFocused: boolean }) => void) => () => void
  onNavigateSchedule: (cb: () => void) => () => void
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
  showInFolder: (path: string) => void
  getSchedules: () => Promise<unknown[]>
  addSchedule: (schedule: unknown) => Promise<unknown>
  schedulesSync: (list: unknown[]) => void
  remindersGet: () => Promise<boolean>
  remindersSet: (enabled: boolean) => Promise<boolean>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
