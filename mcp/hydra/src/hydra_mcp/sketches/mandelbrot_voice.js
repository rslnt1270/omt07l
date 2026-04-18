// mandelbrot_voice.js
// Fractal de Mandelbrot en GLSL custom, afinado para voz y guitarra.
// El pitch (80-400 Hz) barre la frontera del cardioide; el bass hunde el
// zoom; los onsets sacuden el parámetro complejo. Gate con clarity>0.55
// para ignorar ruido de fondo.
//
// Mapeo:
//   omt.pitch + omt.clarity  → zoom y cx (solo si clarity>0.55)
//   omt.bass                 → zoom extra
//   omt.mid                  → cy + iteraciones (detalle)
//   omt.high                 → grano sutil por modulate
//   omt.onset                → "kick" que perturba cy

setFunction({
  name: 'mandel',
  type: 'src',
  inputs: [
    { name: 'zoom',  type: 'float', default: 2.5 },
    { name: 'cx',    type: 'float', default: -0.75 },
    { name: 'cy',    type: 'float', default: 0.0 },
    { name: 'iters', type: 'float', default: 48.0 },
    { name: 'hue',   type: 'float', default: 0.0 },
  ],
  glsl: `
    vec2 uv = (_st - 0.5) * zoom + vec2(cx, cy);
    vec2 z = vec2(0.0);
    float smoothN = 0.0;
    bool escaped = false;
    for (float n = 0.0; n < 256.0; n++) {
      if (n >= iters) break;
      z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + uv;
      if (dot(z, z) > 256.0) {
        smoothN = n - log2(log2(dot(z, z))) + 4.0;
        escaped = true;
        break;
      }
      smoothN = n;
    }
    float t = escaped ? smoothN / iters : 0.0;
    float h = fract(t * 1.5 + hue);
    vec3 col = 0.5 + 0.5 * cos(6.2831 * (vec3(h) + vec3(0.0, 0.33, 0.67)));
    col *= escaped ? 1.0 : 0.05;
    return vec4(col, 1.0);
  `
});

window.__omtPitchNorm = () => {
  const o = window.omt;
  if (!(o && o.clarity > 0.55)) return 0;
  const p = Math.max(80, Math.min(400, o.pitch || 80));
  return (p - 80) / 320;
};

if (!window.__omtKickInterval) {
  window.__omtKick = 0;
  window.__omtKickInterval = setInterval(() => {
    window.__omtKick *= 0.9;
    if ((window.omt?.onset ?? 0) > 0.15) window.__omtKick = 1;
  }, 33);
}

mandel(
  () => 2.8 - window.__omtPitchNorm() * 1.8 - (window.omt?.bass ?? 0) * 0.8,
  () => -0.75 + window.__omtPitchNorm() * 0.45 + (window.omt?.mid ?? 0) * 0.05 * Math.sin(time * 0.3),
  () => 0.0 + (window.omt?.mid ?? 0) * 0.25 + window.__omtKick * 0.15 * Math.sin(time * 2.0),
  () => 32 + (window.omt?.mid ?? 0) * 80 + (window.omt?.high ?? 0) * 40,
  () => window.__omtPitchNorm() * 0.7 + time * 0.02,
)
  .rotate(() => time * 0.03 + (window.omt?.bass ?? 0) * 0.1)
  .modulate(noise(2, 0.1), () => (window.omt?.high ?? 0) * 0.015)
  .kaleid(() => 2 + Math.round((window.omt?.mid ?? 0) * 3))
  .out();

render(o0);
