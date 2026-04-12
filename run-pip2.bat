@echo off
"C:\Program Files\Python312\python.exe" -m pip install -r "C:\Users\User\Documents\New project\backend\requirements.txt" --quiet 2> "C:\Users\User\Documents\New project\pip2.log"
echo %ERRORLEVEL% > "C:\Users\User\Documents\New project\pip2-done.txt"
