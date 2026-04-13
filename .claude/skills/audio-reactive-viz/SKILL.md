---
name: audio-reactive-viz
description: Recetas para mapear bandas de audio (bass/mid/high), pitch y onsets a parámetros visuales de Hydra y TouchDesigner. Usar cuando escribas sketches que deben "sentirse" con el instrumento en vivo.
---

# audio-reactive-viz

Convenciones de mapeo que funcionan bien para performances de guitarra/bajo/batería en `omt07l`.

## Reglas de mano

| Señal | Rango típico | Bueno para modular |
|---|---|---|
| `bass` | 0..0.6 en lead, 0..1 en slam | escala global, radio, grosor |
| `mid` | 0..0.5 | saturación, contraste |
| `high` | 0..0.4 (peaks) | detalle, ruido, granulado |
| `pitch` (Hz) | 80..800 | hue, rotación lenta |
| `clarity` | 0..1 | opacidad del feedback |
| `onset` | 0/1 pulso | kicks, flashes, triggers discretos |

## Patrones reutilizables (Hydra)

### Kick visual en onsets

```js
osc(20, 0.1, 1)
  .modulate(noise(3), () => (window.omt.onset ?? 0) * 0.3)
  .out()
```

### Color por pitch (Hz → hue 0..1)

```js
const hue = (hz) => ((hz - 80) / (800 - 80)) % 1;
shape(4)
  .color(() => hue(window.omt.pitch ?? 220), 0.8, 0.9)
  .out()
```

### Escala por bajo

```js
shape(3, () => 0.1 + (window.omt.bass ?? 0) * 0.5)
  .repeat(4, 4)
  .out()
```

## Antipatrones

- **No uses valores crudos sin clampear** para rotate/scale — genera saltos feos. Pasa siempre por un `smooth` (ej. `Math.min(x, 1)` o un EMA en `set_param`).
- **No modules más de 2 parámetros por la misma banda** — el resultado visual se vuelve ruido.
- **No uses `window.omt.fft[b]` directamente** sin saber a qué Hz corresponde. Las bandas son: b0=60, b1=120, b2=240, b3=480, b4=960, b5=1920, b6=3840, b7=7680.
