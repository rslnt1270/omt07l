// liquid_feedback.js
// Se alimenta de su propio output anterior: cada onset rompe la
// estabilidad y el feedback crea trails líquidos. Ideal para
// ambient o reverb largo.

noise(() => 4 + (window.omt?.bass ?? 0) * 20, 0.2)
  .color(
    () => (window.omt?.clarity ?? 0),
    () => (window.omt?.mid ?? 0) * 2,
    1
  )
  .modulate(src(o0).rotate(0.02), () => 0.3 + (window.omt?.onset ?? 0) * 0.7)
  .blend(o0, () => 0.85 - (window.omt?.onset ?? 0) * 0.3)
  .out();

render(o0);
