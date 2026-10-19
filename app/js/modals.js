/* =====================================================================
   DUZENLEME PENCERESI
   Cizelgede bir hucreye tiklayinca acilan tek gun duzenleyici.

   NOT: "Haftalik sablon" penceresi 15 Agustos 2026'da kaldirildi —
        otomatik olusturucu onu zaten eziyordu, iki sistem cakisiyordu.

   NOT: Bu dosya index.html ana kodundan ONCE yuklenir.
===================================================================== */
/* ---------------------------------------------------------------------
   Tek hücre düzenleyici
--------------------------------------------------------------------- */
function dayNameOf(dateStr){
  const dow = new Date(dateStr+'T00:00').getDay();
  return DAY_NAMES[dow===0?6:dow-1];
}
function openEditor(dateStr, name){
  editing = {dateStr, name};
  const a = weekData.days[dateStr].assignments[name];
  const person = ROSTER.find(p => p.name === name);

  document.getElementById('modalTitle').textContent = name;
  document.getElementById('modalSub').textContent = `${dateStr} — ${dayNameOf(dateStr)}`;

  document.getElementById('fLeave').value = a.leave;
  document.getElementById('fStart').value = a.start || '';
  document.getElementById('fEnd').value = a.end || '';
  // BOŞ hücre açılınca saatler boş gelmesin: kişinin günlük saatine göre önerilen vardiya
  // (dükkânın o günkü açılışından başlar, kapanışı aşmaz) doldurulur. İstenmezse değiştirilir;
  // ikisi de boşaltılıp Kaydet denirse hücre temizlenir.
  const oneri = document.getElementById('oneriNot');
  if(oneri) oneri.hidden = true;
  if(a.leave === 'NONE' && !a.start && !a.end && person){
    const s = makeShift(person, new Date(dateStr + 'T00:00'), 'open');
    document.getElementById('fStart').value = s.start;
    document.getElementById('fEnd').value = s.end;
    if(oneri) oneri.hidden = false;
  }

  const zoneSel = document.getElementById('fZone');
  zoneSel.innerHTML = ZONES.map(z => `<option value="${z.id}">${z.label}</option>`).join('');
  zoneSel.value = a.zone || person.primary[0];
  renderBlockRows(a.blocks || []);
  // Varsayılan SABİT (kullanıcı isteği, 15 Ağustos).
  // Mantık: kullanıcı bir hücreye elle giriyorsa bilerek giriyordur; girdiği
  // şeyin otomatik oluşturmada korunması beklenir. Serbest bırakmak isterse
  // açılan pencereden seçer.
  // Bu daha önce riskliydi çünkü sabitler görünmüyordu ve sessizce birikip
  // çizelgenin yeniden düzenlenmesini engelliyordu. Artık güvenli:
  //   - gezinme çubuğunda "📌 N sabit" sayacı hep görünür
  //   - sayaca tıklayınca hepsi tek tıkla serbest bırakılır
  //   - canlı durum paneli sabit birikince uyarı yazar
  //   - "Haftayı otomatik oluştur" sabit varsa "kaldırayım mı?" diye sorar
  document.getElementById('fLock').value = (a.manual === false) ? '0' : '1';

  toggleFieldsByLeave();
  document.getElementById('overlay').classList.add('show');
}
function renderBlockRows(blocks){
  const el = document.getElementById('blkList');
  const opts = ZONES.map(z => `<option value="${z.id}">${z.label}</option>`).join('');
  el.innerHTML = (blocks || []).map((b, idx) => `
    <div class="blk-row" data-i="${idx}">
      <input type="time" class="b-start" value="${b.start || ''}" />
      <input type="time" class="b-end" value="${b.end || ''}" />
      <select class="b-zone">${opts}</select>
      <button class="blk-del" data-i="${idx}">×</button>
    </div>`).join('');
  el.querySelectorAll('.blk-row').forEach(r => {
    r.querySelector('.b-zone').value = (blocks[r.dataset.i] || {}).zone || ZONES[0].id;
  });
  el.querySelectorAll('.blk-del').forEach(b => b.addEventListener('click', () => {
    const cur = currentBlocks(); cur.splice(Number(b.dataset.i), 1); renderBlockRows(cur);
  }));
}
function currentBlocks(){
  return [...document.querySelectorAll('#blkList .blk-row')].map(r => ({
    start: r.querySelector('.b-start').value,
    end: r.querySelector('.b-end').value,
    zone: r.querySelector('.b-zone').value,
  }));
}
document.getElementById('blkAdd').addEventListener('click', () => {
  const cur = currentBlocks();
  const a = weekData.days[editing.dateStr].assignments[editing.name];
  cur.push({start: a.end ? hhmm(Math.max(toMin(a.start), toMin(a.end) - 120)) : '19:00', end: a.end || '21:00', zone: ZONES[0].id});
  renderBlockRows(cur);
});

function toggleFieldsByLeave(){
  const leave = document.getElementById('fLeave').value;
  const show = leave === 'NONE';
  document.getElementById('timeFields').style.display = show ? 'grid' : 'none';
  document.getElementById('zoneField').style.display = show ? 'block' : 'none';
  document.getElementById('blockField').style.display = show ? 'block' : 'none';
}
document.getElementById('fLeave').addEventListener('change', toggleFieldsByLeave);
document.getElementById('btnCancel').addEventListener('click', () => document.getElementById('overlay').classList.remove('show'));
document.getElementById('overlay').addEventListener('click', e => { if(e.target.id==='overlay') e.currentTarget.classList.remove('show'); });

function hucreyiKaydet(){
  const {dateStr, name} = editing;
  const leave = document.getElementById('fLeave').value;
  let a;
  if(leave === 'NONE'){
    const bas = document.getElementById('fStart').value || null;
    const bit = document.getElementById('fEnd').value || null;
    if(!bas && !bit){
      // İkisi de boş = hücreyi TEMİZLE. (Eskiden boş bir "sabit" kayıt oluşuyordu: ekranda
      // görünmez, ama sabit sayılır ve otomatik oluşturma o günü kilitlerdi.)
      undoKaydet();
      weekData.days[dateStr].assignments[name] = blankAssignment();
      document.getElementById('overlay').classList.remove('show');
      renderGrid(); renderValidation(); scheduleSave();
      return;
    }
    if(!bas || !bit){ alert('Başlangıç ve bitiş saatinin ikisini de yaz (ya da ikisini de boş bırakıp hücreyi temizle).'); return; }
    if(toMin(bit) <= toMin(bas)){ alert('Bitiş saati başlangıçtan sonra olmalı.'); return; }
    const blocks = currentBlocks().filter(b => b.start && b.end && toMin(b.end) > toMin(b.start));
    a = {
      leave:'NONE',
      start: bas,
      end: bit,
      zone: document.getElementById('fZone').value,
    };
    if(blocks.length) a.blocks = blocks;
  } else {
    a = {leave, start:null, end:null, zone:null};
  }
  if(document.getElementById('fLock').value === '1') a.manual = true;
  undoKaydet();
  weekData.days[dateStr].assignments[name] = a;
  document.getElementById('overlay').classList.remove('show');
  renderGrid();
  renderValidation();
  scheduleSave();
}
document.getElementById('btnSave').addEventListener('click', hucreyiKaydet);

