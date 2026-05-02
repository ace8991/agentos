"""
Project Generator Engine v1.0
==============================
Génère des projets complets (apps web, jeux, animations 3D, dashboards, sites)
en utilisant l'agentic loop avec un system prompt spécialisé.

Architecture:
  1. Analyse la demande → détecte le type de projet, stack, fonctionnalités
  2. Construit un system prompt spécialisé "Project Architect"
  3. Lance l'agentic loop (Anthropic/OpenAI) avec les outils filesystem
  4. Génère tous les fichiers du projet dans un workspace dédié
  5. Crée un preview HTML + résumé du projet
  6. Retourne le workspace GeneratedWorkspace (compatible builder existant)

Supporte:
  - Apps React/Vite/TypeScript complètes
  - Jeux HTML5/Canvas/Three.js
  - Animations CSS/GSAP/Three.js/Framer Motion
  - Dashboards avec données mock
  - Sites web statiques
  - Composants 3D (Three.js, React Three Fiber)
  - Visualisations de données (Chart.js, D3.js)
  - Landing pages avec animations
"""

from __future__ import annotations

import html
import json
import logging
import re
import uuid
from pathlib import Path
from typing import Any

from app.models.schemas import (
    GeneratedWorkspace,
    GeneratedWorkspaceArtifact,
    GeneratedWorkspaceFile,
    GeneratedWorkspaceStack,
)
from app.services.runtime_config import get_runtime_value
from app.services.tool_executor import execute as run_tool

logger = logging.getLogger(__name__)

BACKEND_ROOT = Path(__file__).resolve().parents[2]
WORKSPACES_ROOT = BACKEND_ROOT / "generated_workspaces"
MANIFEST_NAME = "workspace.json"
PREVIEW_ENTRY = "preview/index.html"

WORKSPACES_ROOT.mkdir(parents=True, exist_ok=True)

MAX_GENERATION_ITERATIONS = 25

# ── Types de projets détectables ──────────────────────────────────────────────

PROJECT_PATTERNS: dict[str, dict[str, Any]] = {
    "game": {
        "keywords": ["jeu", "game", "snake", "pong", "platformer", "rpg", "shooter",
                     "puzzle", "mario", "flappy", "runner", "clicker", "idle",
                     "strategy", "simulation", "arcade", "board game", "card game",
                     "memory game", "quiz", "trivia", "tictactoe", "tic tac toe",
                     "chess", "checkers", "2048", "tetris", "pacman", "space invaders"],
        "stack": "HTML5 Canvas + JavaScript",
        "description": "Jeu interactif en HTML5 Canvas",
    },
    "3d": {
        "keywords": ["3d", "three.js", "threejs", "react three fiber", "r3f",
                     "webgl", "glsl", "shader", "3d model", "3d scene",
                     "3d animation", "3d visualization", "3d game",
                     "solar system", "planets", "earth", "globe", "particle",
                     "particles", "spiral", "galaxy", "universe"],
        "stack": "Three.js / React Three Fiber",
        "description": "Visualisation ou jeu 3D avec Three.js",
    },
    "animation": {
        "keywords": ["animation", "animated", "motion", "framer motion", "gsap",
                     "transition", "parallax", "scroll animation", "reveal",
                     "fade", "slide", "bounce", "spinner", "loader", "loading",
                     "skeleton", "particle animation", "confetti", "fireworks",
                     "floating", "floating particles", "mouse trail", "cursor"],
        "stack": "CSS Animations + Framer Motion / GSAP",
        "description": "Page avec animations riches",
    },
    "dashboard": {
        "keywords": ["dashboard", "admin", "panel", "analytics", "analytique",
                     "statistics", "statistiques", "metrics", "kpi", "monitoring",
                     "tableau de bord", "charts", "graphs", "chart", "graph",
                     "data viz", "visualisation", "visualization"],
        "stack": "React + Chart.js / Recharts",
        "description": "Dashboard avec graphiques et métriques",
    },
    "landing": {
        "keywords": ["landing page", "landing", "site vitrine", "portfolio",
                     "presentation", "showcase", "hero", "startup", "saas",
                     "product page", "marketing page", "coming soon",
                     "page d'accueil", "homepage", "home page"],
        "stack": "React + Tailwind CSS",
        "description": "Landing page moderne et responsive",
    },
    "app": {
        "keywords": ["app", "application", "web app", "webapp", "todo", "todo app",
                     "notes", "note app", "chat", "messenger", "social media",
                     "ecommerce", "shop", "store", "blog", "cms", "forum",
                     "calendar", "scheduler", "planner", "tracker", "fitness",
                     "weather", "weather app", "music player", "video player",
                     "image gallery", "gallery", "recipe", "recipe app",
                     "calculator", "converter", "timer", "stopwatch", "clock"],
        "stack": "React + Vite + TypeScript",
        "description": "Application web interactive",
    },
    "api": {
        "keywords": ["api", "backend", "server", "rest api", "graphql",
                     "fastapi", "express", "flask", "django", "crud",
                     "authentication", "auth", "login", "signup", "register",
                     "database", "sql", "nosql", "mongodb", "postgresql"],
        "stack": "FastAPI / Express + Database",
        "description": "API backend avec endpoints",
    },
    "fullstack": {
        "keywords": ["fullstack", "full stack", "full-stack", "complete app",
                     "complete project", "production app", "real app",
                     "real project", "complex app", "multi-page", "multipage"],
        "stack": "React + FastAPI + Database",
        "description": "Application fullstack complète",
    },
}

