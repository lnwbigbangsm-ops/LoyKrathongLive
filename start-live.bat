@echo off
chcp 65001 >nul
cd /d "%~dp0"
set /p TTUSER=TikTok username (without @), or type --test :
start "" http://localhost:8787
node bridge.mjs %TTUSER%
pause
