"""Universal agent orchestrator — the engine that runs any LLM with any tool set.

Architecture:
  task → loop { LLM → tools → result } → done

The orchestrator does NOT know which provider it's using.
It calls provider.chat() and gets back AgentResponse in universal format.
It executes tools via the ToolRegistry and feeds results back.
"""

from __future__ import annotations

import json
import logging
import time
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from typing import Any

from src.agent.config import agent_config
from src.agent.core.registry import get_model
from src.agent.core.types import (
    AgentResponse,
    Message,
    StreamingChunk,
    ToolCall,
    ToolResult,
    ToolSchema,
    VisionMode,
)
from src.agent.providers.base import LLMProvider
from src.agent.providers.factory import create_provider
from src.agent.schemas.tool_schemas import get_semantic_tools, get_pixel_tools
from src.agent.tools.base import registry as tool_registry

logger = logging.getLogger("agentos.agent.orchestrator")

# Import tools to register them
import src.agent.tools.screen  # noqa: F401
import src.agent.tools.mouse  # noqa: F401
import src.agent.tools.keyboard  # noqa: F401
import src.agent.tools.ui_tree  # noqa: F401
import src.agent.tools.file_ops  # noqa: F401
import src.agent.tools.shell  # noqa: F401


@dataclass
class OrchestratorConfig:
    """Configuration for a single orchestrator run."""

    model: str
    max_iterations: int = 25
    screenshot_on_every_step: bool = True
    temperature: float = 0.0
    max_tokens: int = 4096
    system_prompt_extra: str = ""


@dataclass
class OrchestratorStep:
    """A single step in the agent loop."""

    iteration: int
    action: str
    reasoning: str = ""
    screenshot_b64: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    tool_results: list[ToolResult] = field(default_factory=list)
    response: str = ""


