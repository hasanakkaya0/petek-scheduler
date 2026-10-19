/* =====================================================================
   OTOMATIK HAFTALIK LISTE OLUSTURUCU
   "Haftayi otomatik olustur" butonunun arkasindaki tum mantik.

   Kurallari (saat kotasi, kim nereye bakabilir, asgari kapsama, izin
   gunleri, dukkan saatleri) kullanarak bos haftayi doldurur.
   Kapatamadigi bosluklari gizlemez — rapor eder, insan duzeltir.

   Icindekiler:
     computeOffDays   - kime hangi gun izin verilecek
     makeShift/shiftAt- vardiya saatlerini uretir
     generateWeek     - ana motor: haftayi bastan kurar
     renderGenReport  - sonucu ekranda raporlar

   NOT: Bu dosya index.html ana kodundan ONCE yuklenir.
        Yuklendiginde sadece sabitleri tanimlar ve butona tiklama
        baglantisi kurar; hesaplama ancak butona basilinca calisir.
===================================================================== */
/* ---------------------------------------------------------------------
   Faz 5 — Otomatik haftalık liste oluşturucu
   Kuralları (saat kotası, kim nereye bakabilir, asgari kapsama, izin,
   dükkân saatleri) kullanarak boş haftayı doldurur. Kapatamadığı
   boşlukları gizlemez — rapor eder, insan düzeltir.
--------------------------------------------------------------------- */
// isFullTime -> js/utils.js dosyasına taşındı
// Otomatik atama ASLA fazla mesai yazmaz — kimsenin vardiyası günlük saat
// kotasını aşmaz. (Fazla mesai gerçekte olabiliyor, ama onu sistem değil
// insan yazar; elle girilen saatler olduğu gibi korunur.)
const MAX1_OVERTIME_MIN = 0;
// İhtiyaç halinde çağrılan personel (varsa) en az bu kadarlık bir boşluk için
// çağrılır — çok kısa boşluklar için insan işe çağrılmaz.
const MIN_CALL_IN_MIN = 120;
// Haftadan haftaya adalet: izin günleri ve kapanış vardiyaları her hafta kaysın
function weekIndex(){
  const anchor = new Date(2026, 0, 5);   // bir Pazartesi
  return Math.round((currentMonday - anchor) / (7 * 86400000));
}

// Her çalışana haftada 1 izin günü (part-time'a 2). İki hedef:
//  - aynı bölümdekiler aynı gün izinli olmasın
//  - izinler haftaya dengeli yayılsın (bir gün 6 kişi birden izinli kalmasın)
// fixedWork: {ad: Set(günIndeksi)} — kullanıcının o güne ELLE "çalışsın" yazıp
// sabitlediği günler. Bu günlere izin YAZILAMAZ: yazılsa bile aşağıda sabit
// vardiya izni ezer ve kişi izinsiz kalırdı (7 gün çalışırdı).
function computeOffDays(annual, noOffReport, manualOff, fixedWork){
  annual = annual || {};
  manualOff = manualOff || {};
  fixedWork = fixedWork || {};
  const off = {};
  const groupOf = {};
  ROSTER.forEach(p => { groupOf[p.name] = p.primary[0]; });
  const perDayCount = [0,0,0,0,0,0,0];
  const groupDays = {};   // bölüm -> o bölümde kullanılmış izin günleri
  const offByDay = [[],[],[],[],[],[],[]];   // gün -> o gün izinli kişiler
  const onAnnual = (p, d) => annual[p.name] && annual[p.name].has(d);
  const hasManualOff = p => manualOff[p.name] && manualOff[p.name].size > 0;
  // O gün elle "çalışsın" denmiş mi? (izin günü olarak seçilemez)
  const onFixedWork = (p, d) => fixedWork[p.name] && fixedWork[p.name].has(d);

  // Elle girilmiş izinleri önceden yerleştir — böylece aynı bölümden başka
  // birine izin verilirken bu günler "dolu" sayılır ve denge doğru hesaplanır.
  ROSTER.forEach(p => {
    if(manualOff[p.name]) manualOff[p.name].forEach(d => {
      perDayCount[d]++; offByDay[d].push(p);
      const g = p.primary[0];
      (groupDays[g] || (groupDays[g] = new Set())).add(d);
    });
  });

  // O gün izin verilirse hangi bölümler tam zamanlı bakacak 2 kişinin altına
  // düşer? (12 saatlik günü tek kişi kapatamadığı için 2 kritik eşik)
  const weakZones = (day, extra) => {
    // Sadece KİŞİNİN KENDİ etkisini ölç: bu kişi o gün izin alırsa, baktığı
    // KRİTİK blok (kafe) 2 yetkinin altına düşüyor mu? Günün mutlak inceliğini
    // ölçmüyoruz — yoksa doğal olarak ince olan Pazar hep cezalanır ve izinler
    // Pazar'a hiç düşmezdi. Kafe-dışı kişiler (Kişi H, Kişi I...) için bu 0'dır,
    // yani onların izin günü tamamen dengeye/rastgeleye kalır.
    if(!extra) return 0;
    const oh = operatingHours(addDays(currentMonday, day));
    const need = (toMin(oh.close) - toMin(oh.open)) > 600 ? 2 : 1;   // uzun gün 2, kısa gün (Pazar) 1
    const offNames = new Set(offByDay[day].map(x => x.name || x));
    const avail = q => !isOnCall(q) && !offNames.has(q.name) && !onAnnual(q, day);
    let weak = 0;
    DEFAULT_RULES.forEach(rule => {
      if(!rule.enabled || !rule.critical || !capableFor(rule, extra)) return;
      const after = ROSTER.filter(q => avail(q) && capableFor(rule, q)).length - 1;  // extra çıkınca
      if(after < need) weak += 6;   // kritik blokta tampon koru (kısa günde 1 yeter)
    });
    return weak;
  };

  // SERT KISIT: bir gün izin verilince kritik bir bölümde (ör. kafe bloğu)
  // tam zamanlı hiç yetkin kişi kalmıyorsa o gün izin verilemez. Part-time
  // tek başına günü kapatamaz, o yüzden "en az 1 tam zamanlı" şartı aranır.
  const breaksCritical = (p, d) => {
    const offNames = new Set(offByDay[d].concat([p]).map(x => x.name || x));
    const oh = operatingHours(addDays(currentMonday, d));
    const spanD = toMin(oh.close) - toMin(oh.open);
    // Bir bölge, günün süresi o bölgeye bakan tam zamanlıların EN UZUN vardiyasını
    // (azami saatini) aşıyorsa tek kişiyle kapanamaz → 2 kişi gerekir. Kafe kişileri
    // 9 saatçi (9s günü tek kapatır ama 10-12s'yi kapatamaz); Kasa 10 saatçi.
    const needsTwo = rule => {
      const qs = ROSTER.filter(q => isFullTime(q) && capableFor(rule, q)).map(q => (q.hours || 10) * 60);
      const maxQ = qs.length ? Math.max(...qs) : 600;
      return spanD > maxQ;
    };
    return rules.some(rule => {
      if(!rule.enabled) return false;
      const capWorking = ROSTER.filter(q => !isOnCall(q)
        && !offNames.has(q.name) && !onAnnual(q, d) && capableFor(rule, q));
      if(rule.critical){
        // Kritik blok (kafe): part-time TEK BAŞINA kapatamaz → her gün en az 1
        // TAM ZAMANLI; ayrıca gün tek kişinin kapatabileceğinden uzunsa 2 yetkin.
        if(capWorking.filter(isFullTime).length < 1) return true;
        if(needsTwo(rule) && capWorking.length < 2) return true;
        return false;
      }
      if(rule.zones.includes('KASA')){
        // Kasa asla boş kalmasın + mola idaresi: uzun günde 2 kasiyer çalışsın.
        return capWorking.filter(isFullTime).length < (needsTwo(rule) ? 2 : 1);
      }
      // diğer zorunlu bölgeler: en az 1 yetkin (yedek dahil) kalsın
      return capWorking.length === 0;
    });
  };

  const pickDay = (p, exclude) => {
    const g = groupOf[p.name];
    const used = groupDays[g] || (groupDays[g] = new Set());
    const wk = weekIndex();
    let best = null, bestScore = Infinity;
    let fb = null, fbScore = Infinity;                     // hiçbir gün uygun değilse yedek
    for(let n=0; n<7; n++){
      // Taramaya her hafta farklı günden başla — eşit puanlı günlerde izinler
      // haftadan haftaya kaysın, hep aynı kişi Pazar çalışmasın.
      const d = (n + wk) % 7;
      if(onAnnual(p, d)) continue;                        // zaten yıllık izinde
      if(onFixedWork(p, d)) continue;                     // o güne elle "çalışsın" denmiş
      if(exclude != null && d === exclude) continue;
      if(exclude != null && ((d===5&&exclude===6)||(d===6&&exclude===5))) continue; // jeneratör hafta sonu çift izin vermez
      const critBreak = breaksCritical(p, d);             // bu gün kritik bölümü boşaltır mı
      // Dönüşümlü hafta sonu izni: bir hafta Cumartesi, sonraki hafta Pazar.
      // Çift hafta (weekIndex % 2 == 0) Cumartesi, tek hafta Pazar hedeflenir;
      // hedef gün uygun değilse (yıllık izin/kritik boşluk) öteki hafta sonu günü.
      let altBias = 0;
      if(p.prefOff === 'weekend-alt'){
        const target = (wk % 2 === 0) ? 5 : 6;
        const other = target === 5 ? 6 : 5;
        if(d === target) altBias = -1000;
        else if(d === other) altBias = -30;
      }
      const kasaCap = q => q.primary.includes('KASA') || (q.backup || []).includes('KASA');
      // Kasa'da hep 2 kişi kalsın: Kasa'ya bakabilen (Kişi D/Kişi F/Kişi G)
      // 3'lüsünden aynı gün 2'si izinli olmasın — kasa mola idaresi + asla boş
      // kalmasın diye (soft, gerekirse aşılabilir).
      let kasaBias = 0;
      if(kasaCap(p) && offByDay[d].filter(kasaCap).length >= 1) kasaBias = 60;
      // Kişiye özel tercih edilen izin günü (ör. Kişi A Cuma, Kişi B Pazar)
      const prefDayBias = (p.prefOffDay != null && d === p.prefOffDay) ? -50 : 0;
      // Geçen hafta Pazar izinliyse bu hafta izni Çarşamba SONRASINA (Per/Cum)
      // yönlendir — dinlenme aralığı daha optimal olsun (soft).
      let restBias = 0;
      if(prevSundayOff.has(p.name)){ if(d === 3 || d === 4) restBias = -25; else if(d < 3) restBias = 12; }
      const score = perDayCount[d]
        + (used.has(d) ? 100 : 0)          // aynı bölümden iki kişi aynı gün: ağır ceza
        + weakZones(d, p) * 8              // KİŞİNİN kritik bloğa etkisi (kafe-dışına 0)
        + kasaBias + prefDayBias + restBias
        + (p.prefOff === 'weekend' && (d === 5 || d === 6) ? -40 : 0)  // hafta sonu izin tercihi
        + altBias;
      if(critBreak){
        // Kritik/asgari bölümü boşaltır — normalde izin verilmez. Ama kişinin
        // HİÇ uygun günü yoksa (ör. tek tam zamanlı kafe kişisi, diğeri tüm hafta
        // yıllık izinde) kişi 7 gün çalışmasın diye en az zararlı gün yedek tutulur;
        // oluşan açık raporda uyarılır.
        if(score < fbScore){ fbScore = score; fb = d; }
        continue;
      }
      if(score < bestScore){ bestScore = score; best = d; }
    }
    if(best == null) best = fb;                           // uygun gün yoksa yedeğe düş
    if(best == null) return null;
    used.add(best); perDayCount[best]++; offByDay[best].push(p);
    return best;
  };

  // Güçlü tercihli kişileri ÖNCE ata (dönüşümlü hafta sonu / belirli gün / hafta
  // sonu tercihi) — böcece onlar günlerini kaparlar, diğerleri (Kasa dengesi vb.)
  // buna göre uyum sağlar ve çakışma azalır.
  const prefRank = p => (p.prefOff === 'weekend-alt' ? 0 : (p.prefOffDay != null ? 1 : (p.prefOff === 'weekend' ? 2 : 3)));
  const offOrder = ROSTER.slice().sort((a, b) => prefRank(a) - prefRank(b));
  offOrder.forEach(p => {
    if(isOnCall(p)) return;                          // ihtiyaç dahilinde — hiç atanmaz
    // Yıllık izindeyse ayrıca haftalık izin günü verilmez (zaten izinli)
    if(annual[p.name] && annual[p.name].size > 0){ off[p.name] = []; return; }
    // Elle izin girilmişse (ör. Kişi D'e Pazar) o kişinin haftalık izni odur —
    // jeneratör ÜSTÜNE bir izin daha vermez, yoksa kişi iki gün izinli kalır.
    if(hasManualOff(p)){ off[p.name] = []; return; }
    // Haftalık izin günü sayısı kişiye göre ayarlanabilir. Ayarlı değilse
    // varsayılan: tam zamanlı 1 gün, part-time 2 gün.
    const wantOff = (p.offDays != null) ? p.offDays : (isFullTime(p) ? 1 : 2);
    if(wantOff <= 0){ off[p.name] = []; return; }   // 0 => 6-7 gün çalışır (izin yok)
    const d1 = pickDay(p, null);
    if(d1 == null){
      off[p.name] = [];
      if(noOffReport) noOffReport.push(p.name);
      return;
    }
    const days = [d1];
    let last = d1;
    for(let k = 1; k < wantOff; k++){
      const dn = pickDay(p, last);
      if(dn == null) break;
      days.push(dn); last = dn;
    }
    off[p.name] = days;
  });
  return off;
}

