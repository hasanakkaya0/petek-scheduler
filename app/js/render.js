/* =====================================================================
   EKRAN CIZIMI
   Ust gezinme, bolum renk aciklamalari, alt bilgi ve asil haftalik
   cizelge tablosunun cizimi. Gune ozel dukkan saati ayari da burada.

   NOT: Bu dosya index.html ana kodundan ONCE yuklenir.
===================================================================== */
/* ---------------------------------------------------------------------
   HAFTA KİLİDİ
   Bir hafta kesinleşip personele duyurulduktan sonra (ör. WhatsApp grubuna
   atıldıktan sonra) kilitlenir. Kilitli haftada:
     - "Haftayı otomatik oluştur" ÇALIŞMAZ  (yanlışlıkla yeniden dağıtımı önler)
     - "Haftayı sıfırla" ÇALIŞMAZ
     - Elle düzenlemeler SERBEST kalır — acil bir durumda geçmişe dönük
       değişiklik yapılabilsin diye (patron isteyebilir).
   Kilit haftanın kendi kaydında tutulur, yedeğe de dahil olur.
--------------------------------------------------------------------- */
function haftaKilitli(){
  return !!(weekData && weekData.locked);
}

/* ---------------------------------------------------------------------
   SABİT (📌) HÜCRELER
   Elle düzenlenip "Sabit" işaretlenen günler otomatik oluşturmada
   değişmez. Faydalı ama görünmez olursa zararlı: sabit hücre biriktikçe
   çizelge yeniden düzenlenemez hale gelir ve açıklar artar. Bu yüzden
   sayıları gezinme çubuğunda hep görünür tutulur (bilgi amaçlı).
   Sabitler TOPLU olarak kaldırılamaz — kullanıcı isteği: bir günü serbest
   bırakmak için o hücreye tıklayıp "Serbest" seçmek gerekir.
--------------------------------------------------------------------- */
function sabitHucreSay(){
  if(!weekData) return 0;
  let n = 0;
  for(let i = 0; i < 7; i++){
    const d = weekData.days[fmtDate(addDays(currentMonday, i))];
    if(!d) continue;
    ROSTER.forEach(p => { const a = d.assignments[p.name]; if(a && a.manual && (isWorking(a) || a.leave !== 'NONE')) n++; });   // boş (görünmez) sabit sayılmaz
  }
  return n;
}

function renderPinBadge(){
  const el = document.getElementById('pinBadge');
  if(!el) return;
  const n = sabitHucreSay();
  el.hidden = n === 0 || haftaKilitli();      // kilitli haftada "N sabit" rozeti anlamsız (hepsi kilitli)
  el.textContent = '📌 ' + n + ' sabit';
  el.title = n + ' hücre elle sabitlenmiş (📌). Otomatik oluşturma bu günlere dokunmaz. '
           + 'Bir günü tekrar serbest bırakmak için o hücreye tıkla ve "Serbest" seç.';
}

// Kilitli haftada engellenen işlemler bunu çağırır. Engellendiyse true döner.
function kilitEngeli(islem){
  if(!haftaKilitli()) return false;
  alert(`Bu hafta kilitli 🔒\n\n"${islem}" işlemi kilitli haftada yapılamaz.\n\n`
      + `Tek tek hücreleri elle düzenlemeye devam edebilirsin — kilit yalnızca\n`
      + `toplu yeniden dağıtımı engeller.\n\n`
      + `Gerçekten yeniden dağıtmak istiyorsan önce üstteki\n`
      + `"🔓 Kilidi aç" düğmesine bas.`);
  return true;
}

