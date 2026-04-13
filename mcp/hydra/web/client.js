// client.js — puente navegador del hydra-mcp de omt07l.
//
// - Arranca hydra-synth sobre el canvas.
// - Abre WebSocket ws://<host>/ws.
// - Recibe mensajes {op: "osc"|"eval"|"param", ...} y actualiza window.omt
//   o evalúa código Hydra en caliente.
// - Expone window.omt con las últimas métricas de audio.

(() => {
  const canvas = document.getElementById("hydra-canvas");
  const hud = document.getElementById("hud");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // eslint-disable-next-line no-undef
  const hydra = new Hydra({ canvas, detectAudio: false, makeGlobal: true });

  // Variables reactivas pobladas desde OSC
  window.omt = {
    bass: 0, mid: 0, high: 0,
    pitch: 0, clarity: 0,
    onset: 0,
    fft: [0, 0, 0, 0, 0, 0, 0, 0],
    scene: null,
  };

  // Sketch por defecto (placeholder; el MCP puede sobreescribirlo con eval_hydra)
  try {
    // eslint-disable-next-line no-undef
    osc(() => 10 + (window.omt.bass || 0) * 80, 0.1, 1)
      .kaleid(4)
      .color(0.8, 0.4, 1)
      .out();
  } catch (e) {
    console.error("sketch default fallo", e);
  }

  // WebSocket
  const wsUrl = `ws://${location.host}/ws`;
  let ws;
  let reconnectMs = 500;

  function connect() {
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      hud.textContent = `omt07l · ws connected (${wsUrl})`;
      reconnectMs = 500;
    };
    ws.onclose = () => {
      hud.textContent = `omt07l · ws closed, retry ${reconnectMs}ms`;
      setTimeout(connect, reconnectMs);
      reconnectMs = Math.min(reconnectMs * 2, 5000);
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      handle(msg);
    };
  }

  function handle(msg) {
    switch (msg.op) {
      case "osc":
        applyOsc(msg.addr, msg.args);
        break;
      case "eval":
        try {
          // eslint-disable-next-line no-eval
          (0, eval)(msg.code);
        } catch (e) {
          console.error("eval err", e, msg.code);
        }
        break;
      case "param":
        window.omt[msg.name] = msg.value;
        break;
    }
  }

  function applyOsc(addr, args) {
    switch (addr) {
      case "/omt/audio/pitch":
        window.omt.pitch = args[0] ?? 0;
        window.omt.clarity = args[1] ?? 0;
        break;
      case "/omt/audio/rms/bass":
        window.omt.bass = args[0] ?? 0;
        break;
      case "/omt/audio/rms/mid":
        window.omt.mid = args[0] ?? 0;
        break;
      case "/omt/audio/rms/high":
        window.omt.high = args[0] ?? 0;
        break;
      case "/omt/audio/onset":
        window.omt.onset = args[0] ?? 0;
        break;
      case "/omt/audio/fft/bands":
        window.omt.fft = args.slice(0, 8);
        break;
      case "/omt/control/scene":
        window.omt.scene = args[0] ?? null;
        break;
      case "/omt/control/param":
        if (typeof args[0] === "string") window.omt[args[0]] = args[1];
        break;
    }
  }

  connect();

  // HUD
  setInterval(() => {
    const o = window.omt;
    if (ws && ws.readyState === WebSocket.OPEN) {
      hud.textContent =
        `omt07l · bass ${o.bass.toFixed(2)} · mid ${o.mid.toFixed(2)} · high ${o.high.toFixed(2)} · ` +
        `pitch ${o.pitch.toFixed(0)}Hz · scene ${o.scene ?? "—"}`;
    }
  }, 200);
})();
