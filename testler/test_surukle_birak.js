(async () => {
  await new Promise(r=>setTimeout(r,80));
  currentMonday = new Date(2026,7,17); await loadWeek(); ensureWeekPeople();
  delete weekData.locked; delete weekData.lockedAt;   // test kilitsiz haftada calisir
  generateWeek();
  const keys=[...Array(7)].map((_,i)=>fmtDate(addDays(currentMonday,i)));
  const A = ROSTER.find(p=>!isOnCall(p));
  const B = ROSTER.find(p=>!isOnCall(p) && p.name!==A.name);
  const gec=[], kal=[];
  const K=(ad,s)=>(s?gec:kal).push(ad);

  // --- 1) SABIT OLMAYAN vardiya kopyalaninca sabit gitmemeli
  weekData.days[keys[1]].assignments[A.name] = {leave:'NONE', start:'10:00', end:'19:00', zone:A.primary[0]};
  weekData.days[keys[2]].assignments[B.name] = {leave:'NONE', start:'09:00', end:'18:00', zone:B.primary[0]};
  vardiyaKopyala({dateStr:keys[1], name:A.name}, {dateStr:keys[2], name:B.name});
  let h = weekData.days[keys[2]].assignments[B.name];
  K('saatler kopyalandi (10:00-19:00)', h.start==='10:00' && h.end==='19:00');
  K('sabit DEGILDI -> sabit gitmedi', !h.manual);
  K('kaynak yerinde kaldi (kopyalama, tasima degil)',
     weekData.days[keys[1]].assignments[A.name].start==='10:00');

  // --- 2) SABIT vardiya kopyalaninca sabit gitmeli
  weekData.days[keys[1]].assignments[A.name] = {leave:'NONE', start:'13:00', end:'21:00', zone:A.primary[0], manual:true};
  vardiyaKopyala({dateStr:keys[1], name:A.name}, {dateStr:keys[3], name:B.name});
  h = weekData.days[keys[3]].assignments[B.name];
  K('sabit vardiya -> hedefe SABIT gitti', h.manual === true);
  K('saatleri dogru (13:00-21:00)', h.start==='13:00' && h.end==='21:00');

  // --- 3) Geri alma
  const oncekiDurum = JSON.stringify(weekData.days[keys[4]].assignments[B.name]);
  vardiyaKopyala({dateStr:keys[1], name:A.name}, {dateStr:keys[4], name:B.name});
  K('kopyalama gerceklesti', JSON.stringify(weekData.days[keys[4]].assignments[B.name]) !== oncekiDurum);
  geriAl();
  K('GERI AL eski hali dogru getirdi',
     JSON.stringify(weekData.days[keys[4]].assignments[B.name]) === oncekiDurum);

  // --- 4) Izin gunu kopyalama
  weekData.days[keys[5]].assignments[A.name] = {leave:'IZINLI', start:null, end:null, zone:null};
  vardiyaKopyala({dateStr:keys[5], name:A.name}, {dateStr:keys[6], name:B.name});
  K('izin gunu de kopyalanabiliyor', weekData.days[keys[6]].assignments[B.name].leave==='IZINLI');

  // --- 5) Kilitli haftada engellenmeli
  weekData.locked = true;
  const once = JSON.stringify(weekData.days[keys[2]].assignments[B.name]);
  vardiyaKopyala({dateStr:keys[1], name:A.name}, {dateStr:keys[2], name:B.name});
  K('KILITLI haftada kopyalama engellendi',
     JSON.stringify(weekData.days[keys[2]].assignments[B.name]) === once);
  delete weekData.locked;

  console.log('=== SURUKLE-BIRAK TESTI ===');
  gec.forEach(x=>console.log('  [GECTI] ' + x));
  kal.forEach(x=>console.log('  [KALDI] ' + x));
  console.log('');
  console.log('  Sonuc: ' + gec.length + ' gecti, ' + kal.length + ' kaldi');
})();
