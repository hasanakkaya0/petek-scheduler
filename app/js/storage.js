/* =====================================================================
   KALICI DEPOLAMA — verilerin nereye kaydedildiği
   Program iki ortamda çalışabiliyor:
     - Claude sohbetinde  -> window.storage (buluta)
     - Bilgisayarda dosya -> localStorage (bu cihaza)
   Aşağıdaki "store" bu ikisinin farkını gizler; program hangi ortamda
   olduğunu bilmeden sadece store.get / store.set çağırır.

   NOT: Bu dosya index.html'den ÖNCE yüklenir (normal <script>, modül değil).
===================================================================== */

/* ---------------------------------------------------------------------
   DENEME MODU
   Adres satırının sonuna  ?deneme  eklenirse program verileri AYRI bir
   kutuya yazar. Böylece sıfır bir bilgisayardaymış gibi test edebilirsin;
   gerçek verilere (personel, haftalar, borç/alacak) hiç dokunulmaz.

   Örnek:  index.html?deneme
   Normale dönmek için  ?deneme  kısmını sil ve sayfayı yenile.
--------------------------------------------------------------------- */
const DENEME_MODU = (typeof location !== 'undefined')
  && /[?&#]deneme\b/i.test((location.search || '') + (location.hash || ''));
const PREFIX = DENEME_MODU ? 'petek-deneme:' : 'petek:';

const hasCloud = (typeof window.storage !== 'undefined');
let hasLocal = false;
try { const k='__petek_test__'; localStorage.setItem(k,'1'); localStorage.removeItem(k); hasLocal = true; } catch(e){ hasLocal = false; }
const canPersist = hasCloud || hasLocal;

// Deneme modundaysa ekranın üstüne kalın bir şerit koy — kullanıcı yanlışlıkla
// gerçek veri girip kaybetmesin diye her an görünür olmalı.
if(DENEME_MODU){
  document.addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('div');
    s.textContent = '🧪 DENEME MODU — buraya girdiğin veriler ayrı tutulur, gerçek çizelgene karışmaz. Normale dönmek için adresten "?deneme" kısmını sil.';
    s.style.cssText = 'position:sticky; top:0; z-index:100; background:#B98327; color:#241d0a;'
      + 'font-weight:700; font-size:13px; text-align:center; padding:8px 12px; line-height:1.4;';
    // Boş ekranla karşılaşmasınlar: uydurma örnek personeli yükleyip bir hafta kuran düğme (js/ornek-veri.js)
    const b = document.createElement('button');
    b.textContent = 'Örnek personeli yükle';
    b.style.cssText = 'margin-left:12px; padding:4px 12px; border-radius:6px; border:1px solid #241d0a;'
      + 'background:#fff; color:#241d0a; font-weight:700; font-size:12.5px; cursor:pointer;';
    b.addEventListener('click', () => ornekVeriYukle());
    s.appendChild(b);
    document.body.insertBefore(s, document.body.firstChild);
  });
}

// Bulut (Firebase) açık mı? Açıksa bütün okuma/yazma Firestore'a gider (js/bulut.js).
// Kapalıysa (dosya olarak açıldı, ?deneme, config boş) eski yerel depolama çalışır.
function bulutAktif(){ return typeof Bulut !== 'undefined' && Bulut.aktif(); }

const store = {
  async get(key){
    if(bulutAktif()) return Bulut.get(key);
    if(hasCloud){ try{ return await window.storage.get(key, false); }catch(e){ return null; } }
    if(hasLocal){ const v = localStorage.getItem(PREFIX+key); return (v!=null) ? {value:v} : null; }
    return null;
  },
  async set(key, val){
    if(bulutAktif()) return Bulut.set(key, val);
    if(hasCloud){ try{ return await window.storage.set(key, val, false); }catch(e){ return null; } }
    if(hasLocal){ try{ localStorage.setItem(PREFIX+key, val); return {value:val}; }catch(e){ return null; } }
    return null;
  },
  async listKeys(prefix){
    if(bulutAktif()) return Bulut.listKeys(prefix);
    if(hasCloud){ try{ const r = await window.storage.list(prefix, false); return (r && r.keys) ? r.keys : []; }catch(e){ return []; } }
    if(hasLocal){
      const out = [];
      for(let i=0;i<localStorage.length;i++){
        const k = localStorage.key(i);
        if(k && k.startsWith(PREFIX + (prefix||''))) out.push(k.slice(PREFIX.length));
      }
      return out;
    }
    return [];
  }
};

/* ---------------------------------------------------------------------
   Sağ üstteki kayıt durumu rozeti
   state: true = kaydedildi, false = kaydediliyor (henüz sonuç yok),
          'fail' = yazma denendi ama başarısız oldu (önceden bu durum da
          sessizce "kaydediliyor…" gösterip kullanıcıyı asla
          bilgilendirmiyordu — artık ayrı ve belirgin).
--------------------------------------------------------------------- */
function markSaved(state){
  const el = document.getElementById('saveBadge');
  if(!canPersist){ el.textContent = 'kayıt yok (oturumluk)'; el.className='savebadge warn'; return; }
  if(state === 'fail'){ el.textContent = '⚠ kaydedilemedi — bağlantıyı/depolamayı kontrol edin'; el.className='savebadge warn'; return; }
  if(bulutAktif()){
    // Bulut: yazma hemen belleğe ve Firestore'un yerel kuyruğuna gider. İnternet yoksa
    // kuyrukta bekler, bağlantı gelince gönderilir — kullanıcıya bunu açıkça söyle.
    if(!state){ el.textContent = 'kaydediliyor…'; el.className = 'savebadge'; return; }
    const cevrimdisi = !Bulut.cevrimici();
    el.textContent = cevrimdisi ? '⚠ çevrimdışı — bağlanınca buluta gönderilecek' : 'kaydedildi (bulut)';
    el.className = 'savebadge' + (cevrimdisi ? ' warn' : ' ok');
    return;
  }
  el.textContent = state ? (hasCloud ? 'kaydedildi (buluta)' : 'kaydedildi (bu cihaz)') : 'kaydediliyor…';
  el.className = 'savebadge' + (state ? ' ok' : '');
}
