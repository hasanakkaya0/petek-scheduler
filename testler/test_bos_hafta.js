/* ============================================================
   BOS HAFTA / ELLE DOLDURMA TESTI
   Hic vardiya girilmemis gunler "eksik" sayilmaz (35 satirlik kirmizi liste yok);
   ama kullanici elle doldurmaya basladigi gun eksikler gorunur olur.
   Bkz. js/validation.js (gunDoluMu, haftaSorunlariniHesapla, renderCanliDurum, renderTimeline)
   ============================================================ */
(async () => {
  await new Promise(r => setTimeout(r, 80));
  let gecen = 0, kalan = 0;
  const K = (ad, sart) => { if(sart){ gecen++; console.log('  [GECTI] ' + ad); } else { kalan++; console.log('  [KALDI] ' + ad); } };

  // kalici ekran ogeleri (getElementById her seferinde yeni nesne uretir)
  const ogeler = {genReport: {innerHTML: ''}, timeline: {innerHTML: ''}, violList: {innerHTML: ''}};
  const eskiGet = document.getElementById;
  document.getElementById = id => ogeler[id] || eskiGet(id);

  // --- 1) Tamamen bos hafta ---
  currentMonday = new Date(2031, 0, 6);
  await loadWeek(); ensureWeekPeople();
  let d = haftaSorunlariniHesapla();
  K('bos hafta algilanir (7 gun bos)', d.bosHafta === true && d.bosGunler.length === 7);
  K('bos haftada HICBIR sorun/not listelenmez (eskiden 35 satir)', d.sorunlar.length === 0 && d.notlar.length === 0);
  renderCanliDurum();
  const bosHtml = ogeler.genReport.innerHTML;
  K('bos haftada yonlendirme kutusu gorunur', /bos-hafta/.test(bosHtml) && /Haftayı otomatik oluştur/.test(bosHtml) && /kendin doldur/.test(bosHtml));
  K('bos haftada "sorun yok" DEMEZ (yaniltici olur)', !/sorun yok/.test(bosHtml) && /hafta henüz boş/.test(bosHtml));
  K('bos haftada kirmizi "Bos kalan saatler" listesi yok', !/Boş kalan saatler/.test(bosHtml) && !/g-gap/.test(bosHtml));
  selectedValidationDay = 0;
  renderTimeline();
  K('2. panel: bos gun icin kisa aciklama, kirmizi saat listesi yok', /henüz doldurulmamış/.test(ogeler.violList.innerHTML) && !/viol-item/.test(ogeler.violList.innerHTML));
  K('2. panel: zaman cubugu gri (kirmizi degil)', !/tseg bad/.test(ogeler.timeline.innerHTML) && /tseg off/.test(ogeler.timeline.innerHTML));

  // --- 2) Kullanici ELLE doldurmaya basliyor: sadece Pazartesi, tek kisi ---
  const kisi = ROSTER.find(p => !isOnCall(p) && p.primary.includes('KASA')) || ROSTER.find(p => !isOnCall(p));
  const pzt = fmtDate(currentMonday);
  weekData.days[pzt].assignments[kisi.name] = {leave: 'NONE', start: '09:00', end: '19:00', zone: kisi.primary[0], manual: true};
  d = haftaSorunlariniHesapla();
  K('tek vardiya girilince hafta artik "bos" degil', d.bosHafta === false);
  K('yalniz Pazartesi dolu: 6 gun hala bos sayilir', d.bosGunler.length === 6 && !d.bosGunler.includes(0));
  const acik = d.sorunlar.filter(s => s.tur === 'açık');
  K('ELLE doldurulan gunun eksikleri GORUNUR (' + acik.length + ' aralik)', acik.length > 0);
  K('eksikler yalniz doldurulan gunden gelir (bos gunler listelenmez)', acik.every(s => s.gun === 0));
  renderCanliDurum();
  const kismiHtml = ogeler.genReport.innerHTML;
  K('canli durum: Pazartesi satirinda eksikler tek satirda', /<b>Pazartesi<\/b> — /.test(kismiHtml) && (kismiHtml.match(/class="g-gap"/g) || []).length === 1 + d.sorunlar.filter(s => s.tur !== 'açık').length);
  K('"6 gun henuz bos" ve gun adlari yaziyor', /6 gün henüz boş/.test(kismiHtml) && /Henüz doldurulmamış günler: Salı, Çarşamba/.test(kismiHtml));
  K('"Boş kalan saatler" basligindaki sayi aralik sayisi', new RegExp('Boş kalan saatler \\(' + acik.length + '\\)').test(kismiHtml));
  renderTimeline();
  const ihlal = (ogeler.violList.innerHTML.match(/viol-item/g) || []).length;
  K('2. panel: dolu gunde eksikler gosterilir', ihlal > 0);
  K('2. panel: ardisik yarim saatler birlesti (satir sayisi makul: ' + ihlal + ')', ihlal <= rules.filter(r => r.enabled).length * 2);
  K('2. panel: satirlar "SS:DD–SS:DD" araligi gosterir', /\d\d:\d\d–\d\d:\d\d — /.test(ogeler.violList.innerHTML));
  selectedValidationDay = 1;
  renderTimeline();
  K('2. panel: hala bos olan Sali icin kirmizi liste yok', /henüz doldurulmamış/.test(ogeler.violList.innerHTML) && !/viol-item/.test(ogeler.violList.innerHTML));
  selectedValidationDay = 0;

  // --- 3) Cok gun elle dolunca eksikler gun gun gelir; dolu gun sayisi artar ---
  const sal = fmtDate(addDays(currentMonday, 1));
  weekData.days[sal].assignments[kisi.name] = {leave: 'NONE', start: '09:00', end: '19:00', zone: kisi.primary[0], manual: true};
  d = haftaSorunlariniHesapla();
  K('ikinci gun de dolunca onun eksikleri de gelir, 5 gun hala bos', d.bosGunler.length === 5 && d.sorunlar.some(s => s.tur === 'açık' && s.gun === 1));

  // --- 4) Otomatik olusturulmus hafta ESKI gibi calisir ---
  currentMonday = new Date(2026, 7, 17);
  await loadWeek(); ensureWeekPeople();
  generateWeek();
  d = haftaSorunlariniHesapla();
  K('otomatik olusturulan haftada bos gun yok, bosHafta degil', d.bosGunler.length === 0 && d.bosHafta === false);
  renderCanliDurum();
  K('otomatik haftada "gun henuz bos" yazisi cikmaz', !/gün henüz boş/.test(ogeler.genReport.innerHTML) && !/Henüz doldurulmamış günler/.test(ogeler.genReport.innerHTML));

  // --- 5) Bir gunde herkes izinli = o gun "dolu" degil ---
  const dd = fmtDate(addDays(currentMonday, 2));
  ROSTER.forEach(p => { weekData.days[dd].assignments[p.name] = {leave: 'IZINLI', start: null, end: null, zone: null}; });
  K('herkesin izinli oldugu gun "bos" sayilir (vardiya yok)', gunDoluMu(dd) === false && haftaSorunlariniHesapla().bosGunler.includes(2));

  document.getElementById = eskiGet;
  console.log('');
  console.log('  Sonuc: ' + gecen + ' gecti, ' + kalan + ' kaldi');
})();
