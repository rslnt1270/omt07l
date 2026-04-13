# Proyecto: omt07l

Entorno de live coding audiovisual. Claude Code orquesta SuperCollider, Hydra y TouchDesigner vía MCP.

## Principios operativos

- **La fuente de verdad del protocolo OSC es `config/osc_map.yaml`.** Cualquier dirección, puerto o tipo de argumento debe leerse/actualizarse ahí antes de tocar `sc/`, `mcp/hydra/` o `td/`.
- **Delega a sub-agentes cuando la tarea sea de dominio claro**: composición/síntesis → `composer` (SC), visuales → `visualist` (Hydra), mapping/composición final → `mapper` (TouchDesigner). Si la petición cruza dominios, usa `conductor`.
- **No reimplementes lo que ya existe**: `Tok/SuperColliderMCP` y `8beeeaaat/touchdesigner-mcp` se instalan como dependencias externas; solo documentamos el cableado en `mcp/supercollider/` y `mcp/touchdesigner/`.
- **Control plane vs data plane**: las herramientas MCP son para *control* (arrancar/parar/enviar código). Los datos de audio en tiempo real viajan exclusivamente por OSC — no intentes tunelar audio por MCP.

## Variables disponibles en sketches Hydra

El cliente `mcp/hydra/web/client.js` expone `window.omt` con los valores más recientes recibidos del bus OSC:

```
window.omt.bass   // 0..1   (banda baja, RMS)
window.omt.mid    // 0..1   (banda media, RMS)
window.omt.high   // 0..1   (banda alta, RMS)
window.omt.pitch  // Hz     (Tartini)
window.omt.clarity// 0..1   (confianza del pitch)
window.omt.onset  // 0..1   (fuerza del último onset)
window.omt.fft    // [b0..b7] bandas logarítmicas
```

## Puertos OSC (resumen — ver `config/osc_map.yaml` para detalle)

| Puerto | Rol |
|---|---|
| 57110 | scsynth |
| 57120 | sclang |
| 57200 | entrada del hydra-bridge (desde SC) |
| 7000  | entrada OSC de TouchDesigner |
| 8765  | WebSocket del hydra-bridge (browser) |

## Al modificar código

- **Python (`mcp/hydra/`)**: usar `uv` para gestionar dependencias; FastMCP como framework; python-osc para OSC.
- **SuperCollider (`sc/`)**: `SynthDef` con `SendReply.kr` y un `OSCdef` en `osc_routes.scd` que re-emite a los destinos canónicos.
- **Hydra (`mcp/hydra/src/hydra_mcp/sketches/`)**: usar `window.omt.*`; cada sketch es código Hydra plano (no módulo ES) — `load_sketch` lo lee como texto y lo envía al navegador con `eval`. Debe terminar con una llamada a `render()`.
- **TouchDesigner**: documentar cambios en `td/` pero los `.toe` se editan desde TD — no los generes automáticamente.

## Fuera de alcance por ahora

Contenido creativo final (sketches definitivos, SynthDefs de performance, proyecto TD completo), persistencia de sesiones, CI/CD, empaquetado a PyPI.
