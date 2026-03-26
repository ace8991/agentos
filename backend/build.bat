@echo off
REM Build AgentOS local binary (Windows)
echo AgentOS -- building local binary...

python -m venv venv
call venv\Scripts\activate

pip install --upgrade pip
pip install -r requirements.txt
pip install pyinstaller

playwright install chromium

pyinstaller agentos.spec --clean

echo.
echo Done! Binary at: dist\AgentOS.exe
echo Run: set ANTHROPIC_API_KEY=sk-ant-... && set TAVILY_API_KEY=tvly-... && dist\AgentOS.exe
