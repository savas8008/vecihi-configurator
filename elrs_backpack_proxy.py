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

UDP_PORT       = 14550
UDP_SCAN_PORTS = [14550, 14551, 5760, 5761, 4000, 4001, 2399, 8765]
BACKPACK_IP    = "10.0.0.1"
WS_HOST        = "0.0.0.0"
WS_PORT        = 8765

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


def udp_scanner(port):
    """Ek portlarda veri arar — hangi portta geldiğini tespit eder."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(("0.0.0.0", port))
        sock.settimeout(0.5)
        while True:
            try:
                data, addr = sock.recvfrom(4096)
                print(f"[SCAN] !!! VERİ BULUNDU port={port} from={addr} len={len(data)} hex={data[:16].hex()}")
                broadcast(data)
            except socket.timeout:
                continue
            except Exception:
                break
    except OSError as e:
        print(f"[SCAN] Port {port} açılamadı: {e}")


def backpack_probe():
    """10.0.0.1'de hangi TCP portları açık? WebSocket var mı?"""
    time.sleep(3)  # Ağ bağlantısını bekle
    print(f"\n[PROBE] Backpack {BACKPACK_IP} port taraması...")
    open_ports = []
    for p in [80, 81, 443, 1234, 5760, 8765, 8080, 8888]:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(1)
            result = s.connect_ex((BACKPACK_IP, p))
            s.close()
            if result == 0:
                open_ports.append(p)
                print(f"[PROBE] TCP port {p} AÇIK!")
        except Exception:
            pass
    if not open_ports:
        print(f"[PROBE] Hiçbir TCP portu açık değil")
    else:
        print(f"[PROBE] Açık portlar: {open_ports}")
    print()


def ws_client_handshake(sock, host, path="/"):
    """Backpack'e WebSocket client olarak bağlanır."""
    key = base64.b64encode(b"elrsproxy12345678").decode()
    req = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host}\r\n"
        f"Upgrade: websocket\r\n"
        f"Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        f"Sec-WebSocket-Version: 13\r\n\r\n"
    )
    sock.sendall(req.encode())
    resp = sock.recv(4096).decode("utf-8", errors="replace")
    first_line = resp.split("\r\n")[0] if resp else "BOŞ YANIT"
    print(f"[BKPK] {path} → {first_line}")
    return "101" in resp


def ws_client_recv_frame(sock):
    """Backpack'ten bir WebSocket frame okur."""
    header = b""
    while len(header) < 2:
        chunk = sock.recv(2 - len(header))
        if not chunk:
            return None
        header += chunk
    plen = header[1] & 0x7F
    if plen == 126:
        ext = b""
        while len(ext) < 2:
            ext += sock.recv(2 - len(ext))
        plen = struct.unpack("!H", ext)[0]
    elif plen == 127:
        ext = b""
        while len(ext) < 8:
            ext += sock.recv(8 - len(ext))
        plen = struct.unpack("!Q", ext)[0]
    payload = b""
    while len(payload) < plen:
        chunk = sock.recv(plen - len(payload))
        if not chunk:
            return None
        payload += chunk
    return payload


def backpack_ws_client():
    """Backpack WebSocket sunucusuna bağlanır, veriyi alıp yayınlar."""
    paths = ["/", "/ws", "/telemetry"]
    while True:
        for path in paths:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(5)
                sock.connect((BACKPACK_IP, 80))
                if not ws_client_handshake(sock, BACKPACK_IP, path):
                    sock.close()
                    continue
                sock.settimeout(10)
                print(f"[BKPK] BAĞLANDI: ws://{BACKPACK_IP}:80{path}")
                pkt = 0
                while True:
                    data = ws_client_recv_frame(sock)
                    if data is None:
                        print(f"[BKPK] Bağlantı koptu, yeniden deneniyor...")
                        break
                    pkt += 1
                    print(f"[BKPK] Frame #{pkt} len={len(data)} hex={data[:16].hex()}")
                    crsf = extract_crsf(data)
                    broadcast(bytes(crsf) if crsf else data)
                sock.close()
            except Exception:
                pass
        time.sleep(3)


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

    t_ws    = threading.Thread(target=start_ws_server,    daemon=True)
    t_udp   = threading.Thread(target=start_udp_listener, daemon=True)
    t_probe = threading.Thread(target=backpack_probe,     daemon=True)
    t_bkpk  = threading.Thread(target=backpack_ws_client, daemon=True)

    t_ws.start()
    time.sleep(0.2)
    t_udp.start()
    t_probe.start()
    t_bkpk.start()

    # Ek portlarda tarama
    for p in UDP_SCAN_PORTS:
        if p != UDP_PORT:
            threading.Thread(target=udp_scanner, args=(p,), daemon=True).start()

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
