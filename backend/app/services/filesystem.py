"""
Filesystem and system control service.
Gives the agent full read/write access to the local filesystem,
process management, clipboard, and application launching.
"""
import os
import platform
import shutil
import subprocess
from pathlib import Path
from typing import Iterable, Optional

import psutil
import pyperclip


MAX_READ_BYTES = 100_000  # 100KB default max read
MAX_SEARCH_RESULTS = 8
SKIP_DIRS = {
    ".git",
    "node_modules",
    ".venv",
    "__pycache__",
    "dist",
    "build",
}


# ── Filesystem ────────────────────────────────────────────────────────────────

def file_read(path: str, max_bytes: Optional[int] = None) -> dict:
    """Read a file and return its content."""
    try:
        p = Path(path).expanduser().resolve()
        if not p.exists():
            return {"success": False, "description": f"File not found: {path}"}
        if not p.is_file():
            return {"success": False, "description": f"Not a file: {path}"}

        size = p.stat().st_size
        limit = min(max_bytes or MAX_READ_BYTES, MAX_READ_BYTES)

        # Binary files — return metadata only
        try:
            content = p.read_text(encoding="utf-8", errors="replace")
            truncated = len(content.encode()) > limit
            if truncated:
                content = content.encode()[:limit].decode("utf-8", errors="replace")
            return {
                "success": True,
                "path": str(p),
                "content": content,
                "size_bytes": size,
                "truncated": truncated,
                "encoding": "utf-8",
                "description": f"Read {min(size, limit)} bytes from {p.name}" + (" (truncated)" if truncated else ""),
            }
        except Exception:
            return {
                "success": False,
                "description": f"Cannot read as text. File size: {size} bytes. Path: {str(p)}",
            }
    except Exception as e:
        return {"success": False, "description": str(e)}


def file_write(path: str, content: str, encoding: str = "utf-8") -> dict:
    """Create or overwrite a file with content."""
    try:
        p = Path(path).expanduser().resolve()
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding=encoding)
        return {
            "success": True,
            "path": str(p),
            "bytes_written": len(content.encode(encoding)),
            "description": f"Wrote {len(content.encode(encoding))} bytes to {p.name}",
        }
    except Exception as e:
        return {"success": False, "description": str(e)}


def file_append(path: str, content: str, encoding: str = "utf-8") -> dict:
    """Append content to a file (creates it if it doesn't exist)."""
    try:
        p = Path(path).expanduser().resolve()
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "a", encoding=encoding) as f:
            f.write(content)
        return {
            "success": True,
            "path": str(p),
            "description": f"Appended {len(content)} chars to {p.name}",
        }
    except Exception as e:
        return {"success": False, "description": str(e)}


def file_delete(path: str) -> dict:
    """Delete a file."""
    try:
        p = Path(path).expanduser().resolve()
        if not p.exists():
            return {"success": False, "description": f"File not found: {path}"}
        p.unlink()
        return {"success": True, "description": f"Deleted {p.name}"}
    except Exception as e:
        return {"success": False, "description": str(e)}


def file_move(source: str, destination: str) -> dict:
    """Move or rename a file."""
    try:
        src = Path(source).expanduser().resolve()
        dst = Path(destination).expanduser().resolve()
        if not src.exists():
            return {"success": False, "description": f"Source not found: {source}"}
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dst))
        return {"success": True, "description": f"Moved {src.name} → {dst}"}
    except Exception as e:
        return {"success": False, "description": str(e)}


def file_copy(source: str, destination: str) -> dict:
    """Copy a file to a new location."""
    try:
        src = Path(source).expanduser().resolve()
        dst = Path(destination).expanduser().resolve()
        if not src.exists():
            return {"success": False, "description": f"Source not found: {source}"}
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(str(src), str(dst))
        return {"success": True, "description": f"Copied {src.name} → {dst}"}
    except Exception as e:
        return {"success": False, "description": str(e)}


def file_exists(path: str) -> dict:
    """Check if a file or directory exists."""
    try:
        p = Path(path).expanduser().resolve()
        exists = p.exists()
        kind = "file" if p.is_file() else "directory" if p.is_dir() else "unknown"
        return {
            "success": True,
            "exists": exists,
            "kind": kind if exists else None,
            "path": str(p),
            "description": f"{'Exists' if exists else 'Does not exist'}: {path}",
        }
    except Exception as e:
        return {"success": False, "description": str(e)}


def dir_list(path: str) -> dict:
    """List directory contents with file metadata."""
    try:
        p = Path(path).expanduser().resolve()
        if not p.exists():
            return {"success": False, "description": f"Directory not found: {path}"}
        if not p.is_dir():
            return {"success": False, "description": f"Not a directory: {path}"}

        items = []
        for entry in sorted(p.iterdir(), key=lambda e: (e.is_file(), e.name.lower())):
            try:
                stat = entry.stat()
                items.append({
                    "name": entry.name,
                    "type": "file" if entry.is_file() else "directory",
                    "size_bytes": stat.st_size if entry.is_file() else None,
                    "modified": stat.st_mtime,
                    "extension": entry.suffix.lower() if entry.is_file() else None,
                })
            except PermissionError:
                items.append({"name": entry.name, "type": "unknown", "error": "permission denied"})

        return {
            "success": True,
            "path": str(p),
            "items": items[:200],  # max 200 entries
            "total": len(items),
            "description": f"Listed {len(items)} items in {p.name}",
        }
    except Exception as e:
        return {"success": False, "description": str(e)}


