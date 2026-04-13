"""MCP server (FastMCP) para Hydra.

Expone tools que, a través del WebSocket bridge, llegan al navegador donde
corre hydra-synth. El bridge vive en un thread separado (ver __main__.py).
"""

from __future__ import annotations

from pathlib import Path

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("hydra")
# Slot compartido con __main__.py para inyectar el Bridge tras arrancar.
mcp.state: dict = {}  # type: ignore[attr-defined]

SKETCHES_DIR = Path(__file__).parent / "sketches"


def _bridge():
    b = mcp.state.get("bridge")  # type: ignore[attr-defined]
    if b is None:
        raise RuntimeError("WebSocket bridge no inicializado")
    return b


@mcp.tool()
def eval_hydra(code: str) -> str:
    """Evalúa código Hydra en el navegador.

    Ejemplo: `osc(10, 0.1, 1).out()`
    """
    _bridge().send_to_browser({"op": "eval", "code": code})
    return "enviado"


@mcp.tool()
def load_sketch(name: str) -> str:
    """Carga un sketch de `sketches/` por nombre (sin extensión) y lo evalúa."""
    path = SKETCHES_DIR / f"{name}.js"
    if not path.exists():
        raise FileNotFoundError(f"sketch no encontrado: {name}")
    code = path.read_text(encoding="utf-8")
    _bridge().send_to_browser({"op": "eval", "code": code})
    return f"sketch '{name}' cargado ({len(code)} bytes)"


@mcp.tool()
def list_sketches() -> list[str]:
    """Lista los sketches disponibles en `sketches/`."""
    if not SKETCHES_DIR.exists():
        return []
    return sorted(p.stem for p in SKETCHES_DIR.glob("*.js"))


@mcp.tool()
def set_param(name: str, value: float) -> str:
    """Asigna `window.omt[name] = value` en el navegador (parámetro de control)."""
    _bridge().send_to_browser({"op": "param", "name": name, "value": value})
    return f"omt.{name} = {value}"


@mcp.tool()
def bridge_status() -> dict:
    """Estado del WebSocket bridge: clientes conectados, último OSC recibido."""
    return _bridge().status()
