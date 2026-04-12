from __future__ import annotations

import json
import os
import re
import zipfile
from pathlib import Path
from typing import Any


BACKEND_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = BACKEND_ROOT / "data"
CACHE_PATH = DATA_DIR / "skills_catalog.json"
DEFAULT_SKILLS_ZIP = Path(
    os.getenv("AGENTOS_SKILLS_ZIP", str(Path.home() / "Downloads" / "skills-main.zip"))
)

_cache: list[dict[str, Any]] | None = None
_cache_key: tuple[str, float] | None = None


def _slug_to_name(slug: str) -> str:
    return " ".join(part.capitalize() for part in slug.replace("_", "-").split("-") if part)


def _parse_frontmatter(text: str) -> dict[str, str]:
    if not text.startswith("---"):
        return {}
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n?", text, flags=re.DOTALL)
    if not match:
        return {}
    fields: dict[str, str] = {}
    for raw_line in match.group(1).splitlines():
        line = raw_line.strip()
        if not line or ":" not in line:
            continue
        key, value = line.split(":", 1)
        fields[key.strip()] = value.strip().strip('"').strip("'")
    return fields


def _strip_frontmatter(text: str) -> str:
    return re.sub(r"^---\s*\n.*?\n---\s*\n?", "", text, count=1, flags=re.DOTALL)


def _extract_summary(text: str, description: str) -> str:
    body = _strip_frontmatter(text)
    body = re.sub(r"```.*?```", "", body, flags=re.DOTALL)
    lines = [line.strip() for line in body.splitlines()]
    bullets: list[str] = []
    paragraphs: list[str] = []
    for line in lines:
        if not line or line.startswith("#"):
            continue
        cleaned = re.sub(r"^[-*]\s+", "", line)
        cleaned = re.sub(r"^\d+\.\s+", "", cleaned)
        if line.startswith(("-", "*")) or re.match(r"^\d+\.\s+", line):
            bullets.append(cleaned.rstrip("."))
        elif len(paragraphs) < 2:
            paragraphs.append(cleaned)
    parts: list[str] = []
    if description:
        parts.append(description.rstrip("."))
    parts.extend(paragraphs[:1])
    if bullets:
        parts.append("Key guidance: " + "; ".join(bullets[:3]) + ".")
    summary = " ".join(part for part in parts if part).strip()
    return re.sub(r"\s+", " ", summary)[:900]


def _extract_tags(slug: str, description: str, summary: str) -> list[str]:
    tokens = re.findall(r"[a-z0-9][a-z0-9\-+/.]{2,}", f"{slug} {description} {summary}".lower())
    tags: list[str] = []
    for token in tokens:
        normalized = token.strip(".,:;()[]{}")
        if normalized not in tags:
            tags.append(normalized)
        if len(tags) >= 18:
            break
    return tags


def _build_record(entry_name: str, skill_text: str) -> dict[str, Any]:
    parts = Path(entry_name).parts
    try:
        skills_index = parts.index("skills")
        slug = parts[skills_index + 1]
    except (ValueError, IndexError):
        slug = Path(entry_name).parent.name

    frontmatter = _parse_frontmatter(skill_text)
    name = frontmatter.get("name") or slug
    description = frontmatter.get("description") or ""
    summary = _extract_summary(skill_text, description)
    tags = _extract_tags(slug, description, summary)

    return {
        "id": f"imported::{slug}",
        "slug": slug,
        "name": _slug_to_name(name),
        "description": description or f"Imported skill for {slug}.",
        "prompt": summary or description or f"Use the {slug} skill when the task matches its specialty.",
        "source": "imported",
        "skill_path": entry_name,
        "tags": tags,
    }


def _load_from_zip(zip_path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    with zipfile.ZipFile(zip_path) as archive:
        entries = sorted(
            entry
            for entry in archive.namelist()
            if entry.endswith("/SKILL.md") and "/skills/" in entry
        )
        for entry_name in entries:
            with archive.open(entry_name) as handle:
                skill_text = handle.read().decode("utf-8", errors="replace")
            records.append(_build_record(entry_name, skill_text))
    return records


def _write_cache(records: list[dict[str, Any]], zip_path: Path) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "source_zip": str(zip_path),
        "updated_at": zip_path.stat().st_mtime if zip_path.exists() else None,
        "skills": records,
    }
    CACHE_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _read_cache() -> list[dict[str, Any]]:
    if not CACHE_PATH.exists():
        return []
    try:
        payload = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []
    skills = payload.get("skills")
    if not isinstance(skills, list):
        return []
    return [skill for skill in skills if isinstance(skill, dict)]


