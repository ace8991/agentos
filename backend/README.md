# AgentOS Backend

FastAPI backend for the AgentOS frontend. It supports both agent execution and backend-assisted chat/model discovery.

## Local Development

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
copy .env.example .env
python run.py
```

The dev server listens on `http://127.0.0.1:8000`.

## Environment

Required for full agent runs:

- `ANTHROPIC_API_KEY`
- `TAVILY_API_KEY`

Optional provider keys for `/chat`:

- `OPENAI_API_KEY`
- `DEEPSEEK_API_KEY`
- `GOOGLE_API_KEY`
- `MISTRAL_API_KEY`
- `GROQ_API_KEY`
- `OLLAMA_BASE_URL`
- `LMSTUDIO_BASE_URL`

Mode toggle:

- `AGENT_MODE=local`
- `AGENT_MODE=cloud`

## API

- `GET /health`
- `POST /agent/start`
- `POST /agent/stop`
- `GET /agent/stream/{run_id}`
- `GET /agent/status/{run_id}`
- `GET /models/all`
- `POST /chat`
