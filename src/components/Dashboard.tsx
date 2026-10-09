import type { Schedule } from '../types'
import './Dashboard.css'

interface DashboardProps {
  upcomingSchedules: Schedule[]
}

export function Dashboard({ upcomingSchedules }: DashboardProps) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>欢迎使用桌面助手</h2>
        <p className="date">{dateStr}</p>
      </div>

      <div className="dashboard-cards">
        <div className="card">
          <div className="card-icon">📅</div>
          <div className="card-info">
            <span className="card-value">{upcomingSchedules.length}</span>
            <span className="card-label">待办日程</span>
          </div>
        </div>
        <div className="card">
          <div className="card-icon">⏰</div>
          <div className="card-info">
            <span className="card-value">
              {upcomingSchedules.filter(s => {
                const scheduleDate = new Date(s.date + 'T' + s.time)
                const diff = scheduleDate.getTime() - now.getTime()
                return diff > 0 && diff < 24 * 60 * 60 * 1000
              }).length}
            </span>
            <span className="card-label">今日提醒</span>
          </div>
        </div>
      </div>

      {upcomingSchedules.length > 0 && (
        <div className="upcoming-section">
          <h3>即将到来的日程</h3>
          <ul className="upcoming-list">
            {upcomingSchedules.slice(0, 5).map(schedule => (
              <li key={schedule.id} className="upcoming-item">
                <span className="upcoming-time">{schedule.time}</span>
                <span className="upcoming-title">{schedule.title}</span>
                <span className="upcoming-date">{schedule.date}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
