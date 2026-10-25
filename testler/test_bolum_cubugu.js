/* ============================================================
   BOLUM RENK CUBUGU (ustteki "Kasa, Kirtasiye, ..." serit) TESTI
   Hata: sonradan eklenen bolum ("Magaza sorumlusu") sayfa yenilenince cubukta GORUNMUYORDU,
   cunku cubuk yalnizca acilista (ayarlar yuklenmeden once) ve bolum eklerken cizilirdi.
   Bkz. index.html (renderAll -> renderLegend), js/render.js (renderLegend)
   ============================================================ */
(async () => {
  await new Promise(r => setTimeout(r, 80));
  let gecen = 0, kalan = 0;
  const K = (ad, sart) => { if(sart){ gecen++; console.log('  [GECTI] ' + ad); } else { kalan++; console.log('  [KALDI] ' + ad); } };

  const cubuk = {innerHTML: ''}, eskiGet = document.getElementById;
  document.getElementById = id => id === 'spineLegend' ? cubuk : eskiGet(id);

  // Acilista: varsayilan bolumlerle cizilir (ayarlar daha yuklenmedi)
  renderLegend();
  K('acilista varsayilan bolumler cizilir', /Kasa/.test(cubuk.innerHTML) && !/Mağaza sorumlusu/.test(cubuk.innerHTML));

  // Ayarlar yuklenince kayitli ozel bolum gelir
  ZONES.push({id: 'MAGAZA_SORUMLUSU', label: 'Mağaza sorumlusu', color: '#7B2D3B'}); rebuildZones();
  K('ayarlar yuklenince cubuk ESKI kalir (renderLegend cagrilmadi)', !/Mağaza sorumlusu/.test(cubuk.innerHTML));

  currentMonday = new Date(2031, 0, 6);
  await loadWeek(); ensureWeekPeople();
  renderAll();                               // init / uzak degisiklik / yedekten yukleme sonrasi hep bu cagrilir
  K('renderAll cubugu da gunceller: "Mağaza sorumlusu" gorunur', /Mağaza sorumlusu/.test(cubuk.innerHTML));
  K('cubuktaki bolum sayisi ZONES ile ayni', (cubuk.innerHTML.match(/class="spine"/g) || []).length === ZONES.length);

  // Bolum silinince de cubuktan kalkar
  ZONES = ZONES.filter(z => z.id !== 'MAGAZA_SORUMLUSU'); rebuildZones();
  renderAll();
  K('bolum silinip renderAll cagrilinca cubuktan kalkar', !/Mağaza sorumlusu/.test(cubuk.innerHTML));

  const fs = require('fs'), path = require('path');
  const idx = fs.readFileSync(path.join(process.env.APPDIR, 'index.html'), 'utf8');
  K('kaynak: renderAll icinde renderLegend var', /function renderAll\(\)\{\s*renderLegend\(\);/.test(idx));

  document.getElementById = eskiGet;
  console.log('');
  console.log('  Sonuc: ' + gecen + ' gecti, ' + kalan + ' kaldi');
})();
