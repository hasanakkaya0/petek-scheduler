/* =====================================================================
   KAPSAMA DOGRULAMA VE ONERILER
   2 numarali panel: kurallara gore gunun kapsama durumunu cizer,
   ihlalleri listeler ve acik kalan bolum icin "kim gecebilir" onerir.

   NOT: Bu dosya index.html ana kodundan ONCE yuklenir.
===================================================================== */
/* ---------------------------------------------------------------------
   Kapsama doğrulama
--------------------------------------------------------------------- */
function renderRuleToggles(){
  const el = document.getElementById('ruleList');
  el.innerHTML = rules.map(r => `
    <label class="rule">
      <input type="checkbox" data-rule="${r.id}" ${r.enabled?'checked':''}/>
      <span class="lbl">${r.label}</span>
      <span class="minmax">min ${r.min}${r.max?(' / max '+r.max):''}</span>
    </label>
  `).join('') + `
    <label class="rule">
      <input type="checkbox" id="supRuleToggle" ${supRuleEnabled?'checked':''}/>
      <span class="lbl">${SUP_COVERS_KASA_RULE.label}</span>
      <span class="minmax"></span>
    </label>
    <label class="rule">
      <input type="checkbox" id="sundayCompToggle" ${sundayComp?'checked':''}/>
      <span class="lbl">Pazar telafisi (Pazar çalışana hafta içinden 1 saat düşülür)</span>
      <span class="minmax"></span>
    </label>`;

  el.querySelectorAll('input[data-rule]').forEach(cb => {
    cb.addEventListener('change', () => {
      rules.find(r=>r.id===cb.dataset.rule).enabled = cb.checked;
      saveSettings(); renderValidation();
    });
  });
  document.getElementById('supRuleToggle').addEventListener('change', (e) => {
    supRuleEnabled = e.target.checked; saveSettings(); renderValidation();
  });
  document.getElementById('sundayCompToggle').addEventListener('change', (e) => {
    sundayComp = e.target.checked; saveSettings();
  });
}

function renderDayTabs(){
  const el = document.getElementById('dayTabs');
  const days = [...Array(7)].map((_,i)=>addDays(currentMonday,i));
  el.innerHTML = days.map((d,i) => {
    return `<button data-i="${i}" class="${i===selectedValidationDay?'active':''}">${DAY_NAMES[i].slice(0,3)} ${d.getDate()}</button>`;
  }).join('');
  el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    selectedValidationDay = Number(b.dataset.i); renderValidation();
  }));
}

function coverageAt(dateObj, dateStr, minute){
  const day = weekData.days[dateStr];
  const coverage = {};
  ROSTER.forEach(p => {
    const a = day.assignments[p.name];
    const z = zoneAtMinute(a, minute, p.primary[0]);
    if(z){ (coverage[z] ||= []).push(p.name); }
  });
  // Akşam sorumlusu SADECE 19:00'dan kapanışa kadar kasaya bakan bir yedek olarak
  // sayılır (kapanış artık ayarlı: dükkân saatleri 8. panel). Kadroda satırı olan
  // biri sorumluysa (ör. Kişi K), ancak o saatte hâlâ dükkândaysa sayılır —
  // 19:00'da çıkıyorsa kasayı kapatamaz.
  if(supRuleEnabled && day.sup && minute >= 19*60 && minute < toMin(operatingHours(dateObj).close)){
    const supEmp = ROSTER.find(p => p.name === day.sup);
    let present = true;
    if(supEmp){
      const sa = day.assignments[day.sup];
      present = isWorking(sa) && toMin(sa.start) <= minute && minute < toMin(sa.end);
    }
    if(present){
      (coverage['KASA'] ||= []);
      if(!coverage['KASA'].includes(day.sup)) coverage['KASA'].push(day.sup);
    }
  }
  return coverage;
}

/* Bu güne HİÇ vardiya girilmiş mi? Girilmemişse (boş hafta ya da kullanıcı henüz o güne
   gelmemiş) eksik/kapsama listesi üretilmez — "35 sorun" gibi korkutucu bir liste yerine
   kısa bir yönlendirme gösterilir. Gün dolmaya başlayınca (elle ya da otomatik) kontrol açılır. */
