import asyncio
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import agent, auth, browser, chat, connectors, health, models, openclaw, remote, runtime, workspace


def _configure_windows_event_loop_policy() -> None:
    if not sys.platform.startswith("win"):
        return
    policy_cls = getattr(asyncio, "WindowsProactorEventLoopPolicy", None)
    if not policy_cls:
        return
    current_policy = asyncio.get_event_loop_policy()
    if not isinstance(current_policy, policy_cls):
        asyncio.set_event_loop_policy(policy_cls())


_configure_windows_event_loop_policy()

app = FastAPI(title="AgentOS Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:4173",
        "http://localhost:5173",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:4173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(agent.router, prefix="/agent")
app.include_router(browser.router)
app.include_router(models.router, prefix="/models")
app.include_router(chat.router)
app.include_router(connectors.router, prefix="/connectors")
app.include_router(openclaw.router)
app.include_router(remote.router, prefix="/remote")
app.include_router(runtime.router, prefix="/runtime")
app.include_router(workspace.router)
