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
const DEFAULT_HOTKEY = 'Ctrl+O'

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

  // 全局快捷键
  const [hotkeyEnabled, setHotkeyEnabled] = useState(false)
  const [hotkeyAccel, setHotkeyAccel] = useState(DEFAULT_HOTKEY)
  const [recording, setRecording] = useState(false)
  const [hotkeyStatus, setHotkeyStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    window.electronAPI?.hotkeyGet().then(cfg => {
      if (cfg) {
        setHotkeyEnabled(cfg.enabled)
        setHotkeyAccel(normalizeAccel(cfg.accelerator))
      }
    })
  }, [])

  const applyHotkey = async (enabled: boolean, accel: string) => {
    const res = await window.electronAPI?.hotkeySet(enabled, accel)
    if (res?.success) {
      setHotkeyEnabled(enabled)
      setHotkeyAccel(accel)
      setHotkeyStatus({ type: 'ok', text: enabled ? `已启用：${displayAccel(accel)}` : '已关闭快捷键' })
    } else {
      setHotkeyStatus({ type: 'err', text: res?.error || '设置失败' })
    }
    setTimeout(() => setHotkeyStatus(null), 3000)
  }

  // 录制快捷键
  useEffect(() => {
    if (!recording) return
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
      setRecording(false)
      applyHotkey(hotkeyEnabled, accel)
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      // 取消录制（未捕获到组合键）时恢复原快捷键
      window.electronAPI?.hotkeyResume()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, hotkeyEnabled])

  const toggleEnabled = () => {
    applyHotkey(!hotkeyEnabled, hotkeyAccel)
  }

  const resetHotkey = () => {
    setRecording(false)
    applyHotkey(hotkeyEnabled, DEFAULT_HOTKEY)
  }

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
        <h3>日程弹窗快捷键</h3>
        <p className="settings-desc">按下快捷键可随时打开 / 关闭日程弹窗（默认 Ctrl + O）</p>
        <div className="hotkey-row">
          <label className="hotkey-toggle">
            <input type="checkbox" checked={hotkeyEnabled} onChange={toggleEnabled} />
            <span>启用快捷键</span>
          </label>
          <span className="hotkey-current">{displayAccel(hotkeyAccel)}</span>
        </div>
        <div className="hotkey-actions">
          <button
            className={`btn-popup ${recording ? 'active' : ''}`}
            onClick={() => { setRecording(r => !r); setHotkeyStatus(null) }}
            disabled={!hotkeyEnabled}
          >
            {recording ? '请按下组合键…' : '修改快捷键'}
          </button>
          <button className="btn-popup" onClick={resetHotkey} disabled={!hotkeyEnabled}>
            恢复默认 (Ctrl + O)
          </button>
        </div>
        {hotkeyStatus && (
          <p className={`hotkey-status ${hotkeyStatus.type}`}>{hotkeyStatus.text}</p>
        )}
        {!hotkeyEnabled && (
          <p className="hotkey-hint">勾选「启用快捷键」后即可自定义。</p>
        )}
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
