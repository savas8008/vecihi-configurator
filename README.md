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
---
## ✈️ Desteklenen Hava Araçları

Vecihi uçuş kontrol yazılımı, aerodinamik hesaplamaları ve kontrol algoritmaları gereği **sadece sabit kanatlı (Fixed-Wing)** hava araçlarını destekleyecek şekilde özel olarak geliştirilmiştir. (Çok rotorlu/multicopter drone desteği bulunmamaktadır.)

Sistem, mikser (mixer) ayarları sayesinde aşağıdaki sabit kanatlı gövde tiplerinin tümüyle tam uyumlu çalışır:

* **T-Tail / Klasik Kuyruk:** Standart Aileron, Elevator ve Rudder konfigürasyonuna sahip geleneksel modeller.
* **V-Tail (V-Kuyruk):** Elevator ve Rudder kontrollerinin "V" şeklindeki iki hareketli yüzeyde (Ruddervator) birleştirildiği modeller.
* **Delta Kanat (Uçan Kanat):** Ayrı bir yatay/dikey stabilize (kuyruk) barındırmayan, Aileron ve Elevator'ın birleşik (Elevon) çalıştığı modeller.
* **Ruddersız (Rudderless) Modeller:** Yön (Yaw) ekseni kontrolcüsü olmayan, dönüşlerin sadece Aileron yatışı ve Elevator çekişi (Bank and Yank) ile yapıldığı uçaklar.

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

### Bağlantı Kılavuzu: https://github.com/savas8008/vecihi-configurator/blob/main/docs/WIRING.md

### Vecihi Yazılımının Kısıtları

Vecihi uçuş kontrol yazılımı, ESP32 mimarisinin sunduğu çift çekirdekli işlem gücünden maksimum verimi almak üzere tasarlanmıştır. Ancak, donanımsal yapısı ve mevcut geliştirme süreci gereği kullanıcıların dikkate alması gereken bazı operasyonel kısıtlar bulunmaktadır:

#### 1. Paylaşımlı UART Mimarisi ve Bağlantı Süresi (10 Saniye Kuralı)
ESP32 mikrodenetleyicisi donanımsal olarak toplam 3 adet UART (Seri İletişim) portuna sahiptir. Vecihi sistem mimarisinde bu portların dağılımı şu şekildedir:
* **UART 1:** GPS modülüne tahsis edilmiştir.
* **UART 2:** Kumanda alıcısı (Receiver) için ayrılmıştır.
* **UART 3 (Paylaşımlı):** USB üzerinden konfigüratör bağlantısı ve DJI O4 OSD (On-Screen Display) iletişimi için ortak kullanılmaktadır.

**Operasyonel Kısıt:** UART 3'ün paylaşımlı yapısı nedeniyle, USB ve OSD aynı anda çalışamamaktadır. Bu durumu yönetmek için sisteme güç verildiği andan itibaren **10 saniyelik bir bekleme (dinleme) süresi** atanmıştır. 
Kullanıcıların, ayar yapmak amacıyla karta güç verdikten sonraki ilk 10 saniye içerisinde web arayüzü üzerinden "Bağlan" butonuna tıklaması gerekmektedir. Eğer bu süre zarfında arayüz bağlantısı kurulmazsa, sistem otomatik olarak **"Uçuş Modu"na** geçer ve paylaşımlı UART portunu tamamen OSD biriminin kullanımına sunar. Uçuş moduna geçildikten sonra USB üzerinden arayüze bağlanılamaz; bağlantı kurmak için sistemin yeniden başlatılması gerekir.

#### 2. Donanım Ekosistemi ve Geliştirme Süreci
Vecihi, kurumsal bir çatı altında veya geniş bir açık kaynak topluluğu tarafından değil, tek bir geliştiricinin erişebildiği sınırlı donanım imkanlarıyla hayata geçirilmiş bir projedir. 

**Operasyonel Kısıt:** Mevcut sürüm, yalnızca test imkanı bulunan kısıtlı sayıdaki sensör (MPU6050, BMP180) ve OSD (DJI O4) modülleriyle %100 uyumlu ve kararlı çalışmaktadır.
Projenin altyapısı modüler bir esnekliğe sahip olup genişlemeye müsaittir. İlerleyen süreçlerde, farklı donanımlara (yeni nesil IMU'lar, barometreler, farklı dijital/analog kamera ve VTX sistemleri) erişim sağlandıkça gerekli test süreçleri yürütülecek; desteklenen modüller listesi güncellemelerle kademeli olarak genişletilecektir.


---
*Geliştirici:* **Dr. Muhammet Savaş Yılmaz**
