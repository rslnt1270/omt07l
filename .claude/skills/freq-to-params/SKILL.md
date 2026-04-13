---
name: freq-to-params
description: Utilidades para remapear rangos de audio (Hz, RMS, clarity) a rangos de parámetro visual. Usar cuando necesites convertir un valor de /omt/audio/* en una entrada numérica coherente para Hydra o TouchScript.
---

# freq-to-params

## Remapeos estándar

```js
// Hz → normal 0..1, con clamp
const pitchNorm = (hz, lo = 80, hi = 1000) =>
  Math.max(0, Math.min(1, (hz - lo) / (hi - lo)));

// RMS → gain exponencial (más pegada en volúmenes bajos)
const rmsCurve = (rms, exp = 0.6) => Math.pow(Math.max(0, rms), exp);

// EMA para suavizar señal nerviosa
const ema = (prev, x, alpha = 0.2) => prev * (1 - alpha) + x * alpha;
```

## En SuperCollider (TouchScript-like)

```supercollider
~pitchNorm = { |hz, lo=80, hi=1000| ((hz - lo) / (hi - lo)).clip(0, 1) };
```

## Cuándo usar qué

- **Pitch → hue**: lineal normalizado es suficiente.
- **RMS → escala**: aplica curva exponencial (exp≈0.6) para que un bajo fuerte no sature.
- **Onset → trigger**: no remapear, usarlo como pulso binario.
- **Clarity → opacidad/confianza**: umbral duro en 0.6 suele evitar jitter de pitch.
