# Guía de pruebas — omt07l

Este documento es la referencia única para clonar `omt07l` en una PC nueva (Linux o Windows), dejar los 3 MCPs operativos y ejecutar una sesión de prueba real con un instrumento conectado. Complementa a [`windows-setup.md`](windows-setup.md) (específico de Windows) y a [`architecture.md`](architecture.md) (explicación del diseño).

> **Público**: alguien (tú, en otro dualboot; o un colaborador) que nunca ha arrancado el proyecto en esa máquina. Al terminar debe tener: audio en vivo analizado por SuperCollider, visuales Hydra reaccionando en el navegador, y los 3 MCPs verdes en Claude Code.

## 0. Resumen del flujo

```
[Instrumento] → [Interfaz de audio] → [SuperCollider analyzer.scd]
                                              │
                                              │ OSC /omt/audio/*
                                              ▼
              ┌─────────────────────┬─────────────────────┐
              ▼                     ▼                     ▼
       [hydra-bridge]         [TouchDesigner]        [Claude Code]
       :8765 ws/http           :7000 OSC In            (observa)
              │
              ▼
         [Navegador]
       http://localhost:8765/
       window.omt.{bass,mid,high,pitch,onset,fft}
```

**Control plane** (MCPs, stdio JSON-RPC): Claude Code ↔ `hydra-mcp`, `supercollider-mcp`, `touchdesigner-mcp`.
**Data plane** (UDP/WebSocket): audio en tiempo real — nunca pasa por MCP.

---

## 1. Prerrequisitos (una sola vez por máquina)

### 1.1 Linux (Fedora / Arch / Ubuntu)

```bash
# Fedora
sudo dnf install -y git gh nodejs supercollider supercollider-devel
curl -LsSf https://astral.sh/uv/install.sh | sh   # uv en ~/.local/bin

# Arch
sudo pacman -S git github-cli nodejs supercollider uv

# Ubuntu/Debian
sudo apt install -y git gh nodejs npm supercollider supercollider-dev
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Verifica:

```bash
git --version && gh --version && node --version && uv --version
sclang -v && which scsynth
```

Opcional (pero recomendado para análisis más fino): `sc3-plugins` — da acceso a `Tartini`, `MLR`, etc. Si no está en tus repos base, el analyzer cae a `Pitch.kr` nativo sin romperse.

```bash
# Fedora (RPM Fusion)
sudo dnf install -y supercollider-sc3-plugins
```

TouchDesigner (sólo si harás mapping real): descarga manual desde <https://derivative.ca/download> — no está en repos de paquetes.

### 1.2 Windows

Ver [`windows-setup.md`](windows-setup.md) — tiene instrucciones específicas con `winget`, paths `C:\Users\...` y troubleshooting de firewall UDP.

---

## 2. Clonar el repositorio

Autentícate en GitHub (sólo primera vez — OAuth en navegador):

```bash
gh auth login
# GitHub.com · HTTPS · Login with a web browser
```

Clona:

```bash
# Linux
cd ~/Documentos
gh repo clone rslnt1270/omt07l
cd omt07l

