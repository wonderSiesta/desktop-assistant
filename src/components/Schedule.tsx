import { useState } from 'react'
import type { Schedule } from '../types'
import './Schedule.css'

interface ScheduleProps {
  schedules: Schedule[]
  onAdd: (schedule: Omit<Schedule, 'id' | 'notified'>) => void
  onRemove: (id: string) => void
}

export function ScheduleView({ schedules, onAdd, onRemove }: ScheduleProps) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !date || !time) return

    onAdd({ title, date, time, description: description || undefined })
    setTitle('')
    setDate('')
    setTime('')
    setDescription('')
    setShowForm(false)
  }

  return (
    <div className="schedule-view">
      <div className="schedule-header">
        <h2>日程安排</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '取消' : '+ 新建日程'}
        </button>
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
          <div className="form-row">
            <div className="form-group">
              <label>日期</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>时间</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                required
              />
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
            <div key={schedule.id} className="schedule-item">
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