function renderWeekLock(){
  const kilitli = haftaKilitli();
  const rozet = document.getElementById('weekLockBadge');
  const dugme = document.getElementById('btnLock');
  if(!rozet || !dugme) return;

  rozet.hidden = !kilitli;
  if(kilitli && weekData.lockedAt){
    rozet.title = 'Kilitlendi: ' + new Date(weekData.lockedAt).toLocaleString('tr-TR');
  }

  dugme.textContent = kilitli ? '🔓 Kilidi aç' : '🔒 Haftayı kilitle';
  dugme.title = kilitli
    ? 'Kilidi açarsan otomatik oluşturma ve sıfırlama yeniden kullanılabilir olur.'
    : 'Hafta kesinleştiyse kilitle — yanlışlıkla yeniden dağıtılmasını önler.';
  dugme.style.borderColor = kilitli ? 'var(--amber)' : '';
  dugme.style.color = kilitli ? 'var(--amber)' : '';
  dugme.style.fontWeight = kilitli ? '700' : '';

  // Engellenen düğmeleri soluklaştır (tıklanabilir kalır, uyarı verirler)
  ['btnGenerate','btnReset'].forEach(id => {
    const b = document.getElementById(id);
    if(!b) return;
    b.style.opacity = kilitli ? '.4' : '';
    b.title = kilitli ? 'Hafta kilitli — önce kilidi açman gerekiyor' : '';
  });
}

/* ---------------------------------------------------------------------
   Render — üst gezinme + spine legend
--------------------------------------------------------------------- */
function renderHeader(){
  const sunday = addDays(currentMonday,6);
  const fmt = d => `${pad(d.getDate())}.${pad(d.getMonth()+1)}`;
  document.getElementById('weekRange').textContent = `${fmt(currentMonday)} – ${fmt(sunday)} ${sunday.getFullYear()}`;
  renderWeekLock();
  renderPinBadge();
  if(typeof Birlikte !== 'undefined') Birlikte.hafta(fmtDate(currentMonday));   // bulut: bu haftayı açtığımızı duyur
}
function renderLegend(){
  const el = document.getElementById('spineLegend');
  el.innerHTML = ZONES.map(z => `<span class="spine" style="background:${z.color}"><span class="dot"></span>${z.label}</span>`).join('');
}
function renderFooter(){
  const el = document.getElementById('footNote');
  if(typeof Bulut !== 'undefined' && Bulut.aktif()) el.innerHTML = 'Veriler <b>bulutta</b> (Firebase) saklanır — izin verilen hesaplarla giriş yapan her bilgisayar aynı veriyi görür, ayrıca yedek göndermeye gerek yok. Yine de ara sıra <b>Yedek al (JSON)</b> ile bir kopya indirmen iyi olur.';
  else if(hasCloud) el.innerHTML = 'Veriler bu sohbette (Claude) saklanır. Cihazlar arası taşımak için <b>Yedek al (JSON)</b> ile indirip, indirdiğin dosyada <b>Yedekten yükle</b> ile geri alabilirsin.';
  else if(hasLocal) el.innerHTML = 'Veriler bu tarayıcıda (bu cihazda) saklanır — dosyayı çift tıklayıp açtığında da kayıt tutulur. Başka bir cihaza taşımak için <b>Yedek al (JSON)</b> kullan.';
  else el.innerHTML = 'Bu ortamda kalıcı kayıt yapılamıyor — değişiklikler sadece bu oturumda geçerli. Kaybetmemek için <b>Yedek al (JSON)</b> ile indir.';
}

