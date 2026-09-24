(async () => {
  await new Promise(r=>setTimeout(r,80));
  const gec=[],kal=[]; const K=(a,s)=>(s?gec:kal).push(a);
  const git = async (y,m,d) => { currentMonday=new Date(y,m-1,d); haftayaGoreKadroyuTazele(); await loadWeek(); ensureWeekPeople(); };

  // Mevcut veri bozulmamis mi
  await git(2026,7,6);   const h1 = ROSTER.length;
  await git(2026,7,20);  const h2 = ROSTER.length;
  await git(2026,8,17);  const h3 = ROSTER.length;
  console.log('Kadro sayilari — 6 Tem: '+h1+'  20 Tem: '+h2+'  17 Agu: '+h3);
  K('eski haftalarda kadro KAYBOLMADI', h1 > 0 && h2 > 0);

  // Yeni kisi ekleme senaryosu (kullanicinin gercek akisi)
  await git(2026,8,24);
  const yeni = {name:'Yeni Eleman', hasRow:true, type:'Tam zamanlı', hours:9,
                primary:['KASA'], backup:[], sup:false, startWeek: fmtDate(currentMonday)};
  PEOPLE.push(yeni); rebuildPeople();
  K('yeni eleman eklendigi haftada VAR', ROSTER.some(p=>p.name==='Yeni Eleman'));

  await git(2026,8,17);
  K('onceki haftada YOK', !ROSTER.some(p=>p.name==='Yeni Eleman'));
  K('onceki haftaya BOS SUTUN acilmadi',
     !Object.keys(weekData.days[fmtDate(currentMonday)].assignments).includes('Yeni Eleman'));
  await git(2026,7,6);
  K('cok eski haftada da YOK', !ROSTER.some(p=>p.name==='Yeni Eleman'));
  await git(2026,9,7);
  K('sonraki haftalarda VAR', ROSTER.some(p=>p.name==='Yeni Eleman'));

  // Cikarma senaryosu
  await git(2026,9,7);
  const cik = ROSTER.find(p=>p.name!=='Yeni Eleman');
  cik.endWeek = fmtDate(addDays(currentMonday,-7));
  rebuildPeople();
  K('cikarilan bu haftadan itibaren YOK', !ROSTER.some(p=>p.name===cik.name));
  await git(2026,8,17);
  K('cikarilanin GECMISI duruyor', ROSTER.some(p=>p.name===cik.name));

  PEOPLE = PEOPLE.filter(p=>p.name!=='Yeni Eleman'); delete cik.endWeek; rebuildPeople();
  console.log('');
  gec.forEach(x=>console.log('  [GECTI] '+x));
  kal.forEach(x=>console.log('  [KALDI] '+x));
  console.log('');
  console.log('  Sonuc: '+gec.length+' gecti, '+kal.length+' kaldi');
})();
