@echo off
pip install -r "C:\Users\User\Documents\New project\backend\requirements.txt" > "C:\Users\User\Documents\New project\pip-install.log" 2>&1
echo EXIT_CODE=%ERRORLEVEL% >> "C:\Users\User\Documents\New project\pip-install.log"
echo DONE >> "C:\Users\User\Documents\New project\pip-install-done.txt"
