# Copyright (c) 2024-2026 savas8008 - All Rights Reserved
# Bu dosyanin izinsiz kopyalanmasi, degistirilmesi veya dagitilmasi yasaktir.

"""
CRSF telemetry to WebSocket proxy for elrs_backpack.html.

The yer kontrol page connects to ws://127.0.0.1:8765/ and expects raw CRSF
frames. Browsers can only connect to WebSocket servers directly; if your
backpack publishes telemetry over UDP/TCP WiFi, this bridge converts that stream
to the WebSocket endpoint used by the page.

Usage:
    # WiFi UDP stream from backpack to this PC
    python tools/backpack_ws_proxy.py --source udp --udp-port 8764

    # WiFi TCP stream exposed by backpack
    python tools/backpack_ws_proxy.py --source tcp --remote-host 192.168.4.1 --remote-port 8765

    # USB/serial fallback, only if you actually use USB
    python tools/backpack_ws_proxy.py --source serial --serial-port COM7
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import hashlib
import socket
import struct
from contextlib import suppress

try:
    import serial
    from serial.tools import list_ports
except ImportError:
    serial = None
    list_ports = None


GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


class WebSocketHub:
    def __init__(self) -> None:
        self.clients: set[asyncio.StreamWriter] = set()

    async def add(self, writer: asyncio.StreamWriter) -> None:
        self.clients.add(writer)

    async def remove(self, writer: asyncio.StreamWriter) -> None:
        self.clients.discard(writer)
        writer.close()
        with suppress(Exception):
            await writer.wait_closed()

    async def broadcast(self, payload: bytes) -> None:
        if not payload or not self.clients:
            return

        frame = websocket_binary_frame(payload)
        dead: list[asyncio.StreamWriter] = []
        for writer in tuple(self.clients):
            try:
                writer.write(frame)
                await writer.drain()
            except Exception:
                dead.append(writer)

        for writer in dead:
            await self.remove(writer)


def websocket_binary_frame(payload: bytes) -> bytes:
    header = bytearray([0x82])
    length = len(payload)
    if length < 126:
        header.append(length)
    elif length <= 0xFFFF:
        header.extend([126])
        header.extend(struct.pack("!H", length))
    else:
        header.extend([127])
        header.extend(struct.pack("!Q", length))
    return bytes(header) + payload


async def handle_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter, hub: WebSocketHub) -> None:
    try:
        request = await reader.readuntil(b"\r\n\r\n")
        headers = parse_headers(request)
        key = headers.get("sec-websocket-key")
        if not key:
            writer.write(b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n")
            await writer.drain()
            await hub.remove(writer)
            return

        accept = base64.b64encode(hashlib.sha1((key + GUID).encode("ascii")).digest()).decode("ascii")
        response = (
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Accept: {accept}\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            "\r\n"
        ).encode("ascii")
        writer.write(response)
        await writer.drain()
        await hub.add(writer)

        while not reader.at_eof():
            await reader.read(1024)
    except Exception:
        pass
    finally:
        await hub.remove(writer)


def parse_headers(request: bytes) -> dict[str, str]:
    lines = request.decode("latin-1", errors="ignore").split("\r\n")
    headers: dict[str, str] = {}
    for line in lines[1:]:
        if ":" not in line:
            continue
        name, value = line.split(":", 1)
        headers[name.strip().lower()] = value.strip()
    return headers


async def read_serial(port_name: str, baud: int, hub: WebSocketHub) -> None:
    if serial is None:
        raise RuntimeError("pyserial kurulu degil. Serial kullanmak icin: pip install pyserial")

    ser = serial.Serial(port_name, baudrate=baud, timeout=0.05)
    print(f"Serial open: {port_name} @ {baud}")
    try:
        while True:
            data = await asyncio.to_thread(ser.read, 512)
            if data:
                await hub.broadcast(data)
            else:
                await asyncio.sleep(0.005)
    finally:
        ser.close()


async def read_udp(listen_host: str, listen_port: int, hub: WebSocketHub) -> None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setblocking(False)
    sock.bind((listen_host, listen_port))
    loop = asyncio.get_running_loop()
    print(f"UDP input listening: {listen_host}:{listen_port}")
    while True:
        data, addr = await loop.sock_recvfrom(sock, 2048)
        print(f"UDP packet: {len(data)} bytes from {addr[0]}:{addr[1]}")
        await hub.broadcast(data)


async def read_tcp(remote_host: str, remote_port: int, hub: WebSocketHub) -> None:
    while True:
        try:
            print(f"TCP connecting: {remote_host}:{remote_port}")
            reader, writer = await asyncio.open_connection(remote_host, remote_port)
            print(f"TCP connected: {remote_host}:{remote_port}")
            try:
                while True:
                    data = await reader.read(2048)
                    if not data:
                        break
                    await hub.broadcast(data)
            finally:
                writer.close()
                with suppress(Exception):
                    await writer.wait_closed()
        except Exception as exc:
            print(f"TCP reconnect in 2s: {exc}")
            await asyncio.sleep(2)


async def start_source(args: argparse.Namespace, hub: WebSocketHub) -> None:
    if args.source == "serial":
        await read_serial(args.serial_port, args.baud, hub)
    elif args.source == "udp":
        await read_udp(args.udp_host, args.udp_port, hub)
    elif args.source == "tcp":
        await read_tcp(args.remote_host, args.remote_port, hub)
    else:
        raise ValueError(f"Bilinmeyen kaynak: {args.source}")


async def main_async(args: argparse.Namespace) -> None:
    hub = WebSocketHub()
    server = await asyncio.start_server(
        lambda r, w: handle_client(r, w, hub),
        args.host,
        args.ws_port,
    )
    print(f"WebSocket proxy: ws://{args.host}:{args.ws_port}/")
    print("Yer kontrol sayfasinda IP=127.0.0.1, Port=8765 kalsin.")

    async with server:
        await asyncio.gather(server.serve_forever(), start_source(args, hub))


def print_ports() -> None:
    if list_ports is None:
        print("pyserial kurulu degil.")
        return

    ports = list(list_ports.comports())
    if not ports:
        print("COM port bulunamadi.")
        return
    for item in ports:
        print(f"{item.device}\t{item.description}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="CRSF telemetry to WebSocket proxy")
    parser.add_argument("--list", action="store_true", help="COM portlari listele")
    parser.add_argument("--source", choices=["udp", "tcp", "serial"], default="udp", help="Telemetry kaynagi")
    parser.add_argument("--serial-port", help="Backpack/CRSF seri portu, orn. COM7")
    parser.add_argument("--baud", type=int, default=420000, help="Seri baud rate")
    parser.add_argument("--udp-host", default="0.0.0.0", help="UDP dinleme hostu")
    parser.add_argument("--udp-port", type=int, default=8764, help="UDP dinleme portu")
    parser.add_argument("--remote-host", help="TCP kaynak IP adresi")
    parser.add_argument("--remote-port", type=int, help="TCP kaynak portu")
    parser.add_argument("--host", default="127.0.0.1", help="WebSocket host")
    parser.add_argument("--ws-port", type=int, default=8765, help="WebSocket port")
    args = parser.parse_args()
    if args.list:
        return args
    if args.source == "serial" and not args.serial_port:
        parser.error("--source serial icin --serial-port gerekli.")
    if args.source == "tcp" and (not args.remote_host or not args.remote_port):
        parser.error("--source tcp icin --remote-host ve --remote-port gerekli.")
    return args


def main() -> None:
    args = parse_args()
    if args.list:
        print_ports()
        return
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
