"""Entrypoints de hydra-mcp.

- `main()` / `hydra-mcp`: arranca el ws bridge en un thread y el MCP server
  por stdio en el hilo principal. Es el entry point que usa Claude Code.
- `bridge_only()` / `hydra-bridge`: arranca sólo el ws bridge en el hilo
  principal con manejo nativo de SIGINT/SIGTERM. Útil para tests, CI y
  debugging sin un cliente MCP.
"""

from __future__ import annotations

import threading

from .server import mcp
from .ws_bridge import Bridge, BridgeConfig


def main() -> None:
    cfg = BridgeConfig()
    bridge = Bridge(cfg)

    t = threading.Thread(target=bridge.run_forever, name="hydra-ws-bridge", daemon=True)
    t.start()

    mcp.state["bridge"] = bridge  # type: ignore[attr-defined]
    mcp.run()


def bridge_only() -> None:
    Bridge(BridgeConfig()).run_forever(install_signal_handlers=True)


if __name__ == "__main__":
    main()
