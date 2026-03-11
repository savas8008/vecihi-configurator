@echo off
title ELRS Backpack Proxy
color 0A

:loop
echo.
echo ============================================
echo   ELRS Backpack Proxy Baslatiliyor...
echo ============================================
echo.

python D:\xflightconfigurator\elrs_backpack_proxy.py

echo.
echo [!] Proxy kapandi. 3 saniye sonra yeniden baslatiliyor...
echo     Kapatmak icin bu pencereyi kapatin.
echo.
timeout /t 3 /nobreak >nul
goto loop
