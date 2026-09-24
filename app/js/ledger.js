/* =====================================================================
   BORC / ALACAK SAYACI
   Bu dosya, 6 numarali panelin tamamini icerir.

   NOT: Bu dosya index.html ana kodundan ONCE yuklenir.
        Yuklendiginde sadece butonlarin tiklama baglantilarini kurar;
        hesaplama ancak ekran cizilirken calisir.
===================================================================== */
/* ---------------------------------------------------------------------
   Borç / Alacak Sayacı
   Her personelin günlük saat kotasının (p.hours) üstünde/altında çalıştığı
   saatler haftadan haftaya birikir: pozitif = şirket personele borçlu,
   negatif = personel şirkete borçlu. İki durum NÖTR sayılır (bakiyeyi
   etkilemez) çünkü ikisi de aynı Pazar telafisi mekanizmasının sonucudur —
   dükkânın Pazar günü kısa açık olmasından kaynaklanır:
     1) 10 saatçilerde Pazar'ın kendisi doğal olarak kısa kalır (dükkan 9 saat).
     2) 9 saatçilerde bu, hafta içi bir güne "sundayComp" bayrağıyla taşınır.
   Kişisel erken çıkışlar (sundayComp'suz "early") ve her türlü başka
   fazla/eksik çalışma tam olarak bakiyeye işlenir. Elle girilen "ledger"
   hareketleri buna eklenir/çıkarılır.

   BORÇ İZNİ: bir gün "Borç izni" olarak işaretlenirse (js/generator.js,
   js/utils.js isManualLeave) kişi o gün çalışmaz ama o günün kotası (-p.hours)
   otomatik olarak "auto" bakiyesine yazılır — elle ledger kaydı gerekmez.
--------------------------------------------------------------------- */
function parseWeekKeyDate(dateStr){
  const parts = dateStr.split('-').map(Number);
  return new Date(parts[0], parts[1]-1, parts[2]);
}

// Kayıtlı bir haftanın (herhangi bir hafta, mevcut weekData olmak zorunda değil)
// her personel için oto fark toplamı. wd: {days:{'YYYY-MM-DD':{assignments,...}}}
function autoDiffForStoredWeek(wd, monday){
  const diffs = {};
  ROSTER.forEach(p => { if(p.hours) diffs[p.name] = 0; });
  if(!wd || !wd.days) return diffs;
  for(let i=0;i<7;i++){
    const dObj = addDays(monday, i);
    const key = fmtDate(dObj);
    const day = wd.days[key];
    if(!day || !day.assignments) continue;
    const oh = (day.customHours && day.customHours.open && day.customHours.close) ? day.customHours : dowDefaultHours(dObj);
    const spanH = (toMin(oh.close) - toMin(oh.open)) / 60;
    ROSTER.forEach(p => {
      if(!p.hours) return;
      const a = day.assignments[p.name];
      // Borç izni: kişi çalışmıyor ama o günün kotası borcuna yazılır (bakiye
      // eksilir) — "borç alıp izin kullandı" demek, sonra fazla mesaiyle kapanır.
      if(a && a.leave === 'BORC'){ diffs[p.name] -= p.hours; return; }
      if(!isWorking(a)) return;
      if(a.sundayComp) return;   // Pazar telafisi kaynaklı kısıntı — nötr
      const dur = (toMin(a.end) - toMin(a.start)) / 60;
      const coversWholeDay = toMin(a.start) <= toMin(oh.open) && toMin(a.end) >= toMin(oh.close);
      if(coversWholeDay && spanH < p.hours) return;   // dükkan saatinden kaynaklı kısa gün (ör. Pazar) — nötr
      diffs[p.name] += (dur - p.hours);
    });
  }
  return diffs;
}