# ── System Prompt spécialisé pour la génération de projets ────────────────────

PROJECT_ARCHITECT_SYSTEM_PROMPT = """# AgentOS Project Architect — System Prompt v1.0

Tu es un **Architecte de Projet** spécialisé dans la génération de projets complets.
Tu génères des projets avec du code réel, fonctionnel, prêt à être exécuté.

## CAPACITÉS SPÉCIALES

### 🎨 Génération d'images et visuels
- Tu peux générer des **SVG complexes** inline dans le HTML pour des illustrations, logos, icônes
- Tu peux créer des **animations CSS** sophistiquées (keyframes, transitions, transforms)
- Tu peux intégrer des **bibliothèques CDN** (Three.js, Chart.js, GSAP, Framer Motion)
- Tu génères des **gradients, patterns, backgrounds** directement en CSS

### 🎮 Jeux et interactivité
- Jeux HTML5 Canvas complets (Snake, Pong, Platformer, etc.)
- Jeux avec Three.js (3D)
- Animations interactives avec détection de collision, score, niveaux
- Sons et effets audio (Web Audio API)

### 📊 Visualisation de données
- Graphiques Chart.js (bar, line, pie, doughnut, radar, polar)
- Graphiques D3.js (force-directed, tree, chord)
- Tableaux interactifs avec tri, filtre, recherche
- Cartes thermiques, calendriers, timelines

### 🧩 Composants UI avancés
- Modals, drawers, tooltips, popovers
- Drag & drop, resizable, sortable
- Formulaires avec validation
- Carrousels, sliders, tabs, accordéons
- Arbres, listes virtuelles, infinite scroll

### 🎭 Animations et transitions
- Framer Motion (via CDN) : layout animations, variants, gestures
- GSAP (via CDN) : timeline, stagger, scrollTrigger
- CSS Animations : keyframes complexes, transitions fluides
- Parallax scrolling, reveal animations
- Particules, confettis, effets de mouse trail

## RÈGLES DE GÉNÉRATION

1. **Code COMPLET et FONCTIONNEL** — Pas de placeholder, pas de "..." ou "// rest"
2. **Single HTML file** pour les projets simples (jeux, animations, landing pages)
3. **Multi-fichiers** pour les projets complexes (React, fullstack)
4. **CDN** pour les bibliothèques externes (pas de npm install nécessaire)
5. **Dark mode** par défaut, design moderne et soigné
6. **Responsive** — fonctionne sur mobile et desktop
7. **Accessible** — attributs aria, rôles, labels
8. **Performant** — pas de fuites mémoire, animations optimisées

## FORMAT DE SORTIE

Pour chaque fichier généré, utilise le format suivant :
```
<file path="chemin/relatif/du/fichier">
CONTENU COMPLET DU FICHIER
</file>
```

Le premier fichier DOIT être le fichier HTML principal (preview/index.html).
Les fichiers suivants peuvent être dans des sous-dossiers (client/, server/, etc.).

## EXEMPLE DE PROJET COMPLET

Pour un jeu Snake :
1. preview/index.html — HTML complet avec CSS inline + JS Canvas
2. docs/README.md — Documentation du projet

Pour une app React :
1. preview/index.html — Page HTML qui charge React depuis CDN
2. client/src/App.js — Composant principal
3. client/src/components/... — Composants additionnels
4. docs/README.md — Documentation

## STYLE VISUEL
- Design sombre (dark mode) avec accents de couleur
- Bordures arrondies, glassmorphism, dégradés subtils
- Typographie moderne (Inter, system-ui)
- Ombres portées, glow effects, transitions fluides
- Micro-interactions au hover/click
- Layout responsive (mobile-first)
"""


