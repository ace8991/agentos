import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services import browser as browser_svc
from app.services import runner

router = APIRouter()

MAX_STREAM_FPS = 10
DEFAULT_STREAM_FPS = 10


def _stream_interval(fps: int) -> float:
    clamped = max(1, min(fps, MAX_STREAM_FPS))
    return 1.0 / float(clamped)


@router.websocket("/browser/stream/{run_id}")
async def stream_browser(run_id: str, websocket: WebSocket, fps: int = DEFAULT_STREAM_FPS):
    await websocket.accept()
    interval = _stream_interval(fps)

    try:
        while True:
            state = runner.get_run(run_id)
            session_ready = browser_svc.session_exists(run_id)

            if session_ready:
                payload = await browser_svc.browser_live_state(run_id)
                if payload and payload.get("screenshot_b64"):
                    await websocket.send_json(
                        {
                            "type": "frame",
                            "screenshot_b64": payload.get("screenshot_b64"),
                            "url": payload.get("url"),
                            "title": payload.get("title"),
                            "message": payload.get("description"),
                        }
                    )
                else:
                    await websocket.send_json(
                        {
                            "type": "idle",
                            "message": "Synchronizing the in-app browser view...",
                        }
                    )
            elif state and runner.is_run_active(run_id):
                await websocket.send_json(
                    {
                        "type": "idle",
                        "message": "Preparing the in-app browser session...",
                    }
                )
            else:
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": "No live browser session is available for this run.",
                    }
                )
                break

            await asyncio.sleep(interval)
    except WebSocketDisconnect:
        return
