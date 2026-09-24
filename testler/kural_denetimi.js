
/* ============================================================
   KURAL DENETIMI — uretilen cizelgeyi tum kurallara karsi tarar
   ============================================================ */
(async () => {
  await new Promise(r => setTimeout(r, 80));

  const gunKeys = () => [...Array(7)].map((_, i) => fmtDate(addDays(currentMonday, i)));

  function denetle(etiket){
    const bulgular = [];
    const keys = gunKeys();

    // --- 1) Kimse izinsiz 7 gun calismasin ---
    ROSTER.forEach(p => {
      if(isOnCall(p)) return;
      let cal = 0, izn = 0;
      keys.forEach(k => {
        const a = weekData.days[k].assignments[p.name];
        if(isWorking(a)) cal++; else if(isOffLeave(a)) izn++;
      });
      if(izn === 0 && cal >= 7) bulgular.push(['IZINSIZ', `${p.name} 7 gun calisiyor, hic izni yok`]);
    });

    // --- 2) Jenerator hafta sonu cift izin uretmesin (elle girilen haric) ---
    ROSTER.forEach(p => {
      const cmt = weekData.days[keys[5]].assignments[p.name];
      const paz = weekData.days[keys[6]].assignments[p.name];
      const rutin = a => a && a.leave === 'IZINLI' && !a.manual;
      if(rutin(cmt) && rutin(paz)) bulgular.push(['CIFT_IZIN', `${p.name} hem Cmt hem Paz izinli (jenerator uretti)`]);
    });

    // --- 3) Haftalik saat ust siniri ---
    ROSTER.forEach(p => {
      if(p.weeklyMax == null) return;
      let dk = 0;
      keys.forEach(k => { const a = weekData.days[k].assignments[p.name];
        if(isWorking(a)) dk += toMin(a.end) - toMin(a.start); });
      const sa = dk / 60;
      if(sa > p.weeklyMax + 0.01) bulgular.push(['HAFTALIK_ASIM', `${p.name} ${sa} sa (sinir ${p.weeklyMax})`]);
    });

    // --- 4) Gunluk kota asimi (jenerator asla fazla mesai yazmamali) ---
    ROSTER.forEach(p => {
      if(!p.hours) return;
      keys.forEach((k, i) => {
        const a = weekData.days[k].assignments[p.name];
        if(!isWorking(a) || a.manual) return;      // elle girilenler kullanicinin karari
        const sure = (toMin(a.end) - toMin(a.start)) / 60;
        if(sure > p.hours + 0.01)
          bulgural_push(bulgular, ['KOTA_ASIM', `${p.name} ${DAY_NAMES[i]}: ${sure} sa (kota ${p.hours})`]);
      });
    });
    function bulgural_push(arr, x){ arr.push(x); }

    // --- 5) Kapsama kurallari (her 30 dk icin min/max) ---
    keys.forEach((k, i) => {
      const dObj = addDays(currentMonday, i);
      const oh = operatingHours(dObj);
      const ihlal = {};
      for(let m = toMin(oh.open); m < toMin(oh.close); m += 30){
        const cov = coverageAt(dObj, k, m);
        rules.filter(r => r.enabled).forEach(rule => {
          const c = rule.zones.reduce((s, z) => s + (cov[z] ? cov[z].length : 0), 0);
          if(c < rule.min) (ihlal[rule.label] ||= []).push(hhmm(m) + ' (' + c + '<' + rule.min + ')');
          else if(rule.max !== null && c > rule.max) (ihlal[rule.label] ||= []).push(hhmm(m) + ' (' + c + '>' + rule.max + ')');
        });
      }
      Object.entries(ihlal).forEach(([lbl, list]) => {
        bulgular.push(['KAPSAMA', `${DAY_NAMES[i]} — ${lbl}: ${list.length} yarim saat acik (${list[0]}...)`]);
      });
    });

    // --- 6) Aksam sorumlusu kapanisa kadar kalmali ---
    keys.forEach((k, i) => {
      const d = weekData.days[k];
      if(!d.sup) { bulgular.push(['SORUMLU_YOK', `${DAY_NAMES[i]} — aksam sorumlusu atanmamis`]); return; }
      if(!ROSTER.some(p => p.name === d.sup)) return;   // yonetici, cizelgede satiri yok
      const a = d.assignments[d.sup];
      const kapanis = toMin(operatingHours(addDays(currentMonday, i)).close);
      if(!isWorking(a)) bulgular.push(['SORUMLU_CALISMIYOR', `${DAY_NAMES[i]} — ${d.sup} sorumlu ama o gun calismiyor`]);
      else if(toMin(a.end) < kapanis) bulgular.push(['SORUMLU_ERKEN', `${DAY_NAMES[i]} — ${d.sup} ${a.end}'de cikiyor (kapanis ${hhmm(kapanis)})`]);
    });

    // --- 7) Kapanis sayisi ust siniri ---
    ROSTER.forEach(p => {
      if(p.maxClose == null) return;
      let n = 0;
      keys.forEach((k, i) => {
        const a = weekData.days[k].assignments[p.name];
        if(isWorking(a) && toMin(a.end) >= toMin(operatingHours(addDays(currentMonday, i)).close)) n++;
      });
      if(n > p.maxClose) bulgular.push(['KAPANIS_ASIM', `${p.name} ${n} kapanis (sinir ${p.maxClose})`]);
    });

    // --- 8) Bakabilmedigi bolume atanmis mi ---
    keys.forEach((k, i) => {
      ROSTER.forEach(p => {
        const a = weekData.days[k].assignments[p.name];
        if(!isWorking(a) || !a.zone) return;
        if(!canCover(p, a.zone))
          bulgular.push(['YETKISIZ', `${p.name} ${DAY_NAMES[i]}: ${a.zone} bolumune atanmis ama bakamiyor`]);
      });
    });

    // --- 9) Vardiya dukkan saatleri disina tasmis mi ---
    keys.forEach((k, i) => {
      const oh = operatingHours(addDays(currentMonday, i));
      ROSTER.forEach(p => {
        const a = weekData.days[k].assignments[p.name];
        if(!isWorking(a) || a.manual) return;
        if(toMin(a.start) < toMin(oh.open) || toMin(a.end) > toMin(oh.close))
          bulgular.push(['SAAT_DISI', `${p.name} ${DAY_NAMES[i]}: ${a.start}-${a.end} (dukkan ${oh.open}-${oh.close})`]);
      });
    });

    return bulgular;
  }

  // ===================== CALISTIR =====================
  const haftalar = ['2026-07-27','2026-08-03','2026-08-10','2026-08-17','2026-08-24','2026-08-31','2026-09-07'];
  const toplam = {};
  console.log('');
  console.log('HAFTA        | bulgu | detay');
  console.log('-'.repeat(72));

  for(const h of haftalar){
    const [y,m,d] = h.split('-').map(Number);
    currentMonday = new Date(y, m-1, d);
    await loadWeek(); ensureWeekPeople();
    generateWeek();
    const b = denetle(h);
    b.forEach(([tip]) => toplam[tip] = (toplam[tip]||0)+1);
    const ozet = b.length ? b.slice(0,2).map(x=>x[0]).join(', ') + (b.length>2?' +'+(b.length-2):'') : 'temiz';
    console.log(h + '   | ' + String(b.length).padStart(5) + ' | ' + ozet);
    if(b.length && b.length <= 6) b.forEach(([t,m2]) => console.log('             |       |   . ' + m2));
  }

  console.log('-'.repeat(72));
  console.log('');
  console.log('=== BULGU TURLERI (7 hafta toplami) ===');
  const sirali = Object.entries(toplam).sort((a,b)=>b[1]-a[1]);
  if(!sirali.length) console.log('  Hicbir kural ihlali yok.');
  sirali.forEach(([t,n]) => console.log('  ' + t.padEnd(20) + n));
})();
