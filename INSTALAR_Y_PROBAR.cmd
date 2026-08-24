@echo off
setlocal
cd /d "%~dp0frontend"
echo.
echo ========================================
echo   CALCUP - INSTALAR Y ABRIR EN EXPO
ECHO ========================================
where node >nul 2>nul || (
  echo ERROR: Node.js no esta instalado.
  echo Descarga Node.js LTS desde https://nodejs.org/
  pause
  exit /b 1
)
echo Node:
node --version
echo NPM:
npm --version
echo.
echo Instalando dependencias del proyecto...
call npm install --legacy-peer-deps
if errorlevel 1 goto :error
echo.
echo Comprobando Expo...
call npx expo-doctor
if errorlevel 1 echo AVISO: Expo Doctor encontro observaciones. Revisa el texto anterior.
echo.
echo Abriendo Expo con cache limpia...
call npx expo start --clear
exit /b 0
:error
echo.
echo ERROR: La instalacion no termino correctamente.
pause
exit /b 1