def dir_create(path: str) -> dict:
    """Create a directory (including all parent directories)."""
    try:
        p = Path(path).expanduser().resolve()
        p.mkdir(parents=True, exist_ok=True)
        return {"success": True, "path": str(p), "description": f"Created directory: {p}"}
    except Exception as e:
        return {"success": False, "description": str(e)}


def dir_delete(path: str, recursive: bool = False) -> dict:
    """Delete a directory."""
    try:
        p = Path(path).expanduser().resolve()
        if not p.exists():
            return {"success": False, "description": f"Directory not found: {path}"}
        if recursive:
            shutil.rmtree(str(p))
        else:
            p.rmdir()  # Only works if empty
        return {"success": True, "description": f"Deleted directory: {p.name}"}
    except Exception as e:
        return {"success": False, "description": str(e)}


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
    """Find likely matching local files by name or text snippet."""
    try:
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

                if not name_match and candidate.stat().st_size <= 512_000:
                    try:
                        content = candidate.read_text(encoding="utf-8", errors="ignore")
                    except Exception:
                        content = ""
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
    except Exception as e:
        return {"success": False, "description": str(e)}


def read_file(path: str, max_bytes: Optional[int] = None) -> dict:
    """Backward-compatible wrapper used by existing flows."""
    return file_read(path, max_bytes)


# ── System ────────────────────────────────────────────────────────────────────

def app_open(app_path: str, args: Optional[list] = None) -> dict:
    """Launch an application or open a file with its default program."""
    try:
        system = platform.system()
        if args:
            cmd = [app_path] + args
            subprocess.Popen(cmd)
        elif system == "Windows":
            os.startfile(app_path)
        elif system == "Darwin":
            subprocess.Popen(["open", app_path])
        else:
            subprocess.Popen(["xdg-open", app_path])
        return {"success": True, "description": f"Launched: {app_path}"}
    except Exception as e:
        return {"success": False, "description": str(e)}


def process_list() -> dict:
    """List running processes."""
    try:
        procs = []
        for p in psutil.process_iter(["pid", "name", "status", "cpu_percent", "memory_percent"]):
            try:
                procs.append({
                    "pid": p.info["pid"],
                    "name": p.info["name"],
                    "status": p.info["status"],
                    "cpu": round(p.info["cpu_percent"] or 0, 1),
                    "mem": round(p.info["memory_percent"] or 0, 1),
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        procs.sort(key=lambda x: x["mem"], reverse=True)
        return {
            "success": True,
            "processes": procs[:50],
            "total": len(procs),
            "description": f"{len(procs)} processes running",
        }
    except Exception as e:
        return {"success": False, "description": str(e)}


def process_kill(pid: int) -> dict:
    """Kill a process by PID."""
    try:
        p = psutil.Process(pid)
        name = p.name()
        p.terminate()
        return {"success": True, "description": f"Terminated process {pid} ({name})"}
    except psutil.NoSuchProcess:
        return {"success": False, "description": f"Process {pid} not found"}
    except Exception as e:
        return {"success": False, "description": str(e)}


def system_info() -> dict:
    """Get system information."""
    try:
        disk = psutil.disk_usage("/")
        mem = psutil.virtual_memory()
        return {
            "success": True,
            "os": platform.system(),
            "os_version": platform.version(),
            "hostname": platform.node(),
            "cpu_count": psutil.cpu_count(),
            "cpu_percent": psutil.cpu_percent(interval=0.5),
            "memory_total_gb": round(mem.total / 1e9, 2),
            "memory_used_gb": round(mem.used / 1e9, 2),
            "memory_percent": mem.percent,
            "disk_total_gb": round(disk.total / 1e9, 2),
            "disk_free_gb": round(disk.free / 1e9, 2),
            "disk_percent": disk.percent,
            "home_dir": str(Path.home()),
            "description": f"{platform.system()} | RAM {mem.percent}% | Disk {disk.percent}%",
        }
    except Exception as e:
        return {"success": False, "description": str(e)}


def clipboard_get() -> dict:
    """Get clipboard content."""
    try:
        content = pyperclip.paste()
        return {
            "success": True,
            "content": content[:5000],
            "length": len(content),
            "description": f"Clipboard: {content[:80]}{'...' if len(content) > 80 else ''}",
        }
    except Exception as e:
        return {"success": False, "description": str(e)}


def clipboard_set(text: str) -> dict:
    """Set clipboard content."""
    try:
        pyperclip.copy(text)
        return {"success": True, "description": f"Copied {len(text)} chars to clipboard"}
    except Exception as e:
        return {"success": False, "description": str(e)}


def terminal_open(command: Optional[str] = None) -> dict:
    """Open a new terminal window, optionally running a command."""
    try:
        system = platform.system()
        if system == "Windows":
            if command:
                subprocess.Popen(["cmd.exe", "/k", command], creationflags=subprocess.CREATE_NEW_CONSOLE)
            else:
                subprocess.Popen(["cmd.exe"], creationflags=subprocess.CREATE_NEW_CONSOLE)
        elif system == "Darwin":
            script = f'tell application "Terminal" to do script "{command or ""}"'
            subprocess.Popen(["osascript", "-e", script])
        else:
            for term in ["gnome-terminal", "xterm", "konsole"]:
                try:
                    if command:
                        subprocess.Popen([term, "--", "bash", "-c", f"{command}; exec bash"])
                    else:
                        subprocess.Popen([term])
                    break
                except FileNotFoundError:
                    continue
        return {"success": True, "description": f"Opened terminal" + (f" with: {command}" if command else "")}
    except Exception as e:
        return {"success": False, "description": str(e)}
