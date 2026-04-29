import asyncio
import os
import sys

import uvicorn
from dotenv import load_dotenv

load_dotenv()

# Ensure the project root is on sys.path so imports like
#   from src.agent.core.registry import get_model
#   from api.routes.agent import router
# work correctly when running from the backend/ directory.
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)


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

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info",
    )
