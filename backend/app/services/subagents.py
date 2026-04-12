from __future__ import annotations

from app.models.schemas import ExecutionIntent, ExecutionIntentKind, StepStatus, SubagentRole, SubagentTask

_ROLE_FAMILIES: dict[SubagentRole, list[str]] = {
    SubagentRole.PLANNER: ["filesystem", "terminal", "desktop", "browser", "web_search", "builder", "code", "git", "system"],
    SubagentRole.FILES: ["filesystem", "system"],
    SubagentRole.TERMINAL: ["terminal", "system"],
    SubagentRole.DESKTOP: ["desktop", "system"],
    SubagentRole.BROWSER: ["browser", "web_search"],
    SubagentRole.CODE_ANALYZER: ["code", "filesystem", "git"],
    SubagentRole.CODE_EDITOR: ["code", "filesystem", "git"],
    SubagentRole.TEST_RUNNER: ["terminal", "code", "filesystem"],
    SubagentRole.REVIEWER: ["code", "filesystem", "git"],
    SubagentRole.DOCUMENTATION: ["code", "filesystem"],
}


def build_subagent_tasks(intent: ExecutionIntent) -> list[SubagentTask]:
    tasks: list[SubagentTask] = [
        SubagentTask(
            id="planner",
            role=SubagentRole.PLANNER,
            title="Analyze request",
            description="Interpret the request, select the right capabilities, and prepare the execution strategy.",
            status=StepStatus.PENDING,
            allowed_families=_ROLE_FAMILIES[SubagentRole.PLANNER],
        )
    ]

    if intent.kind == ExecutionIntentKind.FILESYSTEM:
        tasks.extend(
            [
                SubagentTask(
                    id="files",
                    role=SubagentRole.FILES,
                    title="Operate on local files",
                    description="Use filesystem tools to inspect, create, or modify local files safely.",
                    depends_on=["planner"],
                    allowed_families=_ROLE_FAMILIES[SubagentRole.FILES],
                ),
                SubagentTask(
                    id="review",
                    role=SubagentRole.REVIEWER,
                    title="Validate file results",
                    description="Confirm the resulting file paths and outcomes before summarizing.",
                    depends_on=["files"],
                    allowed_families=_ROLE_FAMILIES[SubagentRole.REVIEWER],
                ),
            ]
        )
    elif intent.kind == ExecutionIntentKind.TERMINAL:
        tasks.extend(
            [
                SubagentTask(
                    id="terminal",
                    role=SubagentRole.TERMINAL,
                    title="Execute terminal workflow",
                    description="Run and monitor commands with structured status reporting.",
                    depends_on=["planner"],
                    allowed_families=_ROLE_FAMILIES[SubagentRole.TERMINAL],
                ),
                SubagentTask(
                    id="review",
                    role=SubagentRole.REVIEWER,
                    title="Validate command output",
                    description="Check exit status and the resulting state before summarizing.",
                    depends_on=["terminal"],
                    allowed_families=_ROLE_FAMILIES[SubagentRole.REVIEWER],
                ),
            ]
        )
    elif intent.kind in {ExecutionIntentKind.BROWSER, ExecutionIntentKind.WEB}:
        tasks.extend(
            [
                SubagentTask(
                    id="browser",
                    role=SubagentRole.BROWSER,
                    title="Run live browser workflow",
                    description="Use browser and web tools to search, navigate, and validate results.",
                    depends_on=["planner"],
                    allowed_families=_ROLE_FAMILIES[SubagentRole.BROWSER],
                ),
                SubagentTask(
                    id="review",
                    role=SubagentRole.REVIEWER,
                    title="Synthesize and cite results",
                    description="Validate extracted context and produce a concise, professional summary.",
                    depends_on=["browser"],
                    allowed_families=_ROLE_FAMILIES[SubagentRole.REVIEWER],
                ),
            ]
        )
    elif intent.kind == ExecutionIntentKind.BUILDER:
        tasks.extend(
            [
                SubagentTask(
                    id="code-analyzer",
                    role=SubagentRole.CODE_ANALYZER,
                    title="Design workspace contract",
                    description="Shape the generated project into a modern builder workspace contract.",
                    depends_on=["planner"],
                    allowed_families=_ROLE_FAMILIES[SubagentRole.CODE_ANALYZER],
                ),
                SubagentTask(
                    id="code-editor",
                    role=SubagentRole.CODE_EDITOR,
                    title="Generate structured workspace",
                    description="Produce preview, code, database, and files surfaces.",
                    depends_on=["code-analyzer"],
                    allowed_families=_ROLE_FAMILIES[SubagentRole.CODE_EDITOR],
                ),
                SubagentTask(
                    id="documentation",
                    role=SubagentRole.DOCUMENTATION,
                    title="Document output surfaces",
                    description="Summarize the generated workspace and how to inspect it.",
                    depends_on=["code-editor"],
                    allowed_families=_ROLE_FAMILIES[SubagentRole.DOCUMENTATION],
                ),
            ]
        )
    elif intent.kind == ExecutionIntentKind.CODE:
        tasks.extend(
            [
                SubagentTask(
                    id="code-analyzer",
                    role=SubagentRole.CODE_ANALYZER,
                    title="Analyze codebase",
                    description="Understand project structure, key files, and task impact.",
                    depends_on=["planner"],
                    allowed_families=_ROLE_FAMILIES[SubagentRole.CODE_ANALYZER],
                ),
                SubagentTask(
                    id="code-editor",
                    role=SubagentRole.CODE_EDITOR,
                    title="Apply code changes",
                    description="Implement the requested changes while preserving project conventions.",
                    depends_on=["code-analyzer"],
                    allowed_families=_ROLE_FAMILIES[SubagentRole.CODE_EDITOR],
                ),
                SubagentTask(
                    id="test-runner",
                    role=SubagentRole.TEST_RUNNER,
                    title="Run validation",
                    description="Execute targeted checks and tests after code changes.",
                    depends_on=["code-editor"],
                    allowed_families=_ROLE_FAMILIES[SubagentRole.TEST_RUNNER],
                ),
                SubagentTask(
                    id="reviewer",
                    role=SubagentRole.REVIEWER,
                    title="Review the result",
                    description="Validate correctness, risks, and remaining follow-up work.",
                    depends_on=["test-runner"],
                    allowed_families=_ROLE_FAMILIES[SubagentRole.REVIEWER],
                ),
            ]
        )
    else:
        tasks.append(
            SubagentTask(
                id="review",
                role=SubagentRole.REVIEWER,
                title="Summarize outcome",
                description="Validate the result and produce a clear final response.",
                depends_on=["planner"],
                allowed_families=_ROLE_FAMILIES[SubagentRole.REVIEWER],
            )
        )

    return tasks
