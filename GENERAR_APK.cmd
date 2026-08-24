@echo off
setlocal
cd /d "%~dp0frontend"
echo.
echo ========================================
echo        CALCUP - GENERAR APK
ECHO ========================================
where node >nul 2>nul || (
  echo ERROR: Instala Node.js LTS desde https://nodejs.org/
  pause
  exit /b 1
)
call npm install --legacy-peer-deps
if errorlevel 1 goto :error
call npx eas-cli@latest whoami
if errorlevel 1 (
  echo Inicia sesion con la cuenta Expo propietaria del proyecto.
  call npx eas-cli@latest login
  if errorlevel 1 goto :error
)
call npx eas-cli@latest build --platform android --profile preview --clear-cache
if errorlevel 1 goto :error
echo.
echo APK solicitado correctamente. EAS mostrara el enlace de descarga.
pause
exit /b 0
:error
echo.
echo ERROR: No fue posible generar el APK. Revisa el mensaje anterior.
pause
exit /b 1
