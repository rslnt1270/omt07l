// porcelain_blue_preview.js
// Primer vistazo de la paleta porcelain_blue reaccionando al audio.
// Espejo de config/palettes/porcelain_blue.yaml.
//
// Mapeo:
//   bass    → escala del fractal coral
//   mid     → opacidad de la capa ink-wash
//   high    → microdetalle
//   onset   → pulso de pincelada
//   pitch   → posición en la rampa cobalt
//   clarity → nitidez del vidriado

// Helpers de audio con defaults seguros.
var _a = () => window.omt || {};
var _bass    = () => (_a().bass    ?? 0);
var _mid     = () => (_a().mid     ?? 0);
var _high    = () => (_a().high    ?? 0);
var _onset   = () => (_a().onset   ?? 0);
var _clarity = () => (_a().clarity ?? 0.5);
var _pitch   = () => (_a().pitch   ?? 220);

// Rampa cobalto: índice 0..1 según pitch (220–880 Hz ≈ ink→wash).
var _cidx = () => Math.max(0, Math.min(1, (_pitch() - 220) / 660));
var _lerp = (a, b, t) => a + (b - a) * t;
var _cr = () => _lerp(0.118, 0.427, _cidx());
var _cg = () => _lerp(0.243, 0.541, _cidx());
var _cb = () => _lerp(0.471, 0.659, _cidx());

// --- Capa 0: fondo porcelana inmutable --------------------------------------
solid(0.902, 0.910, 0.906)
  .add(noise(2.2, 0.05).luma(0.48, 0.08), 0.04)
  .add(
    gradient(0).luma(0.4, 0.2).mult(solid(0.788, 0.820, 0.831)),
    0.25
  )
  .out(o1);

// --- Capa 1: coral fractal (voronoi multiescala) ----------------------------
voronoi(() => 4 + _bass() * 10, () => 0.2 + _onset() * 0.6, 0.3)
  .modulate(voronoi(() => 10 + _bass() * 18, 0.1, 0.2), 0.08)
  .add(voronoi(() => 28 + _high() * 40, 0.05, 0.1), 0.35)
  .thresh(() => 0.55 - _clarity() * 0.15, 0.02)
  .color(_cr, _cg, _cb)
  .out(o2);

// --- Capa 2: ink-wash cobalto -----------------------------------------------
noise(() => 1.6 + _mid() * 2, 0.08)
  .modulate(noise(() => 4 + _onset() * 6, 0.3), () => 0.12 + _onset() * 0.25)
  .thresh(() => 0.52 - _mid() * 0.15, 0.04)
  .color(0.055, 0.122, 0.290)
  .out(o3);

// --- Composición final ------------------------------------------------------
src(o1)
  .blend(src(o2), () => 0.55 + _bass() * 0.25)
  .mult(src(o3).luma(0.5, 0.1).invert(), () => 0.55 + _mid() * 0.35)
  .add(
    shape(4, 0.95, 0.4).invert().mult(solid(0.659, 0.714, 0.761)),
    0.12
  )
  .out(o0);

render(o0);
