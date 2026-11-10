import { useState, useEffect } from 'react'
import './Settings.css'

interface SettingsProps {
  theme: string
  onThemeChange: (theme: string) => void
}

const THEMES = [
  { key: 'dark', name: '深色', color: '#1a1a2e' },
  { key: 'light', name: '浅色', color: '#f0f2f5' },
  { key: 'dark-blue', name: '深蓝', color: '#0a1628' },
  { key: 'dark-green', name: '墨绿', color: '#0a1a0a' },
  { key: 'warm', name: '暖棕', color: '#2a1a1a' },
  { key: 'purple', name: '紫色', color: '#1a0a2e' },
]

const POPUP_APPS_KEY = 'desktop-assistant-popup-apps'

const HOTKEY_DEFS: { id: string; label: string; def: string }[] = [
  { id: 'schedule-popup', label: '日程弹窗', def: 'Ctrl+O' },
  { id: 'app-launcher', label: '应用启动器', def: 'Ctrl+Alt+L' },
  { id: 'clipboard', label: '剪贴板管理', def: 'Ctrl+Alt+V' },
]

const KEY_MAP: Record<string, string> = {
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  ' ': 'Space', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab',
  PageUp: 'PageUp', PageDown: 'PageDown', Home: 'Home', End: 'End',
  Insert: 'Insert', Delete: 'Delete', Backspace: 'Backspace',
}

function normalizeAccel(accel: string): string {
  return accel.replace(/CommandOrControl|CmdOrCtrl/g, 'Ctrl').replace(/Super|Meta/g, 'Win')
}

function displayAccel(accel: string): string {
  return normalizeAccel(accel).split('+').join(' + ')
}

