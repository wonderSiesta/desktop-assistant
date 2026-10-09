import { useState } from 'react'
import type { Schedule } from '../types'
import './Schedule.css'

interface ScheduleProps {
  schedules: Schedule[]
  onAdd: (schedule: Omit<Schedule, 'id' | 'notified' | 'completed'>) => void
  onRemove: (id: string) => void
  onToggleComplete: (id: string) => void
}

const POPUP_APPS_KEY = 'desktop-assistant-popup-apps'

function NumberPicker({ value, min, max, onChange, label }: {
  value: number; min: number; max: number; onChange: (v: number) => void; label: string
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v))

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (raw === '') return
    const num = parseInt(raw, 10)
    if (!isNaN(num)) onChange(clamp(num))
  }

  return (
    <div className="picker-group">
      <span className="picker-label">{label}</span>
      <div className="number-picker">
        <button type="button" onClick={() => onChange(clamp(value + 1))}>&#9650;</button>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={handleInput}
        />
        <button type="button" onClick={() => onChange(clamp(value - 1))}>&#9660;</button>
      </div>
    </div>
  )
}

function pad(n: number) {
  return n.toString().padStart(2, '0')
}

export function ScheduleView({ schedules, onAdd, onRemove, onToggleComplete }: ScheduleProps) {
  const now = new Date()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [day, setDay] = useState(now.getDate())
  const [hour, setHour] = useState(now.getHours())
  const [minute, setMinute] = useState(now.getMinutes())
  const [description, setDescription] = useState('')
  const [popupOpen, setPopupOpen] = useState(false)

  const daysInMonth = new Date(year, month, 0).getDate()

  const togglePopup = async () => {
    if (popupOpen) {
      window.electronAPI?.popupClose()
      setPopupOpen(false)
    } else {
      const saved = localStorage.getItem(POPUP_APPS_KEY)
      const apps = saved ? JSON.parse(saved) : ['WeChat', 'QQ', 'chrome', 'msedge', 'Code']
      window.electronAPI?.popupOpen(apps)
      setPopupOpen(true)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title) return

    const dateStr = `${year}-${pad(month)}-${pad(day)}`
    const timeStr = `${pad(hour)}:${pad(minute)}`
    onAdd({ title, date: dateStr, time: timeStr, description: description || undefined })
    setTitle('')
    setDescription('')
    setShowForm(false)

    const n = new Date()
    setYear(n.getFullYear())
    setMonth(n.getMonth() + 1)
    setDay(n.getDate())
    setHour(n.getHours())
    setMinute(n.getMinutes())
  }

  return (
    <div className="schedule-view">
      <div className="schedule-header">
        <h2>日程安排</h2>
        <div className="schedule-actions">
          <button
            className={`btn-popup ${popupOpen ? 'active' : ''}`}
            onClick={togglePopup}
          >
            {popupOpen ? '关闭弹窗' : '开启弹窗'}
          </button>
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? '取消' : '+ 新建日程'}
          </button>
        </div>
      </div>

      {showForm && (
        <form className="schedule-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>标题</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="输入日程标题"
              required
            />
          </div>
          <div className="form-group">
            <label>日期</label>
            <div className="datetime-picker">
              <NumberPicker value={year} min={2024} max={2099} onChange={setYear} label="年" />
              <span className="picker-separator">-</span>
              <NumberPicker value={month} min={1} max={12} onChange={setMonth} label="月" />
              <span className="picker-separator">-</span>
              <NumberPicker value={day} min={1} max={daysInMonth} onChange={setDay} label="日" />
            </div>
          </div>
          <div className="form-group">
            <label>时间</label>
            <div className="datetime-picker">
              <NumberPicker value={hour} min={0} max={23} onChange={setHour} label="时" />
              <span className="picker-separator">:</span>
              <NumberPicker value={minute} min={0} max={59} onChange={setMinute} label="分" />
            </div>
          </div>
          <div className="form-group">
            <label>描述（可选）</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="添加备注..."
              rows={3}
            />
          </div>
          <button type="submit" className="btn-primary">
            保存日程
          </button>
        </form>
      )}

      <div className="schedule-list">
        {schedules.length === 0 ? (
          <p className="empty-state">暂无日程安排</p>
        ) : (
          schedules.map(schedule => (
            <div key={schedule.id} className={`schedule-item ${schedule.completed ? 'completed' : ''}`}>
              <label className="schedule-checkbox">
                <input
                  type="checkbox"
                  checked={schedule.completed || false}
                  onChange={() => onToggleComplete(schedule.id)}
                />
                <span className="checkmark" />
              </label>
              <div className="schedule-item-info">
                <span className="schedule-item-time">
                  {schedule.date} {schedule.time}
                </span>
                <span className="schedule-item-title">{schedule.title}</span>
                {schedule.description && (
                  <span className="schedule-item-desc">{schedule.description}</span>
                )}
              </div>
              <button
                className="btn-delete"
                onClick={() => onRemove(schedule.id)}
              >
                删除
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
