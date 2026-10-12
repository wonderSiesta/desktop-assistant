import { app, BrowserWindow, ipcMain, clipboard, dialog, screen, nativeImage, Tray, Menu, globalShortcut } from 'electron'
import { join } from 'path'
import { exec } from 'child_process'
import { readdir, stat, writeFile, readFile } from 'fs/promises'

let mainWindow: BrowserWindow | null = null
let popupWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let processCheckInterval: ReturnType<typeof setInterval> | null = null
let configuredApps: string[] = []
let initialProcesses: Set<string> = new Set()

// 全局快捷键（切换日程弹窗）
const DEFAULT_HOTKEY = 'CommandOrControl+O'
let hotkeyEnabled = false
let hotkeyAccelerator = DEFAULT_HOTKEY
let hotkeyConfigPath = ''

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
    if (typeof cfg.enabled === 'boolean') hotkeyEnabled = cfg.enabled
    if (typeof cfg.accelerator === 'string' && cfg.accelerator.trim()) hotkeyAccelerator = cfg.accelerator
  } catch {
    // 首次运行，使用默认值
  }
}

async function persistHotkeyConfig() {
  if (!hotkeyConfigPath) return
  try {
    await writeFile(hotkeyConfigPath, JSON.stringify({ enabled: hotkeyEnabled, accelerator: hotkeyAccelerator }, null, 2), 'utf-8')
  } catch { /* ignore */ }
}

function applyHotkey(): { success: boolean; error?: string } {
  globalShortcut.unregisterAll()
  if (!hotkeyEnabled || !hotkeyAccelerator) return { success: true }
  const ok = globalShortcut.register(hotkeyAccelerator, togglePopupWindow)
  return ok ? { success: true } : { success: false, error: '快捷键注册失败，可能已被其他程序占用' }
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
  applyHotkey()
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
ipcMain.handle('hotkey-get', () => ({ enabled: hotkeyEnabled, accelerator: hotkeyAccelerator }))
ipcMain.handle('hotkey-set', async (_event, enabled: boolean, accelerator: string) => {
  const accel = (accelerator || '').trim() || DEFAULT_HOTKEY
  // 先尝试用新值注册，失败则回滚
  const prevEnabled = hotkeyEnabled
  const prevAccel = hotkeyAccelerator
  hotkeyEnabled = enabled
  hotkeyAccelerator = accel
  const result = applyHotkey()
  if (!result.success) {
    hotkeyEnabled = prevEnabled
    hotkeyAccelerator = prevAccel
    applyHotkey()
    return result
  }
  await persistHotkeyConfig()
  return { success: true, enabled: hotkeyEnabled, accelerator: hotkeyAccelerator }
})
// 录制时临时注销，避免系统吞掉按键；结束后恢复
ipcMain.on('hotkey-pause', () => globalShortcut.unregisterAll())
ipcMain.on('hotkey-resume', () => applyHotkey())

// System tools: app launcher
ipcMain.handle('launch-app', async (_event, cmd: string) => {
  return new Promise((resolve) => {
    exec(`start ${cmd}`, (err) => {
      resolve(err ? { success: false, error: err.message } : { success: true })
    })
  })
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