function gunDoluMu(dateStr){
  const g = weekData && weekData.days && weekData.days[dateStr];
  return !!g && ROSTER.some(p => isWorking(g.assignments[p.name]));
}

function renderTimeline(){
  const el = document.getElementById('timeline');
  const violEl = document.getElementById('violList');
  const d = addDays(currentMonday, selectedValidationDay);
  const dateStr = fmtDate(d);
  const {open, close} = operatingHours(d);
  const openMin = toMin(open), closeMin = toMin(close);

  const slots = [];
  for(let m = openMin; m < closeMin; m += 30) slots.push(m);

  const activeRules = rules.filter(r => r.enabled);
  const violations = [];
  const gunBos = !gunDoluMu(dateStr);

  const bilgiler = [];

  el.innerHTML = activeRules.map(rule => {
    const kotu = [];                         // bu kuralın ihlalli yarım saatleri ({m, count})
    const segs = slots.map(m => {
      const cov = coverageAt(d, dateStr, m);
      const count = rule.zones.reduce((s,z) => s + (cov[z]?cov[z].length:0), 0);
      const hh = pad(Math.floor(m/60)) + ':' + pad(m%60);
      const gecerli = kuralGecerliMi(rule, m, openMin, closeMin);

      if(gunBos) return `<div class="tseg off" data-tip="${hh} · henüz vardiya girilmemiş"></div>`;

      if(!gecerli){
        // Kuralın saat aralığı dışı — gri gösterilir, ihlal sayılmaz.
        if(count < rule.min) bilgiler.push(`${hh} — ${rule.label} boş (kural bu saatte geçerli değil)`);
        return `<div class="tseg off" data-tip="${hh} · kural geçerli değil (${count} kişi)"></div>`;
      }

      const bad = count < rule.min || (rule.max!==null && count > rule.max);
      if(bad) kotu.push({m, count});
      return `<div class="tseg ${bad?'bad':'ok'}" data-tip="${hh} · ${count} kişi"></div>`;
    }).join('');
    // Ardışık ve aynı kişi sayılı yarım saatler TEK satıra birleşir: "19:00–21:00 — Fotokopi: 0 kişi"
    for(let ilk = 0; ilk < kotu.length;){
      let son = ilk;
      while(son + 1 < kotu.length && kotu[son + 1].m === kotu[son].m + 30 && kotu[son + 1].count === kotu[ilk].count) son++;
      violations.push(`${hhmm(kotu[ilk].m)}–${hhmm(kotu[son].m + 30)} — ${rule.label}: ${kotu[ilk].count} kişi (kural: min ${rule.min}${rule.max?', max '+rule.max:''})`);
      ilk = son + 1;
    }
    const saatNot = (rule.from || rule.to)
      ? ` <span style="font-weight:400; font-size:10.5px; color:var(--ink-soft)">(${kuralSaatMetni(rule)})</span>` : '';
    return `<div class="trow"><div class="zname">${rule.label}${saatNot}</div><div class="tbar">${segs}</div></div>`;
  }).join('');

  // Kuralın saat aralığı dışındaki boşlukları tek satırda özetle (hata değil)
  const bilgiOzet = bilgiler.length
    ? `<div class="info-item" style="margin-top:8px;">ℹ ${bilgiler.length} yarım saatlik boşluk var ama `
      + `kuralların geçerli olmadığı saatlerde — sorun değil.</div>`
    : '';

  if(gunBos){
    violEl.innerHTML = `<div class="none">Bu gün henüz doldurulmamış — vardiya girilince (elle ya da ✨ Haftayı otomatik oluştur ile) kapsama burada kontrol edilir.</div>`;
  } else if(violations.length === 0){
    violEl.innerHTML = `<div class="none">✓ Bu gün için aktif kurallara göre kapsama sorunu yok.</div>` + bilgiOzet;
  } else {
    violEl.innerHTML = violations.map(v => `<div class="viol-item">${v}</div>`).join('') + bilgiOzet;
  }
}

