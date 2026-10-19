/* ============================================================
   ORNEK VERI (DENEME MODU) TESTI
   Uydurma personel yuklenince program mantikli bir hafta kurabilmeli,
   kimse izinsiz kalmamali ve gercek isim icermemeli.
   Bkz. js/ornek-veri.js, js/storage.js (turuncu serit dugmesi)
   ============================================================ */
(async () => {
  await new Promise(r => setTimeout(r, 80));
  let gecen = 0, kalan = 0;
  const K = (ad, sart) => { if(sart){ gecen++; console.log('  [GECTI] ' + ad); } else { kalan++; console.log('  [KALDI] ' + ad); } };

  currentMonday = new Date(2026, 9, 12);
  ornekVeriyiKur();
  haftayaGoreKadroyuTazele();
  await loadWeek(); ensureWeekPeople();

  K('12 satirli personel + 1 yonetici yuklendi', PEOPLE.length === 13 && ROSTER.length === 12 && MANAGERS.length === 1);
  K('kurallar varsayilana dondu (5 kural)', rules.length === 5 && rules.every(r => r.enabled));
  K('borc/alacak kayitlari temizlendi', ledger.length === 0);
  K('her kisinin ana gorevi tanimli (satiri olanlar)', ROSTER.every(p => p.primary.length > 0));
  K('hicbir bolum kimsesiz degil', ZONES.filter(z => ['KASA','KIRTASIYE','DERS_KITAPLARI','FOTOKOPI','KAFE'].includes(z.id))
    .every(z => ROSTER.some(p => canCover(p, z.id))));

  prevSundayOff = new Set();
  const rapor = generateWeek();
  console.log('    (bilgi: acik nokta ' + rapor.gaps.length + ', uyari ' + rapor.warnings.length + ', duzenleme ' + rapor.moves.length + ')');

  let calisan = 0, izinsiz = 0, saatAsimi = 0, tasan = 0;
  ROSTER.forEach(p => {
    let gun = 0, izin = 0;
    for(let i = 0; i < 7; i++){
      const d = addDays(currentMonday, i), oh = operatingHours(d);
      const a = weekData.days[fmtDate(d)].assignments[p.name];
      if(isWorking(a)){
        gun++;
        if((toMin(a.end) - toMin(a.start)) / 60 > p.hours + 0.01) saatAsimi++;
        if(toMin(a.start) < toMin(oh.open) || toMin(a.end) > toMin(oh.close)) tasan++;
      } else if(isOffLeave(a)) izin++;
    }
    if(gun) calisan++;
    if(izin === 0 && gun >= 7) izinsiz++;
  });
  K('herkes bu hafta calisiyor (' + calisan + '/12)', calisan === 12);
  K('kimse izinsiz (7 gun) calismiyor', izinsiz === 0);
  K('kimse gunluk kotasini asmiyor', saatAsimi === 0);
  K('vardiyalar dukkan saatlerinin icinde', tasan === 0);
  K('uretilen haftada ciddi acik yok (en fazla 3 acik nokta)', rapor.gaps.length <= 3);
  K('kafe blogu (kritik) hic bos kalmiyor', !rapor.gaps.some(g => /Kafe/.test(g.label)));
  K('kasa hic bos kalmiyor', !rapor.gaps.some(g => /^Kasa/.test(g.label)));

  // Gizlilik: ornek isimler uydurma olmali — yasak liste burada TUTULMAZ (bu dosya
  // herkese acik depoya gider). Bunun yerine yalnizca yapisal kontrol: kisa tek kelimelik adlar.
  K('ornek adlar tek kelimelik (soyadsiz, uydurma)', ORNEK_PERSONEL.every(p => /^[A-Za-zÇĞİÖŞÜçğıöşü]+$/.test(p.name)));

  // Kaynak: deneme seridinde dugme var, gercek modda yok
  const fs = require('fs'), path = require('path');
  const st = fs.readFileSync(path.join(process.env.APPDIR, 'js', 'storage.js'), 'utf8');
  const idx = fs.readFileSync(path.join(process.env.APPDIR, 'index.html'), 'utf8');
  K('deneme seridinde "Ornek personeli yukle" dugmesi', /ornekVeriYukle\(\)/.test(st));
  K('dugme yalnizca DENEME_MODU blogunun icinde', /if\(DENEME_MODU\)\{[\s\S]*ornekVeriYukle[\s\S]*?\n\}/.test(st));
  K('ornek-veri.js sayfada yuklu', /js\/ornek-veri\.js/.test(idx));

  console.log('');
  console.log('  Sonuc: ' + gecen + ' gecti, ' + kalan + ' kaldi');
})();
