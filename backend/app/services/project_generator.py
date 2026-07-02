"""
Project Generator Engine v2.0 — Agentic Project Generation
===========================================================
Génère des projets complets (apps web, jeux, animations 3D, dashboards, sites)
en utilisant l'agentic loop AVEC les outils filesystem (str_replace_editor, bash_tool).

Architecture:
  1. Analyse la demande → détecte le type de projet, stack, fonctionnalités
  2. Construit un system prompt spécialisé "Project Architect"
  3. Lance l'agentic loop (Anthropic/OpenAI) avec les outils filesystem
     → Le LLM crée les fichiers un par un via str_replace_editor (comme Claude Code)
     → Le LLM peut exécuter des commandes via bash_tool (npm init, pip install, etc.)
  4. Scanne les fichiers créés et construit le workspace
  5. Génère un preview HTML + résumé du projet
  6. Retourne le workspace GeneratedWorkspace (compatible builder existant)

Différence clé avec v1.0 :
  - v1.0 : appel LLM unique → parse <file> tags → écriture disque
  - v2.0 : agentic loop avec outils → le LLM utilise str_replace_editor pour créer
           chaque fichier, et bash_tool pour exécuter des commandes
           → Résultat : projets professionnels comme Codex/Claude Code/Roo Code
"""

from __future__ import annotations

import asyncio
import html
import json
import logging
import re
import uuid
from pathlib import Path
from typing import Any, AsyncGenerator

from app.models.schemas import (
    GeneratedWorkspace,
    GeneratedWorkspaceArtifact,
    GeneratedWorkspaceFile,
    GeneratedWorkspaceStack,
    WorkspaceFileGroup,
)
from app.services.runtime_config import get_runtime_value
from app.services.tool_executor import execute as run_tool
from app.services.skills_registry import build_skill_guidance

logger = logging.getLogger(__name__)

BACKEND_ROOT = Path(__file__).resolve().parents[2]
WORKSPACES_ROOT = BACKEND_ROOT / "generated_workspaces"
MANIFEST_NAME = "workspace.json"
PREVIEW_ENTRY = "preview/index.html"

WORKSPACES_ROOT.mkdir(parents=True, exist_ok=True)

MAX_GENERATION_ITERATIONS = 30  # Plus d'itérations pour les projets complexes

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

# ── System Prompt spécialisé pour la génération de projets via agentic loop ───

