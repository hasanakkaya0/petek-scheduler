/* =====================================================================
   AYAR PANELLERI — Personel, Bolum ve Kural yonetimi
   Programin 3, 4 ve 5 numarali panelleri.

     Personel yonetimi : kadroyu ekle/duzenle/sil, yetkiler, saatler
     Bolum (Zone)      : reyon/gorev listesi ve renkleri
     Kapsama kurali    : "ayni anda en az/en fazla kac kisi" kurallari

   NOT: Bu dosya index.html ana kodundan ONCE yuklenir.
        Yuklendiginde sadece butonlarin tiklama baglantilarini kurar.
===================================================================== */
/* ---------------------------------------------------------------------
   Personel yönetimi — kadro artık arayüzden düzenlenir
--------------------------------------------------------------------- */
let editingPerson = null;   // düzenlenen kişinin adı, yeni kişide null

function zoneLabels(ids){
  return (ids || []).map(id => ZONE_MAP[id] ? ZONE_MAP[id].label : id).join(', ') || '—';
}

function movePerson(name, dir){
  const i = PEOPLE.findIndex(x => x.name === name);
  if(i < 0) return;
  const j = i + dir;
  if(j < 0 || j >= PEOPLE.length) return;
  const tmp = PEOPLE[i]; PEOPLE[i] = PEOPLE[j]; PEOPLE[j] = tmp;
  rebuildPeople();
  saveSettings();
  renderPeople();
  renderGrid();
}

function personelSatiri(p, idx){
  const tags = [];
  if(p.sup) tags.push('<span class="ptag sup">akşam sorumlusu</span>');
  if(p.onCall) tags.push('<span class="ptag oncall">ihtiyaç halinde</span>');
  if(p.hasRow === false) tags.push('<span class="ptag">çizelgede yok</span>');
  if(p.startWeek) tags.push(`<span class="ptag">${p.startWeek} tarihinden itibaren</span>`);
  if(p.endWeek) tags.push(`<span class="ptag oncall">${p.endWeek} haftasında ayrıldı</span>`);
  /* "Bu hafta kadroda değil" — ileri tarihli startWeek'i olan kişi henüz
     işe başlamadığı için çizelgede çıkmaz, ama ayrılmış da değildir; bu yüzden
     ana listede durur. Uyarı olmazsa "niye çizelgede yok?" diye aranıyordu.
     (Refactor sırasında düşmüştü, geri kondu.) */
  if(typeof haftadaAktif === 'function' && !haftadaAktif(p) && !p.endWeek)
    tags.push('<span class="ptag oncall">bu hafta kadroda değil</span>');
  if(p.maxClose != null) tags.push(`<span class="ptag">en fazla ${p.maxClose} geç çıkış</span>`);
  if(p.earlyDays) tags.push(`<span class="ptag">${p.earlyDays} gün kapanışa kalmaz</span>`);
  if(p.offDays != null) tags.push(`<span class="ptag">haftada ${p.offDays} gün izin</span>`);
  if(p.prefOff === 'weekend') tags.push('<span class="ptag">izin: hafta sonu</span>');
  if(p.prefOff === 'weekend-alt') tags.push('<span class="ptag">izin: dönüşümlü hafta sonu</span>');
  if(p.prefOffDay != null) tags.push(`<span class="ptag">izin tercihi: ${['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'][p.prefOffDay]}</span>`);
  if(p.closeGroup) tags.push(`<span class="ptag">kapanış grubu: ${p.closeGroup}</span>`);
  if(p.weeklyMax != null) tags.push(`<span class="ptag">haftalık en fazla ${p.weeklyMax} sa</span>`);
  if(p.izinHakki != null) tags.push(`<span class="ptag">yıllık izin hakkı: ${p.izinHakki} gün</span>`);
  (p.dayBlocks || []).forEach(b => tags.push(`<span class="ptag">${b.start}–${b.end} ${ZONE_MAP[b.zone] ? ZONE_MAP[b.zone].label : b.zone}</span>`));
  const upDis = idx === 0 ? 'disabled' : '';
  const downDis = idx === PEOPLE.length - 1 ? 'disabled' : '';
  return `<tr>
    <td class="pcell ordcell">
      <button class="pmove" data-name="${p.name}" data-dir="-1" ${upDis} title="Yukarı">▲</button>
      <button class="pmove" data-name="${p.name}" data-dir="1" ${downDis} title="Aşağı">▼</button>
    </td>
    <td class="pcell"><b>${p.name}</b><br><span style="font-size:10.5px;color:var(--ink-soft)">${p.type}${p.hours ? ' · ' + p.hours + ' sa' : ''}</span></td>
    <td class="pcell">${zoneLabels(p.primary)}</td>
    <td class="pcell" style="color:var(--ink-soft)">${zoneLabels(p.backup)}</td>
    <td class="pcell">${tags.join(' ') || '—'}</td>
    <td class="pcell"><button class="pedit" data-name="${p.name}">düzenle</button>${p.endWeek
      ? ` <button class="pedit pyeniden" data-name="${p.name}" title="Ayrılma kaydını kaldırır; geçmişi aynı kayıtta devam eder">yeniden işe al</button> <button class="pedit pbirlestir" data-name="${p.name}" title="Aynı kişinin başka bir kaydıyla birleştir">birleştir…</button>` : ''}</td>
  </tr>`;
}

