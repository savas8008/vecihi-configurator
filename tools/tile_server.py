# Copyright (c) 2024-2026 savas8008 - All Rights Reserved
"""
Offline MBTiles tile server for elrs_backpack.html.

Endpoints:
  GET  /api/maps                     - list available .mbtiles files
  GET  /tiles/{map}/{z}/{x}/{y}.png  - serve a tile
  POST /api/download/area            - download OSM tiles for a bounding box
  POST /api/download/url             - download an .mbtiles file from a URL
  GET  /api/download/progress        - current download progress (poll)
  POST /api/maps/delete              - delete a map file
"""

from __future__ import annotations

import json
import math
import os
import sqlite3
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

MAPS_DIR = Path(__file__).resolve().parents[1] / "maps"
HOST = "127.0.0.1"
PORT = int(os.environ.get("TILE_SERVER_PORT", "8767"))

_TRANSPARENT_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x01\x00\x00\x00\x01\x00"
    b"\x08\x06\x00\x00\x00o\x1f\\\xe8\x00\x00\x00\x0bIDATx\x9cc\xf8\x0f\x00"
    b"\x00\x01\x01\x00\x05\x18\xd5H\x00\x00\x00\x00IEND\xaeB`\x82"
)

_dl_lock = threading.Lock()
_dl_state: dict = {"active": False, "name": "", "done": 0, "total": 0, "error": ""}

_OSM_AGENTS = ["a", "b", "c"]
_osm_idx = 0
_osm_lock = threading.Lock()


# ── helpers ──────────────────────────────────────────────────────────────────

def _flip_y(z: int, y: int) -> int:
    return (1 << z) - 1 - y


def _deg2tile(lat: float, lon: float, z: int) -> tuple[int, int]:
    n = 1 << z
    x = int((lon + 180.0) / 360.0 * n)
    lat_r = math.radians(lat)
    y = int((1.0 - math.log(math.tan(lat_r) + 1.0 / math.cos(lat_r)) / math.pi) / 2.0 * n)
    return max(0, min(n - 1, x)), max(0, min(n - 1, y))


def _tiles_for_bbox(w: float, s: float, e: float, n: float, z: int) -> list[tuple[int, int, int]]:
    x1, y1 = _deg2tile(n, w, z)
    x2, y2 = _deg2tile(s, e, z)
    return [
        (z, x, y)
        for x in range(min(x1, x2), max(x1, x2) + 1)
        for y in range(min(y1, y2), max(y1, y2) + 1)
    ]


def _fetch_osm_tile(z: int, x: int, y: int) -> bytes | None:
    global _osm_idx
    with _osm_lock:
        s = _OSM_AGENTS[_osm_idx % 3]
        _osm_idx += 1
    url = f"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    req = urllib.request.Request(url, headers={"User-Agent": "XFlight-GCS/1.0 personal-offline"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.read()
    except Exception:
        return None


def _get_tile(db_path: str, z: int, x: int, y: int) -> bytes | None:
    y_tms = _flip_y(z, y)
    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        row = conn.execute(
            "SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?",
            (z, x, y_tms),
        ).fetchone()
        conn.close()
        return bytes(row[0]) if row else None
    except Exception:
        return None


def _list_maps() -> list[dict]:
    MAPS_DIR.mkdir(exist_ok=True)
    result = []
    for f in sorted(MAPS_DIR.glob("*.mbtiles")):
        meta: dict[str, str] = {}
        try:
            conn = sqlite3.connect(str(f))
            meta = dict(conn.execute("SELECT name, value FROM metadata").fetchall())
            conn.close()
        except Exception:
            pass
        result.append({
            "name": f.stem,
            "file": f.name,
            "size_mb": round(f.stat().st_size / 1024 / 1024, 1),
            "description": meta.get("description", f.stem),
            "bounds": meta.get("bounds", ""),
            "minzoom": int(meta.get("minzoom", 0)),
            "maxzoom": int(meta.get("maxzoom", 18)),
        })
    return result


