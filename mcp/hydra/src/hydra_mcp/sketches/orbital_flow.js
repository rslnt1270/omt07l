// orbital_flow — Órbita Coherente
// Anillos concéntricos con velocidades orbitales distintas que se intersectan
// y crean figuras de Lissajous cuando clarity es alto
//
// bass    → velocidad orbital
// mid     → número de anillos activos
// clarity → enfoque (anillos nítidos vs difusos)
// onset   → pulso radial
// pitch   → espectro de color

var speed  = () => 0.25 + window.omt.bass * 1.2
var rings  = () => 3 + window.omt.mid * 8
var focus  = () => 0.05 + (1 - window.omt.clarity) * 0.4
var pulse  = () => 1 + window.omt.onset * 0.03
var hue    = () => (window.omt.pitch / 2000 + time * 0.015) % 1

shape(() => rings(), 0.75, () => focus())
  .rotate(() => time * speed() * 0.08)
  .add(
    shape(() => rings() * 0.7, 0.5, () => focus())
      .rotate(() => -time * speed() * 0.05)
    , 0.6
  )
  .add(
    shape(() => rings() * 0.4, 0.3, () => focus())
      .rotate(() => time * speed() * 0.13)
    , 0.4
  )
  .mult(
    voronoi(() => 3 + window.omt.mid * 4, 0.04, 0.2)
      .thresh(0.35)
  )
  .add(
    src(o1)
      .scale(() => pulse())
      .mult(solid(0.92, 0.92, 0.94))
    , 0.65
  )
  .hue(() => hue())
  .saturate(2.2)
  .contrast(1.5)
  .out(o1)

src(o1).brightness(-0.03).out(o0)
render(o0)
