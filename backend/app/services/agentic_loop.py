"""
Agentic loop — the heart of the system.

Implements the exact flow shown in the architecture diagram:
  User prompt
    → LLM (with tool definitions + system prompt + context)
    → tool_use block → execute tool → tool_result
    → re-send to LLM (boucle)
    → final text response streamed token by token

Supports: Anthropic, OpenAI-compatible (Qwen, DeepSeek, Mistral, Groq, Google)
"""
from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

import httpx

from app.services.runtime_config import get_runtime_value
from app.services.tool_definitions import TOOLS_ANTHROPIC, TOOLS_OPENAI
from app.services.tool_executor import execute as run_tool

logger = logging.getLogger(__name__)

MAX_ITERATIONS = 15  # safety cap on the agentic loop

# ── SSE helpers ───────────────────────────────────────────────────────────────

def _sse(d: dict) -> str:                   return f"data: {json.dumps(d)}\n\n"
def _text(t: str) -> str:                   return _sse({"type": "text",        "text": t})
def _thinking(t: str) -> str:               return _sse({"type": "thinking",    "text": t})
def _tool_call(n: str, a: dict, i: str) -> str:
    return _sse({"type": "tool_call",  "tool": n, "args": a, "id": i})
def _tool_result(n: str, r: str, i: str, ok: bool) -> str:
    return _sse({"type": "tool_result","tool": n, "result": r, "id": i, "success": ok})
def _done() -> str:                         return _sse({"type": "done"})
def _err(e: str) -> str:                    return _sse({"type": "error",       "error": e})

# ── Anthropic agentic loop ────────────────────────────────────────────────────

async def anthropic_loop(
    messages: list[dict],
    model: str,
    system: str,
    max_tokens: int,
    reasoning_effort: str | None,
) -> AsyncGenerator[str, None]:
    key = (get_runtime_value("ANTHROPIC_API_KEY") or "").strip()
    if not key:
        yield _err("ANTHROPIC_API_KEY is not configured. Save it in Settings.")
        return

    history = list(messages)

    for iteration in range(MAX_ITERATIONS):
        payload: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "system": system,
            "tools": TOOLS_ANTHROPIC,
            "messages": history,
        }
        if reasoning_effort in ("low", "medium", "high"):
            budgets = {"low": 4096, "medium": 12000, "high": 32000}
            payload["thinking"] = {"type": "enabled", "budget_tokens": budgets[reasoning_effort]}

        # ── Call Anthropic API ────────────────────────────────────────────────
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream(
                    "POST", "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json=payload,
                ) as resp:
                    if resp.status_code != 200:
                        body = await resp.aread()
                        try:
                            err = json.loads(body).get("error", {}).get("message", body.decode()[:300])
                        except Exception:
                            err = body.decode()[:300]
                        yield _err(f"Anthropic {resp.status_code}: {err}")
                        return

                    # ── Parse the streaming response ─────────────────────────
                    response_blocks: list[dict] = []
                    current_block: dict | None  = None
                    stop_reason: str            = "end_turn"
                    tool_calls: list[dict]      = []

                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        raw = line[6:].strip()
                        if not raw:
                            continue
                        try:
                            ev = json.loads(raw)
                        except Exception:
                            continue

                        ev_type = ev.get("type", "")

                        if ev_type == "content_block_start":
                            blk = ev.get("content_block", {})
                            current_block = {"type": blk.get("type"), "text": "", "input_json": ""}
                            if blk.get("type") == "tool_use":
                                current_block["id"]   = blk.get("id", "")
                                current_block["name"] = blk.get("name", "")

                        elif ev_type == "content_block_delta" and current_block:
                            delta = ev.get("delta", {})
                            if delta.get("type") == "text_delta":
                                t = delta.get("text", "")
                                current_block["text"] += t
                                yield _text(t)
                            elif delta.get("type") == "thinking_delta":
                                t = delta.get("thinking", "")
                                current_block["text"] += t
                                yield _thinking(t)
                            elif delta.get("type") == "input_json_delta":
                                current_block["input_json"] += delta.get("partial_json", "")

                        elif ev_type == "content_block_stop" and current_block:
                            if current_block["type"] == "tool_use":
                                try:
                                    args = json.loads(current_block["input_json"] or "{}")
                                except Exception:
                                    args = {}
                                tool_calls.append({
                                    "id":   current_block["id"],
                                    "name": current_block["name"],
                                    "args": args,
                                })
                                response_blocks.append({
                                    "type":  "tool_use",
                                    "id":    current_block["id"],
                                    "name":  current_block["name"],
                                    "input": args,
                                })
                            elif current_block["text"]:
                                response_blocks.append({
                                    "type": current_block["type"],
                                    "text": current_block["text"],
                                })
                            current_block = None

                        elif ev_type == "message_delta":
                            stop_reason = ev.get("delta", {}).get("stop_reason", "end_turn")

                        elif ev_type == "error":
                            yield _err(ev.get("error", {}).get("message", "Streaming error"))
                            return

        except httpx.ConnectError:
            yield _err("Cannot connect to Anthropic API")
            return
        except httpx.TimeoutException:
            yield _err("Anthropic API timeout")
            return
        except Exception as exc:
            logger.exception("Anthropic agentic loop error")
            yield _err(str(exc))
            return

        # ── Add assistant response to history ─────────────────────────────────
        if response_blocks:
            history.append({"role": "assistant", "content": response_blocks})

        # ── No tool calls → final answer reached ─────────────────────────────
        if stop_reason == "end_turn" or not tool_calls:
            break

        # ── Execute all tool calls and add results ───────────────────────────
        tool_results: list[dict] = []
        for tc in tool_calls:
            yield _tool_call(tc["name"], tc["args"], tc["id"])
            result_str = run_tool(tc["name"], tc["args"])
            ok = not result_str.startswith("ERROR")
            yield _tool_result(tc["name"], result_str, tc["id"], ok)
            tool_results.append({
                "type":        "tool_result",
                "tool_use_id": tc["id"],
                "content":     result_str,
            })

        history.append({"role": "user", "content": tool_results})
        tool_calls = []  # reset for next iteration

    yield _done()


