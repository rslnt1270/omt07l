# td/projects/

Placeholder para proyectos de TouchDesigner de `omt07l`.

Los archivos `.toe` se crean y editan desde la propia UI de TouchDesigner. Cuando crees uno:

1. Guárdalo con nombre descriptivo: `omt_mapper_v1.toe`.
2. Añade un `.md` paralelo (`omt_mapper_v1.md`) documentando:
   - Qué operators principales contiene.
   - Qué direcciones OSC consume (del bus `/omt/audio/*`).
   - Cómo está cableada la entrada NDI de Hydra.
   - Calibración de mapping geométrico si aplica.
3. No lo modifiques programáticamente salvo a través del MCP `touchdesigner` y en operaciones simples (activar/desactivar contenedores, cambiar parámetros).

## Setup mínimo esperado

- `osc_in1` (OSC In CHOP) escuchando en puerto **7000**.
- `ndi_in1` (NDI In TOP) recibiendo el canvas de Hydra.
- Un `Container COMP` por escena con nombre igual al argumento de `/omt/control/scene`.
- `Execute DAT` que reacciona a `/omt/control/scene` activando el container correspondiente.
