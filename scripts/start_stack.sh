#!/usr/bin/env bash
# omt07l — start_stack: arranca el stack audiovisual en una sesión tmux.
#
# Layout:
#   Ventana "omt07l"
#     Pane 0 (izq)    → sclang sc/sessions/00_quickstart.scd
#     Pane 1 (arr-der)→ uv run --directory mcp/hydra hydra-bridge
#     Pane 2 (aba-der)→ tail de logs / shell libre
#
# Al terminar, abre http://localhost:8765/config.html en el navegador.
#
# Uso:
#   scripts/start_stack.sh            # arranca todo
#   scripts/start_stack.sh --no-open  # no abre el navegador
#   scripts/start_stack.sh --attach   # attach a la sesión tmux en vez de correr detached
#
# Prerequisitos mínimos: tmux, sclang, uv. Corré scripts/doctor.sh si algo falla.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SESSION="omt07l"
OPEN=1
ATTACH=0

for arg in "$@"; do
    case "$arg" in
        --no-open) OPEN=0 ;;
        --attach)  ATTACH=1 ;;
        -h|--help)
            sed -n '2,18p' "$0" | sed 's/^# \?//'
            exit 0
            ;;
        *)
            echo "arg desconocido: $arg" >&2
            exit 2
            ;;
    esac
done

# ── Precondiciones ───────────────────────────────────────────────────
for cmd in tmux uv sclang; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "✘ falta '$cmd' en PATH. Corré scripts/doctor.sh" >&2
        exit 1
    fi
done

port_busy() {
    # Devuelve 0 si el puerto está ocupado
    ss -tln 2>/dev/null | awk '{print $4}' | grep -qE "[.:]$1\$"
}

if port_busy 8765; then
    echo "✘ puerto 8765 ocupado (hydra_bridge_ws). ¿Hay otra instancia corriendo?" >&2
    echo "   para matarla: tmux kill-session -t $SESSION  (o fuser -k 8765/tcp)" >&2
    exit 1
fi
if port_busy 57200; then
    echo "⚠ puerto 57200 ocupado (hydra_bridge_osc). El bridge no podrá escuchar OSC." >&2
fi

if tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "✘ ya existe una sesión tmux '$SESSION'. Matala con: tmux kill-session -t $SESSION" >&2
    exit 1
fi

# ── Arranque ─────────────────────────────────────────────────────────
tmux new-session -d -s "$SESSION" -n "omt07l" -c "$ROOT" \
    "sclang sc/sessions/00_quickstart.scd"

tmux split-window -h -t "$SESSION:0" -c "$ROOT" \
    "uv run --directory mcp/hydra hydra-bridge"

tmux split-window -v -t "$SESSION:0.1" -c "$ROOT" \
    "echo 'omt07l · pane libre. tail -f ... o lo que quieras'; exec \$SHELL"

tmux select-pane -t "$SESSION:0.0"

echo "✔ stack arrancado en tmux session '$SESSION'"
echo "  attach:   tmux attach -t $SESSION"
echo "  kill:     tmux kill-session -t $SESSION"

# Esperar a que el bridge levante el puerto antes de abrir el navegador.
if [[ $OPEN -eq 1 ]]; then
    for _ in {1..40}; do
        if port_busy 8765; then
            if command -v xdg-open >/dev/null 2>&1; then
                xdg-open "http://localhost:8765/config.html" >/dev/null 2>&1 &
            elif command -v open >/dev/null 2>&1; then
                open "http://localhost:8765/config.html" >/dev/null 2>&1 &
            fi
            echo "✔ panel abierto en http://localhost:8765/config.html"
            break
        fi
        sleep 0.25
    done
fi

if [[ $ATTACH -eq 1 ]]; then
    exec tmux attach -t "$SESSION"
fi
