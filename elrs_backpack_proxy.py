#!/usr/bin/env python3
"""
ELRS Backpack → WebSocket Köprüsü (SIFIR BAĞIMLILIK)
=====================================================
Hiçbir pip paketi gerekmez — sadece Python 3.6+ yeterli.

Kullanım:
    python elrs_backpack_proxy.py

Sonra tarayıcıda elrs_backpack.html:
    IP: 127.0.0.1   Port: 8765   Path: /
"""

import socket
import threading
import struct
import hashlib
import base64
import time

UDP_PORT = 14550
WS_HOST  = "0.0.0.0"
WS_PORT  = 8765

MSP_ELRS_BACKPACK_CRSF_TLM = 0x11

# Bağlı WebSocket istemcileri { socket: lock }
clients: dict = {}
clients_lock = threading.Lock()


# ── MSP paketi ayrıştırma ────────────────────────────────────────────────────

def extract_crsf(data: bytes):
    """MSP v1/v2 paketinden CRSF payload döner; yoksa None."""
    if len(data) < 4:
        return None

    # MSP v1: $ M > size cmd payload checksum
    if data[0:2] == b'$M' and len(data) >= 6:
        size = data[3]
        cmd  = data[4]
        if cmd == MSP_ELRS_BACKPACK_CRSF_TLM and len(data) >= 5 + size:
            return data[5: 5 + size]

    # MSP v2: $ X > flag func(2LE) size(2LE) payload crc
    if data[0:2] == b'$X' and len(data) >= 9:
        func = struct.unpack_from('<H', data, 4)[0]
        size = struct.unpack_from('<H', data, 6)[0]
        if func == MSP_ELRS_BACKPACK_CRSF_TLM and len(data) >= 8 + size:
            return data[8: 8 + size]

    # Ham CRSF sync byte ile başlıyorsa doğrudan ilet
    if data[0] == 0xC8:
        return data

    return None


# ── WebSocket yardımcıları ───────────────────────────────────────────────────

WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

def ws_handshake(conn: socket.socket) -> bool:
    """HTTP Upgrade握手 (handshake) gerçekleştirir. Başarılı → True."""
    try:
        raw = conn.recv(4096).decode("utf-8", errors="replace")
    except Exception:
        return False

    key = ""
    for line in raw.split("\r\n"):
        if line.lower().startswith("sec-websocket-key"):
            key = line.split(":", 1)[1].strip()
            break
    if not key:
        return False

    accept = base64.b64encode(
        hashlib.sha1((key + WS_MAGIC).encode()).digest()
    ).decode()

    resp = (
        "HTTP/1.1 101 Switching Protocols\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Accept: {accept}\r\n\r\n"
    )
    try:
        conn.sendall(resp.encode())
        return True
    except Exception:
        return False


def ws_frame(payload: bytes) -> bytes:
    """Ham byte'ları WebSocket binary frame'e sarar (FIN + opcode 0x02)."""
    ln = len(payload)
    if ln <= 125:
        header = struct.pack("BB", 0x82, ln)
    elif ln <= 65535:
        header = struct.pack("!BBH", 0x82, 126, ln)
    else:
        header = struct.pack("!BBQ", 0x82, 127, ln)
    return header + payload


def ws_send(conn: socket.socket, lock: threading.Lock, data: bytes) -> bool:
    """Thread-safe WebSocket binary frame gönderir. Başarılı → True."""
    frame = ws_frame(data)
    with lock:
        try:
            conn.sendall(frame)
            return True
        except Exception:
            return False


