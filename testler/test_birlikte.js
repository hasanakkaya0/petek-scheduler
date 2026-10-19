/* ============================================================
   BIRLIKTE CALISMA TESTI — "baska bilgisayarda da bu hafta acik" uyarisi
   Bkz. js/birlikte.js, index.html (uzakDegisimiKaydet, scheduleSave),
   js/render.js (renderHeader -> Birlikte.hafta)
   ============================================================ */
(async () => {
  await new Promise(r => setTimeout(r, 80));
  let gecen = 0, kalan = 0;
  const K = (ad, sart) => { if(sart){ gecen++; console.log('  [GECTI] ' + ad); } else { kalan++; console.log('  [KALDI] ' + ad); } };
  const bekle = ms => new Promise(r => setTimeout(r, ms));
  const H = '2026-10-19', SIMDI = 1000000000;

  // --- 1) Saf degerlendirme ---
  const kayit = (id, hafta, t, d) => ({id, deger: {hafta, t, d: d || 0}});
  K('kimse yokken uyari yok', Birlikte.degerlendir([], 'ben', H, SIMDI).digerSayisi === 0);
  K('kendi kaydim sayilmaz', Birlikte.degerlendir([kayit('ben', H, SIMDI)], 'ben', H, SIMDI).digerSayisi === 0);
  K('ayni haftada aktif baska biri sayilir', Birlikte.degerlendir([kayit('x', H, SIMDI - 10000)], 'ben', H, SIMDI).digerSayisi === 1);
  K('baska haftadaki sayilmaz', Birlikte.degerlendir([kayit('x', '2026-10-26', SIMDI)], 'ben', H, SIMDI).digerSayisi === 0);
  K('75 sn\'den eski yoklama sayilmaz (bilgisayar kapandi)', Birlikte.degerlendir([kayit('x', H, SIMDI - 80000)], 'ben', H, SIMDI).digerSayisi === 0);
  K('iki baska bilgisayar sayilir', Birlikte.degerlendir([kayit('x', H, SIMDI), kayit('y', H, SIMDI - 5000)], 'ben', H, SIMDI).digerSayisi === 2);
  K('az once duzenleyen isaretlenir', Birlikte.degerlendir([kayit('x', H, SIMDI, SIMDI - 20000)], 'ben', H, SIMDI).azOnceDuzenleyen === true);
  K('uzun suredir duzenlemeyen "az once" sayilmaz', Birlikte.degerlendir([kayit('x', H, SIMDI, SIMDI - 300000)], 'ben', H, SIMDI).azOnceDuzenleyen === false);
  K('bozuk kayit atlanir, hata vermez', Birlikte.degerlendir([null, {id: 'x'}, {id: 'y', deger: null}], 'ben', H, SIMDI).digerSayisi === 0);

  // --- 2) Metin ---
  K('kimse yoksa metin bos', Birlikte.metin({digerSayisi: 0}) === '');
  const m1 = Birlikte.metin({digerSayisi: 1, azOnceDuzenleyen: false});
  K('uyari metni "son kaydeden kazanir" diyor', /son kaydeden kazanır/.test(m1) && /Başka bir bilgisayarda/.test(m1));
  K('duzenleme varsa metinde belirtiliyor', /Az önce orada değişiklik/.test(Birlikte.metin({digerSayisi: 1, azOnceDuzenleyen: true})));
  K('2 kisi varsa sayi yaziyor', /Başka 2 bilgisayarda/.test(Birlikte.metin({digerSayisi: 2, azOnceDuzenleyen: false})));

  // --- 3) Sahte sunucuyla butunlesik ---
  function sunucuYap(baslangic){
    const s = { docs: new Map(Object.entries(baslangic || {})), onVeri: null };
    s.adapter = {
      dinle(onVeri){ s.onVeri = onVeri; setTimeout(() => onVeri([...s.docs].map(([id, value]) => ({id, value, yerel: false, silindi: false}))), 0); },
      yaz(id, value){ s.docs.set(id, value); s.onVeri([{id, value, yerel: true, silindi: false}]); return Promise.resolve(); },
      sil(id){ s.docs.delete(id); s.onVeri([{id, value: null, yerel: true, silindi: true}]); return Promise.resolve(); },
    };
    s.uzakYaz = (id, value) => { s.docs.set(id, value); s.onVeri([{id, value, yerel: false, silindi: false}]); };
    return s;
  }
  // kalici uyari kutusu (testte getElementById her seferinde yeni nesne uretir)
  const kutu = {hidden: true, textContent: ''};
  const eskiGet = document.getElementById;
  document.getElementById = id => id === 'baskaDuzenliyor' ? kutu : eskiGet(id);

  const t0 = Date.now();
  const sun = sunucuYap({
    'presence:eski': JSON.stringify({hafta: H, t: t0 - 3600000, d: 0}),     // 1 saat onceki -> temizlenmeli
    settings: '{"a":1}',
  });
  await Bulut._testBaslat(sun.adapter);
  Birlikte.baslat();
  await bekle(60);
  K('10 dakikadan eski yoklama temizlendi', !sun.docs.has('presence:eski'));

  Birlikte.hafta(H);
  await bekle(60);
  const benimKey = 'presence:' + Birlikte._testKimlik();
  K('hafta acilinca kendi yoklamam buluta yazildi', sun.docs.has(benimKey));
  const benim = JSON.parse(sun.docs.get(benimKey));
  K('yoklamada hafta ve zaman var', benim.hafta === H && Math.abs(benim.t - Date.now()) < 5000);
  K('kendi yoklamam uyari cikarmaz', kutu.hidden === true);

  sun.uzakYaz('presence:baska1', JSON.stringify({hafta: H, t: Date.now(), d: Date.now()}));
  await bekle(60); await Birlikte.bannerGuncelle();
  K('ayni haftada baska bilgisayar gelince uyari gorunur', kutu.hidden === false && /Başka bir bilgisayarda/.test(kutu.textContent));
  K('uyari "az once degisiklik" diyor', /Az önce orada değişiklik/.test(kutu.textContent));

  sun.uzakYaz('presence:baska1', JSON.stringify({hafta: '2026-10-26', t: Date.now(), d: 0}));
  await bekle(30); await Birlikte.bannerGuncelle();
  K('o baska haftaya gecince uyari kalkar', kutu.hidden === true);

  sun.uzakYaz('presence:baska1', JSON.stringify({hafta: H, t: Date.now() - 200000, d: 0}));
  await bekle(30); await Birlikte.bannerGuncelle();
  K('yoklamasi kesilince (200 sn) uyari kalkar', kutu.hidden === true);

  // --- 4) Duzenleme zamani yoklamaya yansir ---
  scheduleSave();                                  // kullanici bir sey degistirdi
  Birlikte.hafta('2026-11-02'); await bekle(60);   // hafta degisince yeni yoklama yazilir
  const yeni = JSON.parse(sun.docs.get(benimKey));
  K('duzenleme sonrasi yoklamada son duzenleme zamani var', yeni.d > 0 && yeni.hafta === '2026-11-02');

  // --- 5) Uzak degisiklik ayrimi: yoklama ekrani yenilemez ---
  uzakBekleyen.clear();
  uzakDegisimiKaydet(['presence:xyz']);
  K('sadece yoklama gelirse ekran yenileme kuyruguna girmez', uzakBekleyen.size === 0);
  uzakDegisimiKaydet(['presence:xyz', 'settings']);
  K('yoklama + ayar gelirse sadece ayar kuyruga girer', uzakBekleyen.size === 1 && uzakBekleyen.has('settings'));
  clearTimeout(uzakZamanlayici); uzakBekleyen.clear();

  // --- 6) Yoklama kayitlari "veri" sayilmaz ---
  Bulut._testSifirla();
  await Bulut._testBaslat(sunucuYap({'presence:a': '{}'}).adapter);
  K('bulutta sadece yoklama varsa "bos" sayilir (eski veri tasima sorusu atlanmaz)', Bulut.bosMu() === true);
  await Bulut.set('week:2026-11-02', '{}');
  K('gercek veri gelince bos degil', Bulut.bosMu() === false);
  await Bulut.sil('presence:a');
  K('Bulut.sil kaydi bellekten de kaldirir', (await Bulut.get('presence:a')) === null);

  // --- 7) Bulut kapaliyken hicbir sey yapmaz ---
  Birlikte._testDurdur(); Bulut._testSifirla();
  kutu.hidden = false; kutu.textContent = 'x';
  Birlikte.hafta(H);
  K('bulut kapaliyken Birlikte.hafta sessizce atlar', true);

  // --- 8) Kaynak ---
  const fs = require('fs'), path = require('path');
  const idx = fs.readFileSync(path.join(process.env.APPDIR, 'index.html'), 'utf8');
  K('index.html: birlikte.js, bulut.js\'ten sonra', idx.indexOf('js/birlikte.js') > idx.indexOf('js/bulut.js'));
  K('index.html: uyari kutusu var', /id="baskaDuzenliyor"/.test(idx));

  document.getElementById = eskiGet;
  console.log('');
  console.log('  Sonuc: ' + gecen + ' gecti, ' + kalan + ' kaldi');
})();
