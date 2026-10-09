import { useState, useEffect } from 'react'
import type { Schedule } from '../types'

const STORAGE_KEY = 'desktop-assistant-schedules'

const now = new Date()
const pad = (n: number) => n.toString().padStart(2, '0')
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
const tomorrow = (() => {
  const d = new Date(now)
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
})()
const nextWeek = (() => {
  const d = new Date(now)
  d.setDate(d.getDate() + 7)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
})()

const SAMPLE_DATA: Schedule[] = [
  { id: '1', title: '团队周会', date: today, time: '14:00', description: '讨论本周进度', completed: false, notified: false },
  { id: '2', title: '提交项目报告', date: today, time: '18:00', description: '发送给经理审核', completed: false, notified: false },
  { id: '3', title: '健身', date: tomorrow, time: '07:30', description: '跑步30分钟', completed: false, notified: false },
  { id: '4', title: '产品评审会议', date: tomorrow, time: '10:00', description: '评审新功能设计方案', completed: false, notified: false },
  { id: '5', title: '买生日礼物', date: nextWeek, time: '15:00', description: '给小明买生日礼物', completed: false, notified: false },
  { id: '6', title: '已完成：整理文档', date: today, time: '09:00', description: '归档上周文件', completed: true, notified: true },
]

export function useSchedule() {
  const [schedules, setSchedules] = useState<Schedule[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_DATA))
    return SAMPLE_DATA
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules))
  }, [schedules])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setSchedules(JSON.parse(e.newValue))
      }
    }
    window.addEventListener('storage', onStorage)

    const interval = setInterval(() => {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: Schedule[] = JSON.parse(saved)
        setSchedules(prev => {
          if (JSON.stringify(prev) === JSON.stringify(parsed)) return prev
          return parsed
        })
      }
    }, 2000)

    return () => {
      window.removeEventListener('storage', onStorage)
      clearInterval(interval)
    }
  }, [])

  const addSchedule = (schedule: Omit<Schedule, 'id' | 'notified' | 'completed'>) => {
    const newSchedule: Schedule = {
      ...schedule,
      id: Date.now().toString(),
      notified: false,
      completed: false,
    }
    setSchedules(prev => [...prev, newSchedule])
  }

  const removeSchedule = (id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id))
  }

  const toggleComplete = (id: string) => {
    setSchedules(prev =>
      prev.map(s => s.id === id ? { ...s, completed: !s.completed } : s)
    )
  }

  const upcomingSchedules = schedules
    .filter(s => !s.completed && new Date(s.date + 'T' + s.time) > new Date())
    .sort((a, b) => new Date(a.date + 'T' + a.time).getTime() - new Date(b.date + 'T' + b.time).getTime())

  return { schedules, upcomingSchedules, addSchedule, removeSchedule, toggleComplete }
}