PROJECT_ARCHITECT_SYSTEM_PROMPT = """# AgentOS Project Architect — System Prompt v2.0

Tu es un **Architecte de Projet** spécialisé dans la génération de projets complets.
Tu utilises les outils à ta disposition pour créer des projets professionnels.

## OUTILS DISPONIBLES

### str_replace_editor (création et modification de fichiers)
- `command=create` : Crée un nouveau fichier avec `file_text`
- `command=str_replace` : Modifie une partie d'un fichier existant
- `command=view` : Lit le contenu d'un fichier

### bash_tool (exécution de commandes)
- Pour créer des dossiers : `mkdir -p chemin/vers/dossier`
- Pour initialiser des projets : `npm init -y`, `npm install react react-dom`
- Pour installer des dépendances Python : `pip install fastapi uvicorn`
- Pour exécuter des builds : `npx vite build`
- Pour vérifier le contenu : `ls -la`, `dir`

### list_directory (exploration)
- Pour lister le contenu d'un dossier

## PROCESSUS DE GÉNÉRATION

### Étape 1 : Planification
Analyse la demande et crée un plan d'architecture. Explique ta stratégie.

### Étape 2 : Création de la structure
Utilise bash_tool pour créer l'arborescence des dossiers.

### Étape 3 : Génération des fichiers
Pour CHAQUE fichier, utilise str_replace_editor avec `command=create` :
1. Fichiers de configuration (package.json, tsconfig.json, vite.config.ts, etc.)
2. Fichiers source (composants, pages, styles, etc.)
3. Fichier preview/index.html (point d'entrée principal)
4. Fichier docs/README.md (documentation)

### Étape 4 : Installation des dépendances
Utilise bash_tool pour installer les dépendances nécessaires.

### Étape 5 : Vérification
Vérifie que le projet est fonctionnel.

## RÈGLES DE GÉNÉRATION

1. **Code COMPLET et FONCTIONNEL** — Pas de placeholder, pas de "..." ou "// rest"
2. **PROJET COMPLET — JAMAIS UN SEUL FICHIER**. Tu DOIS créer au minimum :
   - `preview/index.html` (point d'entrée, toujours présent)
   - Au moins un fichier de styles (`preview/styles.css` ou inline complet)
   - Au moins un fichier de script principal si le projet est interactif (`preview/app.js`, composant React, etc.)
   - `docs/README.md` avec description, stack, instructions
   - Les fichiers de config nécessaires (`package.json`, `vite.config.ts`, etc.) si stack npm
   Une demande "crée un site/app/landing/jeu" attend un PROJET, pas un seul fichier.
3. **NE T'ARRÊTE PAS après un seul outil**. Continue à appeler `str_replace_editor` jusqu'à ce que le projet soit complet et que `preview/index.html` ouvre quelque chose d'utilisable seul.
4. **Structure professionnelle** — Utilise les standards du framework choisi
5. **CDN ou npm** selon le type de projet :
   - Projets simples (jeux, animations, landing pages statiques) : CDN dans `preview/index.html` + `preview/styles.css` + `preview/app.js`
   - Projets complexes (React, fullstack) : `client/`, `server/`, etc. avec config npm
6. **Dark mode** par défaut, design moderne et soigné
7. **Responsive** — fonctionne sur mobile et desktop
8. **Accessible** — attributs aria, rôles, labels
9. **Performant** — pas de fuites mémoire, animations optimisées

## CAPACITÉS SPÉCIALES

### 🎨 Génération d'images et visuels
- SVG complexes inline pour illustrations, logos, icônes
- Animations CSS sophistiquées (keyframes, transitions, transforms)
- Bibliothèques CDN (Three.js, Chart.js, GSAP, Framer Motion)
- Gradients, patterns, backgrounds en CSS

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

## FORMAT DE SORTIE

Le premier fichier DOIT être preview/index.html (point d'entrée principal).
Les fichiers suivants peuvent être dans des sous-dossiers organisés.

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


def _build_architect_prompt(user_prompt: str, project_info: dict[str, Any], workspace_dir: str) -> str:
    """Construit le prompt pour l'agentic loop avec le contexte du projet."""
    skill_guidance = build_skill_guidance(user_prompt, limit=3)

    parts = [
        f"## Demande utilisateur",
        user_prompt,
        "",
        f"## Type de projet détecté",
        f"- Type : {project_info['type']}",
        f"- Stack recommandée : {project_info['stack']}",
        f"- Description : {project_info['description']}",
        "",
        f"## Répertoire de travail",
        f"Tous les fichiers du projet doivent être créés dans : {workspace_dir}",
        f"",
        f"Utilise bash_tool avec `mkdir -p` pour créer les sous-dossiers nécessaires.",
        f"Utilise str_replace_editor avec `command=create` pour créer chaque fichier.",
        f"",
        f"## Instructions de génération",
        f"1. Analyse la demande en profondeur — comprends ce que l'utilisateur veut VRAIMENT",
        f"2. Conçois l'architecture du projet (composants, fichiers, structure)",
        f"3. Crée d'abord la structure des dossiers avec bash_tool",
        f"4. Génère TOUS les fichiers nécessaires — code COMPLET et fonctionnel",
        f"5. Inclus des animations, effets visuels, et une UI soignée",
        f"6. Ajoute un fichier docs/README.md avec la documentation complète",
        f"7. Le fichier preview/index.html DOIT être le point d'entrée principal",
        f"",
        f"## Règles qualité",
        f"- Design moderne, dark mode, responsive",
        f"- Code propre, bien structuré, commenté",
        f"- Fonctionnel immédiatement",
        f"- Expérience utilisateur soignée (transitions, feedback, états vides)",
    ]

    if skill_guidance:
        parts.extend(["", "## Compétences pertinentes", skill_guidance])

    return "\n".join(parts)


