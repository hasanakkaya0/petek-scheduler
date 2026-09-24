(async () => {
  await new Promise(r=>setTimeout(r,80));
  const gec=[],kal=[]; const K=(a,s)=>(s?gec:kal).push(a);

  const ana  = ROSTER.find(p=>p.primary[0]==='FOTOKOPI');          // asil fotokopici
  const yan  = ROSTER.find(p=>p.name!==ana.name && isFullTime(p) && !isOnCall(p) && !p.closeGroup);
  console.log('Ana fotokopici :', ana.name, '(kota '+ana.hours+' sa)');
  console.log('Yan gorevli    :', yan.name, '(kota '+yan.hours+' sa)  <- Fotokopi ikinci gorev olarak ekleniyor');

  // "Cağlar" senaryosu: yan gorevlinin ana gorevleri arasina FOTOKOPI ekle (ikinci sirada)
  const yedek = yan.primary.slice();
  yan.primary = yedek.concat(['FOTOKOPI']);

  // Iki kisinin de calistigi bir hafta bul (izin/yillik izin haftalarini atla)
  let bulundu = false;
  for(const [yy,mm,dd] of [[2026,8,17],[2026,8,24],[2026,8,31],[2026,9,7],[2026,9,14]]){
    currentMonday = new Date(yy,mm-1,dd);
    if(typeof haftayaGoreKadroyuTazele === 'function') haftayaGoreKadroyuTazele();
    await loadWeek(); ensureWeekPeople();
    delete weekData.locked;
    generateWeek();
    const keys=[...Array(7)].map((_,i)=>fmtDate(addDays(currentMonday,i)));
    const cal = ad => keys.some(k=>isWorking(weekData.days[k].assignments[ad]));
    if(cal(ana.name) && cal(yan.name)){ bulundu = true; break; }
  }
  if(!bulundu) console.log('   (uyari: iki kisinin de calistigi hafta bulunamadi)');
  const keys=[...Array(7)].map((_,i)=>fmtDate(addDays(currentMonday,i)));

  const fotoSaat = (ad) => {
    let dk=0;
    keys.forEach((k,i)=>{
      const a=weekData.days[k].assignments[ad];
      if(!isWorking(a)) return;
      const oh=operatingHours(addDays(currentMonday,i));
      for(let m=toMin(oh.open); m<toMin(oh.close); m+=30){
        if(zoneAtMinute(a,m,null)==='FOTOKOPI') dk+=30;
      }
    });
    return dk/60;
  };
  const anaSaat = fotoSaat(ana.name), yanSaat = fotoSaat(yan.name);

  console.log('');
  console.log('Haftalik FOTOKOPI saatleri:');
  console.log('   ' + ana.name.padEnd(16) + anaSaat + ' saat   (ANA GOREVLI)');
  console.log('   ' + yan.name.padEnd(16) + yanSaat + ' saat   (yan gorev)');
  console.log('');
  keys.forEach((k,i)=>{
    const a=weekData.days[k].assignments[ana.name], b=weekData.days[k].assignments[yan.name];
    const f=x=> isWorking(x) ? (x.start+'-'+x.end+' '+(x.zone||'-')) : (x.leave||'-');
    console.log('   ' + DAY_NAMES[i].slice(0,3) + '  ' + ana.name.split(' ')[0].padEnd(9) + f(a).padEnd(22) + yan.name.split(' ')[0].padEnd(9) + f(b));
  });

  yan.primary = yedek;   // geri al

  console.log('');
  K('ANA gorevli yan gorevliden COK Fotokopi yapiyor', anaSaat > yanSaat);
  K('ana gorevli ciddi sure Fotokopide (>= 40 sa)', anaSaat >= 40);
  console.log('=== ANA/YEDEK ONCELIK TESTI ===');
  gec.forEach(x=>console.log('  [GECTI] '+x));
  kal.forEach(x=>console.log('  [KALDI] '+x));
})();
