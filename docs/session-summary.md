# Resumen ejecutivo — sesión de bootstrap omt07l

**Fecha**: 2026-04-13
**Duración**: una sesión
**Objetivo**: sentar la infraestructura base del proyecto `omt07l` (integración de Claude Code con SuperCollider, Hydra y TouchDesigner para performances audiovisuales reactivas) y dejarlo verificado hasta donde las dependencias externas lo permitan.

## Qué se hizo

### 1. Diseño + scaffolding completo (31 archivos)

- **Arquitectura en dos planos**: control (MCP stdio) y datos (OSC).
- **Estructura de carpetas** con `mcp/`, `sc/`, `td/`, `config/`, `.claude/agents/`, `.claude/skills/`, `docs/`.
- **Protocolo OSC canónico** en `config/osc_map.yaml` como fuente de verdad: 7 direcciones bajo `/omt/audio/*` y `/omt/control/*`, puertos 57110/57120/57200/7000/8765.
- **MCP server custom** `mcp/hydra/` en Python (FastMCP + python-osc + aiohttp + websockets), con 5 tools (`eval_hydra`, `load_sketch`, `list_sketches`, `set_param`, `bridge_status`) y un WebSocket bridge que traduce OSC→JSON para el navegador.
- **SuperCollider**: `analyzer.scd` (Pitch, Amplitude sobre 3 bandas, Onsets, FFT en 8 bandas log) + `osc_routes.scd` que re-emite con addresses canónicas + `sessions/00_quickstart.scd`.
- **4 sub-agentes** con dominios restringidos: `conductor`, `composer`, `visualist`, `mapper`.
- **3 skills** transversales: `audio-reactive-viz`, `freq-to-params`, `live-mapping`.
- **Documentación**: `README.md`, `CLAUDE.md`, `docs/architecture.md`, `docs/osc-protocol.md`, `docs/learning/00-overview.md` (primer módulo pedagógico).

### 2. Verificación end-to-end del control plane

| Componente | Cómo se verificó | Resultado |
|---|---|---|
| `uv sync` workspace | `uv sync --all-packages` | ✅ 50 paquetes, `hydra-mcp` editable |
| `hydra-mcp` bridge HTTP | `curl http://localhost:8765/{index.html,client.js}` | ✅ 200 OK |
| `hydra-mcp` OSC→ws | Script asyncio: 4 mensajes OSC sintéticos → ws | ✅ 4/4 direcciones correctas |
| `hydra-mcp` MCP stdio | Handshake JSON-RPC `initialize` + `tools/list` + 4 `tools/call` | ✅ todas las tools responden |
| `SuperColliderMCP` | `uv run mcp run server.py` + handshake | ✅ 12 tools listadas |
| `touchdesigner-mcp-server` | `npx -y touchdesigner-mcp-server@latest --stdio` + handshake | ✅ v1.4.7 responde |

## Hallazgos críticos (bugs corregidos en sesión)

1. **`SuperColliderMCP` entry point roto**: el script `sc-osc` declarado en `pyproject.toml` apunta a un módulo inexistente (`supercollidermcp.main`). La invocación canónica es `mcp run server.py`. Corregido en `.mcp.json` y `mcp/supercollider/README.md`.
2. **Paquete npm incorrecto para TouchDesigner MCP**: `@8beeeaaat/touchdesigner-mcp` fue *unpublished* el 2025-04-28. El paquete real es `touchdesigner-mcp-server` y requiere el flag `--stdio`. Corregido en `.mcp.json` y `mcp/touchdesigner/README.md`.

## Estado final

### Verde ✅

- Control plane (los 3 MCPs) operativo desde Claude Code.
- Data plane (bus OSC → WebSocket → navegador) verificado con tráfico sintético.
- `hydra-mcp` funcional sin dependencias externas.

### Bloqueado por dependencias externas 🔒

| Bloqueante | Cómo desbloquear |
|---|---|
| Análisis de audio real | `sudo dnf install supercollider` + conectar instrumento |
| Render visual en navegador | Abrir `http://localhost:8765/` en Firefox/Chrome mientras corre `hydra-mcp` |
| Projection mapping | Máquina con TouchDesigner + `mcp_webserver_base.tox` del release upstream |
| Registro `/mcp` en Claude Code | `cd ~/Documentos/omt07l && claude`, luego `/mcp` |

## Cómo continuar

1. Ajustar shell para incluir `~/.local/bin` en el `PATH` permanente (donde vive `uv`).
2. Instalar SuperCollider con `dnf`.
3. En una sesión nueva de `claude` dentro del proyecto: `/mcp` para confirmar los 3 servers en verde.
4. Ejecutar `sc/sessions/00_quickstart.scd` desde la IDE de SC con guitarra conectada, y abrir `http://localhost:8765/` en paralelo para ver el sketch `default` pulsando con el bajo.
5. Pedir al `conductor` la primera escena (ej.: "prepara una escena intro suave") y observar cómo delega a `composer`, `visualist`, `mapper`.

## Mejoras propuestas para la próxima iteración

- Entry point `hydra-bridge` separado para arrancar el ws bridge sin el stdio MCP (útil para debug y tests).
- Smoke test en `mcp/hydra/tests/` reutilizando el script OSC→ws usado en esta sesión.
- `scripts/doctor.sh` que valide el entorno antes de una performance (PATH, uv, node, SC, puertos libres).
- `docs/learning/01-primeros-pasos.md` con un primer ciclo audio→visual completo, una vez que SC esté instalado.
- Investigar el puente Hydra→TouchDesigner en Linux (NDI vía GStreamer o alternativa).

## Artefactos relevantes

- **Árbol del proyecto**: 31 archivos creados.
- **Session log detallado**: `docs/session-log.md`.
- **Documentación de arquitectura**: `docs/architecture.md`.
- **Protocolo OSC**: `config/osc_map.yaml` + `docs/osc-protocol.md`.
- **Plan original**: `~/.claude/plans/fluffy-dancing-sonnet.md`.

---

**TL;DR**: omt07l tiene su infraestructura base montada, los 3 MCPs verificados y dos bugs de upstream corregidos. El scaffolding funciona end-to-end en el control plane y el data plane sintético; sólo falta conectar los extremos físicos (audio real, navegador real, TouchDesigner real) para completar el primer ciclo audiovisual.