def _group_for_path(path: str) -> WorkspaceFileGroup:
    root = path.split("/", 1)[0]
    if root in {"client", "server", "database", "docs", "assets", "output"}:
        return root  # type: ignore[return-value]
    if root in {"src", "source"}:
        return "client"
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
        ".yaml": "yaml",
        ".yml": "yaml",
        ".toml": "toml",
        ".env": "env",
        ".gitignore": "ignore",
    }.get(Path(path).suffix.lower())


def _artifact_type_for_path(path: str, group: WorkspaceFileGroup) -> str:
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
    <div class="badge">✨ AgentOS Project Generator v2.0</div>
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


# ── Agentic Loop pour la génération de projet ────────────────────────────────

async def _run_agentic_generation(
    system_prompt: str,
    user_prompt: str,
    model: str,
    workspace_dir: Path,
) -> AsyncGenerator[str, None]:
    """
    Lance l'agentic loop pour générer le projet.
    Le LLM utilise les outils str_replace_editor et bash_tool
    pour créer les fichiers un par un.

    Yields des événements SSE pour le suivi en temps réel.
    """
    provider = _detect_provider(model)
    workspace_dir_str = str(workspace_dir.resolve())

    # Message initial avec le contexte
    messages: list[dict] = [
        {
            "role": "user",
            "content": user_prompt,
        }
    ]

    yield json.dumps({"type": "phase", "phase": "generating", "message": "Génération du projet en cours..."})

    if provider == "anthropic":
        async for event in _anthropic_agentic_loop(messages, model, system_prompt, workspace_dir_str):
            yield event
    else:
        async for event in _openai_agentic_loop(messages, model, system_prompt, workspace_dir_str, provider):
            yield event


