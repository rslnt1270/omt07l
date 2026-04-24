// metaball_orbit.js
// Traducción de L03 "Orbit goo" + L05 "Period bulbs" + L10 "Swarm".
// Células orgánicas que orbitan un núcleo y se funden entre sí (efecto
// metaball/gooey). En SVG el loader usaba feGaussianBlur + threshold; aquí
// lo emulamos con voronoi + blur/modulate sobre un osc gutural.
//
// Mapeo:
//   mid    → densidad/número de celdas (más puntos orbitando)
//   bass   → hundimiento y "goo" (blur radial)
//   high   → nitidez del borde (contrast)
//   pitch  → hue de las celdas
//   onset  → kick que dispersa el swarm y luego colapsa
//   clarity → saturación

if (!window.__omtKick) {
  window.__omtKick = { v: 0 };
  setInterval(() => {
    window.__omtKick.v *= 0.86;
    if ((window.omt?.onset ?? 0) > 0.15) window.__omtKick.v = 1;
  }, 33);
}

const pitchNorm = () => {
  const o = window.omt;
  if (!o || o.clarity < 0.4) return 0;
  const p = Math.max(80, Math.min(600, o.pitch || 80));
  return (p - 80) / 520;
};

voronoi(
    () => 8 + (window.omt?.mid ?? 0) * 35 + window.__omtKick.v * 15,
    () => 0.2 + (window.omt?.bass ?? 0) * 0.6,
    () => 0.15 + (window.omt?.high ?? 0) * 0.6
  )
  .modulateRotate(
    osc(() => 1 + (window.omt?.mid ?? 0) * 4, 0.03),
    () => 0.4 + (window.omt?.bass ?? 0) * 1.2
  )
  .modulateScale(
    noise(() => 2 + (window.omt?.high ?? 0) * 4, 0.12),
    () => (window.omt?.mid ?? 0) * 0.3
  )
  .rotate(() => time * 0.08 + pitchNorm() * 0.6)
  .color(
    () => 0.8 + pitchNorm() * 0.5,
    () => 0.3 + (window.omt?.bass ?? 0) * 0.4,
    () => 0.6 - pitchNorm() * 0.4
  )
  .contrast(() => 1.1 + (window.omt?.high ?? 0) * 1.2 + window.__omtKick.v * 0.5)
  .saturate(() => 0.7 + (window.omt?.clarity ?? 0) * 1.2)
  .out();

render(o0);
