# Copyright (c) 2024-2026 savas8008 - All Rights Reserved
# Bu dosyanin izinsiz kopyalanmasi, degistirilmesi veya dagitilmasi yasaktir.

"""
Local launcher for elrs_backpack.html's automatic proxy startup.

Browsers cannot start Python scripts directly. Run this helper first (see
tools/start_ground_control.cmd), then elrs_backpack.html can ask it to launch
the MAVLink proxy through localhost the moment the page opens.

Usage:
    python tools/ground_control_launcher.py
"""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# Windows'ta yönlendirilmiş çıktı yerel kod sayfasıyla (örn. cp1254) açılabilir;
# bir Unicode karakter bunu UnicodeEncodeError'a çevirip süreci çökertebilir
# (bkz. mavlink_ws_proxy.py'de yaşanan olay). UTF-8'e zorlayıp koruyoruz.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)


REPO_ROOT = Path(__file__).resolve().parents[1]
LOG_DIR = REPO_ROOT / "tools" / "logs"
HOST = "127.0.0.1"
PORT = int(os.environ.get("GROUND_CONTROL_LAUNCHER_PORT", "8766"))
DEFAULT_SCRIPTS = ["tools/mavlink_ws_proxy.py"]
# Betiğin zaten (başka bir launcher oturumundan kalma, tarafımızca izlenmeyen)
# bir örneği ayakta mı diye bakmak için dinlediği bilinen port — bkz. asagida
# _is_already_serving().
KNOWN_PORTS = {"tools/mavlink_ws_proxy.py": ("127.0.0.1", 8765)}
running_processes: dict[str, subprocess.Popen] = {}


def _is_already_serving(rel_path: str) -> bool:
    target = KNOWN_PORTS.get(rel_path)
    if not target:
        return False
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.settimeout(0.3)
        try:
            probe.connect(target)
            return True
        except OSError:
            return False


def _script_paths() -> list[Path]:
    raw = os.environ.get("GROUND_CONTROL_SCRIPTS", "")
    items = raw.split(os.pathsep) if raw else DEFAULT_SCRIPTS
    paths: list[Path] = []

    for item in items:
        item = item.strip().strip('"')
        if not item:
            continue

        path = (REPO_ROOT / item).resolve()
        if REPO_ROOT not in path.parents and path != REPO_ROOT:
            raise ValueError(f"Script repo disinda: {path}")
        if path.suffix.lower() != ".py":
            raise ValueError(f"Yalnizca .py dosyalari calistirilir: {path}")
        if not path.exists():
            raise FileNotFoundError(path)

        paths.append(path)

    return paths


def launch_scripts() -> list[str]:
    launched: list[str] = []

    for script in _script_paths():
        key = str(script)
        rel_path = str(script.relative_to(REPO_ROOT)).replace("\\", "/")

        proc = running_processes.get(key)
        if proc and proc.poll() is None:
            launched.append(f"{rel_path} (already running)")
            continue

        if _is_already_serving(rel_path):
            # Bizim izlemediğimiz (örn. önceki launcher oturumundan kalma)
            # bir örnek zaten o portu dinliyor — üstüne ikinci bir tane
            # başlatmaya çalışmak Windows'ta anında "address already in use"
            # ile çökerdi; bunun yerine mevcut örneği kabul ediyoruz.
            launched.append(f"{rel_path} (already running, dış süreç)")
            continue

        log_path = LOG_DIR / f"{script.stem}.log"
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_file = open(log_path, "a", encoding="utf-8")
        try:
            proc = subprocess.Popen(
                [sys.executable, str(script)],
                cwd=str(REPO_ROOT),
                stdout=log_file,
                stderr=log_file,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
        finally:
            log_file.close()  # child bağımsız bir handle kopyası tutar

        time.sleep(0.4)  # başlangıçta çökme (örn. port çakışması) olup olmadığını görmek için kısa bekleme
        if proc.poll() is not None:
            tail = ""
            if log_path.exists():
                tail = log_path.read_text(encoding="utf-8", errors="ignore")[-500:]
            raise RuntimeError(f"{rel_path} başlatılamadı (çıkış kodu {proc.returncode}): {tail or 'log boş'}")

        running_processes[key] = proc
        launched.append(rel_path)

    return launched


class LauncherHandler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self._send_json(200, {"ok": True})

    def do_GET(self) -> None:
        self._send_json(200, {"ok": True, "service": "ground_control_launcher"})

    def do_POST(self) -> None:
        if self.path != "/launch-ground-control":
            self._send_json(404, {"ok": False, "error": "not_found"})
            return

        try:
            launched = launch_scripts()
            self._send_json(200, {"ok": True, "launched": launched})
        except Exception as exc:
            self._send_json(500, {"ok": False, "error": str(exc)})

    def log_message(self, format: str, *args: object) -> None:
        return


def main() -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.settimeout(0.3)
        try:
            probe.connect((HOST, PORT))
            already_running = True
        except OSError:
            already_running = False
    if already_running:
        # http.server varsayılan olarak SO_REUSEADDR açık geldiğinden Windows
        # ikinci bir örneğin aynı porta sessizce bağlanmasına izin verir —
        # hangi isteğin hangi sürece gideceği belirsizleşir. Bunun yerine çık.
        print(f"Zaten çalışıyor: http://{HOST}:{PORT} — ikinci bir örnek başlatılmadı.")
        return

    server = ThreadingHTTPServer((HOST, PORT), LauncherHandler)
    print(f"Ground control launcher listening on http://{HOST}:{PORT}")
    print("Press Ctrl+C to stop.")
    server.serve_forever()


if __name__ == "__main__":
    main()
