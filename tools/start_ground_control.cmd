@echo off
setlocal
set "ROOT=%~dp0.."
cd /d "%ROOT%"
start "Vecihi Ground Control Launcher" /min python tools\ground_control_launcher.py
start "" "%ROOT%\configurator.html"
endlocal
