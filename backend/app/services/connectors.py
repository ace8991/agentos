from __future__ import annotations

from datetime import datetime, timezone
from typing import Awaitable, Callable
from urllib.parse import urlparse

import httpx

from app.config import IS_LOCAL
from app.models.schemas import ConnectorValidateResponse

Validator = Callable[[dict[str, str]], Awaitable[ConnectorValidateResponse]]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean_values(values: dict[str, str]) -> dict[str, str]:
    return {
        key: value.strip()
        for key, value in values.items()
        if isinstance(value, str) and value.strip()
    }


def _response(
    connector_id: str,
    integration_mode: str,
    status: str,
    ready: bool,
    message: str,
) -> ConnectorValidateResponse:
    return ConnectorValidateResponse(
        connector_id=connector_id,
        integration_mode=integration_mode,
        status=status,
        ready=ready,
        message=message,
        checked_at=_now_iso(),
    )


async def _http_status_ok(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    json: dict | None = None,
    auth: tuple[str, str] | None = None,
) -> httpx.Response:
    async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
        response = await client.request(method, url, headers=headers, json=json, auth=auth)
    return response


def _missing(connector_id: str, integration_mode: str, message: str) -> ConnectorValidateResponse:
    return _response(connector_id, integration_mode, "not_configured", False, message)


