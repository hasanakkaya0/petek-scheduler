/* ============================================================
   EKRAN CIZELGESI TESTI (26 Ekim 2026, 2. surum)
   KALAN: 1) saat buyuk/koyu  3) bugunun satiri isaretli  4) gorev degisimi kutusu (saat/ad ayri satir)
   GERI ALINAN (kullanici itirazi): 2) 📌 silik/gizli (elle degisen hucreler gorunmez oluyordu)
                                    5) "sade" aksam sorumlusu (birbirinden ayrismiyordu)
   EN ONEMLI KORUMA: 📌 sabit isareti KILITLI haftada da GORUNUR.
   Bkz. js/render.js (renderGrid, cellContent, renderPinBadge), css/styles.css (sonda "EKRAN CIZELGESI" blogu)
   ============================================================ */
(async () => {
  await new Promise(r => setTimeout(r, 80));
  let gecen = 0, kalan = 0;
  const K = (ad, sart) => { if(sart){ gecen++; console.log('  [GECTI] ' + ad); } else { kalan++; console.log('  [KALDI] ' + ad); } };

  const tablo = {innerHTML: '', querySelectorAll(){ return []; }}, rozet = {hidden: false, textContent: '', title: ''}, eskiGet = document.getElementById;
  document.getElementById = id => id === 'gridTable' ? tablo : (id === 'pinBadge' ? rozet : eskiGet(id));

  currentMonday = mondayOf(new Date());
  await loadWeek(); ensureWeekPeople();
  const bugunKey = fmtDate(new Date());
  const kisi = ROSTER.find(p => !isOnCall(p));
  const sabitHucre = () => ({leave: 'NONE', start: '09:00', end: '19:00', zone: kisi.primary[0] || 'KASA', manual: true, blocks: [{start: '16:00', end: '21:00', zone: 'DERS_KITAPLARI'}]});
  const hazirla = () => {
    weekData.days[bugunKey].assignments[kisi.name] = sabitHucre();
    weekData.days[bugunKey].sup = 'Yonetici Bir'; weekData.days[bugunKey].supManual = true;
  };
  hazirla();

  // --- 3) BUGUN ---
  renderGrid();
  let h = tablo.innerHTML;
  K('bu haftada bugunun satiri tek bir kez isaretli (class="bugun")', (h.match(/<tr class="bugun">/g) || []).length === 1);
  K('"bugun" etiketi var, yalniz bir kez', (h.match(/class="bugun-etiket"/g) || []).length === 1);
  currentMonday = addDays(currentMonday, 7); await loadWeek(); ensureWeekPeople(); renderGrid();
  K('gelecek haftada bugun isareti YOK', !/class="bugun"/.test(tablo.innerHTML));
  currentMonday = addDays(currentMonday, -14); await loadWeek(); ensureWeekPeople(); renderGrid();
  K('gecmis haftada bugun isareti YOK', !/class="bugun"/.test(tablo.innerHTML));
  currentMonday = mondayOf(new Date()); await loadWeek(); ensureWeekPeople(); hazirla();

  // --- 2) 📌 HER ZAMAN GORUNUR (en onemli koruma) ---
  K('kilitsiz haftada sabit hucrede 📌 var', /pinmark/.test(cellContent(weekData.days[bugunKey].assignments[kisi.name])));
  renderGrid();
  K('kilitsiz haftada izgarada 📌 var', /pinmark/.test(tablo.innerHTML));
  weekData.locked = true;
  K('KILITLI haftada da hucre icinde 📌 GORUNUR', /pinmark/.test(cellContent(weekData.days[bugunKey].assignments[kisi.name])));
  renderGrid();
  K('KILITLI haftada da izgarada 📌 GORUNUR', /pinmark/.test(tablo.innerHTML));
  renderPinBadge();
  K('KILITLI haftada "N sabit" rozeti de GORUNUR', rozet.hidden === false && /sabit/.test(rozet.textContent));
  K('KILITLI haftada canli durumdaki sabit sayaci de sayiyor', haftaSorunlariniHesapla().sabit > 0);
  delete weekData.locked;

  // --- 5) AKSAM SORUMLUSU: ESKI gorunum (cerceveli select + "elle atandi" satiri) ---
  renderGrid();
  h = tablo.innerHTML;
  K('sorumlu hucresi eski gibi: duz <select data-date=...> (cerceveli)', /<td class="supcell">\s*<select data-date=/.test(h) && !/sup-sade/.test(h));
  K('elle atanmis sorumlu icin "📌 elle atandı … serbest bırak" satiri VAR', /class="supmanual">📌 elle atandı <button class="sup-free"[^>]*>serbest bırak<\/button>/.test(h));

  // --- 4) GOREV DEGISIMI kutusu: saat ve bolum adi ayri satirlar ---
  K('gorev degisimi: saat ve bolum adi AYRI satir (bc-saat / bc-ad)', /<span class="blockchip"[^>]*><span class="bc-saat">16:00–21:00<\/span><span class="bc-ad">Ders Kitapları<\/span>/.test(h));

  // --- CSS ---
  const fs = require('fs'), path = require('path');
  const css = fs.readFileSync(path.join(process.env.APPDIR, 'css', 'styles.css'), 'utf8');
  const blok = css.slice(css.indexOf('EKRAN ÇİZELGESİ (26 Ekim 2026, 2. sürüm)'));
  K('css blogu mevcut', blok.length > 100 && blok.length < css.length);
  K('css: saat 13 punto KALIN ve koyu', /\.timelabel\{[^}]*font-size:13px[^}]*font-weight:700[^}]*color:var\(--ink\)/.test(blok));
  K('css: bugun satiri ve etiketi tanimli', /tr\.bugun > td\{background/.test(blok) && /\.bugun-etiket\{/.test(blok));
  K('css: gorev degisimi kutusu satirlari bolunmez (nowrap) ve ayri satir', /\.blockchip\{[^}]*white-space:nowrap/.test(blok) && /\.bc-saat, \.blockchip \.bc-ad\{display:block/.test(blok));
  K('css: 📌 isaretini silikletme/gizleme kurali YOK', !/pinmark/.test(blok));
  K('css: "sade" sorumlu (cerceve-siz select) kurali YOK, sutun 150 px kaldi', !/sup-sade|appearance:none/.test(blok) && !/td\.supcell\{min-width:104/.test(blok) && /th\.supcol, td\.supcell\{[^}]*min-width:150px/.test(css));

  // --- HUCRE DUZENI (26 Ekim, onayli): ayni iskelet, ortali, tam genisliklie serit ---
  const calisan = cellContent({leave: 'NONE', start: '09:00', end: '19:00', zone: 'KASA'});
  const izinli = cellContent({leave: 'IZINLI', start: null, end: null, zone: null});
  K('hucre: bolum seridi sabit yukseklikli yuvada (zslot) ve saat ALTINDA', /^<div class="zslot"><span class="chip"[^>]*>[^<]+<\/span><\/div><span class="timelabel">09:00–19:00/.test(calisan));
  K('hucre: izin kutusu da ayni yuvada (hizali)', /^<div class="zslot"><span class="chip leave">İzinli<\/span>/.test(izinli));
  const duzen = css.slice(css.indexOf('HÜCRE DÜZENİ (26 Ekim 2026)'));
  K('css: hucre ortalama kurali tablonun "sola yasla" kuralini EZECEK guclukte (#gridTable td.cell)', /#gridTable td\.cell\{text-align:center/.test(duzen));
  K('css: serit tam genislik (width:100%) ve ortali', /\.zslot \.chip\{[^}]*display:block[^}]*width:100%[^}]*text-align:center/.test(duzen));
  K('css: yuva en az 38 px (iki satirlik serit sigsin, saatler hizali kalsin)', /\.zslot\{[^}]*min-height:38px/.test(duzen));
  K('css: izin kutulari tam genislik DEGIL (kendi boyunda, ortada)', /\.chip\.leave[^{]*\{width:auto/.test(duzen));
  K('css: gorev degisimi kutusu tam genislik ve ortali', /\.blockchip\{width:100%[^}]*text-align:center/.test(duzen));

  document.getElementById = eskiGet;
  console.log('');
  console.log('  Sonuc: ' + gecen + ' gecti, ' + kalan + ' kaldi');
})();