const PERSONEL_BASLIK = `<thead><tr>
    <th style="width:44px">Sıra</th>
    <th style="text-align:left">Kişi</th><th style="text-align:left">Ana görevler</th>
    <th style="text-align:left">Yedek görevler</th><th style="text-align:left">Özellikler</th><th></th>
  </tr></thead>`;

/* Ayrılan personel ANA LİSTEDE GÖRÜNMEZ (kullanıcı isteği: "işten çıkan
   personel 3. kısımda hep kalıyor, canımızı sıkıyor"). Ama silinmiyor da —
   geçmiş haftalardaki vardiyaları ve Borç/Alacak kayıtları onlara bağlı.
   Bu yüzden aşağıda katlanır bir "Ayrılan personel" bölümüne alınıyorlar;
   oradan görülebilir, düzenlenebilir, gerekirse tamamen silinebilir. */
function renderPeople(){
  const t = document.getElementById('peopleTable');
  const ayrilanMi = p => !!p.endWeek;

  const aktifler = [], ayrilanlar = [];
  PEOPLE.forEach((p, idx) => (ayrilanMi(p) ? ayrilanlar : aktifler).push({p, idx}));

  t.innerHTML = PERSONEL_BASLIK + '<tbody>'
    + aktifler.map(x => personelSatiri(x.p, x.idx)).join('') + '</tbody>';

  // Ayrılanlar — ana listenin altında, katlanmış halde
  const kutu = document.getElementById('ayrilanKutu');
  if(kutu){
    if(!ayrilanlar.length){ kutu.innerHTML = ''; }
    else {
      kutu.innerHTML = `<details class="ayrilan-det">
        <summary>Ayrılan personel (${ayrilanlar.length}) — geçmiş kayıtları için saklanıyor</summary>
        <div class="hint" style="margin:6px 0 10px;">
          Bu kişiler çizelgede görünmez ama <b>geçmiş haftalardaki vardiyaları ve
          Borç/Alacak kayıtları durur</b>. Tamamen kaldırmak istersen "düzenle" →
          <b>Tamamen sil</b>.
        </div>
        <div style="overflow-x:auto;"><table class="grid">${PERSONEL_BASLIK}<tbody>${
          ayrilanlar.map(x => personelSatiri(x.p, x.idx)).join('')}</tbody></table></div>
      </details>`;
    }
  }

  document.querySelectorAll('#peopleTable button.pedit, #ayrilanKutu button.pedit').forEach(b => {
    if(b.classList.contains('pyeniden') || b.classList.contains('pbirlestir')) return;   // bunları kisi-birlestir.js yönetir
    b.addEventListener('click', () => openPerson(b.dataset.name));
  });
  if(typeof KisiBirlestir !== 'undefined') KisiBirlestir.uyariCiz();      // "bunlar aynı kişi olabilir" uyarısı
  document.querySelectorAll('#peopleTable button.pmove, #ayrilanKutu button.pmove').forEach(b =>
    b.addEventListener('click', () => movePerson(b.dataset.name, Number(b.dataset.dir))));
}

