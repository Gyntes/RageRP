@echo off
setlocal
set "SERVER_DIR=%~dp0server-files"

if not exist "%SERVER_DIR%\ragemp-server.exe" (
  echo RageMP server files were not found in "%SERVER_DIR%".
  echo Place the official server files there, then run this script again.
  pause
  exit /b 1
)

if not exist "%SERVER_DIR%\packages\ragerp" mkdir "%SERVER_DIR%\packages\ragerp"
xcopy "%~dp0resources\ragerp\*" "%SERVER_DIR%\packages\ragerp\" /E /I /Y >nul
if errorlevel 1 (
  echo Could not install the RageRP server package.
  pause
  exit /b 1
)

if not exist "%~dp0client_packages\index.js" (
  echo RageRP client packages were not found in "%~dp0client_packages".
  pause
  exit /b 1
)

if not exist "%SERVER_DIR%\client_packages" mkdir "%SERVER_DIR%\client_packages"
xcopy "%~dp0client_packages\*" "%SERVER_DIR%\client_packages\" /E /I /Y >nul
if errorlevel 1 (
  echo Could not install the RageRP client packages.
  pause
  exit /b 1
)

copy /Y "%~dp0conf.json" "%SERVER_DIR%\conf.json" >nul
pushd "%SERVER_DIR%"
ragemp-server.exe
set "SERVER_EXIT_CODE=%ERRORLEVEL%"
popd

if not "%SERVER_EXIT_CODE%"=="0" echo Server exited with code %SERVER_EXIT_CODE%.
pause
exit /b %SERVER_EXIT_CODE%