# ── OpenAI-compatible agentic loop (Qwen, DeepSeek, Mistral, Groq, Google) ───

async def openai_loop(
    messages: list[dict],
    model: str,
    system: str,
    max_tokens: int,
    base_url: str,
    key_name: str,
    provider_label: str,
    extra_params: dict | None = None,
) -> AsyncGenerator[str, None]:
    key = (get_runtime_value(key_name) or "").strip() if key_name else ""
    if key_name and not key:
        yield _err(f"{key_name} is not configured. Save it in Settings.")
        return

    # Build initial messages with system prompt
    history: list[dict] = []
    if system:
        history.append({"role": "system", "content": system})
    history.extend(messages)

    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"

    for iteration in range(MAX_ITERATIONS):
        payload: dict[str, Any] = {
            "model": model,
            "messages": history,
            "tools": TOOLS_OPENAI,
            "tool_choice": "auto",
            "stream": True,
            "max_tokens": max_tokens,
        }
        if extra_params:
            payload.update(extra_params)

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream(
                    "POST", f"{base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                ) as resp:
                    if resp.status_code != 200:
                        body = await resp.aread()
                        try:
                            err = json.loads(body).get("error", {}).get("message", body.decode()[:300])
                        except Exception:
                            err = body.decode()[:300]
                        yield _err(f"{provider_label} {resp.status_code}: {err}")
                        return

                    # ── Parse OpenAI streaming response ───────────────────────
                    assistant_text   = ""
                    tool_calls_acc: dict[int, dict] = {}  # index → accumulated call
                    finish_reason: str | None = None

                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        raw = line[6:].strip()
                        if raw == "[DONE]":
                            break
                        if not raw:
                            continue
                        try:
                            chunk = json.loads(raw)
                        except Exception:
                            continue

                        choice = chunk.get("choices", [{}])[0]
                        delta  = choice.get("delta", {})
                        finish_reason = choice.get("finish_reason") or finish_reason

                        # Text token
                        text = delta.get("content", "")
                        if text:
                            assistant_text += text
                            yield _text(text)

                        # Reasoning token (DeepSeek-R1, Qwen3)
                        thinking = delta.get("reasoning_content", "")
                        if thinking:
                            yield _thinking(thinking)

                        # Tool call accumulation
                        for tc_delta in delta.get("tool_calls", []):
                            idx = tc_delta.get("index", 0)
                            if idx not in tool_calls_acc:
                                tool_calls_acc[idx] = {
                                    "id":   tc_delta.get("id", f"call_{idx}"),
                                    "name": "",
                                    "args": "",
                                }
                            fn = tc_delta.get("function", {})
                            if fn.get("name"):
                                tool_calls_acc[idx]["name"] += fn["name"]
                            if fn.get("arguments"):
                                tool_calls_acc[idx]["args"] += fn["arguments"]

        except httpx.ConnectError:
            yield _err(f"Cannot connect to {provider_label}")
            return
        except httpx.TimeoutException:
            yield _err(f"{provider_label} API timeout")
            return
        except Exception as exc:
            logger.exception("%s agentic loop error", provider_label)
            yield _err(str(exc))
            return

        # ── Build assistant message ───────────────────────────────────────────
        assistant_msg: dict[str, Any] = {"role": "assistant"}
        if assistant_text:
            assistant_msg["content"] = assistant_text
        if tool_calls_acc:
            assistant_msg["tool_calls"] = [
                {
                    "id":       tc["id"],
                    "type":     "function",
                    "function": {"name": tc["name"], "arguments": tc["args"]},
                }
                for tc in tool_calls_acc.values()
            ]
        history.append(assistant_msg)

        # ── No tool calls → done ──────────────────────────────────────────────
        if finish_reason != "tool_calls" or not tool_calls_acc:
            break

        # ── Execute tool calls ────────────────────────────────────────────────
        for tc in tool_calls_acc.values():
            try:
                args = json.loads(tc["args"] or "{}")
            except Exception:
                args = {}
            yield _tool_call(tc["name"], args, tc["id"])
            result_str = run_tool(tc["name"], args)
            ok = not result_str.startswith("ERROR")
            yield _tool_result(tc["name"], result_str, tc["id"], ok)
            history.append({
                "role":         "tool",
                "tool_call_id": tc["id"],
                "content":      result_str,
            })

        tool_calls_acc = {}

    yield _done()