function renderZoneChecks(containerId, selected){
  const el = document.getElementById(containerId);
  el.innerHTML = ZONES.map(z =>
    `<label><input type="checkbox" value="${z.id}" ${(selected || []).includes(z.id) ? 'checked' : ''}/> ${z.label}</label>`
  ).join('');
}
function readZoneChecks(containerId){
  return [...document.querySelectorAll(`#${containerId} input:checked`)].map(i => i.value);
}

function renderPersonBlocks(blocks){
  const el = document.getElementById('pBlocks');
  const opts = ZONES.map(z => `<option value="${z.id}">${z.label}</option>`).join('');
  el.innerHTML = (blocks || []).map((b, idx) => `
    <div class="blk-row" data-i="${idx}">
      <input type="time" class="pb-start" value="${b.start || ''}" />
      <input type="time" class="pb-end" value="${b.end || ''}" />
      <select class="pb-zone">${opts}</select>
      <button class="blk-del" data-i="${idx}">×</button>
    </div>`).join('');
  el.querySelectorAll('.blk-row').forEach(r => {
    r.querySelector('.pb-zone').value = (blocks[r.dataset.i] || {}).zone || ZONES[0].id;
  });
  el.querySelectorAll('.blk-del').forEach(b => b.addEventListener('click', () => {
    const cur = readPersonBlocks(); cur.splice(Number(b.dataset.i), 1); renderPersonBlocks(cur);
  }));
}
function readPersonBlocks(){
  return [...document.querySelectorAll('#pBlocks .blk-row')].map(r => ({
    start: r.querySelector('.pb-start').value,
    end: r.querySelector('.pb-end').value,
    zone: r.querySelector('.pb-zone').value,
  }));
}
document.getElementById('pBlkAdd').addEventListener('click', () => {
  const cur = readPersonBlocks();
  cur.push({start:'18:00', end:'21:00', zone: ZONES[0].id});
  renderPersonBlocks(cur);
});

function openPerson(name){
  editingPerson = name;
  const p = name ? PEOPLE.find(x => x.name === name) : null;
  document.getElementById('personTitle').textContent = p ? p.name : 'Yeni personel';
  document.getElementById('pName').value = p ? p.name : '';
  document.getElementById('pHasRow').value = (p && p.hasRow === false) ? '0' : '1';
  document.getElementById('pType').value = p ? p.type : 'Tam zamanlı';
  document.getElementById('pHours').value = (p && p.hours != null) ? p.hours : '';
  renderZoneChecks('pPrimary', p ? p.primary : []);
  renderZoneChecks('pBackup', p ? p.backup : []);
  document.getElementById('pSup').value = (p && p.sup) ? '1' : '0';
  document.getElementById('pOnCall').value = (p && p.onCall) ? '1' : '0';
  document.getElementById('pMaxClose').value = (p && p.maxClose != null) ? p.maxClose : '';
  document.getElementById('pEarly').value = (p && p.earlyDays) ? p.earlyDays : '';
  document.getElementById('pOffDays').value = (p && p.offDays != null) ? p.offDays : '';
  document.getElementById('pWeeklyMax').value = (p && p.weeklyMax != null) ? p.weeklyMax : '';
  document.getElementById('pIzinHakki').value = (p && p.izinHakki != null) ? p.izinHakki : '';
  document.getElementById('pPrefOff').value = (p && p.prefOff) ? p.prefOff : '';
  document.getElementById('pPrefOffDay').value = (p && p.prefOffDay != null) ? String(p.prefOffDay) : '';
  document.getElementById('pCloseGroup').value = (p && p.closeGroup) ? p.closeGroup : '';
  renderPersonBlocks(p ? (p.dayBlocks || []) : []);
  document.getElementById('pDelete').style.display = p ? 'block' : 'none';
  const pb = document.getElementById('pBirlestir');
  if(pb) pb.style.display = p ? 'block' : 'none';
  document.getElementById('pPurge').style.display = p ? 'block' : 'none';
  const acik = document.getElementById('silAciklama');
  if(acik) acik.style.display = p ? 'block' : 'none';
  document.getElementById('personOverlay').classList.add('show');
}

