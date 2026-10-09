import { useState, useEffect, useRef } from 'react'
import type { LauncherApp, ClipboardEntry } from '../types'
import './SystemTools.css'

type ToolView = 'menu' | 'launcher' | 'clipboard' | 'file-search' | 'notes'

const LAUNCHER_KEY = 'desktop-assistant-launcher-apps'
const CLIPBOARD_KEY = 'desktop-assistant-clipboard-history'
const NOTES_KEY = 'desktop-assistant-notes'

const DEFAULT_APPS: LauncherApp[] = [
  { key: 'notepad', name: '记事本', icon: '📝', command: 'notepad.exe' },
  { key: 'calculator', name: '计算器', icon: '🔢', command: 'calc.exe' },
  { key: 'paint', name: '画图', icon: '🎨', command: 'mspaint.exe' },
  { key: 'explorer', name: '文件管理器', icon: '📁', command: 'explorer.exe' },
  { key: 'cmd', name: '命令提示符', icon: '⬛', command: 'cmd.exe' },
  { key: 'task-manager', name: '任务管理器', icon: '📊', command: 'taskmgr.exe' },
  { key: 'snipping-tool', name: '截图工具', icon: '✂️', command: 'snippingtool.exe' },
  { key: 'control-panel', name: '控制面板', icon: '⚙️', command: 'control.exe' },
]

const ICONS = ['📝', '🔢', '🎨', '📁', '⬛', '📊', '✂️', '⚙️', '🌐', '📧', '🎵', '🎮', '💬', '📷', '🔧', '📦']

