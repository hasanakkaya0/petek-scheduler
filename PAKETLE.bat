@echo off
chcp 65001 >nul
cd /d "%~dp0"
node paketle.js
echo.
pause
