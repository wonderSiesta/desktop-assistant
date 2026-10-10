import { useState } from 'react'
import type { Schedule } from '../types'
import { parseSchedule } from '../utils/parseSchedule'
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
  const [showParse, setShowParse] = useState(false)
  const [parseText, setParseText] = useState('')
  const [parseError, setParseError] = useState('')
  const [ocrBusy, setOcrBusy] = useState(false)

  const daysInMonth = new Date(year, month, 0).getDate()

  const runOcr = async (dataUrl: string) => {
    setOcrBusy(true)
    setParseError('')
    try {
      const res = await window.electronAPI?.ocrImage(dataUrl)
      if (res?.success && res.text && res.text.trim()) {
        setParseText(res.text.trim())
      } else {
        setParseError('图片识别失败：' + (res?.error || '未识别到文字'))
      }
    } catch (e) {
      setParseError('图片识别失败：' + (e instanceof Error ? e.message : '未知错误'))
    } finally {
      setOcrBusy(false)
    }
  }

  const readClipboardImage = async () => {
    const img = await window.electronAPI?.clipboardReadImage()
    if (img) runOcr(img)
    else setParseError('剪贴板没有图片')
  }

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setParseError('请选择图片文件')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') runOcr(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          e.preventDefault()
          handleImageFile(file)
          return
        }
      }
    }
  }

  const readClipboard = async () => {
    const text = await window.electronAPI?.clipboardRead()
    if (text && text.trim()) {
      setParseText(text)
      setParseError('')
    } else {
      setParseError('剪贴板没有可用的文本')
    }
  }

  const handleRecognize = () => {
    const parsed = parseSchedule(parseText)
    if (!parsed) {
      setParseError('未能识别出日程，请检查文本是否包含标题或日期时间')
      return
    }
    const [y, mo, d] = parsed.date.split('-').map(Number)
    const [h, mi] = parsed.time.split(':').map(Number)
    setTitle(parsed.title)
    setYear(y)
    setMonth(mo)
    setDay(d)
    setHour(h)
    setMinute(mi)
    setDescription(parsed.description ?? '')
    setParseError('')
    setShowParse(false)
    setShowForm(true)
  }

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
            className="btn-popup"
            onClick={() => { setShowParse(!showParse); setShowForm(false) }}
          >
            {showParse ? '关闭识别' : '智能识别'}
          </button>
          <button
            className={`btn-popup ${popupOpen ? 'active' : ''}`}
            onClick={togglePopup}
          >
            {popupOpen ? '关闭弹窗' : '开启弹窗'}
          </button>
          <button className="btn-primary" onClick={() => { setShowForm(!showForm); setShowParse(false) }}>
            {showForm ? '取消' : '+ 新建日程'}
          </button>
        </div>
      </div>

      {showParse && (
        <div className="schedule-form parse-panel">
          <div className="form-group">
            <label>粘贴日程文字或图片，自动识别标题与时间</label>
            <textarea
              value={parseText}
              onChange={e => { setParseText(e.target.value); setParseError('') }}
              onPaste={handlePaste}
              placeholder={'例如：\n日程表：计算机原理与嵌入式系统\n截止日期：2026/10/12 11:59 PM\n\n也可以直接在这里粘贴截图（如微信截图），自动 OCR 识别'}
              rows={4}
            />
          </div>
          {ocrBusy && <p className="parse-hint">正在识别图片文字，请稍候…</p>}
          {parseError && <p className="parse-error">{parseError}</p>}
          <div className="parse-actions">
            <button type="button" className="btn-popup" onClick={readClipboard}>
              读取剪贴板文字
            </button>
            <button type="button" className="btn-popup" onClick={readClipboardImage} disabled={ocrBusy}>
              识别剪贴板图片
            </button>
            <label className={`btn-popup file-btn ${ocrBusy ? 'disabled' : ''}`}>
              选择图片文件
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleImageFile(f)
                  e.target.value = ''
                }}
              />
            </label>
            <button type="button" className="btn-primary" onClick={handleRecognize}>
              识别并填入
            </button>
          </div>
          <p className="parse-hint">识别后可在下方表单中修改，确认无误再保存。</p>
        </div>
      )}

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
