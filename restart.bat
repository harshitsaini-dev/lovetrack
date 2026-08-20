@echo off
setlocal
cd /d "%~dp0"

if "%PORT%"=="" set PORT=3000

echo(
echo  LoveTrack - restarting dev server on port %PORT%
echo  -------------------------------------------------

call "%~dp0stop.bat"

rem Give Windows a moment to actually release the socket, otherwise the
rem next bind can fail with EADDRINUSE.
timeout /t 2 /nobreak >nul

call "%~dp0start.bat"
