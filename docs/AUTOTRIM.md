# ✈️ Vecihi Servo Autotrim Rehberi

Bu rehber, Vecihi'deki **Servo Autotrim** özelliğinin ne yaptığını, hangi uçuş modlarında çalıştığını ve konfiguratörden nasıl ayarlanacağını anlatır. Özellik iNav'ın `FW_AUTOTRIM` ve ArduPlane'in `SERVO_AUTO_TRIM` özellikleriyle aynı yöntemi kullanır.

> **Kısaca:** Uçak düz ve yatay uçarken, PID'in sürekli verdiği küçük düzeltme (trim) yavaş yavaş servoların orta noktasına (**Mid**) taşınır. İnişte, disarm anında kaydedilir. Bir sonraki uçuş, PID'in trim yükü olmadan başlar.

---

## 🔍 Ne İşe Yarar?

Hiçbir uçak kusursuz trimli değildir: elevatör bağlantısı biraz uzun, bir kanat biraz ağır, motor eksenine bağlı küçük bir çekme olabilir. Stabilize modlarda PID'in **I (integral)** terimi bu sabit hatayı fark eder ve yüzeyi sürekli biraz saptırarak telafi eder. Bunun iki dezavantajı vardır:

- Her kalkışta I terimi sıfırdan başlar; trim birikene kadar uçak birkaç saniye "yan çeker".
- PID'in kapasitesinin bir kısmı trim tutmakla harcanır; rüzgâr darbelerine karşı payı azalır.

Autotrim bu sabit düzeltmeyi **mekanik orta noktaya** taşır. Yüzeyin konumu değişmez — yalnızca trimi tutan şey PID olmaktan çıkar, servo orta noktası olur.

---

## 🧭 Hangi Uçuş Modlarında Çalışır?

| Mod | Autotrim | Not |
| :--- | :---: | :--- |
| **ANGLE** | ✅ seçilebilir | En uygun mod — önerilen |
| **HORIZON** | ✅ seçilebilir | Çubuk ortadayken Angle gibi davranır |
| **CRUISE** | ✅ seçilebilir | Uzun düz bacaklar trim için idealdir |
| **ALTHOLD** | ✅ seçilebilir | |
| **RTH** | ✅ seçilebilir | Yalnızca düz bacaklarda; dönüşler otomatik dışarıda kalır |
| **LOITER** | ✅ seçilebilir | Sürekli yatışlı döndüğü için pratikte nadiren tetiklenir |
| **WAYPOINT** | ✅ seçilebilir | Yalnızca düz bacaklarda |
| MANUAL | ❌ hiçbir zaman | PID yoktur, aktarılacak I terimi yoktur |
| ACRO | ❌ hiçbir zaman | ArduPlane de hariç tutar |
| LAUNCH | ❌ hiçbir zaman | Kalkış geçici bir rejimdir |
| İniş Asistanı | ❌ hiçbir zaman | Alçalma ve flare trimi temsil etmez |
| FAILSAFE | ❌ hiçbir zaman | |
| AUTOTUNE | ❌ hiçbir zaman | Autotune kazançları değiştirirken I terimi trim değildir |
| GCS | ❌ hiçbir zaman | |

"✅ seçilebilir" modlar, konfiguratörde tek tek açılıp kapatılabilir (varsayılan: hepsi açık). "❌" modlar seçilemez.

### Seçili bir modda bile ne zaman çalışır?

Aşağıdaki koşulların **hepsi** aynı anda sağlandığında, her 0,5 saniyede bir küçük bir adım atılır:

- Uçak arm'lı ve **havada** (kalkış algılanmış)
- **Roll ve pitch açısı 5°'den küçük** (düz ve yatay uçuş)
- Ölçülen ve istenen **dönüş hızı**, ayarlanan eşiğin altında (varsayılan 15°/s)
- **Roll, pitch ve yaw çubukları ortada** (RC ölü bölgesi içinde)
- PID'in I terimi **kararlı** (manevra sonrası hâlâ oturuyorsa beklenir)

Bu yüzden autotrim'in işini yapması için **sakin havada, ANGLE veya CRUISE modunda, çubuklara dokunmadan 1-2 dakika düz uçmak** yeterlidir.

---

## ⚙️ Konfiguratörden Ayarlama

**Mikser** sayfası → **Servo Autotrim** paneli:

1. **Uçuşta autotrim etkin** anahtarını açın.
2. **Çalışacağı uçuş modları**'ndan istediklerinizi işaretleyin. İlk denemelerde yalnızca **ANGLE** önerilir.
3. **Dönüş hızı eşiği** genelde 15°/s'de bırakılır. Türbülanslı havada hiç tetiklenmiyorsa biraz artırılabilir.
4. Sayfanın **Kaydet** butonuna basın.

Aynı ayarlar **Parametreler** sayfasında da bulunur: `OUT_AUTOTRIM`, `OUT_ATRIM_MODES`, `OUT_ATRIM_RATE`.

---

## 🛫 Önerilen İlk Kullanım

1. **Yerde kontrol:** Mikser sayfasında bir servonun **Mid** değerini birkaç adım değiştirin. Yüzeyin beklenen yöne gittiğini görün, özellikle **Rev** işaretli servolarda. Sonra değeri eski haline getirin.
2. Autotrim'i yalnızca **ANGLE** için açın, kaydedin.
3. Sakin havada ANGLE modunda kalkın, çubuklara dokunmadan 1-2 dakika düz uçun, inin ve **disarm** edin.
4. Konfiguratöre bağlanın: Mikser sayfasındaki **Mid** değerleri değişmiş olmalı.
5. Sonuç tatmin ediciyse autotrim'i kapatabilir (öğrenilen Mid değerleri kalır) ya da açık bırakabilirsiniz.

---

## ⚠️ Sınırlar ve Uyarılar

- **Orta nokta 1300-1700 µs ile sınırlıdır.** Mid değeri bu sınıra dayanıyorsa uçak mekanik olarak ciddi trim dışıdır. Bağlantı çubuğunu veya horn'u ayarlayıp Mid'i 1500'e yakın getirin.
- **Ağırlık merkezi hatasını düzeltmez.** Burnu ağır bir uçak trimlenebilir ama hız değişince yine sapar. Ağırlık merkezi, bataryanın yeri değiştirilerek düzeltilmelidir.
- **Yaw ekseni trimlenmez** (iNav ve ArduPlane'de de böyledir).
- Değişiklikler yalnızca **disarm anında** kaydedilir. Uçuşta flash'a hiç yazılmaz.
- Konfiguratör uçuştan önce açık bırakıldıysa, uçuştan sonra Mikser sayfasını yeniden yükleyin. Yoksa **Kaydet** eski Mid değerlerini geri yazar.

### Servo Min / Mid / Max hakkında önemli not

Bu sürümden önce Mikser sayfasındaki servo **Min / Mid / Max** değerleri kaydediliyordu ama çıkışa **uygulanmıyordu**. Artık uygulanıyor. Bu değerleri daha önce değiştirdiyseniz, güncellemeden sonra yerde tüm yüzeylerin merkezini ve hareket aralığını kontrol edin. Örneğin daha önce girilmiş Max = 1800 artık gerçekten servoyu 1800'de durdurur.
