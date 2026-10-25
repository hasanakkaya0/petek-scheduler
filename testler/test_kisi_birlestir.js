/* ============================================================
   KISILERI BIRLESTIR + YENIDEN ISE AL TESTI
   Sorun: ayrilan biri geri gelince "ayni isim var" uyarisi yuzunden yeni kayit acildi
   ("Ad" -> "Ad."); ayni kisi iki kayit oldu (bakiye, yillik izin, gecmis ikiye bolundu).
   Bkz. js/kisi-birlestir.js. Uydurma isimler kullanilir (bu dosya herkese acik depoya gider).
   ============================================================ */
(async () => {
  await new Promise(r => setTimeout(r, 80));
  let gecen = 0, kalan = 0;
  const K = (ad, sart) => { if(sart){ gecen++; console.log('  [GECTI] ' + ad); } else { kalan++; console.log('  [KALDI] ' + ad); } };
  const bekle = ms => new Promise(r => setTimeout(r, ms));
  global.alert = () => {};

  // ---------- 1) Ad karsilastirma ----------
  K('norm: noktalama, buyuk/kucuk harf ve Turkce harf farki yok sayilir', KisiBirlestir.norm('Kişi Mnur H.') === 'seymanur h' && KisiBirlestir.norm('ÇAĞLAR  Bey') === 'caglar bey');
  K('ilkAd: "Defne Hanım." -> defne', KisiBirlestir.ilkAd('Defne Hanım.') === 'defne' && KisiBirlestir.ilkAd('Defne Hanım') === 'defne');

  // ---------- 2) Uydurma kadro ----------
  const temel = {hasRow: true, type: 'Tam zamanlı', backup: [], sup: false};
  currentMonday = new Date(2031, 0, 6);
  PEOPLE = [
    Object.assign({}, temel, {name: 'Defne Hanım',  hours: 10, primary: ['KASA'], startWeek: '2030-12-30', endWeek: '2031-01-13', izinHakki: 14, prefOff: 'weekend'}),   // eski (ayrilan)
    Object.assign({}, temel, {name: 'Defne Hanım.', hours: 9,  primary: ['KIRTASIYE'], startWeek: '2031-01-20', offDays: 1}),                                          // yeni
    Object.assign({}, temel, {name: 'Orhan Bey',    hours: 10, primary: ['DEPO'], startWeek: '2030-12-30'}),                                                          // aktif
    Object.assign({}, temel, {name: 'Orhan Demir',  hours: 10, primary: ['DEPO'], startWeek: '2030-12-30', endWeek: '2031-01-06'}),                                  // ayrilan: FARKLI kisi olabilir
    Object.assign({}, temel, {name: 'Sevgi Bey',    hours: 10, primary: ['KASA']}),                                                                                  // ikisi de aktif:
    Object.assign({}, temel, {name: 'Sevgi Aksoy',  hours: 10, primary: ['KASA']}),                                                                                  // iki farkli kisi olabilir
    Object.assign({}, temel, {name: 'Selim Karaca', hours: 10, primary: ['KASA'], startWeek: '2030-12-30', endWeek: '2031-01-13'}),
    Object.assign({}, temel, {name: 'Selim K.',     hours: 10, primary: ['KASA'], startWeek: '2031-01-20'}),
  ];
  ayriKisiler = [];
  rebuildPeople();

  // ---------- 3) Supheli ciftler ----------
  let adaylar = KisiBirlestir.adaylar().map(c => KisiBirlestir.cift(c.a.name, c.b.name));
  K('"Defne Hanım" / "Defne Hanım." aday olarak bulundu', adaylar.includes(KisiBirlestir.cift('Defne Hanım', 'Defne Hanım.')));
  K('"Selim Karaca" / "Selim K." (kisaltma) bulundu', adaylar.includes(KisiBirlestir.cift('Selim Karaca', 'Selim K.')));
  K('ikisi de AKTIF olan "Sevgi Bey"/"Sevgi Aksoy" aday DEGIL (iki farkli kisi olabilir)', !adaylar.includes(KisiBirlestir.cift('Sevgi Bey', 'Sevgi Aksoy')));
  K('"Orhan Bey"/"Orhan Demir" supheli olarak listelenir', adaylar.includes(KisiBirlestir.cift('Orhan Bey', 'Orhan Demir')));
  ayriKisiler.push(KisiBirlestir.cift('Orhan Bey', 'Orhan Demir'));
  adaylar = KisiBirlestir.adaylar().map(c => KisiBirlestir.cift(c.a.name, c.b.name));
  K('"Aynı kişi değil" denince bir daha listelenmez', !adaylar.includes(KisiBirlestir.cift('Orhan Bey', 'Orhan Demir')) && adaylar.length === 2);

  // uyari kutusu
  const kutu = {innerHTML: ''}, eskiGet = document.getElementById;
  document.getElementById = id => id === 'kisiUyari' ? kutu : eskiGet(id);
  KisiBirlestir.uyariCiz();
  K('uyari kutusu: "aynı kişi olabilir" + Birlestir/degil dugmeleri', /aynı kişi olabilir/.test(kutu.innerHTML) && /kb-birlestir/.test(kutu.innerHTML) && /kb-degil/.test(kutu.innerHTML));
  document.getElementById = eskiGet;

  // ---------- 4) Roller, bosluk, birlesik kayit ----------
  const eski = PEOPLE[0], yeni = PEOPLE[1];
  const rol = KisiBirlestir.roller(yeni, eski);
  K('roller: ayrilan KALAN (gecmisi tasir), yeni KAYNAK', rol.kalan === eski && rol.kaynak === yeni);
  K('bosHaftaSayisi: ardisik haftalar = 0 (kesintisiz)', KisiBirlestir.bosHaftaSayisi('2031-01-13', '2031-01-20') === 0);
  K('bosHaftaSayisi: 2 hafta ara = 2', KisiBirlestir.bosHaftaSayisi('2031-01-13', '2031-02-03') === 2);
  K('kesisiyor: ardisik donemler cakismaz', KisiBirlestir.kesisiyor(eski, yeni) === false);
  K('kesisiyor: baslangici olmayan aktif kayit eskiyle cakisir', KisiBirlestir.kesisiyor(eski, {name: 'x'}) === true);
  const bk = KisiBirlestir.birlesikKayit(eski, yeni, 'Defne Hanım');
  K('birlesik kayit: ad secilen ad', bk.name === 'Defne Hanım');
  K('birlesik kayit: ayarlar EN GUNCEL (yeni) kayittan (9 sa, Kirtasiye)', bk.hours === 9 && bk.primary[0] === 'KIRTASIYE' && bk.offDays === 1 && !bk.prefOff);
  K('birlesik kayit: ilk baslangic korunur, ayrilma tarihi kalkar', bk.startWeek === '2030-12-30' && bk.endWeek === undefined);
  K('birlesik kayit: yeni kayitta olmayan yillik izin hakki eskiden alinir', bk.izinHakki === 14);

  // ---------- 5) Haftalik kayitlar ----------
  const gunler = h => [...Array(7)].map((_, i) => fmtDate(addDays(new Date(h + 'T00:00'), i)));
  const haftaYap = (h, doldur) => {
    const wd = {days: {}};
    gunler(h).forEach(g => { wd.days[g] = {assignments: {}, sup: null}; });
    doldur(wd.days, gunler(h));
    return wd;
  };
  const calis = (s, e, z) => ({leave: 'NONE', start: s, end: e, zone: z});
  const yillik = () => ({leave: 'YILLIK', start: null, end: null, zone: null});
  await store.set('week:2031-01-06', JSON.stringify(haftaYap('2031-01-06', (d, g) => {
    d[g[0]].assignments['Defne Hanım'] = calis('09:00', '19:00', 'KASA');     // eski kayit calisiyor
    d[g[1]].assignments['Defne Hanım'] = yillik();
  })));
  await store.set('week:2031-01-13', JSON.stringify(haftaYap('2031-01-13', (d, g) => {
    d[g[2]].assignments['Defne Hanım'] = calis('10:00', '20:00', 'KASA');     // CAKISMA: ikisinde de dolu
    d[g[2]].assignments['Defne Hanım.'] = calis('12:00', '21:00', 'KIRTASIYE');
  })));
  await store.set('week:2031-01-20', JSON.stringify(haftaYap('2031-01-20', (d, g) => {
    d[g[0]].assignments['Defne Hanım.'] = calis('10:00', '19:00', 'KIRTASIYE'); // yeni kayit calisiyor
    d[g[1]].assignments['Defne Hanım.'] = yillik();
    d[g[0]].sup = 'Defne Hanım.';
  })));
  ledger = [
    {id: 'a', name: 'Defne Hanım',  date: '2031-01-10', hours: 2,  note: '', ts: 1},
    {id: 'b', name: 'Defne Hanım.', date: '2031-01-22', hours: -1, note: '', ts: 2},
    {id: 'c', name: 'Orhan Bey',    date: '2031-01-22', hours: 5,  note: '', ts: 3},
  ];
  await loadWeek(); ensureWeekPeople();       // mevcut hafta (2031-01-06) bellekte

  // ---------- 6) Onizleme ----------
  const o = await KisiBirlestir.onizle('Defne Hanım', 'Defne Hanım.', 'Defne Hanım');
  K('onizleme: 3 hafta etkilenir', o.hafta === 3);
  K('onizleme: yeni kayittan 3 dolu hucre tasinir (' + o.hucre + ')', o.hucre === 3);
  K('onizleme: 1 cakisma (ayni gunde ikisinde de vardiya)', o.cakisma === 1);
  K('onizleme: 1 yillik izin gunu, 1 akşam sorumlusu atamasi', o.yillik === 1 && o.sup === 1);
  K('onizleme: 2 Borc/Alacak hareketi (Orhan\'in hareketi sayilmaz)', o.ledger === 2);
  K('onizleme: ardisik donem = bosluk yok, cakisma uyarisi yok', o.bosluk === 0 && o.kesisiyor === false);
  K('onizleme hicbir seyi DEGISTIRMEDI (iki kayit hala duruyor)', PEOPLE.some(p => p.name === 'Defne Hanım.') && ledger.some(l => l.name === 'Defne Hanım.'));

  // ---------- 7) Birlestirme ----------
  let indirilen = null;
  const eskiCreate = document.createElement;
  document.createElement = tag => { const e = eskiCreate(tag); if(tag === 'a') e.click = () => { indirilen = e; }; return e; };
  const s = await KisiBirlestir.uygula('Defne Hanım', 'Defne Hanım.', 'Defne Hanım');
  document.createElement = eskiCreate;
  await bekle(700);                            // mevcut haftanin gecikmeli kaydi
  K('bulut yokken guvenlik kopyasi DOSYA olarak indirildi', s.kopya === 'dosya' && indirilen !== null);
  K('tek kayit kaldi: "Defne Hanım." silindi, "Defne Hanım" duruyor', PEOPLE.filter(p => KisiBirlestir.ilkAd(p.name) === 'defne').length === 1 && PEOPLE.some(p => p.name === 'Defne Hanım'));
  const bp = PEOPLE.find(p => p.name === 'Defne Hanım');
  K('kayit: ayrilma tarihi kalktı, guncel ayarlar var', !bp.endWeek && bp.hours === 9 && bp.startWeek === '2030-12-30');
  const oku = async h => JSON.parse((await store.get('week:' + h)).value);
  const w13 = await oku('2031-01-13'), w20 = await oku('2031-01-20');
  const g13 = gunler('2031-01-13'), g20 = gunler('2031-01-20');
  K('cakisan gun: KALAN (eski) kaydin vardiyasi korundu (10:00-20:00)', w13.days[g13[2]].assignments['Defne Hanım'].start === '10:00' && !('Defne Hanım.' in w13.days[g13[2]].assignments));
  K('yeni kaydin vardiyasi eski ada tasindi', w20.days[g20[0]].assignments['Defne Hanım'].start === '10:00' && !('Defne Hanım.' in w20.days[g20[0]].assignments));
  K('akşam sorumlusu atamasi yeni ada gecti', w20.days[g20[0]].sup === 'Defne Hanım');
  K('mevcut (bellekteki) hafta da dogru ve kayitli', weekData.days[gunler('2031-01-06')[0]].assignments['Defne Hanım'].start === '09:00' && (await oku('2031-01-06')).days[gunler('2031-01-06')[0]].assignments['Defne Hanım'].start === '09:00');
  K('Borc/Alacak hareketleri tek isimde toplandi (3 -> Orhan\'inki dokunulmadi)', ledger.filter(l => l.name === 'Defne Hanım').length === 2 && ledger.every(l => l.name !== 'Defne Hanım.') && ledger.find(l => l.name === 'Orhan Bey').hours === 5);
  const sayim = await yillikIzinleriTara();
  K('yillik izin sayaci TEK kayitta toplandi (2 gun)', (sayim[2031] || {})['Defne Hanım'] === 2 && !(sayim[2031] || {})['Defne Hanım.']);
  K('ayarlar kaydedildi (yenilenince geri gelmez)', (JSON.parse((await store.get('settings')).value).people || []).filter(p => /^Defne/.test(p.name)).length === 1);
  let hata = null; try{ await KisiBirlestir.uygula('Orhan Bey', 'Orhan Demir', 'Baska Ad'); }catch(e){ hata = e; }
  K('gecersiz ad secimi reddedilir', !!hata && PEOPLE.some(p => p.name === 'Orhan Demir'));

  // ---------- 8) Yeniden ise al ----------
  const sk = PEOPLE.find(p => p.name === 'Selim Karaca');
  const donus = await KisiBirlestir.yenidenIseAl('Selim Karaca');
  K('yeniden ise al: ayrilma kaydi kalkar, ayni kayit devam eder', !sk.endWeek && PEOPLE.includes(sk));
  K('yeniden ise al: 2031-01-13\'te ayrilip 2031-01-06 haftasinda bakilirken bosluk = 0', donus && donus.bosluk === 0);
  K('yeniden ise alinca kisi o haftanin kadrosunda', ROSTER.some(p => p.name === 'Selim Karaca'));
  K('ayrilmamis kayit icin islem yapilmaz (null)', (await KisiBirlestir.yenidenIseAl('Orhan Bey')) === null);

  // ---------- 9) Bulutta: guvenlik kopyasi bulut kopyalarina yazilir ----------
  PEOPLE = [
    Object.assign({}, temel, {name: 'Tuna Hanım',  hours: 10, primary: ['KASA'], startWeek: '2030-12-30', endWeek: '2031-01-13'}),
    Object.assign({}, temel, {name: 'Tuna Hanım.', hours: 10, primary: ['KASA'], startWeek: '2031-01-20'}),
  ];
  rebuildPeople();
  await saveSettings();
  const kv = new Map(); const kopyalar = new Map();
  for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if(k && k.startsWith('petek:') && (k === 'petek:settings' || k.startsWith('petek:week:'))) kv.set(k.slice(6), localStorage.getItem(k)); }
  let onVeri = null;
  const adapter = {
    dinle(cb){ onVeri = cb; setTimeout(() => cb([...kv].map(([id, value]) => ({id, value, yerel: false, silindi: false}))), 0); },
    yaz(id, value){ kv.set(id, value); onVeri([{id, value, yerel: true, silindi: false}]); return Promise.resolve(); },
    sil(id){ kv.delete(id); return Promise.resolve(); },
    kopyaYaz(id, d){ kopyalar.set(id, d); return Promise.resolve(); },
    kopyaOku(id){ return Promise.resolve(kopyalar.get(id) || null); }, kopyaVarMi(id){ return Promise.resolve(kopyalar.has(id)); },
    kopyaListe(){ return Promise.resolve([]); }, kopyaSil(id){ kopyalar.delete(id); return Promise.resolve(); },
  };
  await Bulut._testBaslat(adapter);
  await loadSettings(); haftayaGoreKadroyuTazele(); await loadWeek(); ensureWeekPeople();
  const sb = await KisiBirlestir.uygula('Tuna Hanım', 'Tuna Hanım.', 'Tuna Hanım');
  const kopyaId = [...kopyalar.keys()].find(k => k.includes('-once-'));
  K('bulutta: birlestirmeden ONCE bulut kopyasi alindi', sb.kopya === 'bulut' && !!kopyaId && kopyalar.get(kopyaId).etiket === 'birlestirme-oncesi');
  K('bulutta: kisi kaydi buluta yazildi (tek Tuna)', (JSON.parse(kv.get('settings')).people || []).filter(p => /^Tuna/.test(p.name)).length === 1);
  Bulut._testSifirla();

  // ---------- 10) Kaynak: arayuz ----------
  const fs = require('fs'), path = require('path');
  const idx = fs.readFileSync(path.join(process.env.APPDIR, 'index.html'), 'utf8');
  K('birlestirme penceresi ve uyari kutusu sayfada', /id="birlestirOverlay"/.test(idx) && /id="kisiUyari"/.test(idx) && /id="kbUygula"/.test(idx));
  K('kisi penceresinde "Aynı kişiyle birleştir…" dugmesi', /id="pBirlestir"/.test(idx));
  K('kisi-birlestir.js settings-panels.js\'ten sonra yuklenir', idx.indexOf('js/kisi-birlestir.js') > idx.indexOf('js/settings-panels.js'));
  const ayrilan = personelSatiri({name: 'Test Kisi', type: 'Tam zamanlı', primary: [], backup: [], endWeek: '2031-01-13'}, 0);
  const aktif = personelSatiri({name: 'Test Kisi', type: 'Tam zamanlı', primary: [], backup: []}, 0);
  K('ayrilan satirinda "yeniden işe al" ve "birleştir…" dugmeleri var', /pyeniden/.test(ayrilan) && /pbirlestir/.test(ayrilan));
  K('aktif satirda bu dugmeler YOK', !/pyeniden/.test(aktif) && !/pbirlestir/.test(aktif));
  K('"aynı kişi değil" kararlari ayarlarla kaydedilir (ayriKisiler)', /ayriKisiler/.test(idx) && /s\.ayriKisiler/.test(idx));

  console.log('');
  console.log('  Sonuc: ' + gecen + ' gecti, ' + kalan + ' kaldi');
})();