def client_reader(conn: socket.socket, lock: threading.Lock):
    """İstemciden gelen frame'leri okur (ping/close için gerekli)."""
    conn.settimeout(60)
    try:
        while True:
            b = conn.recv(2)
            if not b or len(b) < 2:
                break
            fin_op = b[0]
            mask_len = b[1]
            opcode = fin_op & 0x0F
            masked = bool(mask_len & 0x80)
            plen   = mask_len & 0x7F
            if plen == 126:
                conn.recv(2)
            elif plen == 127:
                conn.recv(8)
            if masked:
                conn.recv(4 + plen)
            else:
                conn.recv(plen)
            if opcode == 0x8:   # close
                break
            if opcode == 0x9:   # ping → pong
                pong = struct.pack("BB", 0x8A, 0)
                with lock:
                    conn.sendall(pong)
    except Exception:
        pass
    finally:
        with clients_lock:
            clients.pop(conn, None)
        try:
            conn.close()
        except Exception:
            pass
        print(f"[WS] İstemci ayrıldı. Aktif: {len(clients)}")


# ── WebSocket sunucusu ───────────────────────────────────────────────────────

def ws_server():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind((WS_HOST, WS_PORT))
    srv.listen(8)
    print(f"[WS]  Sunucu dinliyor : ws://localhost:{WS_PORT}/")

    while True:
        try:
            conn, addr = srv.accept()
        except Exception:
            break

        if not ws_handshake(conn):
            conn.close()
            continue

        lock = threading.Lock()
        with clients_lock:
            clients[conn] = lock
        print(f"[WS]  Bağlandı: {addr}  Aktif: {len(clients)}")

        t = threading.Thread(target=client_reader, args=(conn, lock), daemon=True)
        t.start()


# ── UDP dinleyici ────────────────────────────────────────────────────────────

def broadcast(raw: bytes):
    dead = []
    with clients_lock:
        snapshot = list(clients.items())
    for conn, lock in snapshot:
        if not ws_send(conn, lock, raw):
            dead.append(conn)
    if dead:
        with clients_lock:
            for c in dead:
                clients.pop(c, None)


def udp_listener():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(("0.0.0.0", UDP_PORT))
    print(f"[UDP] Dinleniyor     : 0.0.0.0:{UDP_PORT}")

    pkt_count = 0
    while True:
        try:
            data, addr = sock.recvfrom(4096)
        except Exception as e:
            print(f"[UDP] Hata: {e}")
            time.sleep(0.1)
            continue

        pkt_count += 1
        print(f"[UDP] Paket #{pkt_count} from {addr}  len={len(data)}  hex={data[:16].hex()}")

        crsf = extract_crsf(data)
        if crsf:
            print(f"[UDP] CRSF çözüldü, yayınlanıyor ({len(crsf)} byte)")
            broadcast(bytes(crsf))
        else:
            # CRSF formatı eşleşmedi → ham veriyi doğrudan yayınla
            print(f"[UDP] CRSF yok, ham veri yayınlanıyor")
            broadcast(data)


# ── Ana giriş ────────────────────────────────────────────────────────────────

def start_ws_server():
    while True:
        try:
            ws_server()
        except Exception as e:
            print(f"[WS]  Hata, yeniden başlatılıyor: {e}")
            time.sleep(2)


def start_udp_listener():
    while True:
        try:
            udp_listener()
        except Exception as e:
            print(f"[UDP] Hata, yeniden başlatılıyor: {e}")
            time.sleep(2)


if __name__ == "__main__":
    print("=" * 52)
    print("  ELRS Backpack → WebSocket Köprüsü")
    print("=" * 52)
    print()

    t_ws  = threading.Thread(target=start_ws_server,   daemon=True)
    t_udp = threading.Thread(target=start_udp_listener, daemon=True)

    t_ws.start()
    time.sleep(0.2)   # WS sunucu başlasın
    t_udp.start()

    print()
    print("  Adımlar:")
    print("  1. ELRS LUA → Backpack → Telemetry = WiFi")
    print("  2. Bu bilgisayarı backpack WiFi'ına bağlayın")
    print("  3. elrs_backpack.html → IP:127.0.0.1 Port:8765 → Bağlan")
    print()
    print("  Durdurmak için: Ctrl+C")
    print("=" * 52)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[*] Kapatılıyor...")
