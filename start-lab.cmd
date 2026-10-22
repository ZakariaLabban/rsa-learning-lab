@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Python environment missing. Follow the setup instructions in README.md.
  pause
  exit /b 1
)
if not exist "frontend\dist\index.html" (
  echo Frontend build missing. Run npm.cmd ci and npm.cmd run build in frontend.
  pause
  exit /b 1
)
echo RSA Lab: http://127.0.0.1:8765
echo Keep this window open. Press Ctrl+C to stop the local server.
".venv\Scripts\python.exe" -m uvicorn backend.app:app --host 127.0.0.1 --port 8765
if errorlevel 1 pause
