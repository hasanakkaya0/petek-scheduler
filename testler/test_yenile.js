/* ============================================================
   YENILE DUGMESI TESTI (ust sag kose "↻ Yenile")
   Adresin sonuna her seferinde yeni damga eklenir; tarayici ana sayfayi
   onbellekten degil sunucudan alir. Bkz. js/utils.js (yenileAdresi),
   index.html (btnYenile)
   ============================================================ */
(async () => {
  await new Promise(r => setTimeout(r, 80));
  let gecen = 0, kalan = 0;
  const K = (ad, sart) => { if(sart){ gecen++; console.log('  [GECTI] ' + ad); } else { kalan++; console.log('  [KALDI] ' + ad); } };

  const A = 'https://hasanakkaya0.github.io/petek-scheduler/app/';
  const u1 = yenileAdresi(A, 111);
  K('adrese yenile damgasi eklenir', u1 === A + '?yenile=111');
  K('her seferinde farkli damga = farkli adres (onbellege takilmaz)', yenileAdresi(A, 111) !== yenileAdresi(A, 112));
  K('eski damga yenisiyle degisir, tekrarlanmaz', yenileAdresi(u1, 222) === A + '?yenile=222');
  const d = yenileAdresi(A + '?deneme', 5);
  K('?deneme korunur', /[?&]deneme/.test(d) && /yenile=5/.test(d));
  K('?deneme modu yenilemeden sonra da taninir (DENEME_MODU kalibi)', /[?&#]deneme\b/i.test(new URL(d).search));
  K('# kismi korunur', yenileAdresi(A + '#bolum', 7).endsWith('#bolum') && /yenile=7/.test(yenileAdresi(A + '#bolum', 7)));
  K('file:// adresiyle de calisir', /^file:\/\/\/.*\?yenile=9$/.test(yenileAdresi('file:///D:/Coding/app/index.html', 9)));

  // adres cubugunu temizleme
  global.location = {href: A + '?deneme=&yenile=123'};
  let son = null;
  global.history = {replaceState(a, b, url){ son = url; }};
  yenileIzininiTemizle();
  K('yenileme sonrasi ?yenile adres cubugundan silinir', son !== null && !/yenile/.test(son) && /deneme/.test(son));
  son = null; global.location = {href: A};
  yenileIzininiTemizle();
  K('?yenile yoksa adres cubuguna dokunulmaz', son === null);
  delete global.location; delete global.history;
  let hata = null; try{ yenileIzininiTemizle(); }catch(e){ hata = e; }
  K('location yokken (test/eski ortam) hata vermez', hata === null);

  // kaynak
  const fs = require('fs'), path = require('path');
  const idx = fs.readFileSync(path.join(process.env.APPDIR, 'index.html'), 'utf8');
  K('index.html: Yenile dugmesi var', /id="btnYenile"[^>]*>↻ Yenile</.test(idx));
  const verKutusu = idx.match(/<div class="ver" id="verBadge">[\s\S]*?<\/div>/);
  K('dugme hesap yazisinin (verBadge) DISINDA — bulut yazisi dugmeyi silmez', verKutusu && !/btnYenile/.test(verKutusu[0]));
  K('dugme hesap yazisindan ONCE (solunda)', idx.indexOf('id="btnYenile"') < idx.indexOf('id="verBadge"'));
  K('tiklayinca yenileAdresi kullaniliyor', /btnYenile'\)\.addEventListener\('click'[^\n]*yenileAdresi\(location\.href, Date\.now\(\)\)/.test(idx));

  console.log('');
  console.log('  Sonuc: ' + gecen + ' gecti, ' + kalan + ' kaldi');
})();
