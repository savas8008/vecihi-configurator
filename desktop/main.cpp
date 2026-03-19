/**
 * X-Flight Configurator - Masaüstü Uygulama
 *
 * Bu dosya, X-Flight Configurator'ü Chrome olmadan kendi penceresinde
 * çalıştıran native bir Windows exe'si oluşturur.
 *
 * Mimari:
 *   - mongoose: Proje dosyalarını localhost:8888'den serve eder
 *   - webview (WebView2/Edge): Native pencere içinde HTML/JS çalıştırır
 *   - Web Serial API, WebView2 üzerinden tam desteklenir
 *
 * Derleme: desktop/build.bat (Windows, MinGW-w64)
 */

// Mongoose yapılandırması - Windows için
#define MG_ENABLE_MBEDTLS 0
#define MG_ENABLE_OPENSSL 0

// Webview - gömülü WebView2Loader kullan (DLL olmadan)
#define WEBVIEW_WIN_IMPL_WEBVIEW2_LOADER
#include "webview.h"

// Mongoose tek-dosya HTTP sunucusu
extern "C" {
#include "mongoose.h"
}

#include <windows.h>
#include <string>
#include <thread>
#include <atomic>
#include <shlwapi.h>

#pragma comment(lib, "Shlwapi.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "advapi32.lib")

#define XFLIGHT_PORT "8888"
#define XFLIGHT_URL  "http://localhost:" XFLIGHT_PORT "/configurator.html"

// ─── Global durum ────────────────────────────────────────────────────────────
static std::atomic<bool> g_stop{false};
static std::string g_root_dir;

// ─── HTTP Sunucu (mongoose) ───────────────────────────────────────────────────
static void http_handler(struct mg_connection *c, int ev, void *ev_data) {
    if (ev == MG_EV_HTTP_MSG) {
        struct mg_http_serve_opts opts = {};
        opts.root_dir = g_root_dir.c_str();
        mg_http_serve_dir(c, (struct mg_http_message *)ev_data, &opts);
    }
}

static void run_server() {
    struct mg_mgr mgr;
    mg_mgr_init(&mgr);
    mg_http_listen(&mgr, "http://localhost:" XFLIGHT_PORT, http_handler, NULL);
    while (!g_stop.load()) {
        mg_mgr_poll(&mgr, 100);
    }
    mg_mgr_free(&mgr);
}

// ─── Exe dizinini bul ────────────────────────────────────────────────────────
static std::string get_exe_dir() {
    char path[MAX_PATH] = {};
    GetModuleFileNameA(NULL, path, MAX_PATH);
    PathRemoveFileSpecA(path);
    return std::string(path);
}

// ─── WinMain - konsol penceresi yok ─────────────────────────────────────────
int WINAPI WinMain(HINSTANCE, HINSTANCE, LPSTR, int) {
    // Proje kökünü exe'nin bulunduğu dizin olarak ayarla.
    // build.bat exe'yi proje köküne (desktop/ değil) kopyalar.
    g_root_dir = get_exe_dir();

    // HTTP sunucuyu arka plan thread'inde başlat
    std::thread server_thread(run_server);

    // Sunucunun dinlemeye başlaması için kısa bekleme
    Sleep(250);

    // ─── WebView2 penceresi ───────────────────────────────────────────────
    webview::webview w(false /*debug*/, nullptr /*parent_hwnd*/);
    w.set_title("X-Flight Configurator");
    w.set_size(1440, 900, WEBVIEW_HINT_NONE);
    w.navigate(XFLIGHT_URL);
    w.run(); // Pencere kapanana kadar burada bekler

    // ─── Temizlik ─────────────────────────────────────────────────────────
    g_stop.store(true);
    server_thread.join();

    return 0;
}
