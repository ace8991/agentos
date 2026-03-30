from __future__ import annotations

import html
import json
import re
import uuid
from pathlib import Path

from app.models.schemas import (
    GeneratedWorkspace,
    GeneratedWorkspaceArtifact,
    GeneratedWorkspaceFile,
    GeneratedWorkspaceStack,
)

BACKEND_ROOT = Path(__file__).resolve().parents[2]
WORKSPACES_ROOT = BACKEND_ROOT / "generated_workspaces"
MANIFEST_NAME = "workspace.json"
PREVIEW_ENTRY = "preview/index.html"

WORKSPACES_ROOT.mkdir(parents=True, exist_ok=True)


def _slugify(value: str) -> str:
    return (re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "workspace")


def _pick_title(prompt: str, explicit_title: str | None = None) -> str:
    if explicit_title and explicit_title.strip():
        return explicit_title.strip()
    words = re.findall(r"[A-Za-z0-9]+", prompt)
    return " ".join(word.capitalize() for word in words[:4]) or "Generated Workspace"


def _infer_kind(prompt: str) -> str:
    lowered = prompt.lower()
    if any(keyword in lowered for keyword in ("slides", "presentation", "deck", "pitch")):
        return "presentation"
    if "landing" in lowered:
        return "landing"
    if "dashboard" in lowered or "admin" in lowered:
        return "dashboard"
    if any(keyword in lowered for keyword in ("website", "site", "webpage")):
        return "website"
    return "app"


def _needs_backend(prompt: str, kind: str) -> bool:
    lowered = prompt.lower()
    return kind == "dashboard" or any(
        keyword in lowered
        for keyword in ("auth", "login", "signup", "api", "server", "backend", "upload", "cms", "admin")
    )


def _needs_database(prompt: str, kind: str) -> bool:
    lowered = prompt.lower()
    return _needs_backend(prompt, kind) or any(
        keyword in lowered
        for keyword in ("database", "sql", "sqlite", "postgres", "supabase", "prisma", "schema", "users")
    )


def _stack(prompt: str, kind: str) -> GeneratedWorkspaceStack:
    return GeneratedWorkspaceStack(
        frontend="React + Vite + TypeScript + Tailwind CSS",
        ui="shadcn/ui + Radix UI patterns",
        backend="FastAPI service" if _needs_backend(prompt, kind) else None,
        database="SQLite schema" if _needs_database(prompt, kind) else None,
    )