// "Haftada N gün erken çıkabilir" tanımlı kişiler için hangi günler erken
// çıkacağını seçer (çalıştığı günlere yayarak).
// Bir kişiye, günün açılış/kapanışına göre kotası kadar vardiya üret
function makeShift(p, dObj, mode){
  const {open, close} = operatingHours(dObj);
  const oM = toMin(open), cM = toMin(close);
  const span = cM - oM;
  const dur = Math.min(p.hours ? p.hours*60 : span, span);
  return (mode === 'close')
    ? {start: hhmm(cM - dur), end: hhmm(cM)}
    : {start: hhmm(oM), end: hhmm(oM + dur)};
}

// ORTA VARDİYA — istenen saatte başlayan (ne açılışa ne kapanışa yaslı)
// vardiya. Elle yapılan listelerdeki 10:00-21:00, 12:00-21:00 gibi kalıplar.
function shiftAt(p, dObj, startMin){
  const {open, close} = operatingHours(dObj);
  const oM = toMin(open), cM = toMin(close);
  const dur = Math.min(p.hours ? p.hours*60 : (cM - oM), cM - oM);
  let s = Math.max(oM, Math.min(startMin, cM - dur));
  return {start: hhmm(s), end: hhmm(s + dur)};
}

function generateWeek(){
  // Elle girilmiş SABİT vardiyalar, yıllık izinler ve borç izinleri korunur —
  // otomatik oluşturma bunlara asla dokunmaz (kişinin o gün işi var vb.).
  const annual = {};
  const debt = {};         // BORC — elle girilmiş; jeneratör dokunmaz, saatleri
                            // borca yazılır (bkz. js/ledger.js autoDiffForStoredWeek)
  const manualOff = {};    // elle girilmiş RUTİN izin (İZİNLİ) — kişinin bu haftaki izni sayılır
  const fixed = {};        // "isim|gün" -> elle girilmiş atama
  const fixedWork = {};    // {ad: Set(gün)} — elle "çalışsın" denmiş günler (izin verilemez)
  for(let i=0;i<7;i++){
    const k = fmtDate(addDays(currentMonday, i));
    ROSTER.forEach(p => {
      const a = weekData.days[k] && weekData.days[k].assignments[p.name];
      if(!a) return;
      if(a.leave === 'YILLIK') (annual[p.name] || (annual[p.name] = new Set())).add(i);
      else if(a.leave === 'BORC') (debt[p.name] || (debt[p.name] = new Set())).add(i);
      else if(a.leave === 'IZINLI' && a.manual) (manualOff[p.name] || (manualOff[p.name] = new Set())).add(i);
      else if(a.manual && isWorking(a)){   // BOŞ "sabit" kayıt günü kilitlemesin (bkz. bosSabitleriTemizle)
        fixed[p.name + '|' + i] = JSON.parse(JSON.stringify(a));
        // Elle sabitlenmiş ÇALIŞMA günü: izin dağıtıcı bu güne izin yazmasın.
        // (Yazsaydı birkaç satır aşağıda sabit vardiya izni ezer ve kişi
        //  izinsiz kalırdı — 7 gün çalışırdı.)
        if(isWorking(a)) (fixedWork[p.name] || (fixedWork[p.name] = new Set())).add(i);
      }
    });
  }
  const isFixed = (name, i) => Object.prototype.hasOwnProperty.call(fixed, name + '|' + i);
  // computeOffDays'e "zaten izinli" olarak annual + borç birlikte gider —
  // ikisi de haftalık izin dağıtımında aynı şekilde "dolu gün" sayılır, tek
  // fark geri yazılırken hangi leave türünün yazılacağı (aşağıda ayrı ayrı).
  const annualOrDebt = {};
  [annual, debt].forEach(src => Object.keys(src).forEach(name => {
    const s = annualOrDebt[name] || (annualOrDebt[name] = new Set());
    src[name].forEach(d => s.add(d));
  }));
  const noOff = [];
  const off = computeOffDays(annualOrDebt, noOff, manualOff, fixedWork);
  // Rapor bölümlere ayrılıyor: açıklar / sistemin yaptığı düzenlemeler /
  // korunan ve bilgilendirici notlar / son çare çağrılar
  /* -------------------------------------------------------------------
     KAPANIŞ ÜST SINIRI
     İki ayar buraya akar:
       maxClose  — "haftada en fazla kaç gün geç çıkabilir" (doğrudan sınır)
       earlyDays — "haftada kaç gün erken çıkar" = O KADAR GÜN KAPANIŞA KALMASIN
                   (15 Ağustos: eskiden vardiyayı kısaltıyordu, yanlıştı —
                    kişi kotasının altında çalışıyordu. Artık saatler tam,
                    sadece o kadar gün kapanışçı yazılmıyor.)
     İkisi de varsa DAHA SIKI olan uygulanır.
  ------------------------------------------------------------------- */
  const kapanisSiniri = {};
  ROSTER.forEach(p => {
    let sinir = (p.maxClose != null) ? p.maxClose : null;
    if(p.earlyDays){
      // Bu hafta kaç gün çalışıyor? (7 − izinli günler)
      let izinliGun = 0;
      for(let i = 0; i < 7; i++){
        if((annual[p.name] && annual[p.name].has(i))
          || (debt[p.name] && debt[p.name].has(i))
          || (manualOff[p.name] && manualOff[p.name].has(i))
          || (off[p.name] || []).includes(i)) izinliGun++;
      }
      const calisilanGun = 7 - izinliGun;
      const erkenSinir = Math.max(0, calisilanGun - p.earlyDays);
      sinir = (sinir == null) ? erkenSinir : Math.min(sinir, erkenSinir);
    }
    if(sinir != null) kapanisSiniri[p.name] = sinir;
  });

  const report = {gaps: [], moves: [], info: [], lastResort: [], warnings: []};
  const annualNames = Object.keys(annual);
  let supTurn = 0, lastSup = null;   // akşam sorumlusu sırası (aynı kişi üst üste gelmesin)
  // Kapanış sayacı — haftalık kapanış üst sınırını (ör. Kişi B en fazla 2) takip
  // eder ve rapordaki dağılım satırını besler.
  const closeCount = {};
  const manualSups = [];             // elle atanmış ve korunan sorumlu günleri
  if(annualNames.length){
    report.info.push(`Yıllık izinler korundu: ${annualNames.map(n => `${n} (${annual[n].size} gün)`).join(', ')}.`);
  }
  const debtNames = Object.keys(debt);
  if(debtNames.length){
    report.info.push(`Borç izinleri korundu: ${debtNames.map(n => `${n} (${debt[n].size} gün)`).join(', ')}.`);
  }
  if(noOff.length){
    // Sebebi ayır: kişinin tüm günleri elle "çalışsın" diye sabitlenmişse bunu
    // sistem değil kullanıcı yapmıştır — mesaj da onu söylesin.
    const hepsiSabit = noOff.filter(n => fixedWork[n] && fixedWork[n].size >= 6);
    const kapsamaYuzunden = noOff.filter(n => !hepsiSabit.includes(n));
    if(hepsiSabit.length){
      report.warnings.push(`${hepsiSabit.join(', ')} bu hafta izin günü alamadı — neredeyse tüm günleri elle "çalışsın" diye sabitlenmiş (📌). İzin verilebilmesi için en az bir günü çizelgeden serbest bırakman gerekiyor.`);
    }
    if(kapsamaYuzunden.length){
      report.warnings.push(`${kapsamaYuzunden.join(', ')} bu hafta izin günü alamadı — izinli olsaydı kritik bir bölüm (kafe bloğu gibi) tamamen boş kalacaktı. Yıllık izindekiler döndüğünde ya da o bloğa bakabilecek biri daha yetkilendirildiğinde çözülür.`);
    }
  }
  const fixedKeys = Object.keys(fixed);
  if(fixedKeys.length){
    const list = fixedKeys.map(k => {
      const [n, d] = k.split('|');
      const a = fixed[k];
      return `${n} ${DAY_NAMES[Number(d)]} ${a.leave === 'NONE' ? a.start + '–' + a.end : a.leave}`;
    });
    report.info.push(`Elle girilen sabit vardiyalar korundu: ${list.join(', ')}.`);
  }

  // KAPANIŞ GRUPLARI — aynı gruptaki kişiler (ör. Kişi D + Kişi E) haftada TEK
  // bir hafta içi günü BİRLİKTE kapanış yapsın, başka gün kapanış yapmasın.
  // Ortak günü şimdi seçiyoruz: ikisinin de izinli/sabit olmadığı bir hafta içi.
  const closeGroups = {};
  ROSTER.forEach(p => { if(p.closeGroup){ (closeGroups[p.closeGroup] || (closeGroups[p.closeGroup] = [])).push(p); } });
  const groupCloseDay = {};
  {
    const wk = weekIndex();
    const isOffGen = (p, d) => (annual[p.name] && annual[p.name].has(d))
      || (manualOff[p.name] && manualOff[p.name].has(d))
      || (off[p.name] || []).includes(d);
    Object.entries(closeGroups).forEach(([g, members]) => {
      let chosen = null;
      for(let n = 0; n < 5; n++){
        const d = (n + wk) % 5;                 // yalnızca hafta içi (Pzt–Cum)
        if(members.every(m => !isOffGen(m, d) && !isFixed(m.name, d))){ chosen = d; break; }
      }
      groupCloseDay[g] = chosen;
      if(chosen == null){
        report.warnings.push(`${members.map(m => m.name).join(' + ')} aynı gün kapanış yapamadı — ikisinin de uygun olduğu ortak bir hafta içi günü bulunamadı.`);
      } else {
        report.info.push(`${members.map(m => m.name).join(' + ')} bu hafta ${DAY_NAMES[chosen]} günü birlikte kapanış yapıyor.`);
      }
    });
  }

  for(let i=0;i<7;i++){
    const dObj = addDays(currentMonday, i);
    const key = fmtDate(dObj);
    const {open, close} = operatingHours(dObj);
    const oM = toMin(open), cM = toMin(close);
    const day = weekData.days[key];

    // sıfırla
    ROSTER.forEach(p => day.assignments[p.name] = blankAssignment());
    // önce yıllık izinler ve borç izinleri (elle girilmiş, dokunulmaz), sonra
    // elle rutin izinler, sonra jeneratörün dağıttığı haftalık izinler
    ROSTER.forEach(p => {
      if(annual[p.name] && annual[p.name].has(i))
        day.assignments[p.name] = {leave:'YILLIK', start:null, end:null, zone:null};
      else if(debt[p.name] && debt[p.name].has(i))
        day.assignments[p.name] = {leave:'BORC', start:null, end:null, zone:null};
      else if(manualOff[p.name] && manualOff[p.name].has(i))
        day.assignments[p.name] = {leave:'IZINLI', start:null, end:null, zone:null, manual:true};
      else if(off[p.name] && off[p.name].includes(i))
        day.assignments[p.name] = {leave:'IZINLI', start:null, end:null, zone:null};
    });
    // elle girilmiş sabit vardiyaları geri koy ve "atanmış" say — hiçbir geçiş
    // bunları değiştirmesin
    ROSTER.forEach(p => {
      if(!isFixed(p.name, i)) return;
      day.assignments[p.name] = JSON.parse(JSON.stringify(fixed[p.name + '|' + i]));
    });
    const isOffToday = p => {
      if(isFixed(p.name, i)){
        const a = day.assignments[p.name];
        return !isWorking(a);                       // sabit ama izinliyse yok sayılır
      }
      return (annual[p.name] && annual[p.name].has(i))
        || (debt[p.name] && debt[p.name].has(i))
        || (manualOff[p.name] && manualOff[p.name].has(i))
        || (off[p.name] || []).includes(i);
    };
    const locked = p => isFixed(p.name, i);
    const assigned = new Set();
    ROSTER.forEach(p => { if(isFixed(p.name, i)) assigned.add(p.name); });

    // 1. GEÇİŞ — önce TAKIMLARI kur, sonra vardiyaları dağıt.
    // Bir bölümde günü kapatmaya yetecek kişi yoksa, fazlalığı olan başka
    // bölümden o işi yapabilen birini ödünç al (esnek kaydırma).
    const span = cM - oM;
    // Kuralları "bu işi kaç kişi yapabiliyor" sırasına göre işle — en az
    // kişinin bakabildiği bölüm (ör. kafe bloğu) önce yerini alsın.
    const poolSize = rule => ROSTER.filter(p => !isOnCall(p)
      && capableFor(rule, p)).length;
    const activeRules = rules.filter(r => r.enabled).slice().sort((a,b) => poolSize(a) - poolSize(b));
    const teams = new Map();
    const inTeam = new Set();
    activeRules.forEach(rule => {
      const team = ROSTER.filter(p => !isOffToday(p) && !isOnCall(p)
        && rule.zones.some(z => p.primary.includes(z)) && capableFor(rule, p));
      team.forEach(p => inTeam.add(p.name));
      teams.set(rule.id, team);
    });

    // Bir takım, günün tamamını kapatabiliyor mu? (part-time dahil gerçek simülasyon)
    const teamCovers = team => {
      const segs = [];
      const rest = team.filter(p => { if(!locked(p)) return true;
        const a = day.assignments[p.name]; if(isWorking(a)) segs.push([toMin(a.start), toMin(a.end)]); return false; });
      const full = rest.filter(isFullTime), part = rest.filter(p => !isFullTime(p));
      full.forEach((p, idx) => { const s = makeShift(p, dObj, idx % 2 === 0 ? 'open' : 'close'); segs.push([toMin(s.start), toMin(s.end)]); });
      part.forEach(p => { const s = makeShift(p, dObj, 'close'); segs.push([toMin(s.start), toMin(s.end)]); });
      for(let m = oM; m < cM; m += 30){
        if(!segs.some(([a,b]) => a <= m && m < b)) return false;
      }
      return true;
    };

    // ödünç alma. Azami sınırı olmayan kurallarda serbest; "aynı anda tam 1
    // kişi" kurallarında (Fotokopi) sadece o bölüme bakan kimse yoksa 1 kişi
    // alınır — yoksa kısa/anlamsız vardiyalar üretirdi.
    activeRules.forEach(rule => {
      const team = teams.get(rule.id);
      const maxBorrow = (rule.max === null) ? 5 : (team.length === 0 ? 1 : 0);
      let guard = 0;
      while(!teamCovers(team) && guard++ < maxBorrow){
        let lender = null, fromTeam = null;
        for(const other of activeRules){
          if(other.id === rule.id) continue;
          const ot = teams.get(other.id);
          // ödünç verilebilir: bu işi yapabilen VE gittiğinde kendi bölümü hâlâ kapanıyor.
          // Önce tam zamanlılara, sonra part-time'a bak (Kişi C akşam kapanışını tutabiliyor).
          const ok = x => !locked(x) && capableFor(rule, x) && teamCovers(ot.filter(y => y !== x));
          const cand = ot.find(x => isFullTime(x) && ok(x)) || ot.find(x => !isFullTime(x) && ok(x));
          if(cand){ lender = cand; fromTeam = ot; break; }
        }
        if(!lender){   // hiçbir takımda olmayan serbest kişi (ör. Sevkiyat'taki Kişi K)
          lender = ROSTER.find(p => !isOffToday(p) && !isOnCall(p) && !locked(p)
            && !inTeam.has(p.name) && capableFor(rule, p));
          if(lender) inTeam.add(lender.name);
        }
        if(!lender) break;
        if(fromTeam) fromTeam.splice(fromTeam.indexOf(lender), 1);
        team.push(lender);
        report.moves.push(`${DAY_NAMES[i]} — ${lender.name} ${rule.label} bölümüne kaydırıldı (yedek görev).`);
      }
    });

    // takımlara vardiya dağıt
    activeRules.forEach(rule => {
      const people = teams.get(rule.id).filter(p => !assigned.has(p.name));
      if(people.length === 0) return;
      const zoneOf = p => rule.zones.find(z => canCover(p, z)) || p.primary[0];

      if(rule.max === 1){
        // Tek kişilik bölüm (Fotokopi): gün, kişiler arasında zincirleme
        // bölünür — aşağıdaki döngü kapanıştan geriye doğru yürür, yani İLK
        // işlenen kişi TAM vardiyasını alır, sonrakiler kalanı paylaşır.
        //
        // DÜZELTME (15 Ağustos): eskiden bu sıra personel listesindeki sıraydı.
        // Sonuç: bölümün ASIL sahibi listede önde diye kırıntı vardiya alıyor,
        // yedek görevli tam gün duruyordu (ör. Kişi H 24.5 sa / Kişi L 59 sa
        // Fotokopi'de). Artık sıra "bu bölüm kimin asıl işi" ölçüsüne göre:
        //   2 = ana görevi doğrudan burası (primary[0])
        //   1 = ana görevleri arasında var
        //   0 = yalnızca yedek görev
        // En yüksek puanlı kişi TAM vardiyayı alır, yedekler boşluğu doldurur.
        const aitlikPuani = p => {
          const z = rule.zones.find(x => p.primary.includes(x));
          if(z && p.primary[0] === z) return 2;
          if(z) return 1;
          return 0;
        };
        const sirali = [...people].sort((a, b) => aitlikPuani(a) - aitlikPuani(b));
        let cursorEnd = cM;
        [...sirali].reverse().forEach(p => {
          if(cursorEnd <= oM) return;
          const q = p.hours ? p.hours*60 : (cursorEnd - oM);
          const dur = Math.min(q + MAX1_OVERTIME_MIN, cursorEnd - oM);
          const st = Math.max(oM, cursorEnd - dur);
          day.assignments[p.name] = {leave:'NONE', start:hhmm(st), end:hhmm(cursorEnd), zone:zoneOf(p)};
          assigned.add(p.name);
          cursorEnd = st;
        });
      } else {
        // Kapanışı katı sırayla değil, KAPSAMAYA UYGUN kişiyle yap.
        // Tek sert kısıt: haftalık kapanış üst sınırı olanlar (ör. Kişi B
        // en fazla 2 gün geç çıkar) sınırı dolduysa açılışa alınır.
        const capFull = p => kapanisSiniri[p.name] != null && (closeCount[p.name] || 0) >= kapanisSiniri[p.name];
        // Rolleri (açılış/kapanış) her gün SABİT sıraya göre vermek, kimseyi
        // "sürekli sabahçı" ya da "sürekli akşamcı" yapıyordu. Bunun yerine güne
        // göre değişen, deterministik ama katı A-B-A-B olmayan bir sıra kullan.
        // (weekIndex + gün) tohumlu bir karıştırma: aynı kişi peş peşe hep aynı
        // rolü almaz, ama saf rastgele de değil — yeniden üretilebilir.
        // DÜZELTME (15 Ağustos): tohum artık güne değil YALNIZCA HAFTAYA bağlı.
        // Eskiden her gün değiştiği için kişinin vardiyası her gün kayıyordu
        // (ölçüm: haftada 5 farklı saat). Artık sıra hafta boyunca sabit, haftadan
        // haftaya değişiyor — yani rol rotasyonu gün gün değil, hafta hafta oluyor.
        const roleSeed = weekIndex() + 1;
        const shuffleRank = p => {
          let h = (roleSeed * 2654435761) >>> 0;
          for(let c = 0; c < p.name.length; c++) h = (Math.imul(h ^ p.name.charCodeAt(c), 2654435761)) >>> 0;
          return h;
        };
        // DİNLENME: dün kapanışa kalan bugün açılışa gelmesin (21:00 → 09:00 = 12 saat).
        const dunKapanisYapti = p => {
          if(i === 0) return false;
          const dObjOnce = addDays(currentMonday, i - 1);
          const onceki = weekData.days[fmtDate(dObjOnce)].assignments[p.name];
          if(!isWorking(onceki)) return false;
          return toMin(onceki.end) >= toMin(operatingHours(dObjOnce).close);
        };
        // Rol sıralaması: (1) kapanış sınırı dolan açılışa; (2) DENGE — o ana
        // kadar ÇOK kapanış yapan açılışa, AZ yapan kapanışa (kapanışlar eşit
        // dağılsın, feedback: Kişi I 2 / Kişi M 4 olmasın); (3) SOFT desen — yarın
        // izinliyse bugün sabahçı, dün izinliyse bugün kapanışçı (sabahçı+izin+
        // kapanışçı 3'lüsü); (4) eşitlikte güne göre değişen karıştırma.
        const offTomorrow = p => (off[p.name] || []).includes(i + 1);
        const offYesterday = p => (off[p.name] || []).includes(i - 1);
        const roleRank = p => {
          // Kapanış dengesi: çok kapatan açılışa itilir. Ağırlık 100'den 25'e
          // düşürüldü — 100 iken kişi bir kapanış yapar yapmaz ertesi gün
          // açılışa fırlıyordu ve vardiyası her gün zıplıyordu. 25 ile denge
          // hâlâ çalışıyor ama hafta içi süreklilik korunuyor.
          let r = -(closeCount[p.name] || 0) * 25;
          if(offTomorrow(p)) r -= 40;                 // yarın izin → bugün açılışa
          if(offYesterday(p)) r += 40;                // dün izin → bugün kapanışa
          // DİNLENME (en ağır kısıt): dün kapanışa kaldıysa bugün açılışa alma.
          // Böyle bir kişiye 21:00 → 09:00 arası sadece 12 saat kalıyor.
          if(dunKapanisYapti(p)) r += 300;
          return r;
        };
        const full = people.filter(isFullTime).sort((a,b) => {
          if(capFull(a) !== capFull(b)) return capFull(a) ? -1 : 1;    // sınırı dolan açılışa
          const ra = roleRank(a), rb = roleRank(b);
          if(ra !== rb) return ra - rb;                                // denge + desen
          return shuffleRank(a) - shuffleRank(b);                      // eşitlikte güne göre değişen sıra
        });
        const part = people.filter(p => !isFullTime(p));
        // Kapanış grubu rolü: üye grup gününde kapanış, diğer günlerde açılış
        // yapMALI. Bu rolleri ÖNCE yerleştir, sonra boştakiler eksik rolü
        // (açılış/kapanış) tamamlasın — böylece bir üye kapanışa gidince
        // bölümün sabahı boş kalmaz.
        // Kapanış grubu rolü. DÜZELTME (15 Ağustos): kişinin kapanış sınırı
        // dolmuşsa grup günü bile olsa KAPANIŞA ZORLANMAZ. Eskiden grup zorlaması
        // sınırı eziyordu: "6 gün kapanışa kalmasın" (= 0 kapanış) yazılmış birine
        // grup günü yüzünden yine kapanış çıkıyordu. Açıkça verilen sınır önceliklidir.
        const forcedRole = p => {
          if(!(p.closeGroup && groupCloseDay[p.closeGroup] != null)) return null;
          if(i !== groupCloseDay[p.closeGroup]) return 'open';
          return capFull(p) ? 'open' : 'close';
        };
        const modes = new Array(full.length).fill(null);
        let hasOpen = false, hasClose = false;
        full.forEach((p, idx) => {
          const r = forcedRole(p);
          if(r){ modes[idx] = r; if(r === 'open') hasOpen = true; else hasClose = true; }
        });
        // Açılışı sıradaki ilk boş kişiye ver.
        if(!hasOpen){
          const idx = modes.findIndex(m => !m);
          if(idx >= 0){ modes[idx] = 'open'; hasOpen = true; }
        }
        // KAPANIŞI atarken kapanış sınırı DOLMUŞ kişiyi atla (15 Ağustos düzeltmesi).
        // Eskiden burada sıradaki ilk kişiye veriliyordu; kapanış grubundaki biri
        // zorunlu "açılış" aldığında, sınırı dolmuş kişi mecburen kapanışa
        // düşüyordu ve "haftada N gün kapanışa kalmasın" ayarı hiç işlemiyordu.
        if(!hasClose){
          let idx = modes.findIndex((m, ix) => !m && !capFull(full[ix]));
          if(idx < 0) idx = modes.findIndex(m => !m);   // başka kimse yoksa mecburen
          if(idx >= 0){ modes[idx] = 'close'; hasClose = true; }
        }
        // Kalanlar gün ortası
        modes.forEach((m, idx) => { if(!m) modes[idx] = 'mid'; });
        full.forEach((p, idx) => {
          let s;
          if(modes[idx] === 'open') s = makeShift(p, dObj, 'open');
          else if(modes[idx] === 'close') s = makeShift(p, dObj, 'close');
          else {
            // orta vardiya — açılış/kapanış zaten kapalı, gün ortası güçlensin
            const dur = p.hours ? p.hours*60 : (cM - oM);
            s = shiftAt(p, dObj, oM + Math.round(((cM - oM) - dur) / 2));
          }
          day.assignments[p.name] = {leave:'NONE', start:s.start, end:s.end, zone:zoneOf(p)};
          assigned.add(p.name);
        });
        part.forEach(p => {   // part-time'ı akşam kapanışa koy
          const s = makeShift(p, dObj, 'close');
          day.assignments[p.name] = {leave:'NONE', start:s.start, end:s.end, zone:zoneOf(p)};
          assigned.add(p.name);
        });
      }
    });

    // kuralı olmayan görevler (ör. Sevkiyat) — kalanları kendi ana görevine koy.
    // Kapanış grubu üyesiyse grup gününde kapanış, diğer günlerde açılış olur.
    ROSTER.forEach(p => {
      if(isOffToday(p) || assigned.has(p.name) || isOnCall(p) || locked(p)) return;
      const mode = (p.closeGroup && groupCloseDay[p.closeGroup] != null
        && i === groupCloseDay[p.closeGroup]) ? 'close' : 'open';
      const s = makeShift(p, dObj, mode);
      day.assignments[p.name] = {leave:'NONE', start:s.start, end:s.end, zone:p.primary[0]};
    });

    /* -------------------------------------------------------------------
       TEK KİŞİLİK BÖLÜM DEVRİ  (Fotokopi gibi "aynı anda tam 1 kişi" bölümler)
       Dükkân 12 saat açık ama bir kişinin kotası 9-10 saat → bölümün bir ucu
       (sabah ya da akşam) mutlaka açık kalır.

       Bu blok iki işi otomatik yapar:
         1) Bölümün ASIL sahibinin o gün açılış mı kapanış mı yapacağını seçer.
            Dönüşümlü — böylece aynı kişi hep sabahçı ya da hep akşamcı olmaz
            (denge). Dün kapanış yaptıysa ya da kapanış sınırı dolduysa açılışa.
         2) Sahibin kapatmadığı ucu, o bölüme bakabilen ve o saatte zaten
            dükkânda olan bir YARDIMCIYA "saat bazlı görev değişimi" (blocks)
            olarak verir. Yardımcının kendi vardiyası ve bölümü bozulmaz —
            sadece o saat aralığında bu bölüme geçer.
       Yardımcı, kendi bölümünü boş bırakacaksa devir yapılmaz.
       (15 Ağustos: eskiden bu blok 'FOTOKOPI' yazısına sabitlenmişti ve yalnızca
        AKŞAMI devrediyordu; sabah açığı için hiçbir şey yapmıyordu.)
    ------------------------------------------------------------------- */
    activeRules.filter(r => r.max === 1).forEach(rule => {
      const bolge = rule.zones[0];
      const sahip = ROSTER.find(p => p.primary.includes(bolge) && !locked(p)
        && !isOffToday(p) && isWorking(day.assignments[p.name]));
      if(!sahip) return;
      const sa = day.assignments[sahip.name];

      // --- 1) Sahibin ucu: açılış mı kapanış mı? ---
      const sinir = kapanisSiniri[sahip.name];
      const sinirDoldu = sinir != null && (closeCount[sahip.name] || 0) >= sinir;
      let dunKapanis = false;
      if(i > 0){
        const oncekiG = addDays(currentMonday, i - 1);
        const onceki = weekData.days[fmtDate(oncekiG)].assignments[sahip.name];
        dunKapanis = isWorking(onceki) && toMin(onceki.end) >= toMin(operatingHours(oncekiG).close);
      }
      // Dönüşümlü taban: hafta ve güne göre değişir (deterministik)
      let acilisYap = ((weekIndex() + i) % 2 === 0);
      // DİNLENME: dün 21:00'de çıktıysa bugün ERKEN BAŞLAMASIN — kapanış ucunda
      // kalsın ki 21:00 → 09:00 (12 saat) gibi bir aralık oluşmasın.
      if(dunKapanis) acilisYap = false;
      // Kapanış sınırı dolduysa mecburen açılışa (sınır dinlenmenin önünde gelir,
      // çünkü sınırı kullanıcı bilerek yazmıştır).
      if(sinirDoldu) acilisYap = true;

      const hedef = makeShift(sahip, dObj, acilisYap ? 'open' : 'close');
      const eskiSaat = sa.start + '–' + sa.end;
      sa.start = hedef.start; sa.end = hedef.end;

      // --- 2) Sahibin kapatmadığı ucu yardımcıya devret ---
      const acikBas = acilisYap ? toMin(sa.end) : oM;
      const acikBit = acilisYap ? cM : toMin(sa.start);
      if(acikBit - acikBas < 30) return;               // devredilecek boşluk yok

      // O bölgenin başka biri tarafından zaten karşılandığı saatler hariç
      const yardimci = ROSTER.find(p => {
        if(p.name === sahip.name || locked(p) || isOffToday(p) || isOnCall(p)) return false;
        if(!capableFor(rule, p)) return false;
        const pa = day.assignments[p.name];
        if(!isWorking(pa)) return false;
        // Boşluk penceresiyle kesişiyor mu?
        const kes = Math.min(toMin(pa.end), acikBit) - Math.max(toMin(pa.start), acikBas);
        if(kes < 30) return false;
        // Kendi bölümünü boş bırakmasın: o saatlerde aynı bölgede başka biri olmalı,
        // ya da o bölgenin asgari kuralı olmasın.
        const kendiBolge = pa.zone;
        const kendiKural = activeRules.find(r2 => r2.zones.includes(kendiBolge));
        if(!kendiKural) return true;                   // kuralı yok — serbestçe geçebilir
        const bas2 = Math.max(toMin(pa.start), acikBas);
        const bit2 = Math.min(toMin(pa.end), acikBit);
        for(let m = bas2; m < bit2; m += 30){
          const cov = coverageAt(dObj, key, m);
          const c = kendiKural.zones.reduce((s2, z) => s2 + (cov[z] ? cov[z].length : 0), 0);
          if(c - 1 < kendiKural.min) return false;      // o çıkarsa kendi bölümü açık kalır
        }
        return true;
      });
      if(!yardimci) return;

      const ya = day.assignments[yardimci.name];
      const bBas = Math.max(toMin(ya.start), acikBas);
      const bBit = Math.min(toMin(ya.end), acikBit);
      ya.blocks = (ya.blocks || []).filter(b => b.zone !== bolge);
      ya.blocks.push({start: hhmm(bBas), end: hhmm(bBit), zone: bolge});
      report.moves.push(`${DAY_NAMES[i]} — ${rule.label}: ${sahip.name} `
        + `${acilisYap ? 'açılışta' : 'kapanışta'} (${sa.start}–${sa.end}), `
        + `${hhmm(bBas)}–${hhmm(bBit)} arasını ${yardimci.name} devraldı.`
        + (eskiSaat !== sa.start + '–' + sa.end ? ` [önce ${eskiSaat}]` : ''));
    });

    // 2. GEÇİŞ — kalan boşlukları YEDEK yetenekli personelle kapat
    // (kendi bölümünde fazlalık olan biri boşluğa kaydırılır)
    // Bir kuralın açık pencereleri — ayrı ayrı (birleştirilmeden), böylece
    // sabah açığı ile mola açığı karışmaz ve doldurma tam yerine yapılır
    const gapRuns = rule => {
      const runs = [];
      let runStart = null;
      for(let m = oM; m <= cM; m += 30){
        let bad = false;
        // Kuralın saat aralığı dışındaki boşluklar AÇIK sayılmaz (ör. Fotokopi
        // 09:00–11:00 boş kalabilir). Onlar ayrıca bilgi olarak raporlanır.
        if(m < cM && kuralGecerliMi(rule, m, oM, cM)){
          const cov = coverageAt(dObj, key, m);
          const c = rule.zones.reduce((s,z) => s + (cov[z] ? cov[z].length : 0), 0);
          bad = c < rule.min;
        }
        if(bad && runStart === null) runStart = m;
        if(!bad && runStart !== null){ runs.push({start: runStart, end: m}); runStart = null; }
      }
      return runs;
    };

    // Kuralın saat aralığı DIŞINDA kalan boşluklar — hata değil, bilgi notu.
    const toleransliBosluklar = rule => {
      const runs = [];
      let runStart = null;
      for(let m = oM; m <= cM; m += 30){
        let bos = false;
        if(m < cM && !kuralGecerliMi(rule, m, oM, cM)){
          const cov = coverageAt(dObj, key, m);
          const c = rule.zones.reduce((s,z) => s + (cov[z] ? cov[z].length : 0), 0);
          bos = c < rule.min;
        }
        if(bos && runStart === null) runStart = m;
        if(!bos && runStart !== null){ runs.push({start: runStart, end: m}); runStart = null; }
      }
      return runs;
    };
    const gapOf = rule => { const r = gapRuns(rule); return r.length ? r[0] : null; };

    // AKŞAM SORUMLUSU — vardiyalar kurulduktan SONRA seçilir, çünkü kadrodaki
    // biri ancak kapanışa kadar kalıyorsa sorumlu olabilir (ör. Kişi K
    // 19:00'da çıkıyorsa o gün sorumlu yazılamaz). Yöneticilerin çizelgede satırı yok, onlar her zaman uygun.
    // Pazar bilerek boş — o gün herkes aynı vardiyada (kurallar madde 4).
    if(day.supManual){
      if(day.sup) lastSup = day.sup;
      manualSups.push(`${DAY_NAMES[i]}: ${day.sup || '— (boş bırakılmış)'}`);
    } else if(dObj.getDay() === 0){
      day.sup = null;
    } else {
      const eligible = SUP_POOL.filter(p => {
        const r = ROSTER.find(x => x.name === p.name);
        if(!r) return true;                          // kadroda satırı yok — yönetici
        if(isOffToday(r)) return false;
        const a = day.assignments[p.name];
        return isWorking(a) && toMin(a.end) >= cM;   // kapanışa kadar kalıyor mu?
      });
      // Kapanışa kalmıyor ama bölümünde asgari kapsama kuralı yoksa (ör. Kişi K
      // Bey / Sevkiyat) vardiyasını kapanışa çekmek güvenli — o da aday olsun.
      const retimeable = SUP_POOL.filter(p => {
        const r = ROSTER.find(x => x.name === p.name);
        if(!r || isOffToday(r) || eligible.includes(p) || locked(r)) return false;
        const a = day.assignments[p.name];
        if(!isWorking(a) || toMin(a.end) >= cM) return false;
        return !activeRules.some(ru => ru.zones.includes(a.zone));
      });
      const cands = eligible.concat(retimeable);
      let pick = cands.length ? cands[supTurn++ % cands.length].name : null;
      if(pick && pick === lastSup && cands.length > 1) pick = cands[supTurn++ % cands.length].name;
      day.sup = pick;
      if(pick) lastSup = pick;
      const picked = cands.find(p => p.name === pick);
      if(picked && retimeable.includes(picked)){
        const a = day.assignments[pick];
        const s = makeShift(ROSTER.find(x => x.name === pick), dObj, 'close');
        report.moves.push(`${DAY_NAMES[i]} — ${pick} akşam sorumlusu olduğu için vardiyası kapanışa çekildi (${a.start}–${a.end} → ${s.start}–${s.end}).`);
        a.start = s.start; a.end = s.end;
      }
      const skipped = SUP_POOL.filter(p => ROSTER.some(x => x.name === p.name) && !cands.includes(p));
      skipped.forEach(p => {
        const a = day.assignments[p.name];
        if(isWorking(a)) report.info.push(`${DAY_NAMES[i]} — ${p.name} akşam sorumlusu olamaz: vardiyası ${a.end}'de bitiyor ve bölümü boşalmadan kapanışa çekilemiyor.`);
      });
    }

    // KİŞİYE TANIMLI GÜN İÇİ KAYDIRMALAR — profilinde "her gün 18:00–21:00
    // Fotokopi" gibi bir tanım varsa, vardiyasıyla kesişen kısmı uygulanır.
    ROSTER.forEach(p => {
      if(!p.dayBlocks || !p.dayBlocks.length || locked(p)) return;
      const a = day.assignments[p.name];
      if(!isWorking(a)) return;
      p.dayBlocks.forEach(b => {
        const s = Math.max(toMin(b.start), toMin(a.start));
        const e = Math.min(toMin(b.end), toMin(a.end));
        if(e - s < 30 || !ZONE_MAP[b.zone]) return;
        const blocks = a.blocks || (a.blocks = []);
        if(blocks.some(x => x.start === hhmm(s) && x.zone === b.zone)) return;
        blocks.push({start: hhmm(s), end: hhmm(e), zone: b.zone});
      });
    });

    // toplam ihlal dakikası (hem eksik hem azami aşımı) — kaydırmanın işe
    // yarayıp yaramadığını ölçmek için
    const totalGapScore = () => {
      let n = 0;
      rules.filter(r => r.enabled).forEach(rule => {
        for(let m = oM; m < cM; m += 30){
          const cov = coverageAt(dObj, key, m);
          const c = rule.zones.reduce((s,z) => s + (cov[z] ? cov[z].length : 0), 0);
          if(c < rule.min) n++;
          if(rule.max !== null && c > rule.max) n++;
        }
      });
      return n;
    };

    rules.filter(r => r.enabled && r.max === null).forEach(rule => {
      if(!gapOf(rule)) return;
      const atCap = p => kapanisSiniri[p.name] != null && (closeCount[p.name] || 0) >= kapanisSiniri[p.name];
      const candidates = ROSTER.filter(p => !isOnCall(p) && !isOffToday(p) && !locked(p)
        && isWorking(day.assignments[p.name]) && capableFor(rule, p))
        .sort((a,b) => (atCap(a) ? 1 : 0) - (atCap(b) ? 1 : 0));   // kapanış sınırı dolanlar sona
      for(const cand of candidates){
        const before = totalGapScore();
        const prev = Object.assign({}, day.assignments[cand.name]);
        const zone = rule.zones.find(z => canCover(cand, z)) || rule.zones[0];
        let applied = false;
        const gapNow = gapOf(rule);
        const opts = [makeShift(cand, dObj, 'close'), makeShift(cand, dObj, 'open')];
        if(gapNow){                       // boşluğun başladığı saate göre ORTA VARDİYA da dene
          opts.push(shiftAt(cand, dObj, gapNow.start));
          opts.push(shiftAt(cand, dObj, gapNow.end - (cand.hours ? cand.hours*60 : 0)));
        }
        for(const s of opts){
          day.assignments[cand.name] = {leave:'NONE', start:s.start, end:s.end, zone};
          if(totalGapScore() < before){ applied = true; break; }
          day.assignments[cand.name] = Object.assign({}, prev);
        }
        if(applied){
          const fromZone = ZONE_MAP[prev.zone];
          const a = day.assignments[cand.name];
          report.moves.push(`${DAY_NAMES[i]} — ${rule.label} boşluğu ${cand.name} ile kapatıldı (${fromZone ? fromZone.label + '→' : ''}${ZONE_MAP[zone].label}, ${a.start}–${a.end}).`);
          if(!gapOf(rule)) break;
        }
      }
    });

    // NOT: "Erken çıkış" ARTIK VARDİYA KISALTMIYOR (15 Ağustos düzeltmesi).
    // Eskiden bu günlerde kişinin vardiyası 2 saat kısaltılıyordu — yani kişi
    // günlük kotasının ALTINDA çalışıyordu. Kullanıcının kastı bu değilmiş:
    // "erken çıkış" = O GÜN KAPANIŞA KALMASIN demek. Herkes tam saatini çalışır.
    // Bu artık kapanış üst sınırına çevrilerek uygulanıyor (bkz. kapanisSiniri).

    // KRİTİK KURAL GEÇİŞİ — kafe/roman/oyuncak/sanatsal bloğu asla boş kalmasın.
    // Bu bloğa yalnızca bu bölgeleri yetkin kişiler bakabilir, o yüzden burada
    // boşluk kalmasına izin verilmez: gerekirse başka bölümden biri buraya alınır.
    activeRules.filter(r => r.critical).forEach(rule => {
      let guard = 0;
      while(gapOf(rule) && guard++ < 4){
        const gap = gapOf(rule);
        const covers = a => isWorking(a) && toMin(a.start) <= gap.start && toMin(a.end) >= gap.end;
        const capped = p => kapanisSiniri[p.name] != null && (closeCount[p.name] || 0) >= kapanisSiniri[p.name];
        const capable = ROSTER.filter(p => !isOnCall(p) && !isOffToday(p) && !locked(p)
          && capableFor(rule, p) && isWorking(day.assignments[p.name])
          && !rule.zones.includes(day.assignments[p.name].zone))
          .sort((a,b) => (capped(a) ? 1 : 0) - (capped(b) ? 1 : 0));
        // 1) mevcut vardiyası boşluğu zaten kapsayan biri -> sadece görev değişikliği
        let cand = capable.find(p => covers(day.assignments[p.name]));
        let mode = null;
        if(!cand){
          // 2) saatini kaydırarak kapatabilecek biri
          cand = capable.find(p => {
            const tries = [makeShift(p, dObj, 'close'), makeShift(p, dObj, 'open'), shiftAt(p, dObj, gap.start)];
            for(const s of tries){
              if(toMin(s.start) <= gap.start && toMin(s.end) >= gap.end){ mode = s; return true; }
            }
            return false;
          });
        }
        if(!cand) break;
        const prev = Object.assign({}, day.assignments[cand.name]);
        const zone = rule.zones.find(z => canCover(cand, z)) || rule.zones[0];
        if(mode){
          day.assignments[cand.name] = {leave:'NONE', start:mode.start, end:mode.end, zone};
        } else {
          day.assignments[cand.name] = Object.assign({}, prev, {zone});
        }
        const from = ZONE_MAP[prev.zone];
        const a = day.assignments[cand.name];
        report.moves.push(`${DAY_NAMES[i]} — ${rule.label} boş kalmasın diye ${cand.name} buraya alındı (${from ? from.label + '→' : ''}${ZONE_MAP[zone].label}, ${a.start}–${a.end}).`);
      }
    });

    // Erken çıkış kritik bir bloğu boş bırakıyorsa geri al — kafe bloğu her
    // şeyin önünde gelir (ör. Kişi C izinliyken Kişi A erken çıkamaz).
    // SAAT BAZLI GÖREV DEĞİŞİMİ ile boşluk doldurma — kişinin vardiyasını
    // bozmadan, sadece boşluk saatlerinde başka bölüme geçmesini sağlar
    // (ör. Kişi G 09–19 kırtasiyede ama 19:00'dan sonra kasaya bakar).
    const blockFill = rule => {
      const gap = gapOf(rule);
      if(!gap) return false;
      for(const p of ROSTER){
        if(isOnCall(p) || isOffToday(p) || locked(p)) continue;
        const a = day.assignments[p.name];
        if(!isWorking(a) || !capableFor(rule, p)) continue;
        if(rule.zones.includes(a.zone)) continue;                           // zaten o bölümde
        // vardiyasının boşlukla kesişen kısmı (tamamını kapsaması gerekmiyor)
        const ovS = Math.max(gap.start, toMin(a.start));
        const ovE = Math.min(gap.end, toMin(a.end));
        if(ovE - ovS < 30) continue;
        const before = totalGapScore();
        const zone = rule.zones.find(z => canCover(p, z));
        const blocks = a.blocks || (a.blocks = []);
        blocks.push({start: hhmm(ovS), end: hhmm(ovE), zone});
        if(totalGapScore() < before){
          const own = ZONE_MAP[a.zone];
          report.moves.push(`${DAY_NAMES[i]} — ${p.name} ${hhmm(ovS)}–${hhmm(ovE)} arası ${ZONE_MAP[zone].label} bölümüne geçiyor${own ? ` (asıl görevi ${own.label})` : ''}.`);
          return true;
        }
        blocks.pop();
        if(!blocks.length) delete a.blocks;
      }
      return false;
    };
    // Fotokopi (max=1) sabah açığını OTOMATİK doldurma — patron "sabah açığı
    // önemli değil, insan kararına kalsın" dedi (Kişi K'i 09–11 fotokopiye itme).
    // Akşam devri (Kişi J) ayrı ele alınıyor; burada max=1 bölgeler atlanır.
    activeRules.filter(r => r.max !== 1).forEach(rule => { let g = 0; while(gapOf(rule) && g++ < 6 && blockFill(rule)); });

    // Bu günün gerçek kapanışlarını say (tüm kaydırmalar bittikten sonra) —
    // haftalık kapanış üst sınırı buna göre uygulanır. Dükkânın tamamını kapsayan
    // günler (ör. Pazar 11:00–20:00) "geç çıkış" sayılmaz, kimsenin tercihi değil.
    const wholeDay = span <= 600;
    ROSTER.forEach(p => {
      const a = day.assignments[p.name];
      if(!isWorking(a) || toMin(a.end) < cM) return;
      if(wholeDay && toMin(a.start) <= oM) return;
      closeCount[p.name] = (closeCount[p.name] || 0) + 1;
    });

    // SON ÇARE — başka kimse kapatamıyorsa "ihtiyaç halinde çağrılan" personel
    // (UI'dan işaretlenmişse) çağrılır. Çok kısa boşluklar için çağrılmaz.
    activeRules.forEach(rule => {
      let g = 0;
      while(gapOf(rule) && g++ < 3){
        const gap = gapOf(rule);
        if(gap.end - gap.start < MIN_CALL_IN_MIN) break;
        const p = ROSTER.find(x => isOnCall(x) && !isOffToday(x) && !locked(x)
          && capableFor(rule, x) && !isWorking(day.assignments[x.name]));
        if(!p) break;
        const before = totalGapScore();
        const prev = Object.assign({}, day.assignments[p.name]);
        const zone = rule.zones.find(z => canCover(p, z));
        const dur = p.hours ? Math.min(p.hours*60, cM - oM) : (gap.end - gap.start);
        const st = Math.max(oM, Math.min(gap.start, cM - dur));
        const en = Math.min(cM, st + dur);
        day.assignments[p.name] = {leave:'NONE', start:hhmm(st), end:hhmm(en), zone};
        if(totalGapScore() < before){
          report.lastResort.push(`${DAY_NAMES[i]} — ${rule.label} boşluğu için ${p.name} çağrıldı (son çare, ${hhmm(st)}–${hhmm(en)}).`);
        } else {
          day.assignments[p.name] = prev;
          break;
        }
      }
    });

    // 3. FİNAL TARAMA — geriye ne kaldıysa dürüstçe raporla + kim kapatabilir
    activeRules.forEach(rule => {
      gapRuns(rule).forEach(gap => {
      const working = ROSTER.filter(p => !isOffToday(p) && isWorking(day.assignments[p.name])
        && !isOnCall(p) && capableFor(rule, p));
      const offButCapable = ROSTER.filter(p => !isOnCall(p) && isOffToday(p)
        && capableFor(rule, p));
      let who, fixable = false;
      if(working.length){ who = `${working.map(p => p.name).join(' / ')} o gün çalışıyor — saatleri elden düzenlenirse kapanabilir (sistem kendi çözemedi)`; fixable = true; }
      else if(offButCapable.length) who = `bu işi yapabilenler bugün izinli (${offButCapable.map(p => p.name).join(', ')})`;
      else { const o = ROSTER.find(isOnCall); who = o ? `bu işi yapabilecek kimse yok — ${o.name} çağrılabilir` : 'bu işi yapabilecek kimse yok'; }
      report.gaps.push({day: DAY_NAMES[i], label: rule.label, window: `${hhmm(gap.start)}–${hhmm(gap.end)}`, who, fixable});
      });

      // Kuralın saat aralığı dışında kalan boşluklar — HATA DEĞİL, sadece bilgi.
      // (ör. "Fotokopi 11:00–21:00" kuralında sabah 09:00–11:00 boş kalabilir.)
      toleransliBosluklar(rule).forEach(bos => {
        report.info.push(`${DAY_NAMES[i]} — ${rule.label} ${hhmm(bos.start)}–${hhmm(bos.end)} arası boş `
          + `(kural ${kuralSaatMetni(rule)} arasında geçerli, bu saat dışarıda — sorun değil).`);
      });
    });

  }

  // Vardiya adaleti özeti — bu hafta kim kaç kapanış aldı
  const closings = {};
  for(let i=0;i<7;i++){
    const k = fmtDate(addDays(currentMonday, i));
    const oh = operatingHours(addDays(currentMonday, i));
    const op = toMin(oh.open), cl = toMin(oh.close);
    const wholeDay = (cl - op) <= 600;   // Pazar gibi kısa günler herkes için aynı — sayılmaz
    ROSTER.forEach(p => {
      const a = weekData.days[k].assignments[p.name];
      if(!isWorking(a) || toMin(a.end) < cl) return;
      if(wholeDay && toMin(a.start) <= op) return;
      closings[p.name] = (closings[p.name] || 0) + 1;
    });
  }
  const closeLine = Object.entries(closings).sort((a,b) => b[1]-a[1])
    .map(([n,c]) => `${n.split(' ')[0]}: ${c}`).join(' · ');
  if(closeLine) report.info.push(`Kapanış vardiyası dağılımı — ${closeLine}`);

  if(manualSups.length){
    report.info.push(`Elle atanan akşam sorumluları korundu — ${manualSups.join(', ')}.`);
  }
  report.info.push('Diğer günlerde akşam sorumlusu sıralı bir öneri olarak atandı — elle değiştirdiğin gün kilitlenir.');
  const oc2 = ROSTER.filter(isOnCall).map(p => p.name);
  if(oc2.length) report.info.push(`${oc2.join(', ')} atanmadı — ihtiyaç dahilinde çağrılıyor.`);
  // KAPANIŞ DENGELEME (son geçiş) — aynı bölgede ÇOK kapatanla AZ kapatanı,
  // kapsama bozulmadan takas eder (biri açıp biri kapatıyorsa rolleri değiştirir).
  // Yapısal kapatıcılar (kapanış grubu, part-time, kapanış sınırı olan, Fotokopi
  // devri/blok, kilitli, akşam sorumlusu) dokunulmaz kalır. Feedback: Kişi I 2 /
  // Kişi M 4 gibi dengesizlikler azalsın; aynı blokta asgari-azami korunur.
  (function balanceClosings(){
    const balRules = rules.filter(r => r.enabled && r.max !== 1);
    const isLong = i => { const oh = operatingHours(addDays(currentMonday, i)); return (toMin(oh.close) - toMin(oh.open)) > 600; };
    const asg = (n, i) => weekData.days[fmtDate(addDays(currentMonday, i))].assignments[n];
    const swapOK = (p, a, i) => a && isWorking(a) && !a.manual && !(a.blocks && a.blocks.length)
      && weekData.days[fmtDate(addDays(currentMonday, i))].sup !== p.name;
    const closesAt = (n, i) => { const a = asg(n, i); if(!a || !isWorking(a)) return false; const oh = operatingHours(addDays(currentMonday, i)); return toMin(a.end) >= toMin(oh.close); };
    const opensAt = (n, i) => { const a = asg(n, i); if(!a || !isWorking(a)) return false; const oh = operatingHours(addDays(currentMonday, i)); return toMin(a.start) <= toMin(oh.open); };
    const count = n => { let c = 0; for(let i = 0; i < 7; i++) if(isLong(i) && closesAt(n, i)) c++; return c; };
    // dengeye uygun (yapısal olmayan) kişiler
    // DÜZELTME (15 Ağustos): eskiden yalnızca p.maxClose'a bakılıyordu; "haftada
    // N gün kapanışa kalmasın" (earlyDays) ile sınırlanmış kişiler "serbest"
    // sanılıp DENGELEME ADINA kapanışa yazılıyordu. Sınır bu son geçişte
    // sessizce eziliyordu. Artık iki ayarı da kapsayan kapanisSiniri'na bakılıyor.
    const flexible = p => isFullTime(p) && !p.closeGroup
      && kapanisSiniri[p.name] == null && !isOnCall(p);
    for(let iter = 0; iter < 40; iter++){
      let best = null;
      for(const rule of balRules){
        const cap = ROSTER.filter(p => flexible(p) && capableFor(rule, p));
        for(const over of cap){
          for(const under of cap){
            if(over.name === under.name) continue;
            if(count(over.name) - count(under.name) < 2) continue;   // en az 2 fark olsun
            for(let i = 0; i < 7; i++){
              if(!isLong(i)) continue;
              const ao = asg(over.name, i), au = asg(under.name, i);
              if(!swapOK(over, ao, i) || !swapOK(under, au, i)) continue;
              if(ao.zone !== au.zone) continue;                      // aynı bölgede olsunlar
              if(!closesAt(over.name, i) || !opensAt(under.name, i)) continue;  // over kapıyor, under açıyor
              best = { over, under, i }; break;
            }
            if(best) break;
          }
          if(best) break;
        }
        if(best) break;
      }
      if(!best) break;
      const dObj = addDays(currentMonday, best.i);
      const os = makeShift(best.over, dObj, 'open'), us = makeShift(best.under, dObj, 'close');
      const ao = asg(best.over.name, best.i), au = asg(best.under.name, best.i);
      ao.start = os.start; ao.end = os.end;                          // over → açılış
      au.start = us.start; au.end = us.end;                          // under → kapanış
    }
  })();

  // PAZAR TELAFİSİ (patron insiyatifi) — Pazar çalışan personelin haftalık toplamı,
  // tam 6 günlük kotanın 1 saat altına insin (10 saatçi 60→59, 9 saatçi 54→53).
  // ÖNEMLİ: Pazar zaten 9 saat (11:00–20:00). Yani 10 saatçi Pazar'da zaten 1 saat
  // eksik yapıyor → haftalık kendiliğinden 59, ekstra kısıntı YOK. 9 saatçi Pazar'da
  // tam kota yapıyor → 1 saat HAFTA İÇİNDEN kısılır. Kısıntı = 1 saat − Pazar'daki
  // eksik. Kapanışı ve kritik (kafe) bloğunu bozmaz; uygun gün yoksa kısılmaz.
  if(sundayComp){
    const sunKey = fmtDate(addDays(currentMonday, 6));
    const enabledRules = rules.filter(r => r.enabled);
    ROSTER.forEach(p => {
      if(!isFullTime(p) || !p.hours) return;                    // part-time hariç
      const sa = weekData.days[sunKey].assignments[p.name];
      if(!isWorking(sa)) return;                                // Pazar çalışmıyorsa telafi yok
      const sunShort = Math.max(0, p.hours*60 - (toMin(sa.end) - toMin(sa.start)));  // Pazar'daki eksik
      const deduct = 60 - sunShort;                            // hafta içinden kısılacak miktar
      if(deduct <= 0) return;                                  // 10 saatçi: kısa Pazar zaten 59 yaptı
      let best = null;
      for(let i = 0; i < 5; i++){                               // yalnız hafta içi
        const dObj = addDays(currentMonday, i), key = fmtDate(dObj);
        const dayAsg = weekData.days[key].assignments;
        const a = dayAsg[p.name];
        if(!isWorking(a) || a.manual) continue;                 // izinli/kilitli güne dokunma
        if(p.closeGroup && groupCloseDay[p.closeGroup] === i) continue;  // grup kapanış günü hariç
        const oh = operatingHours(dObj), cM = toMin(oh.close);
        const st = toMin(a.start), en = toMin(a.end);
        if(en - st < deduct + 180) continue;                    // kısaltınca ~3 saatten aza inmesin
        const closes = en >= cM;                                // kapanışçı: baştan kıs (geç gel)
        const winStart = closes ? st : en - deduct;             // kaldırılacak pencere
        const winEnd = closes ? st + deduct : en;
        const mid = winStart + Math.floor((winEnd - winStart) / 2);
        const pZone = zoneAtMinute(a, mid, p.primary[0]);
        const cov = coverageAt(dObj, key, mid);
        let safe = true, surplus = 0, relevant = false;
        const absorbs = [];
        for(const rule of enabledRules){
          if(!rule.zones.includes(pZone)) continue;
          relevant = true;
          const c = rule.zones.reduce((s, z) => s + (cov[z] ? cov[z].length : 0), 0);
          if(c - 1 >= rule.min){ surplus += (c - 1 - rule.min); continue; }
          // p çıkınca asgari bozulur — bir YARDIMCI, o bölgedeki bloğunu bu
          // pencereyi kapatacak şekilde öne/geriye çekip boşluğu EMEBİLİR mi?
          // (ör. Kişi H 1 saat erken çıkınca Kişi J'in Fotokopi bloğu 1 saat uzar.)
          let emen = null;
          for(const q of ROSTER){
            const qa = dayAsg[q.name];
            if(q.name === p.name || !qa || qa.manual || !isWorking(qa)) continue;
            const blk = (qa.blocks || []).find(b => rule.zones.includes(b.zone)
              && ((!closes && toMin(b.start) <= winEnd && toMin(b.end) >= winEnd && toMin(b.start) > winStart && toMin(qa.start) <= winStart)
               || ( closes && toMin(b.end) >= winStart && toMin(b.start) <= winEnd && toMin(b.end) < winEnd && toMin(qa.end) >= winEnd)));
            if(blk){ emen = {q, blk}; break; }
          }
          if(!emen){ safe = false; break; }
          absorbs.push(emen);
        }
        if(!safe) continue;
        if(!relevant) surplus += 5;                             // hiçbir kurala bağlı değilse en güvenli
        surplus -= absorbs.length * 3;                          // emmeyle çözülen günü biraz geriye it
        if(!best || surplus > best.surplus) best = {i, mode: closes ? 'start' : 'end', a, st, en, surplus, absorbs, winStart, winEnd};
      }
      if(best){
        best.absorbs.forEach(({blk}) => {                       // yardımcı bloğunu uzat (emme)
          if(best.mode === 'end') blk.start = hhmm(best.winStart);
          else blk.end = hhmm(best.winEnd);
        });
        if(best.mode === 'start') best.a.start = hhmm(best.st + deduct);
        else best.a.end = hhmm(best.en - deduct);
        best.a.early = true;                                    // kota-altı uyarısını bastır
        best.a.sundayComp = true;
        const emNote = best.absorbs.length ? ` (${best.absorbs[0].q.name} devraldı)` : '';
        report.moves.push(`${p.name} — Pazar telafisi: ${DAY_NAMES[best.i]} günü ${Math.round(deduct/60*10)/10} saat kısaldı${emNote} (${best.a.start}–${best.a.end}).`);
      } else {
        report.info.push(`${p.name} — Pazar telafisi uygulanamadı: kısaltılabilecek uygun bir hafta içi günü yok.`);
      }
    });
  }

  /* ---------------------------------------------------------------------
     SON KONTROL — kapanış sınırı tutturulabildi mi?
     "Haftada N gün kapanışa kalmasın" ayarı her zaman sağlanamaz: bir bölümde
     yalnızca 2 kişi varsa ve dükkân ikisinin vardiyasından uzun süre açıksa,
     HER GÜN birinin kapatması gerekir. Böyle bir durumda sessiz kalmak yerine
     sebebiyle birlikte raporlanır — kullanıcı ya kadroya birini ekler ya da
     beklentisini bilerek değiştirir.
  --------------------------------------------------------------------- */
  {
    const asanlar = [];
    ROSTER.forEach(p => {
      const sinir = kapanisSiniri[p.name];
      if(sinir == null || isOnCall(p)) return;
      const yapilan = closeCount[p.name] || 0;
      if(yapilan <= sinir) return;
      // Aynı bölüme bakabilen kaç kişi var? (darboğazı açıklamak için)
      const ayniIs = ROSTER.filter(q => !isOnCall(q)
        && q.primary.some(z => p.primary.includes(z))).length;
      const sebepler = [];
      if(ayniIs <= 2) sebepler.push(`${p.primary.map(z => ZONE_MAP[z] ? ZONE_MAP[z].label : z).join('/')} bölümüne yalnızca ${ayniIs} kişi bakıyor, her gün birinin kapatması gerekiyor`);
      if(p.closeGroup) sebepler.push(`"${p.closeGroup}" kapanış grubunda — grup haftada bir gün birlikte kapanış yapıyor (grubu kaldırırsan bu gün de düşer)`);
      asanlar.push(`${p.name}: ${yapilan} kapanış yaptı (istenen en fazla ${sinir})`
        + (sebepler.length ? ' — ' + sebepler.join('; ') : ''));
    });
    if(asanlar.length){
      report.warnings.push(`⚠ Kapanış sınırı tutturulamadı — ${asanlar.join('; ')}. `
        + `Bu ayarın uygulanabilmesi için o bölüme bakabilen bir kişi daha gerekiyor.`);
    }
  }

  /* ---------------------------------------------------------------------
     SON KONTROL — kimse izinsiz kalmasın
     Yukarıdaki adımların herhangi biri (izin dağıtımı, sabit vardiyalar,
     boşluk doldurma, Pazar telafisi) yanlışlıkla birinin tek izin gününü
     yiyebilir. Bu blok üretilen çizelgeyi baştan tarar ve 7 gün çalışan
     kimse varsa RAPORDA AÇIKÇA UYARIR — sessizce geçmez.
  --------------------------------------------------------------------- */
  {
    const izinsiz = [];
    ROSTER.forEach(p => {
      if(isOnCall(p)) return;
      let calisilan = 0, izinli = 0;
      for(let i = 0; i < 7; i++){
        const a = weekData.days[fmtDate(addDays(currentMonday, i))].assignments[p.name];
        if(isWorking(a)) calisilan++;
        else if(isOffLeave(a)) izinli++;
      }
      if(izinli === 0 && calisilan >= 7) izinsiz.push(p.name);
    });
    if(izinsiz.length){
      report.warnings.push(`⚠ İZİNSİZ ÇALIŞMA: ${izinsiz.join(', ')} bu hafta 7 gün çalışıyor, hiç izin günü yok. Bu kişilerin bir gününü çizelgeden "İzinli" yap ya da elle sabitlediğin (📌) bir gününü serbest bırak.`);
    }
  }

  return report;
}

