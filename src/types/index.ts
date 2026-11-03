export interface Schedule {
  id: string
  title: string
  time: string
  date: string
  description?: string
  notified?: boolean
  completed?: boolean
}

export interface LauncherApp {
  key: string
  name: string
  icon: string
  command: string
}

export interface ClipboardEntry {
  id: string
  type: 'text' | 'image'
  content: string
  timestamp: number
}

export interface CaptureRecord { id:string;timestamp:number;title:string;thumbnail:string;width:number;height:number;bytes:number;favorite:boolean;deletedAt:number|null }
export interface CaptureState { records:CaptureRecord[];settings:{enabled:boolean;textEnabled:boolean};bytes:number;maxBytes:number;warning:string|null;message:string }
export interface MainTarget {id?:string;filter?:'all'|'favorites';nonce:number}
export interface PetLife {affection:number;energy:number;sleeping:boolean;serial:number;action:string;message:string}
export interface PetState {version:string;size:number;motion:boolean;sound:boolean;clickSound:boolean;autoLaunch:boolean;unread:number;enabled:boolean;problem:string;phase:'idle'|'happy';serial:number;mirrored:boolean;panelMode:'recent'|'settings';bubble:string;hidden:boolean;skinKey:string;autonomy:boolean;life:PetLife}
export type ViewType = 'captures' | 'dashboard' | 'schedule' | 'tools' | 'settings'