// Tüm kayıtlı haftaları (store'dan) + elle girilen hareketleri toplayıp
// her personel için {thisWeek, auto, manual, total} döner.
async function computeAllBalances(){
  const result = {};
  ROSTER.forEach(p => { if(p.hours) result[p.name] = {thisWeek:0, auto:0, manual:0, total:0}; });

  if(weekData){
    const wDiff = autoDiffForStoredWeek(weekData, currentMonday);
    for(const name in wDiff){ if(result[name]) result[name].thisWeek = wDiff[name]; }
  }

  const curKey = 'week:' + fmtDate(currentMonday);
  const weekKeys = await store.listKeys('week:');
  const allKeys = new Set(weekKeys);
  allKeys.add(curKey);   // henüz hiç kaydedilmemiş/kayıt kapalıysa bile mevcut hafta canlı sayılsın
  for(const k of allKeys){
    let wd;
    if(k === curKey && weekData){
      wd = weekData;
    } else {
      const r = await store.get(k);
      if(!r || !r.value) continue;
      try{ wd = JSON.parse(r.value); }catch(e){ continue; }
    }
    const monday = parseWeekKeyDate(k.slice(5));
    const diffs = autoDiffForStoredWeek(wd, monday);
    for(const name in diffs){ if(result[name]) result[name].auto += diffs[name]; }
  }

  ledger.forEach(e => { if(result[e.name]) result[e.name].manual += (Number(e.hours) || 0); });
  for(const name in result){ result[name].total = result[name].auto + result[name].manual; }
  return result;
}

function fmtBal(n){
  const r = Math.round(n * 10) / 10;
  const s = (r % 1 === 0) ? String(r) : r.toFixed(1);
  return (r > 0 ? '+' + s : s);
}
function balClass(n){ return n > 0.05 ? 'pos' : (n < -0.05 ? 'neg' : 'zero'); }
function balWord(n){ return n > 0.05 ? 'şirket borçlu' : (n < -0.05 ? 'personel borçlu' : 'eşit'); }

// Haftalık çizelgenin alt toplam satırındaki küçük bakiye rozetlerini,
// tabloyu yeniden çizmeden yalnızca metin olarak günceller.
function paintBalanceBadges(){
  document.querySelectorAll('.balbadge').forEach(el => {
    const name = el.dataset.name;
    const b = balanceCache[name];
    if(!b) return;
    const txt = el.querySelector('.baltxt');
    if(txt){ txt.textContent = fmtBal(b.total) + ' sa'; txt.className = 'baltxt ' + balClass(b.total); }
  });
}

function renderLedgerPanel(){
  const t = document.getElementById('ledgerTable');
  if(!t) return;
  const people = ROSTER.filter(p => p.hours);
  t.innerHTML = `<thead><tr>
      <th class="corner">Personel</th>
      <th>Bu haftaki fark</th>
      <th>Otomatik toplam</th>
      <th>Manuel toplam</th>
      <th>Genel bakiye</th>
    </tr></thead><tbody>` +
    people.map(p => {
      const b = balanceCache[p.name] || {thisWeek:0, auto:0, manual:0, total:0};
      return `<tr>
        <td class="pcell"><b>${p.name}</b></td>
        <td class="pcell">${fmtBal(b.thisWeek)} sa</td>
        <td class="pcell">${fmtBal(b.auto)} sa</td>
        <td class="pcell">${fmtBal(b.manual)} sa</td>
        <td class="pcell"><span class="baltag ${balClass(b.total)}">${fmtBal(b.total)} sa</span>
          <span style="color:var(--ink-soft); font-size:10.5px;"> (${balWord(b.total)})</span></td>
      </tr>`;
    }).join('') + `</tbody>`;

  const hist = document.getElementById('ledgerHistory');
  if(!hist) return;
  const entries = ledger.slice().sort((a,b) => (b.date||'').localeCompare(a.date||'') || (b.ts||0)-(a.ts||0));
  hist.innerHTML = entries.length ? entries.map(e => `
    <div class="ledger-hist-row">
      <span class="lh-date">${e.date || '—'}</span>
      <span class="lh-name">${e.name}</span>
      <span class="lh-hours ${balClass(Number(e.hours)||0)}">${fmtBal(Number(e.hours)||0)} sa</span>
      <span class="lh-note">${e.note ? String(e.note).replace(/</g,'&lt;') : ''}</span>
      <button class="blk-del" data-id="${e.id}" title="Sil">✕</button>
    </div>`).join('')
    : `<div class="hint" style="margin:0;">Henüz manuel düzeltme eklenmedi.</div>`;

  hist.querySelectorAll('button.blk-del').forEach(b => {
    b.addEventListener('click', async () => {
      const id = b.dataset.id;
      const e = ledger.find(x => x.id === id);
      if(!e) return;
      if(!confirm(`${e.name} — ${e.date || '—'} tarihli ${fmtBal(Number(e.hours)||0)} saatlik hareket silinsin mi?`)) return;
      ledger = ledger.filter(x => x.id !== id);
      await saveSettings();
      renderLedger();
    });
  });
}

