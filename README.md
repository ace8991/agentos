# AgentOS Pro

AgentOS Pro is a premium desktop AI workspace that combines a React/Vite frontend with a FastAPI backend for agent execution, streamed chat, connector management, local automation, and artifact-driven workflows.

## What It Includes

- Desktop-oriented chat and agent workspace
- FastAPI backend for `/health`, `/agent/*`, `/chat`, and `/models/all`
- Connector gallery with a large built-in integrations catalog
- Local and cloud execution modes
- Artifact, skills, and connector configuration flows
- Browser automation and computer-use foundations for local mode

## Stack

- Frontend: React, Vite, TypeScript, Tailwind, Zustand
- Backend: FastAPI, Python, Playwright
- Package manager: Bun lockfile is the source of truth for the frontend

## Quick Start

### 1. Frontend

Install Bun first, then:

```bash
copy .env.example .env
bun install
bun run dev
```

The frontend uses `VITE_API_BASE_URL` and defaults to `http://localhost:8000`.

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
copy .env.example .env
python run.py
```

Backend dev server:

- `http://127.0.0.1:8000`

## Environment

### Frontend

See [.env.example](./.env.example).

Main variable:

```env
VITE_API_BASE_URL=http://localhost:8000
```

### Backend

See [backend/.env.example](./backend/.env.example).

Common variables:

```env
AGENT_MODE=local
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
TAVILY_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434
LMSTUDIO_BASE_URL=http://localhost:1234
```

## Runtime Modes

- `AGENT_MODE=local`: enables desktop tools, screenshots, Playwright, and computer-use behavior
- `AGENT_MODE=cloud`: disables desktop-only tools and runs in a safer headless mode

## Useful Commands

```bash
bun run dev
bun run build
bun run test
bun run lint
```

Backend:

```bash
cd backend
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

## Project Structure

```text
src/        Frontend app, chat UI, settings, connectors, state
public/     Static assets
backend/    FastAPI app, routes, services, runtime config
```

## Notes

- Frontend provider keys can be configured through the UI and are currently stored locally in the browser for direct-provider chat flows.
- Backend-assisted agent runs use server-side environment variables.
- This repo is now standardized on Bun for frontend dependency management.
