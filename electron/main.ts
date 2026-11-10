import { app, BrowserWindow, ipcMain, clipboard, dialog, screen, nativeImage, Tray, Menu, globalShortcut, shell, Notification } from 'electron'
import { join } from 'path'
import { exec, execFile } from 'child_process'
import { readdir, stat, writeFile, readFile } from 'fs/promises'

let mainWindow: BrowserWindow | null = null
let popupWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let processCheckInterval: ReturnType<typeof setInterval> | null = null
let configuredApps: string[] = []
let initialProcesses: Set<string> = new Set()

// 全局快捷键（多个，按 id 管理）
type HotkeyId = 'schedule-popup' | 'app-launcher' | 'clipboard'
interface HotkeyEntry { enabled: boolean; accelerator: string }
const DEFAULT_HOTKEYS: Record<HotkeyId, string> = {
  'schedule-popup': 'CommandOrControl+O',
  'app-launcher': 'CommandOrControl+Alt+L',
  'clipboard': 'CommandOrControl+Alt+V',
}
const HOTKEY_IDS: HotkeyId[] = ['schedule-popup', 'app-launcher', 'clipboard']
// 新快捷键默认启用，日程弹窗快捷键保持默认关闭（沿用既有行为）
const DEFAULT_ENABLED: Record<HotkeyId, boolean> = {
  'schedule-popup': false,
  'app-launcher': true,
  'clipboard': true,
}
let hotkeys: Record<HotkeyId, HotkeyEntry> = {
  'schedule-popup': { enabled: DEFAULT_ENABLED['schedule-popup'], accelerator: DEFAULT_HOTKEYS['schedule-popup'] },
  'app-launcher': { enabled: DEFAULT_ENABLED['app-launcher'], accelerator: DEFAULT_HOTKEYS['app-launcher'] },
  'clipboard': { enabled: DEFAULT_ENABLED['clipboard'], accelerator: DEFAULT_HOTKEYS['clipboard'] },
}
let hotkeyConfigPath = ''

// 日程提醒（主进程调度 + 系统通知）
interface ScheduleItem {
  id: string
  title: string
  date: string
  time: string
  completed?: boolean
}
type ReminderStage = 'pre' | 'exact'
let schedulesCache: ScheduleItem[] = []
let remindersEnabled = true
let reminderState: Record<string, Partial<Record<ReminderStage, boolean>>> = {}
let reminderStatePath = ''
let reminderTimer: ReturnType<typeof setInterval> | null = null
const PRE_LEAD_MS = 10 * 60 * 1000      // 提前 10 分钟预告
const EXACT_GRACE_MS = 5 * 60 * 1000    // 准点提醒的宽限窗口，超过则不再补弹
const REMINDER_TICK_MS = 20 * 1000

// 剪贴板历史（主进程持续监听，独立于渲染界面）
interface ClipboardEntry {
  id: string
  type: 'text' | 'image'
  content: string
  timestamp: number
}
let clipboardHistory: ClipboardEntry[] = []
let clipboardHistoryPath = ''
let clipboardLastSeen: string | null = null
let clipboardInterval: ReturnType<typeof setInterval> | null = null
const MAX_TEXT_ENTRIES = 100
const MAX_IMAGE_ENTRIES = 20

async function getRunningProcesses(): Promise<Set<string>> {
  const output = await new Promise<string>((resolve, reject) => {
    exec('tasklist /FO CSV /NH', { encoding: 'utf8', windowsHide: true }, (err, stdout) => {
      if (err) reject(err)
      else resolve(stdout)
    })
  })
  return new Set(
    output.split('\n')
      .map(line => {
        const match = line.match(/^"([^"]+)"/)
        return match ? match[1].toLowerCase().replace('.exe', '') : ''
      })
      .filter(Boolean)
  )
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    frame: false,
    resizable: true,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('close', (e) => {
    if (isQuitting) return
    e.preventDefault()
    dialog.showMessageBox(mainWindow!, {
      type: 'question',
      buttons: ['关闭应用', '后台运行'],
      defaultId: 0,
      cancelId: 1,
      title: '关闭桌面助手',
      message: '要关闭应用，还是让它在后台继续运行？',
      detail: '选择「后台运行」后窗口会隐藏，剪贴板监听等功能继续工作，可从系统托盘图标重新打开。',
    }).then(({ response }) => {
      if (response === 0) {
        isQuitting = true
        app.quit()
      } else {
        mainWindow?.hide()
      }
    }).catch(() => {
      mainWindow?.hide()
    })
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    if (popupWindow && !popupWindow.isDestroyed()) popupWindow.close()
    if (processCheckInterval) clearInterval(processCheckInterval)
  })
}