function renderWeekWarnings(){
  const el = document.getElementById('weekWarn');
  const keys = [...Array(7)].map((_,i)=>fmtDate(addDays(currentMonday,i)));
  const satKey = keys[5], sunKey = keys[6];
  const isOff = a => a && (a.leave === 'IZINLI' || a.leave === 'YILLIK');
  let html = '';

  // 1) hafta sonu çift izin — sadece RUTİN izinde (İZİNLİ) bilgi olarak gösterilir.
  // Patron insiyatifiyle verilebiliyor, ayrıca yıllık izin haftalarca sürebilir:
  // bu yüzden engel değil, sadece hatırlatma. (Jeneratör kendisi asla üretmez.)
  const routineOff = a => a && a.leave === 'IZINLI';
  const offBoth = ROSTER.filter(p =>
    routineOff(weekData.days[satKey].assignments[p.name]) &&
    routineOff(weekData.days[sunKey].assignments[p.name])
  ).map(p => p.name);
  if(offBoth.length){
    html += `<div class="info-head">ℹ Hafta sonu çift izin (rutin) — patron insiyatifiyle verilebilir</div>`
      + offBoth.map(n => `<div class="info-item">${n} — hem Cumartesi hem Pazar izinli</div>`).join('');
  }

  // 2) günlük saat kotası (kurallar.md madde 5)
  //    kota ALTI  -> gerçek hata (eksik çalışma)
  //    kota ÜSTÜ  -> normal (personel eksikliğinde uzayan mesai) — sadece bilgi notu
  const under = [], over = [];
  ROSTER.forEach(p => {
    if(!p.hours) return;
    keys.forEach((key, i) => {
      const a = weekData.days[key].assignments[p.name];
      if(!isWorking(a)) return;
      const dur = (toMin(a.end) - toMin(a.start)) / 60;
      const diff = dur - p.hours;
      // Dükkânın açık olduğu süre kotadan kısaysa (ör. Pazar 11–20 = 9 saat),
      // tüm günü kapsayan vardiya "eksik" sayılmaz.
      const oh = operatingHours(addDays(currentMonday, i));
      const spanH = (toMin(oh.close) - toMin(oh.open)) / 60;
      const coversWholeDay = toMin(a.start) <= toMin(oh.open) && toMin(a.end) >= toMin(oh.close);
      if(diff < -0.01 && !a.early && !a.sundayComp && !(coversWholeDay && spanH < p.hours))
        under.push(`${p.name} — ${DAY_NAMES[i]}: ${a.start}–${a.end} = ${dur} saat (kota ${p.hours}, ${(-diff)} saat eksik)`);
      else if(diff > 0.01) over.push(`${p.name} — ${DAY_NAMES[i]}: ${a.start}–${a.end} = ${dur} saat (kota ${p.hours}, +${diff} saat fazla mesai)`);
    });
  });
  if(under.length){
    html += `<div class="warn-head" style="margin-top:12px;">⚠ Günlük saat eksik</div>`
      + under.map(t => `<div class="viol-item">${t}</div>`).join('');
  }
  if(over.length){
    html += `<div class="info-head" style="margin-top:12px;">ℹ Kota üstü mesai (${over.length}) — personel eksikliğinde normal</div>`
      + over.map(t => `<div class="info-item">${t}</div>`).join('');
  }

  // 3) akşam sorumlusu kapanışa kadar kalıyor mu? (sadece kadrodakiler için —
  // yöneticilerin çizelgede satırı yok, onlar her zaman uygun)
  const supIssues = [];
  keys.forEach((key, i) => {
    const d = weekData.days[key];
    if(!d.sup || !ROSTER.some(p => p.name === d.sup)) return;
    const a = d.assignments[d.sup];
    const close = toMin(operatingHours(addDays(currentMonday, i)).close);
    if(!isWorking(a))
      supIssues.push(`${DAY_NAMES[i]} — ${d.sup} akşam sorumlusu yazılmış ama o gün çalışmıyor`);
    else if(toMin(a.end) < close)
      supIssues.push(`${DAY_NAMES[i]} — ${d.sup} akşam sorumlusu ama vardiyası ${a.end}'de bitiyor (kapanış ${hhmm(close)}) — kapanışa kadar kalmalı`);
  });
  if(supIssues.length){
    html += `<div class="warn-head" style="margin-top:12px;">⚠ Akşam sorumlusu kapanışta değil</div>`
      + supIssues.map(t => `<div class="viol-item">${t}</div>`).join('');
  }

  el.innerHTML = html;
}

