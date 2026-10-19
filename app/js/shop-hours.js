/* =====================================================================
   DÜKKÂN SAATLERİ — 8 numaralı panel
   Her gün için açılış/kapanış saati, TARİHLİ düzenler hâlinde.
   Hesap tarafı (hangi tarihte hangi düzen geçerli) js/utils.js içinde
   (SHOP_HOURS, dowDefaultHours). Burası sadece ayar arayüzü + doğrulama.

   Yeni bir düzen eklenince eski haftalar ve Borç/Alacak hesabı eskisi gibi
   kalır; yeni düzen yalnızca "geçerli olduğu ilk tarih"ten itibaren işler.

   NOT: Bu dosya index.html ana kodundan ÖNCE yüklenir.
===================================================================== */

const SAAT_BICIMI = /^([01]\d|2[0-3]):[0-5]\d$/;

// Kayıttan okunan / elle girilen düzen listesini doğrular.
// Geçerliyse temizlenmiş kopyayı, geçersizse null döner (varsayılan kalır).
function dukkanSaatleriniDogrula(liste){
  if(!Array.isArray(liste) || !liste.length) return null;
  const temiz = [];
  for(const e of liste){
    if(!e || !Array.isArray(e.days) || e.days.length !== 7) return null;
    const gunler = [];
    for(const g of e.days){
      if(!g || !SAAT_BICIMI.test(g.open || '') || !SAAT_BICIMI.test(g.close || '')) return null;
      if(toMin(g.close) - toMin(g.open) < 60) return null;
      gunler.push({open: g.open, close: g.close});
    }
    const from = e.from || '';
    if(from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) return null;
    temiz.push({from, days: gunler});
  }
  temiz.sort((a, b) => (a.from || '').localeCompare(b.from || ''));
  if(temiz[0].from !== '') temiz[0].from = '';        // en eski düzen her zaman "en baştan"
  const tarihler = temiz.map(e => e.from);
  if(new Set(tarihler).size !== tarihler.length) return null;   // aynı tarihli iki düzen olamaz
  return temiz;
}

function renderShopHours(){
  const kutu = document.getElementById('shopHoursBox');
  if(!kutu) return;
  kutu.innerHTML = SHOP_HOURS.map((e, ei) => {
    const baslik = ei === 0
      ? `<b>İlk düzen</b> <span style="color:var(--ink-soft); font-size:11.5px;">— en baştan beri geçerli</span>`
      : `<b>Geçerli olduğu ilk tarih:</b>
         <input type="date" class="sh-from" data-e="${ei}" value="${e.from}" style="padding:5px 8px; border-radius:6px; border:1px solid #D6D0C2; font-family:inherit;">`;
    const sil = ei === 0 ? '' : `<button class="blk-del sh-del" data-e="${ei}" title="Bu düzeni sil">✕</button>`;
    const satirlar = DAY_NAMES.map((ad, di) => `
      <tr>
        <td class="pcell" style="width:110px;"><b>${ad}</b></td>
        <td class="pcell"><input type="time" class="sh-t" data-e="${ei}" data-d="${di}" data-k="open" value="${e.days[di].open}"></td>
        <td class="pcell"><input type="time" class="sh-t" data-e="${ei}" data-d="${di}" data-k="close" value="${e.days[di].close}"></td>
      </tr>`).join('');
    return `<div class="sh-kart" style="border:1px solid #D6D0C2; border-radius:10px; padding:12px 14px; margin-bottom:12px; background:#fff;">
      <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:8px;">
        ${baslik}<span style="flex:1"></span>
        <button class="tool sh-yay" data-e="${ei}" style="font-size:12px;">Pazartesi saatini hafta içine (Pzt–Cum) uygula</button>
        ${sil}
      </div>
      <div style="overflow-x:auto;"><table class="grid"><thead><tr>
        <th style="text-align:left">Gün</th><th style="text-align:left">Açılış</th><th style="text-align:left">Kapanış</th>
      </tr></thead><tbody>${satirlar}</tbody></table></div>
    </div>`;
  }).join('') + `<div class="hint" style="margin-top:0;">Daha önce oluşturulmuş bir hafta yeni saate göre kendiliğinden
    değişmez — o haftada <b>✨ Haftayı otomatik oluştur</b>'a basman gerekir (kilitli haftada önce kilidi aç).</div>`;
}

// Değişikliği uygula: doğrula → kaydet → ekranı tazele. Geçersizse eski hâle dön.
async function dukkanSaatleriniUygula(yeniListe, hataMetni){
  const gecerli = dukkanSaatleriniDogrula(yeniListe);
  if(!gecerli){
    alert(hataMetni || 'Saatler geçerli değil. Kapanış, açılıştan en az 1 saat sonra olmalı ve iki düzen aynı tarihle başlayamaz.');
    renderShopHours();
    return;
  }
  SHOP_HOURS = gecerli;
  await saveSettings();
  renderAll();
}

const shopHoursKutu = document.getElementById('shopHoursBox');
if(shopHoursKutu){
  shopHoursKutu.addEventListener('change', e => {
    const el = e.target;
    const kopya = JSON.parse(JSON.stringify(SHOP_HOURS));
    if(el.classList.contains('sh-t')){
      kopya[Number(el.dataset.e)].days[Number(el.dataset.d)][el.dataset.k] = el.value;
      dukkanSaatleriniUygula(kopya);
    } else if(el.classList.contains('sh-from')){
      if(!el.value){ renderShopHours(); return; }
      kopya[Number(el.dataset.e)].from = el.value;
      dukkanSaatleriniUygula(kopya, 'Bu tarihte başka bir düzen zaten başlıyor.');
    }
  });
  shopHoursKutu.addEventListener('click', e => {
    const el = e.target.closest ? e.target.closest('button') : null;
    if(!el) return;
    const ei = Number(el.dataset.e);
    const kopya = JSON.parse(JSON.stringify(SHOP_HOURS));
    if(el.classList.contains('sh-yay')){
      const pzt = kopya[ei].days[0];
      for(let d = 1; d < 5; d++) kopya[ei].days[d] = {open: pzt.open, close: pzt.close};
      dukkanSaatleriniUygula(kopya);
    } else if(el.classList.contains('sh-del')){
      const tarih = kopya[ei].from;
      if(!confirm(`${tarih} tarihinde başlayan düzen silinsin mi?\n\nO tarihten sonraki haftalar bir önceki düzene göre hesaplanır.`)) return;
      kopya.splice(ei, 1);
      dukkanSaatleriniUygula(kopya);
    }
  });
}

document.getElementById('btnAddShopHours').addEventListener('click', () => {
  // Yeni düzen: sonuncunun kopyası, başlangıç tarihi = gelecek ayın 1'i
  const bugun = new Date();
  const sonraki = new Date(bugun.getFullYear(), bugun.getMonth() + 1, 1);
  let from = fmtDate(sonraki);
  const kopya = JSON.parse(JSON.stringify(SHOP_HOURS));
  while(kopya.some(x => x.from === from)){
    const d = new Date(from + 'T00:00'); d.setDate(d.getDate() + 1); from = fmtDate(d);
  }
  kopya.push({from, days: JSON.parse(JSON.stringify(kopya[kopya.length - 1].days))});
  dukkanSaatleriniUygula(kopya);
});