class AgentOrchestrator:
    """Universal agent loop — works with any LLM provider."""

    def __init__(self, config: OrchestratorConfig) -> None:
        self.config = config
        self.provider: LLMProvider = create_provider(config.model)
        self.model_info = get_model(config.model)

        # Determine vision mode
        if self.model_info and self.model_info.supports_computer_use:
            self.vision_mode: VisionMode = "pixel_computer_use"
        elif self.model_info and self.model_info.supports_vision:
            self.vision_mode: VisionMode = "semantic_ui_tree"
        else:
            self.vision_mode: VisionMode = "none"

        # Select tools based on capabilities
        if self.vision_mode == "pixel_computer_use":
            self.tools: list[ToolSchema] = get_pixel_tools()
        else:
            self.tools: list[ToolSchema] = get_semantic_tools()

        logger.info(
            "Orchestrator initialized: model=%s, provider=%s, vision=%s, tools=%d",
            config.model,
            self.provider.provider_name,
            self.vision_mode,
            len(self.tools),
        )

    def _build_system_prompt(self, task: str) -> str:
        """Build the system prompt based on vision mode."""
        parts = [
            "You are an AI assistant that can control the Windows PC to accomplish tasks.",
            "",
            f"TASK: {task}",
            "",
        ]

        if self.vision_mode == "semantic_ui_tree":
            parts.extend([
                "=== IMPORTANT: UI TREE MODE ===",
                "You do NOT have pixel-precise vision. Instead, use the following workflow:",
                "",
                "1. Call read_ui_tree() to get the current UI elements on screen.",
                "2. The UI tree returns a JSON with element IDs, names, types, and bounding boxes.",
                "3. Use click_element(id) or type_in_field(id, text) to interact with elements.",
                "4. Never guess pixel coordinates — always use the UI tree element IDs.",
                "5. Call read_ui_tree() again after each action to see changes.",
                "",
                "This is similar to how browser accessibility trees work.",
            ])
        elif self.vision_mode == "pixel_computer_use":
            parts.extend([
                "=== COMPUTER USE MODE ===",
                "You have access to native computer_20250124 tool for pixel-precise control.",
                "Use screenshot to see the screen, then use mouse/keyboard actions.",
            ])
        else:
            parts.extend([
                "=== TEXT-ONLY MODE ===",
                "You cannot see the screen. Use bash_tool and str_replace_editor to accomplish tasks.",
            ])

        # Guardrails
        confirm_actions = agent_config.require_confirmation_for
        if confirm_actions:
            parts.extend([
                "",
                "=== SAFETY RULES ===",
                f"Actions requiring user confirmation: {', '.join(confirm_actions)}.",
                "If a task involves these, ask the user for permission first.",
            ])

        if self.config.system_prompt_extra:
            parts.extend(["", self.config.system_prompt_extra])

        return "\n".join(parts)

    def _convert_to_messages(
        self,
        task: str,
        history: list[OrchestratorStep],
        screenshot_b64: str | None = None,
    ) -> list[Message]:
        """Convert step history + current context to LLM messages."""
        messages: list[Message] = []

        # System prompt
        system = self._build_system_prompt(task)
        messages.append(Message(role="system", content=system))

        # History
        for step in history:
            # Assistant response
            if step.response or step.tool_calls:
                content = step.response or ""
                msg = Message(role="assistant", content=content)
                # Add tool calls if any
                if step.tool_calls:
                    for tc in step.tool_calls:
                        msg.name = tc.name
                        msg.tool_call_id = tc.id
                        msg.content = json.dumps(tc.args)
                messages.append(msg)

            # Tool results
            for tr in step.tool_results:
                messages.append(
                    Message(
                        role="tool",
                        content=tr.content,
                        tool_call_id=tr.tool_call_id,
                    )
                )

        # Current user message
        user_content = f"Continue the task: {task}"
        if screenshot_b64 and self.vision_mode in ("pixel_computer_use", "semantic_ui_tree"):
            # For pixel use, we include the image reference
            # For semantic, the user just gets text
            if self.vision_mode == "semantic_ui_tree":
                user_content = (
                    f"[STEP {len(history) + 1}] Current task: {task}\n\n"
                    "Use read_ui_tree() to see what's on screen, "
                    "then click_element() or type_in_field() to interact."
                )
        else:
            user_content = f"[STEP {len(history) + 1}] {task}"

        messages.append(Message(role="user", content=user_content))
        return messages

    def _execute_tool_calls(self, tool_calls: list[ToolCall]) -> list[ToolResult]:
        """Execute tool calls using the tool registry."""
        results: list[ToolResult] = []
        for tc in tool_calls:
            result = tool_registry.execute(tc.name, tc.args)
            result.tool_call_id = tc.id
            results.append(result)
            logger.debug("Tool %s → %s (success=%s)", tc.name, result.content[:80], result.success)
        return results

    async def run(
        self,
        task: str,
        on_step: callable | None = None,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Run the agent loop for a given task.

        Args:
            task: The task to accomplish.
            on_step: Optional callback for each step.

        Yields:
            Dicts with step information.
        """
        history: list[OrchestratorStep] = []
        messages: list[Message] = []
        screenshot_b64: str | None = None

        yield {"type": "start", "task": task, "model": self.config.model}

        for iteration in range(1, self.config.max_iterations + 1):
            yield {"type": "iteration_start", "iteration": iteration}

            # Build messages
            messages = self._convert_to_messages(task, history, screenshot_b64)

            # Call LLM
            response = await self.provider.chat(
                messages=messages,
                tools=self.tools,
                system_prompt=None,  # Already included in messages
                max_tokens=self.config.max_tokens,
                temperature=self.config.temperature,
            )

            step = OrchestratorStep(
                iteration=iteration,
                action="llm_response",
                reasoning=response.thinking or "",
                response=response.text,
                tool_calls=response.tool_calls,
            )

            # Yield thinking
            if response.thinking:
                yield {"type": "thinking", "text": response.thinking, "iteration": iteration}

            # Yield response text
            if response.text:
                yield {"type": "text", "text": response.text, "iteration": iteration}

            # Handle errors
            if response.stop_reason == "error":
                error_msg = response.error or "Unknown error"
                logger.error("LLM error at iteration %d: %s", iteration, error_msg)
                yield {"type": "error", "error": error_msg, "iteration": iteration}
                break

            # Execute tool calls
            if response.tool_calls:
                yield {
                    "type": "tool_calls",
                    "tool_calls": [
                        {"id": tc.id, "name": tc.name, "args": tc.args}
                        for tc in response.tool_calls
                    ],
                    "iteration": iteration,
                }

                tool_results = self._execute_tool_calls(response.tool_calls)
                step.tool_results = tool_results

                for tr in tool_results:
                    yield {
                        "type": "tool_result",
                        "tool_call_id": tr.tool_call_id,
                        "content": tr.content[:500],
                        "success": tr.success,
                        "iteration": iteration,
                    }

                # Take screenshot after tool execution if configured
                if self.config.screenshot_on_every_step:
                    try:
                        screenshot_result = tool_registry.execute("screenshot", {})
                        if screenshot_result.success:
                            # Extract base64 from the screenshot result format
                            raw = screenshot_result.content
                            if raw.startswith("[SCREENSHOT:") and raw.endswith("]"):
                                screenshot_b64 = raw[11:-1]
                    except Exception:
                        pass

            history.append(step)

            # Check for finish tool
            for tc in response.tool_calls:
                if tc.name == "finish":
                    summary = tc.args.get("summary", "Task completed.")
                    yield {"type": "done", "summary": summary, "iteration": iteration}
                    return

            # End turn = no more tool calls
            if response.stop_reason == "end_turn" and not response.tool_calls:
                yield {"type": "done", "summary": response.text, "iteration": iteration}
                return

            if on_step:
                on_step(step)

        else:
            yield {
                "type": "done",
                "summary": f"Reached maximum iterations ({self.config.max_iterations}).",
                "iteration": self.config.max_iterations,
            }

    async def run_stream(
        self,
        task: str,
    ) -> AsyncGenerator[StreamingChunk, None]:
        """Run the agent loop and stream events as they happen."""
        history: list[OrchestratorStep] = []
        messages: list[Message] = []
        screenshot_b64: str | None = None

        for iteration in range(1, self.config.max_iterations + 1):
            messages = self._convert_to_messages(task, history, screenshot_b64)

            # Stream from LLM
            all_text = ""
            all_thinking = ""
            tool_calls_acc: dict[str, ToolCall] = {}

            async for chunk in self.provider.chat_stream(
                messages=messages,
                tools=self.tools,
                system_prompt=None,
                max_tokens=self.config.max_tokens,
                temperature=self.config.temperature,
            ):
                yield chunk

                if chunk.type == "text":
                    all_text += chunk.text
                elif chunk.type == "thinking":
                    all_thinking += chunk.text
                elif chunk.type == "tool_call_start" and chunk.tool_call_id:
                    tool_calls_acc[chunk.tool_call_id] = ToolCall(
                        id=chunk.tool_call_id,
                        name=chunk.tool_name or "",
                        args={},
                    )
                elif chunk.type == "error":
                    yield StreamingChunk(type="done")
                    return

            # Execute tool calls collected during streaming
            tool_calls = list(tool_calls_acc.values())
            if tool_calls:
                tool_results = self._execute_tool_calls(tool_calls)
                step = OrchestratorStep(
                    iteration=iteration,
                    action="tool_execution",
                    response=all_text,
                    reasoning=all_thinking,
                    tool_calls=tool_calls,
                    tool_results=tool_results,
                )
                history.append(step)

                # Take screenshot
                if self.config.screenshot_on_every_step:
                    try:
                        r = tool_registry.execute("screenshot", {})
                        if r.success and r.content.startswith("[SCREENSHOT:") and r.content.endswith("]"):
                            screenshot_b64 = r.content[11:-1]
                    except Exception:
                        pass

                # Check for finish
                for tc in tool_calls:
                    if tc.name == "finish":
                        yield StreamingChunk(type="done")
                        return
            else:
                # No tool calls = done
                step = OrchestratorStep(
                    iteration=iteration,
                    action="final_response",
                    response=all_text,
                    reasoning=all_thinking,
                )
                history.append(step)
                yield StreamingChunk(type="done")
                return

        yield StreamingChunk(type="done")
