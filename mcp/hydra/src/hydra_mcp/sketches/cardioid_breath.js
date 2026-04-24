// cardioid_breath.js
// Traducción del loader L01 "Cardioid" + L14 "Nested cardioids" + L19 "Splotch".
// Silueta de cardioide (corazón del conjunto de Mandelbrot) que respira con
// el bajo, con capas auto-similares rotadas y warpeadas por turbulencia lenta.
//
// Mapeo:
//   bass    → escala global + intensidad del núcleo
//   mid     → amplitud del warp turbulento
//   high    → grano de alta frecuencia en el borde
//   pitch   → rotación + saturación
//   onset   → kick que expande brevemente la forma
//   clarity → gate: bajo clarity → imagen más difusa
//
// Gramática visual de L01: respiración lenta de una silueta suave.
// Aquí la silueta nace de un shape sobre-modulado y una auto-similitud
// en dos capas escaladas (0.55× y 0.26×, como el loader original).

if (!window.__omtKick) {
  window.__omtKick = { v: 0 };
  setInterval(() => {
    window.__omtKick.v *= 0.88;
    if ((window.omt?.onset ?? 0) > 0.15) window.__omtKick.v = 1;
  }, 33);
}

const pitchNorm = () => {
  const o = window.omt;
  if (!o || o.clarity < 0.4) return 0;
  const p = Math.max(80, Math.min(600, o.pitch || 80));
  return (p - 80) / 520;
};

const base = () =>
  shape(3,
    () => 0.42 + (window.omt?.bass ?? 0) * 0.18 + window.__omtKick.v * 0.08,
    () => 0.14 + (window.omt?.mid ?? 0) * 0.12
  )
    .modulate(
      noise(() => 1.2 + (window.omt?.mid ?? 0) * 2.5, 0.08),
      () => 0.12 + (window.omt?.mid ?? 0) * 0.25
    )
    .modulate(
      osc(6, 0.02).rotate(() => time * 0.1),
      () => (window.omt?.high ?? 0) * 0.04
    )
    .rotate(() => time * 0.05 + pitchNorm() * Math.PI);

// Capa nested (L14): copia escalada y rotada en sentido contrario.
const inner = () =>
  base()
    .scale(0.55)
    .rotate(() => -time * 0.08)
    .invert()
    .luma(0.2, 0.1);

const core = () =>
  base()
    .scale(0.26)
    .rotate(() => time * 0.2)
    .color(1.1, 0.5, 0.15);

base()
  .color(
    () => 0.9 + pitchNorm() * 0.3,
    () => 0.35 + (window.omt?.bass ?? 0) * 0.3,
    () => 0.18 + (window.omt?.high ?? 0) * 0.5
  )
  .add(inner(), 0.7)
  .add(core(), 0.85)
  .saturate(() => 0.9 + (window.omt?.clarity ?? 0) * 0.6)
  .contrast(() => 1 + window.__omtKick.v * 0.4)
  .out();

render(o0);
