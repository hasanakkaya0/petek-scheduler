/* =====================================================================
   OTOMATİK KOPYALAR — günde bir kez, son 14 gün
   Bulut paylaşım içindir, geçmiş tutmaz: bir yanlış "Haftayı sıfırla" ya da
   "Tamamen sil" bütün bilgisayarlardan anında silinir. Bu yüzden program, her
   gün ilk açıldığında tüm veriyi (ayarlar + bütün haftalar, "Yedek al (JSON)"
   ile aynı biçimde) sıkıştırıp buluta AYRI bir yere kaydeder ve son 14 günü saklar.

     workspaces/petek/yedekler/<YYYY-AA-GG>   { gun, etiket, hafta, boyut, bicim, veri, olusturma, by }

   Neden sıkıştırma: 76 haftalık veri ~1,1 MB; Firestore belgesi en fazla ~1 MB.
   gzip + base64 ile ~100-200 KB'a iner. Ana veriden AYRI bir koleksiyon olduğu için
   normal açılışta okunmaz (okuma/maliyet artmaz).

   Geri yükleme: menüden "Otomatik kopyalar" → bir güne dön. Dönmeden önce o anki
   hâlin de güvenlik kopyası alınır ("…-once-SSDD"); geri dönülünce o kopyadan sonra
   açılmış haftalar da silinir (gerçek bir geri dönüş olsun diye).

   Yalnızca bulut açıkken çalışır. NOT: bulut.js'ten sonra yüklenir.
===================================================================== */
const OtoKopya = (function(){
  const SAKLA_GUN = 14;
  const SINIR = 900000;            // sıkıştırılmış metin bu kadar karakteri geçerse kaydedilmez (belge sınırı)
  const api = {};

  /* ---------- sıkıştırma ---------- */
  function baytlarToB64(u8){
    let s = '';
    for(let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function b64ToBaytlar(b64){
    const s = atob(b64), u8 = new Uint8Array(s.length);
    for(let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8;
  }
  async function akisla(u8, donusturucu){
    return new Uint8Array(await new Response(new Response(u8).body.pipeThrough(donusturucu)).arrayBuffer());
  }

  api.sikistir = async function(obj){
    const metin = JSON.stringify(obj);
    const ham = new TextEncoder().encode(metin);
    if(typeof CompressionStream === 'undefined') return {bicim: 'json', veri: metin, boyut: ham.length};
    const sik = await akisla(ham, new CompressionStream('gzip'));
    return {bicim: 'gzip-base64', veri: baytlarToB64(sik), boyut: ham.length};
  };

  api.ac = async function(doc){
    if(!doc) throw new Error('kopya bulunamadi');
    if(doc.bicim === 'json') return JSON.parse(doc.veri);
    const acik = await akisla(b64ToBaytlar(doc.veri), new DecompressionStream('gzip'));
    return JSON.parse(new TextDecoder().decode(acik));
  };

  /* ---------- kopya alma ---------- */
  api.kopyaAl = async function(id, etiket){
    const obj = await collectBackup();
    const haftaSayisi = Object.keys(obj.weeks || {}).length;
    const kisiSayisi = ((obj.settings && obj.settings.people) || []).length;
    if(!haftaSayisi && !kisiSayisi) return {id, bos: true};          // boş veriyi yedeklemenin anlamı yok
    const pak = await api.sikistir(obj);
    if(pak.veri.length > SINIR) throw new Error('Kopya Firestore belge sınırına sığmıyor (' + Math.round(pak.veri.length / 1024) + ' KB)');
    await Bulut.kopyaYaz(id, {gun: id.slice(0, 10), etiket: etiket || 'gunluk', hafta: haftaSayisi,
      boyut: pak.boyut, bicim: pak.bicim, veri: pak.veri});
    return {id, hafta: haftaSayisi, boyut: pak.boyut, sikisikBoyut: pak.veri.length};
  };

  api.eskileriSil = async function(){
    const bugun = new Date();
    for(let g = SAKLA_GUN; g < SAKLA_GUN + 16; g++){
      const d = new Date(bugun); d.setDate(d.getDate() - g);
      await Bulut.kopyaSil(fmtDate(d));
    }
  };

  // Günde bir kez: bugünün kopyası yoksa al. Dönen: 'alindi' | 'vardi' | 'zaten' | 'bos' | null
  api.gunluk = async function(){
    if(typeof Bulut === 'undefined' || !Bulut.aktif()) return null;
    const bugun = fmtDate(new Date());
    try{ if(localStorage.getItem('petek-son-kopya') === bugun) return 'zaten'; }catch(e){ /* depolama yok */ }
    let sonuc;
    if(await Bulut.kopyaVarMi(bugun)) sonuc = 'vardi';
    else{
      const r = await api.kopyaAl(bugun, 'gunluk');
      sonuc = r.bos ? 'bos' : 'alindi';
    }
    if(sonuc !== 'bos'){
      await api.eskileriSil();
      try{ localStorage.setItem('petek-son-kopya', bugun); }catch(e){ /* önemli değil */ }
    }
    return sonuc;
  };

  /* ---------- geri yükleme ---------- */
  api.geriYukle = async function(id){
    const obj = await api.ac(await Bulut.kopyaOku(id));
    const t = new Date();
    const p = n => String(n).padStart(2, '0');
    await api.kopyaAl(fmtDate(t) + '-once-' + p(t.getHours()) + p(t.getMinutes()), 'geri-donus-oncesi');   // güvenlik kopyası
    await yedegiUygula(obj, {birebir: true});
    return {hafta: Object.keys(obj.weeks || {}).length};
  };

  /* ---------- arayüz ---------- */
  function gunMetni(id, etiket){
    const gun = id.slice(0, 10);
    let m = gun;
    try{ m = new Date(gun + 'T00:00').toLocaleDateString('tr-TR', {day: 'numeric', month: 'long', year: 'numeric', weekday: 'long'}); }catch(e){ /* ham tarih */ }
    return etiket === 'geri-donus-oncesi' ? m + ' — geri dönüş öncesi (' + id.slice(-4).replace(/(..)(..)/, '$1:$2') + ')' : m;
  }

  api.arayuzuAc = async function(){
    const kaplama = document.getElementById('kopyaOverlay'), kutu = document.getElementById('kopyaListe');
    if(!kaplama || !kutu) return;
    kaplama.classList.add('show');
    kutu.textContent = 'Yükleniyor…';
    let liste;
    try{ liste = await Bulut.kopyaListe(); }
    catch(e){ kutu.textContent = 'Kopyalar okunamadı (internet bağlantısını kontrol et).'; return; }
    if(!liste.length){ kutu.textContent = 'Henüz otomatik kopya yok. Her gün programın ilk açılışında bir kopya alınır.'; return; }
    kutu.innerHTML = '';
    liste.forEach(k => {
      const satir = document.createElement('div');
      satir.className = 'kopya-satir';
      const bilgi = document.createElement('div');
      bilgi.className = 'kopya-bilgi';
      bilgi.textContent = gunMetni(k.id, k.etiket) + ' — ' + k.hafta + ' hafta, ' + Math.round((k.boyut || 0) / 1024) + ' KB';
      const indir = document.createElement('button');
      indir.className = 'tool'; indir.textContent = 'İndir';
      indir.onclick = async () => {
        const obj = await api.ac(await Bulut.kopyaOku(k.id));
        const bag = document.createElement('a');
        bag.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], {type: 'application/json'}));
        bag.download = 'petek_kopya_' + k.id + '.json'; bag.click();
      };
      const don = document.createElement('button');
      don.className = 'tool'; don.textContent = 'Bu kopyaya dön';
      don.style.cssText = 'border-color:var(--red); color:var(--red);';
      don.onclick = async () => {
        if(!confirm(gunMetni(k.id, k.etiket) + ' tarihli kopyaya dönülecek.\n\n'
          + '» Şu anki bütün veriler (personel, ayarlar, haftalar) o günkü hâline döner\n'
          + '» O günden SONRA yapılan değişiklikler ve açılan haftalar kaybolur\n'
          + '» Dönmeden önce şu anki hâlin güvenlik kopyası da alınır (listede görünür)\n\n'
          + 'Devam edilsin mi?')) return;
        don.disabled = true; don.textContent = 'Dönülüyor…';
        try{
          const r = await api.geriYukle(k.id);
          kaplama.classList.remove('show');
          alert('Tamam: ' + r.hafta + ' haftalık veri ' + gunMetni(k.id, k.etiket) + ' hâline döndü.');
        }catch(e){ don.disabled = false; don.textContent = 'Bu kopyaya dön'; alert('Geri dönülemedi: ' + e.message); }
      };
      satir.appendChild(bilgi); satir.appendChild(indir); satir.appendChild(don);
      kutu.appendChild(satir);
    });
  };

  return api;
})();