function createTrayIcon(): Electron.NativeImage {
  const size = 16
  const buffer = Buffer.alloc(size * size * 4)
  const cx = (size - 1) / 2
  const cy = (size - 1) / 2
  const radius = size / 2 - 1
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      if (dist <= radius) {
        // #4a9eff in BGRA order
        buffer[i] = 0xff     // B
        buffer[i + 1] = 0x9e // G
        buffer[i + 2] = 0x4a // R
        buffer[i + 3] = 0xff // A
      }
    }
  }
  return nativeImage.createFromBitmap(buffer, { width: size, height: size })
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  if (!mainWindow.isVisible()) mainWindow.show()
  mainWindow.focus()
}

function createTray() {
  if (tray) return
  tray = new Tray(createTrayIcon())
  tray.setToolTip('桌面助手')
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => showMainWindow() },
    { type: 'separator' },
    { label: '退出', click: () => { isQuitting = true; app.quit() } },
  ])
  tray.setContextMenu(contextMenu)
  tray.on('click', () => showMainWindow())
  tray.on('double-click', () => showMainWindow())
}

function createPopupWindow() {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.focus()
    return
  }

  const display = screen.getPrimaryDisplay()
  const { width } = display.workAreaSize

  popupWindow = new BrowserWindow({
    width: 320,
    height: 400,
    x: width - 340,
    y: 20,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const popupUrl = process.env.VITE_DEV_SERVER_URL
    ? `${process.env.VITE_DEV_SERVER_URL}?view=popup`
    : join(__dirname, '../dist/index.html')

  if (process.env.VITE_DEV_SERVER_URL) {
    popupWindow.loadURL(popupUrl)
  } else {
    popupWindow.loadFile(popupUrl, { query: { view: 'popup' } })
  }

  popupWindow.on('closed', () => {
    popupWindow = null
    stopProcessCheck()
  })
}

function togglePopupWindow() {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close()
    stopProcessCheck()
  } else {
    createPopupWindow()
  }
}

async function loadHotkeyConfig() {
  hotkeyConfigPath = join(app.getPath('userData'), 'hotkey-config.json')
  try {
    const raw = await readFile(hotkeyConfigPath, 'utf-8')
    const cfg = JSON.parse(raw)
    // 旧格式 { enabled, accelerator } 迁移到 schedule-popup
    if (typeof cfg.enabled === 'boolean') hotkeys['schedule-popup'].enabled = cfg.enabled
    if (typeof cfg.accelerator === 'string' && cfg.accelerator.trim()) hotkeys['schedule-popup'].accelerator = cfg.accelerator
    // 新格式 { [id]: { enabled, accelerator } }
    for (const id of HOTKEY_IDS) {
      const e = cfg[id]
      if (e && typeof e === 'object') {
        if (typeof e.enabled === 'boolean') hotkeys[id].enabled = e.enabled
        if (typeof e.accelerator === 'string' && e.accelerator.trim()) hotkeys[id].accelerator = e.accelerator
      }
    }
    if (typeof cfg.remindersEnabled === 'boolean') remindersEnabled = cfg.remindersEnabled
  } catch {
    // 首次运行，使用默认值
  }
}

async function persistHotkeyConfig() {
  if (!hotkeyConfigPath) return
  try {
    await writeFile(hotkeyConfigPath, JSON.stringify({ ...hotkeys, remindersEnabled }, null, 2), 'utf-8')
  } catch { /* ignore */ }
}

function focusTool(tool: 'launcher' | 'clipboard') {
  const send = (wasFocused: boolean) => {
    mainWindow?.webContents.send('navigate-tool', { tool, wasFocused })
  }
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    mainWindow!.webContents.once('did-finish-load', () => setTimeout(() => send(false), 200))
    return
  }
  const wasFocused = mainWindow.isVisible() && mainWindow.isFocused()
  if (!mainWindow.isVisible()) mainWindow.show()
  mainWindow.focus()
  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once('did-finish-load', () => setTimeout(() => send(wasFocused), 200))
  } else {
    send(wasFocused)
  }
}

