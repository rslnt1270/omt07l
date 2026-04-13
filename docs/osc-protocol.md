# Protocolo OSC — omt07l

> La fuente de verdad es **`config/osc_map.yaml`**. Este documento es una vista legible.

## Puertos

| Puerto | Rol |
|---|---|
| 57110 | `scsynth` (audio server de SC) |
| 57120 | `sclang` (lenguaje de SC, OSC de control) |
| 57200 | Entrada del `hydra-bridge` (Python, `ws_bridge.py`) |
| 7000  | Entrada OSC de TouchDesigner (`OSC In CHOP`) |
| 8765  | WebSocket del `hydra-bridge` (browser ↔ Python) |

## Namespace

Todo bajo `/omt/`:

- `/omt/audio/*` — features de audio derivadas del instrumento (origen: SC).
- `/omt/control/*` — mensajes de control de alto nivel (origen: Claude / conductor).
- `/omt/_reply/*` — internos de SC, no viajan al bus. Son los `SendReply.kr` que `osc_routes.scd` consume y re-emite con los addresses canónicos.

## Direcciones

### `/omt/audio/pitch`

| Arg | Tipo | Rango | Fuente |
|---|---|---|---|
| `freq` | float | 20–2000 Hz | `Pitch.kr` / `Tartini.kr` |
| `clarity` | float | 0..1 | confianza del pitch |

### `/omt/audio/rms/{bass,mid,high}`

| Arg | Tipo | Rango | Fuente |
|---|---|---|---|
| `level` | float | 0..1 | `Amplitude.kr` sobre banda filtrada |

Bandas: `bass` = LPF 200 Hz · `mid` = BPF 1 kHz · `high` = HPF 4 kHz.

### `/omt/audio/onset`

| Arg | Tipo | Rango | Fuente |
|---|---|---|---|
| `strength` | float | 0..1 | `Onsets.kr(FFT(...))`, impulso cuando detecta ataque |

### `/omt/audio/fft/bands`

| Arg | Tipo | Rango |
|---|---|---|
| `b0..b7` | float ×8 | 0..1 |

Bandas centradas en `[60, 120, 240, 480, 960, 1920, 3840, 7680]` Hz.

### `/omt/control/scene`

| Arg | Tipo |
|---|---|
| `name` | string |

Emitido por Claude / el sub-agente `conductor` para sincronizar un cambio de escena entre SC, Hydra y TD.

### `/omt/control/param`

| Arg | Tipo |
|---|---|
| `key` | string |
| `value` | float |

Parámetro arbitrario clave/valor. Hydra lo propaga a `window.omt[key] = value`.

## Cómo añadir una dirección

1. Editar `config/osc_map.yaml` (fuente de verdad).
2. Actualizar `sc/bus/osc_routes.scd` si el origen es SC.
3. Actualizar `mcp/hydra/web/client.js` (función `applyOsc`) si un consumidor es Hydra.
4. Actualizar `.claude/agents/visualist.md` si añade una variable a `window.omt`.
5. Regenerar la sección de este documento.