# ── Fonctions utilitaires ────────────────────────────────────────────────────

def _slugify(value: str) -> str:
    return (re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "project")


def _pick_title(prompt: str) -> str:
    words = re.findall(r"[A-Za-z0-9]+", prompt)
    return " ".join(word.capitalize() for word in words[:6]) or "Generated Project"


def _detect_project_type(prompt: str) -> dict[str, Any]:
    """Détecte le type de projet à partir de la demande."""
    lowered = prompt.lower()
    best_match = "app"
    best_score = 0

    for project_type, config in PROJECT_PATTERNS.items():
        score = sum(1 for kw in config["keywords"] if kw in lowered)
        if score > best_score:
            best_score = score
            best_match = project_type

    # Mapper les types non-standard vers des types valides pour GeneratedWorkspaceKind
    type_mapping = {
        "3d": "app",
    }
    mapped_type = type_mapping.get(best_match, best_match)

    return {
        "type": mapped_type,
        "stack": PROJECT_PATTERNS[best_match]["stack"],
        "description": PROJECT_PATTERNS[best_match]["description"],
    }


def _build_generation_prompt(user_prompt: str, project_info: dict[str, Any]) -> str:
    """Construit le prompt de génération enrichi avec le contexte."""
    return f"""## Demande utilisateur
{user_prompt}

## Type de projet détecté
- Type : {project_info['type']}
- Stack recommandée : {project_info['stack']}
- Description : {project_info['description']}

## Instructions de génération
1. Analyse la demande en profondeur — comprends ce que l'utilisateur veut VRAIMENT
2. Conçois l'architecture du projet (composants, fichiers, structure)
3. Génère TOUS les fichiers nécessaires — code COMPLET et fonctionnel
4. Inclus des animations, effets visuels, et une UI soignée
5. Ajoute un fichier docs/README.md avec la documentation complète
6. Le fichier preview/index.html DOIT être le point d'entrée principal

## Règles qualité
- Design moderne, dark mode, responsive
- Code propre, bien structuré, commenté
- Pas de dépendances externes (tout en CDN ou inline)
- Fonctionnel immédiatement — pas de build nécessaire
- Expérience utilisateur soignée (transitions, feedback, états vides)
"""


def _parse_generated_files(text: str) -> dict[str, str]:
    """Parse le texte généré pour extraire les fichiers au format <file path="...">...</file>."""
    files: dict[str, str] = {}
    pattern = re.compile(r'<file\s+path="([^"]+)"\s*>\s*\n?(.*?)\n?</file>', re.DOTALL)
    for match in pattern.finditer(text):
        path = match.group(1).strip()
        content = match.group(2)
        files[path] = content
    return files


def _group_for_path(path: str) -> str:
    root = path.split("/", 1)[0]
    if root in {"client", "server", "database", "docs", "assets", "output"}:
        return root
    if root == "preview":
        return "output"
    return "output"


def _language_for_path(path: str) -> str | None:
    return {
        ".tsx": "tsx",
        ".ts": "ts",
        ".js": "javascript",
        ".jsx": "jsx",
        ".css": "css",
        ".html": "html",
        ".json": "json",
        ".md": "md",
        ".sql": "sql",
        ".py": "python",
    }.get(Path(path).suffix.lower())


def _artifact_type_for_path(path: str, group: str) -> str:
    suffix = Path(path).suffix.lower()
    if group == "database":
        return "database"
    if suffix in {".tsx", ".ts", ".js", ".jsx", ".css", ".json", ".py"}:
        return "code"
    if suffix == ".html":
        return "app" if path.startswith("preview/") else "html"
    if suffix == ".md":
        return "document"
    return "file"


def _write_files(workspace_dir: Path, files: dict[str, str]) -> None:
    for relative_path, content in files.items():
        target = workspace_dir / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")


def _scan_files(workspace_dir: Path) -> list[GeneratedWorkspaceFile]:
    files: list[GeneratedWorkspaceFile] = []
    for file_path in sorted(workspace_dir.rglob("*")):
        if not file_path.is_file():
            continue
        relative = file_path.relative_to(workspace_dir).as_posix()
        if relative == MANIFEST_NAME:
            continue
        files.append(
            GeneratedWorkspaceFile(
                path=relative,
                name=file_path.name,
                group=_group_for_path(relative),
                language=_language_for_path(relative),
                size_bytes=file_path.stat().st_size,
            )
        )
    return files


