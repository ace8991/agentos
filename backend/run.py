import asyncio
import sys

import uvicorn
from dotenv import load_dotenv

load_dotenv()


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