def _init_mbtiles(conn: sqlite3.Connection, name: str, w: float, s: float, e: float, n: float, minz: int, maxz: int) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS metadata (name TEXT, value TEXT);
        CREATE TABLE IF NOT EXISTS tiles (
            zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB
        );
        CREATE UNIQUE INDEX IF NOT EXISTS tile_index ON tiles (zoom_level, tile_column, tile_row);
    """)
    for k, v in [
        ("name", name), ("type", "baselayer"), ("version", "1.1"),
        ("format", "png"), ("minzoom", str(minz)), ("maxzoom", str(maxz)),
        ("bounds", f"{w},{s},{e},{n}"),
        ("description", f"OSM {w:.3f},{s:.3f},{e:.3f},{n:.3f} z{minz}-{maxz}"),
    ]:
        conn.execute("INSERT OR REPLACE INTO metadata VALUES (?,?)", (k, v))
    conn.commit()


# ── background tasks ──────────────────────────────────────────────────────────

def _download_area(name: str, w: float, s: float, e: float, n: float, minz: int, maxz: int) -> None:
    MAPS_DIR.mkdir(exist_ok=True)
    out = MAPS_DIR / f"{name}.mbtiles"
    all_tiles = [t for z in range(minz, maxz + 1) for t in _tiles_for_bbox(w, s, e, n, z)]

    with _dl_lock:
        _dl_state.update(active=True, name=name, done=0, total=len(all_tiles), error="")

    conn = sqlite3.connect(str(out))
    _init_mbtiles(conn, name, w, s, e, n, minz, maxz)
    try:
        for i, (z, x, y) in enumerate(all_tiles):
            data = _fetch_osm_tile(z, x, y)
            if data:
                conn.execute(
                    "INSERT OR IGNORE INTO tiles VALUES (?,?,?,?)",
                    (z, x, _flip_y(z, y), data),
                )
            if i % 100 == 0:
                conn.commit()
            with _dl_lock:
                _dl_state["done"] = i + 1
            time.sleep(0.05)
        conn.commit()
    except Exception as exc:
        with _dl_lock:
            _dl_state["error"] = str(exc)
    finally:
        conn.close()
        with _dl_lock:
            _dl_state["active"] = False


def _download_url(name: str, url: str) -> None:
    MAPS_DIR.mkdir(exist_ok=True)
    out = MAPS_DIR / f"{name}.mbtiles"
    with _dl_lock:
        _dl_state.update(active=True, name=name, done=0, total=-1, error="")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "XFlight-GCS/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            total = int(resp.headers.get("Content-Length", 0))
            with _dl_lock:
                _dl_state["total"] = total
            done = 0
            with open(out, "wb") as f:
                while True:
                    chunk = resp.read(65536)
                    if not chunk:
                        break
                    f.write(chunk)
                    done += len(chunk)
                    with _dl_lock:
                        _dl_state["done"] = done
    except Exception as exc:
        with _dl_lock:
            _dl_state["error"] = str(exc)
    finally:
        with _dl_lock:
            _dl_state["active"] = False


# ── HTTP handler ──────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length)) if length else {}

    def do_OPTIONS(self) -> None:
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        path = self.path.split("?")[0]

        if path == "/api/maps":
            self._json(200, {"maps": _list_maps()})

        elif path == "/api/download/progress":
            with _dl_lock:
                self._json(200, dict(_dl_state))

        elif path.startswith("/tiles/"):
            parts = path.strip("/").split("/")
            if len(parts) < 5:
                self.send_response(404)
                self.end_headers()
                return
            try:
                map_name = parts[1]
                z, x = int(parts[2]), int(parts[3])
                y = int(parts[4].replace(".png", "").replace(".jpg", ""))
                db = str(MAPS_DIR / f"{map_name}.mbtiles")
                tile = _get_tile(db, z, x, y)
                if tile:
                    self.send_response(200)
                    self.send_header("Content-Type", "image/png")
                    self.send_header("Content-Length", str(len(tile)))
                    self.send_header("Cache-Control", "public, max-age=86400")
                    self._cors()
                    self.end_headers()
                    self.wfile.write(tile)
                else:
                    self.send_response(200)
                    self.send_header("Content-Type", "image/png")
                    self.send_header("Content-Length", str(len(_TRANSPARENT_PNG)))
                    self._cors()
                    self.end_headers()
                    self.wfile.write(_TRANSPARENT_PNG)
            except Exception:
                self.send_response(500)
                self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self) -> None:
        path = self.path.split("?")[0]
        body = self._read_body()

        if path == "/api/download/area":
            with _dl_lock:
                if _dl_state["active"]:
                    self._json(409, {"ok": False, "error": "Zaten bir indirme devam ediyor."})
                    return
            name = body.get("name", "map")
            minz = int(body.get("minzoom", 10))
            maxz = int(body.get("maxzoom", 14))
            w, s, e, n = float(body["west"]), float(body["south"]), float(body["east"]), float(body["north"])
            total = sum(len(_tiles_for_bbox(w, s, e, n, z)) for z in range(minz, maxz + 1))
            if total > 5000:
                self._json(400, {"ok": False, "error": f"Çok fazla tile ({total:,}). Alanı veya zoom aralığını küçültün (max 5000)."})
                return
            threading.Thread(target=_download_area, args=(name, w, s, e, n, minz, maxz), daemon=True).start()
            self._json(200, {"ok": True, "total": total})

        elif path == "/api/download/url":
            with _dl_lock:
                if _dl_state["active"]:
                    self._json(409, {"ok": False, "error": "Zaten bir indirme devam ediyor."})
                    return
            name = body.get("name", "map")
            url = body.get("url", "")
            if not url:
                self._json(400, {"ok": False, "error": "url gerekli."})
                return
            threading.Thread(target=_download_url, args=(name, url), daemon=True).start()
            self._json(200, {"ok": True})

        elif path == "/api/maps/delete":
            f = MAPS_DIR / f"{body.get('name', '')}.mbtiles"
            if f.exists():
                f.unlink()
                self._json(200, {"ok": True})
            else:
                self._json(404, {"ok": False, "error": "Dosya bulunamadı."})
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, *_: object) -> None:
        return


def main() -> None:
    MAPS_DIR.mkdir(exist_ok=True)
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Tile server listening on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
