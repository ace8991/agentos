#!/usr/bin/env bash
# Build AgentOS local binary (macOS / Linux)
set -e

echo "AgentOS — building local binary..."

# 1. Virtual env
python3 -m venv venv
source venv/bin/activate

# 2. Dependencies
pip install --upgrade pip
pip install -r requirements.txt
pip install pyinstaller

# 3. Playwright browsers (bundled into binary via datas)
playwright install chromium

# 4. Build
pyinstaller agentos.spec --clean

echo ""
echo "Done! Binary at: dist/AgentOS"
echo "Run: ANTHROPIC_API_KEY=sk-ant-... TAVILY_API_KEY=tvly-... ./dist/AgentOS"
