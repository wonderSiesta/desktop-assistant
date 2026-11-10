import type { ViewType } from '../types'
import './Sidebar.css'

interface SidebarProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <button
          className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
          onClick={() => onViewChange('dashboard')}
        >
          <span className="nav-icon">🏠</span>
          <span>仪表盘</span>
        </button>
        <button
          className={`nav-item ${currentView === 'schedule' ? 'active' : ''}`}
          onClick={() => onViewChange('schedule')}
        >
          <span className="nav-icon">📅</span>
          <span>日程安排</span>
        </button>
        <button
          className={`nav-item ${currentView === 'tools' ? 'active' : ''}`}
          onClick={() => onViewChange('tools')}
        >
          <span className="nav-icon">🔧</span>
          <span>系统工具</span>
        </button>
        <button
          className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
          onClick={() => onViewChange('settings')}
        >
          <span className="nav-icon">⚙️</span>
          <span>设置</span>
        </button>
      </nav>
    </aside>
  )
}