/* ---------------------------------------------------------------------
   Render — ana grid (SÜTUN = çalışan, SATIR = gün) + akşam sorumlusu sütunu
--------------------------------------------------------------------- */
// Güne özel dükkan açılış/kapanış saati — günün yanındaki ⚙'dan ayarlanır.
// Ayarlanınca "Haftayı otomatik oluştur" o güne göre planlama yapar.
// dowDefaultHours -> js/utils.js (tarihli dükkân saatleri)
function openDayHours(dateStr){
  const parts = dateStr.split('-').map(Number);
  const dObj = new Date(parts[0], parts[1]-1, parts[2]);
  const def = dowDefaultHours(dObj);
  const d = weekData.days[dateStr];
  const cur = d.customHours;
  const isTime = t => /^([01]?\d|2[0-3]):[0-5]\d$/.test((t||'').trim());
  const dayNm = DAY_NAMES[dObj.getDay() === 0 ? 6 : dObj.getDay()-1];
  const openV = prompt(
    `${dayNm} ${dateStr} — dükkan AÇILIŞ saati (varsayılan ${def.open}).\n` +
    `Örn. 10:00. Boş bırakıp Tamam'a basarsan bu gün varsayılana döner.`,
    cur ? cur.open : def.open);
  if(openV === null) return;                             // iptal
  if(openV.trim() === ''){                               // varsayılana dön
    undoKaydet();
    delete d.customHours; scheduleSave(); renderGrid(); renderValidation(); return;
  }
  const closeV = prompt(`${dayNm} ${dateStr} — dükkan KAPANIŞ saati (varsayılan ${def.close}).\nÖrn. 19:00.`, cur ? cur.close : def.close);
  if(closeV === null) return;
  if(!isTime(openV) || !isTime(closeV)){ alert('Saat biçimi SS:DD olmalı (ör. 10:00).'); return; }
  if(toMin(closeV.trim()) - toMin(openV.trim()) < 60){ alert('Kapanış, açılıştan en az 1 saat sonra olmalı.'); return; }
  undoKaydet();
  d.customHours = {open: openV.trim(), close: closeV.trim()};
  scheduleSave(); renderGrid(); renderValidation();
  // Kilitli haftada yeniden oluşturmayı teklif bile etme.
  if(haftaKilitli()){
    alert('Güne özel saat kaydedildi.\n\nHafta kilitli olduğu için çizelge yeniden '
        + 'oluşturulmadı — vardiyaları elle düzenleyebilirsin.');
    return;
  }
  if(confirm('Bu güne özel saat ayarlandı. Haftayı bu saate göre yeniden oluşturmak ister misin?')){
    document.getElementById('btnGenerate').click();
  }
}

function renderGrid(){
  const table = document.getElementById('gridTable');
  const days = [...Array(7)].map((_,i)=>addDays(currentMonday,i));

  // başlık: köşe + çalışanlar + akşam sorumlusu
  const empHeads = ROSTER.map(p => `
    <th>
      <div class="emphead">
        <span class="empname">${p.name}</span>
        <span class="type">${p.type}${p.hours ? ' · ' + p.hours + ' sa' : ''}</span>
      </div>
    </th>`).join('');
  const thead = `<thead><tr><th class="corner"></th>${empHeads}<th class="supcol">Akşam<br>Sorumlusu</th></tr></thead>`;

  const supOptions = ['<option value="">— yok —</option>']
    .concat(SUP_POOL.map(p => `<option value="${p.name}">${p.name}</option>`)).join('');

  const tbody = '<tbody>' + days.map((d,i) => {
    const key = fmtDate(d);
    const empCells = ROSTER.map(p => {
      const a = weekData.days[key].assignments[p.name];
      // Dolu hücreler sürüklenebilir (boş hücreyi sürüklemenin anlamı yok)
      const dolu = a && (isWorking(a) || a.leave !== 'NONE');
      return `<td class="cell" data-date="${key}" data-name="${p.name}"${dolu ? ' draggable="true"' : ''}>${cellContent(a)}</td>`;
    }).join('');
    // Akşam sorumlusu: SADE görünüm — yalnız isim (üzerine gelince açılır liste belirir). Eskiden her satırda
    // "elle atandı / serbest bırak" yazısı vardı; artık küçük 📌 (üzerine gelince belirgin, tıklayınca serbest bırakır).
    const supElle = weekData.days[key].supManual;
    const supCell = `<td class="supcell">
      <select class="sup-sade${supElle ? ' manual' : ''}" data-date="${key}" title="${supElle ? 'Elle atandı — otomatik oluşturma bunu değiştirmez' : 'Akşam sorumlusu (tıklayıp değiştir)'}">${supOptions}</select>
      ${supElle && !haftaKilitli() ? `<button class="sup-free" data-date="${key}" title="Elle atandı. Tıklarsan serbest bırakılır; otomatik oluşturma yeniden seçebilir.">📌</button>` : ''}
    </td>`;
    // BUGÜN: bu hafta içindeyse bugünün satırı renkli ve "bugün" etiketli
    const bugunMu = key === fmtDate(new Date());
    return `<tr${bugunMu ? ' class="bugun"' : ''}><td class="daycol">${dayLabel(i)}${bugunMu ? '<span class="bugun-etiket">bugün</span>' : ''}<button class="dayhours-gear" data-date="${key}" title="Bu güne özel dükkan saati">⚙</button><span class="daynum">${pad(d.getDate())}.${pad(d.getMonth()+1)}</span>${weekData.days[key].customHours ? `<span class="customhrs" title="Bu güne özel saat">${weekData.days[key].customHours.open}–${weekData.days[key].customHours.close}</span>` : ''}</td>${empCells}${supCell}</tr>`;
  }).join('') + '</tbody>';

  table.innerHTML = thead + tbody + weeklyFooter();

  // hücre tıklama -> tek gün düzenleyici
  table.querySelectorAll('td.cell').forEach(td => {
    td.addEventListener('click', () => openEditor(td.dataset.date, td.dataset.name));
  });
  // hücre sürükle-bırak -> vardiyayı kopyala
  table.querySelectorAll('td.cell').forEach(td => baglaSurukle(td));
  // güne özel dükkan saati çarkı
  table.querySelectorAll('button.dayhours-gear').forEach(b => {
    b.addEventListener('click', (e) => { e.stopPropagation(); openDayHours(b.dataset.date); });
  });
  // akşam sorumlusu select
  table.querySelectorAll('td.supcell select').forEach(sel => {
    const key = sel.dataset.date;
    sel.value = weekData.days[key].sup || '';
    if(weekData.days[key].supManual) sel.classList.add('manual');
    sel.addEventListener('change', () => {
      undoKaydet();
      weekData.days[key].sup = sel.value || null;
      weekData.days[key].supManual = true;   // elle atandı — otomatik oluşturma dokunmaz
      scheduleSave();
      renderGrid();
      renderValidation();
    });
  });
  table.querySelectorAll('button.sup-free').forEach(b => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      undoKaydet();
      delete weekData.days[b.dataset.date].supManual;
      scheduleSave();
      renderGrid();
      renderValidation();
    });
  });
}

