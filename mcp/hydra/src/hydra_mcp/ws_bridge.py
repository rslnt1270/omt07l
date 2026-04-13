"""WebSocket bridge: OSC (SC → aquí) ↔ WebSocket (aquí → navegador Hydra).

Un solo loop asyncio que:
- Sirve la web estática de `web/` en http://localhost:8765/
- Acepta conexiones WebSocket en ws://localhost:8765/ws
- Escucha OSC en udp:0.0.0.0:57200
- Reenvía OSC al navegador como JSON {"addr", "args"}
- Acepta mensajes del MCP server (vía `send_to_browser`) y los reenvía también
"""

from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from aiohttp import WSMsgType, web
from pythonosc.dispatcher import Dispatcher
from pythonosc.osc_server import AsyncIOOSCUDPServer

WEB_DIR = Path(__file__).resolve().parents[2] / "web"


@dataclass
class BridgeConfig:
    osc_host: str = "0.0.0.0"
    osc_port: int = 57200
    ws_host: str = "0.0.0.0"
    ws_port: int = 8765


@dataclass
class BridgeState:
    clients: set[web.WebSocketResponse] = field(default_factory=set)
    last_osc: dict[str, Any] = field(default_factory=dict)
    osc_count: int = 0


class Bridge:
    def __init__(self, cfg: BridgeConfig):
        self.cfg = cfg
        self.state = BridgeState()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._outbound: asyncio.Queue | None = None

    # ── API pública (llamada desde el MCP server, otro hilo) ─────────
    def send_to_browser(self, msg: dict) -> None:
        """Thread-safe: encola un mensaje para enviar a todos los clientes ws."""
        if self._loop is None or self._outbound is None:
            raise RuntimeError("bridge no arrancado")
        asyncio.run_coroutine_threadsafe(self._outbound.put(msg), self._loop)

    def status(self) -> dict:
        return {
            "clients": len(self.state.clients),
            "osc_messages_received": self.state.osc_count,
            "last_osc": self.state.last_osc,
            "osc_port": self.cfg.osc_port,
            "ws_port": self.cfg.ws_port,
        }

    # ── Bootstrap ─────────────────────────────────────────────────────
    def run_forever(self) -> None:
        asyncio.run(self._main())

    async def _main(self) -> None:
        self._loop = asyncio.get_running_loop()
        self._outbound = asyncio.Queue()

        # HTTP + WebSocket
        app = web.Application()
        app.router.add_get("/ws", self._ws_handler)
        if WEB_DIR.exists():
            app.router.add_static("/", WEB_DIR, show_index=True)
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, self.cfg.ws_host, self.cfg.ws_port)
        await site.start()

        # OSC
        dispatcher = Dispatcher()
        dispatcher.set_default_handler(self._on_osc)
        osc_server = AsyncIOOSCUDPServer(
            (self.cfg.osc_host, self.cfg.osc_port), dispatcher, self._loop
        )
        transport, _protocol = await osc_server.create_serve_endpoint()

        # Fan-out de mensajes salientes → todos los clientes
        try:
            while True:
                msg = await self._outbound.get()
                await self._broadcast(msg)
        finally:
            transport.close()
            await runner.cleanup()

    # ── OSC ───────────────────────────────────────────────────────────
    def _on_osc(self, addr: str, *args: Any) -> None:
        self.state.osc_count += 1
        self.state.last_osc = {"addr": addr, "args": list(args), "t": time.time()}
        payload = {"op": "osc", "addr": addr, "args": list(args)}
        if self._loop and self._outbound:
            asyncio.run_coroutine_threadsafe(self._outbound.put(payload), self._loop)

    # ── WebSocket ─────────────────────────────────────────────────────
    async def _ws_handler(self, request: web.Request) -> web.WebSocketResponse:
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        self.state.clients.add(ws)
        try:
            async for msg in ws:
                if msg.type == WSMsgType.TEXT:
                    # Mensajes opcionales del browser (ej. handshake, logs)
                    pass
                elif msg.type == WSMsgType.ERROR:
                    break
        finally:
            self.state.clients.discard(ws)
        return ws

    async def _broadcast(self, msg: dict) -> None:
        if not self.state.clients:
            return
        data = json.dumps(msg)
        dead: list[web.WebSocketResponse] = []
        for ws in self.state.clients:
            try:
                await ws.send_str(data)
            except ConnectionResetError:
                dead.append(ws)
        for ws in dead:
            self.state.clients.discard(ws)