function renderValidation(){
  renderRuleToggles();
  renderDayTabs();
  renderTimeline();
  renderWeekWarnings();
  const sb = document.getElementById('suggestBox');
  if(sb) sb.innerHTML = '';  // gün değişince eski öneriyi temizle
  renderCanliDurum();        // 1. panelin altındaki durum kutusu — HER değişiklikte tazelenir
  renderLedger();            // borç/alacak bakiyesini de tazele (async, arka planda)
  renderYillikIzin();        // yıllık izin sayacını da tazele (async, arka planda)
}

/* ---------------------------------------------------------------------
   Faz 5 (ilk adım) — açık kalan bölüm için "kim geçebilir" önerisi
--------------------------------------------------------------------- */
// hhmm -> js/utils.js dosyasına taşındı

function pickCandidate(day, dateStr, dObj, rule, minute){
  const cov = coverageAt(dObj, dateStr, minute);
  const currentZoneOf = p => { const a = day.assignments[p.name]; return a.zone || p.primary[0]; };
  const zoneHasSlack = z => {
    const zr = rules.find(r => r.enabled && r.zones.length === 1 && r.zones[0] === z);
    if(!zr) return true;                        // o bölümde asgari kural yok -> kişi ayrılabilir
    const c = cov[z] ? cov[z].length : 0;
    return c > zr.min;                          // asgarinin üstündeyse biri kaydırılabilir
  };
  const isJoker = p => p.primary.includes('JOKER');
  const prefer = arr => arr.find(p => rule.zones.some(z => p.primary.includes(z))) || arr[0];
  const label = p => { const z = ZONE_MAP[currentZoneOf(p)]; return z ? z.label : ''; };

  const workingCapable = ROSTER.filter(p => {
    const a = day.assignments[p.name];
    return isWorking(a) && toMin(a.start) <= minute && minute < toMin(a.end) && rule.zones.some(z => canCover(p, z));
  });
  const regulars = workingCapable.filter(p => !isOnCall(p));   // ihtiyaç halinde çağrılan hariç

  // 1) EN İYİ: bulunduğu bölümde fazlalık olan düzenli personel (yeni açık doğmaz)
  const spareable = prefer(regulars.filter(p => zoneHasSlack(currentZoneOf(p))));
  if(spareable) return `${spareable.name} geçebilir (şu an ${label(spareable)}, orada fazladan kişi var)`;

  // 2) "çağrılan" kişi zaten dükkândaysa (çağırmaya gerek yok) onu kullan
  const onCallP = ROSTER.find(isOnCall);
  if(onCallP && workingCapable.includes(onCallP)) return `${onCallP.name} zaten dükkânda — buraya geçebilir`;

  // 3) fazlalık yok ama çalışan düzenli biri var — kaydırılabilir (uyarı: başka yerde boşluk doğabilir)
  const anyRegular = prefer(regulars);
  if(anyRegular) return `${anyRegular.name} geçebilir (şu an ${label(anyRegular)} — ama orada boşluk doğabilir)`;

  // 4) son çare: ihtiyaç halinde çağrılan personeli çağır
  const oc = ROSTER.find(isOnCall);
  if(oc && !isWorking(day.assignments[oc.name])) return `son çare: ${oc.name} çağrılabilir`;
  return 'uygun kimse yok — dışarıdan/ek personel gerekli';
}

