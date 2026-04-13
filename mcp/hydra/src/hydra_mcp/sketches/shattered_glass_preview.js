// shattered_glass_preview.js
// Vidrio fragmentado radial sobre fondo cálido desenfocado.
// Aprendizaje del porcelain_blue_preview: usamos máscaras de luma y blends
// entre solid() explícitos, no .color() (que solo multiplica el source).

// ── audio helpers ──────────────────────────────────────────────────────────
var _a = () => window.omt || {};
var _bass    = () => (_a().bass    ?? 0);
var _mid     = () => (_a().mid     ?? 0);
var _high    = () => (_a().high    ?? 0);
var _onset   = () => (_a().onset   ?? 0);
var _clarity = () => (_a().clarity ?? 0.5);
var _pitch   = () => (_a().pitch   ?? 220);

// ── capa 0 · fondo cálido desenfocado ──────────────────────────────────────
// Mezcla de dos tonos marrones con falloff radial y bounce sutil.
// El fondo se mantiene casi fijo; solo respira con bass (±10% brillo).
solid(0.227, 0.125, 0.059) // bg_wood_mid
  .blend(
    solid(0.420, 0.243, 0.110),  // bg_wood_warm
    shape(100, 0.9, 0.8).invert() // radial darkening mask (1 centro → 0 bordes)
  )
  .add(noise(1.2, 0.02).luma(0.5, 0.3), 0.03)
  .mult(solid(1, 1, 1), () => 0.95 + _bass() * 0.1)
  .out(o1);

// ── capa 1 · tessellation de esquirlas (máscara luma) ──────────────────────
// Usamos voronoi + kaleid para aproximar el sunburst radial.
// pitch rota el sunburst; bass infla la escala.
var _fragMask = () =>
  voronoi(
    () => 8 + _bass() * 12,
    () => 0.25 + _onset() * 0.5,
    () => 0.2 + _clarity() * 0.3
  )
    .kaleid(() => 12 + Math.floor(_high() * 6))
    .rotate(() => (_pitch() - 220) / 400)
    .modulate(noise(0.8, 0.05), 0.05); // rompe la simetría perfecta del kaleid

// Construcción del color de las esquirlas:
//   base  = shard_shadow (oscuro frío)
//   body  = shard_body   (mezcla según máscara del interior de cada celda)
//   hi    = shard_highlight (en bordes, high luma del voronoi)
var _shardLayer = solid(0.180, 0.196, 0.227) // shard_shadow
  .blend(solid(0.549, 0.573, 0.604), _fragMask().luma(0.15, 0.05))   // body
  .blend(solid(0.706, 0.741, 0.769), _fragMask().luma(0.45, 0.05))   // cool
  .blend(solid(0.910, 0.925, 0.937), _fragMask().luma(0.75, 0.03));  // highlight

_shardLayer.out(o2);

// ── capa 2 · hairlines (grietas) ────────────────────────────────────────────
// Bordes afilados del voronoi, aislados con thresh alto y producto.
// clarity define qué tan nítidas aparecen.
voronoi(() => 8 + _bass() * 12, 0.02, 0.9)
  .kaleid(() => 12 + Math.floor(_high() * 6))
  .rotate(() => (_pitch() - 220) / 400)
  .thresh(() => 0.92 - _clarity() * 0.1, 0.01)
  .invert()
  .out(o3);

// ── capa 3 · catchlights (puntos brillantes aleatorios) ─────────────────────
// Ruido de alta frecuencia con thresh altísimo — solo algunos píxeles saltan.
// high/onset controlan cuántos aparecen.
noise(() => 80 + _high() * 40, () => 0.5 + _onset() * 0.8)
  .thresh(() => 0.92 - _mid() * 0.08, 0.005)
  .out(o0);
// o0 será sobrescrito en la composición final; usamos buffer temporal por via indirecta.

// ── composición final ──────────────────────────────────────────────────────
// Orden: fondo → máscara radial del "rostro" → esquirlas dentro → hairlines → especulares
//
// La "silueta" es una forma ovalada simple — no intenta ser un rostro. El
// objetivo de este preview es validar material y color, no iconografía.
var _faceMask = shape(120, () => 0.55 + _onset() * 0.03, 0.1)
  .scale(1, 0.8, 1) // aplastar verticalmente para sugerir cabeza en perfil
  .rotate(0.05);

src(o1)
  // Pegar las esquirlas solo dentro de la máscara facial
  .blend(src(o2), _faceMask)
  // Sobreponer las grietas negras multiplicativamente (oscurecen solo bordes)
  .mult(src(o3).add(solid(0.5, 0.5, 0.5), 0.5))
  // Añadir catchlights sobre la zona del rostro
  .add(
    noise(() => 80 + _high() * 40, () => 0.5 + _onset() * 0.8)
      .thresh(() => 0.94 - _mid() * 0.08, 0.005)
      .mult(_faceMask), // recortar a la silueta
    () => 0.6 + _mid() * 0.4
  )
  .out(o0);

render(o0);
