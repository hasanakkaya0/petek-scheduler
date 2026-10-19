/* ============================================================
   HUCRE DUZENLEME TESTI
   1) Bos hucre acilinca saatler BOS gelmesin: kisinin gunluk saatine gore onerilen vardiya.
   2) Saatler bos birakilip Kaydet'e basilirsa GORUNMEZ "sabit" olusmasin (hucre temizlenir);
      eski veride kalan boyle kayitlar temizlensin; sabit sayaci ve jenerator bunlari saymasin.
   Bkz. js/modals.js (openEditor, hucreyiKaydet), js/utils.js (bosSabitleriTemizle),
        js/render.js (sabitHucreSay), js/generator.js
   ============================================================ */
(async () => {
  await new Promise(r => setTimeout(r, 80));
  let gecen = 0, kalan = 0;
  const K = (ad, sart) => { if(sart){ gecen++; console.log('  [GECTI] ' + ad); } else { kalan++; console.log('  [KALDI] ' + ad); } };

  // pencere ogeleri kalici olsun (getElementById her seferinde yeni nesne uretir)
  const eskiGet = document.getElementById, onbellek = {};
  document.getElementById = id => onbellek[id] || (onbellek[id] = eskiGet(id));
  const el = id => document.getElementById(id);
  let uyari = null; global.alert = m => { uyari = m; };

  currentMonday = new Date(2031, 0, 6);          // verisiz hafta
  await loadWeek(); ensureWeekPeople();
  const kisi = ROSTER.find(p => !isOnCall(p) && p.hours);
  const pzt = fmtDate(currentMonday), sal = fmtDate(addDays(currentMonday, 1));
  const beklenen = makeShift(kisi, new Date(pzt + 'T00:00'), 'open');

  // --- 1) Bos hucre: onerilen saat ---
  openEditor(pzt, kisi.name);
  K('bos hucre: baslangic saati bos gelmez (' + el('fStart').value + ')', el('fStart').value === beklenen.start);
  K('bos hucre: bitis = baslangic + gunluk saat (' + el('fEnd').value + ')', el('fEnd').value === beklenen.end);
  const sure = (toMin(el('fEnd').value) - toMin(el('fStart').value)) / 60;
  K('onerilen vardiya kisinin kotasi kadar (' + sure + ' sa / kota ' + kisi.hours + ')', Math.abs(sure - Math.min(kisi.hours, (toMin(operatingHours(new Date(pzt + 'T00:00')).close) - toMin(operatingHours(new Date(pzt + 'T00:00')).open)) / 60)) < 0.01);
  K('"onerilen vardiya" ipucu gorunur', el('oneriNot').hidden === false);
  K('onerilen saat dukkan saatleri icinde', toMin(el('fStart').value) >= toMin(operatingHours(new Date(pzt + 'T00:00')).open) && toMin(el('fEnd').value) <= toMin(operatingHours(new Date(pzt + 'T00:00')).close));

  // --- 2) Onerilen saatle Kaydet: normal sabit vardiya ---
  hucreyiKaydet();
  let a = weekData.days[pzt].assignments[kisi.name];
  K('onerilen saatle kaydedince vardiya olustu', isWorking(a) && a.start === beklenen.start && a.end === beklenen.end);
  K('kaydedilen hucre sabit (varsayilan) ve sayaca giriyor', a.manual === true && sabitHucreSay() === 1);

  // --- 3) Dolu hucre acilinca mevcut saat korunur, ipucu yok ---
  openEditor(pzt, kisi.name);
  K('dolu hucre: mevcut saat aynen gelir, ipucu gizli', el('fStart').value === a.start && el('oneriNot').hidden === true);

  // --- 4) Saatleri BOSALTIP Kaydet = hucre temizlenir, gorunmez sabit OLUSMAZ ---
  openEditor(sal, kisi.name);
  el('fStart').value = ''; el('fEnd').value = '';
  const undoOnce = undoYigin.length;
  hucreyiKaydet();
  a = weekData.days[sal].assignments[kisi.name];
  K('bos kaydetme: hucre atanmamis kaldi', !isWorking(a) && a.leave === 'NONE' && !a.start && !a.end);
  K('bos kaydetme: SABIT isareti OLUSMADI (gorunmez sabit yok)', !a.manual);
  K('bos kaydetme: sabit sayaci artmadi (sadece Pazartesi)', sabitHucreSay() === 1);
  K('bos kaydetme geri alinabilir', undoYigin.length === undoOnce + 1);

  // --- 5) Eksik / ters saatler engellenir ---
  openEditor(sal, kisi.name);
  el('fStart').value = '10:00'; el('fEnd').value = '';
  uyari = null; hucreyiKaydet();
  K('yalniz baslangic yazilirsa uyari verir ve KAYDETMEZ', !!uyari && /ikisini de/.test(uyari) && !weekData.days[sal].assignments[kisi.name].start);
  el('fStart').value = '18:00'; el('fEnd').value = '09:00';
  uyari = null; hucreyiKaydet();
  K('bitis baslangictan once ise uyari verir ve KAYDETMEZ', !!uyari && /Bitiş/.test(uyari) && !weekData.days[sal].assignments[kisi.name].start);
  el('fStart').value = '12:00'; el('fEnd').value = '21:00';
  uyari = null; hucreyiKaydet();
  K('gecerli saat kaydedilir', uyari === null && weekData.days[sal].assignments[kisi.name].start === '12:00');

  // --- 6) Eski veride kalan bos sabitler temizlenir ---
  const wd = {days: {a: {assignments: {
    X: {leave: 'NONE', start: null, end: null, zone: 'KASA', manual: true},        // bos sabit -> temizlenmeli
    Y: {leave: 'NONE', start: '09:00', end: '19:00', zone: 'KASA', manual: true},  // gercek sabit -> kalmali
    Z: {leave: 'YILLIK', start: null, end: null, zone: null, manual: true},        // yillik izin -> kalmali
  }}}};
  K('bosSabitleriTemizle 1 hucre temizledi', bosSabitleriTemizle(wd) === 1);
  K('bos sabit temizlendi; gercek sabit ve yillik izin KALDI', !wd.days.a.assignments.X.manual && wd.days.a.assignments.Y.manual === true && wd.days.a.assignments.Z.manual === true);
  K('bos/bozuk veride hata vermez', bosSabitleriTemizle(null) === 0 && bosSabitleriTemizle({}) === 0);

  // hafta yuklenirken temizleniyor
  const eskiKey = 'week:2032-01-05';
  const eskiVeri = {days: {}};
  for(let i = 0; i < 7; i++){ eskiVeri.days[fmtDate(addDays(new Date(2032, 0, 5), i))] = {assignments: {[kisi.name]: {leave: 'NONE', start: null, end: null, zone: null, manual: true}}, sup: null}; }
  await store.set(eskiKey, JSON.stringify(eskiVeri));
  currentMonday = new Date(2032, 0, 5);
  await loadWeek(); ensureWeekPeople();
  K('hafta yuklenince 7 gizli sabit temizlendi, sayac 0', sabitHucreSay() === 0 && Object.values(weekData.days).every(g => !g.assignments[kisi.name].manual));

  // --- 7) Sayac ve jenerator: bos sabiti saymaz / kilitlemez ---
  currentMonday = new Date(2026, 7, 17);
  await loadWeek(); ensureWeekPeople();
  const cars = fmtDate(addDays(currentMonday, 2));
  const kisi2 = ROSTER.find(p => !isOnCall(p) && isFullTime(p));
  const sabitOnce = sabitHucreSay();                     // bu haftada zaten gercek sabitler olabilir
  weekData.days[cars].assignments[kisi2.name] = {leave: 'NONE', start: null, end: null, zone: null, manual: true};   // eski hatali kayit
  K('sabit sayaci gorunmez bos sabiti SAYMAZ (' + sabitOnce + ' -> ' + sabitHucreSay() + ')', sabitHucreSay() === sabitOnce);
  prevSundayOff = new Set();
  generateWeek();
  const sonra = weekData.days[cars].assignments[kisi2.name];
  K('jenerator bos sabit hucreyi KILITLEMEZ: kisi o gun calisiyor ya da gercek izinde', !sonra.manual && (isWorking(sonra) || isOffLeave(sonra)));

  // --- 8) Kaynak ---
  const fs = require('fs'), path = require('path');
  const idx = fs.readFileSync(path.join(process.env.APPDIR, 'index.html'), 'utf8');
  const mod = fs.readFileSync(path.join(process.env.APPDIR, 'js', 'modals.js'), 'utf8');
  K('index.html: oneri ipucu satiri var', /id="oneriNot"/.test(idx));
  K('Kaydet dugmesi hucreyiKaydet fonksiyonuna bagli', /btnSave'\)\.addEventListener\('click', hucreyiKaydet\)/.test(mod));

  document.getElementById = eskiGet;
  console.log('');
  console.log('  Sonuc: ' + gecen + ' gecti, ' + kalan + ' kaldi');
})();
