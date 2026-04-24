"""WebSocket bridge: OSC (SC → aquí) ↔ WebSocket (aquí → navegador Hydra).

Un solo loop asyncio que:
- Sirve la web estática de `web/` en http://localhost:8765/
- Acepta conexiones WebSocket en ws://localhost:8765/ws
- Escucha OSC en udp:0.0.0.0:57200
- Reenvía OSC al navegador como JSON {"addr", "args"}
- Acepta mensajes del MCP server (vía `send_to_browser`) y los reenvía también
- Envía OSC saliente a SC (sclang:57120) y TD (:7000) cuando el browser
  manda un {"op":"osc_out","dest":"sc|td","addr":"/...","args":[...]}

Los puertos y destinos se derivan de `config/osc_map.yaml` (fuente de verdad).
"""

from __future__ import annotations

import asyncio
import json
import signal
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml
from aiohttp import WSMsgType, web
from pythonosc.dispatcher import Dispatcher
from pythonosc.osc_server import AsyncIOOSCUDPServer
from pythonosc.udp_client import SimpleUDPClient

WEB_DIR = Path(__file__).resolve().parents[2] / "web"
SKETCHES_DIR = Path(__file__).parent / "sketches"
REPO_ROOT = Path(__file__).resolve().parents[4]
CONFIG_YAML = REPO_ROOT / "config" / "osc_map.yaml"
DOCTOR_SCRIPT = REPO_ROOT / "scripts" / "doctor.sh"


def _safe_sketch_name(name: str) -> bool:
    """``True`` si ``name`` es un identificador plano sin path traversal."""
    if not name or "/" in name or "\\" in name or ".." in name:
        return False
    return name.replace("_", "").replace("-", "").isalnum()


@dataclass
class OscDestination:
    name: str
    host: str
    port: int