async def _anthropic_agentic_loop(
    messages: list[dict],
    model: str,
    system: str,
    workspace_dir: str,
) -> AsyncGenerator[str, None]:
    """Agentic loop Anthropique avec outils filesystem pour la génération de projet."""
    import httpx

    key = (get_runtime_value("ANTHROPIC_API_KEY") or "").strip()
    if not key:
        yield json.dumps({"type": "error", "error": "ANTHROPIC_API_KEY is not configured"})
        return

    from app.services.tool_definitions import TOOLS_ANTHROPIC

    history = list(messages)
    files_created = 0
    headers = {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "anthropic-beta": "computer-use-2025-01-24",
    }
    logger.info(
        "[project_generator/anthropic] model=%s max_tokens=64000 tools=%d beta=%s",
        model, len(TOOLS_ANTHROPIC), headers["anthropic-beta"],
    )

    for iteration in range(MAX_GENERATION_ITERATIONS):
        payload: dict[str, Any] = {
            "model": model,
            "max_tokens": 64000,
            "system": system,
            "tools": TOOLS_ANTHROPIC,
            "messages": history,
        }

        try:
            async with httpx.AsyncClient(timeout=300) as client:
                async with client.stream(
                    "POST", "https://api.anthropic.com/v1/messages",
                    headers=headers,
                    json=payload,
                ) as resp:
                    if resp.status_code != 200:
                        body = await resp.aread()
                        try:
                            err = json.loads(body).get("error", {}).get("message", body.decode()[:300])
                        except Exception:
                            err = body.decode()[:300]
                        yield json.dumps({"type": "error", "error": f"Anthropic {resp.status_code}: {err}"})
                        return

                    response_blocks: list[dict] = []
                    current_block: dict | None = None
                    stop_reason: str = "end_turn"
                    tool_calls: list[dict] = []

                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        raw = line[6:].strip()
                        if not raw:
                            continue
                        try:
                            ev = json.loads(raw)
                        except Exception:
                            continue

                        ev_type = ev.get("type", "")

                        if ev_type == "content_block_start":
                            blk = ev.get("content_block", {})
                            current_block = {"type": blk.get("type"), "text": "", "input_json": ""}
                            if blk.get("type") == "tool_use":
                                current_block["id"] = blk.get("id", "")
                                current_block["name"] = blk.get("name", "")

                        elif ev_type == "content_block_delta" and current_block:
                            delta = ev.get("delta", {})
                            if delta.get("type") == "text_delta":
                                t = delta.get("text", "")
                                current_block["text"] += t
                                yield json.dumps({"type": "text", "text": t})
                            elif delta.get("type") == "input_json_delta":
                                current_block["input_json"] += delta.get("partial_json", "")

                        elif ev_type == "content_block_stop" and current_block:
                            if current_block["type"] == "tool_use":
                                try:
                                    args = json.loads(current_block["input_json"] or "{}")
                                except Exception:
                                    args = {}
                                tool_calls.append({
                                    "id": current_block["id"],
                                    "name": current_block["name"],
                                    "args": args,
                                })
                                response_blocks.append({
                                    "type": "tool_use",
                                    "id": current_block["id"],
                                    "name": current_block["name"],
                                    "input": args,
                                })
                            elif current_block["text"]:
                                response_blocks.append({
                                    "type": current_block["type"],
                                    "text": current_block["text"],
                                })
                            current_block = None

                        elif ev_type == "message_delta":
                            stop_reason = ev.get("delta", {}).get("stop_reason", "end_turn")

                        elif ev_type == "error":
                            yield json.dumps({"type": "error", "error": ev.get("error", {}).get("message", "Streaming error")})
                            return

        except httpx.ConnectError:
            yield json.dumps({"type": "error", "error": "Cannot connect to Anthropic API"})
            return
        except httpx.TimeoutException:
            yield json.dumps({"type": "error", "error": "Anthropic API timeout"})
            return
        except Exception as exc:
            logger.exception("Anthropic agentic generation error")
            yield json.dumps({"type": "error", "error": str(exc)})
            return

        # Ajouter la réponse assistant à l'historique
        if response_blocks:
            history.append({"role": "assistant", "content": response_blocks})

        # Pas d'appels d'outils → terminé
        if stop_reason == "end_turn" or not tool_calls:
            break

        # Exécuter tous les appels d'outils
        tool_results: list[dict] = []
        for tc in tool_calls:
            tool_name = tc["name"]
            tool_args = tc["args"]

            # Rediriger les chemins vers le workspace
            if tool_name == "str_replace_editor" and "path" in tool_args:
                tool_args["path"] = _resolve_workspace_path(tool_args["path"], workspace_dir)
            elif tool_name == "bash_tool" and "command" in tool_args:
                tool_args["command"] = _inject_workspace_cwd(tool_args["command"], workspace_dir)
            elif tool_name == "list_directory" and "path" in tool_args:
                tool_args["path"] = _resolve_workspace_path(tool_args["path"], workspace_dir)

            yield json.dumps({
                "type": "tool_call",
                "tool": tool_name,
                "args": tool_args,
                "id": tc["id"],
            })

            result_str = run_tool(tool_name, tool_args)
            ok = not result_str.startswith("ERROR")

            # Compter les fichiers créés
            if ok and tool_name == "str_replace_editor":
                cmd = tool_args.get("command", "")
                if cmd == "create":
                    files_created += 1
                    yield json.dumps({
                        "type": "file_created",
                        "path": tool_args.get("path", ""),
                        "total": files_created,
                    })

            yield json.dumps({
                "type": "tool_result",
                "tool": tool_name,
                "result": result_str,
                "id": tc["id"],
                "success": ok,
            })

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tc["id"],
                "content": result_str,
            })

        history.append({"role": "user", "content": tool_results})
        tool_calls = []

    yield json.dumps({"type": "phase", "phase": "parsing", "message": f"Finalisation ({files_created} fichiers créés)..."})
    yield json.dumps({"type": "done", "files_created": files_created})


