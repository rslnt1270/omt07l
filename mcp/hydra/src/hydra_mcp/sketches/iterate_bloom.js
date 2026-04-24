// iterate_bloom.js
// Traducción de L20 "Iterate" + L15 "Stipple bloom".
// Campo de puntos que laten en secuencia alrededor de un núcleo central,
// evocando la iteración z → z² + c: cada celda "escapa" y vuelve. Los onsets
// disparan un bloom (expansión + brillo) que imita el momento en que las
// órbitas divergen.
//
// Mapeo:
//   bass    → tamaño del núcleo central
//   mid     → densidad del campo de puntos (pixelación)
//   high    → finura del grano (ruido de alta frecuencia)
//   pitch   → hue rotacional
//   onset   → bloom pulso (una vez por golpe)
//   fft[0..7] → modulación radial discreta (ocho sectores "periódicos")

if (!window.__omtKick) {
  window.__omtKick = { v: 0 };
  setInterval(() => {
    window.__omtKick.v *= 0.82;
    if ((window.omt?.onset ?? 0) > 0.15) window.__omtKick.v = 1;
  }, 33);
}

const pitchNorm = () => {
  const o = window.omt;
  if (!o || o.clarity < 0.4) return 0;
  const p = Math.max(80, Math.min(600, o.pitch || 80));
  return (p - 80) / 520;
};

// Agregado FFT: promedio ponderado, se siente como "intensidad espectral".
const fftEnergy = () => {
  const f = window.omt?.fft; if (!f) return 0;
  let s = 0; for (let i = 0; i < f.length; i++) s += f[i] * (1 - i * 0.05);
  return s / f.length;
};

// Núcleo: disco que late con bass + kick.
const core = () =>
  shape(60,
    () => 0.12 + (window.omt?.bass ?? 0) * 0.12 + window.__omtKick.v * 0.18,
    () => 0.02
  )
    .color(
      () => 1 + pitchNorm() * 0.3,
      () => 0.5 + (window.omt?.bass ?? 0) * 0.4,
      () => 0.2
    );

// Campo de puntos dithered (stipple bloom).
const field = () =>
  osc(() => 40 + (window.omt?.mid ?? 0) * 120, 0.04, 1)
    .pixelate(
      () => 40 + (window.omt?.mid ?? 0) * 60,
      () => 40 + (window.omt?.mid ?? 0) * 60
    )
    .mask(
      shape(60, 0.44 + window.__omtKick.v * 0.25, 0.15)
    )
    .modulate(
      noise(() => 3 + (window.omt?.high ?? 0) * 6, 0.2),
      () => 0.02 + (window.omt?.high ?? 0) * 0.06
    );

// Sectores periódicos (L17 petals / iteración z²+c con 8 "cuencas").
const sectors = () =>
  osc(2, 0.05, 1)
    .kaleid(() => 8)
    .mask(shape(60, 0.5, 0.1))
    .modulate(
      noise(0.8, 0.04),
      () => 0.08 + fftEnergy() * 0.3
    )
    .luma(0.35, 0.05)
    .color(
      () => 0.9 + pitchNorm() * 0.4,
      0.35,
      () => 0.15 + fftEnergy() * 0.4
    );

field()
  .blend(sectors(), 0.45)
  .add(core(), 0.9)
  .rotate(() => time * 0.05 + pitchNorm() * Math.PI)
  .contrast(() => 1.1 + window.__omtKick.v * 0.6)
  .saturate(() => 0.8 + (window.omt?.clarity ?? 0) * 0.6)
  .out();

render(o0);