def sync_skill_catalog(zip_path: Path | None = None, *, force: bool = False) -> list[dict[str, Any]]:
    global _cache, _cache_key
    target = (zip_path or DEFAULT_SKILLS_ZIP).expanduser()
    if not target.exists():
        cached = _read_cache()
        _cache = cached
        _cache_key = (str(target), 0.0)
        return cached

    mtime = target.stat().st_mtime
    cache_key = (str(target), mtime)
    if not force and _cache is not None and _cache_key == cache_key:
        return _cache

    records = _load_from_zip(target)
    _write_cache(records, target)
    _cache = records
    _cache_key = cache_key
    return records


def get_skill_catalog() -> list[dict[str, Any]]:
    global _cache
    if _cache is not None:
        return _cache
    records = sync_skill_catalog()
    if records:
        return records
    cached = _read_cache()
    _cache = cached
    return cached


def _tokenize(text: str) -> set[str]:
    stopwords = {
        "with",
        "that",
        "this",
        "from",
        "into",
        "about",
        "skill",
        "create",
        "build",
        "make",
        "generate",
        "edit",
        "update",
        "improve",
        "help",
        "need",
        "please",
        "faire",
        "cree",
        "creer",
    }
    return {
        token
        for token in re.findall(r"[a-z0-9][a-z0-9\-+/.]{2,}", text.lower())
        if token not in stopwords
    }


def find_relevant_skills(task: str, limit: int = 4) -> list[dict[str, Any]]:
    query = task.strip()
    if not query:
        return []

    query_tokens = _tokenize(query)
    if not query_tokens:
        return []

    web_intent = bool({"website", "landing", "page", "app", "ui", "frontend", "preview"} & query_tokens)
    doc_intent = bool({"docx", "word", "document", "documents", "pptx", "xlsx", "spreadsheet"} & query_tokens)

    ranked: list[tuple[int, dict[str, Any]]] = []
    for skill in get_skill_catalog():
        haystack = " ".join(
            [
                skill.get("slug", ""),
                skill.get("name", ""),
                skill.get("description", ""),
                " ".join(skill.get("tags", []) or []),
                skill.get("prompt", ""),
            ]
        )
        skill_tokens = _tokenize(haystack)
        if web_intent and not ({"website", "landing", "page", "app", "react", "vite", "tailwind", "frontend", "ui", "design", "theme", "preview", "canvas"} & skill_tokens):
            continue
        if doc_intent and not ({"docx", "word", "document", "documents", "pptx", "xlsx", "sheet", "presentation"} & skill_tokens):
            continue
        overlap = len(query_tokens & skill_tokens)
        slug = str(skill.get("slug", "")).lower()
        exact_bonus = 3 if slug and slug in query.lower() else 0
        keyword_bonus = 0
        if {"website", "landing", "page", "app"} & query_tokens:
            if {"website", "landing", "app", "react", "vite", "tailwind"} & skill_tokens:
                keyword_bonus += 2
        if {"docx", "word", "document"} & query_tokens:
            if {"docx", "word", "document"} & skill_tokens:
                keyword_bonus += 2
        score = overlap + exact_bonus + keyword_bonus
        if score > 0:
            ranked.append((score, skill))

    ranked.sort(key=lambda item: (-item[0], item[1].get("name", "")))
    return [skill for _score, skill in ranked[:limit]]


def build_skill_guidance(task: str, limit: int = 3) -> str:
    matches = find_relevant_skills(task, limit=limit)
    if not matches:
        return ""
    lines = [
        "Relevant imported skills to respect:",
        *[
            f"- {skill['name']}: {skill['prompt']}"
            for skill in matches
        ],
    ]
    return "\n".join(lines)
