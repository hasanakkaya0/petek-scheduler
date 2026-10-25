/* ============================================================
   DUKKAN SAATLERI TESTI (tarihli duzen)
   Kasim 2026'dan itibaren hafta ici kapanis 20:00. Eski haftalar
   (ve Borc/Alacak hesabi) eskisi gibi kalmali; yeni duzen yalnizca
   baslangic tarihinden itibaren isler.
   Bkz. js/utils.js (SHOP_HOURS, dowDefaultHours), js/shop-hours.js
   ============================================================ */
(async () => {
  await new Promise(r => setTimeout(r, 80));
  let gecen = 0, kalan = 0;
  const K = (ad, sart) => { if(sart){ gecen++; console.log('  [GECTI] ' + ad); } else { kalan++; console.log('  [KALDI] ' + ad); } };
  const sa = d => { const o = dowDefaultHours(d); return o.open + '-' + o.close; };

  // --- 1) Hangi tarihte hangi duzen ---
  K('Ekim hafta ici hala 09:00-21:00 (12 Ekim Pzt)', sa(new Date(2026, 9, 12)) === '09:00-21:00');
  K('Kasim hafta ici 09:00-20:00 (2 Kasim Pzt)', sa(new Date(2026, 10, 2)) === '09:00-20:00');
  K('31 Ekim Cumartesi 20:30 (eski duzen)', sa(new Date(2026, 9, 31)) === '09:00-20:30');
  K('1 Kasim Pazar 11:00-20:00 (gecis gunu)', sa(new Date(2026, 10, 1)) === '11:00-20:00');
  K('Kasim Cumartesi 20:30 (degismedi)', sa(new Date(2026, 10, 7)) === '09:00-20:30');
  K('30 Ekim Cuma hala 21:00 (gecisten bir gun once)', sa(new Date(2026, 9, 30)) === '09:00-21:00');

  // --- 2) Gune ozel saat hala oncelikli ---
  currentMonday = new Date(2026, 10, 2);
  await loadWeek(); ensureWeekPeople();
  const k0 = fmtDate(currentMonday);
  weekData.days[k0].customHours = {open: '10:00', close: '19:00'};
  K('gune ozel saat duzenin ustunde', operatingHours(currentMonday).close === '19:00');
  delete weekData.days[k0].customHours;
  K('gune ozel saat silinince duzene doner', operatingHours(currentMonday).close === '20:00');

  // --- 3) Kasim haftasi uretimi: kimse kapanistan sonra kalmasin ---
  prevSundayOff = new Set();
  const rapor = generateWeek();
  let tasan = 0, vardiya = 0;
  for(let i = 0; i < 7; i++){
    const d = addDays(currentMonday, i), oh = operatingHours(d);
    ROSTER.forEach(p => {
      const a = weekData.days[fmtDate(d)].assignments[p.name];
      if(!isWorking(a)) return;
      vardiya++;
      if(toMin(a.end) > toMin(oh.close) || toMin(a.start) < toMin(oh.open)) tasan++;
    });
  }
  K('Kasim haftasinda ' + vardiya + ' vardiya uretildi', vardiya > 0);
  K('hicbir vardiya dukkan saatinin disina tasmiyor (tasan: ' + tasan + ')', tasan === 0);
  const hicIcOn = [0,1,2,3,4].every(i => ROSTER.every(p => {
    const a = weekData.days[fmtDate(addDays(currentMonday, i))].assignments[p.name];
    return !isWorking(a) || toMin(a.end) <= 20*60;
  }));
  K('hafta ici hic kimse 20:00 sonrasina kalmiyor', hicIcOn);
  console.log('    (bilgi: acik nokta ' + rapor.gaps.length + ')');

  // --- 4) Eski hafta eskisi gibi uretiliyor (21:00 kapanis var) ---
  currentMonday = new Date(2026, 9, 12);
  await loadWeek(); ensureWeekPeople();
  generateWeek();
  let yirmiBir = 0;
  for(let i = 0; i < 5; i++) ROSTER.forEach(p => {
    const a = weekData.days[fmtDate(addDays(currentMonday, i))].assignments[p.name];
    if(isWorking(a) && a.end === '21:00') yirmiBir++;
  });
  K('Ekim haftasinda kapanis hala 21:00 (' + yirmiBir + ' vardiya)', yirmiBir > 0);

  // --- 5) Gecmis hafta Borc/Alacak hesabi yeni duzenle degismiyor ---
  const tam = JSON.parse(JSON.stringify(SHOP_HOURS));
  const fark1 = autoDiffForStoredWeek(weekData, currentMonday);
  SHOP_HOURS = [tam[0]];
  const fark2 = autoDiffForStoredWeek(weekData, currentMonday);
  SHOP_HOURS = tam;
  K('gecmis haftanin borc/alacak farki yeni duzenden etkilenmiyor',
    JSON.stringify(fark1) === JSON.stringify(fark2));

  // --- 6) Aksam sorumlusunun kasa saati kapanisa kadar ---
  const sup = SUP_POOL.find(p => !ROSTER.some(r => r.name === p.name));   // satiri olmayan yonetici
  if(sup){
    const eskiGun = weekData.days[fmtDate(currentMonday)];
    eskiGun.sup = sup.name;
    const dEski = currentMonday;
    K('21:00 kapanista 20:30 sorumlu kasada sayiliyor',
      (coverageAt(dEski, fmtDate(dEski), 20*60+30).KASA || []).includes(sup.name));
    currentMonday = new Date(2026, 10, 2);
    await loadWeek(); ensureWeekPeople();
    const gun = weekData.days[fmtDate(currentMonday)];
    gun.sup = sup.name;
    K('20:00 kapanista 19:30 sorumlu kasada sayiliyor',
      (coverageAt(currentMonday, fmtDate(currentMonday), 19*60+30).KASA || []).includes(sup.name));
    K('20:00 kapanista kapanistan sonra (20:00) sayilmiyor',
      !(coverageAt(currentMonday, fmtDate(currentMonday), 20*60).KASA || []).includes(sup.name));
  } else {
    console.log('  [ATLANDI] satiri olmayan yonetici yok');
  }

  // --- 7) Dogrulama ---
  const iyi = JSON.parse(JSON.stringify(DEFAULT_SHOP_HOURS));
  K('varsayilan duzen gecerli', dukkanSaatleriniDogrula(iyi) !== null);
  const ters = JSON.parse(JSON.stringify(iyi)); ters[0].days[0] = {open: '20:00', close: '09:00'};
  K('kapanis aciliştan once -> reddedilir', dukkanSaatleriniDogrula(ters) === null);
  const kisa = JSON.parse(JSON.stringify(iyi)); kisa[0].days[2] = {open: '10:00', close: '10:30'};
  K('1 saatten kisa gun -> reddedilir', dukkanSaatleriniDogrula(kisa) === null);
  const ayni = JSON.parse(JSON.stringify(iyi)); ayni[1].from = '';
  K('ayni tarihli iki duzen -> reddedilir', dukkanSaatleriniDogrula(ayni) === null);
  K('bos liste -> reddedilir (varsayilan kalir)', dukkanSaatleriniDogrula([]) === null && dukkanSaatleriniDogrula(undefined) === null);
  const sirasiz = [iyi[1], iyi[0]];
  const duzgun = dukkanSaatleriniDogrula(sirasiz);
  K('sirasiz liste tarihe gore siralanir, ilk duzen "en bastan"', duzgun && duzgun[0].from === '' && duzgun[1].from === '2026-11-01');

  // --- 8) Kayit: ayar saveSettings ile saklaniyor ---
  SHOP_HOURS = JSON.parse(JSON.stringify(iyi));
  SHOP_HOURS[1].days[0].close = '19:30';
  await saveSettings();
  const kayit = JSON.parse((await store.get('settings')).value);
  K('shopHours ayarla birlikte kaydediliyor', Array.isArray(kayit.shopHours) && kayit.shopHours[1].days[0].close === '19:30');
  SHOP_HOURS = JSON.parse(JSON.stringify(iyi));

  // --- 9) Kaynak kodu kontrolu: eski sabit saatler kalmadi ---
  const fs = require('fs'), path = require('path');
  const APP = process.env.APPDIR;
  const idx = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
  const rnd = fs.readFileSync(path.join(APP, 'js', 'render.js'), 'utf8');
  K('index.html icinde sabit "close:\'21:00\'" kalmadi', !/return \{open:'09:00', close:'21:00'\}/.test(idx));
  K('render.js icinde ikinci bir dowDefaultHours tanimi yok', !/function dowDefaultHours/.test(rnd));
  K('8. panel (Dukkan saatleri) sayfada var', /id="shopHoursBox"/.test(idx) && /shop-hours\.js/.test(idx));

  // --- 10) 'Bir oncekiyle ayni' ipucu (ayni duzen iki kez eklenirse) ---
  const kutu = {innerHTML: ''}; const eskiGet = document.getElementById;
  document.getElementById = id => id === 'shopHoursBox' ? kutu : eskiGet(id);
  const kasim = JSON.parse(JSON.stringify(DEFAULT_SHOP_HOURS[1]));
  SHOP_HOURS = [JSON.parse(JSON.stringify(DEFAULT_SHOP_HOURS[0])), kasim, {from: '2026-11-02', days: JSON.parse(JSON.stringify(kasim.days))}];
  K('duzenlerAyniMi: birebir ayni iki duzen ayni sayilir', duzenlerAyniMi(SHOP_HOURS[1], SHOP_HOURS[2]) === true);
  K('duzenlerAyniMi: farkli duzenler farkli sayilir (ilk duzen vs Kasim)', duzenlerAyniMi(SHOP_HOURS[0], SHOP_HOURS[1]) === false);
  renderShopHours();
  K('ayni duzende uyari cikar (02.11 = 01.11)', (kutu.innerHTML.match(/class="sh-ayni"/g) || []).length === 1 && /Bir öncekiyle aynı/.test(kutu.innerHTML));
  SHOP_HOURS[2].days[5] = {open: '09:00', close: '20:00'};     // Cumartesi'yi degistirince artik gereksiz degil
  renderShopHours();
  K('bir gun bile farkliysa uyari CIKMAZ', (kutu.innerHTML.match(/class="sh-ayni"/g) || []).length === 0);
  SHOP_HOURS = JSON.parse(JSON.stringify(DEFAULT_SHOP_HOURS)); renderShopHours();
  K('varsayilan iki duzende (farkli) uyari yok', (kutu.innerHTML.match(/class="sh-ayni"/g) || []).length === 0);
  document.getElementById = eskiGet;

  console.log('');
  console.log('  Sonuc: ' + gecen + ' gecti, ' + kalan + ' kaldi');
})();
