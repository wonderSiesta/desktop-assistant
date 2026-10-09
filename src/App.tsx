import { useState, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'
import { ScheduleView } from './components/Schedule'
import { SystemTools } from './components/SystemTools'
import { Settings } from './components/Settings'
import { useSchedule } from './hooks/useSchedule'
import type { ViewType } from './types'
import './App.css'

const THEME_KEY = 'desktop-assistant-theme'

export function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard')
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark')
  const { schedules, upcomingSchedules, addSchedule, removeSchedule, toggleComplete } = useSchedule()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const handleMinimize = () => window.electronAPI?.minimize()
  const handleMaximize = () => window.electronAPI?.maximize()
  const handleClose = () => window.electronAPI?.close()

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard upcomingSchedules={upcomingSchedules} />
      case 'schedule':
        return (
          <ScheduleView
            schedules={schedules}
            onAdd={addSchedule}
            onRemove={removeSchedule}
            onToggleComplete={toggleComplete}
          />
        )
      case 'tools':
        return <SystemTools />
      case 'settings':
        return <Settings theme={theme} onThemeChange={setTheme} />
    }
  }

  return (
    <div className="app">
      <div className="titlebar">
        <div className="titlebar-drag">
          <span className="titlebar-title">桌面助手</span>
        </div>
        <div className="titlebar-controls">
          <button className="titlebar-btn" onClick={handleMinimize} title="最小化">
            <svg width="12" height="12" viewBox="0 0 12 12"><rect y="5" width="12" height="2" fill="currentColor" rx="1"/></svg>
          </button>
          <button className="titlebar-btn" onClick={handleMaximize} title="最大化">
            <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" stroke="currentColor" strokeWidth="1.5" fill="none" rx="1"/></svg>
          </button>
          <button className="titlebar-btn titlebar-btn-close" onClick={handleClose} title="关闭">
            <svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
      </div>
      <div className="app-body">
        <Sidebar currentView={currentView} onViewChange={setCurrentView} />
        <main className="main-content">{renderView()}</main>
      </div>
    </div>
  )
}
