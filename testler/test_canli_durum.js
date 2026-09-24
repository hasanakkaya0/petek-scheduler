(async () => {
  await new Promise(r=>setTimeout(r,80));
  currentMonday = new Date(2026,7,17); await loadWeek(); ensureWeekPeople();
  const keys=[...Array(7)].map((_,i)=>fmtDate(addDays(currentMonday,i)));
  const durum = () => haftaSorunlariniHesapla();

  generateWeek();
  let d = durum();
  console.log('1) Otomatik olusturmadan sonra');
  console.log('   sorun:', d.sorunlar.length, ' not:', d.notlar.length, ' sabit:', d.sabit);
  const ilk = d.sorunlar.length;

  console.log('');
  console.log('2) Kullanici bir kisiyi bakamadigi bolume atiyor (CAKISMA)');
  const p = ROSTER.find(x=>!isOnCall(x));
  const yasak = ZONES.find(z=>!canCover(p, z.id));
  weekData.days[keys[1]].assignments[p.name] = {leave:'NONE', start:'09:00', end:'18:00', zone:yasak.id, manual:true};
  d = durum();
  const cakisma = d.sorunlar.filter(s=>s.tur==='çakışma');
  console.log('   ' + p.name + ' -> ' + yasak.label);
  console.log('   yakalandi mi:', cakisma.length ? 'EVET' : 'HAYIR');
  cakisma.forEach(s=>console.log('      ! ' + s.metin));
  console.log('   sabit sayaci:', d.sabit);

  console.log('');
  console.log('3) Kullanici birinin TUM izinlerini kaldiriyor (7 gun calisma)');
  const q = ROSTER.find(x=>!isOnCall(x) && x.name!==p.name);
  keys.forEach(k=>{
    const a = weekData.days[k].assignments[q.name];
    if(!isWorking(a)) weekData.days[k].assignments[q.name] = {leave:'NONE', start:'09:00', end:'18:00', zone:q.primary[0], manual:true};
  });
  d = durum();
  const izinSorun = d.sorunlar.filter(s=>s.tur==='izin');
  console.log('   yakalandi mi:', izinSorun.length ? 'EVET' : 'HAYIR');
  izinSorun.forEach(s=>console.log('      ! ' + s.metin));

  console.log('');
  console.log('4) Sonuc');
  d = durum();
  console.log('   olusturmadan sonra sorun :', ilk);
  console.log('   elle degisikliklerden sonra:', d.sorunlar.length, ' sabit:', d.sabit);
  console.log('');
  console.log(d.sorunlar.length > ilk && cakisma.length && izinSorun.length
    ? '   >>> GECTI: panel elle degisiklikleri ANINDA yakaliyor'
    : '   >>> KALDI');
})();
