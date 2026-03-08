#!/usr/bin/env python3
"""
ELRS Backpack → WebSocket Köprüsü
==================================
ELRS TX Backpack, WiFi telemetri modunda MSP sarmalı CRSF frame'lerini
UDP üzerinden gönderir. Tarayıcı UDP alamadığından bu script aradaki
köprüyü kurar:

    Backpack (UDP :14550)  →  [bu script]  →  WebSocket ws://localhost:8765/

Kurulum:
    pip install websockets

Kullanım:
    1. ELRS LUA scriptinden Telemetry = WiFi seçin
    2. Bilgisayarı backpack WiFi ağına bağlayın (10.0.0.1)
    3. python elrs_backpack_proxy.py
    4. elrs_backpack.html'i tarayıcıda açın (varsayılan: localhost:8765)
"""

import asyncio
import socket
import struct
import websockets

# ── Ayarlar ─────────────────────────────────────────────────────────────────
UDP_LISTEN_HOST = "0.0.0.0"
UDP_LISTEN_PORT = 14550        # Backpack'in gönderdiği port (mavlinkSendPort)
WS_HOST         = "0.0.0.0"
WS_PORT         = 8765
# ─────────────────────────────────────────────────────────────────────────────

MSP_ELRS_BACKPACK_CRSF_TLM = 0x11

clients: set = set()


def extract_crsf_from_msp(data: bytes) -> bytes | None:
    """MSP v1 veya v2 paketinden CRSF payload'ını çıkarır."""
    if len(data) < 6:
        return None

    # MSP v1: $M> + size(1) + cmd(1) + payload + checksum(1)
    if data[0:2] == b'$M':
        if len(data) < 6:
            return None
        size = data[3]
        cmd  = data[4]
        if cmd == MSP_ELRS_BACKPACK_CRSF_TLM and len(data) >= 5 + size:
            return data[5 : 5 + size]

    # MSP v2: $X> + flag(1) + function(2LE) + size(2LE) + payload + crc(1)
    elif data[0:2] == b'$X':
        if len(data) < 9:
            return None
        function = struct.unpack_from('<H', data, 4)[0]
        size     = struct.unpack_from('<H', data, 6)[0]
        if function == MSP_ELRS_BACKPACK_CRSF_TLM and len(data) >= 8 + size:
            return data[8 : 8 + size]

    return None


async def broadcast(raw: bytes) -> None:
    """Tüm bağlı WebSocket istemcilerine ham CRSF byte'larını gönderir."""
    if not clients:
        return
    dead = set()
    for ws in clients:
        try:
            await ws.send(raw)
        except Exception:
            dead.add(ws)
    clients.difference_update(dead)


async def ws_handler(websocket) -> None:
    """Yeni WebSocket bağlantısını yönetir."""
    clients.add(websocket)
    addr = websocket.remote_address
    print(f"[WS] Bağlandı: {addr}  (toplam: {len(clients)})")
    try:
        await websocket.wait_closed()
    finally:
        clients.discard(websocket)
        print(f"[WS] Ayrıldı: {addr}  (toplam: {len(clients)})")


async def udp_listener(loop: asyncio.AbstractEventLoop) -> None:
    """UDP soketini dinler ve CRSF frame'lerini WebSocket istemcilerine iletir."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((UDP_LISTEN_HOST, UDP_LISTEN_PORT))
    sock.setblocking(False)
    print(f"[UDP] Dinleniyor: {UDP_LISTEN_HOST}:{UDP_LISTEN_PORT}")

    while True:
        try:
            data = await loop.sock_recv(sock, 4096)
        except Exception as e:
            print(f"[UDP] Hata: {e}")
            await asyncio.sleep(0.1)
            continue

        crsf = extract_crsf_from_msp(data)
        if crsf:
            await broadcast(crsf)
        else:
            # Ham CRSF sync byte ile başlıyorsa doğrudan ilet
            if len(data) >= 3 and data[0] == 0xC8:
                await broadcast(data)


async def main() -> None:
    print("=" * 50)
    print("  ELRS Backpack → WebSocket Köprüsü")
    print("=" * 50)
    print(f"  UDP  dinleme : {UDP_LISTEN_HOST}:{UDP_LISTEN_PORT}")
    print(f"  WS   sunucu  : ws://localhost:{WS_PORT}/")
    print()
    print("  Adımlar:")
    print("  1. ELRS LUA → Backpack → Telemetry = WiFi")
    print("  2. Bu bilgisayarı backpack WiFi'ına bağlayın")
    print("  3. elrs_backpack.html'i tarayıcıda açın")
    print("     IP: 127.0.0.1  Port: 8765  Path: /")
    print("=" * 50)

    loop = asyncio.get_event_loop()

    async with websockets.serve(ws_handler, WS_HOST, WS_PORT):
        await udp_listener(loop)


if __name__ == "__main__":
    asyncio.run(main())
