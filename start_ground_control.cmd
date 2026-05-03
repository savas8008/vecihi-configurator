@echo off
setlocal
cd /d "%~dp0"
start "Vecihi Ground Control Launcher" /min python tools\ground_control_launcher.py
start "" "%~dp0configurator.html"
endlocal
