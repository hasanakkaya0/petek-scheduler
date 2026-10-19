/* ============================================================
   SEKME TESTI — Cizelge / Sayaclar / Ayarlar
   Paneller silinmez, sadece gizlenir; her panel bir sekmeye bagli
   olmali ve sekme degisince dogru paneller gorunmeli.
   ============================================================ */
(async () => {
  await new Promise(r => setTimeout(r, 80));
  let gecen = 0, kalan = 0;
  const K = (ad, sart) => { if(sart){ gecen++; console.log('  [GECTI] ' + ad); } else { kalan++; console.log('  [KALDI] ' + ad); } };

  const fs = require('fs'), path = require('path');
  const idx = fs.readFileSync(path.join(process.env.APPDIR, 'index.html'), 'utf8');

  // --- Kaynak: her panel bir sekmeye bagli ---
  const paneller = [...idx.matchAll(/<div class="panel"([^>]*)>\s*<h2>([^<]*)<\/h2>/g)];
  K('8 panel var (' + paneller.length + ')', paneller.length === 8);
  K('hicbir panel sekmesiz kalmadi', paneller.every(m => /data-sekme="(cizelge|sayac|ayar)"/.test(m[1])));
  const dagilim = {};
  paneller.forEach(m => { const t = m[1].match(/data-sekme="(\w+)"/)[1]; (dagilim[t] ||= []).push(m[2]); });
  K('Cizelge: Haftalik cizelge + Kapsama kontrolu',
    JSON.stringify(dagilim.cizelge) === JSON.stringify(['Haftalık çizelge', 'Kapsama kontrolü']));
  K('Sayaclar: Borc/Alacak + Yillik izin',
    JSON.stringify(dagilim.sayac) === JSON.stringify(['Borç / Alacak Sayacı', 'Yıllık İzin Sayacı']));
  K('Ayarlar: Personel, Bolumler, Kurallar, Dukkan saatleri',
    JSON.stringify(dagilim.ayar) === JSON.stringify(['Personel ve yetkiler', 'Bölümler', 'Kapsama kuralları', 'Dükkân saatleri']));
  K('uc sekme dugmesi var', (idx.match(/data-sekme-sec="/g) || []).length === 3);
  K('bolum renk cubugu Cizelge sekmesinde', /id="spineLegend" data-sekme="cizelge"/.test(idx));
  K('panel basliklarinda eski numara rozeti kalmadi', !/<h2><span class="n">/.test(idx));
  K('sekmeler.js storage.js\'ten sonra yukleniyor',
    idx.indexOf('js/storage.js') > 0 && idx.indexOf('js/sekmeler.js') > idx.indexOf('js/storage.js'));

  // --- Davranis: sahte ogelerle sekme degistir ---
  const mk = (oz, deger) => { const sinif = new Set(); return { dataset: oz, classList: {
      toggle(c, v){ if(v) sinif.add(c); else sinif.delete(c); }, contains: c => sinif.has(c) },
      setAttribute(){}, gizli(){ return sinif.has('sekme-gizli'); }, aktif(){ return sinif.has('aktif'); } }; };
  const p1 = mk({sekme: 'cizelge'}), p2 = mk({sekme: 'sayac'}), p3 = mk({sekme: 'ayar'});
  const b1 = mk({sekmeSec: 'cizelge'}), b2 = mk({sekmeSec: 'sayac'}), b3 = mk({sekmeSec: 'ayar'});
  const eskiQSA = document.querySelectorAll;
  document.querySelectorAll = sel => sel === '[data-sekme]' ? [p1, p2, p3] : (sel === '[data-sekme-sec]' ? [b1, b2, b3] : []);

  sekmeSec('sayac', false);
  K('Sayaclar secilince yalniz sayac paneli gorunur', p1.gizli() && !p2.gizli() && p3.gizli());
  K('Sayaclar dugmesi aktif', !b1.aktif() && b2.aktif() && !b3.aktif());
  sekmeSec('ayar', false);
  K('Ayarlar secilince yalniz ayar paneli gorunur', p1.gizli() && p2.gizli() && !p3.gizli());
  sekmeSec('bozuk-ad', false);
  K('gecersiz ad Cizelge\'ye doner', !p1.gizli() && p2.gizli() && p3.gizli() && aktifSekme === 'cizelge');
  document.querySelectorAll = eskiQSA;

  // --- Gizli paneller arka planda calismaya devam ediyor (veri hesabi sekmeye bagli degil) ---
  currentMonday = new Date(2026, 9, 12);
  await loadWeek(); ensureWeekPeople();
  let hata = null;
  try{ renderGrid(); renderValidation(); await renderLedger(); await renderYillikIzin(); }catch(e){ hata = e.message; }
  K('paneller gizliyken de cizim/hesap hatasiz calisiyor' + (hata ? ' (' + hata + ')' : ''), !hata);

  console.log('');
  console.log('  Sonuc: ' + gecen + ' gecti, ' + kalan + ' kaldi');
})();
