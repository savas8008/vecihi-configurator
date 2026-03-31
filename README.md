<div align="center">
  <h1>Vecihi Flight Controller</h1>
  <p><strong>ESP32 Tabanlı, Web Arayüzlü Uçuş Kontrol Yazılımı</strong></p>
</div>

---

## 📖 Proje Hakkında
**Vecihi**, ESP32 (WROOM) mimarisi üzerinde çalışan, modern ve erişilebilir bir uçuş kontrol yazılımıdır. 
## 🛠️ Desteklenen Donanımlar ve Modüller

Sensör okumaları, uçuş dinamiği hesaplamaları ve OSD haberleşmesi gibi işlemler ESP32'nin çift çekirdekli yapısı kullanılarak optimize edilmiş bir şekilde yürütülür. Sistem şu an için aşağıdaki donanımları desteklemektedir:

| Kategori | Desteklenen Modül | İletişim Protokolü | Açıklama |
| :--- | :--- | :--- | :--- |
| **Mikrodenetleyici (MCU)** | ESP32 WROOM-32 | Çift Çekirdek | Temel uçuş kontrol, hesaplama ve arayüz bağlantısı. |
| **IMU (Jiroskop/İvmeölçer)** | MPU6050 | I2C | Hava aracının uzaydaki açı ve ivme hesaplamaları. |
| **Barometre (İrtifa)** | BMP180 / BME280 | I2C | İrtifa sabitleme ve hassas yükseklik ölçümü. |
| **GPS / Konum** | Standart NMEA (M8N, M10 vb.)| UART | Hız, konum takibi ve otonom görev verileri. |
| **OSD / FPV Görüntü** | DJI O4 | UART (MSP) | DisplayPort üzerinden dijital gözlüğe anlık veri aktarımı. |

## 🚀 Kurulum ve Kullanım (Web Flasher)

Herhangi bir derleyici kurmanıza, kod indirmenize veya karmaşık ayarlar yapmanıza gerek yoktur. Kurulum ve yapılandırma işlemleri doğrudan tarayıcınız üzerinden gerçekleştirilir.

1. ESP32 kartınızı USB kablosu ile bilgisayarınıza bağlayın.
2. Google Chrome veya Microsoft Edge gibi Web Serial API destekli bir tarayıcıdan aşağıdaki adrese gidin:
   👉 **[Vecihi Configurator & Flasher](https://savas8008.github.io/vecihi-configurator/configurator.html)**
3. Arayüzdeki yönergeleri takip ederek Vecihi yazılımını tek tıkla kartınıza flaşlayın.
4. Flaşlama işlemi bittikten sonra, yine aynı ekran üzerinden kartınıza bağlanarak PID, sensör kalibrasyonu ve diğer uçuş ayarlarınızı yapabilirsiniz.

---

## 📚 Dökümantasyon ve Kılavuzlar

Sistemin kurulumu, ayarlanması ve sınırları hakkında detaylı bilgiler için aşağıdaki kılavuzları inceleyebilirsiniz:

### Bağlantı Kılavuzu:
*(Hazırlanıyor)*

### Konfigüratör Kılavuzu:
*(Hazırlanıyor)*

### Vecihi Yazılımının Yetenekleri ve Kısıtları:
*(Hazırlanıyor)*

---
*Geliştirici:* **Dr. Muhammet Savaş Yılmaz**