function hotkeyAction(id: HotkeyId) {
  if (id === 'schedule-popup') togglePopupWindow()
  else if (id === 'app-launcher') focusTool('launcher')
  else if (id === 'clipboard') focusTool('clipboard')
}

function registerAllHotkeys(): { success: boolean; failed: HotkeyId[] } {
  globalShortcut.unregisterAll()
  const failed: HotkeyId[] = []
  for (const id of HOTKEY_IDS) {
    const entry = hotkeys[id]
    if (!entry.enabled || !entry.accelerator) continue
    const ok = globalShortcut.register(entry.accelerator, () => hotkeyAction(id))
    if (!ok) failed.push(id)
  }
  return { success: failed.length === 0, failed }
}

async function loadReminderState() {
  reminderStatePath = join(app.getPath('userData'), 'reminder-state.json')
  try {
    const raw = await readFile(reminderStatePath, 'utf-8')
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') reminderState = parsed
  } catch {
    reminderState = {}
  }
}

function persistReminderState() {
  if (!reminderStatePath) return
  writeFile(reminderStatePath, JSON.stringify(reminderState), 'utf-8').catch(() => { /* ignore */ })
}

function fireReminder(s: ScheduleItem, stage: ReminderStage) {
  const isPre = stage === 'pre'
  const body = `${isPre ? '10 分钟后' : '现在'}：${s.title}（${s.date} ${s.time}）`
  const notification = new Notification({
    title: isPre ? '日程即将开始' : '日程提醒',
    body,
  })
  notification.on('click', () => {
    showMainWindow()
    mainWindow?.webContents.send('navigate-schedule')
  })
  notification.show()
}

function reminderTick() {
  if (!remindersEnabled) return
  const now = Date.now()
  const activeIds = new Set<string>()
  let changed = false

  for (const s of schedulesCache) {
    if (s.completed) continue
    const t = new Date(`${s.date}T${s.time}`).getTime()
    if (isNaN(t)) continue
    activeIds.add(s.id)
    const st = reminderState[s.id] || (reminderState[s.id] = {})
    if (!st.pre && now >= t - PRE_LEAD_MS && now < t) {
      st.pre = true
      fireReminder(s, 'pre')
      changed = true
    }
    if (!st.exact && now >= t && now < t + EXACT_GRACE_MS) {
      st.exact = true
      fireReminder(s, 'exact')
      changed = true
    }
  }

  // 清理已删除日程的状态
  for (const id of Object.keys(reminderState)) {
    if (!activeIds.has(id)) {
      delete reminderState[id]
      changed = true
    }
  }

  if (changed) persistReminderState()
}

function startReminderScheduler() {
  if (reminderTimer) clearInterval(reminderTimer)
  reminderTick()
  reminderTimer = setInterval(reminderTick, REMINDER_TICK_MS)
}

function stopReminderScheduler() {
  if (reminderTimer) {
    clearInterval(reminderTimer)
    reminderTimer = null
  }
}

async function startProcessCheck(appNames: string[]) {
  configuredApps = appNames
  if (processCheckInterval) clearInterval(processCheckInterval)

  try {
    initialProcesses = await getRunningProcesses()
  } catch {
    initialProcesses = new Set()
  }

  processCheckInterval = setInterval(async () => {
    if (!configuredApps.length || !popupWindow || popupWindow.isDestroyed()) return

    try {
      const running = await getRunningProcesses()

      for (const app of configuredApps) {
        const appName = app.toLowerCase().replace('.exe', '')
        if (running.has(appName) && !initialProcesses.has(appName)) {
          if (popupWindow && !popupWindow.isDestroyed()) {
            popupWindow.close()
          }
          stopProcessCheck()
          break
        }
      }
    } catch {
      // tasklist failed, skip this check
    }
  }, 3000)
}

function stopProcessCheck() {
  if (processCheckInterval) {
    clearInterval(processCheckInterval)
    processCheckInterval = null
  }
}

