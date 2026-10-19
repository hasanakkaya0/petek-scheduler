/* ============================================================
   OTOMATIK KOPYALAR TESTI (gunluk anlik kopya, son 14 gun, geri donus)
   Gercek veriyle (yedekten gelen tohum) calisir; sahte Firestore kullanir.
   Bkz. js/oto-kopya.js, js/bulut.js (kopya*), index.html (yedegiUygula)
   ============================================================ */
(async () => {
  await new Promise(r => setTimeout(r, 80));
  let gecen = 0, kalan = 0;
  const K = (ad, sart) => { if(sart){ gecen++; console.log('  [GECTI] ' + ad); } else { kalan++; console.log('  [KALDI] ' + ad); } };

  // ---- Sahte sunucu: kv belgeleri + kopyalar ----
  function sunucuYap(kvBaslangic){
    const s = { kv: new Map(Object.entries(kvBaslangic || {})), kopyalar: new Map(), kopyaYazimi: 0, onVeri: null };
    s.adapter = {
      dinle(onVeri){ s.onVeri = onVeri; setTimeout(() => onVeri([...s.kv].map(([id, value]) => ({id, value, yerel: false, silindi: false}))), 0); },
      yaz(id, value){ s.kv.set(id, value); s.onVeri([{id, value, yerel: true, silindi: false}]); return Promise.resolve(); },
      sil(id){ s.kv.delete(id); s.onVeri([{id, value: null, yerel: true, silindi: true}]); return Promise.resolve(); },
      kopyaYaz(id, data){ s.kopyaYazimi++; s.kopyalar.set(id, Object.assign({}, data)); return Promise.resolve(); },
      kopyaOku(id){ return Promise.resolve(s.kopyalar.has(id) ? s.kopyalar.get(id) : null); },
      kopyaVarMi(id){ return Promise.resolve(s.kopyalar.has(id)); },
      kopyaListe(){ return Promise.resolve([...s.kopyalar].map(([id, d]) => ({id, gun: d.gun, etiket: d.etiket, hafta: d.hafta, boyut: d.boyut})).sort((a, b) => b.id.localeCompare(a.id))); },
      kopyaSil(id){ s.kopyalar.delete(id); return Promise.resolve(); },
    };
    return s;
  }

  // Gercek veri: tohumdaki 'petek:' kayitlari
  const gercek = {};
  for(let i = 0; i < localStorage.length; i++){
    const k = localStorage.key(i);
    if(k && k.startsWith('petek:') && (k === 'petek:settings' || k.startsWith('petek:week:'))) gercek[k.slice(6)] = localStorage.getItem(k);
  }
  const haftaSayisi = Object.keys(gercek).filter(k => k.startsWith('week:')).length;
  console.log('    (bilgi: tohumda ' + haftaSayisi + ' hafta, ' + Math.round(Object.values(gercek).join('').length / 1024) + ' KB ham veri)');

  const sun = sunucuYap(gercek);
  await Bulut._testBaslat(sun.adapter);
  currentMonday = new Date(2026, 9, 12);
  await loadSettings(); haftayaGoreKadroyuTazele(); await loadWeek(); ensureWeekPeople();

  // --- 1) Sikistirma ---
  const yedek = await collectBackup();
  const pak = await OtoKopya.sikistir(yedek);
  const geri = await OtoKopya.ac({bicim: pak.bicim, veri: pak.veri});
  K('sikistir/ac gidis-donus AYNI veriyi verir', JSON.stringify(geri) === JSON.stringify(yedek));
  K('gzip kullaniliyor', pak.bicim === 'gzip-base64');
  K('sikistirilmis hali ham verinin 1/3\'unden kucuk (' + Math.round(pak.veri.length / 1024) + ' KB / ' + Math.round(pak.boyut / 1024) + ' KB)', pak.veri.length < pak.boyut / 3);
  K('belge sinirinin (900 KB) altinda', pak.veri.length < 900000);
  const duz = await OtoKopya.sikistir({a: 1}); duz.bicim = 'json'; duz.veri = JSON.stringify({a: 1});
  K('sikistirilmamis "json" bicimi de acilir', (await OtoKopya.ac(duz)).a === 1);

  // --- 2) Gunluk kopya ---
  const bugun = fmtDate(new Date());
  localStorage.removeItem('petek-son-kopya');
  let sonuc = await OtoKopya.gunluk();
  K('ilk acilista kopya alindi', sonuc === 'alindi' && sun.kopyalar.has(bugun));
  const k = sun.kopyalar.get(bugun);
  K('kopyada gun, hafta sayisi, boyut var', k.gun === bugun && k.hafta === haftaSayisi && k.boyut > 0 && k.etiket === 'gunluk');
  const kopyaIcerik = await OtoKopya.ac(k), simdiki = await collectBackup();
  K('kopyanin icerigi guncel veriyle AYNI (ayar + butun haftalar)', JSON.stringify(kopyaIcerik.settings) === JSON.stringify(simdiki.settings) && JSON.stringify(kopyaIcerik.weeks) === JSON.stringify(simdiki.weeks));
  const yazim = sun.kopyaYazimi;
  sonuc = await OtoKopya.gunluk();
  K('ayni gun ikinci acilis: tekrar kopya ALINMAZ (isaret)', sonuc === 'zaten' && sun.kopyaYazimi === yazim);
  localStorage.removeItem('petek-son-kopya');
  sonuc = await OtoKopya.gunluk();
  K('baska bilgisayar bugun almissa tekrar yazilmaz', sonuc === 'vardi' && sun.kopyaYazimi === yazim);

  // --- 3) Saklama suresi: 14 gunden eskiler silinir ---
  const gunOnce = n => { const d = new Date(); d.setDate(d.getDate() - n); return fmtDate(d); };
  [3, 13, 14, 15, 20, 28].forEach(n => sun.kopyalar.set(gunOnce(n), {gun: gunOnce(n), etiket: 'gunluk', hafta: 1, boyut: 1, bicim: 'json', veri: '{}'}));
  await OtoKopya.eskileriSil();
  K('13 gun onceki kopya duruyor', sun.kopyalar.has(gunOnce(13)) && sun.kopyalar.has(gunOnce(3)));
  K('14 ve daha eski kopyalar silindi', !sun.kopyalar.has(gunOnce(14)) && !sun.kopyalar.has(gunOnce(15)) && !sun.kopyalar.has(gunOnce(20)) && !sun.kopyalar.has(gunOnce(28)));
  K('bugunun kopyasi silinmedi', sun.kopyalar.has(bugun));

  // --- 4) Geri donus ---
  const eskiAyar = sun.kv.get('settings');
  const eskiHaftalar = [...sun.kv.keys()].filter(x => x.startsWith('week:')).sort();
  const ayarObj = JSON.parse(eskiAyar); ayarObj.sundayComp = !ayarObj.sundayComp;
  await Bulut.set('settings', JSON.stringify(ayarObj));                 // sonradan degisen ayar
  await Bulut.set('week:2099-01-04', JSON.stringify({days: {}}));      // sonradan acilan hafta
  const bosKopyaOncesi = sun.kopyalar.size;
  const r = await OtoKopya.geriYukle(bugun);
  K('geri donus: ayar kopyadaki hale dondu', sun.kv.get('settings') === eskiAyar);
  K('geri donus: sonradan acilan hafta silindi (birebir)', !sun.kv.has('week:2099-01-04'));
  K('geri donus: kopyadaki butun haftalar yerinde', eskiHaftalar.every(x => sun.kv.has(x)) && r.hafta === haftaSayisi);
  const guvenlik = [...sun.kopyalar.keys()].filter(x => x.includes('-once-'));
  K('geri donusten ONCE guvenlik kopyasi alindi', guvenlik.length === 1 && sun.kopyalar.size === bosKopyaOncesi + 1);
  const gk = await OtoKopya.ac(sun.kopyalar.get(guvenlik[0]));
  K('guvenlik kopyasi donus oncesi halini tasiyor (2099 haftasi dahil)', !!gk.weeks['week:2099-01-04'] && sun.kopyalar.get(guvenlik[0]).etiket === 'geri-donus-oncesi');

  // --- 5) Bos veri yedeklenmez ---
  Bulut._testSifirla();
  const sunBos = sunucuYap({});
  await Bulut._testBaslat(sunBos.adapter);
  PEOPLE = []; rebuildPeople();
  localStorage.removeItem('petek-son-kopya');
  sonuc = await OtoKopya.gunluk();
  K('bos veri varken kopya ALINMAZ', sonuc === 'bos' && sunBos.kopyaYazimi === 0);

  // --- 6) Bulut kapaliyken hicbir sey yapmaz ---
  Bulut._testSifirla();
  K('bulut kapaliyken gunluk() sessizce atlar (null)', (await OtoKopya.gunluk()) === null);

  // --- 7) Kaynak: menu, sabit sutunlar, kurallar ---
  const fs = require('fs'), path = require('path');
  const idx = fs.readFileSync(path.join(process.env.APPDIR, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(process.env.APPDIR, 'css', 'styles.css'), 'utf8');
  const menuBas = idx.indexOf('id="dahaFazlaMenu"'), menuSon = idx.indexOf('</div>', idx.indexOf('id="btnReset"'));
  const menuIci = idx.slice(menuBas, menuSon);
  K('menu: Yedek al / Yedekten yukle / Otomatik kopyalar / Haftayi sifirla menunun ICINDE', ['btnBackup', 'btnRestore', 'btnOtoKopya', 'btnReset'].every(id => menuIci.includes('id="' + id + '"')));
  const menuOnce = idx.slice(idx.indexOf('<div class="toolbar">'), menuBas);
  K('menu disinda: Geri al, Kilitle, Otomatik olustur, Gorsel indir', ['btnUndo', 'btnLock', 'btnGenerate', 'btnPng'].every(id => menuOnce.includes('id="' + id + '"')));
  K('"Haftayi sifirla" kirmizi (tehlike) ogesi ve ayracin altinda', /menu-ayrac[\s\S]*?class="menu-oge tehlike" id="btnReset"/.test(idx));
  K('Otomatik kopyalar ogesi baslangicta gizli (yalniz bulutta acilir)', /id="btnOtoKopya" hidden/.test(idx));
  K('css: gun sutunu sola, aksam sorumlusu saga yapisik (sticky)', /#gridTable th\.corner, #gridTable td\.daycol\{position:sticky; left:0/.test(css) && /#gridTable th\.supcol, #gridTable td\.supcell\{position:sticky; right:0/.test(css));
  K('css: sayfa genisligi genis ekrana uyuyor', /\.wrap\{max-width:min\(1900px, 98vw\)/.test(css));
  K('kopyalar penceresi (kopyaOverlay) var', /id="kopyaOverlay"/.test(idx) && /id="kopyaListe"/.test(idx));
  K('dosyadan yukleme ve kopyadan donus ORTAK fonksiyonu kullanir (yedegiUygula)', (idx.match(/yedegiUygula\(/g) || []).length >= 2 && /async function yedegiUygula/.test(idx));
  const kuralYolu = path.join(process.env.APPDIR, '..', 'firebase', 'firestore.rules');
  if(fs.existsSync(kuralYolu)){
    const kural = fs.readFileSync(kuralYolu, 'utf8');
    K('kurallar: yedekler koleksiyonu yalniz yetkili hesaba acik, alan kisitli', /workspaces\/petek\/yedekler/.test(kural) && /hasOnly\(\['gun', 'etiket', 'hafta', 'boyut', 'bicim', 'veri', 'olusturma', 'by'\]\)/.test(kural));
  }

  console.log('');
  console.log('  Sonuc: ' + gecen + ' gecti, ' + kalan + ' kaldi');
})();