def _artifacts(files: list[GeneratedWorkspaceFile]) -> list[GeneratedWorkspaceArtifact]:
    return [
        GeneratedWorkspaceArtifact(
            id=f"artifact-{index}",
            type=_artifact_type_for_path(file_meta.path, file_meta.group),
            title=file_meta.name,
            path=file_meta.path,
            group=file_meta.group,
        )
        for index, file_meta in enumerate(files)
    ]


def _generate_fallback_preview(title: str, prompt: str, project_info: dict[str, Any]) -> str:
    """Génère un preview HTML de fallback si la génération échoue."""
    project_type = project_info["type"]
    stack = project_info["stack"]

    return f"""<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{html.escape(title)} — Preview</title>
  <style>
    :root {{ color-scheme: dark; }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 50%, #0a0a1a 100%);
      color: #eef3ff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }}
    .card {{
      max-width: 800px;
      width: 100%;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 32px;
      padding: 3rem;
      backdrop-filter: blur(20px);
      box-shadow: 0 24px 80px rgba(0,0,0,0.4);
    }}
    .badge {{
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 999px;
      border: 1px solid rgba(126,167,255,0.2);
      background: rgba(126,167,255,0.08);
      color: #7ea7ff;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin-bottom: 1.5rem;
    }}
    h1 {{
      font-size: 2.5rem;
      font-weight: 700;
      letter-spacing: -0.04em;
      line-height: 1.1;
      margin-bottom: 1rem;
      background: linear-gradient(135deg, #eef3ff 0%, #7ea7ff 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }}
    p {{
      color: rgba(238,243,255,0.7);
      line-height: 1.7;
      font-size: 1.05rem;
      margin-bottom: 2rem;
    }}
    .stack {{
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-bottom: 2rem;
    }}
    .stack-item {{
      padding: 0.5rem 1rem;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.03);
      font-size: 0.85rem;
      color: rgba(238,243,255,0.8);
    }}
    .status {{
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-radius: 16px;
      background: rgba(34,197,94,0.08);
      border: 1px solid rgba(34,197,94,0.15);
      color: #22c55e;
      font-size: 0.9rem;
    }}
    .status::before {{
      content: '';
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 12px rgba(34,197,94,0.4);
      animation: pulse 2s infinite;
    }}
    @keyframes pulse {{
      0%, 100% {{ opacity: 1; }}
      50% {{ opacity: 0.5; }}
    }}
    @media (max-width: 600px) {{
      .card {{ padding: 1.5rem; }}
      h1 {{ font-size: 1.8rem; }}
    }}
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">✨ AgentOS Project Generator</div>
    <h1>{html.escape(title)}</h1>
    <p>{html.escape(prompt[:200])}</p>
    <div class="stack">
      <span class="stack-item">📦 {html.escape(project_type.title())}</span>
      <span class="stack-item">⚡ {html.escape(stack)}</span>
      <span class="stack-item">🎨 Design moderne</span>
      <span class="stack-item">📱 Responsive</span>
    </div>
    <div class="status">
      Projet généré avec succès — explore les fichiers dans les onglets ci-dessus
    </div>
  </div>
</body>
</html>
"""


# ── Génération via LLM (agentic loop simplifiée) ─────────────────────────────

async def _call_llm_for_generation(
    system_prompt: str,
    user_prompt: str,
    model: str,
) -> str:
    """
    Appelle le LLM pour générer le projet.
    Utilise l'API Anthropic ou OpenAI selon le modèle.
    """
    provider = _detect_provider(model)

    if provider == "anthropic":
        return await _call_anthropic(system_prompt, user_prompt, model)
    else:
        return await _call_openai_compat(system_prompt, user_prompt, model, provider)


def _detect_provider(model: str) -> str:
    m = model.lower()
    if "claude" in m:
        return "anthropic"
    if "gpt" in m or m.startswith("o1") or m.startswith("o3"):
        return "openai"
    if "deepseek" in m:
        return "deepseek"
    if "gemini" in m:
        return "google"
    if "mistral" in m or "codestral" in m:
        return "mistral"
    if "qwen" in m:
        return "qwen"
    return "openai"


