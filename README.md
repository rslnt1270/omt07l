# omt07l

Entorno de live coding audiovisual donde **Claude Code** orquesta tres herramientas vía MCP:

- **SuperCollider** — síntesis y análisis de audio del instrumento en vivo (guitarra, bajo, batería).
- **Hydra** — síntesis visual en el navegador, reactiva a audio.
- **TouchDesigner** — compositor final y projection mapping.

El pegamento es un bus **OSC** canónico (`config/osc_map.yaml`) que SuperCollider emite y Hydra + TouchDesigner consumen. Claude Code se conecta a los tres vía MCP servers registrados en `.mcp.json`, y delega tareas a sub-agentes especializados (`composer`, `visualist`, `mapper`, `conductor`).

## Arquitectura en una línea

```
Instrumento ─▶ SC (Tartini/FFT) ─OSC─▶ Hydra (browser) ─NDI─▶ TouchDesigner ─▶ Proyector
                                 └──OSC─▶ TouchDesigner
```

## Estructura

| Carpeta | Contenido |
|---|---|
| `mcp/hydra/` | MCP server custom en Python (FastMCP + WebSocket bridge) |
| `mcp/supercollider/` | Instrucciones para instalar [Tok/SuperColliderMCP](https://github.com/Tok/SuperColliderMCP) |
| `mcp/touchdesigner/` | Instrucciones para instalar [8beeeaaat/touchdesigner-mcp](https://github.com/8beeeaaat/touchdesigner-mcp) |
| `sc/` | SynthDefs de análisis y rutas OSC para SuperCollider |
| `td/` | Placeholder para proyectos `.toe` de TouchDesigner |
| `config/` | Mapa OSC canónico (fuente de verdad del protocolo) |
| `.claude/agents/` | Sub-agentes: conductor, composer, visualist, mapper |
| `.claude/skills/` | Skills: audio-reactive-viz, freq-to-params, live-mapping |
| `docs/` | Arquitectura, protocolo, material pedagógico |

## Quickstart

```bash
# 1. Instalar dependencias Python del workspace
uv sync

# 2. Arrancar el MCP de Hydra (sirve el bridge ws + la página del navegador)
uv run --directory mcp/hydra hydra-mcp

# 3. Abrir http://localhost:8765/ en el navegador

# 4. En SuperCollider, cargar:
#    sc/synthdefs/analyzer.scd
#    sc/bus/osc_routes.scd

# 5. En Claude Code, en este directorio:
claude
# /mcp debería listar supercollider, touchdesigner y hydra en verde.
```

Ver `docs/architecture.md` para el panorama completo y `docs/learning/00-overview.md` para el entorno pedagógico.
