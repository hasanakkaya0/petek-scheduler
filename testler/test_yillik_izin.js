(async () => {
  await new Promise(r=>setTimeout(r,80));
  const gec=[], kal=[]; const K=(ad,s)=>(s?gec:kal).push(ad);

  // --- 1) Mevcut gercek veride tarama calisiyor mu
  currentMonday = new Date(2026,7,17); await loadWeek(); ensureWeekPeople();
  let sayim = await yillikIzinleriTara();
  console.log('Gercek veride bulunan yillar:', Object.keys(sayim).join(', ') || '(yok)');
  Object.keys(sayim).sort().forEach(y=>{
    const liste = Object.entries(sayim[y]).filter(([n,g])=>g>0).map(([n,g])=>n.split(' ')[0]+':'+g);
    console.log('  ' + y + ' -> ' + (liste.length? liste.join(', ') : 'kimse kullanmamis'));
  });
  K('tarama calisiyor (hata vermedi)', typeof sayim === 'object');

  // --- 2) YIL SINIRI: bir hafta iki yila yayilirsa gunler dogru yila yazilmali
  //     29 Aralik 2025 Pazartesi -> hafta 29 Ara 2025 .. 4 Oca 2026
  currentMonday = new Date(2025,11,29);
  await loadWeek(); ensureWeekPeople();
  const keys=[...Array(7)].map((_,i)=>fmtDate(addDays(currentMonday,i)));
  console.log('');
  console.log('Yil sinirini asan hafta:', keys[0], '..', keys[6]);
  const kisi = ROSTER[0].name;
  // 2 gun 2025'e, 2 gun 2026'ya yillik izin koy
  weekData.days[keys[0]].assignments[kisi] = {leave:'YILLIK', start:null, end:null, zone:null}; // 29 Ara 2025
  weekData.days[keys[1]].assignments[kisi] = {leave:'YILLIK', start:null, end:null, zone:null}; // 30 Ara 2025
  weekData.days[keys[4]].assignments[kisi] = {leave:'YILLIK', start:null, end:null, zone:null}; // 2 Oca 2026
  weekData.days[keys[5]].assignments[kisi] = {leave:'YILLIK', start:null, end:null, zone:null}; // 3 Oca 2026
  sayim = await yillikIzinleriTara();
  const y2025 = (sayim[2025]||{})[kisi] || 0;
  const y2026yeni = (sayim[2026]||{})[kisi] || 0;
  console.log('  ' + kisi + ' -> 2025:', y2025, ' 2026:', y2026yeni);
  K('2025 gunleri 2025e yazildi (2 gun)', y2025 === 2);
  K('2026 gunleri 2026ya yazildi (en az 2 gun)', y2026yeni >= 2);
  K('yil sinirinda gunler KARISMADI', y2025 === 2);

  console.log('');
  console.log('=== YILLIK IZIN SAYACI TESTI ===');
  gec.forEach(x=>console.log('  [GECTI] ' + x));
  kal.forEach(x=>console.log('  [KALDI] ' + x));
  console.log('');
  console.log('  Sonuc: ' + gec.length + ' gecti, ' + kal.length + ' kaldi');
})();