document.getElementById('btnAddPerson').addEventListener('click', () => openPerson(null));
document.getElementById('pCancel').addEventListener('click', () => document.getElementById('personOverlay').classList.remove('show'));
document.getElementById('personOverlay').addEventListener('click', e => { if(e.target.id==='personOverlay') e.currentTarget.classList.remove('show'); });

document.getElementById('pSave').addEventListener('click', async () => {
  const name = document.getElementById('pName').value.trim();
  if(!name){ alert('Ad boş olamaz.'); return; }
  if(PEOPLE.some(x => x.name === name && x.name !== editingPerson)){
    alert('Bu isimde bir personel zaten var.'); return;
  }
  const hoursVal = document.getElementById('pHours').value;
  const maxCloseVal = document.getElementById('pMaxClose').value;
  const earlyVal = document.getElementById('pEarly').value;
  const rec = {
    name,
    hasRow: document.getElementById('pHasRow').value === '1',
    type: document.getElementById('pType').value,
    hours: hoursVal === '' ? null : Number(hoursVal),
    primary: readZoneChecks('pPrimary'),
    backup: readZoneChecks('pBackup'),
    sup: document.getElementById('pSup').value === '1',
  };
  if(document.getElementById('pOnCall').value === '1') rec.onCall = true;
  if(maxCloseVal !== '') rec.maxClose = Number(maxCloseVal);
  if(earlyVal !== '' && Number(earlyVal) > 0) rec.earlyDays = Number(earlyVal);
  const offDaysVal = document.getElementById('pOffDays').value;
  if(offDaysVal !== '') rec.offDays = Number(offDaysVal);
  const prefOff = document.getElementById('pPrefOff').value;
  if(prefOff) rec.prefOff = prefOff;
  const prefOffDay = document.getElementById('pPrefOffDay').value;
  if(prefOffDay !== '') rec.prefOffDay = Number(prefOffDay);
  const closeGroup = document.getElementById('pCloseGroup').value.trim();
  if(closeGroup) rec.closeGroup = closeGroup;
  const dayBlocks = readPersonBlocks().filter(b => b.start && b.end && toMin(b.end) > toMin(b.start));
  if(dayBlocks.length) rec.dayBlocks = dayBlocks;
  const wMax = document.getElementById('pWeeklyMax').value;
  if(wMax !== '') rec.weeklyMax = Number(wMax);
  const izinHakkiVal = document.getElementById('pIzinHakki').value;
  if(izinHakkiVal !== '') rec.izinHakki = Number(izinHakkiVal);

  const oldName = editingPerson;
  if(oldName){
    const idx = PEOPLE.findIndex(x => x.name === oldName);
    // Kadro geçerlilik tarihleri düzenlemede korunur (rec yeni bir nesne)
    // Kadro geçerlilik bilgisi program tarafından tutulur, kullanıcı girmez.
    if(PEOPLE[idx].startWeek) rec.startWeek = PEOPLE[idx].startWeek;
    if(PEOPLE[idx].endWeek)   rec.endWeek   = PEOPLE[idx].endWeek;
    PEOPLE[idx] = rec;
    if(oldName !== name) await renamePersonInWeek(oldName, name);
  } else {
    // YENİ personel: bu HAFTADAN İTİBAREN kadroda sayılır. Geçmiş haftalar
    // etkilenmez — biten bir haftanın çizelgesi sonradan gelen biri yüzünden
    // değişmemeli.
    rec.startWeek = fmtDate(currentMonday);
    PEOPLE.push(rec);
  }
  rebuildPeople();
  ensureWeekPeople();
  await saveSettings();
  document.getElementById('personOverlay').classList.remove('show');
  renderPeople(); renderGrid(); renderValidation(); scheduleSave();
});

/* Personel çıkarma — HER ZAMAN "bu haftadan itibaren".
   Geçmiş haftalardaki vardiyaları ve Borç/Alacak kayıtları OLDUĞU GİBİ KALIR;
   o haftalarda gerçekten çalıştı, bordro oradan hesaplanıyor.
   Kullanıcıya tarih sorulmaz, program kendisi kaydeder. */
