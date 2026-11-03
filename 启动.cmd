@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1" -CreateShortcutOnly
if errorlevel 1 (
  pause
  exit /b 1
)
start "" "%~dp0DesktopAssistant.lnk"
exit /b 0
