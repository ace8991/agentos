from __future__ import annotations

import json
import platform
import re
import subprocess
import sys
from pathlib import Path
from typing import Optional

from app.config import IS_LOCAL
from app.services import filesystem as fs


SUPPORTED_TOOLS = [
    "dc_read_file",
    "dc_write_file",
    "dc_list_directory",
    "dc_execute_command",
    "dc_search_files",
    "dc_get_system_info",
]

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_CONFIG_PATH = _BACKEND_ROOT / "data" / "desktop_commander_config.json"
DEFAULT_ALLOWED_DIRECTORIES: list[str] = []
DEFAULT_BLOCKED_COMMANDS: list[str] = [
    "format",
    "mount",
    "umount",
    "mkfs",
    "fdisk",
    "dd",
    "sudo",
    "su",
    "passwd",
    "adduser",
    "useradd",
    "usermod",
    "groupadd",
]
MAX_READ_LINES = 2000
MAX_WRITE_LINES = 2000


def _local_only() -> dict | None:
    if IS_LOCAL:
        return None
    return {
        "success": False,
        "ready": False,
        "description": "Desktop Commander MCP is available only when AgentOS runs in local mode.",
    }


def _default_shell() -> str:
    if platform.system() == "Windows":
        return "powershell"
    return "bash"


def _default_config() -> dict:
    return {
        "allowed_directories": DEFAULT_ALLOWED_DIRECTORIES.copy(),
        "blocked_commands": DEFAULT_BLOCKED_COMMANDS.copy(),
        "max_read_lines": MAX_READ_LINES,
        "max_write_lines": MAX_WRITE_LINES,
    }


def _normalize_allowed_directories(paths: list[str]) -> list[str]:
    normalized: list[str] = []
    for raw in paths:
        cleaned = (raw or "").strip()
        if not cleaned:
            continue
        try:
            resolved = str(Path(cleaned).expanduser().resolve())
        except Exception:
            continue
        if resolved not in normalized:
            normalized.append(resolved)
    return normalized


def _ensure_config_file() -> None:
    _CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    if _CONFIG_PATH.exists():
        return
    _CONFIG_PATH.write_text(json.dumps(_default_config(), indent=2), encoding="utf-8")