// Bir kişinin bu haftaki toplam çalışma saati (mola düşülerek)
function weeklyHours(name){
  let mins = 0;
  for(let i=0;i<7;i++){
    const k = fmtDate(addDays(currentMonday, i));
    const a = weekData.days[k] && weekData.days[k].assignments[name];
    if(!isWorking(a)) continue;
    mins += toMin(a.end) - toMin(a.start);
  }
  return mins / 60;
}

function weeklyFooter(){
  const cells = ROSTER.map(p => {
    const h = weeklyHours(p.name);
    const over = p.weeklyMax != null && h > p.weeklyMax + 0.01;
    let days = 0, closes = 0;
    for(let i=0;i<7;i++){
      const k = fmtDate(addDays(currentMonday, i));
      const a = weekData.days[k].assignments[p.name];
      if(isWorking(a)){
        days++;
        const oh = operatingHours(addDays(currentMonday, i));
        // Vardiyası kapanışa kadar süren her gün kapanış sayılır — Pazar günü
        // herkes full çalıştığı için Pazar da kapanış olarak sayılır.
        if(toMin(a.end) >= toMin(oh.close)) closes++;
      }
    }
    const balHtml = p.hours
      ? `<span class="sumsub balbadge" data-name="${p.name}">bakiye: <b class="baltxt zero">…</b></span>`
      : '';
    return `<td class="sumcell ${over ? 'over' : ''}">
      <b>${h % 1 === 0 ? h : h.toFixed(1)} sa</b>
      <span class="sumsub">${days} gün · ${closes} kapanış</span>
      ${balHtml}
    </td>`;
  }).join('');
  return `<tfoot><tr>
    <td class="daycol sumlabel">Haftalık<span class="daynum">toplam</span></td>
    ${cells}<td class="supcell"></td>
  </tr></tfoot>`;
}

