# Setup en Windows — omt07l

Guía para clonar `omt07l` en el dualboot Windows y dejar operativos los 3 MCPs + SuperCollider + TouchDesigner + Hydra en el navegador.

Repositorio privado: <https://github.com/rslnt1270/omt07l>

## 1. Prerequisitos (una sola vez)

Instala estos componentes desde PowerShell (preferentemente con `winget`):

```powershell
winget install --id Git.Git -e
winget install --id GitHub.cli -e
winget install --id astral-sh.uv -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id SuperCollider.SuperCollider -e
# TouchDesigner: descarga manual desde https://derivative.ca/download (no está en winget)
```

Verifica versiones (abre **una terminal nueva** después de instalar):

```powershell
git --version
gh --version
uv --version
node --version
# sclang y scsynth entran en el PATH con SuperCollider; si no, añade
# "C:\Program Files\SuperCollider-3.13.x" al PATH del usuario.
```

Navegador moderno (Firefox o Chrome) para la UI de Hydra.

## 2. Clonar el repositorio

Autentícate en GitHub (OAuth en navegador):

```powershell
gh auth login
# GitHub.com  ·  HTTPS  ·  Login with a web browser
```

Clona en la carpeta que prefieras (recomendado: `%USERPROFILE%\Documentos\omt07l`):

```powershell
cd $env:USERPROFILE\Documentos
gh repo clone rslnt1270/omt07l
cd omt07l
```

Configura tu identidad git local si hace falta:

```powershell
git config user.name "rslnt1270"
git config user.email "y.ortega.316197595@gmail.com"
```

## 3. Instalar el MCP de Hydra (custom)

Desde la raíz del repo:

```powershell
uv sync --all-packages
```

Esto crea `.venv\` con `hydra-mcp`, `mcp`, `python-osc`, `websockets` y `aiohttp` (~50 paquetes).

Prueba que arranca:

```powershell
uv run --directory mcp\hydra hydra-mcp
```

Verás que el proceso se queda esperando input por stdin (eso es normal — es un MCP stdio server). Mátalo con **Ctrl+C**. Una vez registrado en Claude Code lo lanzará automáticamente.

Mientras lo matas, en otra terminal puedes comprobar que el bridge HTTP funciona:

```powershell
# En otra ventana, con el hydra-mcp todavía arrancado
curl http://localhost:8765/index.html
```

Debe devolver el HTML con el canvas.

## 4. Instalar SuperColliderMCP (externo)

Clona el repo upstream fuera de `omt07l`:

```powershell
mkdir $env:USERPROFILE\src -ErrorAction SilentlyContinue
cd $env:USERPROFILE\src
git clone https://github.com/Tok/SuperColliderMCP.git
cd SuperColliderMCP
uv sync
```

**Importante**: el entry point `sc-osc` declarado en su `pyproject.toml` está **roto** (bug upstream, módulo inexistente). No lo uses. El comando correcto es `mcp run server.py` y así está en `.mcp.json`.

## 5. Ajustar `.mcp.json` para Windows

El `.mcp.json` del repo fue escrito para Linux y usa `${HOME}/src/SuperColliderMCP`. En Windows **esa expansión no funciona en todos los contextos** — conviene sustituirla por la ruta absoluta real.

Abre `.mcp.json` en el editor y deja la sección `supercollider` así (reemplaza `<tu-user>`):

```jsonc
"supercollider": {
  "command": "uv",
  "args": [
    "run",
    "--directory",
    "C:\\Users\\<tu-user>\\src\\SuperColliderMCP",
    "mcp",
    "run",
    "server.py"
  ]
}
```

**No hagas commit de esa ruta** — es específica de tu máquina. Puedes marcarla como cambio local ignorado:

```powershell
git update-index --skip-worktree .mcp.json
```

Si más adelante quieres volver a trackearlo: `git update-index --no-skip-worktree .mcp.json`.

## 6. TouchDesigner MCP

No requiere clonar nada — se instala vía `npx` la primera vez que Claude Code lo lance. Pero sí necesitas preparar el lado de TouchDesigner:

1. Descarga `touchdesigner-mcp-td.zip` del último release de [`8beeeaaat/touchdesigner-mcp`](https://github.com/8beeeaaat/touchdesigner-mcp/releases/latest).
2. Extrae y copia `mcp_webserver_base.tox` a tu carpeta de proyectos de TD.
3. Abre TouchDesigner y arrastra `mcp_webserver_base.tox` dentro de tu proyecto.
4. Verifica que el WebServer DAT escucha en `http://127.0.0.1:9981` (puerto default; se puede cambiar con `--host`/`--port` en `.mcp.json`).
5. Añade también un `OSC In CHOP` escuchando en puerto **7000** para recibir los `/omt/audio/*` del bus canónico.

