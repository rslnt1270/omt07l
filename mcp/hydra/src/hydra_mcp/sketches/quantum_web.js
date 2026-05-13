// quantum_web — Entrelazamiento Cuántico
// Red de ~800 partículas con trails, inspirada en caos.hypatia.systems
// Atractor de Lorenz aproximado via campo de ruido + feedback con deriva
// Paleta neón: rosa #ff0066 / cian #00ff88 / azul #0066ff / naranja #ffaa00
//
// bass  → velocidad de órbita / drift rotacional
// mid   → densidad de partículas
// high  → destello / sparkle entre nodos
// onset → explosión radial
// pitch → rotación de matiz

var hue   = () => (window.omt.pitch / 2000 + time * 0.018) % 1
var count = () => 6 + Math.floor(window.omt.mid * 14)
var spark = () => 0.4 + window.omt.high * 2.8
var burst = () => 1 + window.omt.onset * 0.022
var drift = () => window.omt.bass * 0.007

src(o1)
  .scale(() => burst())
  .rotate(() => drift())
  .mult(solid(0.87, 0.87, 0.9))
  .add(
    voronoi(() => count(), 0.12, () => spark())
      .hue(() => hue())
      .saturate(3.2)
      .brightness(0.08)
    , 0.32
  )
  .contrast(1.5)
  .out(o1)

src(o1).brightness(-0.04).out(o0)
render(o0)
