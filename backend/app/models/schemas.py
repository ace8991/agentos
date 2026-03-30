from pydantic import BaseModel, Field
from typing import Any, Literal, Optional
from enum import Enum

ReasoningEffort = Literal["none", "minimal", "low", "medium", "high", "xhigh"]


class StartRequest(BaseModel):
    task: str
    model: str = "claude-sonnet-4-6"
    max_steps: int = 20
    capture_interval_ms: int = 1000
    reasoning_effort: Optional[ReasoningEffort] = None


class StopRequest(BaseModel):
    run_id: str


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    model: str
    web_search: bool = False
    reasoning_effort: Optional[ReasoningEffort] = None


class ModelInfo(BaseModel):
    id: str
    name: str
    provider: str
    cost_per_step: str
    vision: bool


class ModelsResponse(BaseModel):
    models: list[ModelInfo]


class MemoryItem(BaseModel):
    key: str
    value: str


class ActionType(str, Enum):
    # PyAutoGUI
    CLICK            = "click"
    TYPE             = "type"
    SCROLL           = "scroll"
    KEY              = "key"
    WAIT             = "wait"
    SHELL            = "shell"
    # Filesystem
    FILE_SEARCH      = "file_search"
    FILE_READ        = "file_read"
    FILE_WRITE       = "file_write"
    FILE_APPEND      = "file_append"
    FILE_DELETE      = "file_delete"
    FILE_MOVE        = "file_move"
    FILE_COPY        = "file_copy"
    FILE_EXISTS      = "file_exists"
    DIR_LIST         = "dir_list"
    DIR_CREATE       = "dir_create"
    DIR_DELETE       = "dir_delete"
    # Tavily
    WEB_SEARCH       = "web_search"
    WEB_EXTRACT      = "web_extract"
    WEB_QNA          = "web_qna"
    WEB_CRAWL        = "web_crawl"
    # Playwright+Brave
    BROWSER_OPEN     = "browser_open"
    BROWSER_CLICK    = "browser_click"
    BROWSER_TYPE     = "browser_type"
    BROWSER_SELECT   = "browser_select"
    BROWSER_SCROLL   = "browser_scroll"
    BROWSER_WAIT     = "browser_wait"
    BROWSER_SNAPSHOT = "browser_snapshot"
    BROWSER_EVAL     = "browser_eval"
    BROWSER_BACK     = "browser_back"
    BROWSER_CLOSE    = "browser_close"
    # Claude Computer Use
    COMPUTER_USE     = "computer_use"
    # System
    APP_OPEN         = "app_open"
    PROCESS_LIST     = "process_list"
    PROCESS_KILL     = "process_kill"
    SYSTEM_INFO      = "system_info"
    CLIPBOARD_GET    = "clipboard_get"
    CLIPBOARD_SET    = "clipboard_set"
    TERMINAL_OPEN    = "terminal_open"
    # Control
    DONE             = "done"
    ERROR            = "error"


class AgentAction(BaseModel):
    type: ActionType
    # System
    x: Optional[int] = None
    y: Optional[int] = None
    text: Optional[str] = None
    key: Optional[str] = None
    amount: Optional[int] = None
    command: Optional[str] = None
    path: Optional[str] = None
    # Tavily
    query: Optional[str] = None
    url: Optional[str] = None
    instructions: Optional[str] = None
    max_results: Optional[int] = None
    # Playwright
    selector: Optional[str] = None
    value: Optional[str] = None
    script: Optional[str] = None
    timeout: Optional[int] = None
    # Computer Use
    subtask: Optional[str] = None        # what CU should accomplish
    cu_max_iterations: Optional[int] = None  # default 5
    # Universal
    reason: Optional[str] = None
    destination: Optional[str] = None
    content: Optional[str] = None
    encoding: Optional[str] = "utf-8"
    max_bytes: Optional[int] = None
    app_path: Optional[str] = None
    app_args: Optional[list[str]] = None
    pid: Optional[int] = None
    recursive: Optional[bool] = False


class StepEvent(BaseModel):
    type: Literal["step", "done", "error"]
    step: int
    action: str
    reasoning: str
    screenshot_b64: str
    memory: list[MemoryItem]
    tool_result: Optional[dict] = None
    parsed_action: Optional[AgentAction] = None


class RemoteChannel(str, Enum):
    TELEGRAM = "telegram"
    WHATSAPP = "whatsapp"
    WEBHOOK = "webhook"


class RemoteCommandStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    CLAIMED = "claimed"
    REJECTED = "rejected"
    COMPLETED = "completed"


class RemoteInboundRequest(BaseModel):
    channel: RemoteChannel
    text: str
    secret: str
    sender: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class RemoteDecisionRequest(BaseModel):
    actor: str = "local-user"
    note: Optional[str] = None


class RemoteCompleteRequest(BaseModel):
    actor: str = "local-workspace"
    success: bool
    note: Optional[str] = None


class RemoteCommand(BaseModel):
    id: str
    channel: RemoteChannel
    text: str
    sender: Optional[str] = None
    status: RemoteCommandStatus
    created_at: str
    updated_at: str
    actor: Optional[str] = None
    note: Optional[str] = None
    metadata: dict[str, Any] = {}


class RemoteConfigResponse(BaseModel):
    enabled: bool
    local_execution_available: bool
    approval_required: bool
    configured_channels: dict[str, bool]
    inbound_path: str


ConnectorIntegrationMode = Literal["native", "relay", "local", "manual"]
ConnectorValidationStatus = Literal[
    "not_configured",
    "saved",
    "verified",
    "ready_relay",
    "ready_local",
    "error",
]


