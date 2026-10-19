/* ============================================================
   BULUT SENKRONU TESTI (Firebase, sahte sunucuyla)
   Gercek Firebase'e baglanmaz: js/bulut.js'in cekirdegini sahte bir
   sunucuyla dener. "Uzak bilgisayar" = sunucunun disaridan yaptigi yazma.
   Bkz. js/bulut.js, js/storage.js (store -> Bulut yonlendirmesi)
   ============================================================ */
(async () => {
  await new Promise(r => setTimeout(r, 80));
  let gecen = 0, kalan = 0;
  const K = (ad, sart) => { if(sart){ gecen++; console.log('  [GECTI] ' + ad); } else { kalan++; console.log('  [KALDI] ' + ad); } };
  const bekle = ms => new Promise(r => setTimeout(r, ms));

  // ---- Sahte sunucu: tek istemcili Firestore taklidi ----
  function sunucuYap(baslangic, secenek){
    secenek = secenek || {};
    const s = { docs: new Map(Object.entries(baslangic || {})), yazilanlar: [], onVeri: null, onHata: null };
    s.adapter = {
      dinle(onVeri, onHata){
        s.onVeri = onVeri; s.onHata = onHata;
        if(secenek.hic) return;                                   // hic veri gelmez (zaman asimi testi)
        setTimeout(() => {
          if(secenek.izinYok) onHata({code: 'permission-denied'});
          else onVeri([...s.docs].map(([id, value]) => ({id, value, yerel: false, silindi: false})));
        }, 0);
      },
      yaz(id, value){
        s.yazilanlar.push([id, value]); s.docs.set(id, value);
        s.onVeri([{id, value, yerel: true, silindi: false}]);      // kendi yazdigimiz: "yerel"
        return secenek.yavas ? new Promise(r => setTimeout(r, 120)) : Promise.resolve();
      },
      sil(id){ s.docs.delete(id); return Promise.resolve(); },
    };
    // diger bilgisayarin yazmasi / silmesi
    s.uzakYaz = (id, value) => { s.docs.set(id, value); s.onVeri([{id, value, yerel: false, silindi: false}]); };
    s.uzakSil = id => { s.docs.delete(id); s.onVeri([{id, value: null, yerel: false, silindi: true}]); };
    return s;
  }

  // --- 1) Acilis: mevcut veri belleğe geliyor ---
  let sun = sunucuYap({settings: '{"a":1}', 'week:2026-10-12': '{"w":1}', 'week:2026-10-19': '{"w":2}'});
  await Bulut._testBaslat(sun.adapter);
  K('bulut aktif ve hazir', Bulut.aktif() && Bulut.hazirMi());
  K('ayar belgesi okunuyor', (await Bulut.get('settings')).value === '{"a":1}');
  K('var olmayan anahtar null', (await Bulut.get('yok')) === null);
  K('listKeys("week:") iki hafta veriyor', (await Bulut.listKeys('week:')).length === 2);
  K('bulut bos degil', Bulut.bosMu() === false);

  // --- 2) Yazma ---
  const sunucuYazimi = sunucuYap({}, {yavas: true});
  Bulut._testSifirla(); await Bulut._testBaslat(sunucuYazimi.adapter);
  K('bos bulut: bosMu true', Bulut.bosMu() === true);
  const r = await Bulut.set('week:2026-11-02', '{"x":1}');
  K('set hemen degeri dondurur', r.value === '{"x":1}');
  K('yazma sunucuya gitti', sunucuYazimi.yazilanlar.length === 1 && sunucuYazimi.yazilanlar[0][0] === 'week:2026-11-02');
  K('sunucu onaylanana kadar bekleyen yazma 1', Bulut.bekleyenYazma() === 1);
  await bekle(200);
  K('onay gelince bekleyen 0', Bulut.bekleyenYazma() === 0);
  K('yazilan deger hemen okunuyor', (await Bulut.get('week:2026-11-02')).value === '{"x":1}');

  // --- 3) Uzak degisiklik / yanki ---
  Bulut._testSifirla(); sun = sunucuYap({settings: '{"a":1}'}); await Bulut._testBaslat(sun.adapter);
  const gelen = []; Bulut.uzakDegisince = k => gelen.push(k.join(','));
  await Bulut.set('settings', '{"a":2}');
  K('kendi yazdigimiz degisiklik "uzak" sayilmiyor (yanki yok)', gelen.length === 0);
  sun.uzakYaz('week:2026-10-12', '{"w":9}');
  K('diger bilgisayarin yazmasi bildiriliyor', gelen.length === 1 && gelen[0] === 'week:2026-10-12');
  K('uzak deger okunuyor', (await Bulut.get('week:2026-10-12')).value === '{"w":9}');
  sun.uzakYaz('week:2026-10-12', '{"w":9}');
  K('ayni deger tekrar gelirse bildirim yok', gelen.length === 1);
  sun.uzakSil('week:2026-10-12');
  K('uzak silme bildiriliyor', gelen.length === 2 && (await Bulut.get('week:2026-10-12')) === null);
  K('silinen anahtar listeden de dustu', !(await Bulut.listKeys('week:')).includes('week:2026-10-12'));

  // --- 4) store yonlendirmesi: bulut aciksa yerel depoya yazilmaz ---
  Bulut._testSifirla(); sun = sunucuYap({}); await Bulut._testBaslat(sun.adapter);
  localStorage.removeItem('petek:week:2030-01-07');
  await store.set('week:2030-01-07', '{"q":1}');
  K('store.set bulutta', sun.docs.get('week:2030-01-07') === '{"q":1}');
  K('store.set yerel depoya YAZMADI', localStorage.getItem('petek:week:2030-01-07') === null);
  K('store.get buluttan okuyor', (await store.get('week:2030-01-07')).value === '{"q":1}');
  K('store.listKeys buluttan', (await store.listKeys('week:')).includes('week:2030-01-07'));

  // --- 5) Bos haftayi bulutta hemen yazma (iki bilgisayar guvenligi) ---
  currentMonday = new Date(2030, 0, 14);
  const onceki = sun.yazilanlar.length;
  await loadWeek();
  K('yeni acilan bos hafta bulutta YAZILMADI', sun.yazilanlar.length === onceki && !sun.docs.has('week:2030-01-14'));
  K('ama ekranda bos hafta var', !!(weekData && weekData.days));
  scheduleSave(); await bekle(700);
  K('ilk duzenlemede hafta kaydedildi', sun.docs.has('week:2030-01-14'));

  // --- 6) Yedekten yukleme (cok sayida yazma) ---
  for(let i = 0; i < 20; i++) await store.set('week:2031-01-' + String(i + 1).padStart(2, '0'), '{"i":' + i + '}');
  K('20 haftalik toplu yazma buluta gitti', [...sun.docs.keys()].filter(k => k.startsWith('week:2031-')).length === 20);

  // --- 7) Hata durumlari ---
  Bulut._testSifirla();
  let hataKodu = null;
  try{ await Bulut._testBaslat(sunucuYap({}, {izinYok: true}).adapter); }catch(e){ hataKodu = e.code; }
  K('izni olmayan hesap: permission-denied ile reddedilir', hataKodu === 'permission-denied');
  Bulut._testSifirla(); Bulut._testBeklemeMs(150);
  hataKodu = null;
  try{ await Bulut._testBaslat(sunucuYap({}, {hic: true}).adapter); }catch(e){ hataKodu = e.code; }
  K('veri hic gelmezse zaman asimi (bos veriyle devam edilmez)', hataKodu === 'zaman-asimi');
  Bulut._testBeklemeMs(15000);

  // --- 8) Ne zaman acik? ---
  Bulut._testSifirla();
  global.window.PETEK_FIREBASE = {apiKey: 'x', projectId: 'y'};
  global.window.firebase = {initializeApp(){}};
  K('config + kutuphane varken yapilandirildi', Bulut.yapilandirildi() === true);
  global.location = {protocol: 'file:', search: ''};
  K('file:// olarak acilinca bulut KAPALI', Bulut.yapilandirildi() === false);
  delete global.location;
  global.window.PETEK_FIREBASE = null;
  K('config bossa bulut KAPALI', Bulut.yapilandirildi() === false);
  delete global.window.firebase;
  await store.set('test-yerel', 'v');
  K('Bulut aktif degilken store yerel depoya yazar', localStorage.getItem('petek:test-yerel') === 'v');

  // --- 9) Kaynak kodu ---
  const fs = require('fs'), path = require('path');
  const APP = process.env.APPDIR;
  const bulutSrc = fs.readFileSync(path.join(APP, 'js', 'bulut.js'), 'utf8');
  const idx = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
  K('?deneme modunda bulut kapali (kodda kontrol var)', /DENEME_MODU\) return false/.test(bulutSrc));
  K('index.html: bulut.js, storage.js sonrasinda', idx.indexOf('js/bulut.js') > idx.indexOf('js/storage.js'));
  K('index.html: Firebase kutuphaneleri + config yuklu', /firebase-app-compat/.test(idx) && /firebase-firestore-compat/.test(idx) && /js\/firebase-config\.js/.test(idx));
  const cfg = fs.readFileSync(path.join(APP, 'js', 'firebase-config.js'), 'utf8');
  K('firebase-config.js Petek projesine ayarli', /projectId: "petek-cizelge"/.test(cfg));
  const kuralYolu = path.join(APP, '..', 'firebase', 'firestore.rules');
  if(fs.existsSync(kuralYolu)){
    const kural = fs.readFileSync(kuralYolu, 'utf8');
    K('guvenlik kurali: giris + hesap kimligi (uid) izin listesi zorunlu', /request\.auth != null/.test(kural) && /request\.auth\.uid in \[/.test(kural));
    K('guvenlik kurali: baska hicbir yola erisim yok', /match \/\{baska=\*\*\}[\s\S]*?if false/.test(kural));
    K('guvenlik kurali: "allow ... if true" YOK', !/if true/.test(kural));
  } else console.log('  [ATLANDI] firebase/firestore.rules yok (ozel klasorde, bu kopyada bulunmuyor)');

  Bulut._testSifirla();
  console.log('');
  console.log('  Sonuc: ' + gecen + ' gecti, ' + kalan + ' kaldi');
})();