def _preview_html(title: str, prompt: str, kind: str, stack: GeneratedWorkspaceStack) -> str:
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{html.escape(title)} Preview</title>
    <style>
      :root {{
        color-scheme: dark;
        --bg: #080b13;
        --surface: rgba(15, 21, 34, 0.88);
        --border: rgba(255,255,255,0.1);
        --text: #eef3ff;
        --muted: rgba(238,243,255,0.66);
        --accent: #7ea7ff;
      }}
      * {{ box-sizing: border-box; }}
      body {{
        margin: 0;
        font-family: Inter, "Segoe UI Variable", "Segoe UI", system-ui, sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at 18% 12%, rgba(87,130,255,.24), transparent 22%),
          radial-gradient(circle at 82% 14%, rgba(244,181,94,.18), transparent 18%),
          linear-gradient(180deg, #13192a 0%, #07090f 100%);
      }}
      .shell {{
        min-height: 100vh;
        display: grid;
        grid-template-columns: 240px minmax(0, 1fr);
        gap: 24px;
        padding: 28px;
      }}
      .rail, .main {{
        border: 1px solid var(--border);
        border-radius: 28px;
        background: var(--surface);
        backdrop-filter: blur(18px);
      }}
      .rail {{ padding: 20px; }}
      .main {{ overflow: hidden; }}
      .topbar {{
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        padding: 20px 24px;
        border-bottom: 1px solid var(--border);
      }}
      .pill {{
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 9px 14px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: rgba(255,255,255,.04);
        color: var(--muted);
        font-size: 13px;
      }}
      .content {{
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) 320px;
        gap: 24px;
        padding: 24px;
      }}
      .hero {{
        border-radius: 28px;
        border: 1px solid var(--border);
        background: linear-gradient(180deg, rgba(8,11,19,.2), rgba(8,11,19,.65));
        padding: 28px;
      }}
      h1 {{
        margin: 18px 0 12px;
        font-size: clamp(2.6rem, 5vw, 4.9rem);
        line-height: .95;
        letter-spacing: -.05em;
      }}
      p {{ color: var(--muted); line-height: 1.7; }}
      ul {{ display: grid; gap: 12px; padding-left: 18px; color: var(--muted); }}
      .card {{
        border-radius: 24px;
        border: 1px solid var(--border);
        background: rgba(255,255,255,.035);
        padding: 20px;
      }}
      .stack {{ list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; }}
      .stack li {{ display: flex; justify-content: space-between; gap: 12px; }}
      .stack strong {{ color: var(--text); text-align: right; }}
      @media (max-width: 1100px) {{
        .shell, .content {{ grid-template-columns: 1fr; }}
      }}
    </style>
  </head>
  <body>
    <div class="shell">
      <aside class="rail">
        <div class="pill">AgentOS Builder</div>
        <h3>{html.escape(title)}</h3>
        <p>{html.escape(prompt.strip())}</p>
        <ul>
          <li>Preview surface ready</li>
          <li>Code workspace persisted locally</li>
          <li>Database only when required</li>
        </ul>
      </aside>
      <main class="main">
        <div class="topbar">
          <div class="pill">Workspace generated locally</div>
          <div class="pill">{html.escape(kind.title())} build</div>
        </div>
        <div class="content">
          <section class="hero">
            <div class="pill">Lovable-style contract</div>
            <h1>{html.escape(title)}</h1>
            <p>Generated as a structured builder workspace with Preview, Code, Database, and Files surfaces. This preview is served locally so the right-side panel can inspect it instantly.</p>
          </section>
          <aside class="card">
            <h3>Stack</h3>
            <ul class="stack">
              <li><span>Frontend</span><strong>{html.escape(stack.frontend)}</strong></li>
              <li><span>UI</span><strong>{html.escape(stack.ui)}</strong></li>
              <li><span>Backend</span><strong>{html.escape(stack.backend or 'Optional')}</strong></li>
              <li><span>Database</span><strong>{html.escape(stack.database or 'Optional')}</strong></li>
            </ul>
          </aside>
        </div>
      </main>
    </div>
  </body>
</html>
"""


def _app_source(title: str, prompt: str, kind: str) -> str:
    metrics = ""
    if kind == "dashboard":
        metrics = """
      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Users', value: '12.4K' },
          { label: 'Revenue', value: '$38K' },
          { label: 'Retention', value: '92%' },
        ].map((metric) => (
          <div key={metric.label} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">{metric.label}</p>
            <p className="mt-4 text-4xl font-semibold tracking-tight">{metric.value}</p>
          </div>
        ))}
      </section>
"""
    return f"""import {{ ArrowRight, FolderTree, MonitorPlay, Sparkles }} from 'lucide-react';

const features = [
  'React + Vite + TypeScript scaffold',
  'Tailwind CSS and builder-ready UI tokens',
  'Preview, Code, Database, and Files surfaces',
];

