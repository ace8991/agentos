# ─── AgentOS — Cloud Mode (web + browser tasks only) ───────────────────────
# Tavily + Playwright headless. No PyAutoGUI, no screen required.
# Deploy on: Railway, Render, Fly.io, Google Cloud Run, AWS ECS

FROM python:3.11-slim

# System deps for Playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget curl gnupg ca-certificates \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libasound2 libpangocairo-1.0-0 \
    libpango-1.0-0 libcairo2 libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps (no pyautogui/mss in cloud build)
COPY requirements.cloud.txt .
RUN pip install --no-cache-dir -r requirements.cloud.txt

# Install Playwright browsers
RUN playwright install chromium --with-deps

# Copy app
COPY app/ ./app/
COPY run.py .

# Force cloud mode — no display available
ENV AGENT_MODE=cloud
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

# Bind to 0.0.0.0 for container networking
CMD ["python", "-m", "uvicorn", "app.main:app",\
     "--host", "0.0.0.0", "--port", "8000",\
     "--workers", "2", "--log-level", "info"]
