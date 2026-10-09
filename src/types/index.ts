export interface Schedule {
  id: string
  title: string
  time: string
  date: string
  description?: string
  notified?: boolean
}

export type ViewType = 'dashboard' | 'schedule' | 'tools'
