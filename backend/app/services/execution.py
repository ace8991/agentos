from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.models.schemas import (
    ActionType,
    ExecutionIntent,
    ExecutionIntentKind,
    ExecutionPlan,
    ExecutionPlanRequest,
    ExecutionRunRecord,
    ExecutionStatus,
    ExecutionStep,
    ExecutionSummary,
    StepStatus,
    SubagentRole,
    ToolInvocation,
    ToolProviderKind,
)
from app.services import browser as browser_svc
from app.services.checkpoints import create_file_checkpoint, create_logical_checkpoint
from app.services.subagents import build_subagent_tasks
from app.services.tool_registry import list_capabilities, tool_family_for_action

RUNS_ROOT = Path(__file__).resolve().parents[2] / "data" / "execution_runs"
RUNS_ROOT.mkdir(parents=True, exist_ok=True)

_records: dict[str, ExecutionRunRecord] = {}

_BUILDER_KEYWORDS = (
    "create website",
    "build website",
    "landing page",
    "create app",
    "build app",
    "dashboard",
    "presentation",
    "slides",
    "portfolio",
    "site web",
    "application web",
    "landing",
)
_CODE_KEYWORDS = (
    "refactor",
    "fix bug",
    "debug",
    "test",
    "codebase",
    "repository",
    "repo",
    "pull request",
    "pr",
    "component",
    "typescript",
    "react",
    "python",
)
_FILESYSTEM_KEYWORDS = (
    "fichier",
    "file",
    "document",
    "folder",
    "dossier",
    "directory",
    "desktop",
    "documents",
    "downloads",
    "create file",
    "read file",
    "search file",
    "pdf",
    "csv",
)
_TERMINAL_KEYWORDS = (
    "terminal",
    "shell",
    "powershell",
    "bash",
    "cmd",
    "command",
    "commande",
    "run ",
    "execute ",
    "npm ",
    "pnpm ",
    "pip ",
    "python ",
)
_DESKTOP_KEYWORDS = (
    "screen",
    "ecran",
    "ocr",
    "click",
    "clique",
    "mouse",
    "souris",
    "keyboard",
    "clavier",
    "window",
    "fenetre",
)
_WEB_KEYWORDS = ("search", "recherche", "latest", "news", "source", "citation", "web")
_DESTRUCTIVE_ACTIONS = {
    ActionType.FILE_WRITE.value,
    ActionType.FILE_APPEND.value,
    ActionType.FILE_DELETE.value,
    ActionType.FILE_MOVE.value,
    ActionType.FILE_COPY.value,
    ActionType.DIR_DELETE.value,
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _run_path(run_id: str) -> Path:
    return RUNS_ROOT / f"{run_id}.json"


def _persist(record: ExecutionRunRecord) -> None:
    _records[record.run_id] = record
    _run_path(record.run_id).write_text(record.model_dump_json(indent=2), encoding="utf-8")


def get_run_record(run_id: str) -> ExecutionRunRecord | None:
    if run_id in _records:
        return _records[run_id]
    run_path = _run_path(run_id)
    if not run_path.exists():
        return None
    record = ExecutionRunRecord.model_validate_json(run_path.read_text(encoding="utf-8"))
    _records[run_id] = record
    return record


def _provider_for_family(family: str) -> tuple[str, ToolProviderKind]:
    capability = next((item for item in list_capabilities() if item.family == family), None)
    if capability:
        return capability.provider_id, capability.provider_kind
    return "internal", ToolProviderKind.INTERNAL


def _subagent_role_for_family(family: str) -> SubagentRole:
    mapping = {
        "filesystem": SubagentRole.FILES,
        "terminal": SubagentRole.TERMINAL,
        "desktop": SubagentRole.DESKTOP,
        "browser": SubagentRole.BROWSER,
        "web_search": SubagentRole.BROWSER,
        "builder": SubagentRole.CODE_EDITOR,
        "code": SubagentRole.CODE_ANALYZER,
        "git": SubagentRole.REVIEWER,
        "system": SubagentRole.FILES,
    }
    return mapping.get(family, SubagentRole.PLANNER)


def analyze_intent(task: str) -> ExecutionIntent:
    normalized = browser_svc.extract_primary_task(task)
    lowered = normalized.lower()
    browser_plan = browser_svc.infer_browser_bootstrap(normalized)

    if any(keyword in lowered for keyword in _BUILDER_KEYWORDS):
        return ExecutionIntent(
            kind=ExecutionIntentKind.BUILDER,
            summary="Generate a structured builder workspace with preview, code, database, and files surfaces.",
            requires_builder=True,
            requires_code=True,
            preferred_capabilities=["builder", "code"],
        )

    if any(keyword in lowered for keyword in _CODE_KEYWORDS):
        return ExecutionIntent(
            kind=ExecutionIntentKind.CODE,
            summary="Analyze and modify code with checkpoints, validation, and review.",
            requires_code=True,
            requires_filesystem=True,
            requires_terminal=True,
            preferred_capabilities=["code", "filesystem", "terminal", "git"],
        )

    if browser_plan:
        return ExecutionIntent(
            kind=ExecutionIntentKind.BROWSER,
            summary="Use the in-app live browser workflow to navigate and validate a real web task.",
            requires_live_browser=True,
            requires_web_search=True,
            preferred_capabilities=["browser", "web_search"],
        )

    has_filesystem = any(keyword in lowered for keyword in _FILESYSTEM_KEYWORDS)
    has_terminal = any(keyword in lowered for keyword in _TERMINAL_KEYWORDS)
    has_desktop = any(keyword in lowered for keyword in _DESKTOP_KEYWORDS)
    has_web = any(keyword in lowered for keyword in _WEB_KEYWORDS)

    if has_filesystem and has_terminal:
        return ExecutionIntent(
            kind=ExecutionIntentKind.HYBRID,
            summary="Use local filesystem and terminal tools together as one execution workflow.",
            requires_filesystem=True,
            requires_terminal=True,
            preferred_capabilities=["filesystem", "terminal", "system"],
        )
    if has_filesystem:
        return ExecutionIntent(
            kind=ExecutionIntentKind.FILESYSTEM,
            summary="Use local filesystem tools to inspect or change files on the machine.",
            requires_filesystem=True,
            preferred_capabilities=["filesystem", "system"],
        )
    if has_terminal:
        return ExecutionIntent(
            kind=ExecutionIntentKind.TERMINAL,
            summary="Use terminal tools and process control for the task.",
            requires_terminal=True,
            preferred_capabilities=["terminal", "system"],
        )
    if has_desktop:
        return ExecutionIntent(
            kind=ExecutionIntentKind.DESKTOP,
            summary="Use desktop automation with observation, action, and verification loops.",
            requires_desktop=True,
            preferred_capabilities=["desktop", "system"],
        )
    if has_web:
        return ExecutionIntent(
            kind=ExecutionIntentKind.WEB,
            summary="Research the topic with search, fetch, extraction, and synthesis.",
            requires_web_search=True,
            preferred_capabilities=["web_search", "browser"],
        )

    return ExecutionIntent(
        kind=ExecutionIntentKind.CHAT,
        summary="Respond conversationally and use tools only if the workflow requires them.",
        preferred_capabilities=["web_search"],
    )


def create_execution_plan(request: ExecutionPlanRequest) -> ExecutionPlan:
    intent = analyze_intent(request.task)
    subagents = build_subagent_tasks(intent)
    created_at = _now_iso()
    steps = [
        ExecutionStep(
            id=f"plan-{uuid.uuid4().hex[:8]}-1",
            step_number=1,
            title="Analyze request",
            description="Break down the request, identify risks, and select the required capabilities.",
            status=StepStatus.PENDING,
            subagent_role=SubagentRole.PLANNER,
        ),
        ExecutionStep(
            id=f"plan-{uuid.uuid4().hex[:8]}-2",
            step_number=2,
            title="Prepare tools and context",
            description="Load the right providers, memory, and workspace context before execution.",
            status=StepStatus.PENDING,
            subagent_role=SubagentRole.PLANNER,
        ),
        ExecutionStep(
            id=f"plan-{uuid.uuid4().hex[:8]}-3",
            step_number=3,
            title="Execute primary workflow",
            description=intent.summary,
            status=StepStatus.PENDING,
            subagent_role=_subagent_role_for_family(intent.preferred_capabilities[0] if intent.preferred_capabilities else "general"),
        ),
        ExecutionStep(
            id=f"plan-{uuid.uuid4().hex[:8]}-4",
            step_number=4,
            title="Validate and summarize",
            description="Verify the result and produce a professional final summary.",
            status=StepStatus.PENDING,
            subagent_role=SubagentRole.REVIEWER,
        ),
    ]

    if intent.kind == ExecutionIntentKind.BUILDER:
        steps.insert(
            3,
            ExecutionStep(
                id=f"plan-{uuid.uuid4().hex[:8]}-5",
                step_number=4,
                title="Persist workspace surfaces",
                description="Write the generated workspace files and expose preview, code, database, and files surfaces.",
                status=StepStatus.PENDING,
                subagent_role=SubagentRole.CODE_EDITOR,
            ),
        )

    return ExecutionPlan(
        id=f"plan-{uuid.uuid4().hex[:10]}",
        task=request.task,
        model=request.model,
        intent=intent,
        summary=intent.summary,
        subagents=subagents,
        steps=steps,
        preferred_providers=intent.preferred_capabilities,
        created_at=created_at,
    )


def create_run_record(
    *,
    run_id: str,
    task: str,
    model: str,
    max_steps: int,
    capture_interval_ms: int,
    reasoning_effort: Optional[str],
) -> ExecutionRunRecord:
    plan = create_execution_plan(
        ExecutionPlanRequest(task=task, model=model, max_steps=max_steps)
    )
    timestamp = _now_iso()
    record = ExecutionRunRecord(
        run_id=run_id,
        task=task,
        model=model,
        status=ExecutionStatus.PLANNING,
        max_steps=max_steps,
        capture_interval_ms=capture_interval_ms,
        reasoning_effort=reasoning_effort,
        active=True,
        current_step=0,
        plan=plan,
        steps=[],
        created_at=timestamp,
        updated_at=timestamp,
    )
    _persist(record)
    return record


def mark_run_started(run_id: str) -> None:
    record = get_run_record(run_id)
    if not record:
        return
    record.status = ExecutionStatus.RUNNING
    record.updated_at = _now_iso()
    _persist(record)


def _checkpoint_for_action(action_type: str, arguments: dict) -> tuple[bool, Optional[object]]:
    if action_type not in _DESTRUCTIVE_ACTIONS:
        return False, None

    target_paths = [arguments.get("path"), arguments.get("destination")]
    files = [str(path) for path in target_paths if path]
    if action_type in {ActionType.DIR_DELETE.value, ActionType.FILE_DELETE.value}:
        checkpoint = create_logical_checkpoint(
            f"Checkpoint before destructive action {action_type}",
            files=files,
        )
        return True, checkpoint
    checkpoint = create_file_checkpoint(
        f"Checkpoint before {action_type}",
        files,
    )
    return True, checkpoint


def begin_tool_step(
    run_id: str,
    *,
    step_number: int,
    action_type: str,
    title: str,
    description: str,
    arguments: dict,
) -> None:
    record = get_run_record(run_id)
    if not record:
        return
    family = tool_family_for_action(action_type)
    provider_id, provider_kind = _provider_for_family(family)
    _has_checkpoint, checkpoint = _checkpoint_for_action(action_type, arguments)
    step = ExecutionStep(
        id=f"{run_id}-step-{step_number}",
        step_number=step_number,
        title=title,
        description=description,
        status=StepStatus.RUNNING,
        subagent_role=_subagent_role_for_family(family),
        tool_invocation=ToolInvocation(
            family=family,
            provider_id=provider_id,
            provider_kind=provider_kind,
            tool_name=action_type,
            arguments=arguments,
            status=StepStatus.RUNNING,
            started_at=_now_iso(),
        ),
        checkpoint=checkpoint,
        started_at=_now_iso(),
    )
    record.current_step = max(record.current_step, step_number)
    record.updated_at = _now_iso()
    existing_index = next((index for index, item in enumerate(record.steps) if item.step_number == step_number), None)
    if existing_index is None:
        record.steps.append(step)
    else:
        record.steps[existing_index] = step
    _persist(record)


def complete_tool_step(
    run_id: str,
    *,
    step_number: int,
    result_summary: str,
    success: bool,
    workspace_id: str | None = None,
) -> None:
    record = get_run_record(run_id)
    if not record:
        return
    step = next((item for item in record.steps if item.step_number == step_number), None)
    if not step:
        return
    step.status = StepStatus.COMPLETED if success else StepStatus.FAILED
    step.result_summary = result_summary
    step.error = None if success else result_summary
    step.completed_at = _now_iso()
    if step.tool_invocation:
        step.tool_invocation.status = step.status
        step.tool_invocation.completed_at = step.completed_at
    if workspace_id:
        record.workspace_id = workspace_id
    record.updated_at = _now_iso()
    _persist(record)


def record_info_step(run_id: str, *, step_number: int, title: str, description: str) -> None:
    record = get_run_record(run_id)
    if not record:
        return
    step = ExecutionStep(
        id=f"{run_id}-info-{step_number}",
        step_number=step_number,
        title=title,
        description=description,
        status=StepStatus.COMPLETED,
        subagent_role=SubagentRole.PLANNER,
        result_summary=description,
        started_at=_now_iso(),
        completed_at=_now_iso(),
    )
    existing_index = next((index for index, item in enumerate(record.steps) if item.step_number == step_number), None)
    if existing_index is None:
        record.steps.append(step)
    else:
        record.steps[existing_index] = step
    record.current_step = max(record.current_step, step_number)
    record.updated_at = _now_iso()
    _persist(record)


def finish_run(run_id: str, *, status: ExecutionStatus, outcome: str, validated: bool = False, next_step: str | None = None) -> None:
    record = get_run_record(run_id)
    if not record:
        return
    record.status = status
    record.active = status == ExecutionStatus.RUNNING
    record.summary = ExecutionSummary(outcome=outcome, validated=validated, next_step=next_step)
    record.updated_at = _now_iso()
    _persist(record)


def list_run_steps(run_id: str) -> list[ExecutionStep]:
    record = get_run_record(run_id)
    return record.steps if record else []
