from pydantic import BaseModel
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
