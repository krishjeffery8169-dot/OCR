@echo off
chcp 65001 >nul
start "模型截题网页服务" powershell -NoExit -ExecutionPolicy Bypass -Command "Set-Location -LiteralPath '%~dp0'; npm install; npm run dev"
timeout /t 8 /nobreak >nul
start "" "http://localhost:5173/model-crop"
