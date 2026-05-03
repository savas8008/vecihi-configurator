# Copyright (c) 2024-2026 savas8008 - All Rights Reserved
# Bu dosyanin izinsiz kopyalanmasi, degistirilmesi veya dagitilmasi yasaktir.

"""
Local launcher for the configurator's "Yer Kontrol" button.

Browsers cannot start Python scripts directly. Run this helper first, then the
button can ask it to launch the MAVLink proxy through localhost.

Usage:
    python tools/ground_control_launcher.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
HOST = "127.0.0.1"
PORT = int(os.environ.get("GROUND_CONTROL_LAUNCHER_PORT", "8766"))
DEFAULT_SCRIPTS = ["tools/mavlink_ws_proxy.py"]
running_processes: dict[str, subprocess.Popen] = {}


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
        proc = running_processes.get(key)
        if proc and proc.poll() is None:
            launched.append(str(script.relative_to(REPO_ROOT)) + " (already running)")
            continue

        proc = subprocess.Popen(
            [sys.executable, str(script)],
            cwd=str(REPO_ROOT),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        running_processes[key] = proc
        launched.append(str(script.relative_to(REPO_ROOT)))

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
    server = ThreadingHTTPServer((HOST, PORT), LauncherHandler)
    print(f"Ground control launcher listening on http://{HOST}:{PORT}")
    print("Press Ctrl+C to stop.")
    server.serve_forever()


if __name__ == "__main__":
    main()