function suggestForDay(i){
  const dObj = addDays(currentMonday, i);
  const dateStr = fmtDate(dObj);
  const day = weekData.days[dateStr];
  const {open, close} = operatingHours(dObj);
  const openMin = toMin(open), closeMin = toMin(close);
  const out = [];
  rules.filter(r => r.enabled).forEach(rule => {
    let runStart = null;
    for(let m = openMin; m <= closeMin; m += 30){
      let violated = false;
      // Kuralın geçerli olmadığı saatlerde öneri üretme (boş kalması normal)
      if(m < closeMin && kuralGecerliMi(rule, m, openMin, closeMin)){
        const cov = coverageAt(dObj, dateStr, m);
        const c = rule.zones.reduce((s,z) => s + (cov[z] ? cov[z].length : 0), 0);
        violated = c < rule.min;
      }
      if(violated && runStart === null){ runStart = m; }
      if(!violated && runStart !== null){
        out.push({label:rule.label, window:`${hhmm(runStart)}–${hhmm(m)}`, sug:pickCandidate(day, dateStr, dObj, rule, runStart)});
        runStart = null;
      }
    }
  });
  return out;
}

function renderSuggestions(){
  const box = document.getElementById('suggestBox');
  const list = suggestForDay(selectedValidationDay);
  if(list.length === 0){ box.innerHTML = `<div class="none">✓ Bu günde açık yok — önerilecek bir şey yok.</div>`; return; }
  box.innerHTML = `<div class="sug-head">Öneriler (${DAY_NAMES[selectedValidationDay]}):</div>`
    + list.map(x => `<div class="sug-item"><b>${x.label}</b> ${x.window} açık → <span class="sug-fix">${x.sug}</span></div>`).join('');
}
document.getElementById('btnSuggest').addEventListener('click', renderSuggestions);

/* =====================================================================
   CANLI HAFTA DURUMU
   Eskiden 1. panelin altındaki rapor SADECE "Haftayı otomatik oluştur"a
   basınca yazılıyordu. Kullanıcı sonrasında hücreleri elle değiştirse bile
   rapor donup kalıyordu — ekranda hâlâ eski açıklar/uyarılar görünüyordu.
   Artık bu bölüm HER DEĞİŞİKLİKTE yeniden hesaplanır: açıklar, izinsiz
   çalışanlar, kota sapmaları, yetkisiz atamalar, sorumlu sorunları.
===================================================================== */

// Son oluşturmanın raporu (jeneratörün NE YAPTIĞI) — geçmiş bilgi olarak saklanır
let sonOlusturmaRaporu = null;
let sonOlusturmaZamani = null;

