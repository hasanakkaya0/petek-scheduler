/* =====================================================================
   "YENİ SÜRÜM VAR" ŞERİDİ
   Program açık bir sekmede günlerce durabilir; bu arada yeni sürüm yayınlanmış
   olabilir. Burada her 5 dakikada bir (ve sekmeye geri dönünce) ana sayfanın
   sürüm damgası (?v=ZAMAN, bkz. surumle.js) sunucudan okunur; açık olandan
   daha yeniyse sayfanın üstünde "Yeni sürüm hazır — ↻ Yenile" şeridi çıkar.

   Sürüm damgası olmayan ortamlarda (dosya olarak açılmış, tek dosyalık paket) hiçbir şey yapmaz.
   NOT: Bu dosya yenileAdresi'nin bulunduğu utils.js'ten sonra yüklenir.
===================================================================== */
const SurumKontrol = (function(){
  const ARALIK_MS = 300000;
  const api = {};
  let mevcut = null, zamanlayici = null, goruldu = false;

  // Ana sayfa metninden sürüm damgasını (rakamlar) çıkarır
  api.damgaCikar = function(html){
    const m = String(html || '').match(/css\/styles\.css\?v=(\d+)/);
    return m ? m[1] : null;
  };

  // Sunucudaki sürüm, açık olandan DAHA YENİ mi? (eski bir sayfa gösterilirse şerit çıkmasın)
  api.yeniMi = function(html, acik){
    const y = api.damgaCikar(html);
    return !!(y && acik && Number(y) > Number(acik));
  };

  api.mevcutDamga = function(){
    try{
      const l = document.querySelector('link[rel=stylesheet][href*="styles.css"]');
      return l ? api.damgaCikar(l.getAttribute('href')) : null;
    }catch(e){ return null; }
  };

  function seridiGoster(){
    const el = document.getElementById('yeniSurum');
    if(el) el.hidden = false;
    goruldu = true;
  }

  api.kontrolEt = async function(){
    if(goruldu || !mevcut) return false;
    try{
      const yanit = await fetch(location.pathname + '?surum=' + Date.now(), {cache: 'no-store'});
      if(!yanit.ok) return false;
      if(api.yeniMi(await yanit.text(), mevcut)){ seridiGoster(); return true; }
    }catch(e){ /* çevrimdışı: sonra tekrar dene */ }
    return false;
  };

  api.baslat = function(){
    if(typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return;
    mevcut = api.mevcutDamga();
    if(!mevcut) return;                                     // damga yok (yerel dosya / paket)
    const dugme = document.getElementById('btnYeniSurum');
    if(dugme) dugme.addEventListener('click', () => { location.href = yenileAdresi(location.href, Date.now()); });
    zamanlayici = setInterval(api.kontrolEt, ARALIK_MS);
    document.addEventListener('visibilitychange', () => { if(!document.hidden) api.kontrolEt(); });
    setTimeout(api.kontrolEt, 60000);
  };

  api._testAyarla = d => { mevcut = d; goruldu = false; };
  api._testDurdur = () => { clearInterval(zamanlayici); };
  return api;
})();
