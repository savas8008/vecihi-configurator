cmake_minimum_required(VERSION 3.16)
project(XFlightConfigurator CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ─── WebView2 SDK ─────────────────────────────────────────────────────────────
# WebView2.h beklenen yer: desktop/lib/WebView2.h
# build.bat tarafından NuGet'ten otomatik indirilir.
set(WEBVIEW2_INCLUDE_DIR "${CMAKE_SOURCE_DIR}/lib")

if(NOT EXISTS "${WEBVIEW2_INCLUDE_DIR}/WebView2.h")
    message(FATAL_ERROR
        "WebView2.h bulunamadı: ${WEBVIEW2_INCLUDE_DIR}/WebView2.h\n"
        "Lütfen önce build.bat çalıştırın (WebView2 SDK otomatik indirilir)."
    )
endif()

# ─── Hedef: Windows GUI exe (konsol yok) ─────────────────────────────────────
add_executable(XFlightConfigurator WIN32
    main.cpp
    mongoose.c
)

target_include_directories(XFlightConfigurator PRIVATE
    ${CMAKE_SOURCE_DIR}          # webview.h, mongoose.h
    ${WEBVIEW2_INCLUDE_DIR}      # WebView2.h
)

target_compile_definitions(XFlightConfigurator PRIVATE
    UNICODE
    _UNICODE
    WIN32_LEAN_AND_MEAN
    # Mongoose Windows yapılandırması
    MG_ENABLE_MBEDTLS=0
    MG_ENABLE_OPENSSL=0
)

target_link_libraries(XFlightConfigurator PRIVATE
    ole32
    user32
    advapi32
    shell32
    shlwapi
    gdi32
    version
    Dbghelp
)

# ─── Build sonrası: exe'yi proje köküne kopyala ──────────────────────────────
add_custom_command(TARGET XFlightConfigurator POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy
        "$<TARGET_FILE:XFlightConfigurator>"
        "${CMAKE_SOURCE_DIR}/../XFlightConfigurator.exe"
    COMMENT "XFlightConfigurator.exe proje köküne kopyalanıyor..."
)