export default function App() {{
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(93,146,255,0.18),transparent_24%),linear-gradient(180deg,#11192a_0%,#07090f_100%)] text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:px-10">
        <header className="flex items-center justify-between rounded-full border border-white/10 bg-white/[0.04] px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="h-3.5 w-3.5 rounded-md bg-gradient-to-br from-sky-400 to-violet-500" />
            <span className="text-sm font-medium">AgentOS Builder</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-white/70">
            <Sparkles className="h-3.5 w-3.5" />
            {kind.title()} workspace
          </div>
        </header>
        <main className="flex flex-1 flex-col justify-center py-16">
          <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white/55">
                Modern builder output
              </div>
              <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-[-0.06em] md:text-7xl">{title}</h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-white/70 md:text-lg">
                Generated from the request: {prompt.strip().replace("'", "\\'")}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-slate-950">
                  Open preview
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/78">
                  <FolderTree className="h-4 w-4" />
                  Inspect code
                </button>
              </div>
            </div>
            <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
              <div className="rounded-3xl border border-white/10 bg-[#0d1524]/88 p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Preview contract</p>
                <p className="mt-4 text-sm leading-7 text-white/70">
                  This generated starter follows a Lovable-style contract: React, Vite, TypeScript, Tailwind CSS, and separate workspace surfaces for preview, code, database, and files.
                </p>
              </div>
            </div>
          </section>
{metrics}
          <section className="mt-16 grid gap-4 lg:grid-cols-3">
            {{features.map((feature) => (
              <article key={{feature}} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
                <MonitorPlay className="h-5 w-5 text-sky-200" />
                <h2 className="mt-5 text-xl font-medium tracking-tight">{{feature}}</h2>
                <p className="mt-3 text-sm leading-7 text-white/68">Designed to plug directly into the AgentOS workspace panel for fast iteration.</p>
              </article>
            ))}}
          </section>
        </main>
      </div>
    </div>
  );
}}
"""


def _server_source(title: str) -> str:
    slug = _slugify(title).replace("-", "_")
    return f"""from fastapi import FastAPI

app = FastAPI(title="{title} API")


@app.get("/health")
def health() -> dict[str, str]:
    return {{"status": "ok", "service": "{slug}_api"}}
"""


def _schema_source(title: str) -> str:
    slug = _slugify(title).replace("-", "_")
    return f"""create table if not exists {slug}_users (
  id integer primary key autoincrement,
  email text not null unique,
  display_name text not null,
  created_at text default current_timestamp
);

