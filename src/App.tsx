import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'
import { ScheduleView } from './components/Schedule'
import { SystemTools } from './components/SystemTools'
import { useSchedule } from './hooks/useSchedule'
import type { ViewType } from './types'
import './App.css'

export function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard')
  const { schedules, upcomingSchedules, addSchedule, removeSchedule } = useSchedule()

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
          />
        )
      case 'tools':
        return <SystemTools />
    }
  }

  return (
    <div className="app">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <main className="main-content">{renderView()}</main>
    </div>
  )
}