async def _openai_agentic_loop(
    messages: list[dict],
    model: str,
    system: str,
    workspace_dir: str,
    provider: str,
) -> AsyncGenerator[str, None]:
    """Agentic loop OpenAI-compatible avec outils filesystem pour la génération de projet."""
    import httpx

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
        yield json.dumps({"type": "error", "error": f"{key_name} is not configured"})
        return

    from app.services.tool_definitions import TOOLS_OPENAI

    history: list[dict] = []
    if system:
        history.append({"role": "system", "content": system})
    history.extend(messages)

    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"

    files_created = 0
    logger.info(
        "[project_generator/%s] model=%s max_tokens=64000 tools=%d",
        provider, model, len(TOOLS_OPENAI),
    )

    for iteration in range(MAX_GENERATION_ITERATIONS):
        assistant_text = ""
        tool_calls_acc: dict[int, dict[str, str]] = {}
        finish_reason: str = "stop"

        payload: dict[str, Any] = {
            "model": model,
            "messages": history,
            "tools": TOOLS_OPENAI,
            "tool_choice": "auto",
            "stream": True,
            "max_tokens": 64000,
        }

        try:
            async with httpx.AsyncClient(timeout=300) as client:
                async with client.stream(
                    "POST", f"{base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                ) as resp:
                    if resp.status_code != 200:
                        body = await resp.aread()
                        try:
                            err = json.loads(body).get("error", {}).get("message", body.decode()[:300])
                        except Exception:
                            err = body.decode()[:300]
                        yield json.dumps({"type": "error", "error": f"{provider} {resp.status_code}: {err}"})
                        return

                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        raw = line[6:].strip()
                        if not raw or raw == "[DONE]":
                            continue
                        try:
                            chunk = json.loads(raw)
                        except Exception:
                            continue

                        choice = chunk.get("choices", [{}])[0]
                        delta = choice.get("delta", {})
                        fr = choice.get("finish_reason")
                        if fr:
                            finish_reason = fr

                        # Text token
                        text = delta.get("content", "")
                        if text:
                            assistant_text += text
                            yield json.dumps({"type": "text", "text": text})

                        # Reasoning token (DeepSeek-R1, Qwen3)
                        thinking = delta.get("reasoning_content", "")
                        if thinking:
                            yield json.dumps({"type": "thinking", "text": thinking})

                        # Tool call accumulation
                        for tc_delta in delta.get("tool_calls", []):
                            idx = tc_delta.get("index", 0)
                            if idx not in tool_calls_acc:
                                tool_calls_acc[idx] = {
                                    "id": tc_delta.get("id", f"call_{idx}"),
                                    "name": "",
                                    "args": "",
                                }
                            fn = tc_delta.get("function", {})
                            if fn.get("name"):
                                tool_calls_acc[idx]["name"] += fn["name"]
                            if fn.get("arguments"):
                                tool_calls_acc[idx]["args"] += fn["arguments"]

        except httpx.ConnectError:
            yield json.dumps({"type": "error", "error": f"Cannot connect to {provider}"})
            return
        except httpx.TimeoutException:
            yield json.dumps({"type": "error", "error": f"{provider} API timeout"})
            return
        except Exception as exc:
            logger.exception("%s agentic generation error", provider)
            yield json.dumps({"type": "error", "error": str(exc)})
            return

        # Build assistant message
        assistant_msg: dict[str, Any] = {"role": "assistant"}
        if assistant_text:
            assistant_msg["content"] = assistant_text
        if tool_calls_acc:
            assistant_msg["tool_calls"] = [
                {
                    "id": tc["id"],
                    "type": "function",
                    "function": {"name": tc["name"], "arguments": tc["args"]},
                }
                for tc in tool_calls_acc.values()
            ]
        history.append(assistant_msg)

        # No tool calls → done
        if finish_reason != "tool_calls" or not tool_calls_acc:
            break

        # Execute tool calls
        for tc in tool_calls_acc.values():
            try:
                args = json.loads(tc["args"] or "{}")
            except Exception:
                args = {}

            # Rediriger les chemins vers le workspace
            tool_name = tc["name"]
            tool_args = args
            if tool_name == "str_replace_editor" and "path" in tool_args:
                tool_args["path"] = _resolve_workspace_path(tool_args["path"], workspace_dir)
            elif tool_name == "bash_tool" and "command" in tool_args:
                tool_args["command"] = _inject_workspace_cwd(tool_args["command"], workspace_dir)
            elif tool_name == "list_directory" and "path" in tool_args:
                tool_args["path"] = _resolve_workspace_path(tool_args["path"], workspace_dir)

            yield json.dumps({
                "type": "tool_call",
                "tool": tool_name,
                "args": tool_args,
                "id": tc["id"],
            })

            result_str = run_tool(tool_name, tool_args)
            ok = not result_str.startswith("ERROR")

            # Compter les fichiers créés
            if ok and tool_name == "str_replace_editor":
                cmd = tool_args.get("command", "")
                if cmd == "create":
                    files_created += 1
                    yield json.dumps({
                        "type": "file_created",
                        "path": tool_args.get("path", ""),
                        "total": files_created,
                    })

            yield json.dumps({
                "type": "tool_result",
                "tool": tool_name,
                "result": result_str,
                "id": tc["id"],
                "success": ok,
            })

            history.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": result_str,
            })

        tool_calls_acc = {}

    yield json.dumps({"type": "phase", "phase": "parsing", "message": f"Finalisation ({files_created} fichiers créés)..."})
    yield json.dumps({"type": "done", "files_created": files_created})


