// escape_rings.js
// Traducción de los loaders L02 "Escape rings" + L07 "Banded core".
// Anillos concéntricos que laten hacia afuera como un campo de escape-time,
// con bandas radiales moduladas por las 8 bandas FFT de SuperCollider.
//
// Mapeo:
//   bass    → velocidad de expansión de los anillos
//   mid     → anchura/frecuencia de las bandas
//   high    → warp sutil de borde (edge jitter)
//   onset   → pulso global (brillo + apertura)
//   fft[0..7] → teñido sobre anillos específicos (vía kaleid + repeatX)
//   pitch   → rotación global

if (!window.__omtKick) {
  window.__omtKick = { v: 0 };
  setInterval(() => {
    window.__omtKick.v *= 0.9;
    if ((window.omt?.onset ?? 0) > 0.15) window.__omtKick.v = 1;
  }, 33);
}

const pitchNorm = () => {
  const o = window.omt;
  if (!o || o.clarity < 0.4) return 0;
  const p = Math.max(80, Math.min(600, o.pitch || 80));
  return (p - 80) / 520;
};

// fft promedio aproximado de las 4 bandas graves vs agudas (hace brillar
// anillos internos cuando hay energía grave, externos cuando hay agudos).
const fftLow  = () => {
  const f = window.omt?.fft; if (!f) return 0;
  return (f[0] + f[1] + f[2] + f[3]) / 4;
};
const fftHigh = () => {
  const f = window.omt?.fft; if (!f) return 0;
  return (f[4] + f[5] + f[6] + f[7]) / 4;
};

// Banda radial base — osc a baja frecuencia, rotada hasta parecer anillos.
osc(
    () => 18 + (window.omt?.mid ?? 0) * 50 + window.__omtKick.v * 20,
    () => 0.02 + (window.omt?.bass ?? 0) * 0.25,
    () => 0.6 + pitchNorm() * 0.8
  )
  .kaleid(() => 12 + Math.round((window.omt?.mid ?? 0) * 24))
  .modulate(
    noise(() => 1.4 + (window.omt?.high ?? 0) * 3, 0.08),
    () => 0.02 + (window.omt?.high ?? 0) * 0.06
  )
  .scale(() => 1 - window.__omtKick.v * 0.18)
  .color(
    () => 0.95 + fftHigh() * 0.5,
    () => 0.4  + fftLow()  * 0.5,
    () => 0.12 + fftHigh() * 0.6
  )
  .rotate(() => time * 0.06 + pitchNorm() * Math.PI)
  .contrast(() => 1.2 + window.__omtKick.v * 0.6)
  .out();

render(o0);
