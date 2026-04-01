# 🛠 Vecihi Uçuş Kontrolcüsü Bağlantı Kılavuzu

Bu kılavuz, Vecihi uçuş kontrol yazılımının ESP32 donanımı üzerinde nasıl yapılandırılacağını ve çevre bileşenlerinin (MPU6050 sensörü, GPS, alıcı vb.) nasıl bağlanacağını açıklar. Vecihi, sabit kanatlı uçaklara özel olarak geliştirilmiştir.

## 📌 Donanım Kurulum Seçenekleri

Kullanıcılar donanımı üç farklı şekilde kurabilirler:
1. **ESP32 Shield:** Hazır geliştirme kartı genişletme modülleri kullanarak.
2. **Özgün Tasarım PCB:** Kendi ürettiğiniz veya projenin sağladığı özel tasarım PCB'ler üzerine.
3. **Doğrudan Bağlantı:** Sensör ve modülleri ESP32 pinlerine doğrudan lehimleyerek.

---

### Seçenek 1: ESP32 Shield Bağlantısı
Hazır ESP32 genişletme kartları (Shield) kullanarak, bileşenleri lehim yapmadan veya jumper kablolarla hızlıca bağlayabilirsiniz. Prototipleme ve ilk testler için idealdir.

![ESP32 Shield Bağlantı Şeması](../assets/icons/Ekran%20g%C3%B6r%C3%BCnt%C3%BCs%C3%BC%202026-04-01%20232607.png)
*Görsel 1: Shield üzerinden bileşen yerleşimi.*

### Seçenek 2: Özgün Tasarım PCB
Uçağın ağırlık ve alan verimliliğini artırmak için hazırlanan, tüm bileşenlerin (MPU6050, ESP32, konnektörler) doğrudan üzerine monte edildiği profesyonel çözümdür.

![Özgün Tasarım PCB](../assets/icons/Ekran%20g%C3%B6r%C3%BCnt%C3%BCs%C3%BC%202026-04-01%20232643.png)
*Görsel 2: Özgün PCB tasarımı ve yol takibi.*

---

## 🔌 Varsayılan Pin Tanımlamaları

Yazılımda sabit kanatlı uçaklar için varsayılan olarak tanımlanmış pin dizilimi aşağıdadır. Bağlantıları yaparken bu şemaya sadık kalmanız uçuş güvenliği açısından önemlidir.

### 1. I2C Sensör Grubu (MPU6050)
| Bileşen | ESP32 Pin | Açıklama |
| :--- | :--- | :--- |
| **SDA** | GPIO 21 | Veri hattı |
| **SCL** | GPIO 22 | Saat hattı |
| **VCC** | 3.3V | Güç |
| **GND** | GND | Toprak |

### 2. Haberleşme (GPS ve Harici UART)
| Bileşen | ESP32 Pin | Açıklama |
| :--- | :--- | :--- |
| **RX2** | GPIO 16 | GPS/Telemetri modülünün TX pinine bağlanır |
| **TX2** | GPIO 17 | GPS/Telemetri modülünün RX pinine bağlanır |

### 3. Motor ve Servo Çıkışları (PWM)
Kontrol yüzeyleri ve itki sistemi bağlantıları:
| Bileşen | ESP32 Pin | Açıklama |
| :--- | :--- | :--- |
| **Motor (ESC)** | GPIO 13 | Ana motor itki kontrolü |
| **Aileron (Kanatçık)** | GPIO 12 | Sağa/sola yatış (Roll) kontrolü |
| **Elevator (Yükseliş)**| GPIO 14 | Aşağı/yukarı yunuslama (Pitch) kontrolü |

---

## ⚡ Montaj ve Donanım Notları

* **Güç Kaynağı:** ESP32'nin stabil çalışması için en az 2A çıkış verebilen bir 5V BEC (Batarya Eliminasyon Devresi) kullanılmalıdır.
* **Titreşim ve İzolasyon:** MPU6050 sensörünü uçak gövdesine sabitlerken titreşim sönümleyici bant (gyro tape) kullanmak uçuş kararlılığı için kritiktir.
* **Sensör Yönü:** MPU6050 sensörünün uçuş yönüyle (burun) uyumlu olduğundan emin olun. Gerekirse Vecihi Configurator üzerinden `Sensor Alignment` sekmesinden yön düzeltmesi yapılabilir.
* **Doğrudan Lehimleme:** Kendi bağlantılarınızı yapıyorsanız, I2C hatlarını (SDA/SCL) mümkün olduğunca kısa tutarak paraziti (noise) azaltabilirsiniz.
