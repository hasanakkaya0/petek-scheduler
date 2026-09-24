(async () => {
  await new Promise(r=>setTimeout(r,80));
  const gec=[],kal=[]; const K=(a,s)=>(s?gec:kal).push(a);
  global.confirm = ()=>true; global.alert = ()=>{};

  const git = async (y,m,d)=>{ currentMonday=new Date(y,m-1,d); haftayaGoreKadroyuTazele(); await loadWeek(); ensureWeekPeople(); };

  // Test icin gecici bir kisi olustur ve birkac haftaya vardiya yaz
  const AD = 'Silinecek Kisi';
  PEOPLE.push({name:AD, hasRow:true, type:'Tam zamanlı', hours:9, primary:['KASA'], backup:[], sup:false});
  ledger.push({id:'t1', name:AD, date:'2026-08-01', hours:2, note:'test', ts:Date.now()});
  rebuildPeople();

  const haftalar=[[2026,7,17],[2026,7,24],[2026,8,3]];
  for(const [y,m,d] of haftalar){
    await git(y,m,d);
    const k=fmtDate(currentMonday);
    weekData.days[k].assignments[AD]={leave:'NONE',start:'09:00',end:'18:00',zone:'KASA'};
    weekData.days[k].sup = AD;
    await store.set('week:'+k, JSON.stringify(weekData));
  }
  console.log('Hazirlik: 3 haftaya vardiya + sorumlu + 1 ledger kaydi yazildi');

  // --- TAMAMEN SIL ---
  await git(2026,8,24);
  const sonuc = await personeliTamamenSil(AD);
  console.log('');
  console.log('Silme sonucu:', JSON.stringify(sonuc));
  console.log('');

  K('PEOPLE listesinden cikti', !PEOPLE.some(p=>p.name===AD));
  K('ledger kaydi silindi', !ledger.some(e=>e.name===AD));
  K('etkilenen hafta bulundu (>=3)', sonuc.etkilenenHafta >= 3);

  // Gecmis haftalari tek tek dogrula
  let kalanAtama=0, kalanSup=0;
  for(const k of await store.listKeys('week:')){
    const r=await store.get(k); if(!r||!r.value) continue;
    const wd=JSON.parse(r.value);
    for(const gk in (wd.days||{})){
      if(wd.days[gk].assignments && (AD in wd.days[gk].assignments)) kalanAtama++;
      if(wd.days[gk].sup===AD) kalanSup++;
    }
  }
  K('GECMIS haftalarda hic atama kalmadi', kalanAtama===0);
  K('GECMIS haftalarda sorumlu atamasi kalmadi', kalanSup===0);

  // --- Ayrilan kisi ana listede gorunmemeli ---
  const ayr = PEOPLE.find(p=>p.hasRow!==false);
  ayr.endWeek = fmtDate(addDays(currentMonday,-7));
  const ayrilanlar = PEOPLE.filter(p=>p.endWeek);
  const aktifler = PEOPLE.filter(p=>!p.endWeek);
  K('ayrilan kisi ANA listeden ayrildi', ayrilanlar.length===1 && !aktifler.includes(ayr));
  K('ayrilan kisi PEOPLE icinde duruyor (gecmis icin)', PEOPLE.includes(ayr));
  delete ayr.endWeek;

  console.log('=== PERSONEL SILME TESTI ===');
  gec.forEach(x=>console.log('  [GECTI] '+x));
  kal.forEach(x=>console.log('  [KALDI] '+x));
  console.log('');
  console.log('  '+gec.length+' gecti, '+kal.length+' kaldi');
})();
