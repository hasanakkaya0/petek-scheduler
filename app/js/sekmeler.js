/* =====================================================================
   SEKMELER — Çizelge / Sayaçlar / Ayarlar
   Sayfa uzadığı için paneller üç sekmeye ayrıldı:
     cizelge : Haftalık çizelge + Kapsama kontrolü   (her gün bakılanlar)
     sayac   : Borç/Alacak + Yıllık izin             (ara sıra bakılanlar)
     ayar    : Personel, Bölümler, Kurallar, Dükkân saatleri (nadiren)

   Paneller SİLİNMEZ, sadece gizlenir (data-sekme özniteliği taşıyan
   öğeler). Yani canlı durum kutusu, bakiye rozetleri vb. arka planda
   çalışmaya devam eder. Üst gezinme çubuğu her sekmede görünür.
   Seçili sekme tarayıcıda hatırlanır.

   NOT: Bu dosya storage.js'ten SONRA yüklenir (PREFIX için).
===================================================================== */
const SEKMELER = ['cizelge', 'sayac', 'ayar'];
let aktifSekme = 'cizelge';

function sekmeAnahtari(){
  return (typeof PREFIX !== 'undefined' ? PREFIX : 'petek:') + 'sekme';
}

function sekmeSec(ad, kaydet){
  if(!SEKMELER.includes(ad)) ad = 'cizelge';
  aktifSekme = ad;
  document.querySelectorAll('[data-sekme]').forEach(el => {
    el.classList.toggle('sekme-gizli', el.dataset.sekme !== ad);
  });
  document.querySelectorAll('[data-sekme-sec]').forEach(b => {
    const aktif = b.dataset.sekmeSec === ad;
    b.classList.toggle('aktif', aktif);
    b.setAttribute('aria-selected', aktif ? 'true' : 'false');
  });
  if(kaydet){ try{ localStorage.setItem(sekmeAnahtari(), ad); }catch(e){} }
}

document.querySelectorAll('[data-sekme-sec]').forEach(b => {
  b.addEventListener('click', () => {
    sekmeSec(b.dataset.sekmeSec, true);
    window.scrollTo && window.scrollTo(0, 0);
  });
});

(function ilkSekme(){
  let ad = 'cizelge';
  try{ ad = localStorage.getItem(sekmeAnahtari()) || 'cizelge'; }catch(e){}
  sekmeSec(ad, false);
})();
