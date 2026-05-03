# Copyright (c) 2024-2026 savas8008 - All Rights Reserved
# Bu dosyanin izinsiz kopyalanmasi, degistirilmesi veya dagitilmasi yasaktir.

"""
MAVLink UDP to WebSocket proxy for drafts/elrs_backpack.html.

Mission Planner's UDP mode listens for MAVLink telemetry, commonly on UDP 14550.
The browser page expects a WebSocket, so this bridge listens on UDP 14550,
decodes the common MAVLink telemetry messages, and publishes JSON telemetry to
ws://127.0.0.1:8765/.

Usage:
    python tools/mavlink_ws_proxy.py
    python tools/mavlink_ws_proxy.py --udp-port 14550 --ws-port 8765
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import hashlib
import json
import math
import socket
import struct
from contextlib import suppress


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

    async def broadcast_json(self, payload: dict) -> None:
        if not self.clients:
            return

        frame = websocket_text_frame(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        dead: list[asyncio.StreamWriter] = []
        for writer in tuple(self.clients):
            try:
                writer.write(frame)
                await writer.drain()
            except Exception:
                dead.append(writer)

        for writer in dead:
            await self.remove(writer)


def websocket_text_frame(payload: bytes) -> bytes:
    header = bytearray([0x81])
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
        writer.write((
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Accept: {accept}\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            "\r\n"
        ).encode("ascii"))
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


class MavlinkParser:
    def __init__(self) -> None:
        self.buffer = bytearray()

    def feed(self, data: bytes) -> list[tuple[int, bytes]]:
        self.buffer.extend(data)
        messages: list[tuple[int, bytes]] = []

        while len(self.buffer) >= 8:
            if self.buffer[0] not in (0xFE, 0xFD):
                del self.buffer[0]
                continue

            magic = self.buffer[0]
            payload_len = self.buffer[1]
            if magic == 0xFE:
                header_len = 6
                msg_id = self.buffer[5]
                total_len = header_len + payload_len + 2
            else:
                if len(self.buffer) < 10:
                    break
                header_len = 10
                incompat_flags = self.buffer[2]
                msg_id = self.buffer[7] | (self.buffer[8] << 8) | (self.buffer[9] << 16)
                total_len = header_len + payload_len + 2 + (13 if (incompat_flags & 0x01) else 0)

            if len(self.buffer) < total_len:
                break

            payload = bytes(self.buffer[header_len:header_len + payload_len])
            messages.append((msg_id, payload))
            del self.buffer[:total_len]

        return messages


def decode_message(msg_id: int, payload: bytes) -> dict:
    data: dict = {}

    if msg_id == 0 and len(payload) >= 9:  # HEARTBEAT
        base_mode = payload[6]
        system_status = payload[7]
        data["failsafe"] = system_status in (4, 5)
        if base_mode & 0x80:
            data["flightMode"] = "ARMED"

    elif msg_id == 1 and len(payload) >= 31:  # SYS_STATUS
        voltage_mv = u16(payload, 14)
        battery_remaining = s8(payload, 30)
        if battery_remaining >= 0:
            data["dlLq"] = battery_remaining
        if voltage_mv:
            data["dlSnr"] = round(voltage_mv / 1000.0, 1)

    elif msg_id == 24 and len(payload) >= 30:  # GPS_RAW_INT
        fix_type = payload[8]
        lat = i32(payload, 9) / 1e7
        lon = i32(payload, 13) / 1e7
        alt = i32(payload, 17) / 1000.0
        speed = u16(payload, 25) / 100.0
        cog = u16(payload, 27) / 100.0
        sats = payload[29]
        if fix_type >= 2 and abs(lat) > 0.001 and abs(lon) > 0.001:
            data.update({"lat": lat, "lon": lon, "gpsAlt": round(alt), "speed": speed, "cog": cog, "sats": sats})
        else:
            data["sats"] = sats

    elif msg_id == 30 and len(payload) >= 28:  # ATTITUDE
        data["roll"] = math.degrees(f32(payload, 4))
        data["pitch"] = math.degrees(f32(payload, 8))
        data["yaw"] = (math.degrees(f32(payload, 12)) + 360.0) % 360.0

    elif msg_id == 33 and len(payload) >= 28:  # GLOBAL_POSITION_INT
        lat = i32(payload, 4) / 1e7
        lon = i32(payload, 8) / 1e7
        rel_alt = i32(payload, 16) / 1000.0
        heading = u16(payload, 26) / 100.0
        if abs(lat) > 0.001 and abs(lon) > 0.001:
            data.update({"lat": lat, "lon": lon})
        data["alt"] = rel_alt
        if heading < 360:
            data["cog"] = heading

    elif msg_id == 65 and len(payload) >= 42:  # RC_CHANNELS
        channel_count = payload[4]
        channels = [u16(payload, 5 + i * 2) for i in range(min(channel_count, 16))]
        data["channels"] = channels + [1500] * (16 - len(channels))
        rssi = payload[37]
        if rssi != 255:
            data["lq"] = round(rssi / 254 * 100)

    elif msg_id == 74 and len(payload) >= 20:  # VFR_HUD
        ground_speed = f32(payload, 4)
        heading = i16(payload, 8)
        throttle = u16(payload, 10)
        alt = f32(payload, 12)
        climb = f32(payload, 16)
        data.update({"speed": ground_speed, "cog": heading % 360, "alt": alt, "vario": climb})
        channels = [1500] * 16
        channels[2] = 1000 + throttle * 10
        data["channels"] = channels

    return data


def u16(payload: bytes, offset: int) -> int:
    return struct.unpack_from("<H", payload, offset)[0]


def i16(payload: bytes, offset: int) -> int:
    return struct.unpack_from("<h", payload, offset)[0]


def i32(payload: bytes, offset: int) -> int:
    return struct.unpack_from("<i", payload, offset)[0]


def f32(payload: bytes, offset: int) -> float:
    return struct.unpack_from("<f", payload, offset)[0]


def s8(payload: bytes, offset: int) -> int:
    value = payload[offset]
    return value - 256 if value > 127 else value


async def read_udp(args: argparse.Namespace, hub: WebSocketHub) -> None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    sock.setblocking(False)
    sock.bind((args.udp_host, args.udp_port))

    loop = asyncio.get_running_loop()
    parser = MavlinkParser()
    print(f"MAVLink UDP listening: {args.udp_host}:{args.udp_port}")
    heartbeat_task = asyncio.create_task(send_heartbeat(sock, args.target_host, args.target_port))

    try:
        while True:
            packet, addr = await loop.sock_recvfrom(sock, 4096)
            print(f"UDP packet: {len(packet)} bytes from {addr[0]}:{addr[1]}")
            patch: dict = {}
            for msg_id, payload in parser.feed(packet):
                patch.update(decode_message(msg_id, payload))
            if patch:
                await hub.broadcast_json({"type": "mavlink_telemetry", "data": patch})
    finally:
        heartbeat_task.cancel()


async def send_heartbeat(sock: socket.socket, target_host: str, target_port: int) -> None:
    loop = asyncio.get_running_loop()
    seq = 0
    target = (target_host, target_port)
    print(f"MAVLink heartbeat target: {target_host}:{target_port}")

    while True:
        packet = mavlink_v1_heartbeat(seq)
        try:
            await loop.sock_sendto(sock, packet, target)
        except OSError as exc:
            print(f"Heartbeat send failed: {exc}")
        seq = (seq + 1) & 0xFF
        await asyncio.sleep(1)


def mavlink_v1_heartbeat(seq: int) -> bytes:
    payload = struct.pack(
        "<IBBBBB",
        0,  # custom_mode
        6,  # MAV_TYPE_GCS
        8,  # MAV_AUTOPILOT_INVALID
        0,  # base_mode
        4,  # MAV_STATE_ACTIVE
        3,  # mavlink_version
    )
    header = bytes([0xFE, len(payload), seq, 255, 190, 0])
    crc = x25_crc(header[1:] + payload + bytes([50]))  # HEARTBEAT crc extra
    return header + payload + struct.pack("<H", crc)


def x25_crc(data: bytes) -> int:
    crc = 0xFFFF
    for byte in data:
        tmp = byte ^ (crc & 0xFF)
        tmp = (tmp ^ (tmp << 4)) & 0xFF
        crc = ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xFFFF
    return crc


async def main_async(args: argparse.Namespace) -> None:
    hub = WebSocketHub()
    server = await asyncio.start_server(
        lambda r, w: handle_client(r, w, hub),
        args.ws_host,
        args.ws_port,
    )
    print(f"WebSocket output: ws://{args.ws_host}:{args.ws_port}/")
    print("Yer kontrol sayfasinda IP=127.0.0.1, Port=8765, Path=/ kullan.")

    async with server:
        await asyncio.gather(server.serve_forever(), read_udp(args, hub))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="MAVLink UDP to WebSocket proxy")
    parser.add_argument("--udp-host", default="0.0.0.0", help="MAVLink UDP dinleme hostu")
    parser.add_argument("--udp-port", type=int, default=14550, help="MAVLink UDP dinleme portu")
    parser.add_argument("--target-host", default="255.255.255.255", help="Backpack MAVLink hedef IP")
    parser.add_argument("--target-port", type=int, default=14555, help="Backpack MAVLink listen/uplink portu")
    parser.add_argument("--ws-host", default="127.0.0.1", help="WebSocket host")
    parser.add_argument("--ws-port", type=int, default=8765, help="WebSocket port")
    return parser.parse_args()


def main() -> None:
    asyncio.run(main_async(parse_args()))


if __name__ == "__main__":
    main()
