(async () => {
  await new Promise(r=>setTimeout(r,80));

  // Karakter genisligini gercekci taklit et (Georgia bold ~0.56, monospace 0.6, system-ui ~0.55)
  const olc = (font, s) => {
    const m = /(\d+(?:\.\d+)?)px\s+([^,]+)/.exec(font) || [];
    const fs = parseFloat(m[1]||12), aile = (m[2]||'').trim();
    const kat = aile.includes('Georgia') ? 0.58 : aile.includes('monospace') ? 0.60 : 0.56;
    return String(s).length * fs * kat;
  };

  const yazilar = [];   // {x, genislik, metin, hizalama}
  let suFont = '12px system-ui', suHiza = 'left';
  const ctxStub = new Proxy({}, {
    get(t,k){
      if(k==='measureText') return s => ({ width: olc(suFont, s) });
      if(k==='fillText') return (s,x,y) => yazilar.push({s:String(s), x, y, w:olc(suFont,s), hiza:suHiza});
      if(k==='font') return suFont;
      if(k==='textAlign') return suHiza;
      if(['scale','fillRect','beginPath','moveTo','lineTo','stroke','fill','arcTo','closePath','arc'].includes(k)) return ()=>{};
      return undefined;
    },
    set(t,k,v){ if(k==='font') suFont=v; if(k==='textAlign') suHiza=v; return true; }
  });
  let W=0;
  document.createElement = (tag)=>{
    if(tag==='canvas') return { set width(v){W=v/2;}, set height(v){}, getContext(){return ctxStub;}, toDataURL(){return 'data:,';} };
    return { style:{}, set href(v){}, set download(v){}, click(){} };
  };

  currentMonday = new Date(2026,7,24);
  if(typeof haftayaGoreKadroyuTazele==='function') haftayaGoreKadroyuTazele();
  await loadWeek(); ensureWeekPeople();
  yazilar.length = 0;
  exportPng();

  const pad0=18, dayColW=120, empColW=118, supColW=150;
  const gridLeft=pad0, sag = W - pad0;
  let tasan = [];
  const ustBaslikY = 18 + 50;   // baslik satiri tablo disinda, sayilmaz
  yazilar.filter(y=>y.y > ustBaslikY).forEach(y=>{
    const sol = y.hiza==='center' ? y.x - y.w/2 : y.hiza==='right' ? y.x - y.w : y.x;
    const sagK = sol + y.w;
    // gun sutunundaki yazilar
    if(y.hiza==='left' && sol < gridLeft + dayColW && sagK > gridLeft + dayColW - 2)
      tasan.push('GUN SUTUNU: "'+y.s+'" ('+y.w.toFixed(0)+'px, sinir '+(dayColW-6)+'px)');
    // sayfa disina tasma
    if(sagK > sag + 1 || sol < pad0 - 1)
      tasan.push('SAYFA DISI: "'+y.s+'"');
  });

  console.log('Goruntu genisligi :', W, 'px');
  console.log('Cizilen yazi      :', yazilar.length);
  console.log('');
  if(tasan.length){
    console.log('TASAN YAZILAR (' + tasan.length + '):');
    [...new Set(tasan)].slice(0,12).forEach(x=>console.log('   ! ' + x));
  } else {
    console.log('>>> TASMA YOK — butun yazilar sutunlarina siginiyor');
  }
  console.log('');
  console.log('Gun sutunundaki yazilar:');
  yazilar.filter(y=>y.y > ustBaslikY && y.hiza==='left' && y.x < gridLeft+dayColW).slice(0,9)
    .forEach(y=>console.log('   "' + y.s + '"  ' + y.w.toFixed(0) + 'px / ' + (dayColW-10) + 'px'));
})();
