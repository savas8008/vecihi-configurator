@echo off
:: Yönetici yetkisi iste
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Yonetici yetkisi gerekiyor, lutfen Evet deyin...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ============================================
echo   ELRS Firewall Kurali Ekleniyor...
echo ============================================
echo.

:: UDP 14550 portunu ac
netsh advfirewall firewall delete rule name="ELRS UDP 14550" >nul 2>&1
netsh advfirewall firewall add rule name="ELRS UDP 14550" dir=in action=allow protocol=UDP localport=14550
echo [OK] UDP port 14550 acildi

:: Python icin kural ekle (tum python surumlerini tara)
for /f "tokens=*" %%i in ('where python 2^>nul') do (
    netsh advfirewall firewall delete rule name="ELRS Python" program="%%i" >nul 2>&1
    netsh advfirewall firewall add rule name="ELRS Python" dir=in action=allow program="%%i" enable=yes
    echo [OK] Python izni verildi: %%i
)

:: Butun aglarda Python'a izin ver (Public + Private)
netsh advfirewall firewall set rule name="ELRS Python" new profile=any >nul 2>&1
netsh advfirewall firewall set rule name="ELRS UDP 14550" new profile=any >nul 2>&1

echo.
echo ============================================
echo   Tamamlandi! Bu pencereyi kapatin.
echo   Simdi ELRS_BASLAT.bat calistirin.
echo ============================================
echo.
pause
