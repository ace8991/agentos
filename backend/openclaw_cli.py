from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.openclaw_hub import (  # noqa: E402
    create_pairing_session,
    get_openclaw_state,
    update_channel,
    update_gateway,
    update_overlays,
)


def _print_state() -> None:
    state = get_openclaw_state()
    print(state.summary)
    print(json.dumps(state.model_dump(), indent=2))


def main() -> int:
    parser = argparse.ArgumentParser(description="AgentOS OpenClaw-style gateway utility")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("status", help="Print the current gateway state")
    subparsers.add_parser("doctor", help="Print a detailed health snapshot")

    pair_parser = subparsers.add_parser("pair", help="Create a pairing session for a device")
    pair_parser.add_argument("--name", required=True)
    pair_parser.add_argument("--platform", required=True, choices=["android", "ios", "desktop", "web"])
    pair_parser.add_argument("--role", default="operator", choices=["operator", "node", "viewer"])
    pair_parser.add_argument("--host")
    pair_parser.add_argument("--port")
    pair_parser.add_argument("--pair-code")

    channel_parser = subparsers.add_parser("channel", help="Configure a messaging channel")
    channel_parser.add_argument("--id", required=True, choices=["telegram", "whatsapp", "webhook", "slack", "discord", "email", "sms", "push"])
    channel_parser.add_argument("--secret", default="")
    channel_parser.add_argument("--enable", action="store_true")

    overlay_parser = subparsers.add_parser("overlay", help="Toggle overlay features")
    overlay_parser.add_argument("--floating-dock", choices=["on", "off"])
    overlay_parser.add_argument("--mobile-hud", choices=["on", "off"])
    overlay_parser.add_argument("--voice-overlay", choices=["on", "off"])
    overlay_parser.add_argument("--voice-wake", choices=["on", "off"])
    overlay_parser.add_argument("--camera-hud", choices=["on", "off"])

    args = parser.parse_args()

    if args.command in {"status", "doctor"}:
        _print_state()
        return 0

    if args.command == "pair":
        gateway_payload = {
            "host": args.host,
            "port": int(args.port) if args.port else None,
            "pairing_code": args.pair_code,
        }
        if any(value is not None for value in gateway_payload.values()):
            update_gateway(gateway_payload)
        state = create_pairing_session(args.name, args.platform, args.role)
        newest = state.devices[-1]
        print(
            json.dumps(
                {
                    "paired_device": newest.name,
                    "platform": newest.platform,
                    "role": newest.role,
                    "pair_code": newest.pair_code,
                    "gateway_host": state.gateway.host,
                    "gateway_port": state.gateway.port,
                },
                indent=2,
            )
        )
        return 0

    if args.command == "channel":
        state = update_channel(args.id, enabled=args.enable, secret=args.secret)
        print(state.summary)
        return 0

    if args.command == "overlay":
        payload = {
            "floating_dock": args.floating_dock == "on" if args.floating_dock else None,
            "mobile_hud": args.mobile_hud == "on" if args.mobile_hud else None,
            "voice_overlay": args.voice_overlay == "on" if args.voice_overlay else None,
            "voice_wake": args.voice_wake == "on" if args.voice_wake else None,
            "camera_hud": args.camera_hud == "on" if args.camera_hud else None,
        }
        state = update_overlays(payload)
        print(state.summary)
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