async def _call_anthropic(system_prompt: str, user_prompt: str, model: str) -> str:
    """Appelle l'API Anthropic pour la génération."""
    key = (get_runtime_value("ANTHROPIC_API_KEY") or "").strip()
    if not key:
        raise ValueError("ANTHROPIC_API_KEY is not configured")

    import httpx

    messages = [
        {"role": "user", "content": user_prompt},
    ]

    payload = {
        "model": model,
        "max_tokens": 64000,
        "system": system_prompt,
        "messages": messages,
    }

    async with httpx.AsyncClient(timeout=300) as client:
        async with client.stream(
            "POST",
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=payload,
        ) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                try:
                    err = json.loads(body).get("error", {}).get("message", body.decode()[:300])
                except Exception:
                    err = body.decode()[:300]
                raise ValueError(f"Anthropic {resp.status_code}: {err}")

            full_text = ""
            current_block = None

            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                raw = line[6:].strip()
                if raw == "[DONE]":
                    break
                try:
                    event = json.loads(raw)
                except json.JSONDecodeError:
                    continue

                event_type = event.get("type")
                if event_type == "content_block_start":
                    current_block = event.get("content_block", {})
                elif event_type == "content_block_delta":
                    delta = event.get("delta", {})
                    if delta.get("type") == "text_delta":
                        full_text += delta.get("text", "")
                    elif delta.get("type") == "thinking_delta":
                        pass  # Ignorer le thinking
                elif event_type == "message_delta":
                    pass

            return full_text


