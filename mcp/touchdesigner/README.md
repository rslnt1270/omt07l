# mcp/touchdesigner/ — wrapper de instalación

Este directorio **no contiene un MCP server**; se usa *as-is* desde npm.

- Repositorio: <https://github.com/8beeeaaat/touchdesigner-mcp>
- Paquete real en npm: **`touchdesigner-mcp-server`** (el nombre scoped `@8beeeaaat/touchdesigner-mcp` fue *unpublished* el 2025-04-28 — no lo uses).

## Instalación

No requiere clonar nada. `.mcp.json` en la raíz de `omt07l` lo invoca directamente vía `npx`:

```jsonc
"touchdesigner": {
  "command": "npx",
  "args": ["-y", "touchdesigner-mcp-server@latest", "--stdio"]
}
```

`npx` descarga el paquete la primera vez (verificado en esta sesión, v1.4.7).

El flag `--stdio` es **obligatorio**: sin él el server intenta arrancar en modo HTTP y el handshake MCP de Claude Code falla.

Si TouchDesigner escucha en una dirección distinta a `http://127.0.0.1:9981` (default), añade `--host` y `--port` al array de `args`.

## Requisitos

- **Node ≥ 18** (probado con Node 22.22).
- **TouchDesigner** abierto con el proyecto `.toe` que tenga cargado `mcp_webserver_base.tox` (descarga `touchdesigner-mcp-td.zip` del último release de `8beeeaaat/touchdesigner-mcp`).
- WebServer DAT corriendo en la instancia de TD.

El MCP arranca sin TD — el handshake `initialize` responde con el log `Server connected and ready to process requests: http://127.0.0.1:9981` — pero cualquier *tool call* fallará hasta que TD esté realmente escuchando en ese endpoint.

## Cómo interactúa con omt07l

El MCP permite a Claude Code (vía el sub-agente `mapper`) operar sobre el `.toe` abierto. En `omt07l` lo usamos específicamente para:

1. **Configurar el `OSC In CHOP`** en puerto 7000 y verificar que los canales `/omt/audio/*` llegan.
2. **Cambiar la composición activa** cuando el `conductor` emite `/omt/control/scene`.
3. **Leer el estado** de operators críticos (NDI In TOP, Projector Out) antes de performance.

Los `.toe` se editan desde TouchDesigner — no generes proyectos binarios automáticamente. Documenta cambios estructurales en un `.md` paralelo dentro de `td/projects/`.