create table if not exists {slug}_events (
  id integer primary key autoincrement,
  user_id integer references {slug}_users(id),
  title text not null,
  payload text,
  created_at text default current_timestamp
);
"""


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
    if suffix in {".tsx", ".ts", ".css", ".json", ".py"}:
        return "code"
    if suffix == ".html":
        return "app" if path.startswith("preview/") else "html"
    if suffix == ".md":
        return "document"
    return "file"


def _workspace_dir(workspace_id: str) -> Path:
    return WORKSPACES_ROOT / workspace_id


def _manifest_path(workspace_id: str) -> Path:
    return _workspace_dir(workspace_id) / MANIFEST_NAME


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


def create_workspace(prompt: str, title: str | None = None) -> GeneratedWorkspace:
    workspace_id = uuid.uuid4().hex[:12]
    kind = _infer_kind(prompt)
    resolved_title = _pick_title(prompt, title)
    stack = _stack(prompt, kind)
    workspace_dir = _workspace_dir(workspace_id)
    workspace_dir.mkdir(parents=True, exist_ok=True)

    files = {
        "client/package.json": json.dumps(
            {
                "name": _slugify(resolved_title),
                "private": True,
                "version": "0.1.0",
                "type": "module",
                "scripts": {"dev": "vite", "build": "tsc -b && vite build", "preview": "vite preview"},
                "dependencies": {"react": "^18.3.1", "react-dom": "^18.3.1", "lucide-react": "^0.460.0"},
                "devDependencies": {
                    "@types/react": "^18.3.5",
                    "@types/react-dom": "^18.3.0",
                    "@vitejs/plugin-react-swc": "^3.7.1",
                    "autoprefixer": "^10.4.20",
                    "postcss": "^8.4.45",
                    "tailwindcss": "^3.4.13",
                    "typescript": "^5.5.4",
                    "vite": "^5.4.8",
                },
            },
            indent=2,
        )
        + "\n",
        "client/tsconfig.json": json.dumps(
            {
                "compilerOptions": {
                    "target": "ES2020",
                    "lib": ["ES2020", "DOM", "DOM.Iterable"],
                    "module": "ESNext",
                    "moduleResolution": "Bundler",
                    "strict": True,
                    "jsx": "react-jsx",
                    "noEmit": True,
                    "baseUrl": ".",
                    "paths": {"@/*": ["src/*"]},
                },
                "include": ["src"],
            },
            indent=2,
        )
        + "\n",
        "client/vite.config.ts": "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react-swc';\n\nexport default defineConfig({ plugins: [react()] });\n",
        "client/index.html": f"<!doctype html>\n<html lang=\"en\"><head><meta charset=\"UTF-8\" /><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" /><title>{html.escape(resolved_title)}</title></head><body><div id=\"root\"></div><script type=\"module\" src=\"/src/main.tsx\"></script></body></html>\n",
        "client/src/main.tsx": "import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nimport './index.css';\n\nReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);\n",
        "client/src/App.tsx": _app_source(resolved_title, prompt, kind),
        "client/src/index.css": "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n:root { color-scheme: dark; font-family: Inter, 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif; }\nbody { margin: 0; min-height: 100vh; background: #07090f; }\n",
        "client/tailwind.config.ts": "/** @type {import('tailwindcss').Config} */\nexport default { content: ['./index.html', './src/**/*.{ts,tsx}'], theme: { extend: {} }, plugins: [] };\n",
        "client/postcss.config.cjs": "module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };\n",
        "client/components.json": json.dumps(
            {
                "$schema": "https://ui.shadcn.com/schema.json",
                "style": "default",
                "tsx": True,
                "tailwind": {"config": "tailwind.config.ts", "css": "src/index.css"},
                "aliases": {"components": "@/components", "utils": "@/lib/utils"},
            },
            indent=2,
        )
        + "\n",
        "client/src/lib/utils.ts": "export function cn(...classes: Array<string | false | null | undefined>) { return classes.filter(Boolean).join(' '); }\n",
        "client/src/components/ui/button.tsx": "import type { ButtonHTMLAttributes } from 'react';\nimport { cn } from '@/lib/utils';\n\nexport function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button className={cn('inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90', className)} {...props} />; }\n",
        "docs/README.md": f"# {resolved_title}\n\nPrompt:\n\n{prompt.strip()}\n",
        "output/build-summary.md": f"{resolved_title} is ready as a {kind} workspace using {stack.frontend} and {stack.ui}.",
        PREVIEW_ENTRY: _preview_html(resolved_title, prompt, kind, stack),
    }

    if stack.backend:
        files["server/app.py"] = _server_source(resolved_title)
        files["server/README.md"] = "# Server surface\n\nThis workspace includes an optional backend surface.\n"
    if stack.database:
        files["database/schema.sql"] = _schema_source(resolved_title)
        files["database/README.md"] = "# Database surface\n\nStarter schema for the workspace.\n"

    _write_files(workspace_dir, files)
    workspace_files = _scan_files(workspace_dir)
    workspace = GeneratedWorkspace(
        workspace_id=workspace_id,
        title=resolved_title,
        kind=kind,  # type: ignore[arg-type]
        stack=stack,
        preview_entry=PREVIEW_ENTRY,
        preview_url="",
        files=workspace_files,
        database_files=[file_meta for file_meta in workspace_files if file_meta.group == "database"],
        artifacts=_artifacts(workspace_files),
        status="ready",
        summary=f"{resolved_title} is ready as a structured builder workspace.",
    )
    _manifest_path(workspace_id).write_text(json.dumps(workspace.model_dump(), indent=2), encoding="utf-8")
    return workspace


def load_workspace(workspace_id: str) -> GeneratedWorkspace | None:
    manifest = _manifest_path(workspace_id)
    if not manifest.exists():
        return None
    return GeneratedWorkspace.model_validate_json(manifest.read_text(encoding="utf-8"))


def attach_preview_url(workspace: GeneratedWorkspace, base_url: str) -> GeneratedWorkspace:
    return workspace.model_copy(update={"preview_url": f"{base_url.rstrip('/')}/workspace/builder/{workspace.workspace_id}/preview"})


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
