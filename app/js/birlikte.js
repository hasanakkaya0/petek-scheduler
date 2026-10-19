/* =====================================================================
   BİRLİKTE ÇALIŞMA — "Başka bir bilgisayarda da bu hafta açık" uyarısı
   İki kişi AYNI haftayı aynı anda düzenlerse son kaydeden kazanır (hafta
   belgesi bütün olarak yazılır) ve biri sessizce kaybedebilir. Tam engel
   koymak yerine, ikinci bir kişi aynı haftadayken sayfada uyarı gösterilir.

   NASIL: Her sekme/bilgisayar bulutta küçük bir "yoklama" kaydı tutar:
     presence:<kimlik>  =  {hafta, t: son yoklama zamanı, d: son düzenleme zamanı}
   Kendi kaydını 30 sn'de bir yeniler, sayfadan çıkınca siler. 75 sn'den eski
   yoklama "yok" sayılır (bilgisayar kapandı/internet kesildi). Çok eski kayıtlar
   (10 dk) temizlenir.

   Bulut kapalıyken (yerel mod, ?deneme, file://) hiçbir şey yapmaz.
   NOT: Bu dosya bulut.js ve storage.js'ten SONRA yüklenir.
===================================================================== */
const Birlikte = (function(){
  const GECERLI_MS = 75000;     // yoklama bu kadar yeniyse "aktif" sayılır
  const ADIM_MS = 30000;        // kendi yoklamamızı yenileme aralığı
  const TEMIZLE_MS = 600000;    // bu kadar eski yoklamalar silinir
  const DUZENLEDI_MS = 90000;   // "az önce değişiklik yapıldı" eşiği

  let aktif = false, hafta = null, sonDuzenleme = 0, kimlik = null;
  let adimZamani = null, bannerZamani = null;
  const api = {};

  function yeniKimlik(){
    try{
      let k = sessionStorage.getItem('petek-kimlik');
      if(!k){ k = Math.random().toString(36).slice(2, 8); sessionStorage.setItem('petek-kimlik', k); }
      return k;
    }catch(e){ return Math.random().toString(36).slice(2, 8); }
  }

  /* SAF FONKSİYON (test edilebilir): kayıtlar = [{id, deger: {hafta,t,d}}]
     Bu hafta BİZDEN BAŞKA kim aktif? */
  api.degerlendir = function(kayitlar, benimId, buHafta, simdi){
    let digerSayisi = 0, azOnceDuzenleyen = false;
    (kayitlar || []).forEach(k => {
      if(!k || k.id === benimId || !k.deger) return;
      if(k.deger.hafta !== buHafta) return;
      if(!(simdi - k.deger.t <= GECERLI_MS)) return;               // eski yoklama
      digerSayisi++;
      if(k.deger.d && simdi - k.deger.d <= DUZENLEDI_MS) azOnceDuzenleyen = true;
    });
    return {digerSayisi, azOnceDuzenleyen};
  };

  api.metin = function(sonuc){
    if(!sonuc || !sonuc.digerSayisi) return '';
    const kim = sonuc.digerSayisi > 1 ? 'Başka ' + sonuc.digerSayisi + ' bilgisayarda/sekmede' : 'Başka bir bilgisayarda/sekmede';
    return '⚠ ' + kim + ' da bu hafta açık.'
      + (sonuc.azOnceDuzenleyen ? ' Az önce orada değişiklik yapıldı.' : '')
      + ' Aynı anda düzenlerseniz son kaydeden kazanır — biriniz bekleyin.';
  };

  function simdi(){ return Date.now(); }

  function yaz(){
    if(!aktif || !hafta) return;
    if(typeof document !== 'undefined' && document.hidden) return;   // gizli sekme yoklama yazmaz
    Bulut.set('presence:' + kimlik, JSON.stringify({hafta, t: simdi(), d: sonDuzenleme}));
  }

  async function kayitlariOku(){
    const anahtarlar = await Bulut.listKeys('presence:');
    const out = [];
    for(const k of anahtarlar){
      const r = await Bulut.get(k);
      try{ out.push({id: k.slice('presence:'.length), deger: JSON.parse(r.value)}); }catch(e){ /* bozuk kayıt */ }
    }
    return out;
  }

  async function bannerGuncelle(){
    const el = (typeof document !== 'undefined') ? document.getElementById('baskaDuzenliyor') : null;
    if(!el) return;
    if(!aktif){ el.hidden = true; return; }
    let kayitlar = [];
    try{ kayitlar = await kayitlariOku(); }catch(e){ return; }
    const metin = api.metin(api.degerlendir(kayitlar, kimlik, hafta, simdi()));
    el.textContent = metin;
    el.hidden = !metin;
  }
  api.bannerGuncelle = bannerGuncelle;

  async function eskileriTemizle(){
    try{
      const kayitlar = await kayitlariOku();
      for(const k of kayitlar){
        if(k.id !== kimlik && !(simdi() - k.deger.t <= TEMIZLE_MS)) await Bulut.sil('presence:' + k.id);
      }
    }catch(e){ /* önemli değil */ }
  }

  api.baslat = function(){
    if(typeof Bulut === 'undefined' || !Bulut.aktif()) return;
    aktif = true; kimlik = yeniKimlik();
    eskileriTemizle();
    adimZamani = setInterval(() => { yaz(); bannerGuncelle(); }, ADIM_MS);
    bannerZamani = setInterval(bannerGuncelle, 10000);
    if(typeof document !== 'undefined' && document.addEventListener)
      document.addEventListener('visibilitychange', () => { if(!document.hidden){ yaz(); bannerGuncelle(); } });
    if(typeof window !== 'undefined' && window.addEventListener)
      window.addEventListener('pagehide', () => { if(Bulut.aktif()) Bulut.sil('presence:' + kimlik); });
  };

  // Hafta değişince (renderHeader'dan çağrılır) hemen yoklama yaz
  api.hafta = function(h){
    if(!aktif) return;
    if(h !== hafta){ hafta = h; yaz(); }
    bannerGuncelle();
  };

  // Kullanıcı bir şeyi değiştirdi (scheduleSave'den çağrılır)
  api.duzenlendi = function(){ sonDuzenleme = simdi(); };

  // Diğer bilgisayardan yoklama değişti → sadece uyarıyı tazele
  api.uzakYoklama = function(){ bannerGuncelle(); };

  // test için
  api._testKimlik = () => kimlik;
  api._testDurdur = () => { aktif = false; clearInterval(adimZamani); clearInterval(bannerZamani); };

  return api;
})();
