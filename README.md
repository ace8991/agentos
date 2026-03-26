# AgentOS

This repo contains the Vite frontend and the FastAPI backend used for agent runs and backend-assisted chat.

## Frontend

```bash
npm install
npm run dev
```

The frontend reads `VITE_API_BASE_URL` from `.env` and defaults to `http://localhost:8000`.

## Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
copy .env.example .env
python run.py
```

## API Surface

- `GET /health`
- `POST /agent/start`
- `POST /agent/stop`
- `GET /agent/stream/{run_id}`
- `GET /agent/status/{run_id}`
- `GET /models/all`
- `POST /chat`

## Runtime Modes

- `AGENT_MODE=local` enables desktop tools, screenshots, and computer use.
- `AGENT_MODE=cloud` disables desktop-only tools and runs Playwright headless.