function renderGenReport(report){
  // Jeneratörün ne yaptığını SAKLA; ekranı canlı durum paneli çizer.
  // (Eskiden burası ekranı doğrudan yazıyordu ve kullanıcı elle değişiklik
  //  yapınca rapor donup kalıyordu — "bildirimler hep sabit" şikâyeti buydu.)
  sonOlusturmaRaporu = report;
  sonOlusturmaZamani = report ? new Date() : null;
  if(typeof renderCanliDurum === 'function'){ renderCanliDurum(); return; }
  return renderGenReportEski(report);
}
function renderGenReportEski(report){
  const el = document.getElementById('genReport');
  if(!report){ el.innerHTML = ''; return; }

  const realGaps = report.gaps;
  const fixable = realGaps.filter(g => g.fixable);
  const shortStaffed = realGaps.filter(g => !g.fixable);

  // ÖZET
  const chips = [];
  chips.push(realGaps.length
    ? `<span class="sumchip bad">${realGaps.length} açık nokta</span>`
    : `<span class="sumchip ok">açık nokta yok</span>`);
  if(report.moves.length) chips.push(`<span class="sumchip">${report.moves.length} düzenleme</span>`);
  if(report.moves.length) chips.push(`<span class="sumchip">${report.moves.length} düzenleme</span>`);
  if(report.lastResort.length) chips.push(`<span class="sumchip warn">${report.lastResort.length} son çare çağrı</span>`);
  if(report.warnings.length) chips.push(`<span class="sumchip warn">${report.warnings.length} dikkat</span>`);
  let html = `<div class="g-head">Otomatik oluşturma sonucu</div><div class="sumrow">${chips.join('')}</div>`;

  // DİKKAT EDİLMESİ GEREKENLER
  if(report.warnings.length){
    html += report.warnings.map(w => `<div class="g-gap">⚠ ${w}</div>`).join('');
  }

  // AÇIKLAR — güne göre gruplu, iki kategoride
  const groupByDay = list => {
    const m = new Map();
    list.forEach(g => { if(!m.has(g.day)) m.set(g.day, []); m.get(g.day).push(g); });
    return [...m.entries()].map(([day, items]) =>
      `<div class="g-day"><span class="g-dayname">${day}</span>` +
      items.map(g => `<div class="g-item"><b>${g.label}</b> <span class="g-win">${g.window}</span><br><span class="g-who">${g.who}</span></div>`).join('') +
      `</div>`).join('');
  };
  if(shortStaffed.length){
    html += `<div class="g-sec">Personel yetersiz — o gün bu işi yapabilecek kimse yok (${shortStaffed.length})</div>` + groupByDay(shortStaffed);
  }
  if(fixable.length){
    html += `<div class="g-sec">Elle müdahale gerekiyor (${fixable.length})</div>` + groupByDay(fixable);
  }
  if(!report.gaps.length){
    html += `<div class="g-ok">✓ Tüm kapsama kuralları karşılandı.</div>`;
  }

  // SON ÇARE ÇAĞRILAR
  if(report.lastResort.length){
    html += `<details class="g-det"><summary>Son çare çağrılar (${report.lastResort.length})</summary>` +
      report.lastResort.map(t => `<div class="g-note">· ${t}</div>`).join('') + `</details>`;
  }
  // SİSTEM NE YAPTI
  if(report.moves.length){
    html += `<details class="g-det"><summary>Sistemin yaptığı düzenlemeler (${report.moves.length})</summary>` +
      report.moves.map(t => `<div class="g-note">· ${t}</div>`).join('') + `</details>`;
  }
  // BİLGİ
  if(report.info.length){
    html += `<details class="g-det"><summary>Korunanlar ve bilgi notları (${report.info.length})</summary>` +
      report.info.map(t => `<div class="g-note">· ${t}</div>`).join('') + `</details>`;
  }
  el.innerHTML = html;
}

document.getElementById('btnGenerate').addEventListener('click', async () => {
  if(kilitEngeli('Haftayı otomatik oluştur')) return;   // kilitli hafta korunur
  if(!confirm('Bu haftadaki mevcut plan silinip kurallara göre yeniden oluşturulacak. Devam edilsin mi?')) return;

  // Geçen haftanın Pazar iznini yükle (dinlenme aralığı tercihi için)
  prevSundayOff = new Set();
  try{
    const prevSunKey = 'week:' + fmtDate(addDays(currentMonday, -7));
    const r = await store.get(prevSunKey);
    if(r && r.value){
      const pw = JSON.parse(r.value);
      const sunKey = fmtDate(addDays(currentMonday, -1));   // geçen haftanın Pazarı
      const asg = pw.days && pw.days[sunKey] && pw.days[sunKey].assignments;
      if(asg) ROSTER.forEach(p => { const a = asg[p.name]; if(isOffLeave(a)) prevSundayOff.add(p.name); });
    }
  }catch(e){ /* geçen hafta yok — tercih uygulanmaz */ }
  undoKaydet();
  const report = generateWeek();
  renderGrid();
  renderValidation();
  renderGenReport(report);
  scheduleSave();
});
