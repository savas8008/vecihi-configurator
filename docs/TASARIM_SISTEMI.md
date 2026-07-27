# Vecihi Configurator — Tasarım Sistemi

Tüm görsel kontrol tek dosyada: `assets/css/style.css`.
Üç katman vardır ve **her katmanın tek bir sorumluluğu** vardır.

```
KATMAN 1 — PALET (§1a)
   Ham renkler. Tema/renk paleti değiştirmek = SADECE burayı düzenlemek.
        ↓
KATMAN 2 — YÜZEY SÖZLEŞMESİ (§1b varsayılan, §1c panel blokları)
   .panel .panel2 .panel3 .panel4 — dördü de AYNI değişken adlarını
   kendi değerleriyle doldurur.
        ↓
KATMAN 3 — BİLEŞENLER (§2 ve sonrası)
   Input, buton, kart, slider... Hiçbiri ham renk kullanmaz;
   yalnızca sözleşmeyi okur.
```

## Altın kural

> Bileşen kurallarına **sabit renk (`#hex` / `rgba`) yazmayın.**

Bir bileşen panele göre renk değiştirmeli ise sözleşme değişkenini kullanın;
panel kapsamı gerisini otomatik halleder. Bu sayede eskiden gereken
`.panel4 .filanca { color: #111 !important }` türü yamalar tamamen ortadan kalkar.

---

## Sık yapılan işler — nereye bakmalı

| İstediğiniz            | Değiştireceğiniz yer                        |
|------------------------|---------------------------------------------|
| Tüm inputların içi     | `--field-bg` (§1b)                           |
| Tüm input yazıları     | `--field-text` (§1b) veya `.field-text` sınıfı |
| Tüm input kenarlıkları | `--field-border` (§1b)                       |
| Input etiketleri       | `--t-etiket-*` (§1b)                         |
| Bir panelin zemini     | §1c → ilgili panel bloğu → `--surface`       |
| Bir panelin metni      | §1c → ilgili panel bloğu → `--on-surface`    |
| Başlık tipografisi     | `--t-baslik-*`, `--t-alt-baslik-*` (§1b)     |
| Slider görünümü        | `--control-*` (§1b)                          |
| Renk paletinin tamamı  | §1a `--p-*` değişkenleri                     |

---

## Yüzey sözleşmesi — tam liste

Dört panel bloğunun her biri şu adları doldurur:

**Zemin ve kenarlık**
- `--surface` — panelin kendi zemini
- `--surface-sunken` — içine gömülü alan (değer kutusu, slider yolu)
- `--surface-raised` — hover / yükseltilmiş alan
- `--surface-border`, `--surface-border-soft`

**Metin**
- `--on-surface` — birincil metin
- `--on-surface-soft` — ikincil metin
- `--on-surface-muted` — yardım/açıklama metni
- `--on-surface-value` — ölçüm/veri metni

**Yüzeye uyarlanmış vurgu ve durum renkleri**
- `--accent-on-surface`, `--success-on-surface`,
  `--warning-on-surface`, `--danger-on-surface`

> Renkli **metin** yazan her bileşen ham `--color-*` yerine bunları okur.
> Sebebi: parlak vurgu renkleri koyu zeminde iyi çalışır ama açık zeminde
> "patlar" (okunmaz). Panel4 bu adları koyu tonlara çeker, koyu paneller
> parlak tonda bırakır. Kontrast sorunu böylece merkezden çözülür.

**Form alanı ailesi** (`--field-*`)
- `--field-bg`, `--field-text`, `--field-placeholder`
- `--field-border`, `--field-border-focus`, `--field-focus-ring`
- `--field-addon-bg`, `--field-addon-text`
- `--field-radius`, `--field-pad-y`, `--field-pad-x`, `--field-font-size`

Bu aileyi okuyan kontroller: `.form-control`, `.form-select`,
`.mode-channel-select`, `.pin-select`, `.field`, `.input-group-text`.

**Kontrol ailesi** (`--control-*`)
- `--control-track`, `--control-track-border`
- `--control-thumb`, `--control-thumb-border`, `--control-fill`

---

## Dikkat: CSS değişken dolaylılığı tuzağı

`--field-text: var(--on-surface)` ifadesi, **bildirildiği elemandaki**
`--on-surface` değerine göre çözülür — kullanıldığı yere göre değil.

Bu yüzden türetilmiş takma adlar yalnızca `:root`'ta değil, **ortak panel
seçicisinde de** yeniden bildirilir (§1c'deki "TÜRETİLMİŞ TAKMA ADLAR" bloğu).
Aksi halde `.panel4` `--on-surface`'i koyuya çevirdiğinde `--field-text` eski
açık değerinde kalır ve beyaz input üstünde beyaz yazı oluşur.

**Yeni bir türetilmiş takma ad eklerken o bloğa da eklemeyi unutmayın.**

---

## Yeni panel seviyesi eklemek

1. §1c'deki bir panel bloğunu kopyalayın, adını değiştirin.
2. Sözleşme değerlerini doldurun.
3. Yeni sınıfı §1c'deki "TÜRETİLMİŞ TAKMA ADLAR" seçici listesine ekleyin.
4. `.panel, .panel2, ... , .sidebar` ortak kurallarına (§3) ekleyin.

Bileşenlere **hiç dokunmanız gerekmez.**

---

## Doğrulama

Değişiklikten sonra kontrol edilmesi önerilenler:

- Süslü parantez dengesi ve tanımsız `var()` referansı kalmaması
- Dört panelin aynı bileşen setiyle yan yana render'ı
- Panel içi metin/zemin kontrast oranı (hedef: hiçbir eleman < 2.0)

Bu üçü `docs/` dışında tutulan geçici bir test sayfasıyla ölçülebilir;
son ölçümde 105 panel üzerinde düşük kontrastlı eleman sayısı **0** idi.