function cellContent(a){
  // 📌 işareti: kilitli haftada GÖSTERİLMEZ (zaten her şey kilitli, iğneler gürültü olur);
  // kilitsiz haftada silik, üzerine gelince belirgin (CSS .pinmark).
  const pin = (a.manual && !haftaKilitli()) ? `<span class="pinmark" title="sabit — otomatik oluşturma değiştirmez">📌</span>` : '';
  if(a.leave === 'IZINLI') return `<span class="chip leave">İzinli</span>${pin}`;
  if(a.leave === 'YILLIK') return `<span class="chip leaveY">Y. İzin</span>${pin}`;
  if(a.leave === 'BORC') return `<span class="chip leaveB">Borç</span>${pin}`;
  if(!a.start || !a.end) return `<span class="empty-cell">atanmamış</span>`;
  const z = a.zone ? ZONE_MAP[a.zone] : null;
  const chip = z ? `<span class="chip" style="background:${z.color}">${z.label}</span>` : '';
  const blocks = (a.blocks || []).map(b => {
    const bz = ZONE_MAP[b.zone];
    return `<span class="blockchip" style="border-color:${bz ? bz.color : '#999'}; color:${bz ? bz.color : '#666'}">${b.start}–${b.end} ${bz ? bz.label : b.zone}</span>`;
  }).join('');
  return `${chip}<span class="timelabel">${a.start}–${a.end}${pin}</span>${blocks}`;
}

/* =====================================================================
   SÜRÜKLE-BIRAK — vardiyayı başka hücreye kopyala
   Örnek: Kişi E'nın Salı vardiyasını sürükleyip Kişi D'in Çarşamba
   hücresine bırakırsan aynı vardiya oraya kopyalanır.

   Kurallar:
     - KOPYALAR, taşımaz. Kaynak hücre olduğu gibi kalır.
     - Sabit (📌) durumu aynen gider: sabit bir hücreyi sürüklersen
       hedefe de sabit olarak, sabit değilse sabit olmadan düşer.
     - Üzerine bırakılan hücrenin eski içeriği YEDEKLENİR; sağ altta
       çıkan kutudan tek tıkla geri alınabilir.
===================================================================== */
let surukKaynak = null;      // {dateStr, name}
/* ---------------------------------------------------------------------
   GENEL GERİ AL
   Çizelgeyi değiştiren her işlemden ÖNCE undoKaydet() çağrılır — o anki
   haftanın tam bir kopyası bir yığına konur. Üstteki "↶ Geri al" düğmesi
   yığından son kopyayı çıkarıp geri yükler; art arda basılırsa birkaç
   adım geriye gidilebilir (en fazla UNDO_LIMIT adım).
   Yalnızca ŞU AN görüntülenen haftanın çizelgesini kapsar — personel/
   kural ayarları ve borç/alacak kayıtları dahil değil (bunlar ayrı, tüm
   haftalar arasında paylaşılan veriler, "hangi haftadayken geri aldın"
   karmaşası yaratmasın diye bilerek dışarıda bırakıldı).
   Hafta değişince (ileri/geri gezinme, yedekten yükleme) yığın boşalır
   — bkz. loadWeek() içindeki undoTemizle() çağrısı.
--------------------------------------------------------------------- */
const UNDO_LIMIT = 20;
let undoYigin = [];

function undoKaydet(){
  if(!weekData) return;
  undoYigin.push({monday: fmtDate(currentMonday), data: JSON.parse(JSON.stringify(weekData))});
  if(undoYigin.length > UNDO_LIMIT) undoYigin.shift();
  renderUndoButonu();
}

function undoTemizle(){
  undoYigin = [];
  renderUndoButonu();
}

function geriAl(){
  while(undoYigin.length){
    const son = undoYigin.pop();
    if(son.monday !== fmtDate(currentMonday)) continue;   // başka haftaya ait — normalde olmaz, atla
    weekData = son.data;
    scheduleSave();
    renderGrid();
    renderValidation();
    renderUndoButonu();
    bildirimGoster('Geri alındı.' + (undoYigin.length ? ` (${undoYigin.length} adım daha var)` : ''));
    return;
  }
  renderUndoButonu();
}

