// julia_live.js
// Conjunto de Julia en GLSL custom. El parámetro complejo c se mueve
// con pitch y mid — más cinemático que Mandelbrot: toda la pantalla
// se deforma continuamente con la voz o guitarra.

setFunction({
  name: 'julia',
  type: 'src',
  inputs: [
    { name: 'zoom', type: 'float', default: 2.5 },
    { name: 'cx',   type: 'float', default: -0.8 },
    { name: 'cy',   type: 'float', default: 0.156 },
    { name: 'iters',type: 'float', default: 64.0 },
    { name: 'hue',  type: 'float', default: 0.0 },
  ],
  glsl: `
    vec2 z = (_st - 0.5) * zoom;
    vec2 c = vec2(cx, cy);
    float smoothN = 0.0;
    bool escaped = false;
    for (float n = 0.0; n < 256.0; n++) {
      if (n >= iters) break;
      z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
      if (dot(z,z) > 256.0) {
        smoothN = n - log2(log2(dot(z,z))) + 4.0;
        escaped = true;
        break;
      }
      smoothN = n;
    }
    float t = escaped ? smoothN / iters : 0.0;
    float h = fract(t * 1.2 + hue);
    vec3 col = 0.5 + 0.5 * cos(6.2831 * (vec3(h) + vec3(0.0, 0.4, 0.7)));
    col *= escaped ? 1.0 : 0.1;
    return vec4(col, 1.0);
  `
});

julia(
  () => 2.8 - (window.omt?.bass ?? 0) * 1.2,
  () => -0.8 + ((window.omt?.clarity ?? 0) > 0.55 ? ((window.omt?.pitch ?? 200) - 200) / 600 : 0),
  () => 0.156 + (window.omt?.mid ?? 0) * 0.2 * Math.sin(time * 0.5),
  () => 48 + (window.omt?.mid ?? 0) * 60,
  () => time * 0.03 + (window.omt?.high ?? 0) * 0.5,
)
  .modulate(noise(1.5, 0.15), () => (window.omt?.high ?? 0) * 0.02)
  .out();

render(o0);
