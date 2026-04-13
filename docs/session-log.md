# Session log — omt07l bootstrap

> Registro vivo de la sesión de bootstrap. Se va actualizando a medida que avanzan las verificaciones end-to-end.

## Estado del entorno inicial

Inspección al comienzo de la sesión de verificación:

| Herramienta | Estado inicial | Versión |
|---|---|---|
| Python | ✅ | 3.13 (miniforge) |
| Node | ✅ | v22.22.0 |
| npm / npx | ✅ | ship con Node |
| `uv` | ❌ → ✅ instalado en sesión | 0.11.6 |
| SuperCollider (`sclang`/`scsynth`) | ❌ | no instalado (bloqueante para audio real) |
| TouchDesigner | ❌ (esperado) | app gráfica, no CLI |

**Sistema**: Fedora 43 (Linux 6.19). Shell bash.

## Avances — verificaciones realizadas

### 1. `uv` instalado ✅

Instalador oficial:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Quedó en `~/.local/bin/uv` (versión 0.11.6). Hay que añadir ese directorio al `PATH` en tu shell permanente si aún no lo está:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

### 2. `uv sync` del workspace ✅

```bash
uv sync --all-packages
```

Instaló 50 paquetes y `hydra-mcp==0.1.0` en modo editable desde `mcp/hydra/`. Creó `.venv/` en la raíz del proyecto. Dependencias clave: `mcp==1.27.0`, `python-osc==1.10.2`, `websockets==16.0`, `aiohttp`, `pyyaml`.

### 3. `hydra-mcp` arranca y sirve HTTP ✅

Al arrancar el proceso completo en background, **observación importante**: el MCP en stdio salía inmediatamente con exit 0 porque el shell no mantenía stdin abierto. Para pruebas aisladas del bridge **sin** el stdio MCP, la forma canónica es:

```bash
uv run --directory mcp/hydra python -c \
  "from hydra_mcp.ws_bridge import Bridge, BridgeConfig; Bridge(BridgeConfig()).run_forever()"
```

Con el bridge aislado corriendo:

- `GET http://localhost:8765/index.html` → `200 · 695B` ✅
- `GET http://localhost:8765/client.js` → `200 · 3367B` ✅

### 4. OSC → WebSocket end-to-end ✅

Test con un script asyncio que abre un WebSocket al bridge, envía cuatro mensajes OSC sintéticos a `udp:57200` y verifica que llegan al canal ws con las direcciones canónicas:

```
mensajes recibidos por ws: 4
   {'op': 'osc', 'addr': '/omt/audio/rms/bass', 'args': [0.4199]}
   {'op': 'osc', 'addr': '/omt/audio/rms/mid', 'args': [0.1099]}
   {'op': 'osc', 'addr': '/omt/audio/pitch', 'args': [220.0, 0.9499]}
   {'op': 'osc', 'addr': '/omt/audio/fft/bands', 'args': [0.1..0.8]}
OK: todas las direcciones OSC llegaron al navegador via ws.
```

Los floats muestran precisión `float32` (normal de OSC). El router asyncio, el `Dispatcher` default-handler y el fan-out por `asyncio.run_coroutine_threadsafe` funcionan correctamente.

### 5. Handshake MCP de `hydra-mcp` (stdio) ✅

Alimenté tres mensajes JSON-RPC por stdin y verifiqué las respuestas:

- `initialize` → `serverInfo: {name:"hydra", version:"1.27.0"}`, `protocolVersion:"2024-11-05"`, capabilities correctas.
- `tools/list` → las **5 tools** registradas: `eval_hydra`, `load_sketch`, `list_sketches`, `set_param`, `bridge_status`. Cada una con `inputSchema` generado desde los type hints de Python.
- `tools/call` sobre `list_sketches` → `["default"]` (el único sketch que creamos).
- `tools/call` sobre `bridge_status` → `{clients:0, osc_messages_received:0, osc_port:57200, ws_port:8765}`.
- `tools/call` sobre `load_sketch("default")` → `"sketch 'default' cargado (226 bytes)"`.
- `tools/call` sobre `eval_hydra("osc(20).out()")` → `"enviado"`.

