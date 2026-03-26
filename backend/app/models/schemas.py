from pydantic import BaseModel
from typing import Literal, Optional
from enum import Enum


class StartRequest(BaseModel):
    task: str
    model: str = "claude-sonnet-4-6"
    max_steps: int = 20
    capture_interval_ms: int = 1000


class StopRequest(BaseModel):
    run_id: str


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    model: str
    web_search: bool = False


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
