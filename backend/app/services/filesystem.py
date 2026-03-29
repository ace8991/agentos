from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable

TEXT_EXTENSIONS = {
    ".txt",
    ".md",
    ".json",
    ".yaml",
    ".yml",
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".html",
    ".css",
    ".scss",
    ".csv",
    ".log",
    ".ini",
    ".env",
}
SKIP_DIRS = {
    ".git",
    "node_modules",
    ".venv",
    "__pycache__",
    "dist",
    "build",
}
MAX_READ_CHARS = 12000
MAX_SEARCH_RESULTS = 8


def _candidate_roots(path: str | None) -> list[Path]:
    if path:
        return [Path(path).expanduser().resolve()]

    project_root = Path(__file__).resolve().parents[2]
    home = Path.home()
    roots = [
        project_root,
        home / "Documents",
        home / "Desktop",
        home / "Downloads",
    ]
    return [root for root in roots if root.exists()]


def _iter_files(roots: Iterable[Path]) -> Iterable[Path]:
    for root in roots:
        if root.is_file():
            yield root
            continue

        for current_root, dirs, files in os.walk(root):
            dirs[:] = [name for name in dirs if name not in SKIP_DIRS and not name.startswith(".")]
            for filename in files:
                if filename.startswith("."):
                    continue
                yield Path(current_root) / filename


def search_files(query: str, path: str | None = None, max_results: int = MAX_SEARCH_RESULTS) -> dict:
    normalized_query = (query or "").strip().lower()
    if not normalized_query:
        return {"success": False, "results": [], "description": "file_search requires a query"}

    roots = _candidate_roots(path)
    results: list[dict[str, str]] = []

    for candidate in _iter_files(roots):
        try:
            if not candidate.exists() or not candidate.is_file():
                continue

            name_match = normalized_query in candidate.name.lower()
            snippet = ""

            if not name_match and candidate.suffix.lower() in TEXT_EXTENSIONS and candidate.stat().st_size <= 512_000:
                content = candidate.read_text(encoding="utf-8", errors="ignore")
                index = content.lower().find(normalized_query)
                if index >= 0:
                    start = max(0, index - 80)
                    end = min(len(content), index + 220)
                    snippet = content[start:end].replace("\n", " ").strip()
            if not name_match and not snippet:
                continue

            results.append(
                {
                    "path": str(candidate),
                    "name": candidate.name,
                    "snippet": snippet,
                }
            )
            if len(results) >= max_results:
                break
        except OSError:
            continue

    return {
        "success": True,
        "results": results,
        "description": f"Found {len(results)} local file result(s) for '{query}'",
    }


def read_file(path: str) -> dict:
    if not path:
        return {"success": False, "description": "file_read requires a path"}

    target = Path(path).expanduser().resolve()
    if not target.exists() or not target.is_file():
        return {"success": False, "description": f"File not found: {target}"}

    try:
        if target.stat().st_size > 2_000_000:
            return {"success": False, "description": f"File is too large to read safely: {target.name}"}

        content = target.read_text(encoding="utf-8", errors="ignore")
        truncated = content[:MAX_READ_CHARS]
        if len(content) > MAX_READ_CHARS:
            truncated += "\n\n...[truncated]..."

        return {
            "success": True,
            "path": str(target),
            "name": target.name,
            "content": truncated,
            "description": f"Read local file: {target.name}",
        }
    except OSError as exc:
        return {"success": False, "description": f"Could not read {target.name}: {exc}"}
