/* =====================================================================
   GORSEL INDIRME (PNG)
   Haftalik cizelgeyi bir resim dosyasi olarak cizip indirir.
   "Gorsel indir" butonuna basildiginda calisir.

   DUZEN: satirlar = gunler, sutunlar = personel.  Bu duzen KORUNACAK —
   kullanicinin alistigi standart budur, degistirilmedi.

   Bu bolum kendi basina calisir; sadece cizim aninda ROSTER, weekData,
   ZONE_MAP ve currentMonday verilerini okur.
===================================================================== */

function exportPng(){
  const scale = 2;
  // Genislik DEGISMEDI (dayColW/empColW/supColW ayni) — duzen bozulmasin diye.
  // Sadece YUKSEKLIK artirildi: satirlarda bol bos alan vardi, o alan puntoyu
  // buyutmek icin kullaniliyor. Genislik sabit kaldigindan telefonda ekrana
  // sigdirma orani degismiyor, dolayisiyla buyuyen punto dogrudan kazanc.
  // (11 -> 16 punto = %45 daha buyuk yazi; 16 punto 118px sutuna tam sigiyor.)
  const pad0 = 18, dayColW = 120, empColW = 118, supColW = 150, rowH = 96, headH = 64, titleH = 50;
  const emps = ROSTER;
  const W = pad0*2 + dayColW + emps.length*empColW + supColW;
  const H = pad0*2 + titleH + headH + 7*rowH;

  const canvas = document.createElement('canvas');
  canvas.width = W*scale; canvas.height = H*scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.textBaseline = 'middle';

  // arka plan
  ctx.fillStyle = '#FBF9F3'; ctx.fillRect(0,0,W,H);

  // başlık
  const sunday = addDays(currentMonday,6);
  const rangeTxt = `${pad(currentMonday.getDate())}.${pad(currentMonday.getMonth()+1)} – ${pad(sunday.getDate())}.${pad(sunday.getMonth()+1)}.${sunday.getFullYear()}`;
  ctx.fillStyle = '#262220';
  ctx.font = '700 25px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('Petek Çalışma Programı', pad0, pad0 + 16);
  ctx.font = '700 15px ui-monospace, monospace';
  ctx.fillStyle = '#7B2D3B';
  ctx.textAlign = 'right';
  ctx.fillText(rangeTxt, W - pad0, pad0 + 16);

  const gridTop = pad0 + titleH;
  const gridLeft = pad0;
  const colX = i => gridLeft + dayColW + i*empColW;      // i. çalışan sütununun sol kenarı
  const supX = gridLeft + dayColW + emps.length*empColW;

  function truncate(text, maxW){
    if(ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while(t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }

  // başlık satırı (çalışan isimleri)
  ctx.textAlign = 'center';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillStyle = '#262220';
  // Sadece isim yazilir. Calisma sekli (Tam zamanli / Part-time) bilerek
  // YAZILMAZ - gorsel personelle paylasiliyor, kimin hangi statude oldugu
  // orada gorunmesin. (Kullanici istegi, 15 Agustos.)
  emps.forEach((p,i) => {
    const cx = colX(i) + empColW/2;
    ctx.fillText(truncate(p.name, empColW-10), cx, gridTop + headH/2);
  });
  ctx.fillText('Akşam Sorumlusu', supX + supColW/2, gridTop + headH/2);

  // başlık alt çizgisi
  ctx.strokeStyle = '#262220'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(gridLeft, gridTop + headH); ctx.lineTo(W - pad0, gridTop + headH); ctx.stroke();

  // gün satırları
  for(let r=0;r<7;r++){
    const d = addDays(currentMonday, r);
    const key = fmtDate(d);
    const rowTop = gridTop + headH + r*rowH;
    const midY = rowTop + rowH/2;

    // Satir ayrimi — gunleri gozle ayirmak icin cok hafif zemin.
    // DUZ ALTERNASYON, istisna yok. (Daha once Pazar'a ayri koyu ton verilmisti;
    // Cumartesi de renkli siraya denk geldigi icin alt alta iki renkli satir
    // olusuyor ve tablo asagi dogru koyulasiyormus gibi duruyordu.)
    // 7 satir tek sayi oldugundan dizilim duz satirla baslar ve duz satirla biter.
    if(r % 2 === 1){
      ctx.fillStyle = '#F5F1E6';
      ctx.fillRect(gridLeft, rowTop, W - pad0 - gridLeft, rowH);
    }

    // gün etiketi
    // Gun sutunundaki yazilar OLCULEREK kirpilir; boylece punto degisse de
    // ("Pazartesi", "Cumartesi" gibi uzun adlar dahil) sutun disina tasamaz.
    const gunMaxW = dayColW - 10;
    ctx.textAlign = 'left';
    ctx.font = '700 17px Georgia, serif';
    ctx.fillStyle = '#262220';
    ctx.fillText(truncate(DAY_NAMES[r], gunMaxW), gridLeft + 4, midY - 14);
    ctx.font = '700 14px ui-monospace, monospace';
    ctx.fillStyle = '#5B5449';
    ctx.fillText(truncate(`${pad(d.getDate())}.${pad(d.getMonth()+1)}`, gunMaxW), gridLeft + 4, midY + 6);
    ctx.font = '400 12px ui-monospace, monospace';
    ctx.fillStyle = '#8A8175';
    const oh = operatingHours(d);
    ctx.fillText(truncate(`${oh.open}–${oh.close}`, gunMaxW), gridLeft + 4, midY + 26);

    // çalışan hücreleri
    ctx.textAlign = 'center';
    emps.forEach((p,i) => {
      const a = weekData.days[key].assignments[p.name];
      const cx = colX(i) + empColW/2;
      if(a.leave === 'IZINLI'){
        drawPill(ctx, colX(i)+empColW/2, midY, 'İzinli', '#5B5449', '#fff');
      } else if(a.leave === 'YILLIK'){
        drawPill(ctx, colX(i)+empColW/2, midY, 'Y. İzin', '#B98327', '#241d0a');
      } else if(a.leave === 'BORC'){
        drawPill(ctx, colX(i)+empColW/2, midY, 'Borç', '#AA3327', '#fff');
      } else if(a.start && a.end){
        const z = a.zone ? ZONE_MAP[a.zone] : null;
        if(z){
          // renkli görev şeridi
          // Serit sutunun tamamini kaplamiyor: iki yanda 12'ser px bosluk kaliyor
          // (eskiden 7 idi), boylece yan yana duran seritler yapisik gorunmuyor.
          // Punto 13 -> 12.5: boylece bosluk artarken bolum adlari eskisinden
          // DAHA FAZLA kirpilmiyor ("Okuma Kitabi" hala tam sigiyor).
          const bw = empColW - 24, bh = 26, bx = colX(i)+12, by = rowTop + 13;
          roundRect(ctx, bx, by, bw, bh, 5); ctx.fillStyle = z.color; ctx.fill();
          ctx.fillStyle = '#fff'; ctx.font = '700 12.5px system-ui, sans-serif';
          ctx.fillText(truncate(z.label, bw-8), cx, by + bh/2 + 1);
        }
        // Saat: en onemli bilgi — koyu ve mumkun olan en buyuk punto (16),
        // 118px sutuna tam sigan sinir bu.
        ctx.fillStyle = '#262220'; ctx.font = '700 16px ui-monospace, monospace';
        ctx.fillText(`${a.start}–${a.end}`, cx, rowTop + 59);
        if(a.blocks && a.blocks.length){
          // Gorev degisimi: saat araligi + bolum adi iki satirda (118px sutuna sigsin diye)
          const b = a.blocks[0];
          const bz = ZONE_MAP[b.zone];
          const fazla = a.blocks.length > 1 ? ` +${a.blocks.length-1}` : '';
          ctx.fillStyle = bz ? bz.color : '#5B5449';
          ctx.font = '700 11.5px ui-monospace, monospace';
          ctx.fillText(`${b.start}–${b.end}`, cx, rowTop + 75);
          ctx.fillText(truncate((bz ? bz.label : b.zone) + fazla, empColW-8), cx, rowTop + 88);
        }
      } else {
        ctx.fillStyle = '#B7AE9C'; ctx.font = 'italic 14px system-ui, sans-serif';
        ctx.fillText('—', cx, midY);
      }
    });

    // akşam sorumlusu
    ctx.fillStyle = '#262220'; ctx.font = '700 15px ui-monospace, monospace';
    ctx.fillText(truncate(weekData.days[key].sup || '—', supColW - 12), supX + supColW/2, midY);

    // satır alt çizgisi
    ctx.strokeStyle = '#D8CFBA'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(gridLeft, rowTop + rowH); ctx.lineTo(W - pad0, rowTop + rowH); ctx.stroke();
  }

  // Personel sutunlari arasi ince ayiricilar — 16 sutun yan yana olunca
  // hucreler birbirine karisiyordu; bu cizgiler gozun sutunu takip etmesini saglar.
  ctx.strokeStyle = '#E0DACB'; ctx.lineWidth = 1;
  for(let i = 1; i < emps.length; i++){
    ctx.beginPath();
    ctx.moveTo(colX(i), gridTop + headH);
    ctx.lineTo(colX(i), gridTop + headH + 7*rowH);
    ctx.stroke();
  }

  // dikey ayraçlar: gün sütunu sağı + sorumlu sütunu solu
  ctx.strokeStyle = '#262220'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(gridLeft + dayColW, gridTop); ctx.lineTo(gridLeft + dayColW, gridTop + headH + 7*rowH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(supX, gridTop); ctx.lineTo(supX, gridTop + headH + 7*rowH); ctx.stroke();

  // indir
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `petek_program_${fmtDate(currentMonday)}.png`;
  a.click();
}
function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}
function drawPill(ctx, cx, cy, text, bg, fg){
  ctx.font = '700 14px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 22, h = 26;
  roundRect(ctx, cx - w/2, cy - h/2, w, h, 5); ctx.fillStyle = bg; ctx.fill();
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.fillText(text, cx, cy + 1);
}