export function Settings({ theme, onThemeChange }: SettingsProps) {
  const [popupApps, setPopupApps] = useState<string[]>(() => {
    const saved = localStorage.getItem(POPUP_APPS_KEY)
    return saved ? JSON.parse(saved) : ['WeChat', 'QQ', 'chrome', 'msedge', 'Code']
  })
  const [newApp, setNewApp] = useState('')

  // 全局快捷键（多个，按 id 管理）
  const [hotkeys, setHotkeys] = useState<Record<string, { enabled: boolean; accelerator: string }>>({})
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [hotkeyStatus, setHotkeyStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // 日程提醒总开关
  const [remindersEnabled, setRemindersEnabled] = useState(true)

  useEffect(() => {
    window.electronAPI?.hotkeyGet().then(cfg => {
      if (cfg) setHotkeys(cfg)
    })
    window.electronAPI?.remindersGet().then(enabled => {
      if (typeof enabled === 'boolean') setRemindersEnabled(enabled)
    })
  }, [])

  const toggleReminders = async () => {
    const next = !remindersEnabled
    setRemindersEnabled(next)
    const saved = await window.electronAPI?.remindersSet(next)
    if (typeof saved === 'boolean') setRemindersEnabled(saved)
  }

  const applyHotkey = async (id: string, enabled: boolean, accel: string) => {
    const res = await window.electronAPI?.hotkeySet(id, enabled, accel)
    if (res?.success) {
      setHotkeys(prev => ({ ...prev, [id]: { enabled, accelerator: accel } }))
      setHotkeyStatus({ type: 'ok', text: enabled ? `已启用：${displayAccel(accel)}` : `已保存：${displayAccel(accel)}（未启用）` })
    } else {
      setHotkeyStatus({ type: 'err', text: res?.error || '设置失败' })
    }
    setTimeout(() => setHotkeyStatus(null), 3000)
  }

  // 录制快捷键
  useEffect(() => {
    if (!recordingId) return
    // 临时注销全局快捷键，否则系统会吞掉按键，无法录制
    window.electronAPI?.hotkeyPause()
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const parts: string[] = []
      if (e.ctrlKey) parts.push('Ctrl')
      if (e.metaKey) parts.push('Win')
      if (e.altKey) parts.push('Alt')
      if (e.shiftKey) parts.push('Shift')
      const k = e.key
      let key = ''
      if (/^[a-zA-Z]$/.test(k)) key = k.toUpperCase()
      else if (/^[0-9]$/.test(k)) key = k
      else if (/^F\d{1,2}$/i.test(k)) key = k.toUpperCase()
      else key = KEY_MAP[k] || ''
      if (!key || parts.length === 0) {
        setHotkeyStatus({ type: 'err', text: '请按下包含 Ctrl/Alt 等修饰键的组合' })
        return
      }
      const accel = [...parts, key].join('+')
      const id = recordingId
      setRecordingId(null)
      applyHotkey(id, hotkeys[id]?.enabled ?? false, accel)
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      // 取消录制（未捕获到组合键）时恢复原快捷键
      window.electronAPI?.hotkeyResume()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingId, hotkeys])

  const savePopupApps = (apps: string[]) => {
    setPopupApps(apps)
    localStorage.setItem(POPUP_APPS_KEY, JSON.stringify(apps))
  }

  const addPopupApp = () => {
    const name = newApp.trim()
    if (!name || popupApps.includes(name)) return
    savePopupApps([...popupApps, name])
    setNewApp('')
  }

  const removePopupApp = (name: string) => {
    savePopupApps(popupApps.filter(a => a !== name))
  }

  return (
    <div className="settings">
      <h2>设置</h2>

      <div className="settings-section">
        <h3>背景主题</h3>
        <div className="theme-grid">
          {THEMES.map(t => (
            <button
              key={t.key}
              className={`theme-card ${theme === t.key ? 'active' : ''}`}
              onClick={() => onThemeChange(t.key)}
            >
              <div className="theme-preview" style={{ background: t.color }} />
              <span>{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h3>全局快捷键</h3>
        <p className="settings-desc">按下快捷键快速打开对应功能；若窗口已在前台且正停留在该页，再按一次会隐藏到后台。每项可单独启用、自定义键位。</p>
        <div className="hotkey-list">
          {HOTKEY_DEFS.map(def => {
            const entry = hotkeys[def.id] || { enabled: false, accelerator: def.def }
            const isRecording = recordingId === def.id
            return (
              <div key={def.id} className="hotkey-item">
                <label className="hotkey-toggle">
                  <input
                    type="checkbox"
                    checked={entry.enabled}
                    onChange={() => applyHotkey(def.id, !entry.enabled, normalizeAccel(entry.accelerator))}
                  />
                  <span>{def.label}</span>
                </label>
                <span className="hotkey-current">{displayAccel(entry.accelerator)}</span>
                <div className="hotkey-item-actions">
                  <button
                    className={isRecording ? 'active' : ''}
                    onClick={() => { setRecordingId(isRecording ? null : def.id); setHotkeyStatus(null) }}
                  >
                    {isRecording ? '请按下组合键…' : '修改'}
                  </button>
                  <button onClick={() => { setRecordingId(null); applyHotkey(def.id, entry.enabled, def.def) }}>
                    恢复默认
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        {hotkeyStatus && (
          <p className={`hotkey-status ${hotkeyStatus.type}`}>{hotkeyStatus.text}</p>
        )}
      </div>

      <div className="settings-section">
        <h3>日程提醒</h3>
        <p className="settings-desc">到达日程时间时弹出系统通知，并提前 10 分钟预告一次。点击通知可跳转到日程页。</p>
        <label className="hotkey-toggle">
          <input type="checkbox" checked={remindersEnabled} onChange={toggleReminders} />
          <span>启用日程提醒</span>
        </label>
      </div>

      <div className="settings-section">
        <h3>日程弹窗自动关闭应用</h3>
        <p className="settings-desc">当以下应用启动时，日程弹窗将自动关闭</p>
        <div className="popup-apps-list">
          {popupApps.map(app => (
            <div key={app} className="popup-app-tag">
              <span>{app}</span>
              <button className="tag-remove" onClick={() => removePopupApp(app)}>×</button>
            </div>
          ))}
        </div>
        <div className="popup-app-add">
          <input
            type="text"
            value={newApp}
            onChange={e => setNewApp(e.target.value)}
            placeholder="输入应用名称（如 WeChat、chrome）"
            onKeyDown={e => e.key === 'Enter' && addPopupApp()}
          />
          <button className="btn-primary" onClick={addPopupApp} disabled={!newApp.trim()}>
            添加
          </button>
        </div>
      </div>
    </div>
  )
}