# Windows (PowerShell)
cd $env:USERPROFILE\Documentos
gh repo clone rslnt1270/omt07l
cd omt07l
```

Configura tu identidad git si es la primera vez en esta máquina:

```bash
git config user.name "rslnt1270"
git config user.email "y.ortega.316197595@gmail.com"
```

---

## 3. Instalar el MCP de Hydra (Python workspace)

Desde la raíz del repo:

```bash
uv sync --all-packages --group dev
```

Esto crea `.venv/` con:
- `hydra-mcp` (nuestro paquete editable)
- `mcp[cli]`, `python-osc`, `websockets`, `aiohttp`, `pyyaml` (runtime)
- `pytest`, `pytest-asyncio` (dev)

**Entry points disponibles tras el sync**:
- `.venv/bin/hydra-mcp` — MCP server stdio + ws bridge (lo lanza Claude Code).
- `.venv/bin/hydra-bridge` — solo el ws bridge, standalone, para tests/debug sin MCP cliente.

---

## 4. Instalar SuperColliderMCP (externo)

No está en el workspace — se instala como clon separado. Upstream: [`Tok/SuperColliderMCP`](https://github.com/Tok/SuperColliderMCP).

```bash
mkdir -p ~/src
cd ~/src
git clone https://github.com/Tok/SuperColliderMCP.git
cd SuperColliderMCP
uv sync
```

> **Importante**: el entry point `sc-osc` declarado en su `pyproject.toml` está roto (bug upstream, módulo `supercollidermcp.main` inexistente). **No lo uses**. El comando correcto es `uv run --directory ~/src/SuperColliderMCP mcp run server.py`, y así está en nuestro `.mcp.json`.

En Windows, la ruta a `SuperColliderMCP` en `.mcp.json` tiene que ser absoluta (`C:\Users\<user>\src\SuperColliderMCP`) porque `${HOME}` no expande en todos los contextos. Ver sección 5 de `windows-setup.md`.

---

## 5. TouchDesigner MCP (opcional para prueba sin mapping)

Sólo hace falta si vas a usar TD como compositor/mapper final. Para una primera prueba con guitarra + Hydra puedes saltar esta sección.

1. Descarga `touchdesigner-mcp-td.zip` del último release de [`8beeeaaat/touchdesigner-mcp`](https://github.com/8beeeaaat/touchdesigner-mcp/releases/latest).
2. Copia `mcp_webserver_base.tox` a tu carpeta de proyectos de TD.
3. Abre TouchDesigner y arrastra el `.tox` dentro de tu proyecto.
4. Verifica que el WebServer DAT escucha en `http://127.0.0.1:9981`.
5. Añade un `OSC In CHOP` escuchando puerto **7000** para recibir `/omt/audio/*`.

El binario del MCP se baja automáticamente vía `npx` la primera vez que Claude Code lo lance.

---

## 6. Diagnóstico: `scripts/doctor.sh`

**Antes de arrancar cualquier cosa**, ejecuta el doctor — verifica 7 secciones en <10s:

```bash
# Linux
bash scripts/doctor.sh          # full (incluye uv sync y pytest)
bash scripts/doctor.sh --quick  # rápido (salta sync y pytest)
```

Códigos de salida:
- `0` → todo verde
- `1` → errores fatales (falta un binario, import roto, puerto muerto)
- `2` → warnings (p.ej. sclang no instalado, puerto ocupado por proceso propio)

Secciones que verifica:

| # | Sección | Qué comprueba |
|---|---|---|
| 1 | Binarios base | `uv`, `node`, `npx`, `sclang`, `gh` |
| 2 | Repo y workspace | `pyproject.toml`, `.mcp.json`, `config/osc_map.yaml`, `mcp/hydra/`, `sc/synthdefs/` |
| 3 | Venv sincronizado | `uv sync --all-packages` pasa sin error |
| 4 | Entry points hydra-mcp | `hydra-mcp` y `hydra-bridge` ejecutables + módulo `hydra_mcp` importa |
| 5 | Puertos | 8765, 57200, 57110, 57120, 7000, 9981 libres |
| 6 | MCPs externos | `~/src/SuperColliderMCP/server.py` existe; `touchdesigner-mcp-server` se puede invocar vía `npx` |
| 7 | Tests | `pytest -q` del paquete `mcp/hydra` pasa |

Si el doctor da verde (exit 0 o 2 con sólo sclang warning si no vas a usar audio), estás listo.

---

## 7. Prueba 1: solo hydra-bridge (sin Claude Code, sin SC)

Valida que el bridge arranca, sirve el HTML y reenvía OSC a un cliente WebSocket. Esta prueba no necesita SuperCollider ni instrumento.

