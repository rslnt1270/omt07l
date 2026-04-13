# 00 · Overview — ¿qué es omt07l y por qué tres herramientas?

Este documento abre el **entorno pedagógico** del proyecto. No asume experiencia previa con live coding audiovisual, solo familiaridad básica con el terminal.

## La pregunta de partida

> ¿Qué necesita un músico con guitarra para que las visuales *sientan* su instrumento y se proyecten sobre un escenario?

Tres cosas:

1. **Capturar y analizar** el sonido (¿qué nota tocas? ¿qué tan fuerte? ¿es grave o agudo?).
2. **Generar visuales** que puedan reaccionar a esos números en tiempo real.
3. **Proyectar** esas visuales sobre una superficie física, deformando el video para que encaje con la geometría del escenario.

Cada una de estas tareas tiene una herramienta dedicada que hace ese trabajo *muy* bien:

| Tarea | Herramienta | Por qué |
|---|---|---|
| Análisis de audio | **SuperCollider** | Lenguaje pensado para DSP en tiempo real, con UGens como `Tartini` (pitch), `FFT`, `Onsets`. Latencia de milisegundos. |
| Visuales generativos | **Hydra** | Live coding visual en el navegador. Sintaxis mínima (`osc().kaleid().out()`) que se edita en caliente. |
| Projection mapping | **TouchDesigner** | El estándar para instalaciones visuales; compone múltiples fuentes y hace mapping geométrico con la UI más cómoda que existe. |

## El problema: tres mundos separados

SuperCollider habla su propio lenguaje (`sclang`). Hydra vive en un navegador. TouchDesigner es una app de escritorio con su propia red de operators. No comparten memoria, no comparten archivos. ¿Cómo los conectas?

## La solución: dos planos

`omt07l` resuelve esto separando lo que los une en **dos planos**:

### Plano de datos — OSC

**OSC** (Open Sound Control) es un protocolo sobre UDP pensado específicamente para que software de audio/video se hable. SuperCollider lo entiende nativo. TouchDesigner tiene un `OSC In CHOP`. Hydra no, pero lo añadimos con un pequeño bridge en Python (`mcp/hydra/ws_bridge.py`) que traduce OSC a WebSocket para que el navegador pueda recibirlo.

Entonces: SC analiza el audio, emite mensajes `/omt/audio/pitch`, `/omt/audio/rms/bass`, etc., y los otros dos los consumen. El bus de datos es *unidireccional* y *en tiempo real*.

### Plano de control — MCP

**MCP** (Model Context Protocol) es el estándar que deja a Claude Code hablar con herramientas externas. Para cada uno de los tres programas existe (o escribimos) un "MCP server" que expone funciones como "carga este sketch" o "arranca este patch". Claude Code las llama a través de sus sub-agentes.

Así, cuando le pides a Claude "prepara una escena intro suave":

1. El `conductor` entiende la intención.
2. Delega al `composer`, que vía el MCP de SuperCollider carga un patch de drones.
3. Delega al `visualist`, que vía el MCP de Hydra carga un sketch tenue.
4. Delega al `mapper`, que vía el MCP de TouchDesigner activa la composición correspondiente.
5. Los tres sincronizan emitiendo `/omt/control/scene intro-suave` por el bus.

## ¿Por qué separar datos y control?

Porque las cosas que viajan en cada plano tienen naturalezas muy distintas:

- **Datos** son rápidos, constantes, numéricos, tolerantes a pérdidas (si se pierde un frame no pasa nada).
- **Control** es esporádico, discreto, simbólico, crítico (una orden de escena no se puede perder).

Mezclarlos da problemas. Separarlos te deja elegir el transporte correcto para cada uno: UDP/OSC para datos, MCP/stdio para control.

## Siguientes pasos

- Lee `docs/architecture.md` para ver el diagrama completo.
- Lee `docs/osc-protocol.md` para ver qué direcciones existen y qué significan.
- Abre `mcp/hydra/src/hydra_mcp/sketches/default.js` — es el sketch más simple que usa `window.omt.bass`.
- Abre `sc/synthdefs/analyzer.scd` — es el SynthDef que produce todos los números que circulan por el bus.
- Cuando quieras empezar a experimentar, sigue el *Quickstart* del `README.md` principal.