function persistClipboardHistory() {
  if (!clipboardHistoryPath) return
  writeFile(clipboardHistoryPath, JSON.stringify(clipboardHistory), 'utf8').catch(() => {
    // 写入失败时，退化到只保留文本记录再试一次
    const textOnly = clipboardHistory.filter(e => e.type === 'text')
    writeFile(clipboardHistoryPath, JSON.stringify(textOnly), 'utf8').catch(() => { /* 放弃本次持久化 */ })
  })
}

async function loadClipboardHistory() {
  clipboardHistoryPath = join(app.getPath('userData'), 'clipboard-history.json')
  try {
    const raw = await readFile(clipboardHistoryPath, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) clipboardHistory = parsed
  } catch {
    clipboardHistory = []
  }
}

function addClipboardEntry(entry: ClipboardEntry) {
  clipboardHistory = [entry, ...clipboardHistory]
  if (entry.type === 'image') {
    let n = 0
    clipboardHistory = clipboardHistory.filter(e => e.type !== 'image' || ++n <= MAX_IMAGE_ENTRIES)
  } else {
    let n = 0
    clipboardHistory = clipboardHistory.filter(e => e.type !== 'text' || ++n <= MAX_TEXT_ENTRIES)
  }
  persistClipboardHistory()
}

function pollClipboard() {
  // 图片优先：剪贴板含图片时按图片记录
  const image = clipboard.readImage()
  if (!image.isEmpty()) {
    const dataUrl = image.toDataURL()
    if (clipboardLastSeen === dataUrl) return
    clipboardLastSeen = dataUrl
    if (!clipboardHistory.some(e => e.type === 'image' && e.content === dataUrl)) {
      addClipboardEntry({ id: Date.now().toString(), type: 'image', content: dataUrl, timestamp: Date.now() })
    }
    return
  }

  const text = clipboard.readText()
  if (text && text.trim()) {
    if (clipboardLastSeen === text) return
    clipboardLastSeen = text
    if (!clipboardHistory.some(e => e.type === 'text' && e.content === text)) {
      addClipboardEntry({ id: Date.now().toString(), type: 'text', content: text, timestamp: Date.now() })
    }
  }
}

function startClipboardMonitor() {
  if (clipboardInterval) clearInterval(clipboardInterval)
  pollClipboard()
  clipboardInterval = setInterval(pollClipboard, 1500)
}

app.whenReady().then(async () => {
  await loadClipboardHistory()
  startClipboardMonitor()
  await loadHotkeyConfig()
  registerAllHotkeys()
  await loadReminderState()
  startReminderScheduler()
  createWindow()
  createTray()
})

