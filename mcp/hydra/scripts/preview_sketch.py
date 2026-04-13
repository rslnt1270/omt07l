"""Runner standalone genérico para previsualizar cualquier sketch de Hydra.

Arranca el Bridge (HTTP+WS en 8765, OSC en 57200) sin pasar por el MCP stdio,
carga el sketch indicado al detectar un navegador conectado, y modula
`window.omt.*` con LFOs sintéticos para que el sketch reaccione sin necesidad
de audio real por OSC.

Uso:
    cd mcp/hydra
    uv run python scripts/preview_sketch.py <nombre_sketch>

Ejemplos:
    uv run python scripts/preview_sketch.py porcelain_blue_preview
    uv run python scripts/preview_sketch.py shattered_glass_preview

Vigila cambios en el archivo del sketch: si lo editas mientras el preview
está corriendo, lo re-envía automáticamente al navegador.
"""

from __future__ import annotations

import argparse
import math
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
sys.path.insert(0, str(SRC))

from hydra_mcp.ws_bridge import Bridge, BridgeConfig  # noqa: E402

SKETCHES_DIR = ROOT / "src" / "hydra_mcp" / "sketches"


def synth(t: float) -> dict:
    """LFOs sintéticos para ver el sketch respirar."""
    bass = 0.5 + 0.45 * math.sin(t * 0.8)
    mid = 0.4 + 0.35 * math.sin(t * 1.3 + 1.1)
    high = 0.3 + 0.25 * math.sin(t * 2.1 + 2.3)
    pitch = 180 + 260 * (1 + math.sin(t * 0.5)) / 2 + 260 * (1 + math.sin(t * 0.17)) / 2
    clarity = 0.5 + 0.4 * math.sin(t * 0.3)
    phase = t % 2.0
    onset = max(0.0, 1.0 - phase * 4.0)
    return {
        "bass": round(bass, 3),
        "mid": round(mid, 3),
        "high": round(high, 3),
        "pitch": round(pitch, 1),
        "clarity": round(clarity, 3),
        "onset": round(onset, 3),
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Preview standalone de un sketch Hydra")
    ap.add_argument("sketch", help="Nombre del sketch sin .js (p.ej. shattered_glass_preview)")
    args = ap.parse_args()

    path = SKETCHES_DIR / f"{args.sketch}.js"
    if not path.exists():
        available = sorted(p.stem for p in SKETCHES_DIR.glob("*.js"))
        print(f"[preview] sketch no encontrado: {args.sketch}", file=sys.stderr)
        print(f"[preview] disponibles: {', '.join(available)}", file=sys.stderr)
        sys.exit(1)

    bridge = Bridge(BridgeConfig())
    t = threading.Thread(target=bridge.run_forever, name="bridge", daemon=True)
    t.start()

    print(f"[preview] sketch: {args.sketch}", flush=True)
    print(f"[preview] abre http://localhost:8765/index.html en el navegador", flush=True)

    for _ in range(50):
        if bridge._loop is not None and bridge._outbound is not None:
            break
        time.sleep(0.05)
    else:
        print("[preview] bridge no inicializó a tiempo", file=sys.stderr)
        return

    loaded = False
    last_mtime = 0.0
    t0 = time.time()

    try:
        while True:
            n = len(bridge.state.clients)
            now = time.time() - t0

            # Detectar cambios en el archivo y re-enviar
            try:
                mtime = path.stat().st_mtime
            except FileNotFoundError:
                mtime = last_mtime

            if n > 0:
                if not loaded or mtime != last_mtime:
                    code = path.read_text(encoding="utf-8")
                    action = "cargando" if not loaded else "recargando (edit)"
                    print(f"[preview] cliente conectado — {action} ({len(code)} bytes)", flush=True)
                    bridge.send_to_browser({"op": "eval", "code": code})
                    loaded = True
                    last_mtime = mtime

                params = synth(now)
                for k, v in params.items():
                    bridge.send_to_browser({"op": "param", "name": k, "value": v})
            elif loaded:
                loaded = False

            time.sleep(1 / 30)
    except KeyboardInterrupt:
        print("\n[preview] detenido", flush=True)


if __name__ == "__main__":
    main()