// Bakiye hesabı depolamadan okuma yaptığı için biraz sürer. Bu sırada yeni bir
// yenileme isteği gelirse (ör. hafta oklarına hızlı basılırsa) ESKİDEN sessizce
// düşürülüyordu ve panelde eski rakamlar kalıyordu. Artık istek düşürülmüyor:
// sıraya alınıyor ve mevcut hesap biter bitmez bir kez daha çalıştırılıyor.
// Böylece ekranda her zaman EN SON haftanın rakamları görünür.
let ledgerBusy = false, ledgerPending = false;
async function renderLedger(){
  if(ledgerBusy){ ledgerPending = true; return; }   // çalışıyor — sıraya al
  ledgerBusy = true;
  try{
    do {
      ledgerPending = false;
      try{ balanceCache = await computeAllBalances(); }
      catch(e){ /* sessiz geç — bakiye geçici olarak eski kalır */ }
      paintBalanceBadges();
      renderLedgerPanel();
    } while(ledgerPending);      // beklerken yeni istek geldiyse tekrar hesapla
  } finally {
    ledgerBusy = false;          // hata olsa bile kilit mutlaka açılsın
  }
}

function openLedgerEditor(){
  const sel = document.getElementById('lgName');
  sel.innerHTML = ROSTER.filter(p => p.hours).map(p => `<option value="${p.name}">${p.name}</option>`).join('');
  document.getElementById('lgDate').value = fmtDate(new Date());
  document.getElementById('lgHours').value = '';
  document.getElementById('lgNote').value = '';
  document.getElementById('ledgerOverlay').classList.add('show');
}
document.getElementById('btnAddLedger').addEventListener('click', openLedgerEditor);
document.getElementById('lgCancel').addEventListener('click', () => document.getElementById('ledgerOverlay').classList.remove('show'));
document.getElementById('ledgerOverlay').addEventListener('click', e => { if(e.target.id==='ledgerOverlay') e.currentTarget.classList.remove('show'); });

document.getElementById('lgSave').addEventListener('click', async () => {
  const name = document.getElementById('lgName').value;
  const date = document.getElementById('lgDate').value;
  const hoursVal = document.getElementById('lgHours').value;
  const note = document.getElementById('lgNote').value.trim();
  if(!name){ alert('Personel seçmelisin.'); return; }
  if(!date){ alert('Tarih seçmelisin.'); return; }
  const hours = Number(hoursVal);
  if(hoursVal === '' || isNaN(hours) || hours === 0){ alert('Saat 0 olamaz (pozitif = şirket borçlu, negatif = personel borçlu).'); return; }
  ledger.push({id: 'lg_' + Date.now() + '_' + Math.random().toString(36).slice(2,7), name, date, hours, note, ts: Date.now()});
  await saveSettings();
  document.getElementById('ledgerOverlay').classList.remove('show');
  renderLedger();
});
