"""Tests del camino de CONTROL del bridge.

Cubre lo que el Sprint B añadió y que el test de bridge original no toca:
- ``BridgeConfig.from_yaml`` lee puertos y destinos de ``config/osc_map.yaml``.
- Un mensaje WS ``{op:"osc_out",...}`` termina en un ``sendto`` real sobre UDP.
- Un mensaje WS ``{op:"load_sketch",...}`` re-emite el código del sketch a los
  clientes WS conectados.
- El guard ``_safe_sketch_name`` bloquea path traversal.
- ``/api/status`` responde JSON con la forma esperada.
"""

from __future__ import annotations

import asyncio
import json
import socket
import threading
import time
from pathlib import Path

import aiohttp
import pytest

from hydra_mcp.ws_bridge import (
    Bridge,
    BridgeConfig,
    OscDestination,
    SKETCHES_DIR,
    _safe_sketch_name,
)


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _free_udp_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture
def bridge_with_outbound():
    """Bridge con un destino de salida 'sc' apuntando a un socket UDP local."""
    sc_port = _free_udp_port()
    # socket receptor para verificar que el bridge emite UDP
    sink = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sink.bind(("127.0.0.1", sc_port))
    sink.settimeout(2.0)

    cfg = BridgeConfig(
        osc_host="127.0.0.1",
        osc_port=_free_port(),
        ws_host="127.0.0.1",
        ws_port=_free_port(),
        outbound=[OscDestination("sc", "127.0.0.1", sc_port)],
    )
    b = Bridge(cfg)
    t = threading.Thread(target=b.run_forever, daemon=True)
    t.start()
    for _ in range(50):
        if b._loop is not None and b._outbound is not None:
            break
        time.sleep(0.02)
    else:
        raise RuntimeError("bridge no arrancó")
    time.sleep(0.2)
    yield b, sink
    if b._loop and not b._loop.is_closed():
        b._loop.call_soon_threadsafe(b._stop.set)
    t.join(timeout=2)
    sink.close()


@pytest.mark.asyncio
async def test_osc_out_reaches_udp_sink(bridge_with_outbound):
    b, sink = bridge_with_outbound
    url = f"http://127.0.0.1:{b.cfg.ws_port}/ws"
    async with aiohttp.ClientSession() as s:
        async with s.ws_connect(url) as ws:
            await asyncio.sleep(0.1)
            await ws.send_str(json.dumps({
                "op": "osc_out",
                "dest": "sc",
                "addr": "/omt/control/scene",
                "args": ["intro"],
            }))
            # Damos tiempo al loop para ejecutar el handler y disparar el sendto.
            data, _ = await asyncio.get_running_loop().run_in_executor(
                None, sink.recvfrom, 2048
            )
            # El paquete OSC empieza con la address como string null-padded.
            assert b"/omt/control/scene" in data
            assert b"intro" in data


@pytest.mark.asyncio
async def test_osc_out_unknown_dest_is_silent(bridge_with_outbound):
    b, sink = bridge_with_outbound
    url = f"http://127.0.0.1:{b.cfg.ws_port}/ws"
    async with aiohttp.ClientSession() as s:
        async with s.ws_connect(url) as ws:
            await asyncio.sleep(0.1)
            # Destino inválido: el bridge no debe crashear ni cerrar el WS.
            await ws.send_str(json.dumps({
                "op": "osc_out", "dest": "nope", "addr": "/x", "args": [1],
            }))
            # Mandamos uno válido después y confirmamos que el WS sigue vivo.
            await ws.send_str(json.dumps({
                "op": "osc_out", "dest": "sc", "addr": "/ping", "args": [],
            }))
            data, _ = await asyncio.get_running_loop().run_in_executor(
                None, sink.recvfrom, 2048
            )
            assert b"/ping" in data


@pytest.mark.asyncio
async def test_load_sketch_broadcasts_eval(bridge_with_outbound, tmp_path, monkeypatch):
    """``load_sketch`` por WS debe leer el archivo y reenviarlo como {op:'eval'}."""
    b, _sink = bridge_with_outbound
    # Escribimos un sketch temporal en el directorio real (y lo borramos luego)
    fake = SKETCHES_DIR / "__test_bridge_sketch.js"
    fake.write_text("// hola\nosc(10).out()\nrender(o0)\n", encoding="utf-8")
    try:
        url = f"http://127.0.0.1:{b.cfg.ws_port}/ws"
        async with aiohttp.ClientSession() as s:
            async with s.ws_connect(url) as ws:
                await asyncio.sleep(0.1)
                await ws.send_str(json.dumps({
                    "op": "load_sketch", "name": "__test_bridge_sketch",
                }))
                msg = await asyncio.wait_for(ws.receive(), timeout=2.0)
                assert msg.type == aiohttp.WSMsgType.TEXT
                payload = json.loads(msg.data)
                assert payload["op"] == "eval"
                assert "osc(10)" in payload["code"]
    finally:
        fake.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_load_sketch_rejects_path_traversal(bridge_with_outbound):
    b, _ = bridge_with_outbound
    url = f"http://127.0.0.1:{b.cfg.ws_port}/ws"
    async with aiohttp.ClientSession() as s:
        async with s.ws_connect(url) as ws:
            await asyncio.sleep(0.1)
            # Estos nombres no deben generar NINGÚN eval aguas abajo.
            for bad in ["../secret", "..", "a/b", "a\\b", ""]:
                await ws.send_str(json.dumps({"op": "load_sketch", "name": bad}))
            # Si algo se hubiera leído, el WS recibiría ≥1 mensaje. Esperamos
            # corto y confirmamos que no hay payload.
            with pytest.raises(asyncio.TimeoutError):
                await asyncio.wait_for(ws.receive(), timeout=0.5)


def test_safe_sketch_name_unit():
    assert _safe_sketch_name("aurora")
    assert _safe_sketch_name("cardioid_breath")
    assert _safe_sketch_name("metaball-orbit")
    assert not _safe_sketch_name("../etc/passwd")
    assert not _safe_sketch_name("a/b")
    assert not _safe_sketch_name("")
    assert not _safe_sketch_name("has space")


def test_from_yaml_uses_osc_map(tmp_path: Path):
    """``from_yaml`` debe extraer sc/td como destinos outbound."""
    yaml_text = (
        "ports:\n"
        "  sclang: 57120\n"
        "  touchdesigner_osc: 7000\n"
        "  hydra_bridge_osc: 57200\n"
        "  hydra_bridge_ws: 8765\n"
    )
    p = tmp_path / "osc_map.yaml"
    p.write_text(yaml_text, encoding="utf-8")
    cfg = BridgeConfig.from_yaml(p)
    assert cfg.osc_port == 57200
    assert cfg.ws_port == 8765
    by_name = {d.name: d for d in cfg.outbound}
    assert by_name["sc"].port == 57120
    assert by_name["td"].port == 7000


def test_from_yaml_missing_file_returns_defaults(tmp_path: Path):
    cfg = BridgeConfig.from_yaml(tmp_path / "does_not_exist.yaml")
    assert cfg.osc_port == 57200
    assert cfg.ws_port == 8765
    assert cfg.outbound == []


@pytest.mark.asyncio
async def test_api_status_endpoint(bridge_with_outbound):
    b, _ = bridge_with_outbound
    url = f"http://127.0.0.1:{b.cfg.ws_port}/api/status"
    async with aiohttp.ClientSession() as s:
        async with s.get(url) as r:
            assert r.status == 200
            payload = await r.json()
            assert payload["ws_port"] == b.cfg.ws_port
            assert {d["name"] for d in payload["outbound"]} == {"sc"}