@dataclass
class BridgeConfig:
    osc_host: str = "0.0.0.0"
    osc_port: int = 57200
    # Bind de HTTP+WS a loopback por default: evita que cualquier dispositivo
    # en la LAN pueda inyectar OSC de control hacia SC/TD. Para acceso desde
    # otra máquina, setear explícitamente ws_host="0.0.0.0".
    ws_host: str = "127.0.0.1"
    ws_port: int = 8765
    outbound: list[OscDestination] = field(default_factory=list)

    @classmethod
    def from_yaml(cls, path: Path = CONFIG_YAML) -> BridgeConfig:
        """Construye una config leyendo puertos y destinos de osc_map.yaml.

        Si el archivo no existe cae a defaults; facilita los tests en CI.
        """
        if not path.exists():
            return cls()
        doc = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        ports = doc.get("ports", {}) or {}
        outbound: list[OscDestination] = []
        if "sclang" in ports:
            outbound.append(OscDestination("sc", "127.0.0.1", int(ports["sclang"])))
        if "touchdesigner_osc" in ports:
            outbound.append(OscDestination("td", "127.0.0.1", int(ports["touchdesigner_osc"])))
        return cls(
            osc_port=int(ports.get("hydra_bridge_osc", 57200)),
            ws_port=int(ports.get("hydra_bridge_ws", 8765)),
            outbound=outbound,
        )


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
        self._osc_out: dict[str, SimpleUDPClient] = {}

    # ── API pública (llamada desde el MCP server, otro hilo) ─────────
    def send_to_browser(self, msg: dict) -> None:
        """Thread-safe: encola un mensaje para enviar a todos los clientes ws."""
        if self._loop is None or self._outbound is None:
            raise RuntimeError("bridge no arrancado")
        asyncio.run_coroutine_threadsafe(self._outbound.put(msg), self._loop)

    def send_osc(self, dest: str, addr: str, args: list[Any] | None = None) -> None:
        """Envía OSC saliente al destino ``dest`` (``sc`` o ``td``).

        Puede llamarse desde cualquier thread: ``SimpleUDPClient.send_message``
        es síncrono (sólo un ``socket.sendto``) así que no necesita pasar por
        el loop asyncio. Si el destino no existe levanta KeyError.
        """
        client = self._osc_out.get(dest)
        if client is None:
            raise KeyError(
                f"osc dest desconocido: {dest!r}; conocidos={list(self._osc_out)}"
            )
        client.send_message(addr, list(args) if args else [])

    def status(self) -> dict:
        return {
            "clients": len(self.state.clients),
            "osc_messages_received": self.state.osc_count,
            "last_osc": self.state.last_osc,
            "osc_port": self.cfg.osc_port,
            "ws_port": self.cfg.ws_port,
            "outbound": [
                {"name": d.name, "host": d.host, "port": d.port}
                for d in self.cfg.outbound
            ],
        }

    # ── Bootstrap ─────────────────────────────────────────────────────
    def run_forever(self, install_signal_handlers: bool = False) -> None:
        """Arranca el loop asyncio.

        Si ``install_signal_handlers`` es True, registra SIGINT y SIGTERM
        como señales limpias de shutdown (modo `hydra-bridge` standalone).
        Cuando el bridge corre dentro del MCP stdio server, las señales las
        maneja el proceso principal y no queremos tocarlas.
        """
        try:
            asyncio.run(self._main(install_signal_handlers=install_signal_handlers))
        except KeyboardInterrupt:
            pass

    async def _main(self, install_signal_handlers: bool = False) -> None:
        self._loop = asyncio.get_running_loop()
        self._outbound = asyncio.Queue()
        self._stop = asyncio.Event()

        # Clientes OSC salientes — uno por destino declarado en la config.
        self._osc_out = {
            d.name: SimpleUDPClient(d.host, d.port) for d in self.cfg.outbound
        }

        if install_signal_handlers:
            for sig in (signal.SIGINT, signal.SIGTERM):
                self._loop.add_signal_handler(sig, self._stop.set)

        # HTTP + WebSocket
        app = web.Application()
        app.router.add_get("/ws", self._ws_handler)
        app.router.add_get("/api/status", self._http_status)
        app.router.add_get("/api/doctor", self._http_doctor)
        app.router.add_get("/api/sketches", self._http_sketches)
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
        fanout_task = asyncio.create_task(self._fanout_loop(), name="bridge-fanout")
        try:
            await self._stop.wait()
        finally:
            fanout_task.cancel()
            try:
                await fanout_task
            except (asyncio.CancelledError, Exception):
                pass
            transport.close()
            await runner.cleanup()

    async def _fanout_loop(self) -> None:
        assert self._outbound is not None
        while True:
            msg = await self._outbound.get()
            await self._broadcast(msg)

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
                    try:
                        payload = json.loads(msg.data)
                    except json.JSONDecodeError:
                        continue
                    await self._handle_inbound_ws(payload)
                elif msg.type == WSMsgType.ERROR:
                    break
        finally:
            self.state.clients.discard(ws)
        return ws

    # ── HTTP JSON endpoints (para el panel) ──────────────────────────
    async def _http_status(self, request: web.Request) -> web.Response:
        return web.json_response(self.status())

    async def _http_sketches(self, request: web.Request) -> web.Response:
        if not SKETCHES_DIR.exists():
            return web.json_response([])
        names = sorted(p.stem for p in SKETCHES_DIR.glob("*.js"))
        return web.json_response(names)

    async def _http_doctor(self, request: web.Request) -> web.Response:
        if not DOCTOR_SCRIPT.exists():
            return web.json_response(
                {"ok": False, "error": f"doctor.sh no encontrado: {DOCTOR_SCRIPT}"},
                status=500,
            )
        proc = await asyncio.create_subprocess_exec(
            "bash", str(DOCTOR_SCRIPT), "--quick",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=str(REPO_ROOT),
        )
        try:
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30)
        except asyncio.TimeoutError:
            proc.kill()
            return web.json_response({"ok": False, "error": "timeout"}, status=504)
        return web.json_response({
            "ok": proc.returncode == 0,
            "returncode": proc.returncode,
            "output": stdout.decode("utf-8", errors="replace"),
        })

    async def _handle_inbound_ws(self, msg: dict) -> None:
        """Interpreta comandos que envía el navegador por el WS.

        Hoy soporta:
        - ``{"op":"osc_out","dest":"sc|td","addr":"/omt/control/scene","args":["intro"]}``
          → reenvía por OSC al destino declarado.
        - ``{"op":"load_sketch","name":"aurora"}`` → lee el archivo de
          ``sketches/`` y re-emite como ``{"op":"eval","code":...}`` a todos
          los clientes (incluye al que lo pidió).
        """
        op = msg.get("op")
        if op == "osc_out":
            dest = msg.get("dest")
            addr = msg.get("addr")
            args = msg.get("args", [])
            if not isinstance(dest, str) or not isinstance(addr, str):
                return
            if not isinstance(args, list):
                args = [args]
            try:
                self.send_osc(dest, addr, args)
            except Exception:
                # no queremos que un mensaje malformado cierre el WS
                return
        elif op == "load_sketch":
            name = msg.get("name")
            if not isinstance(name, str) or not _safe_sketch_name(name):
                return
            path = SKETCHES_DIR / f"{name}.js"
            if not path.exists():
                return
            code = path.read_text(encoding="utf-8")
            assert self._outbound is not None
            await self._outbound.put({"op": "eval", "code": code})

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