document.getElementById('pDelete').addEventListener('click', async () => {
  if(!editingPerson) return;
  const kisi = PEOPLE.find(x => x.name === editingPerson);
  if(!kisi) return;

  const buHafta = `${pad(currentMonday.getDate())}.${pad(currentMonday.getMonth()+1)}`;
  if(!confirm(`${editingPerson} kadrodan çıkarılsın mı?

`
    + `» ${buHafta} haftasından İTİBAREN çizelgede görünmez.
`
    + `» ÖNCEKİ haftalardaki vardiyaları ve Borç/Alacak kayıtları olduğu gibi kalır.`)) return;

  kisi.endWeek = fmtDate(addDays(currentMonday, -7));   // son kadroda olduğu hafta
  delete kisi.closeGroup;                              // ayrılan kişi kapanış grubunda kalmasın
  Object.values(weekData.days).forEach(d => {
    delete d.assignments[editingPerson];
    if(d.sup === editingPerson){ d.sup = null; delete d.supManual; }
  });

  rebuildPeople();
  await saveSettings();
  document.getElementById('personOverlay').classList.remove('show');
  renderPeople(); renderGrid(); renderValidation(); scheduleSave();
});

/* TAMAMEN SİL — kişiyi GEÇMİŞ, BUGÜN ve GELECEK bütün haftalardan siler.
   "Kadrodan çıkar"dan farkı: o, geçmişi koruyup sadece bu haftadan itibaren
   listeden düşürür (işten ayrılanlar için). Bu ise hiçbir iz bırakmaz —
   yalnızca yanlış eklenmiş / hiç çalışmamış kişiler için.
   Kayıtlı tüm week:* kayıtları taranıp kişinin atamaları ve sorumlu olduğu
   günler temizlenir, sonra kayıt geri yazılır. Geri alınamaz. */
async function personeliTamamenSil(ad){
  let etkilenenHafta = 0, silinenAtama = 0, silinenSorumlu = 0;
  const keys = await store.listKeys('week:');
  const buHaftaKey = 'week:' + fmtDate(currentMonday);

  for(const k of keys){
    let wd;
    if(k === buHaftaKey && weekData){ wd = weekData; }        // bellekteki güncel hafta
    else {
      const r = await store.get(k);
      if(!r || !r.value) continue;
      try{ wd = JSON.parse(r.value); }catch(e){ continue; }
    }
    let degisti = false;
    for(const gk in (wd.days || {})){
      const g = wd.days[gk];
      if(g.assignments && Object.prototype.hasOwnProperty.call(g.assignments, ad)){
        delete g.assignments[ad]; silinenAtama++; degisti = true;
      }
      if(g.sup === ad){ g.sup = null; delete g.supManual; silinenSorumlu++; degisti = true; }
    }
    if(degisti){
      etkilenenHafta++;
      if(k !== buHaftaKey) await store.set(k, JSON.stringify(wd));
    }
  }
  // Bellekteki hafta da kaydedilsin
  if(weekData) scheduleSave();

  // Ayarlardan ve borç/alacak defterinden çıkar
  PEOPLE = PEOPLE.filter(x => x.name !== ad);
  const oncekiLedger = ledger.length;
  ledger = ledger.filter(e => e.name !== ad);

  return {etkilenenHafta, silinenAtama, silinenSorumlu, silinenLedger: oncekiLedger - ledger.length};
}