## 7. SuperCollider — analyzer

Abre SuperCollider IDE. Desde la carpeta del repo:

```supercollider
"sc/sessions/00_quickstart.scd".load
```

Este script hace el boot del server, carga `analyzer.scd` y `osc_routes.scd`, y crea `~omtAnalyzer`. Si el audio input por defecto no es el que quieres, cambia el argumento `\in`:

```supercollider
~omtAnalyzer.free;
~omtAnalyzer = Synth(\omtAnalyzer, [\in, 1, \amp, 1.0]);  // canal 1 en vez de 0
```

**Verificación**: toca un acorde grave; en la terminal donde corre `hydra-mcp`, el navegador `http://localhost:8765/` debe mostrar el HUD con `bass > 0`.

## 8. Arrancar Claude Code

En la raíz de `omt07l`:

```powershell
claude
```

Dentro de la sesión:

```
/mcp
```

Los tres servers deben aparecer en verde: `supercollider`, `touchdesigner`, `hydra`. La primera vez Claude Code te pedirá aprobar cada comando.

Si alguno aparece en rojo, revisa los logs:

```powershell
# Windows no tiene ubicación estándar única, pero Claude Code imprime
# errores en stderr al cargar el MCP. Ejecuta el comando manualmente:
uv run --directory mcp\hydra hydra-mcp
```

## 9. Primera escena colaborativa

Con audio real entrando y el navegador abierto, pide al orquestador:

```
@conductor prepara escena "intro-suave"
```

Debería delegar a `composer` (patch SC suave), `visualist` (sketch tenue) y `mapper` (TD), y emitir `/omt/control/scene intro-suave` por el bus.

## 10. Flujo de trabajo cross-platform

- **Cambios creativos** (sketches, SynthDefs, palettes): commit desde cualquiera de los dos dualboots y push.
- **No commitees**: `.venv\`, `.claude\settings.local.json`, rutas absolutas en `.mcp.json`, `Backup\` de TouchDesigner.
- **Sincronización**: antes de cada sesión, `git pull`. Antes de cerrar la sesión, `git push`.
- **Ramas**: para experimentos grandes (ej. un nuevo sketch complejo o un refactor del analyzer) trabaja en rama separada — `git checkout -b feature/nombre`.

## Troubleshooting rápido

| Síntoma | Causa probable | Arreglo |
|---|---|---|
| `/mcp` en rojo para `hydra` | `.venv` no sincronizado | `uv sync --all-packages` |
| `/mcp` en rojo para `supercollider` | Ruta absoluta mal escrita en `.mcp.json` | Verifica `C:\Users\...\src\SuperColliderMCP\server.py` existe |
| `/mcp` en rojo para `touchdesigner` | Node no está en PATH / TD sin tox cargado | `node --version` + abre TD y arrastra `mcp_webserver_base.tox` |
| HUD del navegador en 0 | SC no está emitiendo | `~omtAnalyzer.isRunning` en sclang; reinicia el Synth |
| TouchDesigner no ve OSC | Puerto 7000 ocupado o firewall | `netstat -an | findstr 7000`; Windows Defender puede bloquear UDP |
| `uv run` falla con "no matching python" | Python no instalado / versión incorrecta | `winget install Python.Python.3.12` |
