# hydra-mcp

MCP server custom para **Hydra** (live coding visual en navegador), parte del proyecto `omt07l`.

Dos cosas en un solo proceso:

1. **MCP server** (stdio, FastMCP) — expone herramientas a Claude Code:
   - `eval_hydra(code)` — ejecuta código Hydra en el navegador.
   - `load_sketch(name)` — carga un sketch de `src/hydra_mcp/sketches/`.
   - `set_param(name, value)` — asigna `window.omt[name] = value`.
   - `list_sketches()` — lista los sketches disponibles.

2. **WebSocket bridge** — proceso asyncio en paralelo que:
   - Sirve la página `web/index.html` en `http://localhost:8765/`.
   - Acepta conexiones WebSocket del navegador.
   - Escucha OSC en `udp:57200` (direcciones `/omt/audio/*` y `/omt/control/*`).
   - Reenvía cada mensaje OSC al navegador como JSON: `{"addr": "...", "args": [...]}`.
   - Reenvía las tool calls MCP al navegador como `{"op": "eval", "code": "..."}`.

## Uso

```bash
uv run hydra-mcp
# en otro terminal / navegador
xdg-open http://localhost:8765/
```

Con el navegador abierto y SuperCollider emitiendo OSC en 57200, las variables `window.omt.bass|mid|high|pitch|...` se actualizan en tiempo real y los sketches pueden reaccionar a ellas.

## Variables expuestas en el navegador

Ver `CLAUDE.md` en la raíz del proyecto.
