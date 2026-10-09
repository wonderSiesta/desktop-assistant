import { app, BrowserWindow, ipcMain, clipboard, dialog, screen, nativeImage } from 'electron'
import { join } from 'path'
import { exec } from 'child_process'
import { readdir, stat } from 'fs/promises'

let mainWindow: BrowserWindow | null = null
let popupWindow: BrowserWindow | null = null
let processCheckInterval: ReturnType<typeof setInterval> | null = null
let configuredApps: string[] = []
let initialProcesses: Set<string> = new Set()

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

  mainWindow.on('closed', () => {
    mainWindow = null
    if (popupWindow && !popupWindow.isDestroyed()) popupWindow.close()
    if (processCheckInterval) clearInterval(processCheckInterval)
  })
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

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
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
