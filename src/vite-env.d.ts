/// <reference types="vite/client" />

import type { ClipboardEntry, CaptureState, PetState, MainTarget } from './types'

interface ElectronAPI {
  petGet:()=>Promise<PetState>
  petPresetSelect:(id:string)=>Promise<PetState>
  petSkinGet:()=>Promise<string|null>
  petSkinChoose:()=>Promise<boolean>
  petSkinReset:()=>Promise<PetState>
  petConfigure:(patch:{size?:number;motion?:boolean;autonomy?:boolean;sound?:boolean;clickSound?:boolean;autoLaunch?:boolean})=>Promise<PetState>
  petInteract:(action:'pat'|'feed'|'play'|'sleep'|'wake'|'land')=>Promise<PetState>
  petToggle:()=>Promise<void>
  petMenu:()=>void
  petRestore:()=>void
  petHide:(ms?:number)=>Promise<void>
  petOpenMain:(id?:string,filter?:string)=>Promise<void>
  petMarkSeen:()=>Promise<void>
  petPanelMode:(mode:'recent'|'settings')=>Promise<void>
  petPanelClose:()=>void
  petQuit:()=>void
  petIgnore:(ignore:boolean)=>void
  petDragStart:()=>void
  petDragEnd:(cancelled?:boolean)=>Promise<{moved:boolean}>
  onPetState:(listener:(state:PetState)=>void)=>()=>void
  mainTargetGet:()=>Promise<MainTarget>
  onMainNavigate:(listener:(target:MainTarget)=>void)=>()=>void
  capturesGet:()=>Promise<CaptureState>
  capturesImport:()=>Promise<CaptureState>
  capturesConfigure:(patch:{enabled?:boolean;textEnabled?:boolean})=>Promise<CaptureState>
  capturesUpdate:(ids:string[],patch:{title?:string;favorite?:boolean;deletedAt?:number|null})=>Promise<CaptureState>
  capturesImage:(id:string)=>Promise<string>
  capturesCopy:(id:string)=>Promise<boolean>
  capturesExport:(ids:string[])=>Promise<{count:number;destination:string}|null>
  capturesFolder:()=>Promise<string>
  capturesEmptyTrash:()=>Promise<CaptureState>
  capturesSnipping:()=>Promise<boolean>
  capturesTopmost:(enabled:boolean)=>Promise<boolean>
  onCapturesChanged:(listener:()=>void)=>()=>void
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
  getSchedules: () => Promise<unknown[]>
  addSchedule: (schedule: unknown) => Promise<unknown>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
