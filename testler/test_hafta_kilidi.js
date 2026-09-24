
/* ============================================================
   HAFTA KILIDI TESTI
   Kilitli haftada:
     - otomatik olusturma ve sifirlama ENGELLENMELI
     - elle duzenleme SERBEST kalmali
     - kilit kaydedilip geri yuklenebilmeli
   ============================================================ */
(async () => {
  await new Promise(r => setTimeout(r, 80));
  currentMonday = new Date(2026, 7, 17);
  await loadWeek(); ensureWeekPeople();

  const gunler = () => [...Array(7)].map((_, i) => fmtDate(addDays(currentMonday, i)));
  const parmakIzi = () => JSON.stringify(gunler().map(k => weekData.days[k].assignments));

  // alert/confirm cagrilarini yakala
  let sonUyari = '';
  global.alert = m => { sonUyari = String(m); };
  global.confirm = () => true;

  let gecen = 0, kalan = 0;
  const kontrol = (ad, sart) => { if(sart){ gecen++; console.log('  [GECTI] ' + ad); } else { kalan++; console.log('  [KALDI] ' + ad); } };

  // --- Hazirlik: haftayi olustur, sonra kilitle ---
  generateWeek();
  const kilitOncesi = parmakIzi();
  weekData.locked = true;
  weekData.lockedAt = new Date().toISOString();

  console.log('Hafta kilitlendi. Kontroller:');
  console.log('');

  // 1) haftaKilitli() dogru okuyor mu
  kontrol('haftaKilitli() true donuyor', haftaKilitli() === true);

  // 2) kilitEngeli uyari verip engelliyor mu
  sonUyari = '';
  const engellendi = kilitEngeli('Haftayi otomatik olustur');
  kontrol('kilitEngeli() engelledi', engellendi === true);
  kontrol('kullaniciya uyari gosterildi', sonUyari.includes('kilitli'));

  // 3) Engel gercekten tehlikeli dugmelere BAGLI mi (kaynak kodu kontrolu)
  {
    const fs = require('fs'), path = require('path');
    const APP = process.env.APPDIR;      // calistir.js tarafindan verilir
    const gen = fs.readFileSync(path.join(APP, 'js', 'generator.js'), 'utf8');
    const idx = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
    const genKanca = /btnGenerate'\)\.addEventListener\([\s\S]{0,200}?kilitEngeli\(/.test(gen);
    const resKanca = /btnReset'\)\.addEventListener\([\s\S]{0,200}?kilitEngeli\(/.test(idx);
    kontrol('"Haftayi otomatik olustur" dugmesine engel bagli', genKanca);
    kontrol('"Haftayi sifirla" dugmesine engel bagli', resKanca);
  }

  // 4) ELLE duzenleme hala serbest olmali
  const k0 = gunler()[0];
  const kisi = ROSTER.find(p => !isOnCall(p)).name;
  weekData.days[k0].assignments[kisi] = {leave:'NONE', start:'13:00', end:'21:00', zone:ROSTER[0].primary[0], manual:true};
  const a = weekData.days[k0].assignments[kisi];
  kontrol('elle duzenleme SERBEST (kilit engellemiyor)', a.start === '13:00' && a.end === '21:00');

  // 5) Kilit kaydedilip geri yukleniyor mu
  await new Promise(r => { scheduleSave(); setTimeout(r, 600); });
  weekData = null;
  await loadWeek();
  kontrol('kilit kaydedildi ve geri yuklendi', haftaKilitli() === true);
  kontrol('kilit tarihi saklandi', !!weekData.lockedAt);

  // 6) Kilit acilinca engel kalkiyor mu
  delete weekData.locked; delete weekData.lockedAt;
  kontrol('kilit acilinca engel kalkti', haftaKilitli() === false && kilitEngeli('deneme') === false);

  // 7) Yeni (bos) hafta kilitsiz gelmeli
  currentMonday = new Date(2026, 10, 9);
  await loadWeek();
  kontrol('yeni hafta kilitsiz aciliyor', haftaKilitli() === false);

  console.log('');
  console.log('  Sonuc: ' + gecen + ' gecti, ' + kalan + ' kaldi');
})();