function haftaSorunlariniHesapla(){
  const sorunlar = [], notlar = [];
  if(!weekData) return {sorunlar, notlar, sabit:0, bosGunler:[], bosHafta:false};
  const keys = [...Array(7)].map((_,i) => fmtDate(addDays(currentMonday, i)));
  const aktif = rules.filter(r => r.enabled);

  // Hiç vardiya girilmemiş günler: eksik / sorumlu kontrolü YAPILMAZ (kullanıcı henüz o güne gelmemiş
  // ya da hafta tamamen boş). Gün dolmaya başlayınca — elle de olsa — kontrol kendiliğinden açılır.
  const bosGunler = [];
  keys.forEach((k, i) => { if(!gunDoluMu(k)) bosGunler.push(i); });
  const bosHafta = bosGunler.length === 7;

  // 1) KAPSAMA — kuralın geçerli olduğu saatlerde boş kalan aralıklar
  keys.forEach((k, i) => {
    if(bosGunler.includes(i)) return;
    const dObj = addDays(currentMonday, i);
    const oh = operatingHours(dObj);
    const oM = toMin(oh.open), cM = toMin(oh.close);
    aktif.forEach(rule => {
      let bas = null;
      for(let m = oM; m <= cM; m += 30){
        let bos = false;
        if(m < cM && kuralGecerliMi(rule, m, oM, cM)){
          const cov = coverageAt(dObj, k, m);
          const c = rule.zones.reduce((s,z) => s + (cov[z] ? cov[z].length : 0), 0);
          bos = c < rule.min;
        }
        if(bos && bas === null) bas = m;
        if(!bos && bas !== null){
          sorunlar.push({tur:'açık', gun:i, kural:rule.label, aralik:`${hhmm(bas)}–${hhmm(m)}`,
            metin:`${DAY_NAMES[i]} — ${rule.label} ${hhmm(bas)}–${hhmm(m)} arası boş`});
          bas = null;
        }
      }
    });
  });

  // 2) İZİNSİZ ÇALIŞMA — 7 gün çalışan
  ROSTER.forEach(p => {
    if(isOnCall(p)) return;
    let cal = 0, izn = 0;
    keys.forEach(k => {
      const a = weekData.days[k].assignments[p.name];
      if(isWorking(a)) cal++; else if(isOffLeave(a)) izn++;
    });
    if(izn === 0 && cal >= 7)
      sorunlar.push({tur:'izin', metin:`${p.name} 7 gün çalışıyor — hiç izin günü yok`});
  });

  // 3) ÇAKIŞMA — bakamadığı bölüme atanmış
  keys.forEach((k, i) => {
    ROSTER.forEach(p => {
      const a = weekData.days[k].assignments[p.name];
      if(!isWorking(a) || !a.zone) return;
      if(!canCover(p, a.zone)){
        const z = ZONE_MAP[a.zone];
        sorunlar.push({tur:'çakışma', metin:`${DAY_NAMES[i]} — ${p.name} ${z ? z.label : a.zone} bölümüne atanmış ama o bölüme bakamıyor`});
      }
      if(toMin(a.end) <= toMin(a.start))
        sorunlar.push({tur:'çakışma', metin:`${DAY_NAMES[i]} — ${p.name} vardiyası hatalı (${a.start}–${a.end})`});
    });
  });

  // 4) AKŞAM SORUMLUSU
  keys.forEach((k, i) => {
    const d = weekData.days[k];
    const kapanis = toMin(operatingHours(addDays(currentMonday, i)).close);
    if(bosGunler.includes(i)) return;                  // henüz doldurulmamış gün: sorumlu notu da yok
    if(!d.sup){
      if(addDays(currentMonday, i).getDay() !== 0)
        notlar.push(`${DAY_NAMES[i]} — akşam sorumlusu atanmamış`);
      return;
    }
    if(!ROSTER.some(p => p.name === d.sup)) return;   // yönetici
    const a = d.assignments[d.sup];
    if(!isWorking(a))
      sorunlar.push({tur:'sorumlu', metin:`${DAY_NAMES[i]} — ${d.sup} akşam sorumlusu ama o gün çalışmıyor`});
    else if(toMin(a.end) < kapanis)
      sorunlar.push({tur:'sorumlu', metin:`${DAY_NAMES[i]} — ${d.sup} akşam sorumlusu ama ${a.end}'de çıkıyor (kapanış ${hhmm(kapanis)})`});
  });

  // 5) KOTA SAPMASI (bilgi)
  ROSTER.forEach(p => {
    if(!p.hours) return;
    keys.forEach((k, i) => {
      const a = weekData.days[k].assignments[p.name];
      if(!isWorking(a)) return;
      const sure = (toMin(a.end) - toMin(a.start)) / 60;
      const fark = sure - p.hours;
      if(fark > 0.01) notlar.push(`${DAY_NAMES[i]} — ${p.name} ${sure} saat çalışıyor (kotası ${p.hours}, +${fark} fazla)`);
    });
  });

  return {sorunlar, notlar, sabit: (typeof sabitHucreSay === 'function' ? sabitHucreSay() : 0), bosGunler, bosHafta};
}