document.getElementById('pPurge').addEventListener('click', async () => {
  if(!editingPerson) return;
  const ad = editingPerson;
  if(!confirm(`${ad} TAMAMEN silinecek.

`
    + `» GEÇMİŞ, bugün ve GELECEK bütün haftalardan kaldırılır
`
    + `» Borç/Alacak hareketleri de silinir
`
    + `» BU İŞLEM GERİ ALINAMAZ

`
    + `İşten ayrılan biri için bunu KULLANMA — onun için "Kadrodan çıkar" var,
`
    + `o geçmiş kayıtları korur.

Devam edilsin mi?`)) return;
  if(!confirm(`Son onay: ${ad} ve bütün geçmiş kayıtları silinecek.

Emin misin?`)) return;

  const btn = document.getElementById('pPurge');
  const eskiMetin = btn.textContent;
  btn.textContent = 'Siliniyor…'; btn.disabled = true;
  let sonuc;
  try{ sonuc = await personeliTamamenSil(ad); }
  catch(e){ alert('Silme sırasında hata oluştu: ' + e.message); btn.textContent = eskiMetin; btn.disabled = false; return; }
  btn.textContent = eskiMetin; btn.disabled = false;

  rebuildPeople();
  await saveSettings();
  document.getElementById('personOverlay').classList.remove('show');
  renderPeople(); renderGrid(); renderValidation(); scheduleSave();
  alert(`${ad} tamamen silindi.

`
    + `${sonuc.etkilenenHafta} hafta güncellendi
`
    + `${sonuc.silinenAtama} vardiya kaydı silindi
`
    + `${sonuc.silinenSorumlu} akşam sorumlusu ataması kaldırıldı
`
    + `${sonuc.silinenLedger} Borç/Alacak hareketi silindi`);
});

// Bir kişi yeniden adlandırılınca sadece mevcut hafta değil — geçmişte kayıtlı
// TÜM haftalar ve Borç/Alacak defterindeki hareketleri de yeni isme
// taşınır. Yoksa geçmiş atamalar/bakiye eski isimde "kayıp" kalırdı.
async function renamePersonInWeek(oldName, newName){
  // Mevcut (bellekteki) hafta — hemen güncellenir, kaydı çağıran yer yapar (scheduleSave).
  Object.values(weekData.days).forEach(d => {
    if(d.assignments[oldName]){ d.assignments[newName] = d.assignments[oldName]; delete d.assignments[oldName]; }
    if(d.sup === oldName) d.sup = newName;
  });
  ledger.forEach(e => { if(e.name === oldName) e.name = newName; });   // saveSettings() çağıran yerde kaydedilecek

  // Geçmişte kayıtlı diğer haftalar (mevcut hafta hariç — o zaten yukarıda güncellendi)
  const curKey = 'week:' + fmtDate(currentMonday);
  try{
    const weekKeys = await store.listKeys('week:');
    for(const k of weekKeys){
      if(k === curKey) continue;
      const r = await store.get(k);
      if(!r || !r.value) continue;
      let wd;
      try{ wd = JSON.parse(r.value); }catch(e){ continue; }
      let changed = false;
      Object.values(wd.days || {}).forEach(d => {
        if(d.assignments && d.assignments[oldName]){
          d.assignments[newName] = d.assignments[oldName];
          delete d.assignments[oldName];
          changed = true;
        }
        if(d.sup === oldName){ d.sup = newName; changed = true; }
      });
      if(changed) await store.set(k, JSON.stringify(wd));
    }
  }catch(e){ /* geçmiş haftalar taranamadı — en azından mevcut hafta güncellendi */ }
}

// Yeni eklenen personelin mevcut haftada boş hücresi olsun
/* Haftadaki eksik kişileri boş atamayla tamamlar.
   ÖNEMLİ: ROSTER zaten o haftaya göre süzülmüş durumda (haftadaAktif), yani
   o hafta kadroda olmayan kimse buraya gelmez. Böylece geçmiş bir haftaya
   göz atmak, sonradan işe giren biri için orada boş sütun AÇMAZ. */
function ensureWeekPeople(){
  if(!weekData) return;
  Object.values(weekData.days).forEach(d => {
    d.assignments = d.assignments || {};
    ROSTER.forEach(p => { if(!d.assignments[p.name]) d.assignments[p.name] = blankAssignment(); });
  });
}

/* ---------------------------------------------------------------------
   Bölüm (Zone) yönetimi
--------------------------------------------------------------------- */
let editingZone = null;

function renderZones(){
  const t = document.getElementById('zoneTable');
  t.innerHTML = `<thead><tr><th style="text-align:left">Bölüm</th><th style="text-align:left">Bu bölüme bakabilenler</th><th></th></tr></thead><tbody>` +
    ZONES.map(z => {
      const who = PEOPLE.filter(p => canCover(p, z.id)).map(p => p.name.split(' ')[0]).join(', ') || '—';
      return `<tr>
        <td class="pcell"><span class="chip" style="background:${z.color}">${z.label}</span></td>
        <td class="pcell" style="color:var(--ink-soft)">${who}</td>
        <td class="pcell"><button class="pedit" data-id="${z.id}">düzenle</button></td>
      </tr>`;
    }).join('') + `</tbody>`;
  t.querySelectorAll('button.pedit').forEach(b => b.addEventListener('click', () => openZone(b.dataset.id)));
}