# ── Helpers pour la redirection des chemins ──────────────────────────────────

def _resolve_workspace_path(path: str, workspace_dir: str) -> str:
    """
    Résout un chemin de fichier pour qu'il pointe vers le workspace.
    Si le chemin est relatif, il est résolu par rapport au workspace_dir.
    Si c'est un chemin absolu, on le laisse tel quel.
    """
    p = Path(path)
    if p.is_absolute():
        return str(p.resolve())
    # Chemin relatif → dans le workspace
    return str((Path(workspace_dir) / p).resolve())


def _inject_workspace_cwd(command: str, workspace_dir: str) -> str:
    """
    Force toutes les commandes shell à s'exécuter à l'intérieur du workspace
    du projet généré, pour qu'aucun fichier ne soit créé ailleurs sur le PC.
    """
    if not command or not command.strip():
        return command
    stripped = command.strip()
    # Si la commande commence déjà par un cd vers le workspace, ne rien changer
    if stripped.startswith("cd ") and workspace_dir in stripped:
        return command
    # Pour PowerShell on enchaîne avec ';' ; pour bash/cmd '&&' fonctionne aussi en PS 7+
    return f'cd "{workspace_dir}"; {command}'


# ── Détection du provider ────────────────────────────────────────────────────

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


# ── Fonction principale de génération ────────────────────────────────────────

