#!/usr/bin/env bash
# omt07l — doctor: verifica que el entorno local está listo para arrancar
# los 3 MCPs, el bridge de Hydra y la cadena OSC.
#
# Uso:
#   scripts/doctor.sh            # ejecuta todas las verificaciones
#   scripts/doctor.sh --quick    # salta las más lentas (sync de venv)
#
# No muta el entorno — sólo diagnostica. Termina con código 0 si todo OK,
# 1 si hay algún fallo, y 2 si hay warnings no-fatales.

set -u

QUICK=0
[[ "${1:-}" == "--quick" ]] && QUICK=1

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

FAIL=0
WARN=0
ok()   { printf "  \033[32m✔\033[0m %s\n" "$1"; }
warn() { printf "  \033[33m⚠\033[0m %s\n" "$1"; WARN=$((WARN+1)); }
bad()  { printf "  \033[31m✘\033[0m %s\n" "$1"; FAIL=$((FAIL+1)); }
hdr()  { printf "\n\033[1m%s\033[0m\n" "$1"; }

have() { command -v "$1" >/dev/null 2>&1; }

check_cmd() {
    local cmd="$1" min_help="${2:-}"
    if have "$cmd"; then
        local v
        v="$($cmd --version 2>&1 | head -1)"
        ok "$cmd → $v"
    else
        bad "$cmd no encontrado${min_help:+ ($min_help)}"
    fi
}

port_free() {
    local p="$1"
    ! ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${p}$"
}

check_port() {
    local p="$1" role="$2"
    if port_free "$p"; then
        ok "puerto $p libre ($role)"
    else
        warn "puerto $p ocupado ($role) — proceso existente:"
        ss -ltnp 2>/dev/null | grep ":$p " | sed 's/^/      /'
    fi
}

hdr "1. Binarios base"
check_cmd uv "instala con: curl -LsSf https://astral.sh/uv/install.sh | sh"
check_cmd node "necesario para touchdesigner-mcp via npx"
check_cmd npx
if have sclang; then
    ok "sclang → $(sclang -v 2>&1 | head -1 || echo desconocido)"
else
    warn "sclang no encontrado (SuperCollider) — bloqueará Sprint B"
fi
if have gh; then check_cmd gh; else warn "gh CLI ausente (solo afecta push a GitHub)"; fi

hdr "2. Repo y workspace Python"
[[ -f pyproject.toml ]] && ok "pyproject.toml raíz" || bad "falta pyproject.toml raíz"
[[ -f .mcp.json ]] && ok ".mcp.json presente" || bad "falta .mcp.json"
[[ -f config/osc_map.yaml ]] && ok "config/osc_map.yaml (fuente de verdad OSC)" || bad "falta config/osc_map.yaml"
[[ -d mcp/hydra ]] && ok "mcp/hydra/ presente" || bad "falta mcp/hydra/"
[[ -d sc/synthdefs ]] && ok "sc/synthdefs/ presente" || bad "falta sc/synthdefs/"

if (( QUICK == 0 )); then
    hdr "3. Venv sincronizado (uv sync --all-packages)"
    if have uv; then
        if uv sync --all-packages >/tmp/doctor_uv.log 2>&1; then
            ok "uv sync --all-packages OK"
        else
            bad "uv sync falló — ver /tmp/doctor_uv.log"
        fi
    fi
else
    hdr "3. Venv (saltado por --quick)"
fi

hdr "4. Entry points de hydra-mcp"
if [[ -d .venv ]]; then
    for ep in hydra-mcp hydra-bridge; do
        if [[ -x .venv/bin/$ep ]]; then
            ok "$ep ejecutable en .venv/bin/"
        else
            warn "$ep no ejecutable aún (corre: uv sync --all-packages)"
        fi
    done
    # Verifica que el módulo importa sin arrancar nada (detecta imports rotos)
    if .venv/bin/python -c "import hydra_mcp.ws_bridge, hydra_mcp.server" 2>/tmp/doctor_import.err; then
        ok "hydra_mcp importable"
    else
        bad "hydra_mcp import falló — ver /tmp/doctor_import.err"
    fi
fi

hdr "5. Puertos"
check_port 8765  "hydra ws-bridge"
check_port 57200 "hydra osc-in"
check_port 57110 "scsynth"
check_port 57120 "sclang"
check_port 7000  "touchdesigner osc-in"
check_port 9981  "touchdesigner webserver (MCP)"

hdr "6. MCP servers externos"
if [[ -d "${HOME}/src/SuperColliderMCP" ]]; then
    ok "SuperColliderMCP clonado en \$HOME/src/"
    [[ -f "${HOME}/src/SuperColliderMCP/server.py" ]] \
        && ok "server.py presente" \
        || bad "server.py falta en SuperColliderMCP"
else
    warn "SuperColliderMCP no clonado (git clone https://github.com/Tok/SuperColliderMCP \$HOME/src/SuperColliderMCP)"
fi
if have npx; then
    if timeout 3 npx --yes --quiet touchdesigner-mcp-server@latest --help >/dev/null 2>&1; then
        ok "touchdesigner-mcp-server reachable vía npx"
    else
        warn "touchdesigner-mcp-server no probado (primera ejecución puede ser lenta)"
    fi
fi

hdr "7. Tests"
if (( QUICK == 0 )) && have uv && [[ -d mcp/hydra/tests ]]; then
    if (cd mcp/hydra && uv run --quiet pytest -q >/tmp/doctor_pytest.log 2>&1); then
        ok "pytest pasó ($(grep -Eo '[0-9]+ passed' /tmp/doctor_pytest.log || echo ok))"
    else
        bad "pytest falló — ver /tmp/doctor_pytest.log"
    fi
else
    warn "pytest saltado"
fi

hdr "Resumen"
printf "  errores: %d, warnings: %d\n" "$FAIL" "$WARN"
if (( FAIL > 0 )); then exit 1; fi
if (( WARN > 0 )); then exit 2; fi
exit 0
