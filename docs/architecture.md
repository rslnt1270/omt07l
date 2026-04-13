# Arquitectura — omt07l

## Resumen en una frase

Claude Code orquesta tres herramientas creativas (SuperCollider, Hydra, TouchDesigner) a través de **MCP** como plano de control y **OSC** como plano de datos, para construir performances audiovisuales reactivas al instrumento en vivo.

## Diagrama

```
   ┌─────────────┐   audio in (JACK)    ┌──────────────────┐
   │ Instrumento │─────────────────────▶│  SuperCollider   │
   │ (guitarra,  │                      │  analyzer.scd    │
   │  bajo, etc) │                      │  (Tartini/FFT)   │
   └─────────────┘                      └────────┬─────────┘
                                                 │ OSC  /omt/audio/*
                      ┌──────────────────────────┼──────────────────────────┐
                      ▼                          ▼                          ▼
            ┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
            │   Hydra (browser) │      │  TouchDesigner    │      │   Claude Code     │
            │  vía ws_bridge.py │      │  OSC In CHOP :7000│      │  observa/orquesta │
            └─────────┬─────────┘      └─────────▲─────────┘      └─────────┬─────────┘
                      │ NDI (video)             │                           │
                      └─────────────────────────┘                           │ MCP (stdio)
                                                                            │
                      ┌─────────────────────────────────────────────────────┤
                      ▼                      ▼                              ▼
            ┌──────────────────┐   ┌──────────────────┐           ┌───────────────────┐
            │ supercollider-mcp│   │ touchdesigner-mcp│           │   hydra-mcp       │
            │ (Tok, Python)    │   │ (8beeeaaat, Node)│           │ (custom, Python)  │
            └──────────────────┘   └──────────────────┘           └───────────────────┘
```

## Planos

### Control plane — MCP

Tres servers registrados en `.mcp.json`. Claude Code los habla por stdio. Sirven para *iniciar, parar, evaluar código, cambiar presets* — operaciones discretas y tipificadas. **Nunca** los uses para transportar audio o streams de datos en tiempo real.

| Server | Origen | Lenguaje | Responsabilidad |
|---|---|---|---|
| `supercollider` | `Tok/SuperColliderMCP` (externo) | Python / FastMCP | Enviar código a sclang, arrancar SynthDefs |
| `touchdesigner` | `8beeeaaat/touchdesigner-mcp` (externo) | Node | Operar el `.toe` abierto |
| `hydra` | `mcp/hydra/` (interno) | Python / FastMCP | Evaluar Hydra en el navegador vía ws |

### Data plane — OSC

Un solo bus UDP con direcciones canónicas definidas en `config/osc_map.yaml`. **SuperCollider es el único productor de datos de audio**: aplica Tartini, RMS filtrado y FFT a la señal del instrumento y envía los resultados a ~30 Hz.

Los consumidores son Hydra (vía el WebSocket bridge del hydra-mcp) y TouchDesigner (vía su OSC In CHOP). Los datos fluyen *hacia afuera* de SC — nada vuelve al analizador.

### Video — NDI

El canvas de Hydra se captura con una utilidad NDI en Linux (GStreamer + `ndi-python` o equivalente) y se introduce en TouchDesigner como NDI In TOP. TD lo compone con sus propias capas y hace el mapping geométrico.

Este camino es **fuera de alcance** en esta iteración: se documenta el punto de conexión, pero no se implementa el pipeline NDI. En performances iniciales puedes proyectar Hydra directamente y añadir TD cuando el NDI esté listo.

## Sub-agentes y skills

Los sub-agentes `.claude/agents/*.md` dividen responsabilidades por dominio (composer → SC, visualist → Hydra, mapper → TD) y el `conductor` coordina. Las skills `.claude/skills/*/SKILL.md` son recetas transversales (mapeos audio→parámetro, checklist de setup).

La ventaja operativa: pides al conductor "escena intro suave" y él descompone en sub-tareas por dominio sin que tengas que recordar el cableado completo.

## Protocolo de escena

Una "escena" es un trío coherente (sonido + visuales + mapping). Se dispara emitiendo `/omt/control/scene <name>` por el bus; cada herramienta reacciona según su implementación (SC carga un patch, Hydra un sketch, TD una composición). El naming convention es kebab-case con prefijo de intención: `intro-suave`, `drop-kaleid`, `outro-pitch`.

## Decisiones clave

- **Python, no Node, para el custom MCP**: homogeneidad con `Tok/SuperColliderMCP` y acceso directo a `python-osc`.
- **OSC en vez de WebRTC/WebSocket puro**: es el lenguaje nativo de SC y TD, y el navegador sólo necesita un bridge ligero.
- **SuperCollider como analizador único**: evita duplicar DSP en Python y aprovecha Tartini, FFT y Onsets ya optimizados.
- **Sketches Hydra versionados en `sketches/`**: permiten re-carga en caliente y revisión como código normal.