### 7.1 Arranca el bridge

```bash
uv run --directory mcp/hydra hydra-bridge
```

Verás:

```
======== Running on http://0.0.0.0:8765 ========
```

Déjalo corriendo. Para pararlo limpio: `Ctrl+C` (maneja SIGINT/SIGTERM vía asyncio nativo; cierra puerto correctamente).

### 7.2 Abre el navegador

```
http://localhost:8765/
```

Debe cargar un canvas Hydra con un sketch default. En la consola del navegador (F12) deberías ver:

```
[omt] ws conectado
```

### 7.3 Envía un mensaje OSC sintético

En otra terminal:

```bash
uv run python - <<'PY'
from pythonosc.udp_client import SimpleUDPClient
c = SimpleUDPClient("127.0.0.1", 57200)
c.send_message("/omt/audio/rms/bass", 0.8)
c.send_message("/omt/audio/pitch", [220.0, 0.95])
PY
```

En la consola del navegador deberías ver ambos mensajes (el cliente loguea cada OSC recibido).

### 7.4 Corre la suite de tests

```bash
cd mcp/hydra
uv run pytest -v
```

Debería dar `4 passed`.

---

## 8. Prueba 2: audio real con SuperCollider

### 8.1 Conecta tu interfaz

- Enchufa la guitarra a tu interfaz de audio (ej. focusrite, zoom, direct box).
- Verifica a nivel sistema operativo que la interfaz se ve y que el canal por el que entra la guitarra **está activo** (`pavucontrol` en Linux, ajustes de sonido en Windows).
- Anota el número de canal — por defecto el analyzer usa canal `0`.

### 8.2 Arranca hydra-bridge (si no está)

```bash
uv run --directory mcp/hydra hydra-bridge
```

Y abre `http://localhost:8765/` en el navegador.

### 8.3 Arranca SuperCollider

Abre **SuperCollider IDE** (`scide` en Linux, desde el menú de inicio en Windows). **Abre el directorio del repo como current directory** (desde IDE: `File → Open Startup File` y verifica el cwd, o simplemente abre cualquier archivo `.scd` del repo — eso fija el cwd relativo).

Ejecuta:

```supercollider
"sc/sessions/00_quickstart.scd".load
```

Esto hace:

1. `s.waitForBoot` — arranca `scsynth` en puerto 57110.
2. Carga `sc/synthdefs/analyzer.scd` — define el `SynthDef(\omtAnalyzer)`.
3. Carga `sc/bus/osc_routes.scd` — instala los `OSCdef` que re-emiten los `SendReply.kr` del analyzer como `/omt/audio/*` a `127.0.0.1:57200` (hydra-bridge) y `127.0.0.1:7000` (TouchDesigner).
4. Instancia `~omtAnalyzer = Synth(\omtAnalyzer, [\in, 0, \amp, 1.0])`.

Al final imprime:

```
omt07l · listo. Toca algo en la entrada 0.
```

Si tu guitarra entra por otro canal (ej. canal 1 en una interfaz con pad activado):

```supercollider
~omtAnalyzer.free;
~omtAnalyzer = Synth(\omtAnalyzer, [\in, 1, \amp, 1.0]);
```

### 8.4 Verifica que llegan los `/omt/audio/*`

**Opción A — monitor OSC en terminal** (mientras tocas):

```bash
# Linux: oscdump viene con liblo-tools
sudo dnf install -y liblo-tools  # Fedora
oscdump 57200
```

Pulsa una cuerda grave — deberías ver un torrente de:

```
/omt/audio/rms/bass  ,f  0.34
/omt/audio/rms/mid   ,f  0.12
/omt/audio/rms/high  ,f  0.04
/omt/audio/pitch     ,ff 82.41 0.91
/omt/audio/onset     ,f  0.78
/omt/audio/fft/bands ,ffffffff 0.1 0.3 ...
```

