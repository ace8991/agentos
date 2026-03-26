from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import agent, chat, health, models

app = FastAPI(title="AgentOS Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(agent.router, prefix="/agent")
app.include_router(models.router, prefix="/models")
app.include_router(chat.router)
