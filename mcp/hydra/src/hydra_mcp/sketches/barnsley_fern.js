// barnsley_fern — Fractal Cuántico
// Aproximación del helecho de Barnsley (IFS) en Hydra via capas de ruido a múltiples
// escalas. Los tres niveles corresponden a las transformaciones f2 (fronda principal),
// f3 (folíolo izquierdo) y f4 (folíolo derecho) del sistema de funciones iteradas.
//
// bass    → velocidad de crecimiento
// mid     → densidad fractal
// clarity → nitidez del borde (umbral IFS)
// onset   → expansión / bloom
// pitch   → corrimiento de tono (verde base → otros matices)

var density = () => 2 + window.omt.mid * 4
var growth  = () => 0.25 + window.omt.bass * 1.0
var sharp   = () => 0.38 + window.omt.clarity * 0.25
var bloom   = () => 1 + window.omt.onset * 0.025
var hue     = () => window.omt.pitch / 5000 + time * 0.008

// f2: fronda principal — escala 0.85, elongada verticalmente
noise(() => density(), () => growth())
  .thresh(() => sharp())
  .scale(1, 0.5, 1.85)
  .color(0.05, 0.95, 0.12)
  // f3: folíolo izquierdo — rotación +0.23 rad, desplazado a la izquierda
  .add(
    noise(() => density() * 2.2, () => growth() * 1.4)
      .thresh(() => sharp() + 0.05)
      .scale(1, 0.28, 0.82)
      .rotate(0.23)
      .scrollX(-0.12)
      .scrollY(0.08)
      .color(0.04, 0.78, 0.09)
    , 0.6
  )
  // f4: folíolo derecho — rotación -0.20 rad, desplazado a la derecha
  .add(
    noise(() => density() * 2.2, () => growth() * 1.4)
      .thresh(() => sharp() + 0.05)
      .scale(1, 0.28, 0.82)
      .rotate(-0.20)
      .scrollX(0.14)
      .scrollY(0.02)
      .color(0.06, 0.65, 0.07)
    , 0.5
  )
  .add(
    src(o1)
      .scale(() => bloom())
      .mult(solid(0.89, 0.93, 0.89))
    , 0.5
  )
  .hue(() => hue())
  .saturate(2.6)
  .contrast(1.7)
  .out(o1)

src(o1).brightness(-0.05).out(o0)
render(o0)
