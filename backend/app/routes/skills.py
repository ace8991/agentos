from __future__ import annotations

from fastapi import APIRouter, Query

from app.services import skills_registry

router = APIRouter(prefix="/skills", tags=["skills"])


@router.get("/catalog")
async def get_skills_catalog():
    return {"skills": skills_registry.get_skill_catalog()}


@router.post("/sync")
async def sync_skills_catalog():
    return {"skills": skills_registry.sync_skill_catalog(force=True)}


@router.get("/match")
async def match_skills(task: str = Query("")):
    return {"skills": skills_registry.find_relevant_skills(task)}