**Conclusión**: el MCP server es funcional y puede ser llamado por Claude Code sin modificaciones adicionales.

### 6. `Tok/SuperColliderMCP` clonado y verificado ✅

```bash
git clone --depth 1 https://github.com/Tok/SuperColliderMCP.git ~/src/SuperColliderMCP
cd ~/src/SuperColliderMCP && uv sync
```

**Hallazgo 1 (bug del upstream)**: el `pyproject.toml` declara el script `sc-osc = "supercollidermcp.main:main"`, pero el módulo `supercollidermcp/main.py` **no existe** dentro del paquete — hay un `main.py` suelto en la raíz del repo que no se empaqueta. Invocar `sc-osc` falla con `ModuleNotFoundError: No module named 'supercollidermcp.main'`.

**Solución**: la invocación canónica del *MCP server* no pasa por ese entry point. El README del upstream indica cargar `server.py` con el runner del paquete `mcp`:

```bash
uv run --directory ~/src/SuperColliderMCP mcp run server.py
```

Handshake verificado — devuelve `serverInfo: {name:"Super-Collider-OSC-MCP"}` y `tools/list` con **12 tools**: `play_example_osc`, `play_melody`, `create_drum_pattern`, `play_synth`, `create_sequence`, `create_lfo_modulation`, `create_layered_synth`, `create_granular_texture`, `create_chord_progression`, `create_ambient_soundscape`, `create_generative_rhythm` + extras.

### 7. `touchdesigner-mcp-server` verificado ✅

**Hallazgo 2 (nombre de paquete equivocado)**: el README original de `omt07l` apuntaba al paquete scoped `@8beeeaaat/touchdesigner-mcp` — ese paquete fue **unpublished** en npm el 2025-04-28. El paquete real en el registro es `touchdesigner-mcp-server` (verificado `npm view` → v1.4.7).

**Solución**: invocación correcta con `npx`:

```bash
npx -y touchdesigner-mcp-server@latest --stdio
```

El flag `--stdio` es obligatorio; sin él el proceso arranca en modo HTTP y el handshake MCP falla.

Handshake verificado sin TouchDesigner corriendo — devuelve `serverInfo: {name:"TouchDesigner", version:"1.4.7"}` y emite una notificación `notifications/message` informando que el `ConnectionManager` está listo para dirigirse a `http://127.0.0.1:9981`. Las *tool calls* fallarán hasta que TD esté escuchando ahí.

### 8. `.mcp.json` corregido ✅

Al descubrir los dos bugs anteriores (SC entry point inválido, TD npm package incorrecto), corregí `.mcp.json` en la raíz. La versión verificada:

```jsonc
{
  "mcpServers": {
    "supercollider": {
      "command": "uv",
      "args": ["run", "--directory", "${HOME}/src/SuperColliderMCP", "mcp", "run", "server.py"]
    },
    "touchdesigner": {
      "command": "npx",
      "args": ["-y", "touchdesigner-mcp-server@latest", "--stdio"]
    },
    "hydra": {
      "command": "uv",
      "args": ["run", "--directory", "mcp/hydra", "hydra-mcp"]
    }
  }
}
```

También actualicé `mcp/supercollider/README.md` y `mcp/touchdesigner/README.md` con los comandos reales y la explicación de cada hallazgo.

## Pasos bloqueados por dependencias externas

### A. Análisis real de audio con SuperCollider

Para validar `sc/synthdefs/analyzer.scd` y `sc/bus/osc_routes.scd` con señal viva hace falta:

1. **Instalar SuperCollider** — en Fedora:
   ```bash
   sudo dnf install supercollider
   ```
   (Si prefieres `sc3-plugins` para `Tartini`: `sudo dnf install supercollider-sc3-plugins`.)
2. **Conectar un instrumento** a la entrada 0 de la interfaz de audio.
3. Ejecutar `sc/sessions/00_quickstart.scd` desde la IDE de SC o con `sclang sc/sessions/00_quickstart.scd`.
4. Monitorear con `oscdump 57200` que los `/omt/audio/*` fluyen.

El SynthDef ya tiene fallback a `Pitch.kr` si no está `Tartini` — no hay bloqueo por plugins.

### B. Projection mapping en TouchDesigner

