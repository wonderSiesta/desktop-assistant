import { useState, useEffect } from 'react'
import type { Schedule } from '../types'
import './Popup.css'

const STORAGE_KEY = 'desktop-assistant-schedules'

export function Popup() {
  const [schedules, setSchedules] = useState<Schedule[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => {
    const interval = setInterval(() => {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setSchedules(JSON.parse(saved))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const now = new Date()
  const upcoming = schedules
    .filter(s => !s.completed && new Date(s.date + 'T' + s.time) > now)
    .sort((a, b) => new Date(a.date + 'T' + a.time).getTime() - new Date(b.date + 'T' + b.time).getTime())
    .slice(0, 8)

  const toggleComplete = (id: string) => {
    const updated = schedules.map(s =>
      s.id === id ? { ...s, completed: !s.completed } : s
    )
    setSchedules(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  const handleClose = () => {
    window.electronAPI?.popupClose()
  }

  return (
    <div className="popup">
      <div className="popup-header">
        <span className="popup-title">日程提醒</span>
        <button className="popup-close" onClick={handleClose}>×</button>
      </div>
      <div className="popup-body">
        {upcoming.length === 0 ? (
          <p className="popup-empty">暂无待办日程</p>
        ) : (
          upcoming.map(s => (
            <div key={s.id} className="popup-item">
              <label className="popup-checkbox">
                <input
                  type="checkbox"
                  checked={s.completed || false}
                  onChange={() => toggleComplete(s.id)}
                />
                <span className="checkmark" />
              </label>
              <div className="popup-item-info">
                <span className="popup-item-time">{s.date} {s.time}</span>
                <span className="popup-item-title">{s.title}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
