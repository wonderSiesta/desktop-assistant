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

export type ViewType = 'dashboard' | 'schedule' | 'tools' | 'settings'
