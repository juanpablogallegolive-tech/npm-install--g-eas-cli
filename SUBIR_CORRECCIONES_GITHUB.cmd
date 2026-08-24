@echo off
setlocal EnableExtensions
set "REPO=https://github.com/juanpablogallegolive-tech/npm-install--g-eas-cli.git"
set "PATCH=%~dp0CalcuP-correcciones.patch"
set "DEST=%USERPROFILE%\Desktop\CalcuP-corregido-GitHub"
if exist "%DEST%" set "DEST=%USERPROFILE%\Desktop\CalcuP-corregido-GitHub-%RANDOM%"

echo.
echo ========================================
echo  CALCUP - PREPARAR Y SUBIR CORRECCIONES
ECHO ========================================
where git >nul 2>nul || (
  echo ERROR: Git no esta instalado.
  echo Descargalo desde https://git-scm.com/
  pause
  exit /b 1
)
if not exist "%PATCH%" (
  echo ERROR: No se encontro CalcuP-correcciones.patch junto a este archivo.
  pause
  exit /b 1
)

echo Descargando la version actual de GitHub...
git clone "%REPO%" "%DEST%"
if errorlevel 1 goto :error
cd /d "%DEST%"

echo Aplicando correcciones verificadas...
git apply --whitespace=fix "%PATCH%"
if errorlevel 1 goto :error
> "frontend\.env" echo EXPO_PUBLIC_BACKEND_URL=https://npm-install-g-eas-cli.onrender.com

git config user.name >nul 2>nul || git config user.name "Juan Pablo"
git config user.email >nul 2>nul || git config user.email "juanpablogallegolive@gmail.com"
git add .
git commit -m "Fix: conexion, importacion por lotes y Expo"
if errorlevel 1 goto :error

echo Subiendo a GitHub. Puede abrirse el inicio de sesion en el navegador...
git push origin main
if errorlevel 1 goto :error

echo.
echo LISTO: GitHub fue actualizado y Render iniciara el deploy.
echo Carpeta local nueva: %DEST%
echo Cuando Render termine, ejecuta PROBAR_BACKEND.cmd en esa carpeta.
pause
exit /b 0

:error
echo.
echo ERROR: El proceso no termino. No se borro tu proyecto anterior.
echo Carpeta de trabajo: %DEST%
pause
exit /b 1
