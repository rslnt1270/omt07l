"""Smoke tests del WebSocket bridge.

Arranca un Bridge real en un thread de fondo contra puertos altos no usados,
verifica:
- que sirve /index.html (si el estático existe)
- que un mensaje OSC entrante se reenvía al cliente WS conectado
- que `send_to_browser()` desde el hilo principal llega al cliente WS
"""

from __future__ import annotations

import asyncio
import json
import socket
import threading
import time

import aiohttp
import pytest
from pythonosc.udp_client import SimpleUDPClient

from hydra_mcp.ws_bridge import Bridge, BridgeConfig


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture
def bridge():
    cfg = BridgeConfig(
        osc_host="127.0.0.1",
        osc_port=_free_port(),
        ws_host="127.0.0.1",
        ws_port=_free_port(),
    )
    b = Bridge(cfg)
    t = threading.Thread(target=b.run_forever, daemon=True)
    t.start()
    # espera a que el loop y la cola estén listos
    for _ in range(50):
        if b._loop is not None and b._outbound is not None:
            break
        time.sleep(0.02)
    else:
        raise RuntimeError("bridge no arrancó a tiempo")
    time.sleep(0.2)  # margen para que aiohttp abra el puerto
    yield b
    # shutdown: programamos _stop en el loop del bridge
    if b._loop and not b._loop.is_closed():
        b._loop.call_soon_threadsafe(b._stop.set)
    t.join(timeout=2)


@pytest.mark.asyncio
async def test_http_serves_index(bridge):
    url = f"http://127.0.0.1:{bridge.cfg.ws_port}/index.html"
    async with aiohttp.ClientSession() as s:
        async with s.get(url) as r:
            assert r.status == 200
            body = await r.text()
            assert "<html" in body.lower() or "hydra" in body.lower()


@pytest.mark.asyncio
async def test_osc_in_reaches_ws_client(bridge):
    url = f"http://127.0.0.1:{bridge.cfg.ws_port}/ws"
    async with aiohttp.ClientSession() as s:
        async with s.ws_connect(url) as ws:
            # pequeño margen para que el bridge registre al cliente
            await asyncio.sleep(0.1)
            client = SimpleUDPClient("127.0.0.1", bridge.cfg.osc_port)
            client.send_message("/omt/audio/rms/bass", 0.42)
            msg = await asyncio.wait_for(ws.receive(), timeout=2.0)
            assert msg.type == aiohttp.WSMsgType.TEXT
            payload = json.loads(msg.data)
            assert payload["op"] == "osc"
            assert payload["addr"] == "/omt/audio/rms/bass"
            assert pytest.approx(payload["args"][0], rel=1e-3) == 0.42


@pytest.mark.asyncio
async def test_send_to_browser_reaches_ws_client(bridge):
    url = f"http://127.0.0.1:{bridge.cfg.ws_port}/ws"
    async with aiohttp.ClientSession() as s:
        async with s.ws_connect(url) as ws:
            await asyncio.sleep(0.1)
            bridge.send_to_browser({"op": "eval", "code": "osc(10).out()"})
            msg = await asyncio.wait_for(ws.receive(), timeout=2.0)
            assert msg.type == aiohttp.WSMsgType.TEXT
            payload = json.loads(msg.data)
            assert payload == {"op": "eval", "code": "osc(10).out()"}


def test_status_shape(bridge):
    st = bridge.status()
    assert set(st.keys()) >= {
        "clients",
        "osc_messages_received",
        "last_osc",
        "osc_port",
        "ws_port",
    }
    assert st["osc_port"] == bridge.cfg.osc_port
    assert st["ws_port"] == bridge.cfg.ws_port