function openZone(id){
  editingZone = id;
  const z = id ? ZONE_MAP[id] : null;
  document.getElementById('zoneTitle').textContent = z ? z.label : 'Yeni bölüm';
  document.getElementById('zLabel').value = z ? z.label : '';
  document.getElementById('zColor').value = z ? z.color : '#7B2D3B';
  document.getElementById('zDelete').style.display = z ? 'block' : 'none';
  document.getElementById('zoneOverlay').classList.add('show');
}
document.getElementById('btnAddZone').addEventListener('click', () => openZone(null));
document.getElementById('zCancel').addEventListener('click', () => document.getElementById('zoneOverlay').classList.remove('show'));
document.getElementById('zoneOverlay').addEventListener('click', e => { if(e.target.id==='zoneOverlay') e.currentTarget.classList.remove('show'); });

function slugifyZone(label){
  const map = {'ç':'C','ğ':'G','ı':'I','İ':'I','ö':'O','ş':'S','ü':'U'};
  return label.trim().toUpperCase().replace(/[çğıİöşü]/gi, c => map[c.toLowerCase()] || c)
    .replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'BOLUM';
}

document.getElementById('zSave').addEventListener('click', async () => {
  const label = document.getElementById('zLabel').value.trim();
  if(!label){ alert('Bölüm adı boş olamaz.'); return; }
  const color = document.getElementById('zColor').value;
  if(editingZone){
    const z = ZONE_MAP[editingZone];
    z.label = label; z.color = color;
  } else {
    let id = slugifyZone(label), n = 2;
    while(ZONE_MAP[id]) id = slugifyZone(label) + '_' + (n++);
    ZONES.push({id, label, color});
  }
  rebuildZones();
  await saveSettings();
  document.getElementById('zoneOverlay').classList.remove('show');
  renderZones(); renderLegend(); renderPeople(); renderRules(); renderGrid(); renderValidation();
});

document.getElementById('zDelete').addEventListener('click', async () => {
  if(!editingZone) return;
  const z = ZONE_MAP[editingZone];
  if(!confirm(`"${z.label}" bölümü silinsin mi? Personelin görev listelerinden ve kapsama kurallarından da çıkarılacak.`)) return;
  ZONES = ZONES.filter(x => x.id !== editingZone);
  PEOPLE.forEach(p => {
    p.primary = (p.primary || []).filter(x => x !== editingZone);
    p.backup = (p.backup || []).filter(x => x !== editingZone);
    if(p.dayBlocks) p.dayBlocks = p.dayBlocks.filter(b => b.zone !== editingZone);
  });
  rules.forEach(r => { r.zones = r.zones.filter(x => x !== editingZone); });
  rules = rules.filter(r => r.zones.length);
  rebuildZones(); rebuildPeople();
  await saveSettings();
  document.getElementById('zoneOverlay').classList.remove('show');
  renderZones(); renderLegend(); renderPeople(); renderRules(); renderGrid(); renderValidation();
});

/* ---------------------------------------------------------------------
   Kapsama kuralı yönetimi
--------------------------------------------------------------------- */
let editingRule = null;

