"""
Project Generator API Route
============================
Endpoint pour générer des projets complets via LLM.

POST /project/generate
  Body: { prompt: string, model?: string, title?: string }
  Response: GeneratedWorkspace (JSON)

GET /project/generate/{workspace_id}/status
  Response: { status: string, workspace?: GeneratedWorkspace }

Le workspace généré est compatible avec l'infrastructure builder existante
(workspace/builder/{id}/preview, workspace/builder/{id}/files, etc.)
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.models.schemas import GeneratedWorkspace
from app.services import project_generator as pg

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/project", tags=["project"])


class ProjectGenerateRequest(BaseModel):
    prompt: str
    model: str = "claude-sonnet-4-6"
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

    Retourne un GeneratedWorkspace compatible avec l'infrastructure builder.
    """
    logger.info(f"Project generation request: prompt='{req.prompt[:100]}...' model={req.model}")

    try:
        workspace = await pg.generate_project(
            prompt=req.prompt,
            model=req.model,
        )

        # Attacher l'URL de preview
        base_url = str(request.base_url).rstrip("/")
        workspace = pg.attach_preview_url(workspace, base_url)

        logger.info(f"Project generated successfully: {workspace.workspace_id}")
        return workspace

    except ValueError as e:
        logger.error(f"Project generation failed (config error): {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Project generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Project generation failed: {str(e)}")


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