async def _validate_github(values: dict[str, str]) -> ConnectorValidateResponse:
    token = values.get("GITHUB_TOKEN")
    if not token:
        return _missing("github", "native", "Add a GitHub personal access token before validating.")

    response = await _http_status_ok(
        "GET",
        "https://api.github.com/user",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    if response.is_success:
        login = response.json().get("login", "GitHub account")
        return _response("github", "native", "verified", True, f"Verified against GitHub as {login}.")
    return _response("github", "native", "error", False, f"GitHub rejected the token ({response.status_code}).")


async def _validate_notion(values: dict[str, str]) -> ConnectorValidateResponse:
    token = values.get("NOTION_API_KEY")
    if not token:
        return _missing("notion", "native", "Add a Notion integration token before validating.")

    response = await _http_status_ok(
        "GET",
        "https://api.notion.com/v1/users/me",
        headers={
            "Authorization": f"Bearer {token}",
            "Notion-Version": "2022-06-28",
        },
    )
    if response.is_success:
        name = response.json().get("name") or "Notion workspace"
        return _response("notion", "native", "verified", True, f"Verified against {name}.")
    return _response("notion", "native", "error", False, f"Notion rejected the token ({response.status_code}).")


async def _validate_slack(values: dict[str, str]) -> ConnectorValidateResponse:
    token = values.get("SLACK_BOT_TOKEN")
    if not token:
        return _missing("slack", "native", "Add a Slack bot token before validating.")

    response = await _http_status_ok(
        "POST",
        "https://slack.com/api/auth.test",
        headers={"Authorization": f"Bearer {token}"},
    )
    if response.is_success and response.json().get("ok"):
        team = response.json().get("team", "Slack workspace")
        return _response("slack", "native", "verified", True, f"Verified against {team}.")
    return _response("slack", "native", "error", False, "Slack rejected the bot token.")


async def _validate_jira(values: dict[str, str]) -> ConnectorValidateResponse:
    email = values.get("JIRA_EMAIL")
    token = values.get("JIRA_API_TOKEN")
    base_url = values.get("JIRA_BASE_URL", "").rstrip("/")
    if not (email and token and base_url):
        return _missing("jira", "native", "Add email, API token, and base URL before validating Jira.")

    response = await _http_status_ok(
        "GET",
        f"{base_url}/rest/api/3/myself",
        auth=(email, token),
        headers={"Accept": "application/json"},
    )
    if response.is_success:
        display_name = response.json().get("displayName", "Jira user")
        return _response("jira", "native", "verified", True, f"Verified against Jira as {display_name}.")
    return _response("jira", "native", "error", False, f"Jira validation failed ({response.status_code}).")


async def _validate_linear(values: dict[str, str]) -> ConnectorValidateResponse:
    token = values.get("LINEAR_API_KEY")
    if not token:
        return _missing("linear", "native", "Add a Linear API key before validating.")

    response = await _http_status_ok(
        "POST",
        "https://api.linear.app/graphql",
        headers={"Authorization": token},
        json={"query": "query { viewer { name } }"},
    )
    if response.is_success and not response.json().get("errors"):
        name = response.json().get("data", {}).get("viewer", {}).get("name", "Linear workspace")
        return _response("linear", "native", "verified", True, f"Verified against {name}.")
    return _response("linear", "native", "error", False, "Linear rejected the API key.")


async def _validate_discord(values: dict[str, str]) -> ConnectorValidateResponse:
    token = values.get("DISCORD_BOT_TOKEN")
    if not token:
        return _missing("discord", "native", "Add a Discord bot token before validating.")

    response = await _http_status_ok(
        "GET",
        "https://discord.com/api/v10/users/@me",
        headers={"Authorization": f"Bot {token}"},
    )
    if response.is_success:
        username = response.json().get("username", "Discord bot")
        return _response("discord", "native", "verified", True, f"Verified against Discord bot {username}.")
    return _response("discord", "native", "error", False, f"Discord rejected the bot token ({response.status_code}).")


async def _validate_telegram(values: dict[str, str]) -> ConnectorValidateResponse:
    token = values.get("TELEGRAM_BOT_TOKEN")
    if not token:
        return _missing("telegram", "relay", "Add a Telegram bot token before validating.")

    response = await _http_status_ok("GET", f"https://api.telegram.org/bot{token}/getMe")
    payload = response.json() if response.is_success else {}
    if response.is_success and payload.get("ok"):
        username = payload.get("result", {}).get("username", "telegram-bot")
        return _response(
            "telegram",
            "relay",
            "ready_relay",
            True,
            f"Bot @{username} is valid. Telegram remains relay-based and still needs the inbound bridge enabled.",
        )
    return _response("telegram", "relay", "error", False, "Telegram rejected the bot token.")


async def _validate_whatsapp(values: dict[str, str]) -> ConnectorValidateResponse:
    token = values.get("WHATSAPP_ACCESS_TOKEN")
    phone_number_id = values.get("WHATSAPP_PHONE_NUMBER_ID")
    if not (token and phone_number_id):
        return _missing(
            "whatsapp",
            "relay",
            "Add a WhatsApp access token and phone number ID before validating.",
        )

    response = await _http_status_ok(
        "GET",
        f"https://graph.facebook.com/v20.0/{phone_number_id}?fields=id,display_phone_number",
        headers={"Authorization": f"Bearer {token}"},
    )
    if response.is_success:
        phone = response.json().get("display_phone_number", phone_number_id)
        return _response(
            "whatsapp",
            "relay",
            "ready_relay",
            True,
            f"WhatsApp business number {phone} is reachable. Relay/webhook delivery is still required for live control.",
        )
    return _response("whatsapp", "relay", "error", False, f"WhatsApp validation failed ({response.status_code}).")


async def _validate_local_connector(connector_id: str, values: dict[str, str]) -> ConnectorValidateResponse:
    server_url = next((value for key, value in values.items() if key.endswith("_SERVER_URL") and value), "")
    if not server_url:
        if IS_LOCAL:
            return _response(
                connector_id,
                "local",
                "saved",
                False,
                "Local mode is available, but this connector still needs a local server URL before it can be verified.",
            )
        return _response(
            connector_id,
            "local",
            "error",
            False,
            "This connector only becomes active on a local installation with its local server running.",
        )

    if not IS_LOCAL:
        return _response(
            connector_id,
            "local",
            "error",
            False,
            "This connector is local-only. Switch the backend to local mode to use it.",
        )

    parsed = urlparse(server_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return _response(connector_id, "local", "error", False, "Provide a valid local server URL to verify this connector.")

    try:
        response = await _http_status_ok("GET", server_url)
    except httpx.HTTPError:
        return _response(
            connector_id,
            "local",
            "error",
            False,
            "AgentOS is in local mode, but the local connector server did not respond at the configured URL.",
        )

    if response.status_code < 500:
        return _response(
            connector_id,
            "local",
            "ready_local",
            True,
            "Local connector server responded. This connector is ready on this machine.",
        )
    return _response(
        connector_id,
        "local",
        "error",
        False,
        f"Local connector server returned {response.status_code}.",
    )


VALIDATORS: dict[str, Validator] = {
    "github": _validate_github,
    "notion": _validate_notion,
    "slack": _validate_slack,
    "jira": _validate_jira,
    "linear": _validate_linear,
    "discord": _validate_discord,
    "telegram": _validate_telegram,
    "whatsapp": _validate_whatsapp,
}


async def validate_connector(connector_id: str, values: dict[str, str]) -> ConnectorValidateResponse:
    cleaned = _clean_values(values)
    validator = VALIDATORS.get(connector_id)
    if validator is not None:
        integration_mode = "relay" if connector_id in {"telegram", "whatsapp"} else "native"
        try:
            return await validator(cleaned)
        except httpx.HTTPError as exc:
            return _response(
                connector_id,
                integration_mode,
                "error",
                False,
                f"Validation request failed before the provider could confirm credentials: {exc}",
            )

    if not cleaned:
        mode = "local" if any(key.endswith("_SERVER_URL") for key in values) else "manual"
        return _missing(connector_id, mode, "Add connector credentials or endpoint details before validating.")

    if any(key.endswith("_SERVER_URL") for key in cleaned):
        return await _validate_local_connector(connector_id, cleaned)

    return _response(
        connector_id,
        "manual",
        "saved",
        False,
        "Credentials are saved locally, but this catalog entry is not wired to a native backend validator yet.",
    )