async def generate_project(
    prompt: str,
    model: str = "claude-sonnet-4-7",
) -> AsyncGenerator[str, None]:
    """
    Génère un projet complet à partir d'une description textuelle.
    Utilise l'agentic loop avec outils filesystem pour créer les fichiers.

    Yields des événements JSON pour le suivi en temps réel :
      - {"type": "phase", "phase": "analyzing|generating|parsing|complete", "message": "..."}
      - {"type": "text", "text": "..."}
      - {"type": "tool_call", "tool": "...", "args": {...}, "id": "..."}
      - {"type": "tool_result", "tool": "...", "result": "...", "id": "...", "success": true}
      - {"type": "file_created", "path": "...", "total": 5}
      - {"type": "workspace", "workspace": {...}}  ← résultat final
      - {"type": "error", "error": "..."}
    """
    workspace_id = uuid.uuid4().hex[:12]
    title = _pick_title(prompt)
    project_info = _detect_project_type(prompt)
    workspace_dir = WORKSPACES_ROOT / workspace_id

    logger.info(f"Generating project: {title} (type={project_info['type']}, model={model})")

    # Phase 1 : Analyse
    yield json.dumps({
        "type": "phase",
        "phase": "analyzing",
        "message": f"Analyse de la demande : {title}",
        "project_info": project_info,
    })

    # Créer le répertoire du workspace
    workspace_dir.mkdir(parents=True, exist_ok=True)

    # Phase 2 : Génération via agentic loop
    architect_prompt = _build_architect_prompt(prompt, project_info, str(workspace_dir.resolve()))

    try:
        async for event in _run_agentic_generation(
            PROJECT_ARCHITECT_SYSTEM_PROMPT,
            architect_prompt,
            model,
            workspace_dir,
        ):
            yield event
    except Exception as e:
        logger.error(f"Agentic generation failed: {e}")
        yield json.dumps({"type": "error", "error": f"Generation failed: {str(e)}"})
        # Fallback : créer un projet minimal
        yield json.dumps({
            "type": "phase",
            "phase": "generating",
            "message": "Génération de fallback...",
        })
        _generate_fallback_files(workspace_dir, title, prompt, project_info)

    # Phase 3 : Scanner les fichiers et construire le workspace
    yield json.dumps({
        "type": "phase",
        "phase": "parsing",
        "message": "Analyse des fichiers générés...",
    })

    workspace_files = _scan_files(workspace_dir)

    # S'assurer que preview/index.html existe
    preview_path = workspace_dir / PREVIEW_ENTRY
    if not preview_path.exists():
        preview_content = _generate_fallback_preview(title, prompt, project_info)
        (workspace_dir / "preview").mkdir(parents=True, exist_ok=True)
        (workspace_dir / PREVIEW_ENTRY).write_text(preview_content, encoding="utf-8")
        workspace_files = _scan_files(workspace_dir)

    # Construire le workspace
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

    # Sauvegarder le manifest
    _manifest_path(workspace_id).write_text(
        json.dumps(workspace.model_dump(), indent=2),
        encoding="utf-8",
    )

    logger.info(f"Project generated: {workspace_id} ({len(workspace_files)} files)")

    yield json.dumps({
        "type": "phase",
        "phase": "complete",
        "message": f"Projet terminé — {len(workspace_files)} fichiers créés",
    })
    yield json.dumps({"type": "workspace", "workspace": workspace.model_dump()})


def _generate_fallback_files(workspace_dir: Path, title: str, prompt: str, project_info: dict[str, Any]) -> None:
    """Génère des fichiers de fallback quand l'agentic loop échoue."""
    # Preview HTML
    preview_content = _generate_fallback_preview(title, prompt, project_info)
    (workspace_dir / "preview").mkdir(parents=True, exist_ok=True)
    (workspace_dir / PREVIEW_ENTRY).write_text(preview_content, encoding="utf-8")

    # README
    readme = f"""# {title}

## Description
{prompt}

## Stack
- Type: {project_info['type']}
- Stack: {project_info['stack']}

## Structure
- `preview/index.html` — Point d'entrée principal
- `docs/README.md` — Documentation

## Utilisation
Ouvre `preview/index.html` dans un navigateur pour voir le projet.

## Généré par
AgentOS Project Generator Engine v2.0
"""
    (workspace_dir / "docs").mkdir(parents=True, exist_ok=True)
    (workspace_dir / "docs" / "README.md").write_text(readme, encoding="utf-8")


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
