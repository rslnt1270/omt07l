# mcp/supercollider/ — wrapper de instalación

Este directorio **no contiene un MCP server**; el MCP de SuperCollider se usa *as-is* desde el repositorio upstream:

<https://github.com/Tok/SuperColliderMCP>

## Instalación

```bash
git clone https://github.com/Tok/SuperColliderMCP.git ~/src/SuperColliderMCP
cd ~/src/SuperColliderMCP
uv sync
```

`.mcp.json` en la raíz de `omt07l` ya apunta a `${HOME}/src/SuperColliderMCP`. Si clonas en otra ruta, ajusta la clave `supercollider.args` del `.mcp.json`.

## Nota sobre el entry point

El `pyproject.toml` upstream declara un script `sc-osc` cuyo módulo (`supercollidermcp.main`) no está empaquetado — intentar ejecutar `sc-osc` directamente falla con `ModuleNotFoundError`. La invocación canónica del *MCP server* es distinta: carga `server.py` con el runner del paquete `mcp`:

```bash
uv run --directory ~/src/SuperColliderMCP mcp run server.py
```

`.mcp.json` usa exactamente esa forma. Verificado en esta sesión con un handshake JSON-RPC 2024-11-05 — `tools/list` devuelve 12 tools (`play_example_osc`, `play_melody`, `create_drum_pattern`, `play_synth`, `create_sequence`, `create_lfo_modulation`, `create_layered_synth`, `create_granular_texture`, `create_chord_progression`, `create_ambient_soundscape`, `create_generative_rhythm` y un extra).

## Requisitos

- **SuperCollider ≥ 3.13.1** con `scsynth` accesible en el PATH.
- Puerto OSC **57110** libre (default de `scsynth`).
- Python ≥ 3.12 con `uv` instalado.

## Tools que expone

Ver upstream para la lista completa. Principales:

- `play_melody`, `play_synth`, `create_sequence` — síntesis básica.
- `create_drum_pattern` — patrones rítmicos.
- `create_layered_synth`, `create_granular_texture` — texturas.
- `create_ambient_soundscape`, `create_generative_rhythm` — generativo.

## Cómo interactúa con omt07l

El MCP upstream ejecuta SynthDefs *sintetizadores*. Nosotros lo usamos como control remoto de Claude Code; el SynthDef **de análisis** (`~/Documentos/omt07l/sc/synthdefs/analyzer.scd`) se carga aparte desde `sclang` — ver `sc/sessions/00_quickstart.scd`.

Puedes disparar el analyzer también con el MCP enviando `"~/Documentos/omt07l/sc/synthdefs/analyzer.scd".load; Synth(\\omtAnalyzer);` como código arbitrario si la versión de Tok/SuperColliderMCP expone `eval`.
