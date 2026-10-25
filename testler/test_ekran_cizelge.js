/* ============================================================
   EKRAN CIZELGESI YENILEMESI TESTI (26 Ekim 2026)
   1) saat buyuk/koyu  2) sabit isareti silik, kilitli haftada hic yok
   3) bugunun satiri isaretli  4) gorev degisimi kutusu buyuk  5) aksam sorumlusu sade
   Bkz. js/render.js (renderGrid, cellContent, renderPinBadge), css/styles.css (sonda "EKRAN CIZELGESI" blogu)
   ============================================================ */
(async () => {
  await new Promise(r => setTimeout(r, 80));
  let gecen = 0, kalan = 0;
  const K = (ad, sart) => { if(sart){ gecen++; console.log('  [GECTI] ' + ad); } else { kalan++; console.log('  [KALDI] ' + ad); } };

  const tablo = {innerHTML: '', querySelectorAll(){ return []; }}, rozet = {hidden: false, textContent: '', title: ''}, eskiGet = document.getElementById;
  document.getElementById = id => id === 'gridTable' ? tablo : (id === 'pinBadge' ? rozet : eskiGet(id));

  // bu hafta (bugun icinde)
  currentMonday = mondayOf(new Date());
  await loadWeek(); ensureWeekPeople();
  const bugunKey = fmtDate(new Date());
  const kisi = ROSTER.find(p => !isOnCall(p));
  weekData.days[bugunKey].assignments[kisi.name] = {leave: 'NONE', start: '09:00', end: '19:00', zone: kisi.primary[0] || 'KASA', manual: true,
    blocks: [{start: '16:00', end: '19:00', zone: 'KASA'}]};
  weekData.days[bugunKey].sup = 'Yonetici Bir'; weekData.days[bugunKey].supManual = true;

  // --- 3) BUGUN ---
  renderGrid();
  let h = tablo.innerHTML;
  K('bu haftada bugunun satiri tek bir kez isaretli (class="bugun")', (h.match(/<tr class="bugun">/g) || []).length === 1);
  K('"bugun" etiketi var, yalniz bir kez', (h.match(/class="bugun-etiket"/g) || []).length === 1);
  K('isaretli satir BUGUNUN gunu', new RegExp('<tr class="bugun"><td class="daycol">[^<]*<span class="bugun-etiket">bugün</span>').test(h));
  currentMonday = addDays(currentMonday, 7); await loadWeek(); ensureWeekPeople(); renderGrid();
  K('gelecek haftada bugun isareti YOK', !/class="bugun"/.test(tablo.innerHTML));
  currentMonday = addDays(currentMonday, -14); await loadWeek(); ensureWeekPeople(); renderGrid();
  K('gecmis haftada bugun isareti YOK', !/class="bugun"/.test(tablo.innerHTML));
  currentMonday = mondayOf(new Date()); await loadWeek(); ensureWeekPeople();
  weekData.days[bugunKey].assignments[kisi.name] = {leave: 'NONE', start: '09:00', end: '19:00', zone: kisi.primary[0] || 'KASA', manual: true, blocks: [{start: '16:00', end: '19:00', zone: 'KASA'}]};
  weekData.days[bugunKey].sup = 'Yonetici Bir'; weekData.days[bugunKey].supManual = true;

  // --- 2) SABIT ISARETI ---
  K('kilitsiz haftada sabit hucrede 📌 var', /pinmark/.test(cellContent(weekData.days[bugunKey].assignments[kisi.name])));
  renderGrid();
  K('kilitsiz haftada ızgarada 📌 var', /pinmark/.test(tablo.innerHTML));
  weekData.locked = true;
  K('KILITLI haftada hucre icinde 📌 yok', !/pinmark/.test(cellContent(weekData.days[bugunKey].assignments[kisi.name])));
  renderGrid();
  K('KILITLI haftada izgarada hic 📌 yok', !/pinmark/.test(tablo.innerHTML));
  renderPinBadge();
  K('KILITLI haftada "N sabit" rozeti gizli', rozet.hidden === true);
  K('KILITLI haftada canli durumdaki sabit sayaci 0', haftaSorunlariniHesapla().sabit === 0);
  delete weekData.locked;
  renderPinBadge();
  K('kilit acilinca rozet geri gelir', rozet.hidden === false && /sabit/.test(rozet.textContent));
  K('kilit acilinca canli durum sabit sayaci > 0', haftaSorunlariniHesapla().sabit > 0);

  // --- 5) AKSAM SORUMLUSU: sade ---
  renderGrid();
  h = tablo.innerHTML;
  K('sorumlu hucresi sade select (class="sup-sade")', /<select class="sup-sade manual"/.test(h));
  K('eski "elle atandı … serbest bırak" yazi satiri KALDI mi? (kalmamali)', !/class="supmanual"/.test(h) && !/serbest bırak<\/button>/.test(h));
  K('elle atanmis sorumluda kucuk 📌 (serbest birak) dugmesi var', /<button class="sup-free"[^>]*>📌<\/button>/.test(h));
  weekData.locked = true; renderGrid();
  K('KILITLI haftada serbest birak dugmesi YOK', !/sup-free/.test(tablo.innerHTML));
  delete weekData.locked;

  // --- 1,4,2,3,5) CSS ---
  const fs = require('fs'), path = require('path');
  const css = fs.readFileSync(path.join(process.env.APPDIR, 'css', 'styles.css'), 'utf8');
  const blok = css.slice(css.indexOf('EKRAN ÇİZELGESİ YENİLEMESİ'));
  K('css: saat 13 punto KALIN ve koyu', /\.timelabel\{[^}]*font-size:13px[^}]*font-weight:700[^}]*color:var\(--ink\)/.test(blok));
  K('css: sabit isareti silik, hucre ustunde belirgin', /\.pinmark\{[^}]*opacity:\.28/.test(blok) && /td\.cell:hover \.pinmark\{opacity:1/.test(blok));
  K('css: bugun satiri ve etiketi tanimli', /tr\.bugun > td\{background/.test(blok) && /\.bugun-etiket\{/.test(blok));
  K('css: gorev degisimi kutusu 11.5 punto kalin', /\.blockchip\{[^}]*font-size:11\.5px[^}]*font-weight:700/.test(blok));
  K('css: aksam sorumlusu sutunu daraldi (150 -> 104) ve select cerceve-siz', /td\.supcell\{min-width:104px/.test(blok.replace('th.supcol, ', '')) || /min-width:104px/.test(blok));
  K('css: sorumlu select uzerine gelince cerceveli/acilir', /td\.supcell select:hover/.test(blok));
  K('eski stil (11 punto gri saat) hala dosyada ama blok SONRA gelip eziyor', css.indexOf('.timelabel{font-family: ui-monospace, monospace; font-size:11px') < css.indexOf('EKRAN ÇİZELGESİ YENİLEMESİ'));

  document.getElementById = eskiGet;
  console.log('');
  console.log('  Sonuc: ' + gecen + ' gecti, ' + kalan + ' kaldi');
})();
