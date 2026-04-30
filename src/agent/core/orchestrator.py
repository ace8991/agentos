"""
Agent orchestrator — the universal loop.

This is the heart of the system. It works the same way regardless of which
LLM is driving:

  1. Take a screenshot (if model supports vision)
  2. Build the message history + available tools
  3. Call provider.chat(...)
  4. If the model returned tool calls → execute them locally → loop
  5. If the model returned a final answer → done

The provider knows how to talk to its API. The tools know how to act on the PC.
The orchestrator just coordinates.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import AsyncIterator, Callable

from .registry import ModelInfo, get_model
from .types import (
    AgentResponse,
    AgentStep,
    ContentBlock,
    Message,
    Role,
    ToolCall,
    ToolResult,
    ToolSchema,
)
from ..providers.base import LLMProvider
from ..tools.base import ToolRegistry

logger = logging.getLogger("agentos.agent")


class AgentOrchestrator:
    """Drives the agent loop for any LLM provider.

    Args:
        provider: Concrete LLMProvider (Anthropic, DeepSeek, etc.)
        model: ModelInfo from the registry
        tools: ToolRegistry with all local tools (mouse, keyboard, screen, etc.)
        system_prompt: Base instructions for the agent
        max_iterations: Hard cap to prevent infinite loops
        on_step: Optional callback invoked after each step (for streaming UI)
    """

    def __init__(
        self,
        provider: LLMProvider,
        model: ModelInfo,
        tools: ToolRegistry,
        system_prompt: str,
        max_iterations: int = 25,
        on_step: Callable[[AgentStep], None] | None = None,
    ):
        self.provider = provider
        self.model = model
        self.tools = tools
        self.system_prompt = system_prompt
        self.max_iterations = max_iterations
        self.on_step = on_step

    # ─────────────────────────────────────────────────────────────────
    # PUBLIC API
    # ─────────────────────────────────────────────────────────────────

    async def run(self, task: str) -> list[AgentStep]:
        """Run the agent until completion. Returns the full step history."""
        steps: list[AgentStep] = []
        async for step in self.run_stream(task):
            steps.append(step)
        return steps

    async def run_stream(self, task: str) -> AsyncIterator[AgentStep]:
        """Run the agent and stream each step as it happens."""
        messages: list[Message] = [
            Message(role=Role.SYSTEM, content=self.system_prompt),
            Message(role=Role.USER, content=task),
        ]

        tool_schemas = self._build_tool_schemas()

        for iteration in range(1, self.max_iterations + 1):
            screenshot_before = self._maybe_screenshot()

            logger.info(
                "Agent step %d/%d (model=%s)",
                iteration, self.max_iterations, self.model.id,
            )

            # Call the LLM
            try:
                response = await self.provider.chat(
                    messages=messages,
                    tools=tool_schemas,
                    image=screenshot_before,
                )
            except Exception as e:
                logger.exception("Provider call failed")
                step = AgentStep(
                    iteration=iteration,
                    timestamp=time.time(),
                    response=AgentResponse(
                        text=f"Error calling {self.model.provider}: {e}",
                        finish_reason="error",
                    ),
                )
                if self.on_step:
                    self.on_step(step)
                yield step
                return

            # Append the assistant turn to history
            messages.append(self._response_to_message(response))

            # Execute any tool calls
            tool_results: list[ToolResult] = []
            if response.tool_calls:
                tool_results = await self._execute_tools(response.tool_calls)
                # Add tool results back into history
                for result in tool_results:
                    messages.append(self._tool_result_to_message(result))

            screenshot_after = self._maybe_screenshot() if response.tool_calls else None

            step = AgentStep(
                iteration=iteration,
                timestamp=time.time(),
                response=response,
                tool_results=tool_results,
                screenshot_before=screenshot_before,
                screenshot_after=screenshot_after,
            )
            if self.on_step:
                self.on_step(step)
            yield step

            # If no tool calls, the model is done
            if not response.tool_calls:
                logger.info("Agent finished after %d iterations", iteration)
                return

        logger.warning("Agent hit max_iterations=%d without finishing", self.max_iterations)

    # ─────────────────────────────────────────────────────────────────
    # INTERNALS
    # ─────────────────────────────────────────────────────────────────

    def _build_tool_schemas(self) -> list[ToolSchema]:
        """Build the tool list based on model capabilities.

        - Computer-use-capable models (Claude) get the native computer tool
          plus auxiliary tools.
        - Other models get the full semantic toolkit (UI tree, click_element,
          type_in, screenshot, etc.) — no pixel guessing required.
        """
        if self.model.supports_computer_use:
            # Claude knows how to drive a screen with raw coords
            return self.tools.get_computer_use_schemas()
        # Everyone else uses the semantic toolkit
        return self.tools.get_semantic_schemas()

    def _maybe_screenshot(self) -> bytes | None:
        """Take a screenshot only if the model can see images."""
        if not self.model.supports_vision:
            return None
        try:
            return self.tools.get("screenshot").execute({}).content  # type: ignore
        except Exception:
            logger.exception("Screenshot failed")
            return None

    async def _execute_tools(self, calls: list[ToolCall]) -> list[ToolResult]:
        """Execute tool calls in order, collect results."""
        results: list[ToolResult] = []
        for call in calls:
            logger.info("Tool call: %s(%s)", call.name, call.arguments)
            try:
                tool = self.tools.get(call.name)
                # Run sync tool in thread pool to keep loop responsive
                result = await asyncio.to_thread(tool.execute, call.arguments)
                result.tool_call_id = call.id
                results.append(result)
            except Exception as e:
                logger.exception("Tool %s failed", call.name)
                results.append(ToolResult(
                    tool_call_id=call.id,
                    content=f"Tool execution error: {e}",
                    is_error=True,
                ))
        return results

    @staticmethod
    def _response_to_message(response: AgentResponse) -> Message:
        """Convert a model response into a message for the next turn."""
        # We store the full response (text + tool calls) as a single assistant message.
        # Providers will reconstruct their native format from this.
        blocks: list[ContentBlock] = []
        if response.text:
            blocks.append(ContentBlock(type="text", text=response.text))
        # Tool calls are stored in a structured way that providers translate
        for call in response.tool_calls:
            blocks.append(ContentBlock(
                type="tool_result",  # placeholder — providers handle this
                tool_call_id=call.id,
                tool_result={"name": call.name, "args": call.arguments},
            ))
        return Message(role=Role.ASSISTANT, content=blocks if blocks else (response.text or ""))

    @staticmethod
    def _tool_result_to_message(result: ToolResult) -> Message:
        """Convert a tool result into a message."""
        content: str
        if isinstance(result.content, (dict, list)):
            import json
            content = json.dumps(result.content, ensure_ascii=False)
        else:
            content = str(result.content)
        return Message(
            role=Role.TOOL,
            content=content,
            tool_call_id=result.tool_call_id,
        )
