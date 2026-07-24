# 🛡 Vecihi Failsafe Rehberi

Bu rehber, Vecihi uçuş kontrol yazılımındaki **Failsafe** sayfasını (kumanda/alıcı ekranında **Failsafe** sekmesi) nasıl yapılandıracağınızı ve uçağın çeşitli arıza/kayıp durumlarında nasıl davranacağını açıklar. Failsafe, sabit kanatlı bir uçakta **son çare güvenlik ağıdır** — amacı, pilotun kontrolü kaybettiği anlarda uçağı mümkün olan en güvenli şekilde durdurmak, eve döndürmek veya kontrollü bir şekilde alçaltmaktır.

> Sabit kanatlı bir uçak quad/multikopter gibi havada asılı kalamaz. Bu yüzden Vecihi'nin failsafe felsefesi her zaman **"motoru kesip düşür"** değil, **"kontrollü uçuşa devam et"** yönündedir.

Failsafe sayfası üç bağımsız bölümden oluşur: **RF Failsafe**, **Geofence Failsafe** ve **Sensör Failsafe**.

---

## 📡 RF Failsafe (Sinyal Kaybı)

Kumanda/alıcı sinyali kesildiğinde uygulanacak davranışı tanımlar. Tespit **iki kademeli** çalışır — ani, kısa süreli sinyal kesintilerinde uçağın gereksiz yere sert bir tepki vermesini önlemek için:

| Kademe | Varsayılan Süre | Davranış |
| :--- | :--- | :--- |
| **Kısa Kademe** | 500 ms | Uçak otomatik olarak **Angle self-level** (0° roll / 0° pitch) uygular ve **son bilinen gaz değerini** korur. Henüz aşağıda seçtiğiniz mod devreye girmez. |
| **Uzun Kademe** | 3000 ms | Kesinti bu süreyi aşarsa, Failsafe sayfasında seçtiğiniz mod (**RTH / Angle / Sabit PWM**) devreye girer. |

Her iki süre de Failsafe sayfasından değiştirilebilir. Menzil kenarında sık kısa kopmalar yaşıyorsanız kısa kademe süresini biraz artırmak, gereksiz mod geçişlerini azaltır.

### Uzun Kademede Uygulanacak Mod (3 Seçenek)

Failsafe sayfasındaki açılır menüden seçilir — **GPS mevcut olsa dahi** bu üç seçenekten biri seçilmelidir:

1. **🏠 RTH (Eve Dönüş)** — GPS sağlıklı ve Home noktası ayarlıysa uçak otomatik olarak eve döner. RTH'nin irtifa, loiter yarıçapı gibi ayrıntıları **Navigasyon & GPS** sayfasındaki RTH bölümünden yapılandırılır. GPS sağlıksızsa veya Home ayarlı değilse, sistem güvenlik amacıyla otomatik olarak **Angle self-level**'e düşer.
2. **🧭 Angle Modu (Sabit Açı)** — Uçak, sizin girdiğiniz hedef Roll/Pitch açılarına kilitlenir (self-level) ve sabit bir gazla uçuşuna devam eder. Hafif bir roll açısı girerek kontrollü bir spiral alçalma da tanımlayabilirsiniz. GPS gerekmez.
3. **🎚 Sabit PWM (Failsafe Pozisyonu)** — Kontrol yüzeyleri ve gaz, doğrudan girdiğiniz sabit PWM değerlerine ayarlanır. Stabilizasyon yoktur — düz süzülme/kayma amaçlıdır. GPS gerekmez.

### RTH'den Bilinçsiz Çıkışı Önleme

RF sinyali RTH sırasında geri gelirse, kontrolün **anında** ve **hazırlıksız** pilota geri verilmesi tehlikeli olabilir (örn. RTH aktif olarak eve dönerken bir viraj alıyor olabilir). Bu yüzden:

