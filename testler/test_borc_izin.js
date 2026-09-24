/* ============================================================
   BORC IZNI TESTI
   "Borç izni" (BORC) — elle girilir, jeneratör dokunmaz; o günün
   kotası kişinin borç/alacak bakiyesinden düşülür (bakiye eksilir),
   haftalık izin yerine geçer (fazladan bir izin günü daha açılmaz).
   Bkz. js/utils.js (isOffLeave/isManualLeave), js/generator.js (debt),
   js/ledger.js (autoDiffForStoredWeek).
   ============================================================ */
(async () => {
  await new Promise(r => setTimeout(r, 80));
  currentMonday = new Date(2026, 7, 17);
  await loadWeek(); ensureWeekPeople();

  let gecen = 0, kalan = 0;
  const K = (ad, sart) => { if(sart){ gecen++; console.log('  [GECTI] ' + ad); } else { kalan++; console.log('  [KALDI] ' + ad); } };

  const gunler = [...Array(7)].map((_, i) => fmtDate(addDays(currentMonday, i)));
  const kisi = ROSTER.find(p => !isOnCall(p) && isFullTime(p) && p.hours && p.offDays == null);
  if(!kisi){ console.log('  [KALDI] uygun test kişisi bulunamadı'); console.log('\n  Sonuc: 0 gecti, 1 kaldi'); return; }

  // Temiz başlangıç: bu kişinin bu haftaki tüm günlerini boşalt
  gunler.forEach(k => { weekData.days[k].assignments[kisi.name] = blankAssignment(); });

  // Pazartesi'ye elle "Borç izni" yazılmış gibi davran, sonra haftayı oluştur
  weekData.days[gunler[0]].assignments[kisi.name] = {leave: 'BORC', start: null, end: null, zone: null, manual: true};
  const rapor = generateWeek();

  const a0 = weekData.days[gunler[0]].assignments[kisi.name];
  K(kisi.name + ' Pazartesi borç izni olarak korundu (jeneratör dokunmadı)', a0.leave === 'BORC');

  const izinliGunSayisi = gunler.filter(k => isOffLeave(weekData.days[k].assignments[kisi.name])).length;
  K('borç izni haftalık izin yerine geçti (fazladan izin günü açılmadı, toplam ' + izinliGunSayisi + ')', izinliGunSayisi === 1);

  const calisilan = gunler.filter(k => isWorking(weekData.days[k].assignments[kisi.name])).length;
  K(kisi.name + ' 6 gün çalışıyor (7 − 1 borç günü, ölçülen ' + calisilan + ')', calisilan === 6);

  const izinsizUyari = rapor.warnings.some(w => w.includes('İZİNSİZ ÇALIŞMA') && w.includes(kisi.name));
  K('izinsiz çalışma uyarısı yanlışlıkla tetiklenmedi', !izinsizUyari);

  // Borç/Alacak: o günün kotası otomatik olarak bakiyeden düşmeli (-p.hours),
  // kişi diğer günler tam kotasını çalıştığı için toplam katkı tam bu kadar olmalı.
  const diffs = autoDiffForStoredWeek(weekData, currentMonday);
  const beklenen = -kisi.hours;
  K('borç günü ledger\'a ' + beklenen + ' saat olarak yazıldı (ölçülen ' + diffs[kisi.name] + ')',
    Math.abs(diffs[kisi.name] - beklenen) < 0.01);

  // Kaynak kodu kontrolü — arayüzden seçilebiliyor mu + "Haftayı sıfırla" koruyor mu
  const fs = require('fs'), path = require('path');
  const APP = process.env.APPDIR;
  const idx = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
  K('hücre penceresinde "Borç izni" seçeneği var', /<option value="BORC">/.test(idx));
  K('"Haftayı sıfırla" borç iznini de koruyor (isManualLeave)',
    /btnReset'\)\.addEventListener[\s\S]{0,4000}?isManualLeave\(a\)/.test(idx));

  console.log('');
  console.log('  Sonuc: ' + gecen + ' gecti, ' + kalan + ' kaldi');
})();
