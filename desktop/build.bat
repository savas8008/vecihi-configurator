@echo off
setlocal EnableDelayedExpansion
title X-Flight Configurator - Build

echo.
echo ============================================================
echo   X-Flight Configurator - Windows Desktop Build
echo ============================================================
echo.

:: ─── Gereksinim: MinGW-w64 ───────────────────────────────────────────────────
where g++ >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [HATA] g++ bulunamadi!
    echo.
    echo MinGW-w64 kurulu degil veya PATH'te degil.
    echo Indirmek icin: https://winlibs.com
    echo Onerillen: "UCRT runtime, POSIX threads, MSVCRT" secenegiyle kurun
    echo Sonra g++.exe'nin oldugu bin\ klasorunu PATH'e ekleyin.
    pause
    exit /b 1
)

where cmake >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [HATA] cmake bulunamadi!
    echo Indirmek icin: https://cmake.org/download/
    pause
    exit /b 1
)

:: ─── WebView2 SDK indir (yoksa) ──────────────────────────────────────────────
if not exist "lib\WebView2.h" (
    echo [1/4] WebView2 SDK indiriliyor...

    if not exist "lib" mkdir lib

    :: NuGet'ten WebView2 paketini indir (nupkg = zip dosyasi)
    curl -L --progress-bar ^
        "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/1.0.2792.45" ^
        -o lib\webview2.nupkg

    if %ERRORLEVEL% NEQ 0 (
        echo [HATA] WebView2 SDK indirilemedi!
        echo Manuel olarak indirin: https://www.nuget.org/packages/Microsoft.Web.WebView2
        echo .nupkg dosyasini 'lib\' klasorune koyun ve:
        echo   tar -xf lib\webview2.nupkg -C lib\ build/native/include/
        echo   copy lib\build\native\include\WebView2.h lib\WebView2.h
        pause
        exit /b 1
    )

    :: nupkg bir ZIP dosyasidir - WebView2.h'yi cikar
    tar -xf lib\webview2.nupkg -C lib\ build/native/include/WebView2.h 2>nul
    tar -xf lib\webview2.nupkg -C lib\ build/native/include/WebView2EnvironmentOptions.h 2>nul
    tar -xf lib\webview2.nupkg -C lib\ build/native/include/WebView2Experimental.h 2>nul
    tar -xf lib\webview2.nupkg -C lib\ build/native/include/WebView2ExperimentalEnvironmentOptions.h 2>nul

    :: Tasinan konuma kopyala
    if exist "lib\build\native\include\WebView2.h" (
        copy "lib\build\native\include\WebView2.h" "lib\WebView2.h" >nul
        copy "lib\build\native\include\WebView2EnvironmentOptions.h" "lib\" >nul 2>nul
        copy "lib\build\native\include\WebView2Experimental.h" "lib\" >nul 2>nul
        copy "lib\build\native\include\WebView2ExperimentalEnvironmentOptions.h" "lib\" >nul 2>nul
        echo [OK] WebView2 SDK hazir.
    ) else (
        echo [HATA] WebView2.h cikartilamadi!
        pause
        exit /b 1
    )

    :: Temizlik
    del lib\webview2.nupkg >nul 2>&1
    rd /s /q lib\build >nul 2>&1
) else (
    echo [1/4] WebView2 SDK zaten mevcut - atlaniyor.
)

:: ─── CMake build klasoru olustur ─────────────────────────────────────────────
echo [2/4] CMake yapilandiriliyor...

if exist "build" rd /s /q build
mkdir build

cmake -S . -B build ^
    -G "MinGW Makefiles" ^
    -DCMAKE_BUILD_TYPE=Release ^
    -DCMAKE_CXX_FLAGS="-O2 -DNDEBUG"

if %ERRORLEVEL% NEQ 0 (
    echo [HATA] CMake yapilandirmasi basarisiz!
    pause
    exit /b 1
)

:: ─── Derle ───────────────────────────────────────────────────────────────────
echo [3/4] Derleniyor... (bu biraz zaman alabilir)

cmake --build build --config Release -j4

if %ERRORLEVEL% NEQ 0 (
    echo [HATA] Derleme basarisiz!
    pause
    exit /b 1
)

:: ─── Ciktilari proje kokune kopyala ──────────────────────────────────────────
echo [4/4] Dosyalar hazırlaniyor...

:: XFlightConfigurator.exe proje kokune
if exist "build\XFlightConfigurator.exe" (
    copy "build\XFlightConfigurator.exe" "..\XFlightConfigurator.exe" >nul
    echo [OK] ..\XFlightConfigurator.exe olusturuldu
)

echo.
echo ============================================================
echo   BUILD TAMAMLANDI!
echo.
echo   Calistirmak icin:
echo     cd ..
echo     XFlightConfigurator.exe
echo.
echo   NOT: WebView2 (Edge) Windows 10/11'de zaten yuklu gelir.
echo   Eger calismazsa: aka.ms/webview2 adresinden yukleyin.
echo ============================================================
echo.

pause
endlocal