async def _call_openai_compat(system_prompt: str, user_prompt: str, model: str, provider: str) -> str:
    """Appelle une API OpenAI-compatible pour la génération."""
    key_name = {
        "openai": "OPENAI_API_KEY",
        "deepseek": "DEEPSEEK_API_KEY",
        "google": "GEMINI_API_KEY",
        "mistral": "MISTRAL_API_KEY",
        "qwen": "QWEN_API_KEY",
    }.get(provider, "OPENAI_API_KEY")

    base_urls = {
        "openai": "https://api.openai.com/v1",
        "deepseek": "https://api.deepseek.com/v1",
        "google": "https://generativelanguage.googleapis.com/v1beta/openai",
        "mistral": "https://api.mistral.ai/v1",
        "qwen": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    }

    base_url = base_urls.get(provider, "https://api.openai.com/v1")
    key = (get_runtime_value(key_name) or "").strip()

    if not key:
        raise ValueError(f"{key_name} is not configured")

    import httpx

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": 64000,
        "temperature": 0.7,
    }

    async with httpx.AsyncClient(timeout=300) as client:
        async with client.stream(
            "POST",
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json=payload,
        ) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                try:
                    err = json.loads(body).get("error", {}).get("message", body.decode()[:300])
                except Exception:
                    err = body.decode()[:300]
                raise ValueError(f"API {resp.status_code}: {err}")

            full_text = ""
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                raw = line[6:].strip()
                if raw == "[DONE]":
                    break
                try:
                    chunk = json.loads(raw)
                except json.JSONDecodeError:
                    continue

                choices = chunk.get("choices", [])
                if choices:
                    delta = choices[0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        full_text += content

            return full_text


# ── Fonction principale de génération ────────────────────────────────────────

async def generate_project(
    prompt: str,
    model: str = "claude-sonnet-4-6",
) -> GeneratedWorkspace:
    """
    Génère un projet complet à partir d'une description textuelle.

    Args:
        prompt: Description du projet par l'utilisateur
        model: Modèle LLM à utiliser

    Returns:
        GeneratedWorkspace avec tous les fichiers générés
    """
    workspace_id = uuid.uuid4().hex[:12]
    title = _pick_title(prompt)
    project_info = _detect_project_type(prompt)

    logger.info(f"Generating project: {title} (type={project_info['type']}, model={model})")

    # 1. Construire le prompt de génération
    generation_prompt = _build_generation_prompt(prompt, project_info)

    # 2. Appeler le LLM pour générer le projet
    try:
        generated_text = await _call_llm_for_generation(
            PROJECT_ARCHITECT_SYSTEM_PROMPT,
            generation_prompt,
            model,
        )
    except Exception as e:
        logger.error(f"LLM generation failed: {e}")
        # Fallback: générer un projet minimal
        generated_text = ""

    # 3. Parser les fichiers générés
    files: dict[str, str] = {}

    if generated_text:
        files = _parse_generated_files(generated_text)
        logger.info(f"Parsed {len(files)} files from generation")

    # 4. Si aucun fichier n'a été parsé, créer un projet minimal
    if not files:
        logger.warning("No files parsed, generating fallback project")
        files = _generate_fallback_project(title, prompt, project_info)

    # 5. Écrire les fichiers sur le disque
    workspace_dir = WORKSPACES_ROOT / workspace_id
    workspace_dir.mkdir(parents=True, exist_ok=True)
    _write_files(workspace_dir, files)

    # 6. Scanner les fichiers et construire le workspace
    workspace_files = _scan_files(workspace_dir)

    # S'assurer que preview/index.html existe
    preview_path = workspace_dir / PREVIEW_ENTRY
    if not preview_path.exists():
        preview_content = _generate_fallback_preview(title, prompt, project_info)
        (workspace_dir / "preview").mkdir(parents=True, exist_ok=True)
        (workspace_dir / PREVIEW_ENTRY).write_text(preview_content, encoding="utf-8")
        workspace_files = _scan_files(workspace_dir)

    # 7. Construire le workspace
    stack = GeneratedWorkspaceStack(
        frontend=project_info["stack"],
        ui="Design moderne + Animations",
        backend="FastAPI" if project_info["type"] in ("api", "fullstack") else None,
        database="SQLite" if project_info["type"] == "fullstack" else None,
    )

    workspace = GeneratedWorkspace(
        workspace_id=workspace_id,
        title=title,
        kind=project_info["type"],
        stack=stack,
        preview_entry=PREVIEW_ENTRY,
        preview_url="",
        files=workspace_files,
        database_files=[f for f in workspace_files if f.group == "database"],
        artifacts=_artifacts(workspace_files),
        status="ready",
        summary=f"{title} — Projet {project_info['type']} généré avec {project_info['stack']}. {len(workspace_files)} fichiers créés.",
    )

    # 8. Sauvegarder le manifest
    _manifest_path(workspace_id).write_text(
        json.dumps(workspace.model_dump(), indent=2),
        encoding="utf-8",
    )

    logger.info(f"Project generated: {workspace_id} ({len(workspace_files)} files)")
    return workspace


def _generate_fallback_project(title: str, prompt: str, project_info: dict[str, Any]) -> dict[str, str]:
    """Génère un projet de fallback quand le LLM échoue."""
    project_type = project_info["type"]
    stack = project_info["stack"]

    files: dict[str, str] = {}

    # Preview HTML
    files[PREVIEW_ENTRY] = _generate_fallback_preview(title, prompt, project_info)

    # README
    files["docs/README.md"] = f"""# {title}

## Description
{prompt}

## Stack
- Type: {project_type}
- Stack: {stack}

## Structure
- `preview/index.html` — Point d'entrée principal
- `docs/README.md` — Documentation

## Utilisation
Ouvre `preview/index.html` dans un navigateur pour voir le projet.

## Généré par
AgentOS Project Generator Engine
"""

    return files


def _workspace_dir(workspace_id: str) -> Path:
    return WORKSPACES_ROOT / workspace_id


def _manifest_path(workspace_id: str) -> Path:
    return _workspace_dir(workspace_id) / MANIFEST_NAME


def load_workspace(workspace_id: str) -> GeneratedWorkspace | None:
    manifest = _manifest_path(workspace_id)
    if not manifest.exists():
        return None
    return GeneratedWorkspace.model_validate_json(manifest.read_text(encoding="utf-8"))


def attach_preview_url(workspace: GeneratedWorkspace, base_url: str) -> GeneratedWorkspace:
    return workspace.model_copy(
        update={
            "preview_url": f"{base_url.rstrip('/')}/workspace/builder/{workspace.workspace_id}/preview"
        }
    )


def read_workspace_file(workspace_id: str, relative_path: str) -> tuple[Path, str]:
    workspace_dir = _workspace_dir(workspace_id).resolve()
    file_path = (workspace_dir / relative_path).resolve()
    if workspace_dir not in file_path.parents and file_path != workspace_dir:
        raise FileNotFoundError("Invalid workspace file path")
    if not file_path.exists() or not file_path.is_file():
        raise FileNotFoundError(relative_path)
    return file_path, file_path.read_text(encoding="utf-8")


def preview_file_path(workspace_id: str) -> Path:
    preview_path = (_workspace_dir(workspace_id) / PREVIEW_ENTRY).resolve()
    if not preview_path.exists():
        raise FileNotFoundError(PREVIEW_ENTRY)
    return preview_path
