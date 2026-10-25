/* =====================================================================
   KİŞİLERİ BİRLEŞTİR + YENİDEN İŞE AL
   Sorun: işten ayrılan biri geri gelince "aynı isimde kayıt var" uyarısı yüzünden yeni kayıt
   açılıyor ("Defne Hanım" → "Defne Hanım."). O zaman aynı kişi İKİ kayıt olur: Borç/Alacak
   bakiyesi, yıllık izin sayacı ve geçmiş haftalar ikiye bölünür.

   Çözüm:
     - "Aynı kişiyle birleştir": iki kaydı TEK kayıtta toplar. Vardiyalar, Borç/Alacak hareketleri,
       akşam sorumlusu atamaları ve yıllık izinler seçilen isme taşınır. Önizleme gösterir,
       onay ister, ÖNCE bir güvenlik kopyası alır.
     - "Yeniden işe al": ayrılmış kaydı yeniden canlandırır (yeni kayıt açmaya gerek kalmaz).
     - Benzer kayıtlar için uyarı kutusu ("bunlar aynı kişi olabilir"); "Aynı kişi değil" denirse
       bir daha sorulmaz (ayarlarda `ayriKisiler`).

   Dönemler: kayıtta startWeek (bu haftadan itibaren) / endWeek (bu haftaya kadar) vardır.
   NOT: Bu dosya settings-panels.js'ten sonra yüklenir.
===================================================================== */
const KisiBirlestir = (function(){
  const api = {};
  const SONSUZ = '9999-99-99';

  /* ---------- ad karşılaştırma ---------- */
  const HARF = {'Ç':'c','ç':'c','Ğ':'g','ğ':'g','İ':'i','ı':'i','Ö':'o','ö':'o','Ş':'s','ş':'s','Ü':'u','ü':'u'};
  api.norm = ad => String(ad || '').replace(/[ÇçĞğİıÖöŞşÜü]/g, c => HARF[c])
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  api.ilkAd = ad => api.norm(ad).split(' ')[0] || '';
  api.cift = (a, b) => [a, b].sort().join('|');

  /* ---------- dönemler ---------- */
  const donem = p => ({bas: p.startWeek || '', son: p.endWeek || SONSUZ});
  const aktifMi = (p, hafta) => donem(p).bas <= hafta && hafta <= donem(p).son;     // hafta = 'YYYY-MM-DD' (Pazartesi)
  api.kesisiyor = (a, b) => donem(a).bas <= donem(b).son && donem(b).bas <= donem(a).son;

  // Eski kaydın son haftası ile yeni kaydın ilk haftası arasında kaç tam hafta BOŞLUK var? (0 = kesintisiz)
  api.bosHaftaSayisi = function(sonHafta, ilkHafta){
    if(!sonHafta || !ilkHafta) return 0;
    const fark = Math.round((new Date(ilkHafta + 'T00:00') - new Date(sonHafta + 'T00:00')) / 604800000);
    return Math.max(0, fark - 1);
  };

  /* ---------- şüpheli çiftler ---------- */
  // Aynı ilk ad + biri AYRILMIŞ olan kayıtlar "aynı kişi olabilir". İkisi de aktifse sorulmaz
  // (iki farklı "Kişi J" olabilir). Kullanıcı "aynı kişi değil" dediyse (ayriKisiler) listelenmez.
  api.adaylar = function(){
    const liste = [];
    for(let i = 0; i < PEOPLE.length; i++) for(let j = i + 1; j < PEOPLE.length; j++){
      const a = PEOPLE[i], b = PEOPLE[j];
      if(!api.ilkAd(a.name) || api.ilkAd(a.name) !== api.ilkAd(b.name)) continue;
      if(!a.endWeek && !b.endWeek) continue;
      if(typeof ayriKisiler !== 'undefined' && ayriKisiler.includes(api.cift(a.name, b.name))) continue;
      liste.push({a, b, anahtar: api.cift(a.name, b.name)});
    }
    return liste;
  };

  // Hangisi KALAN (eski kayıt, geçmişi taşıyan), hangisi KAYNAK (yeni kayıt)? Ayrılmış olan kalan olur.
  api.roller = function(x, y){
    if(x.endWeek && !y.endWeek) return {kalan: x, kaynak: y};
    if(y.endWeek && !x.endWeek) return {kalan: y, kaynak: x};
    return (x.endWeek || '') <= (y.endWeek || '') ? {kalan: x, kaynak: y} : {kalan: y, kaynak: x};
  };

  /* ---------- birleşik kayıt ---------- */
  // Ayarlar (görev, saat, tercihler) EN GÜNCEL kayıttan gelir: ayrılmamış olandan; ikisi de
  // ayrılmışsa daha geç başlayandan. Ad seçilen addır; dönem her ikisini kapsar.
  api.birlesikKayit = function(kalan, kaynak, ad){
    const kaynakAyar = (kaynak.endWeek && !kalan.endWeek) ? kalan
      : (kalan.endWeek && !kaynak.endWeek) ? kaynak
      : ((kaynak.startWeek || '') >= (kalan.startWeek || '') ? kaynak : kalan);
    const diger = kaynakAyar === kaynak ? kalan : kaynak;
    const rec = JSON.parse(JSON.stringify(kaynakAyar));
    rec.name = ad;
    if(!kalan.startWeek || !kaynak.startWeek) delete rec.startWeek;
    else rec.startWeek = kalan.startWeek < kaynak.startWeek ? kalan.startWeek : kaynak.startWeek;
    if(!kalan.endWeek || !kaynak.endWeek) delete rec.endWeek;
    else rec.endWeek = kalan.endWeek > kaynak.endWeek ? kalan.endWeek : kaynak.endWeek;
    if(rec.izinHakki == null && diger.izinHakki != null) rec.izinHakki = diger.izinHakki;
    return rec;
  };

  /* ---------- haftalık kayıtlar üzerinde işlem ---------- */
  const bosHucre = a => !a || (a.leave === 'NONE' && !a.start && !a.end);

  // Bir günün hücresini seçer: dolu olan; ikisi de doluysa o haftada KADRODA olan; yine eşitse KALAN
  function hucreSec(hafta, kalan, kaynak, hK, hN, sayac){
    if(bosHucre(hK) && bosHucre(hN)) return null;
    if(bosHucre(hK)) return hN;
    if(bosHucre(hN)) return hK;
    sayac.cakisma++;
    return (aktifMi(kaynak, hafta) && !aktifMi(kalan, hafta)) ? hN : hK;
  }

  // Bir hafta belgesini yeniden adlandırarak dönüştürür; değişen gün/hücre sayılarını verir
  function haftayiIsle(anahtar, wd, kalan, kaynak, yeniAd, sayac, yaz){
    const hafta = anahtar.slice(5);
    let degisti = false;
    Object.keys(wd.days || {}).forEach(gun => {
      const g = wd.days[gun], asg = g.assignments || {};
      const hK = asg[kalan.name], hN = asg[kaynak.name];
      if(hK !== undefined || hN !== undefined){
        const secilen = hucreSec(hafta, kalan, kaynak, hK, hN, sayac);
        if(!bosHucre(hN)){ sayac.hucre++; if(hN.leave === 'YILLIK') sayac.yillik++; }
        if(yaz){
          delete asg[kalan.name]; delete asg[kaynak.name];
          if(secilen) asg[yeniAd] = secilen;
          else if(hK !== undefined || hN !== undefined) asg[yeniAd] = hK !== undefined ? hK : hN;
        }
        degisti = true;
      }
      if(g.sup === kalan.name || g.sup === kaynak.name){
        sayac.sup++;
        if(yaz) g.sup = yeniAd;
        degisti = true;
      }
    });
    if(degisti) sayac.hafta++;
    return degisti;
  }

  async function haftalariTara(kalan, kaynak, yeniAd, yaz){
    const sayac = {hafta: 0, hucre: 0, cakisma: 0, sup: 0, yillik: 0};
    const simdiki = 'week:' + fmtDate(currentMonday);
    for(const k of await store.listKeys('week:')){
      let wd, bellekte = false;
      if(k === simdiki && weekData){ wd = weekData; bellekte = true; }
      else {
        const r = await store.get(k);
        if(!r || !r.value) continue;
        try{ wd = JSON.parse(r.value); }catch(e){ continue; }
      }
      const degisti = haftayiIsle(k, wd, kalan, kaynak, yeniAd, sayac, yaz);
      if(yaz && degisti){
        if(bellekte) scheduleSave(); else await store.set(k, JSON.stringify(wd));
      }
    }
    return sayac;
  }

  /* ---------- önizleme ---------- */
  api.onizle = async function(kalanAd, kaynakAd, yeniAd){
    const kalan = PEOPLE.find(p => p.name === kalanAd), kaynak = PEOPLE.find(p => p.name === kaynakAd);
    if(!kalan || !kaynak || kalan === kaynak) throw new Error('Kayıtlar bulunamadı');
    const sayac = await haftalariTara(kalan, kaynak, yeniAd || kalan.name, false);
    sayac.ledger = ledger.filter(e => e.name === kalanAd || e.name === kaynakAd).length;
    const eski = kalan.endWeek ? kalan : (kaynak.endWeek ? kaynak : null);
    const yeni = eski === kalan ? kaynak : kalan;
    sayac.bosluk = (eski && yeni && yeni.startWeek) ? api.bosHaftaSayisi(eski.endWeek, yeni.startWeek) : 0;
    sayac.kesisiyor = api.kesisiyor(kalan, kaynak);
    sayac.birlesik = api.birlesikKayit(kalan, kaynak, yeniAd || kalan.name);
    return sayac;
  };

  /* ---------- güvenlik kopyası ---------- */
  async function onceKopya(){
    if(typeof bulutAktif === 'function' && bulutAktif() && typeof OtoKopya !== 'undefined'){
      const t = new Date(), p = n => String(n).padStart(2, '0');
      await OtoKopya.kopyaAl(fmtDate(t) + '-once-' + p(t.getHours()) + p(t.getMinutes()), 'birlestirme-oncesi');
      return 'bulut';
    }
    // Bulut yoksa yedeği DOSYA olarak indir
    try{
      const obj = await collectBackup();
      const bag = document.createElement('a');
      bag.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], {type: 'application/json'}));
      bag.download = 'petek_birlestirme_oncesi_' + fmtDate(new Date()) + '.json';
      bag.click();
    }catch(e){ /* indirme başarısız: işlem yine de önizlemeyle onaylanmıştı */ }
    return 'dosya';
  }

  /* ---------- uygulama ---------- */
  api.uygula = async function(kalanAd, kaynakAd, yeniAd){
    const kalan = PEOPLE.find(p => p.name === kalanAd), kaynak = PEOPLE.find(p => p.name === kaynakAd);
    if(!kalan || !kaynak || kalan === kaynak) throw new Error('Kayıtlar bulunamadı');
    if(yeniAd !== kalanAd && yeniAd !== kaynakAd) throw new Error('Geçersiz ad');
    const kopya = await onceKopya();                                       // 1) ÖNCE güvenlik kopyası

    const birlesik = api.birlesikKayit(kalan, kaynak, yeniAd);
    const sayac = await haftalariTara(kalan, kaynak, yeniAd, true);        // 2) vardiya/sorumlu/izinler yeni ada
    ledger.forEach(e => { if(e.name === kalanAd || e.name === kaynakAd) e.name = yeniAd; });   // 3) Borç/Alacak

    // 4) kişi kaydı: aktif olanın yerine birleşik kayıt, diğeri silinir
    const konum = PEOPLE.indexOf(kalan.endWeek && !kaynak.endWeek ? kaynak : kalan);
    PEOPLE = PEOPLE.filter(p => p !== kalan && p !== kaynak);
    PEOPLE.splice(Math.min(konum, PEOPLE.length), 0, birlesik);

    await saveSettings();
    undoTemizle();
    rebuildPeople(); haftayaGoreKadroyuTazele(); ensureWeekPeople();
    renderAll();
    return Object.assign(sayac, {kopya, ad: yeniAd});
  };

  /* ---------- yeniden işe al ---------- */
  api.yenidenIseAl = async function(ad){
    const p = PEOPLE.find(x => x.name === ad);
    if(!p || !p.endWeek) return null;
    const bosluk = api.bosHaftaSayisi(p.endWeek, fmtDate(currentMonday));
    const eskiSon = p.endWeek;
    delete p.endWeek;
    await saveSettings();
    rebuildPeople(); haftayaGoreKadroyuTazele(); ensureWeekPeople();
    renderAll();
    return {bosluk, eskiSon};
  };

  /* =====================  ARAYÜZ  ===================== */
  const kisiEtiketi = p => p.name + (p.endWeek ? ' — ayrıldı (' + p.endWeek + ' haftası)' : (p.startWeek ? ' — ' + p.startWeek + ' tarihinden itibaren' : ' — aktif'));
  let acik = null;     // {x, y} açık pencerenin durumu

  api.uyariCiz = function(){
    const el = document.getElementById('kisiUyari');
    if(!el) return;
    const liste = api.adaylar();
    if(!liste.length){ el.innerHTML = ''; return; }
    el.innerHTML = liste.map(c => '<div class="kisi-uyari"><span>⚠ <b>' + esc(c.a.name) + '</b> ile <b>' + esc(c.b.name)
      + '</b> aynı kişi olabilir.</span> <button class="tool kb-birlestir" data-a="' + escAttr(c.a.name) + '" data-b="' + escAttr(c.b.name) + '">Birleştir…</button>'
      + ' <button class="linkbtn kb-degil" data-anahtar="' + escAttr(c.anahtar) + '">Aynı kişi değil</button></div>').join('');
  };
  function esc(s){ return String(s).replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c])); }
  function escAttr(s){ return esc(s).replace(/"/g, '&quot;'); }

  async function onizlemeyiGuncelle(adSecenekleriniKur){
    const kapsa = document.getElementById('kbOnizleme'), uygula = document.getElementById('kbUygula');
    const ad1 = acik.x, ad2 = document.getElementById('kbDiger').value;
    if(!ad2){ kapsa.textContent = 'Birleştirilecek diğer kaydı seç.'; uygula.disabled = true; return; }
    const x = PEOPLE.find(p => p.name === ad1), y = PEOPLE.find(p => p.name === ad2);
    const r = api.roller(x, y);
    const adSecim = document.getElementById('kbAd');
    if(adSecenekleriniKur) adSecim.innerHTML = [r.kalan.name, r.kaynak.name].map(a => '<option value="' + escAttr(a) + '">' + esc(a) + '</option>').join('');   // yalnız diğer kayıt değişince; ad seçimi korunur
    kapsa.textContent = 'Hesaplanıyor…'; uygula.disabled = true;
    const o = await api.onizle(r.kalan.name, r.kaynak.name, adSecim.value);
    const satir = [];
    satir.push('<b>' + esc(o.birlesik.name) + '</b> adıyla TEK kayıt olacak (' + esc(o.birlesik.type || '') + (o.birlesik.hours ? ', ' + o.birlesik.hours + ' sa' : '') + '). Ayarlar en güncel kayıttan gelir.');
    satir.push('• <b>' + o.hafta + '</b> haftadaki kayıt birleşecek (' + o.hucre + ' dolu hücre taşınacak).');
    if(o.ledger) satir.push('• <b>' + o.ledger + '</b> Borç/Alacak hareketi tek isimde toplanacak.');
    if(o.yillik) satir.push('• <b>' + o.yillik + '</b> gün yıllık izin tek sayaçta toplanacak.');
    if(o.sup) satir.push('• <b>' + o.sup + '</b> akşam sorumlusu ataması yeni ada geçecek.');
    if(o.bosluk) satir.push('<span class="kb-uyari">⚠ İki kayıt arasında <b>' + o.bosluk + ' hafta</b> boşluk var. Birleşince kişi o haftalarda da kadroda görünür (vardiyası boş).</span>');
    if(o.kesisiyor) satir.push('<span class="kb-uyari">⚠ İki kayıt <b>aynı haftalarda</b> kadroda görünüyor. ' + o.cakisma + ' günde ikisinde de vardiya var; bu günlerde KALAN (eski) kaydın vardiyası korunur.</span>');
    satir.push('<span class="kb-not">Birleştirmeden önce otomatik bir güvenlik kopyası alınır.</span>');
    kapsa.innerHTML = satir.join('<br>');
    uygula.disabled = false;
  }

  api.pencereAc = function(adX, adY){
    const x = PEOPLE.find(p => p.name === adX);
    if(!x) return;
    acik = {x: adX};
    document.getElementById('kbBaslik').textContent = '"' + adX + '" kaydını birleştir';
    const digerler = PEOPLE.filter(p => p !== x);
    document.getElementById('kbDiger').innerHTML = '<option value="">— seç —</option>'
      + digerler.map(p => '<option value="' + escAttr(p.name) + '">' + esc(kisiEtiketi(p)) + '</option>').join('');
    if(adY) document.getElementById('kbDiger').value = adY;
    document.getElementById('kbOnizleme').textContent = adY ? 'Hesaplanıyor…' : 'Birleştirilecek diğer kaydı seç.';
    document.getElementById('kbUygula').disabled = true;
    document.getElementById('birlestirOverlay').classList.add('show');
    if(adY) onizlemeyiGuncelle(true).catch(e => { document.getElementById('kbOnizleme').textContent = 'Hata: ' + e.message; });
  };

  document.addEventListener('click', async e => {
    const t = e.target.closest ? e.target.closest('button') : null;
    if(!t) return;
    try{
      if(t.classList.contains('kb-birlestir')) api.pencereAc(t.dataset.a, t.dataset.b);
      else if(t.classList.contains('pbirlestir')) api.pencereAc(t.dataset.name, null);
      else if(t.id === 'pBirlestir'){ document.getElementById('personOverlay').classList.remove('show'); api.pencereAc(editingPerson, null); }
      else if(t.classList.contains('kb-degil')){
        if(typeof ayriKisiler !== 'undefined' && !ayriKisiler.includes(t.dataset.anahtar)){ ayriKisiler.push(t.dataset.anahtar); await saveSettings(); }
        api.uyariCiz();
      }
      else if(t.classList.contains('pyeniden')){
        const ad = t.dataset.name, p = PEOPLE.find(x => x.name === ad);
        const bosluk = api.bosHaftaSayisi(p.endWeek, fmtDate(currentMonday));
        if(!confirm(ad + ' yeniden işe alınsın mı?\n\n» Ayrılma kaydı kaldırılır; çizelgede yeniden görünür.\n» Geçmiş vardiyaları, Borç/Alacak ve izin kayıtları AYNI kayıtta devam eder.'
          + (bosluk ? '\n\n⚠ Ayrılma ile bu hafta arasında ' + bosluk + ' hafta var; o haftalarda da kadroda görünür (vardiyası boş).' : ''))) return;
        await api.yenidenIseAl(ad);
        bildirimGoster(ad + ' yeniden işe alındı.');
      }
      else if(t.id === 'kbIptal') document.getElementById('birlestirOverlay').classList.remove('show');
      else if(t.id === 'kbUygula'){
        const ad2 = document.getElementById('kbDiger').value, yeniAd = document.getElementById('kbAd').value;
        const r = api.roller(PEOPLE.find(p => p.name === acik.x), PEOPLE.find(p => p.name === ad2));
        t.disabled = true; t.textContent = 'Birleştiriliyor…';
        try{
          const s = await api.uygula(r.kalan.name, r.kaynak.name, yeniAd);
          document.getElementById('birlestirOverlay').classList.remove('show');
          alert('Birleştirildi: ' + s.ad + '\n\n' + s.hafta + ' hafta güncellendi.' + (s.kopya === 'dosya' ? '\nGüvenlik kopyası indirilen dosyada.' : '\nGüvenlik kopyası "Otomatik kopyalar" listesinde.'));
        } finally { t.textContent = 'Birleştir'; }
      }
    }catch(err){ alert('İşlem yapılamadı: ' + err.message); }
  });
  document.addEventListener('change', e => {
    if(!acik) return;
    if(e.target && (e.target.id === 'kbDiger' || e.target.id === 'kbAd')) onizlemeyiGuncelle(e.target.id === 'kbDiger').catch(err => { document.getElementById('kbOnizleme').textContent = 'Hata: ' + err.message; });
  });

  return api;
})();
