@echo off
setlocal
cd /d "%~dp0"

if "%PORT%"=="" set PORT=3000

echo(
echo  LoveTrack - starting dev server on port %PORT%
echo  -------------------------------------------------

if not exist "node_modules" (
    echo  node_modules missing. Running npm install first...
    call npm install || goto :failed
)

if not exist ".env.local" (
    echo(
    echo  WARNING: .env.local not found.
    echo  Copy .env.example to .env.local and fill in your keys,
    echo  otherwise Supabase calls will fail.
    echo(
)

rem Refuse to start if the port is already taken, so we never silently
rem end up on a different port than the one in NEXT_PUBLIC_APP_URL.
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:"LISTENING" ^| findstr /r /c:":%PORT% "') do (
    echo  Port %PORT% is already in use by PID %%p.
    echo  Run stop.bat first, or use restart.bat.
    goto :failed
)

echo  Opening http://localhost:%PORT%
echo  Press Ctrl+C to stop.
echo(

call npm run dev -- --port %PORT%
goto :eof

:failed
echo(
echo  Failed to start.
exit /b 1
