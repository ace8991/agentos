"""
Project Generator API Route
============================
Endpoint pour générer des projets complets via LLM avec agentic loop.

POST /project/generate
  Body: { prompt: string, model?: string, title?: string }
  Response: SSE stream d'événements JSON, se termine par un événement "workspace"

GET /project/generate/{workspace_id}/status
  Response: { status: string, workspace?: GeneratedWorkspace }

Le workspace généré est compatible avec l'infrastructure builder existante
(workspace/builder/{id}/preview, workspace/builder/{id}/files, etc.)
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.models.schemas import GeneratedWorkspace
from app.services import project_generator as pg

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/project", tags=["project"])


class ProjectGenerateRequest(BaseModel):
    prompt: str
    model: str = "claude-sonnet-4-7"
    title: str | None = None


class ProjectStatusResponse(BaseModel):
    status: str
    workspace: GeneratedWorkspace | None = None
    error: str | None = None


@router.post("/generate")
async def generate_project(req: ProjectGenerateRequest, request: Request):
    """
    Génère un projet complet à partir d'une description textuelle.

    Utilise l'agentic loop avec un system prompt spécialisé "Project Architect"
    pour générer du code complet, des animations, des visuels 3D, etc.

    Retourne un flux SSE d'événements JSON :
      - {"type": "phase", "phase": "analyzing|generating|parsing|complete", "message": "..."}
      - {"type": "text", "text": "..."}
      - {"type": "tool_call", "tool": "...", "args": {...}, "id": "..."}
      - {"type": "tool_result", "tool": "...", "result": "...", "id": "...", "success": true}
      - {"type": "file_created", "path": "...", "total": 5}
      - {"type": "workspace", "workspace": {...}}  ← résultat final
      - {"type": "error", "error": "..."}
    """
    logger.info(f"Project generation request: prompt='{req.prompt[:100]}...' model={req.model}")

    async def event_stream():
        base_url = str(request.base_url).rstrip("/")
        try:
            async for event_json in pg.generate_project(
                prompt=req.prompt,
                model=req.model,
            ):
                # On parse l'événement pour attacher l'URL de preview si c'est le workspace final
                try:
                    event = json.loads(event_json)
                    if event.get("type") == "workspace" and "workspace" in event:
                        ws = GeneratedWorkspace(**event["workspace"])
                        ws = pg.attach_preview_url(ws, base_url)
                        event["workspace"] = ws.model_dump()
                        yield f"data: {json.dumps(event)}\n\n"
                    else:
                        yield f"data: {event_json}\n\n"
                except json.JSONDecodeError:
                    yield f"data: {event_json}\n\n"

        except ValueError as e:
            logger.error(f"Project generation failed (config error): {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
        except Exception as e:
            logger.error(f"Project generation failed: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'error': f'Project generation failed: {str(e)}'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/generate/{workspace_id}/status")
async def get_generation_status(workspace_id: str):
    """Vérifie le statut d'un projet généré."""
    workspace = pg.load_workspace(workspace_id)
    if not workspace:
        return ProjectStatusResponse(status="not_found")
    return ProjectStatusResponse(status="ready", workspace=workspace)


@router.post("/generate/regenerate")
async def regenerate_project(req: ProjectGenerateRequest, request: Request):
    """
    Régénère un projet avec un nouveau prompt.
    Utile pour itérer sur un projet existant.
    """
    return await generate_project(req, request)
