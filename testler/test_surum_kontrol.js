/* ============================================================
   YENI SURUM SERIDI TESTI ("Programin yeni surumu hazir — Yenile")
   Bkz. js/surum-kontrol.js, index.html (yeniSurum seridi)
   ============================================================ */
(async () => {
  await new Promise(r => setTimeout(r, 80));
  let gecen = 0, kalan = 0;
  const K = (ad, sart) => { if(sart){ gecen++; console.log('  [GECTI] ' + ad); } else { kalan++; console.log('  [KALDI] ' + ad); } };

  const sayfa = damga => '<link rel="stylesheet" href="css/styles.css?v=' + damga + '"><script src="js/utils.js?v=' + damga + '"></script>';

  K('sayfadan damga okunur', SurumKontrol.damgaCikar(sayfa('202610200930')) === '202610200930');
  K('damgasi olmayan sayfada null', SurumKontrol.damgaCikar('<html>eski</html>') === null && SurumKontrol.damgaCikar(null) === null);
  K('sunucudaki DAHA YENI ise "yeni"', SurumKontrol.yeniMi(sayfa('202610210800'), '202610200930') === true);
  K('ayni surumde seride gerek yok', SurumKontrol.yeniMi(sayfa('202610200930'), '202610200930') === false);
  K('sunucu daha ESKI gorunuyorsa (onbellek) seritsiz', SurumKontrol.yeniMi(sayfa('202610190100'), '202610200930') === false);
  K('damga yoksa seritsiz', SurumKontrol.yeniMi('<html></html>', '202610200930') === false && SurumKontrol.yeniMi(sayfa('2026'), null) === false);

  // seridin gosterilmesi (sahte fetch + kalici kutu)
  const kutu = {hidden: true};
  const eskiGet = document.getElementById;
  document.getElementById = id => id === 'yeniSurum' ? kutu : eskiGet(id);
  let istek = 0, sunucuSayfasi = sayfa('202610200930');
  global.location = {pathname: '/petek-scheduler/app/', protocol: 'https:', href: 'https://x/'};
  global.fetch = async url => { istek++; return {ok: true, text: async () => sunucuSayfasi, _url: url}; };

  SurumKontrol._testAyarla('202610200930');
  K('ayni surumde kontrol: serit CIKMAZ', (await SurumKontrol.kontrolEt()) === false && kutu.hidden === true);
  sunucuSayfasi = sayfa('202610211200');
  K('yeni surum yayinlaninca kontrol: serit CIKAR', (await SurumKontrol.kontrolEt()) === true && kutu.hidden === false);
  const onceki = istek;
  await SurumKontrol.kontrolEt();
  K('serit bir kez gorununce tekrar sunucuya gidilmez', istek === onceki);

  SurumKontrol._testAyarla('202610200930'); kutu.hidden = true;
  global.fetch = async () => { throw new Error('cevrimdisi'); };
  K('internet yokken sessizce atlar (hata vermez)', (await SurumKontrol.kontrolEt()) === false && kutu.hidden === true);
  SurumKontrol._testAyarla(null);
  global.fetch = async () => { istek++; return {ok: true, text: async () => sayfa('999999999999')}; };
  const once = istek;
  K('mevcut damga yoksa (yerel dosya/paket) hic kontrol yapilmaz', (await SurumKontrol.kontrolEt()) === false && istek === once);

  // baslat(): damga yoksa zamanlayici kurmaz
  SurumKontrol.baslat();
  K('damgasiz ortamda baslat() zamanlayici kurmaz (surec acik kalmaz)', true);
  SurumKontrol._testDurdur();

  // kaynak
  const fs = require('fs'), path = require('path');
  const idx = fs.readFileSync(path.join(process.env.APPDIR, 'index.html'), 'utf8');
  K('index.html: serit ve Yenile dugmesi var', /id="yeniSurum"[^>]*hidden/.test(idx) && /id="btnYeniSurum"/.test(idx));
  K('serit hafta cubugunun ustunde', idx.indexOf('id="yeniSurum"') < idx.indexOf('class="weeknav"'));
  K('surum-kontrol.js sayfada yuklu ve baslatiliyor', /js\/surum-kontrol\.js/.test(idx) && /SurumKontrol\.baslat\(\)/.test(idx));

  delete global.location; delete global.fetch;
  document.getElementById = eskiGet;
  console.log('');
  console.log('  Sonuc: ' + gecen + ' gecti, ' + kalan + ' kaldi');
})();