def _load_config() -> dict:
    _ensure_config_file()
    config = _default_config()
    try:
        loaded = json.loads(_CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception:
        return config

    if isinstance(loaded.get("allowed_directories"), list):
        config["allowed_directories"] = _normalize_allowed_directories(
            [str(item) for item in loaded["allowed_directories"]]
        )
    if isinstance(loaded.get("blocked_commands"), list):
        config["blocked_commands"] = [
            str(item).strip().lower()
            for item in loaded["blocked_commands"]
            if str(item).strip()
        ]
    if isinstance(loaded.get("max_read_lines"), int):
        config["max_read_lines"] = max(100, min(loaded["max_read_lines"], 10000))
    if isinstance(loaded.get("max_write_lines"), int):
        config["max_write_lines"] = max(100, min(loaded["max_write_lines"], 10000))
    return config


def update_config(
    *,
    allowed_directories: Optional[list[str]] = None,
    blocked_commands: Optional[list[str]] = None,
    max_read_lines: Optional[int] = None,
    max_write_lines: Optional[int] = None,
) -> dict:
    blocked = _local_only()
    if blocked:
        return blocked

    config = _load_config()
    if allowed_directories is not None:
        config["allowed_directories"] = _normalize_allowed_directories(allowed_directories)
    if blocked_commands is not None:
        config["blocked_commands"] = [
            str(item).strip().lower()
            for item in blocked_commands
            if str(item).strip()
        ]
    if max_read_lines is not None:
        config["max_read_lines"] = max(100, min(int(max_read_lines), 10000))
    if max_write_lines is not None:
        config["max_write_lines"] = max(100, min(int(max_write_lines), 10000))

    _CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    _CONFIG_PATH.write_text(json.dumps(config, indent=2), encoding="utf-8")
    return get_config()


def _path_allowed(resolved: Path, allowed_directories: list[str]) -> bool:
    if not allowed_directories:
        return True

    target = str(resolved).lower()
    for allowed in allowed_directories:
        normalized = str(Path(allowed).expanduser().resolve()).lower()
        if target == normalized or target.startswith(normalized + "\\") or target.startswith(normalized + "/"):
            return True
    return False


def _validate_path(path: str) -> tuple[Optional[Path], Optional[dict]]:
    try:
        resolved = Path(path).expanduser().resolve()
    except Exception as exc:
        return None, {"success": False, "description": str(exc)}

    config = _load_config()
    if not _path_allowed(resolved, config["allowed_directories"]):
        return None, {
            "success": False,
            "description": (
                f"Path is outside Desktop Commander allowed directories: {path}. "
                "Update the allowed directories in Settings > Desktop Commander."
            ),
        }
    return resolved, None


def _truncate_lines(text: str, max_lines: int) -> tuple[str, bool]:
    lines = text.splitlines()
    if len(lines) <= max_lines:
        return text, False
    return "\n".join(lines[:max_lines]), True


def _extract_command_heads(command: str) -> set[str]:
    heads: set[str] = set()
    for fragment in re.split(r"[;&|\n]+", command):
        chunk = fragment.strip()
        if not chunk:
            continue
        token = chunk.split()[0].strip().lstrip("./\\").lower()
        token = re.sub(r"\.(exe|cmd|bat|ps1)$", "", token)
        if token:
            heads.add(token)
    return heads


def _command_is_blocked(command: str, blocked_commands: list[str]) -> Optional[str]:
    heads = _extract_command_heads(command)
    for blocked in blocked_commands:
        if blocked in heads:
            return blocked
    return None


def get_status() -> dict:
    config = _load_config()
    return {
        "success": True,
        "ready": IS_LOCAL,
        "mode": "local" if IS_LOCAL else "cloud",
        "tools": SUPPORTED_TOOLS,
        "allowed_directories_configured": len(config["allowed_directories"]),
        "blocked_commands_count": len(config["blocked_commands"]),
        "description": (
            "Desktop Commander MCP is ready on this machine."
            if IS_LOCAL
            else "Desktop Commander MCP requires a local AgentOS runtime."
        ),
    }


def get_config() -> dict:
    config = _load_config()
    return {
        **config,
        "home": str(Path.home()),
        "version": "1.1.0",
        "enabled": IS_LOCAL,
        "ready": IS_LOCAL,
        "default_shell": _default_shell(),
        "path_separator": "\\" if platform.system() == "Windows" else "/",
        "platform": platform.system(),
        "description": (
            "Desktop Commander MCP is configured and ready."
            if IS_LOCAL
            else "Desktop Commander MCP requires a local AgentOS runtime."
        ),
    }


def dc_read_file(path: str, max_bytes: Optional[int] = None) -> dict:
    blocked = _local_only()
    if blocked:
        return blocked
    resolved, error = _validate_path(path)
    if error:
        return error
    result = fs.file_read(str(resolved), max_bytes)
    if result.get("success") and isinstance(result.get("content"), str):
        config = _load_config()
        content, truncated_by_lines = _truncate_lines(result["content"], config["max_read_lines"])
        result["content"] = content
        if truncated_by_lines:
            result["description"] = (
                f"{result.get('description', 'Read file')} (truncated to {config['max_read_lines']} lines)"
            )
            result["truncated"] = True
    return result


def dc_write_file(path: str, content: str, encoding: str = "utf-8", mode: str = "rewrite") -> dict:
    blocked = _local_only()
    if blocked:
        return blocked
    resolved, error = _validate_path(path)
    if error:
        return error

    config = _load_config()
    truncated_content, truncated = _truncate_lines(content or "", config["max_write_lines"])
    if mode == "append":
        result = fs.file_append(str(resolved), truncated_content, encoding)
    else:
        result = fs.file_write(str(resolved), truncated_content, encoding)
    if result.get("success") and truncated:
        result["description"] = f"{result.get('description', 'Wrote file')} (input truncated to {config['max_write_lines']} lines)"
    return result


def dc_list_directory(path: str, depth: int = 1) -> dict:
    blocked = _local_only()
    if blocked:
        return blocked
    resolved, error = _validate_path(path)
    if error:
        return error

    base = Path(resolved)
    if depth <= 1:
        return fs.dir_list(str(base))

    try:
        items: list[dict] = []
        max_entries = 500
        for current in base.rglob("*"):
            try:
                relative_depth = len(current.relative_to(base).parts)
                if relative_depth > depth:
                    continue
                stat = current.stat()
                items.append(
                    {
                        "name": current.name,
                        "relative_path": str(current.relative_to(base)),
                        "type": "file" if current.is_file() else "directory",
                        "size_bytes": stat.st_size if current.is_file() else None,
                        "modified": stat.st_mtime,
                        "extension": current.suffix.lower() if current.is_file() else None,
                    }
                )
                if len(items) >= max_entries:
                    break
            except OSError:
                continue
        return {
            "success": True,
            "path": str(base),
            "items": items,
            "total": len(items),
            "description": f"Listed {len(items)} items in {base.name} up to depth {depth}",
        }
    except Exception as exc:
        return {"success": False, "description": str(exc)}


def dc_create_directory(path: str) -> dict:
    blocked = _local_only()
    if blocked:
        return blocked
    resolved, error = _validate_path(path)
    if error:
        return error
    return fs.dir_create(str(resolved))


def dc_move_file(source: str, destination: str) -> dict:
    blocked = _local_only()
    if blocked:
        return blocked
    src, error = _validate_path(source)
    if error:
        return error
    dst, error = _validate_path(destination)
    if error:
        return error
    return fs.file_move(str(src), str(dst))


def dc_get_file_info(path: str) -> dict:
    blocked = _local_only()
    if blocked:
        return blocked
    resolved, error = _validate_path(path)
    if error:
        return error
    try:
        stat = resolved.stat()
        payload = {
            "success": True,
            "path": str(resolved),
            "type": "directory" if resolved.is_dir() else "file",
            "size": stat.st_size,
            "created": stat.st_ctime,
            "modified": stat.st_mtime,
            "permissions": oct(stat.st_mode)[-3:],
            "description": f"Read file metadata for {resolved.name}",
        }
        if resolved.is_file():
            try:
                payload["line_count"] = len(resolved.read_text(encoding="utf-8", errors="replace").splitlines())
            except Exception:
                pass
        return payload
    except Exception as exc:
        return {"success": False, "description": str(exc)}


def dc_edit_block(file_path: str, old_string: str, new_string: str) -> dict:
    blocked = _local_only()
    if blocked:
        return blocked
    resolved, error = _validate_path(file_path)
    if error:
        return error
    try:
        if not resolved.exists():
            return {"success": False, "description": f"File not found: {file_path}"}
        text = resolved.read_text(encoding="utf-8", errors="replace")
        if old_string not in text:
            return {"success": False, "description": "String not found in file"}
        updated = text.replace(old_string, new_string, 1)
        config = _load_config()
        updated, truncated = _truncate_lines(updated, config["max_write_lines"])
        resolved.write_text(updated, encoding="utf-8")
        description = f"Edited {resolved.name}"
        if truncated:
            description += f" (truncated to {config['max_write_lines']} lines)"
        return {
            "success": True,
            "path": str(resolved),
            "replacements": 1,
            "description": description,
        }
    except Exception as exc:
        return {"success": False, "description": str(exc)}


def dc_search_files(query: str, path: Optional[str] = None, max_results: int = 8) -> dict:
    blocked = _local_only()
    if blocked:
        return blocked

    config = _load_config()
    if path:
        resolved, error = _validate_path(path)
        if error:
            return error
        return fs.search_files(query, str(resolved), max_results)

    if config["allowed_directories"]:
        aggregated: list[dict] = []
        for root in config["allowed_directories"]:
            result = fs.search_files(query, root, max_results=max_results - len(aggregated))
            if result.get("success") and isinstance(result.get("results"), list):
                aggregated.extend(result["results"])
            if len(aggregated) >= max_results:
                break
        return {
            "success": True,
            "results": aggregated[:max_results],
            "description": f"Found {len(aggregated[:max_results])} local file result(s) for '{query}'",
        }

    return fs.search_files(query, path, max_results)


def dc_get_system_info() -> dict:
    blocked = _local_only()
    if blocked:
        return blocked
    base = fs.system_info()
    if not base.get("success"):
        return base
    base.update(
        {
            "platform_name": platform.platform(),
            "default_shell": _default_shell(),
            "path_separator": "\\" if platform.system() == "Windows" else "/",
            "python_executable": sys.executable,
        }
    )
    return base


def dc_execute_command(
    command: str,
    *,
    shell: str = "powershell",
    timeout_ms: int = 30000,
    cwd: Optional[str] = None,
) -> dict:
    blocked = _local_only()
    if blocked:
        return blocked

    config = _load_config()
    blocked_command = _command_is_blocked(command, config["blocked_commands"])
    if blocked_command:
        return {
            "success": False,
            "exit_code": -1,
            "stdout": "",
            "stderr": f"Command '{blocked_command}' is blocked by Desktop Commander policy.",
            "timed_out": False,
            "command": command,
            "description": f"Blocked command: {blocked_command}",
        }

    if cwd:
        working_dir = cwd
    elif config["allowed_directories"]:
        working_dir = config["allowed_directories"][0]
    else:
        working_dir = str(Path.home())
    resolved_cwd, error = _validate_path(working_dir)
    if error:
        return {
            "success": False,
            "exit_code": -1,
            "stdout": "",
            "stderr": error["description"],
            "timed_out": False,
            "command": command,
            "description": error["description"],
        }

    try:
        shell_name = (shell or _default_shell()).lower()
        if "powershell" in shell_name:
            args = ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command]
        elif shell_name == "cmd":
            args = ["cmd.exe", "/c", command]
        else:
            args = [shell_name, "-lc", command]

        flags = 0
        if hasattr(subprocess, "CREATE_NO_WINDOW"):
            flags = subprocess.CREATE_NO_WINDOW

        result = subprocess.run(
            args,
            capture_output=True,
            cwd=str(resolved_cwd),
            timeout=max(1, timeout_ms) / 1000,
            creationflags=flags,
        )
        return {
            "success": result.returncode == 0,
            "exit_code": result.returncode,
            "stdout": result.stdout.decode("utf-8", errors="replace"),
            "stderr": result.stderr.decode("utf-8", errors="replace"),
            "timed_out": False,
            "command": command,
            "description": f"exit {result.returncode}",
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "exit_code": -1,
            "stdout": "",
            "stderr": f"Timed out after {timeout_ms}ms",
            "timed_out": True,
            "command": command,
            "description": f"Timed out after {timeout_ms}ms",
        }
    except Exception as exc:
        return {
            "success": False,
            "exit_code": -1,
            "stdout": "",
            "stderr": str(exc),
            "timed_out": False,
            "command": command,
            "description": str(exc),
        }
