---
name: live-mapping
description: Checklist operativo para preparar una performance con omt07l — orden de arranque, verificaciones de bus OSC, setup NDI Hydra→TouchDesigner, pruebas antes de puerta. Usar antes de un ensayo o show.
---

# live-mapping

Checklist de setup previo a performance.

## 1. Orden de arranque

1. **JACK / audio device** — interfaz de audio conectada, buffer bajo (<256).
2. **SuperCollider** — `sc/sessions/00_quickstart.scd` → boot + analyzer + rutas.
3. **hydra-mcp** — `uv run --directory mcp/hydra hydra-mcp`.
4. **Navegador** — abrir `http://localhost:8765/`.
5. **TouchDesigner** — abrir `.toe`, verificar OSC In CHOP en 7000.
6. **Claude Code** — `claude` en la raíz, `/mcp` en verde los 3 servers.

## 2. Verificaciones

- [ ] `bridge_status` (MCP `hydra`) reporta >0 mensajes OSC/seg al tocar el instrumento.
- [ ] `/omt/audio/rms/bass` responde: el HUD del navegador muestra `bass > 0` cuando pulsas la 6a cuerda.
- [ ] `/omt/audio/pitch` devuelve Hz razonables (80–800) y `clarity > 0.5` sostenido.
- [ ] TouchDesigner OSC In CHOP lista los 6 canales esperados (`pitch`, `rms/{bass,mid,high}`, `onset`, `fft/bands`).
- [ ] NDI de Hydra visible en TD (NDI In TOP con framerate estable).
- [ ] Mapping geométrico calibrado sobre la superficie real (test pattern proyectado).

## 3. Antes de puerta

- [ ] Guardar estado de TD (`.toe` versionado por fecha en `td/projects/`).
- [ ] Congelar el conjunto de sketches de la performance en una lista `sketches/_performance.txt`.
- [ ] Probar transición entre primeras 2 escenas al menos una vez.

## 4. Durante la performance

- Si el bus se queda sin audio: revisar `bridge_status` — si `osc_messages_received` está congelado, reiniciar SC analyzer (`~omtAnalyzer.free; ~omtAnalyzer = Synth(\omtAnalyzer)`).
- Si Hydra se congela: recargar la pestaña del navegador, el bridge reconecta solo.
