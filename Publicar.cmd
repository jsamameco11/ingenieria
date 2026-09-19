@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title MemoriaCalc · Publicar

REM Explorer abre con un PATH corto: se añaden Node, Git y Python.
set "PATH=%LOCALAPPDATA%\Programs\Python\Python314;%LOCALAPPDATA%\Programs\Python\Python313;%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python311;C:\Program Files\nodejs;C:\Program Files\Git\cmd;C:\Program Files\Git\bin;%PATH%"

echo.
echo  MemoriaCalc · Publicar
echo  -----------------------------------------------
echo  1. Identifica cambios (ANTES vs HEAD)
echo  2. Compila el build
echo  3. Sube a ingenieria.miacademiapreu.com
echo  4. Commit y push en GitHub
echo  -----------------------------------------------
echo.
echo  Pulse una tecla para publicar.
echo  Cierre esta ventana si no desea continuar.
echo.
pause >nul

set "PY="
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if not defined PY if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
if not defined PY if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
if not defined PY (
  where py >nul 2>&1 && set "PY=py"
)
if not defined PY (
  where python >nul 2>&1 && set "PY=python"
)
if not defined PY (
  echo.
  echo  ERROR: no se encontro Python.
  echo  Instale Python 3 y vuelva a hacer doble clic.
  echo.
  pause
  exit /b 1
)

echo.
"%PY%" "%~dp0scripts\publicar.py" %*
set "ERR=%ERRORLEVEL%"
echo.
if not "%ERR%"=="0" (
  echo  Termino con error %ERR%.
) else (
  echo  Publicacion terminada. Ctrl+F5 en el navegador.
)
echo.
pause
exit /b %ERR%
