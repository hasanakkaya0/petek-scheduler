(async () => {
  await new Promise(r=>setTimeout(r,80));
  const gec=[], kal=[]; const K=(ad,s)=>(s?gec:kal).push(ad);
  const kisi = ROSTER.find(p=>isFullTime(p) && !isOnCall(p) && p.maxClose==null && !p.closeGroup);

  const olc = () => {
    const keys=[...Array(7)].map((_,i)=>fmtDate(addDays(currentMonday,i)));
    let kapanis=0, calisilan=0, eksikGun=0, dk=0;
    const satirlar=[];
    keys.forEach((k,i)=>{
      const a=weekData.days[k].assignments[kisi.name];
      const oh=operatingHours(addDays(currentMonday,i));
      if(!isWorking(a)){ satirlar.push(DAY_NAMES[i].slice(0,3)+' '+(a.leave||'-')); return; }
      calisilan++; dk += toMin(a.end)-toMin(a.start);
      const sure=(toMin(a.end)-toMin(a.start))/60;
      const kap = toMin(a.end)>=toMin(oh.close) && (toMin(oh.close)-toMin(oh.open))>600;
      if(kap) kapanis++;
      if(kisi.hours && sure < kisi.hours - 0.01 && !a.sundayComp
         && !(toMin(a.start)<=toMin(oh.open) && toMin(a.end)>=toMin(oh.close))) eksikGun++;
      satirlar.push(DAY_NAMES[i].slice(0,3)+' '+a.start+'-'+a.end+' ('+sure+'sa)'+(kap?' KAPANIS':''));
    });
    return {kapanis, calisilan, eksikGun, saat:dk/60, satirlar};
  };

  currentMonday = new Date(2026,7,17);

  // --- ONCE: erken cikis ayari YOK
  delete kisi.earlyDays;
  await loadWeek(); ensureWeekPeople(); generateWeek();
  const a = olc();
  console.log('Kisi: ' + kisi.name + '  (kota ' + kisi.hours + ' sa/gun)');
  console.log('');
  console.log('1) Erken cikis ayari YOK:');
  a.satirlar.forEach(s=>console.log('     '+s));
  console.log('   -> ' + a.calisilan + ' gun, ' + a.saat + ' saat, ' + a.kapanis + ' kapanis, kota-alti gun: ' + a.eksikGun);

  // --- SONRA: "3 gun kapanisa kalmasin"
  kisi.earlyDays = 3;
  await loadWeek(); ensureWeekPeople(); generateWeek();
  const b = olc();
  console.log('');
  console.log('2) "3 gun kapanisa kalmasin" ayarli:');
  b.satirlar.forEach(s=>console.log('     '+s));
  console.log('   -> ' + b.calisilan + ' gun, ' + b.saat + ' saat, ' + b.kapanis + ' kapanis, kota-alti gun: ' + b.eksikGun);
  delete kisi.earlyDays;

  console.log('');
  K('saatler KISALTILMADI (kota-alti gun yok)', b.eksikGun === 0);
  K('haftalik saat azalmadi', b.saat >= a.saat - 0.01);
  K('kapanis sayisi sinirlandi (<= calisilan gun - 3)', b.kapanis <= Math.max(0, b.calisilan - 3));
  K('kapanis eskisinden az ya da esit', b.kapanis <= a.kapanis);

  console.log('=== ERKEN CIKIS (KAPANISA KALMAMA) TESTI ===');
  gec.forEach(x=>console.log('  [GECTI] '+x));
  kal.forEach(x=>console.log('  [KALDI] '+x));
  console.log('');
  console.log('  Sonuc: '+gec.length+' gecti, '+kal.length+' kaldi');
})();
