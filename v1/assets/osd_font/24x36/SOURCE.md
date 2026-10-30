# Kaynak

Bu klasördeki glif görselleri INAV Configurator projesinden alınmıştır:

- Repo: https://github.com/iNavFlight/inav-configurator
- Yol: `resources/osd/digital/default/24x36/`
- Alındığı commit: `07b87c04dbc8ddc8bffc905ba0c9a5aa12362b76` (2026-07-13)
- Lisans: GNU GPLv3 (yukarıdaki repo'nun `LICENSE` dosyası)

Dosya adları karakter koduna (decimal) karşılık gelir — örn. `001.png` = `SYM_RSSI` (0x01),
`002.png` = `SYM_LQ` (0x02). Çoklu karakter aralığı olanlar `418-422.png` gibi tire/alt çizgiyle
adlandırılmıştır. Tam eşleşme tablosu için bkz. INAV Configurator'daki
`resources/osd/INAV Character Map.md`.

24x36 boyutu, DJI O3/O4 dijital HD canvas modunun (MSP DisplayPort) karakter hücre boyutuyla eşleşir —
bu proje bu modu hedeflediği için diğer boyutlar (12x18, 36x54) alınmamıştır.
