#!/usr/bin/env python3
"""
ELRS Pasif Dinleyici — Temel Tanı Aracı
========================================
Sadece gelen UDP paketlerini dinler ve hex döker.
Heartbeat/kayıt mantığı YOK — saf dinleyici.

Kullanım:
    python elrs_dinle.py
"""

import socket
import threading
import time
import struct

BACKPACK_IP = "10.0.0.1"

# Dinlenecek portlar
LISTEN_PORTS = [14550, 14551, 14555, 14556, 5760, 5761, 4000]

# Test gönderimi için hedef portlar (backpack bunu dinliyor olabilir)
SEND_PORTS = [14550, 14555]

lock_print = threading.Lock()
found_any = threading.Event()


def hprint(*args):
    with lock_print:
        print(*args, flush=True)


def hexdump(data: bytes, prefix="  ") -> str:
    lines = []
    for i in range(0, len(data), 16):
        chunk = data[i:i+16]
        hex_part = " ".join(f"{b:02x}" for b in chunk)
        asc_part = "".join(chr(b) if 32 <= b < 127 else "." for b in chunk)
        lines.append(f"{prefix}{i:04x}  {hex_part:<48}  {asc_part}")
    return "\n".join(lines)


def protocol_hint(data: bytes) -> str:
    if not data:
        return "BOŞ"
    if data[0] == 0xFE:
        return f"MAVLink v1  msg_id={data[5] if len(data)>5 else '?'}"
    if data[0] == 0xFD:
        return f"MAVLink v2  msg_id={data[7] if len(data)>7 else '?'}"
    if data[0] == 0xC8:
        return f"CRSF  type={data[2] if len(data)>2 else '?'}"
    if data[:2] == b'$M':
        return "MSP v1"
    if data[:2] == b'$X':
        return "MSP v2"
    if data[0] in (0x47, 0x55) or b'ELRS' in data[:32]:
        return "ELRS raw"
    return f"Bilinmiyor  ilk_byte=0x{data[0]:02x}"


def listen_udp(port: int):
    """Verilen portu dinle, gelen her paketi hex döker."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        # Windows: ICMP Port Unreachable → WinError 10054 engeli kaldır
        try:
            s.ioctl(-1744830452, False)
        except Exception:
            pass
        s.bind(("0.0.0.0", port))
        s.settimeout(0.5)
        hprint(f"[DINLE] UDP:{port} açıldı ✓")
    except OSError as e:
        hprint(f"[DINLE] UDP:{port} açılamadı: {e}")
        return

    pkt_no = 0
    while True:
        try:
            data, addr = s.recvfrom(4096)
        except socket.timeout:
            continue
        except OSError as e:
            if getattr(e, 'winerror', None) == 10054:
                continue
            hprint(f"[DINLE] UDP:{port} hata: {e}")
            time.sleep(0.2)
            continue

        pkt_no += 1
        found_any.set()
        hint = protocol_hint(data)
        hprint(
            f"\n{'='*60}\n"
            f"[!!!] UDP:{port}  paket #{pkt_no}  kaynak={addr[0]}:{addr[1]}\n"
            f"      len={len(data)}  protokol={hint}\n"
            f"{hexdump(data)}"
        )


def _mavlink_heartbeat(seq=0) -> bytes:
    """GCS kimliğiyle MAVLink v1 HEARTBEAT."""
    payload = struct.pack('<IBBBBB', 0, 6, 8, 192, 0, 3)
    crc = 0xFFFF
    for b in bytes([len(payload), seq, 255, 190, 0]) + payload + bytes([50]):
        crc ^= b
        for _ in range(8):
            crc = (crc >> 1) ^ 0x8408 if crc & 1 else crc >> 1
    return bytes([0xFE, len(payload), seq, 255, 190, 0]) + payload + struct.pack('<H', crc)


def send_probe():
    """
    İsteğe bağlı: SEND_PORTS'a MAVLink heartbeat gönder.
    Backpack 'Uplink' sayacı artarsa port doğru demektir.
    """
    time.sleep(2)  # Dinleyicilerin açılmasını bekle

    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    seq = 0

    hprint(f"\n[PROBE] {BACKPACK_IP} portlarına MAVLink heartbeat gönderiliyor...")
    hprint(f"[PROBE] Hedef portlar: {SEND_PORTS}")
    hprint(f"[PROBE] Backpack web UI'nda (http://{BACKPACK_IP}) 'Packets Uplink' artıyor mu?")
    hprint()

    while True:
        hb = _mavlink_heartbeat(seq)
        seq = (seq + 1) & 0xFF
        for port in SEND_PORTS:
            try:
                s.sendto(hb, (BACKPACK_IP, port))
            except Exception as e:
                hprint(f"[PROBE] {BACKPACK_IP}:{port} gönderim hatası: {e}")
        if seq <= 3 or seq % 10 == 0:
            hprint(f"[PROBE] Heartbeat #{seq} → {BACKPACK_IP}:{SEND_PORTS}  (paket bekleniyor={found_any.is_set()})")
        time.sleep(1)


def local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect((BACKPACK_IP, 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "?"


if __name__ == "__main__":
    print("=" * 60)
    print("  ELRS Pasif Dinleyici — Temel Tanı Aracı")
    print("=" * 60)

    lip = local_ip()
    print(f"  Lokal IP   : {lip}")
    print(f"  Backpack   : {BACKPACK_IP}")
    print(f"  Dinlenen   : UDP {LISTEN_PORTS}")
    print(f"  Gönderilen : UDP → {BACKPACK_IP}:{SEND_PORTS}")
    print()
    print("  Beklenen: Backpack'ten herhangi bir portta UDP paketi")
    print("  Eğer paket gelmiyorsa → Firewall sorununa bakın")
    print()
    print("  CTRL+C ile durdur")
    print("=" * 60)
    print()

    # Dinleyici thread'leri başlat
    for p in LISTEN_PORTS:
        threading.Thread(target=listen_udp, args=(p,), daemon=True).start()

    # Heartbeat gönderme thread'i
    threading.Thread(target=send_probe, daemon=True).start()

    try:
        start = time.time()
        while True:
            time.sleep(5)
            elapsed = int(time.time() - start)
            if not found_any.is_set():
                print(f"[{elapsed:4d}s] Henüz paket gelmedi. "
                      f"Backpack web UI: http://{BACKPACK_IP} → 'Packets Uplink' artıyor mu?")
    except KeyboardInterrupt:
        print("\n[*] Kapatılıyor...")
        if found_any.is_set():
            print("[*] En az bir paket alındı — yukarıdaki hex dump'a bakın.")
        else:
            print("[*] Hiç paket alınamadı.")
            print()
            print("  Olası nedenler:")
            print("  1. Windows Firewall: FIREWALL_EKLE.bat yönetici olarak çalıştırın")
            print("  2. Yanlış ağ: Bu bilgisayar 10.0.0.x ağında mı?")
            print(f"     Şu an tespit edilen IP: {lip}")
            print(f"     10.0.0.x ağında olmalı, şu an: {'✓' if lip.startswith('10.0.') else '✗ HAYIR!'}")
            print("  3. Backpack portunu kontrol edin:")
            print(f"     http://{BACKPACK_IP} → MavLink sayfası → Listen/Send portları")