function renderRules(){
  const t = document.getElementById('ruleTable');
  t.innerHTML = `<thead><tr>
      <th style="text-align:left">Kural</th><th style="text-align:left">Bölümler</th>
      <th style="text-align:left">Kişi sayısı</th><th style="text-align:left">Özellik</th><th></th>
    </tr></thead><tbody>` +
    rules.map(r => {
      const tags = [];
      if(r.critical) tags.push('<span class="ptag sup">kritik</span>');
      if(r.fullBlock) tags.push('<span class="ptag">bloğun tamamı</span>');
      if(!r.enabled) tags.push('<span class="ptag oncall">kapalı</span>');
      return `<tr>
        <td class="pcell"><b>${r.label}</b></td>
        <td class="pcell" style="color:var(--ink-soft)">${zoneLabels(r.zones)}</td>
        <td class="pcell">en az ${r.min}${r.max != null ? ` · en fazla ${r.max}` : ''}
          ${(r.from || r.to) ? `<br><span style="font-size:10.5px;color:var(--burgundy)">⏱ ${kuralSaatMetni(r)}</span>` : ''}</td>
        <td class="pcell">${tags.join(' ') || '—'}</td>
        <td class="pcell"><button class="pedit" data-id="${r.id}">düzenle</button></td>
      </tr>`;
    }).join('') + `</tbody>`;
  t.querySelectorAll('button.pedit').forEach(b => b.addEventListener('click', () => openRule(b.dataset.id)));
}

function openRule(id){
  editingRule = id;
  const r = id ? rules.find(x => x.id === id) : null;
  document.getElementById('ruleTitle').textContent = r ? r.label : 'Yeni kural';
  document.getElementById('rLabel').value = r ? r.label : '';
  renderZoneChecks('rZones', r ? r.zones : []);
  document.getElementById('rMin').value = r ? r.min : 1;
  document.getElementById('rMax').value = (r && r.max != null) ? r.max : '';
  document.getElementById('rFrom').value = (r && r.from) ? r.from : '';
  document.getElementById('rTo').value   = (r && r.to)   ? r.to   : '';
  document.getElementById('rCritical').value = (r && r.critical) ? '1' : '0';
  document.getElementById('rFullBlock').value = (r && r.fullBlock) ? '1' : '0';
  document.getElementById('rEnabled').value = (!r || r.enabled) ? '1' : '0';
  document.getElementById('rDelete').style.display = r ? 'block' : 'none';
  document.getElementById('ruleOverlay').classList.add('show');
}
document.getElementById('btnAddRule').addEventListener('click', () => openRule(null));
document.getElementById('rCancel').addEventListener('click', () => document.getElementById('ruleOverlay').classList.remove('show'));
document.getElementById('ruleOverlay').addEventListener('click', e => { if(e.target.id==='ruleOverlay') e.currentTarget.classList.remove('show'); });

document.getElementById('rSave').addEventListener('click', async () => {
  const label = document.getElementById('rLabel').value.trim();
  const zones = readZoneChecks('rZones');
  if(!label){ alert('Kural adı boş olamaz.'); return; }
  if(!zones.length){ alert('En az bir bölüm seçmelisin.'); return; }
  const maxVal = document.getElementById('rMax').value;
  const rec = {
    id: editingRule || ('kural_' + Date.now()),
    label, zones,
    min: Number(document.getElementById('rMin').value || 0),
    max: maxVal === '' ? null : Number(maxVal),
    enabled: document.getElementById('rEnabled').value === '1',
  };
  if(document.getElementById('rCritical').value === '1') rec.critical = true;
  if(document.getElementById('rFullBlock').value === '1') rec.fullBlock = true;
  // Kuralın geçerli olduğu saat aralığı (boş = dükkânın tüm açık saatleri)
  const fromV = document.getElementById('rFrom').value;
  const toV   = document.getElementById('rTo').value;
  if(fromV) rec.from = fromV;
  if(toV)   rec.to   = toV;
  if(rec.from && rec.to && toMin(rec.to) <= toMin(rec.from)){
    alert('Kuralın bitiş saati başlangıçtan sonra olmalı.'); return;
  }
  if(editingRule){ const i = rules.findIndex(x => x.id === editingRule); rules[i] = rec; }
  else rules.push(rec);
  await saveSettings();
  document.getElementById('ruleOverlay').classList.remove('show');
  renderRules(); renderValidation();
});

document.getElementById('rDelete').addEventListener('click', async () => {
  if(!editingRule) return;
  const r = rules.find(x => x.id === editingRule);
  if(!confirm(`"${r.label}" kuralı silinsin mi?`)) return;
  rules = rules.filter(x => x.id !== editingRule);
  await saveSettings();
  document.getElementById('ruleOverlay').classList.remove('show');
  renderRules(); renderValidation();
});