function AppLauncher() {
  const [apps, setApps] = useState<LauncherApp[]>(() => {
    const saved = localStorage.getItem(LAUNCHER_KEY)
    return saved ? JSON.parse(saved) : DEFAULT_APPS
  })
  const [status, setStatus] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCommand, setNewCommand] = useState('')
  const [newIcon, setNewIcon] = useState('🚀')

  const saveApps = (list: LauncherApp[]) => {
    setApps(list)
    localStorage.setItem(LAUNCHER_KEY, JSON.stringify(list))
  }

  const launch = async (app: LauncherApp) => {
    const result = await window.electronAPI?.launchApp(app.command)
    if (result?.success) {
      setStatus(`已启动 ${app.name}`)
      setTimeout(() => setStatus(''), 2000)
    } else {
      setStatus(`启动失败: ${result?.error || '未知错误'}`)
      setTimeout(() => setStatus(''), 3000)
    }
  }

  const addApp = () => {
    if (!newName.trim() || !newCommand.trim()) return
    const app: LauncherApp = {
      key: Date.now().toString(),
      name: newName.trim(),
      icon: newIcon,
      command: newCommand.trim(),
    }
    saveApps([...apps, app])
    setNewName('')
    setNewCommand('')
    setShowAdd(false)
  }

  const removeApp = (key: string) => {
    saveApps(apps.filter(a => a.key !== key))
  }

  const resetDefaults = () => {
    saveApps(DEFAULT_APPS)
  }

  return (
    <div className="tool-panel">
      <div className="tool-panel-header">
        <h3>应用启动器</h3>
        <div className="tool-panel-actions">
          <button className="btn-secondary" onClick={resetDefaults}>恢复默认</button>
          <button className="btn-primary" onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? '取消' : '+ 添加应用'}
          </button>
        </div>
      </div>
      {status && <div className="tool-status">{status}</div>}
      {showAdd && (
        <div className="add-app-form">
          <div className="form-row-2">
            <div className="form-field">
              <label>应用名称</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="例如：微信"
              />
            </div>
            <div className="form-field">
              <label>启动命令</label>
              <input
                type="text"
                value={newCommand}
                onChange={e => setNewCommand(e.target.value)}
                placeholder="例如：WeChat.exe 或完整路径"
              />
            </div>
          </div>
          <div className="form-field">
            <label>选择图标</label>
            <div className="icon-picker">
              {ICONS.map(icon => (
                <button
                  key={icon}
                  className={`icon-option ${newIcon === icon ? 'active' : ''}`}
                  onClick={() => setNewIcon(icon)}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <button className="btn-primary" onClick={addApp} disabled={!newName.trim() || !newCommand.trim()}>
            确认添加
          </button>
        </div>
      )}
      <div className="app-grid">
        {apps.map(app => (
          <div key={app.key} className="app-cell">
            <button className="app-btn" onClick={() => launch(app)}>
              <span className="app-icon">{app.icon}</span>
              <span>{app.name}</span>
            </button>
            <button className="app-remove" onClick={() => removeApp(app.key)} title="移除">×</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function ClipboardManager() {
  const [history, setHistory] = useState<ClipboardEntry[]>(() => {
    const saved = localStorage.getItem(CLIPBOARD_KEY)
    return saved ? JSON.parse(saved) : []
  })
  const [input, setInput] = useState('')
  const [status, setStatus] = useState('')
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const historyRef = useRef(history)
  historyRef.current = history
  const lastSeenRef = useRef<string | null>(null)

  const saveHistory = (entries: ClipboardEntry[]) => {
    setHistory(entries)
    try {
      localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(entries))
    } catch {
      const textOnly = entries.filter(e => e.type === 'text')
      localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(textOnly))
      setHistory(textOnly)
    }
  }

  useEffect(() => {
    const poll = async () => {
      const current = historyRef.current

      const imageData = await window.electronAPI?.clipboardReadImage()
      if (imageData) {
        if (lastSeenRef.current === imageData) return
        lastSeenRef.current = imageData
        const exists = current.some(e => e.type === 'image' && e.content === imageData)
        if (!exists) {
          const entry: ClipboardEntry = {
            id: Date.now().toString(),
            type: 'image',
            content: imageData,
            timestamp: Date.now(),
          }
          saveHistory([entry, ...current].slice(0, 50))
        }
        return
      }

      const text = await window.electronAPI?.clipboardRead()
      if (text && text.trim()) {
        if (lastSeenRef.current === text) return
        lastSeenRef.current = text
        const exists = current.some(e => e.type === 'text' && e.content === text)
        if (!exists) {
          const entry: ClipboardEntry = {
            id: Date.now().toString(),
            type: 'text',
            content: text,
            timestamp: Date.now(),
          }
          saveHistory([entry, ...current].slice(0, 100))
        }
      }
    }

    poll()
    const interval = setInterval(poll, 1500)
    return () => clearInterval(interval)
  }, [])

  const copyText = async () => {
    if (!input.trim()) return
    await window.electronAPI?.clipboardWrite(input)
    setStatus('已复制到剪贴板')
    setInput('')
    setTimeout(() => setStatus(''), 2000)
  }

  const copyEntry = async (entry: ClipboardEntry) => {
    if (entry.type === 'text') {
      await window.electronAPI?.clipboardWrite(entry.content)
      setStatus('已复制文本到剪贴板')
    } else {
      const ok = await window.electronAPI?.clipboardWriteImage(entry.content)
      setStatus(ok ? '已复制图片到剪贴板' : '图片复制失败')
    }
    setTimeout(() => setStatus(''), 2000)
  }

  const deleteEntry = (id: string) => {
    saveHistory(history.filter(e => e.id !== id))
  }

  const deleteAll = () => {
    saveHistory([])
  }

  const deleteOlderThan = (ms: number) => {
    const cutoff = Date.now() - ms
    saveHistory(history.filter(e => e.timestamp > cutoff))
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  return (
    <div className="tool-panel">
      <h3>剪贴板管理</h3>
      {status && <div className="tool-status">{status}</div>}

      <div className="clipboard-capture">
        <span className="monitoring-badge">● 自动监听中</span>
        <button className="btn-hint" onClick={() => setShowHint(!showHint)} title="功能说明">?</button>
        {showHint && <span className="capture-hint">自动检测剪贴板变化，新内容立刻记录，相同内容只记录一次。</span>}
      </div>

      <div className="clipboard-write">
        <label>写入新内容</label>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="输入要复制的文本..."
          rows={3}
        />
        <button className="btn-primary" onClick={copyText} disabled={!input.trim()}>
          复制到剪贴板
        </button>
      </div>

      <div className="clipboard-history">
        <div className="history-header">
          <label>历史记录 ({history.length})</label>
          <div className="history-actions">
            <select onChange={e => {
              const val = e.target.value
              if (val === 'all') deleteAll()
              else if (val === '1d') deleteOlderThan(24 * 60 * 60 * 1000)
              else if (val === '7d') deleteOlderThan(7 * 24 * 60 * 60 * 1000)
              else if (val === '30d') deleteOlderThan(30 * 24 * 60 * 60 * 1000)
              e.target.value = ''
            }} defaultValue="">
              <option value="" disabled>批量删除</option>
              <option value="1d">删除1天前</option>
              <option value="7d">删除7天前</option>
              <option value="30d">删除30天前</option>
              <option value="all">全部删除</option>
            </select>
          </div>
        </div>
        <div className="history-list">
          {history.length === 0 ? (
            <p className="history-empty">暂无记录</p>
          ) : (
            history.map(entry => (
              <div key={entry.id} className="history-item">
                <div className="history-item-header">
                  <span className="history-time">{formatTime(entry.timestamp)}</span>
                  <span className="history-type">{entry.type === 'image' ? '🖼️ 图片' : '📄 文本'}</span>
                </div>
                {entry.type === 'text' ? (
                  <div className="history-text">{entry.content}</div>
                ) : (
                  <img
                    className="history-image"
                    src={entry.content}
                    alt="剪贴板图片"
                    onClick={() => setPreviewImage(previewImage === entry.id ? null : entry.id)}
                  />
                )}
                {previewImage === entry.id && entry.type === 'image' && (
                  <div className="image-preview-overlay" onClick={() => setPreviewImage(null)}>
                    <img src={entry.content} alt="预览" />
                  </div>
                )}
                <div className="history-item-actions">
                  <button className="btn-small" onClick={() => copyEntry(entry)}>复制</button>
                  <button className="btn-small btn-danger" onClick={() => deleteEntry(entry.id)}>删除</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function FileSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ name: string; path: string; size: number }[]>([])
  const [searching, setSearching] = useState(false)

  const search = async () => {
    if (!query.trim()) return
    setSearching(true)
    const res = await window.electronAPI?.fileSearch(query)
    setResults(res || [])
    setSearching(false)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="tool-panel">
      <h3>文件搜索</h3>
      <div className="search-bar">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="输入文件名关键词..."
          onKeyDown={e => e.key === 'Enter' && search()}
        />
        <button className="btn-primary" onClick={search} disabled={searching}>
          {searching ? '搜索中...' : '搜索'}
        </button>
      </div>
      {results.length > 0 && (
        <div className="search-results">
          <span className="results-count">找到 {results.length} 个结果</span>
          {results.map((r, i) => (
            <div key={i} className="search-result-item">
              <span className="result-name">{r.name}</span>
              <span className="result-size">{formatSize(r.size)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function QuickNotes() {
  const [notes, setNotes] = useState(() => localStorage.getItem(NOTES_KEY) || '')

  const save = (value: string) => {
    setNotes(value)
    localStorage.setItem(NOTES_KEY, value)
  }

  return (
    <div className="tool-panel">
      <h3>快速笔记</h3>
      <textarea
        className="notes-textarea"
        value={notes}
        onChange={e => save(e.target.value)}
        placeholder="随手记录想法..."
        rows={15}
      />
      <div className="notes-footer">
        <span>{notes.length} 字</span>
        <span>自动保存</span>
      </div>
    </div>
  )
}

export function SystemTools() {
  const [activeTool, setActiveTool] = useState<ToolView>('menu')

  const renderTool = () => {
    switch (activeTool) {
      case 'launcher': return <AppLauncher />
      case 'clipboard': return <ClipboardManager />
      case 'file-search': return <FileSearch />
      case 'notes': return <QuickNotes />
    }
  }

  if (activeTool !== 'menu') {
    return (
      <div className="system-tools">
        <button className="btn-back" onClick={() => setActiveTool('menu')}>
          ← 返回
        </button>
        {renderTool()}
      </div>
    )
  }

  return (
    <div className="system-tools">
      <h2>系统工具</h2>
      <div className="tools-grid">
        <div className="tool-card" onClick={() => setActiveTool('launcher')}>
          <span className="tool-icon">🚀</span>
          <span className="tool-name">应用启动器</span>
          <span className="tool-desc">快速启动常用应用</span>
        </div>
        <div className="tool-card" onClick={() => setActiveTool('clipboard')}>
          <span className="tool-icon">📋</span>
          <span className="tool-name">剪贴板管理</span>
          <span className="tool-desc">文本和图片历史记录</span>
        </div>
        <div className="tool-card" onClick={() => setActiveTool('file-search')}>
          <span className="tool-icon">🔍</span>
          <span className="tool-name">文件搜索</span>
          <span className="tool-desc">快速查找文件</span>
        </div>
        <div className="tool-card" onClick={() => setActiveTool('notes')}>
          <span className="tool-icon">📝</span>
          <span className="tool-name">快速笔记</span>
          <span className="tool-desc">随手记录想法</span>
        </div>
      </div>
    </div>
  )
}
