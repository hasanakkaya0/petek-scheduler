(async () => {
  await new Promise(r=>setTimeout(r,80));

  // --- canvas taklidi: cizim cagrilarini sayar, olculeri yakalar ---
  let olcu = null, cagri = 0, yazilar = [], hata = null;
  const ctxStub = new Proxy({}, {
    get(t, k){
      if(k === 'measureText') return (s) => ({ width: String(s).length * 7 });
      if(k === 'fillText') return (s) => { cagri++; yazilar.push(String(s)); };
      if(k === 'canvas') return {};
      if(typeof k === 'string' && ['scale','fillRect','beginPath','moveTo','lineTo','stroke','fill','arcTo','closePath','save','restore'].includes(k))
        return () => { cagri++; };
      return undefined;
    },
    set(){ return true; }
  });
  document.createElement = (tag) => {
    if(tag === 'canvas') return {
      set width(v){ (olcu ||= {}).w = v; }, set height(v){ (olcu ||= {}).h = v; },
      getContext(){ return ctxStub; },
      toDataURL(){ return 'data:image/png;base64,STUB'; }
    };
    return { set href(v){}, set download(v){}, click(){}, style:{}, classList:{add(){},remove(){}} };
  };

  const dene = async (y,m,d) => {
    currentMonday = new Date(y,m-1,d);
    if(typeof haftayaGoreKadroyuTazele === 'function') haftayaGoreKadroyuTazele();
    await loadWeek(); ensureWeekPeople();
    olcu = null; cagri = 0; yazilar = []; hata = null;
    try{ exportPng(); }catch(e){ hata = e; }
    const w = olcu ? olcu.w/2 : 0, h = olcu ? olcu.h/2 : 0;
    console.log('  ' + fmtDate(currentMonday) + '  kadro ' + String(ROSTER.length).padStart(2) +
      '  ->  ' + (hata ? 'HATA: ' + hata.message
        : w + ' x ' + h + ' px  (en/boy ' + (w/h).toFixed(2) + ':1)  ' + cagri + ' cizim'));
    return {w, h, hata, yazilar};
  };

  console.log('=== GORSEL URETIMI (gercek 21 Agustos verisi) ===');
  const r1 = await dene(2026,8,17);
  const r2 = await dene(2026,8,24);
  const r3 = await dene(2026,8,31);
  const r4 = await dene(2026,7,20);

  console.log('');
  const gec=[],kal=[]; const K=(a,s)=>(s?gec:kal).push(a);
  K('hata olmadan calisti', !r1.hata && !r2.hata && !r3.hata && !r4.hata);
  K('gun isimleri ciziliyor', r1.yazilar.includes('Pazartesi') && r1.yazilar.includes('Pazar'));
  K('baslik var', r1.yazilar.some(x=>x.includes('Petek')));
  K('aksam sorumlusu basligi var (iki satir: Akşam / Sorumlusu)', r1.yazilar.includes('Akşam') && r1.yazilar.includes('Sorumlusu'));
  K('saat araliklari ciziliyor', r1.yazilar.some(x=>/^\d\d:\d\d–\d\d:\d\d$/.test(x)));
  K('bos kadroda cokmuyor', !r4.hata);

  console.log('=== SONUC ===');
  gec.forEach(x=>console.log('  [GECTI] '+x));
  kal.forEach(x=>console.log('  [KALDI] '+x));
  console.log('');
  console.log('  ' + gec.length + ' gecti, ' + kal.length + ' kaldi');
})();
