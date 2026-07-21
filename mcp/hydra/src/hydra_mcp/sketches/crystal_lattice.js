// crystal_lattice — Red Cristalina
// Interferencia Moiré entre dos redes de osciladores en proporción áurea (φ=1.618)
// El patrón oscila entre caos cristalino y orden geométrico con el audio
//
// bass  → disrupción / ruido en la red
// mid   → orden cristalino (frecuencia de la rejilla)
// onset → onda de choque que expande la red
// pitch → corrimiento espectral de color

var order = () => 4 + window.omt.mid * 8
var disrupt = () => window.omt.bass * 1.6
var hue   = () => (window.omt.pitch / 3000 + time * 0.012) % 1
var shock = () => 1 + window.omt.onset * 0.026

osc(() => order(), 0.08, () => disrupt())
  .rotate(Math.PI / 6)
  .mult(
    osc(() => order() * 1.618, 0.06, () => disrupt() * 0.6)
      .rotate(-Math.PI / 6)
  )
  .add(
    src(o1)
      .scale(() => shock())
      .mult(solid(0.9, 0.9, 0.88))
    , 0.72
  )
  .hue(() => hue())
  .saturate(2.6)
  .contrast(1.65)
  .out(o1)

src(o1).out(o0)
render(o0)
