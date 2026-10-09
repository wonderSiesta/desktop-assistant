import { useState, useEffect } from 'react'
import type { Schedule } from '../types'

const STORAGE_KEY = 'desktop-assistant-schedules'

export function useSchedule() {
  const [schedules, setSchedules] = useState<Schedule[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules))
  }, [schedules])

  const addSchedule = (schedule: Omit<Schedule, 'id' | 'notified'>) => {
    const newSchedule: Schedule = {
      ...schedule,
      id: Date.now().toString(),
      notified: false,
    }
    setSchedules(prev => [...prev, newSchedule])
  }

  const removeSchedule = (id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id))
  }

  const upcomingSchedules = schedules
    .filter(s => new Date(s.date + 'T' + s.time) > new Date())
    .sort((a, b) => new Date(a.date + 'T' + a.time).getTime() - new Date(b.date + 'T' + b.time).getTime())

  return { schedules, upcomingSchedules, addSchedule, removeSchedule }
}