Si **no** ves nada:
- ¿`~omtAnalyzer.isRunning`? (evaluar en SC IDE)
- ¿El canal es el correcto? Prueba con `\in, 1, 2, 3, ...`
- ¿scsynth ve la interfaz? `s.options.inDevice.postln` — debería mostrar tu interfaz.
- Firewall en Windows puede bloquear UDP 57200 local (raro pero pasa).

**Opción B — HUD en el navegador**:

En `http://localhost:8765/` la página debe mostrar (o actualizar `window.omt.*`) los valores en tiempo real. Toca una cuerda y verifica visualmente que `bass` pulsa.

### 8.5 Prueba interactiva con Hydra

Con el browser abierto, en la consola:

```javascript
osc(() => window.omt.bass * 100 + 5, 0.1, () => window.omt.high).out()
```

La frecuencia espacial del `osc()` debe pulsar con graves y su contraste con agudos. Si responde, **el pipeline audio→visual funciona end-to-end**.

---

## 9. Prueba 3: Claude Code + MCPs

### 9.1 Arranca Claude Code en la raíz del repo

```bash
cd omt07l
claude
```

### 9.2 Verifica los MCPs

Dentro de la sesión:

```
/mcp
```

Debe listar 3 servers en verde:

- `supercollider` — vía `uv run --directory ~/src/SuperColliderMCP mcp run server.py`
- `touchdesigner` — vía `npx -y touchdesigner-mcp-server@latest --stdio`
- `hydra` — vía `uv run --directory mcp/hydra hydra-mcp`

Si alguno está en rojo:

| MCP | Causa probable | Fix |
|---|---|---|
| `hydra` | venv no sync | `uv sync --all-packages --group dev` |
| `supercollider` | ruta `${HOME}/src/SuperColliderMCP` no expande (Windows) | sustituye por ruta absoluta en `.mcp.json` |
| `touchdesigner` | node no está en PATH / firewall bloqueó npx | `node --version`; primera ejecución es lenta (descarga paquete) |

> **En Windows** puedes marcar `.mcp.json` como skip-worktree para no commitear tu ruta absoluta:
> ```powershell
> git update-index --skip-worktree .mcp.json
> ```

### 9.3 Prueba un sub-agente

Dentro de Claude Code:

```
@visualist crea un sketch simple que reacciona a window.omt.bass con osc() y kaleid(). Guárdalo como "test-bass.js" en mcp/hydra/src/hydra_mcp/sketches/ y cárgalo.
```

El sub-agente `visualist` debe:

1. Escribir `mcp/hydra/src/hydra_mcp/sketches/test-bass.js`.
2. Llamar al tool `load_sketch("test-bass")` del MCP `hydra`.
3. El navegador debe mostrar el sketch inmediatamente.

Si tocas una cuerda grave, el sketch debe pulsar. Ese es el **loop cerrado completo**: instrumento → SC → OSC → bridge → browser → Hydra → pixels, controlado por Claude Code → sub-agente → MCP → tool.

### 9.4 Prueba el orquestador

```
@conductor prepara una escena "intro-suave" con un sketch tenue en Hydra
```

`conductor` debe delegar a `visualist` (sketch tenue) y emitir `/omt/control/scene intro-suave` por el bus (o pedir al `composer` una base SC suave, depende de su implementación actual).

---

## 10. Checklist de prueba completa

Antes de decir "listo para show":

- [ ] `bash scripts/doctor.sh` devuelve exit 0 o 2 (sólo warning sclang si no vas a usar audio)
- [ ] `http://localhost:8765/` carga canvas Hydra y muestra "ws conectado"
- [ ] `oscdump 57200` muestra `/omt/audio/*` al tocar el instrumento
- [ ] `window.omt.bass` cambia visiblemente en consola al tocar
- [ ] `/mcp` en Claude Code muestra los 3 servers verdes
- [ ] `@visualist` puede escribir y cargar un sketch
- [ ] SIGINT (`Ctrl+C`) cierra `hydra-bridge` sin dejar el puerto 8765 ocupado
- [ ] `~omtAnalyzer.free; ~omtAnalyzer = Synth(\omtAnalyzer, [\in, N])` permite cambiar canal sin reiniciar SC

