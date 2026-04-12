@echo off
setlocal
set ROOT=C:\Users\User\Documents\New project
set VENV=%ROOT%\backend\venv
set PYTHON=%VENV%\Scripts\python.exe
set PIP=%VENV%\Scripts\pip.exe

echo === Installation des dependances dans le venv ===
%PIP% install -r "%ROOT%\backend\requirements.txt" --quiet
if %ERRORLEVEL% NEQ 0 (
    echo ERREUR pip install!
    pause
    exit /b 1
)
echo Dependances OK

echo === Demarrage du backend sur port 8000 ===
cd /d "%ROOT%\backend"
%PYTHON% run.py
pause
