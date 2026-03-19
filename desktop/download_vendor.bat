@echo off
setlocal EnableDelayedExpansion
title X-Flight Configurator - Vendor Indirici

echo.
echo ============================================================
echo   X-Flight Configurator - Vendor Kutuphaneleri Indir
echo ============================================================
echo Bu script internetten gerekli kutuphaneleri indirir.
echo Sadece bir kez calistirmaniz yeterlidir.
echo.

:: Proje kokune git (bu script desktop\ altinda)
cd /d "%~dp0.."

where curl >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [HATA] curl bulunamadi! Windows 10+ gereklidir.
    pause
    exit /b 1
)

:: ─── Klasor yapisi ──────────────────────────────────────────────────────────
if not exist "vendor\bootstrap" mkdir "vendor\bootstrap"
if not exist "vendor\bootstrap-icons\fonts" mkdir "vendor\bootstrap-icons\fonts"
if not exist "vendor\chartjs" mkdir "vendor\chartjs"
if not exist "vendor\leaflet" mkdir "vendor\leaflet"
if not exist "vendor\threejs" mkdir "vendor\threejs"
if not exist "vendor\fonts" mkdir "vendor\fonts"

echo Kutuphaneler indiriliyor...
echo.

:: ─── Bootstrap CSS ──────────────────────────────────────────────────────────
echo  Bootstrap CSS...
curl -sL "https://raw.githubusercontent.com/twbs/bootstrap/v5.3.0-alpha1/dist/css/bootstrap.min.css" ^
    -o "vendor\bootstrap\bootstrap.min.css"

:: ─── Bootstrap Icons ────────────────────────────────────────────────────────
echo  Bootstrap Icons...
curl -sL "https://raw.githubusercontent.com/twbs/icons/v1.11.1/font/bootstrap-icons.css" ^
    -o "vendor\bootstrap-icons\bootstrap-icons.css"
curl -sL "https://raw.githubusercontent.com/twbs/icons/v1.11.1/font/fonts/bootstrap-icons.woff2" ^
    -o "vendor\bootstrap-icons\fonts\bootstrap-icons.woff2"
curl -sL "https://raw.githubusercontent.com/twbs/icons/v1.11.1/font/fonts/bootstrap-icons.woff" ^
    -o "vendor\bootstrap-icons\fonts\bootstrap-icons.woff"

:: ─── Chart.js ───────────────────────────────────────────────────────────────
echo  Chart.js...
curl -sL "https://raw.githubusercontent.com/chartjs/Chart.js/v4.4.0/dist/chart.umd.min.js" ^
    -o "vendor\chartjs\chart.umd.min.js"

:: ─── Leaflet ────────────────────────────────────────────────────────────────
echo  Leaflet.js...
curl -sL "https://raw.githubusercontent.com/Leaflet/Leaflet/v1.9.4/dist/leaflet.js" ^
    -o "vendor\leaflet\leaflet.js"
curl -sL "https://raw.githubusercontent.com/Leaflet/Leaflet/v1.9.4/dist/leaflet.css" ^
    -o "vendor\leaflet\leaflet.css"

:: ─── Three.js ───────────────────────────────────────────────────────────────
echo  Three.js r128...
curl -sL "https://raw.githubusercontent.com/mrdoob/three.js/r128/build/three.min.js" ^
    -o "vendor\threejs\three.min.js"
curl -sL "https://raw.githubusercontent.com/mrdoob/three.js/r128/examples/js/controls/OrbitControls.js" ^
    -o "vendor\threejs\OrbitControls.js"

:: ─── Fonts ──────────────────────────────────────────────────────────────────
echo  Fontlar (Inter, JetBrains Mono)...
curl -sL "https://raw.githubusercontent.com/rsms/inter/v4.0/docs/font-files/Inter-Light.woff2" ^
    -o "vendor\fonts\Inter-Light.woff2"
curl -sL "https://raw.githubusercontent.com/rsms/inter/v4.0/docs/font-files/Inter-Regular.woff2" ^
    -o "vendor\fonts\Inter-Regular.woff2"
curl -sL "https://raw.githubusercontent.com/rsms/inter/v4.0/docs/font-files/Inter-SemiBold.woff2" ^
    -o "vendor\fonts\Inter-SemiBold.woff2"
curl -sL "https://raw.githubusercontent.com/JetBrains/JetBrainsMono/v2.304/fonts/webfonts/JetBrainsMono-Regular.woff2" ^
    -o "vendor\fonts\JetBrainsMono-Regular.woff2"
curl -sL "https://raw.githubusercontent.com/JetBrains/JetBrainsMono/v2.304/fonts/webfonts/JetBrainsMono-Bold.woff2" ^
    -o "vendor\fonts\JetBrainsMono-Bold.woff2"

:: Font CSS dosyasi
echo @font-face { font-family: 'Inter'; font-weight: 300; src: url('Inter-Light.woff2') format('woff2'); } > "vendor\fonts\fonts.css"
echo @font-face { font-family: 'Inter'; font-weight: 400; src: url('Inter-Regular.woff2') format('woff2'); } >> "vendor\fonts\fonts.css"
echo @font-face { font-family: 'Inter'; font-weight: 600; src: url('Inter-SemiBold.woff2') format('woff2'); } >> "vendor\fonts\fonts.css"
echo @font-face { font-family: 'JetBrains Mono'; font-weight: 400; src: url('JetBrainsMono-Regular.woff2') format('woff2'); } >> "vendor\fonts\fonts.css"
echo @font-face { font-family: 'JetBrains Mono'; font-weight: 700; src: url('JetBrainsMono-Bold.woff2') format('woff2'); } >> "vendor\fonts\fonts.css"

echo.
echo ============================================================
echo   Vendor kutuphaneleri indirildi!
echo   Simdi desktop\build.bat calistirarak exe olusturabilirsiniz.
echo ============================================================
echo.
pause
endlocal