---

## 11. Troubleshooting rápido

| Síntoma | Causa probable | Arreglo |
|---|---|---|
| `hydra-bridge` → `[Errno 98] Address already in use` | Bridge previo no cerró | `pkill -TERM -f hydra-bridge` o matar proceso en `:8765` |
| `uv sync` → "no matching python" | Python <3.12 | Instala 3.12+; `uv python install 3.12` |
| `pytest` cuelga | Fixture `bridge` no arrancó — puerto bloqueado | Reinicia la terminal; `ss -ltn \| grep 8765` |
| `oscdump` no muestra nada | SC emitiendo a destino equivocado, o canal de audio inactivo | `s.options.inDevice.postln`; verifica `osc_routes.scd` apunta a 127.0.0.1:57200 |
| Navegador "ws conectado" pero `window.omt` no cambia | OSC llega al bridge pero el cliente JS no lo parsea | F12 → consola → busca errores en `client.js` |
| `/mcp` en rojo para `hydra` | `.venv` no sync o import roto | `bash scripts/doctor.sh` — la sección 4 debe decir `hydra_mcp importable` |
| `/mcp` en rojo para `supercollider` | `${HOME}` no expande en Windows | Reemplaza por ruta absoluta en `.mcp.json` |
| `/mcp` en rojo para `touchdesigner` | Node no en PATH; primera descarga lenta | `node --version`; espera 30s tras el primer `/mcp` |
| Tartini no carga en SC (`ERROR: Class not defined`) | `sc3-plugins` no instalado | Instala `sc3-plugins`, o pídeme un parche a `Pitch.kr` |
| HUD del browser muestra 0 aunque tocas | `\amp` del analyzer muy bajo, o ganancia de interfaz a cero | `~omtAnalyzer.set(\amp, 3.0)`; verifica ganancia en mixer del SO |
| Signal de guitarra audible pero `onset` nunca dispara | Umbral de `Onsets.kr` muy alto | Editar `sc/synthdefs/analyzer.scd` y bajar `threshold:` |

---

## 12. Flujo de trabajo cross-platform

Entre sesiones en distintas máquinas:

```bash
# Al empezar
git pull

# Al acabar
git status
git add <archivos-reales>  # no .venv, no .claude/settings.local.json, no rutas absolutas
git commit -m "..."
git push
```

**No commitees jamás**:
- `.venv/`, `.uv/`, `uv.lock` (ignorados)
- `.claude/settings.local.json` (permisos específicos de máquina)
- `.mcp.json` si lo editaste con rutas Windows absolutas → marca `skip-worktree`
- `Backup/`, `*.toe.bak` (archivos de TouchDesigner)

**Ramas para experimentos grandes**: `git checkout -b feature/nombre` — nuevos sketches complejos, refactor del analyzer, prueba de otro pitch tracker, etc.

---

## 13. Referencias rápidas

- [`architecture.md`](architecture.md) — diseño: control plane vs data plane, decisiones.
- [`osc-protocol.md`](osc-protocol.md) — tabla canónica de direcciones OSC.
- [`config/osc_map.yaml`](../config/osc_map.yaml) — fuente de verdad del protocolo (los docs la referencian, no al revés).
- [`CLAUDE.md`](../CLAUDE.md) — reglas de colaboración con Claude Code en este repo.
- [`windows-setup.md`](windows-setup.md) — pasos específicos de Windows (`winget`, paths `C:\`, firewall UDP).
- [`session-summary.md`](session-summary.md) — resumen ejecutivo de la última sesión.
