
/* ============================================================
   DERIN KALITE ANALIZI
   "Iyi bir haftalik cizelge" olcutleri:
     1 Kapsama    - kural saatlerinde bosluk kalmasin
     2 Saat       - herkes kotasini calissin
     3 Dinlenme   - kapanis yapan ertesi sabah acilisa gelmesin
     4 Adalet     - kapanis/hafta sonu/Pazar dengeli dagilsin
     5 Sureklilik - kisi hafta boyu ayni bolumde/saatte olsun
   ============================================================ */
(async () => {
  await new Promise(r => setTimeout(r, 80));
  const haftalar = ['2026-08-17','2026-08-24','2026-08-31','2026-09-07'];
  const kisiler = () => ROSTER.filter(p => !isOnCall(p));

  const T = { kapsama:0, kapsamaSaat:0, saatEksik:0, clopening:[], desen:{}, kapanis:{}, pazar:{}, bolge:{} };

  for(const h of haftalar){
    const [y,m,d] = h.split('-').map(Number);
    currentMonday = new Date(y, m-1, d);
    await loadWeek(); ensureWeekPeople();
    const rap = generateWeek();
    const keys = [...Array(7)].map((_,i)=>fmtDate(addDays(currentMonday,i)));

    // 1 KAPSAMA
    T.kapsama += rap.gaps.length;
    for(let i=0;i<7;i++){
      const dObj=addDays(currentMonday,i), k=keys[i], oh=operatingHours(dObj);
      for(let mm=toMin(oh.open); mm<toMin(oh.close); mm+=30){
        const cov=coverageAt(dObj,k,mm);
        rules.filter(r=>r.enabled).forEach(rule=>{
          if(!kuralGecerliMi(rule,mm,toMin(oh.open),toMin(oh.close))) return;
          const c=rule.zones.reduce((s,z)=>s+(cov[z]?cov[z].length:0),0);
          if(c<rule.min) T.kapsamaSaat += 0.5;
        });
      }
    }

    kisiler().forEach(p=>{
      let dk=0, gun=0;
      const desenler = new Set(), bolgeler = new Set();
      let kapanisSay=0, pazarCalisti=false;

      keys.forEach((k,i)=>{
        const a = weekData.days[k].assignments[p.name];
        if(!isWorking(a)) return;
        dk += toMin(a.end)-toMin(a.start); gun++;
        desenler.add(a.start+'-'+a.end);
        if(a.zone) bolgeler.add(a.zone);
        const oh = operatingHours(addDays(currentMonday,i));
        if(toMin(a.end) >= toMin(oh.close) && (toMin(oh.close)-toMin(oh.open))>600) kapanisSay++;
        if(i===6) pazarCalisti=true;

        // 3 DINLENME: bugun kapanis + yarin acilis?
        if(i<6){
          const b = weekData.days[keys[i+1]].assignments[p.name];
          const oh2 = operatingHours(addDays(currentMonday,i+1));
          if(isWorking(b) && toMin(a.end)>=toMin(oh.close) && toMin(b.start)<=toMin(oh2.open)){
            const ara = (24*60 - toMin(a.end)) + toMin(b.start);
            T.clopening.push(h.slice(5)+' '+p.name.split(' ')[0].padEnd(9)+
              DAY_NAMES[i].slice(0,3)+' '+a.end+' -> '+DAY_NAMES[i+1].slice(0,3)+' '+b.start+
              '  (sadece '+(ara/60)+' saat dinlenme)');
          }
        }
      });

      if(p.hours && gun){
        const eksik = p.hours*gun - dk/60;
        if(eksik > 0.01) T.saatEksik += eksik;
      }
      (T.desen[p.name] ||= []).push(desenler.size);
      (T.bolge[p.name] ||= new Set()); bolgeler.forEach(z=>T.bolge[p.name].add(z));
      T.kapanis[p.name] = (T.kapanis[p.name]||0) + kapanisSay;
      if(pazarCalisti) T.pazar[p.name] = (T.pazar[p.name]||0)+1;
    });
  }

  const N = haftalar.length;
  console.log('=========== ' + N + ' HAFTALIK KALITE RAPORU ===========');
  console.log('');
  console.log('1) KAPSAMA');
  console.log('   raporlanan acik noktasi : ' + T.kapsama + '  (haftada ~' + (T.kapsama/N).toFixed(1) + ')');
  console.log('   toplam bos saat         : ' + T.kapsamaSaat + ' saat  (haftada ~' + (T.kapsamaSaat/N).toFixed(1) + ' saat)');
  console.log('');
  console.log('2) SAAT (kotaya gore eksik calisma)');
  console.log('   toplam eksik : ' + T.saatEksik.toFixed(1) + ' saat  (haftada ~' + (T.saatEksik/N).toFixed(1) + ' saat)');
  console.log('');
  console.log('3) DINLENME — kapanis yapip ertesi sabah aciliса gelen');
  console.log('   vaka sayisi : ' + T.clopening.length + '  (haftada ~' + (T.clopening.length/N).toFixed(1) + ')');
  T.clopening.slice(0,10).forEach(x=>console.log('      ! ' + x));
  if(T.clopening.length>10) console.log('      ... +' + (T.clopening.length-10));
  console.log('');
  console.log('4) ADALET — ' + N + ' haftada kapanis / Pazar sayilari');
  console.log('   Kisi           kapanis   Pazar');
  Object.keys(T.kapanis).sort((a,b)=>T.kapanis[b]-T.kapanis[a]).forEach(n=>{
    console.log('   ' + n.split(' ')[0].padEnd(13) + String(T.kapanis[n]).padStart(5) + String(T.pazar[n]||0).padStart(8));
  });
  const vals = Object.values(T.kapanis);
  console.log('   --> en cok ' + Math.max(...vals) + ' / en az ' + Math.min(...vals) + ' kapanis  (fark ' + (Math.max(...vals)-Math.min(...vals)) + ')');
  console.log('');
  console.log('5) SUREKLILIK — kisi basi FARKLI vardiya saati sayisi (hafta ici)');
  console.log('   (1-2 iyi, 4+ = her gun baska saat, personel sasirir)');
  Object.entries(T.desen).map(([n,arr])=>[n, (arr.reduce((a,b)=>a+b,0)/arr.length)])
    .sort((a,b)=>b[1]-a[1]).forEach(([n,ort])=>{
      const bolgeSay = T.bolge[n].size;
      console.log('   ' + n.split(' ')[0].padEnd(13) + 'ort ' + ort.toFixed(1) + ' farkli saat   ' +
                  bolgeSay + ' farkli bolum' + (ort>=4?'   <-- COK DEGISKEN':''));
    });
})();
