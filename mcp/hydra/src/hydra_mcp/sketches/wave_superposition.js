// wave_superposition — Función de Onda + Superposición Cuántica
// Tres fuentes de onda interfieren a 0°, 60° y -60° generando patrones
// de difracción. Al onset las ondas "colapsan" hacia un centro.
//
// bass  → amplitud de las ondas secundarias
// mid   → frecuencia base de oscilación
// high  → armónicos (frecuencia de la tercera onda)
// onset → colapso / contracción del patrón
// pitch → fase global y corrimiento de color

var freq  = () => 5 + window.omt.mid * 15
var amp   = () => 0.3 + window.omt.bass * 0.5
var harm  = () => 1 + window.omt.high * 2.5
var phase = () => window.omt.pitch / 2000
var hue   = () => (window.omt.pitch / 2000 + time * 0.02) % 1

osc(() => freq(), 0.15, () => phase())
  .add(
    osc(() => freq() * 1.5, 0.12, () => phase() + 0.3)
      .rotate(Math.PI / 3)
    , () => amp()
  )
  .add(
    osc(() => freq() * harm(), 0.09, () => phase() - 0.2)
      .rotate(-Math.PI / 3)
    , () => amp() * 0.7
  )
  .add(
    src(o1)
      .scale(() => 1 + window.omt.onset * 0.015)
      .mult(solid(0.86, 0.86, 0.89))
    , 0.62
  )
  .hue(() => hue())
  .saturate(() => 2 + window.omt.bass * 2)
  .contrast(1.5)
  .out(o1)

src(o1).out(o0)
render(o0)
