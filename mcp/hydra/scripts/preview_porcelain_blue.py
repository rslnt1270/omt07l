"""Runner standalone para previsualizar `porcelain_blue_preview.js`.

Arranca el Bridge (HTTP+WS en 8765, OSC en 57200) sin pasar por el MCP stdio.
Cuando detecta que un navegador se ha conectado al /ws:
  1. Le envía el sketch `porcelain_blue_preview` vía `send_to_browser({"op":"eval"})`.
  2. Entra en un bucle que modula `window.omt.bass/mid/high/pitch/onset` con valores
     sintéticos para que el sketch reaccione sin necesidad de audio real por OSC.

Uso:
    cd mcp/hydra
    uv run python scripts/preview_porcelain_blue.py

Ctrl-C para detener. Si SuperCollider está emitiendo OSC en 57200 los valores
reales tienen prioridad sobre los sintéticos (el cliente procesa ambos eventos;
la simulación solo pisa lo que llega si llega menos frecuente).
"""

from __future__ import annotations

import math
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
sys.path.insert(0, str(SRC))

from hydra_mcp.ws_bridge import Bridge, BridgeConfig  # noqa: E402

SKETCH = ROOT / "src" / "hydra_mcp" / "sketches" / "porcelain_blue_preview.js"


def main() -> None:
    code = SKETCH.read_text(encoding="utf-8")
    bridge = Bridge(BridgeConfig())

    t = threading.Thread(target=bridge.run_forever, name="bridge", daemon=True)
    t.start()

    print(f"[preview] bridge arrancando, abre http://localhost:8765/ en el navegador", flush=True)

    # Esperar a que el bridge esté listo (el loop asyncio se inicializa al vuelo)
    for _ in range(50):
        if bridge._loop is not None and bridge._outbound is not None:
            break
        time.sleep(0.05)
    else:
        print("[preview] bridge no inicializó a tiempo", file=sys.stderr)
        return

    loaded = False
    t0 = time.time()

    # Valores de modulación (simulación). Cambia las frecuencias/fases a gusto.
    def synth(t: float) -> dict:
        # LFOs lentos para ver el sketch respirar.
        bass = 0.5 + 0.45 * math.sin(t * 0.8)
        mid = 0.4 + 0.35 * math.sin(t * 1.3 + 1.1)
        high = 0.3 + 0.25 * math.sin(t * 2.1 + 2.3)
        # Pitch recorre 180–700 Hz sinusoidal.
        pitch = 180 + 260 * (1 + math.sin(t * 0.5)) / 2 + 260 * (1 + math.sin(t * 0.17)) / 2
        clarity = 0.5 + 0.4 * math.sin(t * 0.3)
        # Onset: pulso corto cada ~2s.
        phase = (t % 2.0)
        onset = max(0.0, 1.0 - phase * 4.0)
        return {
            "bass": round(bass, 3),
            "mid": round(mid, 3),
            "high": round(high, 3),
            "pitch": round(pitch, 1),
            "clarity": round(clarity, 3),
            "onset": round(onset, 3),
        }

    try:
        while True:
            n = len(bridge.state.clients)
            now = time.time() - t0

            if n > 0 and not loaded:
                print(f"[preview] cliente conectado — cargando sketch ({len(code)} bytes)", flush=True)
                bridge.send_to_browser({"op": "eval", "code": code})
                loaded = True

            if n > 0:
                params = synth(now)
                for k, v in params.items():
                    bridge.send_to_browser({"op": "param", "name": k, "value": v})
            elif loaded:
                # Cliente se desconectó — permitir recarga en la próxima conexión.
                loaded = False

            time.sleep(1 / 30)  # 30 Hz de envíos de parámetros
    except KeyboardInterrupt:
        print("\n[preview] detenido", flush=True)


if __name__ == "__main__":
    main()
