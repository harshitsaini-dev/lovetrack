@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

if "%PORT%"=="" set PORT=3000

echo(
echo  LoveTrack - stopping dev server on port %PORT%
echo  -------------------------------------------------

set FOUND=0

rem Collect every PID listening on the port. Killing the process tree (/T)
rem matters because npm spawns next as a child.
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:"LISTENING" ^| findstr /r /c:":%PORT% "') do (
    if not "%%p"=="0" (
        set FOUND=1
        echo  Killing PID %%p ...
        taskkill /PID %%p /T /F >nul 2>&1
    )
)

if "!FOUND!"=="0" (
    echo  Nothing was listening on port %PORT%.
) else (
    echo  Stopped.
)

echo(
endlocal
