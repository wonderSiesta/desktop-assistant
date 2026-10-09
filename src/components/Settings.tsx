import { useState } from 'react'
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

export function Settings({ theme, onThemeChange }: SettingsProps) {
  const [popupApps, setPopupApps] = useState<string[]>(() => {
    const saved = localStorage.getItem(POPUP_APPS_KEY)
    return saved ? JSON.parse(saved) : ['WeChat', 'QQ', 'chrome', 'msedge', 'Code']
  })
  const [newApp, setNewApp] = useState('')

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
