# Otomatik Testler

Bu klasör, programı **tarayıcı açmadan** denetleyen testleri içerir.
Node.js gerekir (bilgisayarında kurulu).

## Nasıl çalıştırılır?

Bir terminal aç, bu klasöre gel ve şunu yaz:

```
node calistir.js
```

Hepsi sırayla çalışır ve sonuç ekrana yazılır.

---

## Testler ne kontrol ediyor?

### `kural_denetimi.js` — ana denetim
Gerçek verinle 7 hafta üretir ve her birini şu kurallara karşı tarar:

| Kontrol | Ne arar |
|---|---|
| İZİNSİZ | 7 gün çalışan, hiç izni olmayan personel |
| ÇİFT_İZİN | Jeneratörün ürettiği hafta sonu çift izni |
| HAFTALIK_AŞIM | Haftalık saat üst sınırını aşan |
| KOTA_AŞIM | Günlük kotanın üstünde yazılmış vardiya |
| KAPSAMA | Asgari kişi sayısının altına düşen bölüm/saat |
| SORUMLU_YOK | Akşam sorumlusu atanmamış gün |
| SORUMLU_ERKEN | Sorumlu kapanıştan önce çıkıyor |
| KAPANIŞ_AŞIM | Haftalık kapanış sınırını aşan |
| YETKİSİZ | Bakamadığı bölüme atanmış personel |
| SAAT_DIŞI | Dükkân saatleri dışına taşan vardiya |

### `test_izin_gunu.js` — izin günü koruması
15 Ağustos'ta bulunan hatanın tekrar etmediğini doğrular:
bir personelin izin gününe elle "çalışsın" yazılınca, jeneratör ona
**başka bir gün** izin vermeli — izinsiz bırakmamalı.

### `test_borc_alacak_yenileme.js` — panel donması
Hesaplama sürerken hafta değiştirilince Borç/Alacak panelinin
eski rakamlarda donup kalmadığını doğrular.

---

## Bilinen ve NORMAL olan bulgular

Denetim şunları bulursa **panik yok**, bunlar hata değil:

- **SORUMLU_YOK — Pazar günü:** Bilerek boş bırakılıyor, o gün herkes aynı
  vardiyada (kurallar madde 4).
- **SORUMLU_ERKEN:** Genelde kullanıcının kendi elle atadığı sorumludan
  kaynaklanır; jeneratör kullanıcının kararını korur ve 2. panelde uyarır.
- **KAPSAMA:** Jeneratör kapatamadığı açıkları gizlemez, raporunda listeler.
  Doğrulandı: bulduğu açık sayısı denetimin bulduğuyla birebir aynı (40=40),
  yani sessizce gizlenen açık yok. Çoğu Fotokopi bölümünde — o bölüme
  bakabilen personel sayısı yetersiz.

---

*Testler 15 Ağustos 2026'da yazıldı.*
