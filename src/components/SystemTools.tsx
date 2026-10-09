import './SystemTools.css'

export function SystemTools() {
  return (
    <div className="system-tools">
      <h2>系统工具</h2>
      <div className="tools-grid">
        <div className="tool-card">
          <span className="tool-icon">🚀</span>
          <span className="tool-name">应用启动器</span>
          <span className="tool-desc">快速启动常用应用</span>
        </div>
        <div className="tool-card">
          <span className="tool-icon">📋</span>
          <span className="tool-name">剪贴板管理</span>
          <span className="tool-desc">查看历史记录</span>
        </div>
        <div className="tool-card">
          <span className="tool-icon">🔍</span>
          <span className="tool-name">文件搜索</span>
          <span className="tool-desc">快速查找文件</span>
        </div>
        <div className="tool-card">
          <span className="tool-icon">📝</span>
          <span className="tool-name">快速笔记</span>
          <span className="tool-desc">随手记录想法</span>
        </div>
      </div>
    </div>
  )
}
