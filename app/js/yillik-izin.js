/* =====================================================================
   YILLIK İZİN SAYACI
   Her personelin bir TAKVİM YILI içinde (1 Ocak – 31 Aralık) kaç gün
   yıllık izin kullandığını sayar.

   Yıl sınırı doğru ele alınır: bir hafta iki yıla yayılabilir
   (ör. 28 Aralık – 3 Ocak). Bu yüzden hafta bazında değil, GÜN BAZINDA
   sayılır — her gün kendi yılına yazılır. Yıl değişince sayaç sıfırdan
   başlar, eski yılların sayısı bozulmadan durur (yıl seçicisinden bakılır).

   NOT: Bu dosya index.html ana kodundan ÖNCE yüklenir.
===================================================================== */

// Seçili yıl (varsayılan: içinde bulunduğumuz yıl)
let izinYili = new Date().getFullYear();

/* Kayıtlı tüm haftaları tarayıp yıl bazında yıllık izin günlerini sayar.
   Dönen: {yil: {personelAdı: günSayısı}} */
async function yillikIzinleriTara(){
  const sayim = {};                      // {yil: {ad: gun}}
  const ekle = (yil, ad) => {
    (sayim[yil] ||= {});
    sayim[yil][ad] = (sayim[yil][ad] || 0) + 1;
  };

  const curKey = 'week:' + fmtDate(currentMonday);
  const keys = await store.listKeys('week:');
  const hepsi = new Set(keys);
  hepsi.add(curKey);                     // henüz kaydedilmemiş olsa da mevcut hafta sayılsın

  for(const k of hepsi){
    let wd;
    if(k === curKey && weekData){
      wd = weekData;                     // bellekteki güncel hafta (kayıttan daha taze)
    } else {
      const r = await store.get(k);
      if(!r || !r.value) continue;
      try{ wd = JSON.parse(r.value); }catch(e){ continue; }
    }
    if(!wd || !wd.days) continue;

    for(const gunKey in wd.days){
      const yil = Number(gunKey.slice(0, 4));
      if(!yil) continue;
      const atamalar = wd.days[gunKey].assignments || {};
      for(const ad in atamalar){
        const a = atamalar[ad];
        if(a && a.leave === 'YILLIK') ekle(yil, ad);
      }
    }
  }
  return sayim;
}

let izinTarariMesgul = false, izinTaramaBekliyor = false;

async function renderYillikIzin(){
  const t = document.getElementById('yillikIzinTable');
  if(!t) return;
  if(izinTarariMesgul){ izinTaramaBekliyor = true; return; }   // isteği düşürme, sıraya al
  izinTarariMesgul = true;
  try{
    do {
      izinTaramaBekliyor = false;
      let sayim = {};
      try{ sayim = await yillikIzinleriTara(); }catch(e){ /* sessiz geç */ }

      // Yıl seçici — veride bulunan yıllar + içinde bulunduğumuz yıl
      const yillar = new Set(Object.keys(sayim).map(Number));
      yillar.add(new Date().getFullYear());
      yillar.add(currentMonday.getFullYear());
      const sirali = [...yillar].sort((a,b) => b - a);
      if(!sirali.includes(izinYili)) izinYili = sirali[0];

      const sec = document.getElementById('izinYilSec');
      if(sec){
        sec.innerHTML = sirali.map(y => `<option value="${y}">${y}</option>`).join('');
        sec.value = String(izinYili);
      }

      const buYil = sayim[izinYili] || {};
      const kisiler = ROSTER.slice();
      const toplam = kisiler.reduce((s,p) => s + (buYil[p.name] || 0), 0);
      // Hak alanı doldurulmuşsa "kaç gün kaldı" da gösterilir (kişi ayarları,
      // 3. panel → "Yıllık izin hakkı"). Doldurulmamışsa sadece kullanılan sayılır.
      const hakVarMi = kisiler.some(p => p.izinHakki != null);

      t.innerHTML = `<thead><tr>
          <th class="corner">Personel</th>
          <th>${izinYili} yılında kullanılan</th>
          ${hakVarMi ? '<th>Yıllık izin hakkı</th><th>Kalan</th>' : ''}
        </tr></thead><tbody>` +
        kisiler.map(p => {
          const g = buYil[p.name] || 0;
          const hakVar = p.izinHakki != null;
          const kalan = hakVar ? p.izinHakki - g : null;
          return `<tr>
            <td class="pcell"><b>${p.name}</b></td>
            <td class="pcell"><span class="izintag ${g ? 'var' : 'yok'}">${g} gün</span></td>
            ${hakVarMi ? `<td class="pcell">${hakVar ? p.izinHakki + ' gün' : '—'}</td>
              <td class="pcell">${hakVar ? `<span class="izintag ${kalan < 0 ? 'asim' : (kalan === 0 ? 'yok' : 'var')}">${kalan} gün</span>` : '—'}</td>` : ''}
          </tr>`;
        }).join('') +
        `<tr><td class="pcell" style="border-top:2px solid var(--ink)"><b>TOPLAM</b></td>
             <td class="pcell" style="border-top:2px solid var(--ink)"><b>${toplam} gün</b></td>
             ${hakVarMi ? '<td class="pcell" style="border-top:2px solid var(--ink)"></td><td class="pcell" style="border-top:2px solid var(--ink)"></td>' : ''}</tr>` +
        `</tbody>`;

      // Diğer yılların özeti
      const ozetEl = document.getElementById('izinYilOzet');
      if(ozetEl){
        const satirlar = sirali.map(y => {
          const top = ROSTER.reduce((s,p) => s + ((sayim[y] || {})[p.name] || 0), 0);
          return `${y}: ${top} gün`;
        });
        ozetEl.textContent = satirlar.length > 1 ? 'Yıllara göre toplam — ' + satirlar.join('  ·  ') : '';
      }
    } while(izinTaramaBekliyor);
  } finally {
    izinTarariMesgul = false;
  }
}
