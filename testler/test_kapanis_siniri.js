/* ============================================================
   KAPANIS SINIRI ("haftada N gun kapanisa kalmasin")
   - Sinir gercekten uygulanmali
   - KAPANIS GRUBU siniri EZMEMELI (15 Agustos hatasi)
   - Saatler kisalmamali
   - Kapsama bozulmamali
   ============================================================ */
(async () => {
  await new Promise(r=>setTimeout(r,80));
  const gec=[],kal=[]; const K=(a,s)=>(s?gec:kal).push(a);

  // Kapanis grubu OLAN birini sec (asil test bu)
  const d = ROSTER.find(p=>p.closeGroup && isFullTime(p) && !isOnCall(p))
         || ROSTER.find(p=>isFullTime(p) && !isOnCall(p));
  currentMonday = new Date(2026,7,17);

  const olc = async () => {
    await loadWeek(); ensureWeekPeople();
    const r = generateWeek();
    const keys=[...Array(7)].map((_,i)=>fmtDate(addDays(currentMonday,i)));
    let kap=0, calisilan=0, kotaAlti=0, bos=0;
    for(let i=0;i<7;i++){
      const dObj=addDays(currentMonday,i), oh=operatingHours(dObj);
      const a=weekData.days[keys[i]].assignments[d.name];
      if(isWorking(a)){
        calisilan++;
        if(toMin(a.end)>=toMin(oh.close) && (toMin(oh.close)-toMin(oh.open))>600) kap++;
        const sure=(toMin(a.end)-toMin(a.start))/60;
        if(d.hours && sure < d.hours-0.01 && !a.sundayComp
           && !(toMin(a.start)<=toMin(oh.open)&&toMin(a.end)>=toMin(oh.close))) kotaAlti++;
      }
      for(let m=toMin(oh.open); m<toMin(oh.close); m+=30){
        const cov=coverageAt(dObj,keys[i],m);
        rules.filter(x=>x.enabled).forEach(rule=>{
          if(!kuralGecerliMi(rule,m,toMin(oh.open),toMin(oh.close))) return;
          const cc=rule.zones.reduce((s,z)=>s+(cov[z]?cov[z].length:0),0);
          if(cc<rule.min) bos+=0.5;
        });
      }
    }
    return {kap, calisilan, kotaAlti, bos, gaps:r.gaps.length};
  };

  delete d.earlyDays;
  const once = await olc();
  d.earlyDays = 6;                       // 6 gun kapanisa kalmasin -> 0 kapanis
  const sonra = await olc();
  delete d.earlyDays;

  console.log('Test kisisi: ' + d.name + (d.closeGroup ? '  (kapanis grubu: ' + d.closeGroup + ')' : ''));
  console.log('   ayarsiz  -> ' + once.kap + ' kapanis, ' + once.bos + ' bos saat');
  console.log('   sinirli  -> ' + sonra.kap + ' kapanis, ' + sonra.bos + ' bos saat');
  console.log('');

  K('kapanis sayisi 0a indi (grup zorlamasi siniri ezmedi)', sonra.kap === 0);
  K('calisilan gun sayisi degismedi', sonra.calisilan === once.calisilan);
  K('saatler kisalmadi (kota-alti gun yok)', sonra.kotaAlti === 0);
  K('kapsama bozulmadi (bos saat artmadi)', sonra.bos <= once.bos + 0.01);

  console.log('=== KAPANIS SINIRI TESTI ===');
  gec.forEach(x=>console.log('  [GECTI] '+x));
  kal.forEach(x=>console.log('  [KALDI] '+x));
  console.log('');
  console.log('  Sonuc: '+gec.length+' gecti, '+kal.length+' kaldi');
})();