TouchDesigner es software propietario Windows/macOS. Para usarlo:

1. Abrir TD en otra máquina o en una VM.
2. Importar `mcp_webserver_base.tox` desde el release de [`8beeeaaat/touchdesigner-mcp`](https://github.com/8beeeaaat/touchdesigner-mcp/releases/latest).
3. Crear proyecto con un `OSC In CHOP` en puerto 7000.
4. Cablear NDI In TOP cuando el pipeline NDI→TD esté resuelto.

Si trabajas sólo en Linux, puedes avanzar en Fase 2 con "Hydra directo a proyector" saltándote TD por ahora.

### C. Browser test del cliente Hydra

No abrí un navegador real en la sesión (no hay display accesible desde este contexto). El `web/client.js` pasa linting estático y el HTML carga `hydra-synth@1.3.29` desde unpkg. La única forma de validar el render real es abrir `http://localhost:8765/` en Firefox/Chrome mientras corre `hydra-mcp`.

### D. Registro de `.mcp.json` en Claude Code

No se puede disparar `/mcp` desde dentro de esta sesión (ya estoy corriendo como Claude Code). Para verificar el registro:

```bash
cd ~/Documentos/omt07l
claude           # abre una sesión dentro del proyecto
# en la sesión interactiva:
/mcp             # debe listar los 3 servers en verde
```

La primera vez te pedirá aprobar los comandos de cada MCP.

## Mejoras aplicadas durante la sesión

1. **Feedback → código**: `.mcp.json` y los READMEs se corrigieron tras verificar los dos bugs de nombre/entry point. Ambos MCPs externos estaban mal documentados en el scaffolding inicial.
2. **Observación de diseño**: el `hydra-mcp` actual sólo expone stdio. Si quisieras volver a arrancar el **bridge solo** (sin MCP) para debug, no hay entry point. La receta documentada arriba (`python -c ...`) es suficiente, pero si se vuelve común convendría añadir un script `hydra-bridge` al `[project.scripts]`.
3. **Float precision**: OSC recibe `float32`; cualquier comparación en tests debe usar `math.isclose` o `pytest.approx`, no igualdad exacta.

## Mejoras sugeridas (fuera de esta sesión)

- [ ] Añadir `hydra-bridge` como entry point separado en `mcp/hydra/pyproject.toml` para poder arrancar sólo el ws bridge en CI o debug.
- [ ] Tests unitarios mínimos en `mcp/hydra/tests/` reutilizando `omt_ws_osc_test.py` para smoke tests en CI.
- [ ] Script `scripts/doctor.sh` que verifique el PATH, `uv`, `node`, la existencia de `~/src/SuperColliderMCP`, y opcionalmente `sclang`.
- [ ] Documento `docs/learning/01-primeros-pasos.md` cuando SC esté instalado, guiando al usuario por un primer ciclo audio→visual completo.
- [ ] Soporte Linux para el puente Hydra→TD (investigar `ndi-python` o `gst-plugins-nice` como alternativa).
- [ ] Opcional: reemplazar `Pitch.kr` por `Tartini.kr` con detección automática.

## Resumen

| Verificación | Estado |
|---|---|
| `uv` instalado | ✅ |
| `uv sync` workspace | ✅ |
| Bridge HTTP + ws | ✅ |
| OSC → ws end-to-end | ✅ |
| `hydra-mcp` handshake MCP | ✅ |
| `hydra-mcp` `list_sketches` / `bridge_status` / `load_sketch` / `eval_hydra` | ✅ |
| `SuperColliderMCP` clonado + handshake | ✅ |
| `touchdesigner-mcp-server` handshake | ✅ |
| `.mcp.json` corregido y documentado | ✅ |
| Audio real de SC | 🔒 requiere `sudo dnf install supercollider` |
| Render real en navegador | 🔒 requiere abrir `http://localhost:8765/` manualmente |
| TouchDesigner | 🔒 requiere máquina con TD + `mcp_webserver_base.tox` |

El **control plane** (los 3 MCPs) está 100% operativo. El **data plane** (OSC) está verificado hasta el ws; faltan sólo los extremos externos (SC para producir, TD/browser para consumir visualmente).