app.on('window-all-closed', () => {
  if (!isQuitting && process.platform !== 'darwin') {
    // 窗口隐藏到后台时不退出应用
    if (tray) return
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  if (clipboardInterval) clearInterval(clipboardInterval)
  stopReminderScheduler()
  globalShortcut.unregisterAll()
  if (tray) { tray.destroy(); tray = null }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Window controls
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.on('window-close', () => mainWindow?.close())
ipcMain.on('window-hide', () => mainWindow?.hide())
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false)

// Popup window controls
ipcMain.on('popup-open', (_event, appNames: string[]) => {
  createPopupWindow()
  startProcessCheck(appNames)
})
ipcMain.on('popup-close', () => {
  if (popupWindow && !popupWindow.isDestroyed()) popupWindow.close()
  stopProcessCheck()
})
ipcMain.handle('popup-is-open', () => popupWindow !== null && !popupWindow.isDestroyed())

// 全局快捷键设置
ipcMain.handle('hotkey-get', () => hotkeys)
ipcMain.handle('hotkey-set', async (_event, id: HotkeyId, enabled: boolean, accelerator: string) => {
  if (!HOTKEY_IDS.includes(id)) return { success: false, error: '未知的快捷键' }
  const accel = (accelerator || '').trim() || DEFAULT_HOTKEYS[id]
  // 先尝试用新值注册，失败则回滚该项
  const prev = { ...hotkeys[id] }
  hotkeys[id] = { enabled, accelerator: accel }
  const { failed } = registerAllHotkeys()
  if (failed.includes(id)) {
    hotkeys[id] = prev
    registerAllHotkeys()
    return { success: false, error: '快捷键注册失败，可能已被其他程序占用' }
  }
  await persistHotkeyConfig()
  return { success: true, enabled: hotkeys[id].enabled, accelerator: hotkeys[id].accelerator }
})
// 录制时临时注销，避免系统吞掉按键；结束后恢复
ipcMain.on('hotkey-pause', () => globalShortcut.unregisterAll())
ipcMain.on('hotkey-resume', () => registerAllHotkeys())

// System tools: app launcher
// 使用 execFile 直接启动，不经 shell，避免命令注入。命令为可执行名（走 PATH）或完整路径。
ipcMain.handle('launch-app', async (_event, cmd: string) => {
  const command = (cmd || '').trim()
  if (!command) return { success: false, error: '命令为空' }
  return new Promise((resolve) => {
    const child = execFile(command, { windowsHide: true }, (err) => {
      if (err) resolve({ success: false, error: err.message })
    })
    child.unref?.()
    // 启动请求已发出即视为成功（GUI 进程独立运行，不等待其退出）
    setTimeout(() => resolve({ success: true }), 300)
  })
})

// 在资源管理器中定位文件
ipcMain.on('show-in-folder', (_event, path: string) => {
  if (typeof path === 'string' && path) shell.showItemInFolder(path)
})

// System tools: clipboard (text)
ipcMain.handle('clipboard-read', () => clipboard.readText())
ipcMain.handle('clipboard-write', (_event, text: string) => {
  clipboard.writeText(text)
  return true
})

// System tools: clipboard (image)
ipcMain.handle('clipboard-read-image', () => {
  const image = clipboard.readImage()
  if (image.isEmpty()) return null
  return image.toDataURL()
})

ipcMain.handle('clipboard-write-image', (_event, dataUrl: string) => {
  const image = nativeImage.createFromDataURL(dataUrl)
  if (image.isEmpty()) return false
  clipboard.writeImage(image)
  return true
})

// 剪贴板历史（由主进程持续维护）
ipcMain.handle('clipboard-history-get', () => clipboardHistory)
ipcMain.handle('clipboard-history-delete', (_event, id: string) => {
  clipboardHistory = clipboardHistory.filter(e => e.id !== id)
  persistClipboardHistory()
  return clipboardHistory
})
ipcMain.handle('clipboard-history-clear', () => {
  clipboardHistory = []
  persistClipboardHistory()
  return clipboardHistory
})
ipcMain.handle('clipboard-history-delete-before', (_event, cutoff: number) => {
  clipboardHistory = clipboardHistory.filter(e => e.timestamp > cutoff)
  persistClipboardHistory()
  return clipboardHistory
})

// System tools: file search
ipcMain.handle('file-search', async (_event, query: string) => {
  try {
    const { filePaths } = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: '选择搜索目录',
    })
    if (!filePaths.length) return []

    const results: { name: string; path: string; size: number }[] = []
    async function search(dir: string, depth: number) {
      if (depth > 3 || results.length >= 50) return
      try {
        const entries = await readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (results.length >= 50) break
          if (entry.name.startsWith('.')) continue
          const fullPath = join(dir, entry.name)
          if (entry.name.toLowerCase().includes(query.toLowerCase())) {
            try {
              const s = await stat(fullPath)
              results.push({ name: entry.name, path: fullPath, size: s.size })
            } catch { /* skip */ }
          }
          if (entry.isDirectory()) {
            await search(fullPath, depth + 1)
          }
        }
      } catch { /* skip permission errors */ }
    }
    await search(filePaths[0], 0)
    return results
  } catch {
    return []
  }
})

// Schedules (kept for IPC compatibility, actual storage is in localStorage)
ipcMain.handle('get-schedules', () => [])
ipcMain.handle('add-schedule', (_event, schedule) => schedule)

// 日程提醒：渲染层把日程列表同步给主进程调度器
ipcMain.on('schedules-sync', (_event, list: ScheduleItem[]) => {
  if (Array.isArray(list)) {
    schedulesCache = list
    reminderTick()
  }
})
ipcMain.handle('reminders-get', () => remindersEnabled)
ipcMain.handle('reminders-set', async (_event, enabled: boolean) => {
  remindersEnabled = !!enabled
  await persistHotkeyConfig()
  if (remindersEnabled) reminderTick()
  return remindersEnabled
})
