"""Entrypoint: arranca ws_bridge en un thread y el MCP server en el principal."""

from __future__ import annotations

import threading

from .server import mcp
from .ws_bridge import Bridge, BridgeConfig


def main() -> None:
    cfg = BridgeConfig()
    bridge = Bridge(cfg)

    t = threading.Thread(target=bridge.run_forever, name="hydra-ws-bridge", daemon=True)
    t.start()

    # Exponer el bridge a las tools del MCP server
    mcp.state["bridge"] = bridge  # type: ignore[attr-defined]

    # El MCP server corre en el hilo principal (stdio)
    mcp.run()


if __name__ == "__main__":
    main()