class ConnectorValidateRequest(BaseModel):
    connector_id: str
    values: dict[str, str] = {}


class ConnectorValidateResponse(BaseModel):
    connector_id: str
    integration_mode: ConnectorIntegrationMode
    status: ConnectorValidationStatus
    ready: bool
    message: str
    checked_at: str


class RuntimeConfigRequest(BaseModel):
    values: dict[str, str] = {}


class RuntimeConfigResponse(BaseModel):
    applied: dict[str, bool]


WorkspaceFileGroup = Literal["client", "server", "database", "docs", "assets", "output"]
GeneratedWorkspaceKind = Literal["website", "landing", "app", "dashboard", "slides", "presentation"]
GeneratedWorkspaceStatus = Literal["building", "ready", "error"]


class GeneratedWorkspaceStack(BaseModel):
    frontend: str
    ui: str
    backend: Optional[str] = None
    database: Optional[str] = None


class GeneratedWorkspaceFile(BaseModel):
    path: str
    name: str
    group: WorkspaceFileGroup
    language: Optional[str] = None
    size_bytes: int


class GeneratedWorkspaceArtifact(BaseModel):
    id: str
    type: str
    title: str
    path: str
    group: WorkspaceFileGroup


class GeneratedWorkspace(BaseModel):
    workspace_id: str
    title: str
    kind: GeneratedWorkspaceKind
    stack: GeneratedWorkspaceStack
    preview_entry: str
    preview_url: str
    files: list[GeneratedWorkspaceFile] = Field(default_factory=list)
    database_files: list[GeneratedWorkspaceFile] = Field(default_factory=list)
    artifacts: list[GeneratedWorkspaceArtifact] = Field(default_factory=list)
    status: GeneratedWorkspaceStatus = "ready"
    summary: str = ""


class BuilderCreateRequest(BaseModel):
    prompt: str
    title: Optional[str] = None


class WorkspaceFilesResponse(BaseModel):
    files: list[GeneratedWorkspaceFile] = Field(default_factory=list)


class WorkspaceFileContentResponse(BaseModel):
    path: str
    content: str
    language: Optional[str] = None


OpenClawChannelId = Literal["telegram", "whatsapp", "webhook", "slack", "discord", "email", "sms", "push"]
OpenClawDevicePlatform = Literal["android", "ios", "desktop", "web"]
OpenClawDeviceRole = Literal["operator", "node", "viewer"]
OpenClawDeviceStatus = Literal["online", "offline", "pairing"]
OpenClawGatewayStatus = Literal["ready", "discovering", "pairing", "offline"]


class OpenClawChannel(BaseModel):
    id: OpenClawChannelId
    name: str
    transport: str
    enabled: bool = False
    configured: bool = False
    secret_hint: Optional[str] = None
    description: str
    relay_path: Optional[str] = None


class OpenClawDevice(BaseModel):
    id: str
    name: str
    platform: OpenClawDevicePlatform
    role: OpenClawDeviceRole
    status: OpenClawDeviceStatus = "offline"
    last_seen: Optional[str] = None
    battery_percent: Optional[int] = None
    overlay_enabled: bool = True
    voice_wake_enabled: bool = False
    pair_code: Optional[str] = None


class OpenClawGatewayState(BaseModel):
    enabled: bool = True
    status: OpenClawGatewayStatus = "ready"
    protocol_version: int = 3
    discovery_mode: str = "bonjour+manual"
    host: str = "127.0.0.1"
    port: int = 8000
    tls_enabled: bool = False
    tls_fingerprint: Optional[str] = None
    inbound_path: str = "/remote/commands/inbound"
    pairing_code: Optional[str] = None
    connected_devices: int = 0


class OpenClawOverlayState(BaseModel):
    floating_dock: bool = True
    mobile_hud: bool = True
    voice_overlay: bool = True
    voice_wake: bool = False
    camera_hud: bool = False
    push_to_talk: str = "Ctrl+Shift+Space"


class OpenClawCliCommand(BaseModel):
    label: str
    command: str
    description: str


class OpenClawState(BaseModel):
    gateway: OpenClawGatewayState
    devices: list[OpenClawDevice] = Field(default_factory=list)
    channels: list[OpenClawChannel] = Field(default_factory=list)
    overlays: OpenClawOverlayState
    cli_commands: list[OpenClawCliCommand] = Field(default_factory=list)
    summary: str = ""


class OpenClawPairRequest(BaseModel):
    name: str
    platform: OpenClawDevicePlatform
    role: OpenClawDeviceRole = "operator"


class OpenClawGatewayUpdateRequest(BaseModel):
    enabled: Optional[bool] = None
    discovery_mode: Optional[str] = None
    tls_enabled: Optional[bool] = None
    host: Optional[str] = None
    port: Optional[int] = None


class OpenClawOverlayUpdateRequest(BaseModel):
    floating_dock: Optional[bool] = None
    mobile_hud: Optional[bool] = None
    voice_overlay: Optional[bool] = None
    voice_wake: Optional[bool] = None
    camera_hud: Optional[bool] = None
    push_to_talk: Optional[str] = None


class OpenClawChannelUpdateRequest(BaseModel):
    enabled: Optional[bool] = None
    secret: Optional[str] = None


class OpenClawDeviceUpdateRequest(BaseModel):
    status: Optional[OpenClawDeviceStatus] = None
    overlay_enabled: Optional[bool] = None
    voice_wake_enabled: Optional[bool] = None
    battery_percent: Optional[int] = None
