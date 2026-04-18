// voronoi_cells.js
// Células orgánicas que laten con mid y se colorean con pitch.
// Bueno para pasajes rítmicos con punteo articulado.

voronoi(() => 5 + (window.omt?.mid ?? 0) * 40, 0.3, () => (window.omt?.bass ?? 0) * 2)
  .color(
    () => 0.5 + (window.omt?.high ?? 0),
    0.4,
    () => 0.8 - (window.omt?.bass ?? 0) * 0.5
  )
  .modulate(osc(10, 0.1), () => (window.omt?.mid ?? 0) * 0.3)
  .rotate(() => time * 0.05)
  .saturate(() => 1 + (window.omt?.bass ?? 0) * 2)
  .out();

render(o0);
