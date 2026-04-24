// morph_blob.js
// Traducción de L04 "Morph blob" + L19 "Ink splotch".
// Una sola forma cerrada que respira y muta su contorno. El loader SVG
// animaba `border-radius` con feTurbulence encima; aquí usamos un shape
// sobre-modulado por dos capas de noise lento para conseguir el mismo
// tacto de "tinta viva".
//
// Mapeo:
//   bass    → tamaño + peso del blob
//   mid     → fuerza del warp (qué tan irregular es)
//   high    → micro-tembleque en el borde
//   onset   → splash: expansión rápida + deformación
//   pitch   → deriva rotacional lenta
//   clarity → gate de la nitidez

if (!window.__omtKick) {
  window.__omtKick = { v: 0 };
  setInterval(() => {
    window.__omtKick.v *= 0.85;
    if ((window.omt?.onset ?? 0) > 0.15) window.__omtKick.v = 1;
  }, 33);
}

const pitchNorm = () => {
  const o = window.omt;
  if (!o || o.clarity < 0.4) return 0;
  const p = Math.max(80, Math.min(600, o.pitch || 80));
  return (p - 80) / 520;
};

shape(
    () => 24,                                           // muchos lados → casi círculo
    () => 0.32 + (window.omt?.bass ?? 0) * 0.22 + window.__omtKick.v * 0.15,
    () => 0.05
  )
  // warp grueso y lento (mandelbrot-like blob morph)
  .modulate(
    noise(() => 0.9 + (window.omt?.mid ?? 0) * 1.8, 0.05),
    () => 0.2 + (window.omt?.mid ?? 0) * 0.35
  )
  // micro-tembleque (feDisplacementMap en el loader)
  .modulate(
    noise(() => 4 + (window.omt?.high ?? 0) * 8, 0.25),
    () => 0.02 + (window.omt?.high ?? 0) * 0.07
  )
  .scale(() => 1 + window.__omtKick.v * 0.12)
  .rotate(() => time * 0.04 + pitchNorm() * 1.2)
  .color(
    () => 0.95 + pitchNorm() * 0.4,
    () => 0.4  + (window.omt?.bass ?? 0) * 0.35,
    () => 0.22 + (window.omt?.high ?? 0) * 0.4
  )
  .contrast(() => 1 + (window.omt?.clarity ?? 0) * 0.4 + window.__omtKick.v * 0.3)
  .saturate(() => 0.8 + (window.omt?.clarity ?? 0) * 0.7)
  .out();

render(o0);
