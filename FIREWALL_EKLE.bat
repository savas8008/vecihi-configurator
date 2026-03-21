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

:: UDP 14550 portunu ac (backpack telemetri portu)
netsh advfirewall firewall delete rule name="ELRS UDP 14550" >nul 2>&1
netsh advfirewall firewall add rule name="ELRS UDP 14550" dir=in action=allow protocol=UDP localport=14550
netsh advfirewall firewall set rule name="ELRS UDP 14550" new profile=any >nul 2>&1
echo [OK] UDP port 14550 acildi (backpack telemetri)

:: UDP 14551 portunu ac (QGC/Mission Planner icin)
netsh advfirewall firewall delete rule name="ELRS UDP 14551" >nul 2>&1
netsh advfirewall firewall add rule name="ELRS UDP 14551" dir=in action=allow protocol=UDP localport=14551
netsh advfirewall firewall set rule name="ELRS UDP 14551" new profile=any >nul 2>&1
echo [OK] UDP port 14551 acildi (QGC/Mission Planner)

:: Python icin kural ekle (tum python surumlerini tara)
for /f "tokens=*" %%i in ('where python 2^>nul') do (
    netsh advfirewall firewall delete rule name="ELRS Python" program="%%i" >nul 2>&1
    netsh advfirewall firewall add rule name="ELRS Python" dir=in action=allow program="%%i" enable=yes
    echo [OK] Python izni verildi: %%i
)

:: Butun aglarda Python'a izin ver (Public + Private)
netsh advfirewall firewall set rule name="ELRS Python" new profile=any >nul 2>&1
netsh advfirewall firewall set rule name="ELRS UDP 14550" new profile=any >nul 2>&1

:: UDP 14555 portunu ac (backpack'e gonderilen heartbeat portu)
netsh advfirewall firewall delete rule name="ELRS UDP 14555" >nul 2>&1
netsh advfirewall firewall add rule name="ELRS UDP 14555" dir=in action=allow protocol=UDP localport=14555
netsh advfirewall firewall set rule name="ELRS UDP 14555" new profile=any >nul 2>&1
echo [OK] UDP port 14555 acildi (backpack heartbeat)

:: 10.0.0.1'den (ELRS backpack) gelen tum UDP'ye izin ver
netsh advfirewall firewall delete rule name="ELRS Backpack 10.0.0.1" >nul 2>&1
netsh advfirewall firewall add rule name="ELRS Backpack 10.0.0.1" dir=in action=allow protocol=UDP remoteip=10.0.0.1
netsh advfirewall firewall set rule name="ELRS Backpack 10.0.0.1" new profile=any >nul 2>&1
echo [OK] 10.0.0.1 kaynaklı UDP izinlendi (backpack telemetri)

:: 10.0.0.x alt agina cikis izni (bazen Public ag profili engeller)
netsh advfirewall firewall delete rule name="ELRS Outbound 10.0.0.x" >nul 2>&1
netsh advfirewall firewall add rule name="ELRS Outbound 10.0.0.x" dir=out action=allow protocol=UDP remoteip=10.0.0.0/24
netsh advfirewall firewall set rule name="ELRS Outbound 10.0.0.x" new profile=any >nul 2>&1
echo [OK] 10.0.0.x alt agina cikis izni verildi

echo.
echo ============================================
echo   Tamamlandi! Bu pencereyi kapatin.
echo   Simdi ELRS_BASLAT.bat calistirin.
echo ============================================
echo.
pause