function renderCanliDurum(){
  const el = document.getElementById('genReport');
  if(!el) return;
  const {sorunlar, notlar, sabit, bosGunler, bosHafta} = haftaSorunlariniHesapla();

  // "Boş kalan saatler" GÜNE göre tek satırda toplanır:
  // "Pazartesi — Fotokopi 19:00–21:00 · Kasa 09:00–10:00"  (eskiden her aralık ayrı satırdı → 35 satır)
  const grup = {}, acikGunler = {};
  sorunlar.forEach(s => {
    if(s.tur === 'açık'){ (acikGunler[s.gun] ||= []).push(`${s.kural} ${s.aralik}`); return; }
    (grup[s.tur] ||= []).push(s.metin);
  });
  const acikSatirlar = Object.keys(acikGunler).map(Number).sort((a, b) => a - b)
    .map(g => `<b>${DAY_NAMES[g]}</b> — ${acikGunler[g].join(' · ')}`);
  if(acikSatirlar.length) grup['açık'] = acikSatirlar;
  const acikSayisi = sorunlar.filter(s => s.tur === 'açık').length;

  const rozet = [];
  if(bosHafta){
    rozet.push(`<span class="sumchip">hafta henüz boş</span>`);
  } else {
    rozet.push(sorunlar.length
      ? `<span class="sumchip bad">${sorunlar.length} sorun</span>`
      : `<span class="sumchip ok">sorun yok</span>`);
    if(bosGunler.length) rozet.push(`<span class="sumchip">${bosGunler.length} gün henüz boş</span>`);
  }
  if(sabit) rozet.push(`<span class="sumchip warn">${sabit} sabit 📌</span>`);
  if(notlar.length) rozet.push(`<span class="sumchip">${notlar.length} not</span>`);

  let html = `<div class="g-head">Bu haftanın durumu `
    + `<span style="font-weight:400; font-size:11px; color:var(--ink-soft)">— canlı, her değişiklikte güncellenir</span></div>`
    + `<div class="sumrow">${rozet.join('')}</div>`;

  const basliklar = {'açık':'Boş kalan saatler', 'izin':'İzin sorunu',
                     'çakışma':'Çakışma', 'sorumlu':'Akşam sorumlusu'};
  Object.entries(grup).forEach(([tur, list]) => {
    const sayi = tur === 'açık' ? acikSayisi : list.length;
    html += `<div class="g-sec">${basliklar[tur] || tur} (${sayi})</div>`
         + list.map(t => `<div class="g-gap">${t}</div>`).join('');
  });

  if(bosHafta){
    html += `<div class="bos-hafta">Bu hafta henüz boş.<br>`
         + `Başlamak için <b>✨ Haftayı otomatik oluştur</b>'a bas — ya da hücrelere tıklayıp kendin doldur. `
         + `Vardiya girdikçe eksikler (kimsenin olmadığı saatler, çakışmalar…) burada görünür.</div>`;
  } else {
    if(!sorunlar.length) html += `<div class="g-ok">✓ Bu haftada çözülmemiş sorun yok.</div>`;
    if(bosGunler.length){
      html += `<div class="g-note" style="margin-top:8px;">Henüz doldurulmamış günler: `
           + `${bosGunler.map(g => DAY_NAMES[g]).join(', ')}. Bu günler için eksik kontrolü yapılmıyor; `
           + `vardiya girdikçe burada görünür.</div>`;
    }
  }

  if(sabit){
    html += `<div class="g-note" style="margin-top:8px;">📌 ${sabit} hücre elle sabitlenmiş. `
         + `Otomatik oluşturma bu günlere dokunmaz. Bir günün yeniden düzenlenmesini `
         + `istersen o hücreye tıklayıp <b>Serbest</b> seçebilirsin.</div>`;
  }

  if(notlar.length){
    html += `<details class="g-det"><summary>Bilgi notları (${notlar.length})</summary>`
         + notlar.map(t => `<div class="g-note">· ${t}</div>`).join('') + `</details>`;
  }

  // Jeneratörün en son ne yaptığı — GEÇMİŞ bilgi, zamanı yazılır ki karışmasın
  if(sonOlusturmaRaporu){
    const r = sonOlusturmaRaporu;
    const zaman = sonOlusturmaZamani ? sonOlusturmaZamani.toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'}) : '';
    const parca = [];
    if(r.moves && r.moves.length) parca.push([`Sistemin yaptığı düzenlemeler (${r.moves.length})`, r.moves]);
    if(r.warnings && r.warnings.length) parca.push([`Oluşturma uyarıları (${r.warnings.length})`, r.warnings]);
    if(r.info && r.info.length) parca.push([`Korunanlar ve notlar (${r.info.length})`, r.info]);
    if(parca.length){
      html += `<div class="g-sec" style="margin-top:14px;">Son otomatik oluşturma${zaman ? ' (saat ' + zaman + ')' : ''}</div>`;
      parca.forEach(([baslik, list]) => {
        html += `<details class="g-det"><summary>${baslik}</summary>`
             + list.map(t => `<div class="g-note">· ${t}</div>`).join('') + `</details>`;
      });
    }
  }

  el.innerHTML = html;
}
