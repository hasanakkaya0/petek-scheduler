/* ============================================================
   GORSEL (PNG) — UZUN YAZILAR KESILMEZ, IKI SATIRA BOLUNUR
   Sikayet: "Kişi F Han…", "Kişi Mnur H.", "Mağaza sor…" kesiliyordu. Cozum: isimler,
   bolum adlari ve aksam sorumlusu sigmazsa IKI SATIRA bolunur (yazi KUCULTULMEZ);
   aksam sorumlusu sutunu 150 -> 100 px. Bkz. js/export-png.js (satirlaraBol, satirlariYaz)
   Uydurma isimler kullanilir (bu dosya herkese acik depoya gider).
   ============================================================ */
(async () => {
  await new Promise(r => setTimeout(r, 80));
  let gecen = 0, kalan = 0;
  const K = (ad, sart) => { if(sart){ gecen++; console.log('  [GECTI] ' + ad); } else { kalan++; console.log('  [KALDI] ' + ad); } };

  // Gercekci karakter genisligi (Georgia 0.58, monospace 0.60, system-ui 0.56)
  const olc = (font, s) => {
    const m = /(\d+(?:\.\d+)?)px\s+([^,]+)/.exec(font) || [];
    const fs = parseFloat(m[1] || 12), aile = (m[2] || '').trim();
    return String(s).length * fs * (aile.includes('Georgia') ? 0.58 : aile.includes('monospace') ? 0.60 : 0.56);
  };
  const yazilar = [];
  let suFont = '12px system-ui', suHiza = 'left';
  const ctxStub = new Proxy({}, {
    get(t, k){
      if(k === 'measureText') return s => ({width: olc(suFont, s)});
      if(k === 'fillText') return (s, x, y) => yazilar.push({s: String(s), x, y, w: olc(suFont, s), hiza: suHiza, font: suFont});
      if(['scale','fillRect','beginPath','moveTo','lineTo','stroke','fill','arcTo','closePath','arc'].includes(k)) return () => {};
      return undefined;
    },
    set(t, k, v){ if(k === 'font') suFont = v; if(k === 'textAlign') suHiza = v; return true; }
  });
  let W = 0;
  document.createElement = tag => tag === 'canvas'
    ? {set width(v){ W = v / 2; }, set height(v){}, getContext(){ return ctxStub; }, toDataURL(){ return 'data:,'; }}
    : {style: {}, set href(v){}, set download(v){}, click(){}};

  // --- Uydurma kadro: uzun isimler + uzun bolum adi + iki kelimeli aksam sorumlusu ---
  currentMonday = new Date(2031, 0, 6);
  ornekVeriyiKur();
  PEOPLE.push({name: 'Zeynepnur Hanım', hasRow: true, type: 'Tam zamanlı', hours: 10, primary: ['KASA'], backup: [], sup: false});
  PEOPLE.push({name: 'Kerem Bey', hasRow: true, type: 'Tam zamanlı', hours: 10, primary: ['KASA'], backup: [], sup: false});
  ZONES.push({id: 'MAGAZA_SORUMLUSU', label: 'Mağaza sorumlusu', color: '#7B2D3B'}); rebuildZones();
  rebuildPeople();
  haftayaGoreKadroyuTazele();
  await loadWeek(); ensureWeekPeople();
  const pzt = fmtDate(currentMonday);
  weekData.days[pzt].assignments['Zeynepnur Hanım'] = {leave: 'NONE', start: '09:00', end: '19:00', zone: 'MAGAZA_SORUMLUSU',
    blocks: [{start: '16:00', end: '19:00', zone: 'MAGAZA_SORUMLUSU'}]};
  weekData.days[pzt].assignments['Kerem Bey'] = {leave: 'NONE', start: '11:00', end: '21:00', zone: 'KASA'};
  weekData.days[pzt].sup = 'Selim Aydın';

  yazilar.length = 0;
  exportPng();

  const pad0 = 18, dayColW = 120, empColW = 118, supColW = 100, gridLeft = pad0;
  const supX = gridLeft + dayColW + ROSTER.length * empColW;
  const metinler = yazilar.map(y => y.s);

  K('gorsel genisligi: aksam sorumlusu sutunu 100 px (toplam ' + W + ')', W === pad0 * 2 + dayColW + ROSTER.length * empColW + supColW);
  K('HICBIR yazi kisaltilmadi (… yok)', !metinler.some(s => s.includes('…')));

  // isimler
  K('uzun isim IKI SATIRA bolundu: "Zeynepnur" ve "Hanım" ayri', metinler.includes('Zeynepnur') && metinler.filter(s => s === 'Hanım').length >= 1);
  K('uzun isim tek satir olarak cizilmedi', !metinler.includes('Zeynepnur Hanım'));
  K('kisa isim tek satir kaldi ("Kerem Bey")', metinler.includes('Kerem Bey'));

  // bolum seridi
  K('uzun bolum adi (renkli serit) iki satir: "Mağaza" / "sorumlusu"', metinler.includes('Mağaza') && metinler.includes('sorumlusu') && !yazilar.some(y => y.s === 'Mağaza sorumlusu' && /12.5px/.test(y.font)));
  const sorumlusuY = yazilar.find(y => y.s === 'sorumlusu' && y.y > 100).y;
  const saatY = yazilar.find(y => y.s === '09:00–19:00').y;
  K('iki satirlik seridin alt satiri saat yazisina binmiyor (' + (saatY - sorumlusuY).toFixed(0) + ' px bosluk)', saatY - sorumlusuY >= 14);
  K('kisa bolum adi tek satir ("Kasa")', metinler.includes('Kasa'));
  K('gorev degisimi satiri bolum adini tam yaziyor', metinler.some(s => s.startsWith('Mağaza sorumlusu')) || metinler.some(s => s === 'Mağaza sorumlusu'));

  // aksam sorumlusu
  K('baslik iki satir: "Akşam" / "Sorumlusu"', metinler.includes('Akşam') && metinler.includes('Sorumlusu') && !metinler.includes('Akşam Sorumlusu'));
  K('sorumlu ismi iki satir: "Selim" / "Aydın"', metinler.includes('Selim') && metinler.includes('Aydın') && !metinler.includes('Selim Aydın'));

  // hicbir yazi kendi sutununa sigmaz durumda degil
  const tasan = [];
  yazilar.filter(y => y.y > 70 && y.hiza === 'center').forEach(y => {
    const sol = y.x - y.w / 2, sag = y.x + y.w / 2;
    if(y.x > supX){ if(sol < supX + 1 || sag > supX + supColW - 1) tasan.push('SORUMLU SUTUNU: "' + y.s + '" ' + y.w.toFixed(0) + 'px'); }
    else if(y.x > gridLeft + dayColW){
      const i = Math.floor((y.x - gridLeft - dayColW) / empColW), cs = gridLeft + dayColW + i * empColW;
      if(sol < cs + 1 || sag > cs + empColW - 1) tasan.push('PERSONEL SUTUNU: "' + y.s + '" ' + y.w.toFixed(0) + 'px');
    }
  });
  K('hicbir yazi sutununa tasmiyor' + (tasan.length ? ' → ' + [...new Set(tasan)].slice(0, 5).join('; ') : ''), tasan.length === 0);
  K('ana yazilar kucultulmedi: isim 15px, saat 16px, bolum adi 12.5px',
    yazilar.some(y => y.s === 'Zeynepnur' && /700 15px/.test(y.font)) && yazilar.some(y => y.s === '09:00–19:00' && /700 16px/.test(y.font))
    && yazilar.some(y => y.s === 'Mağaza' && /700 12\.5px/.test(y.font)));

  console.log('');
  console.log('  Sonuc: ' + gecen + ' gecti, ' + kalan + ' kaldi');
})();
