"""
Vérifie que le pipeline de génération de projet produit un projet multi-fichiers
et ne s'arrête pas après un seul fichier.

Le test remplace l'agentic loop par un stub qui écrit plusieurs fichiers
(preview HTML, styles, script, README) puis vérifie que le workspace final
contient chacun d'eux.
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from app.services import project_generator as pg


def _write(dir: Path, rel: str, body: str) -> None:
    p = dir / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body, encoding="utf-8")


@pytest.mark.asyncio
async def test_generate_project_produces_multi_file_workspace(monkeypatch, tmp_path):
    """Le workspace final doit contenir preview HTML, styles, script et README."""

    async def fake_run(system_prompt, user_prompt, model, workspace_dir):
        # Simule le comportement d'un LLM sain qui crée plusieurs fichiers.
        _write(workspace_dir, "preview/index.html", "<!doctype html><title>ok</title>")
        _write(workspace_dir, "preview/styles.css", "body { color: #fff; }")
        _write(workspace_dir, "preview/app.js", "console.log('hello');")
        _write(workspace_dir, "docs/README.md", "# Demo\nMulti file check")
        yield json.dumps({"type": "phase", "phase": "generating", "message": "test"})
        yield json.dumps({"type": "file_created", "path": "preview/index.html", "total": 4})
        yield json.dumps({"type": "done", "files_created": 4})

    monkeypatch.setattr(pg, "_run_agentic_generation", fake_run)
    monkeypatch.setattr(pg, "WORKSPACES_ROOT", tmp_path)

    events: list[dict] = []
    workspace_event = None
    async for raw in pg.generate_project("Crée une landing page simple", model="claude-sonnet-4-7"):
        payload = json.loads(raw)
        events.append(payload)
        if payload.get("type") == "workspace":
            workspace_event = payload

    assert workspace_event is not None, "Le pipeline doit émettre un workspace final"
    workspace = workspace_event["workspace"]
    paths = {f["path"] for f in workspace["files"]}

    # Le projet doit contenir un frontend, des styles, un script et un README.
    assert "preview/index.html" in paths, f"index.html manquant — {paths}"
    assert any(p.endswith(".css") for p in paths), f"pas de styles — {paths}"
    assert any(p.endswith(".js") for p in paths), f"pas de script — {paths}"
    assert any(p.endswith("README.md") for p in paths), f"pas de README — {paths}"

    # Contrainte anti-régression : jamais un seul fichier.
    assert len(paths) >= 4, f"Le projet doit contenir plusieurs fichiers, reçu {len(paths)}"
    assert workspace["status"] == "ready"
