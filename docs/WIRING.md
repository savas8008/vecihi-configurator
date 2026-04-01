# 🛠 Vecihi Uçuş Kontrolcüsü Bağlantı Kılavuzu

Bu kılavuz, Vecihi yazılımının ESP32 donanımı üzerinde nasıl yapılandırılacağını ve çevre bileşenlerinin (sensörler, GPS, alıcı vb.) nasıl bağlanacağını açıklar.

## 📌 Donanım Kurulum Seçenekleri

Kullanıcılar donanımı üç farklı şekilde kurabilirler:
1. **ESP32 Shield:** Hazır geliştirme kartı genişletme modülleri kullanarak.
2. **Özgün PCB:** Kendi ürettiğiniz veya projenin sağladığı özel tasarım PCB'ler üzerine.
3. **Doğrudan Bağlantı:** Sensör ve modülleri ESP32 pinlerine doğrudan lehimleyerek.

---

## ⚡ Temel Bağlantı Şeması

Aşağıdaki şemalar, sistemin kalbi olan MPU6050 ve diğer bileşenlerin temel yerleşimini göstermektedir:

![Genel Bağlantı Şeması 1](../image_d5e980.png)
*Görsel 1: Sensör ve ESP32 temel pin dizilimi.*

![Genel Bağlantı Şeması 2](../image_d5ec6f.png)
*Görsel 2: Güç dağıtımı ve çevre birim etkileşimi.*

---

## 🔌 Pin Tanımlamaları

Yazılımda varsayılan olarak tanımlanmış (veya yapılandırılabilir) pin dizilimi şöyledir:

### 1. I2C Sensör Grubu (MPU6050)
| Bileşen | ESP32 Pin | Not |
| :--- | :--- | :--- |
| **SDA** | GPIO 21 | Veri hattı |
| **SCL** | GPIO 22 | Saat hattı |
| **VCC** | 3.3V | |
| **GND** | GND | |

### 2. GPS ve Harici UART
| Bileşen | ESP32 Pin | Not |
| :--- | :--- | :--- |
| **TX** | GPIO 17 | GPS RX'e bağlanır |
| **RX** | GPIO 16 | GPS TX'e bağlanır |

### 3. Motor / Servo Çıkışları (PWM)
Uçak konfigürasyonuna göre PWM pinleri `config.h` içerisinden değiştirilebilir. Standart dizilim:
* **Motor 1:** GPIO 13
* **Servo (Aileron):** GPIO 12
* **Servo (Elevator):** GPIO 14

---

## ⚠️ Dikkat Edilmesi Gerekenler
* **Güç Kaynağı:** ESP32'yi ve sensörleri beslerken voltaj dalgalanmalarını önlemek için kaliteli bir 5V BEC veya regülatör kullanın.
* **Titreşim:** MPU6050 sensörünü gövdeye sabitlerken çift taraflı kalın sünger bant (gyro tape) kullanmanız uçuş kararlılığı için kritiktir.
* **Lehimleme:** Doğrudan lehimleme yapıyorsanız, kabloların kısa tutulması paraziti (noise) azaltacaktır.
