// default.js — sketch mínimo que reacciona al bajo.
// window.omt.bass se actualiza desde /omt/audio/rms/bass (via ws_bridge).

osc(() => 10 + (window.omt?.bass ?? 0) * 80, 0.1, 1)
  .kaleid(4)
  .color(0.8, 0.4, 1)
  .out()
