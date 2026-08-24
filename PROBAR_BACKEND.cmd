@echo off
setlocal
set "BASE=https://npm-install-g-eas-cli.onrender.com"
echo.
echo ========================================
echo       CALCUP - PROBAR BACKEND
ECHO ========================================
echo.
echo [1/2] Estado de API y MongoDB:
curl.exe --max-time 100 -i "%BASE%/api/health"
echo.
echo.
echo [2/2] Conteo de productos:
curl.exe --max-time 100 -i "%BASE%/api/productos/count"
echo.
echo.
echo RESULTADO CORRECTO: ambos deben mostrar HTTP 200.
echo Si aparece HTTP 503, revisa MONGO_URL en Render.
pause