function renderUndoButonu(){
  const b = document.getElementById('btnUndo');
  if(!b) return;
  const n = undoYigin.filter(x => x.monday === fmtDate(currentMonday)).length;
  b.disabled = n === 0;
  b.title = n ? `Son işlemi geri al (${n} adım biriktirildi)` : 'Geri alınacak işlem yok';
}

function baglaSurukle(td){
  td.addEventListener('dragstart', e => {
    surukKaynak = {dateStr: td.dataset.date, name: td.dataset.name};
    td.classList.add('suruk-kaynak');
    if(e.dataTransfer){
      e.dataTransfer.effectAllowed = 'copy';
      // Bazı tarayıcılar veri konmadan sürüklemeyi başlatmıyor
      try{ e.dataTransfer.setData('text/plain', td.dataset.name); }catch(_){}
    }
  });

  td.addEventListener('dragend', () => {
    td.classList.remove('suruk-kaynak');
    document.querySelectorAll('td.cell.suruk-hedef').forEach(x => x.classList.remove('suruk-hedef'));
    surukKaynak = null;
  });

  td.addEventListener('dragover', e => {
    if(!surukKaynak) return;
    if(surukKaynak.dateStr === td.dataset.date && surukKaynak.name === td.dataset.name) return;
    e.preventDefault();                       // bırakmaya izin ver
    if(e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    td.classList.add('suruk-hedef');
  });

  td.addEventListener('dragleave', () => td.classList.remove('suruk-hedef'));

  td.addEventListener('drop', e => {
    e.preventDefault();
    td.classList.remove('suruk-hedef');
    if(!surukKaynak) return;
    const hedef = {dateStr: td.dataset.date, name: td.dataset.name};
    if(surukKaynak.dateStr === hedef.dateStr && surukKaynak.name === hedef.name) return;
    vardiyaKopyala(surukKaynak, hedef);
  });
}

function vardiyaKopyala(kaynak, hedef){
  if(kilitEngeli('Vardiya kopyalama')) return;

  const k = weekData.days[kaynak.dateStr].assignments[kaynak.name];
  if(!k) return;

  undoKaydet();   // hedefin eski hâli geri al yığınına gitti

  // Kopyala — sabit (manual) durumu KAYNAKTAKİ gibi gider
  const yeni = JSON.parse(JSON.stringify(k));
  weekData.days[hedef.dateStr].assignments[hedef.name] = yeni;

  scheduleSave();
  renderGrid();
  renderValidation();

  const gunAdi = ds => DAY_NAMES[(new Date(ds + 'T00:00').getDay() + 6) % 7];
  const ne = isWorking(yeni) ? `${yeni.start}–${yeni.end}`
    : (yeni.leave === 'YILLIK' ? 'Y. İzin' : yeni.leave === 'BORC' ? 'Borç izni' : 'İzinli');
  bildirimGoster(
    `${kaynak.name.split(' ')[0]} ${gunAdi(kaynak.dateStr)} (${ne}) → ` +
    `${hedef.name.split(' ')[0]} ${gunAdi(hedef.dateStr)}` +
    (yeni.manual ? '  📌 sabit olarak' : ''),
    'Geri al', geriAl);
}

/* Sağ altta kısa süreli bilgi kutusu (isteğe bağlı bir düğmeyle) */
let bildirimZaman = null;
function bildirimGoster(metin, dugmeMetni, dugmeIsi){
  if(!document.body) return;          // sayfa henüz hazır değilse sessizce geç
  let el = document.getElementById('toast');
  if(!el){
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.innerHTML = `<span class="toast-metin"></span>`;
  el.querySelector('.toast-metin').textContent = metin;
  if(dugmeMetni && dugmeIsi){
    const b = document.createElement('button');
    b.className = 'toast-btn';
    b.textContent = dugmeMetni;
    b.addEventListener('click', () => { el.classList.remove('show'); dugmeIsi(); });
    el.appendChild(b);
  }
  el.classList.add('show');
  clearTimeout(bildirimZaman);
  bildirimZaman = setTimeout(() => el.classList.remove('show'), 6000);
}