> Sinyal geri gelse dahi, pilot roll veya pitch stick'ini **Gelişmiş Ayarlar → Uçuş Limitleri** sayfasındaki **"Stick İptal Eşiği"** değerini aşacak şekilde bilinçli olarak hareket ettirmeden RTH iptal edilmez.

Bu eşik, Auto Launch ve İniş Asistanı'nın stick-iptal mekanizmasıyla aynı ayarı paylaşır — tek bir yerden yönetilir.

Diğer iki seçenekte (Angle / Sabit PWM) böyle bir ek onay gerekmez; sinyal geri döner dönmez kontrol normal switch/stick akışına geçer.

---

## 🧭 Geofence Failsafe

Home noktasından izin verilen maksimum uzaklığı tanımlar.

- **0** girilirse geofence **devre dışıdır**, herhangi bir kısıtlama uygulanmaz.
- Örneğin **1000 metre** girilirse, uçak evden 1001. metrede olduğu anda otomatik olarak **RTH** tetiklenir.

Bu kontrolün çalışabilmesi için GPS sağlıklı olmalı ve Home noktası ayarlı olmalıdır (RTH'nin kendisi zaten bu koşulları gerektirir).

---

## 🛰 Sensör Failsafe (GPS Sıçrama Tespiti)

GPS verisindeki ani ve fiziksel olarak imkânsız sıçramalara (glitch) karşı koruma sağlar.

- **GPS Sıçrama Mesafesi (m)** — ardışık iki GPS okuması arasında, uçağın gerçek hızıyla açıklanamayacak kadar büyük bir sıçrama tespit edilirse, o GPS örneği geçersiz sayılır ve reddedilir. Böylece hatalı bir konum verisi navigasyonu (RTH, Waypoint vb.) yanlış yönlendirmez.
- **IMU Hata Algılama** şu an için planlanmıştır, henüz bu sayfada bir ayarı yoktur.

---

## ✅ Kurulum Önerileri

- **RTH'yi güvenilir GPS olmadan varsayılan seçmeyin.** GPS sinyali zayıfsa veya sık fix kaybı yaşıyorsanız, uzun kademe için **Angle Modu**'nu seçmek daha öngörülebilir bir davranış sağlar.
- **Sabit PWM** seçeneğini yalnızca uçağınızın trim ayarlarını (düz uçuşta hangi PWM değerlerinin yaklaşık düz gittiğini) bildiğiniz durumlarda kullanın — rastgele değerler uçağı bir yöne yatırıp düşürebilir.
- **Angle Modu**'nda hedef açıları sıfırdan farklı girerek (örn. 10-15° roll) hafif bir spiral alçalma tanımlamak, uzun süreli sinyal kaybında uçağı belirli bir bölgede tutmaya yardımcı olabilir.
- Geofence mesafesini, uçuş alanınızın gerçek boyutuna göre makul bir marj ile belirleyin — çok dar bir sınır, normal bir turda bile gereksiz RTH tetikleyebilir.

## ⚠️ Test Etme — Güvenlik Uyarısı

Failsafe davranışını **yalnızca pervane çıkarılmış ve motor kilitli (disarmed) haldeyken** test edin:

1. Uçağı arm etmeden kumandayı kapatın veya alıcıyı sökün.
2. Serial/USB bağlıyken Configurator loglarından (veya OSD'den) "KISA KADEME" ve ardından "UZUN KADEME" mesajlarının beklediğiniz sürelerde geldiğini doğrulayın.
3. Kumandayı tekrar açıp sinyalin geri döndüğünü, seçtiğiniz moda göre beklenen şekilde (RTH ise stick eşiği aşılana kadar kilitli kalarak, diğerlerinde anında) normal kontrole döndüğünü kontrol edin.

Gerçek bir uçuşta failsafe'in ilk kez devreye girdiği an, test etme anı değildir — yere inmeden önce mutlaka zemin testleriyle davranışı tanıyın.
