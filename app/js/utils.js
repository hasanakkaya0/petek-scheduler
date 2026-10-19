/* =====================================================================
   YARDIMCI FONKSİYONLAR
   Tarih, saat ve basit veri kontrolleri. Buradaki fonksiyonlar
   programın hiçbir verisine bağlı değildir — kendi başlarına çalışırlar.

   NOT: Bu dosya index.html'den ÖNCE yüklenir (normal <script>, modül değil).
===================================================================== */

/* ---------- Gün isimleri (0 = Pazartesi ... 6 = Pazar) ---------- */
const DAY_NAMES = ['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];

function dayLabel(i){ return DAY_NAMES[i]; } // i: 0=Pzt..6=Paz (haftanın görüntü sırası)

/* ---------- Sayı / saat biçimlendirme ---------- */

// 5 -> "05"
function pad(n){return String(n).padStart(2,'0');}

// "09:30" -> 570 (gün başından itibaren dakika)
function toMin(hhmm){ if(!hhmm) return null; const [h,m]=hhmm.split(':').map(Number); return h*60+m; }

// 570 -> "09:30"
function hhmm(m){ return pad(Math.floor(m/60)) + ':' + pad(m%60); }

// "09:00" + 2.5 saat -> "11:30"
function addHours(hhmm, h){
  const m = toMin(hhmm) + Math.round(h*60);
  return pad(Math.floor(m/60)%24) + ':' + pad(m%60);
}

/* ---------- Tarih işlemleri ---------- */

// Date -> "2026-08-14"
function fmtDate(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}

// Verilen tarihin içinde bulunduğu haftanın Pazartesi'si
function mondayOf(d){
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const m = new Date(d); m.setDate(d.getDate()+diff); m.setHours(0,0,0,0); return m;
}

// Tarihe gün ekle (negatif de olabilir)
function addDays(d,n){ const r = new Date(d); r.setDate(d.getDate()+n); return r; }

/* ---------- Dükkân saatleri (tarihli düzen) ----------
   SHOP_HOURS: düzenler listesi, eskiden yeniye.
     {from: 'YYYY-MM-DD' | '' (en eski düzen: hep geçerli),
      days: [7 adet {open, close}]}   // 0 = Pazartesi ... 6 = Pazar
   Bir tarih için EN SON başlamış düzen geçerlidir. Böylece yeni bir düzen
   eklenince geçmiş haftalar (ve Borç/Alacak hesabı) eskisi gibi kalır. */
const DEFAULT_SHOP_HOURS = [
  {from:'', days:[
    {open:'09:00', close:'21:00'}, {open:'09:00', close:'21:00'}, {open:'09:00', close:'21:00'},
    {open:'09:00', close:'21:00'}, {open:'09:00', close:'21:00'},
    {open:'09:00', close:'20:30'},      // Cumartesi
    {open:'11:00', close:'20:00'},      // Pazar
  ]},
  // Kasım 2026'dan itibaren hafta içi kapanış 20:00 (Cumartesi/Pazar aynı)
  {from:'2026-11-01', days:[
    {open:'09:00', close:'20:00'}, {open:'09:00', close:'20:00'}, {open:'09:00', close:'20:00'},
    {open:'09:00', close:'20:00'}, {open:'09:00', close:'20:00'},
    {open:'09:00', close:'20:30'},
    {open:'11:00', close:'20:00'},
  ]},
];
let SHOP_HOURS = JSON.parse(JSON.stringify(DEFAULT_SHOP_HOURS));

// Bir tarihin (Date) gün içi varsayılan açılış/kapanışı — güne özel saat HARİÇ
function dowDefaultHours(dObj){
  const key = fmtDate(dObj);
  let secili = SHOP_HOURS[0];
  SHOP_HOURS.forEach(e => { if(!e.from || e.from <= key) secili = e; });
  const g = secili.days[(dObj.getDay() + 6) % 7];
  return {open: g.open, close: g.close};
}

/* ---------- Sayfayı "en yeni sürümle" yenileme ----------
   Adresin sonuna her seferinde yeni bir damga (?yenile=ZAMAN) eklenir. Tarayıcı bu adresi
   daha önce görmediği için ana sayfayı önbellekten değil SUNUCUDAN alır (Ctrl+Shift+R
   yerine). Diğer parametreler (ör. ?deneme) ve # kısmı korunur. */
function yenileAdresi(href, damga){
  const u = new URL(href);
  u.searchParams.set('yenile', String(damga));
  return u.toString();
}
// Yenilemeden gelen ?yenile=... adres çubuğunda kalmasın (yer imi temiz kalsın)
function yenileIzininiTemizle(){
  try{
    const u = new URL(location.href);
    if(!u.searchParams.has('yenile')) return;
    u.searchParams.delete('yenile');
    history.replaceState(null, '', u.toString());
  }catch(e){ /* önemli değil */ }
}

/* ---------- Atama (bir kişinin bir günü) kontrolleri ---------- */

// Boş/atanmamış bir gün
function blankAssignment(){ return {leave:'NONE', start:null, end:null, zone:null}; }

// O gün çalışıyor mu? (izinli değil ve saatleri girilmiş)
function isWorking(a){ return a && a.leave === 'NONE' && a.start && a.end; }

/* İzin türleri:
     IZINLI — haftalık izin (jeneratör dağıtır)
     YILLIK — yıllık izin   (elle girilir, dokunulmaz)
     BORC   — borç izin     (elle girilir, dokunulmaz; o günün saatleri
                             personelin borcuna yazılır → bakiye eksilir)
*/
// O gün çalışmıyor mu? (her türlü izin)
function isOffLeave(a){
  return a && (a.leave === 'IZINLI' || a.leave === 'YILLIK' || a.leave === 'BORC');
}
// Elle girilen, jeneratörün ASLA dokunmadığı izin türleri
function isManualLeave(a){ return a && (a.leave === 'YILLIK' || a.leave === 'BORC'); }

// Belirli bir dakikada bu kişi hangi bölümde? (gün içi görev kaydırmaları dahil)
function zoneAtMinute(a, min, defaultZone){
  if(!isWorking(a)) return null;
  const s = toMin(a.start), e = toMin(a.end);
  if(!(s <= min && min < e)) return null;
  // saat bazlı görev değişimi (ör. 19:00 sonrası kasaya geçiyor)
  if(a.blocks){
    for(const b of a.blocks){
      if(toMin(b.start) <= min && min < toMin(b.end)) return b.zone;
    }
  }
  return a.zone || defaultZone || null;
}

/* ---------- Personel özellik kontrolleri ---------- */

/* Bir kapsama kuralı o dakikada GEÇERLİ mi?
   Kurala saat aralığı verilebilir (ör. Fotokopi 11:00–21:00). Aralık dışında
   kalan boşluklar "açık" sayılmaz — sadece bilgi olarak raporlanır.
   Aralık verilmemişse kural dükkânın tüm açık saatlerinde geçerlidir. */
function kuralGecerliMi(rule, dakika, acilisDk, kapanisDk){
  const bas = rule.from ? toMin(rule.from) : acilisDk;
  const bit = rule.to   ? toMin(rule.to)   : kapanisDk;
  return dakika >= bas && dakika < bit;
}

// Kuralın saat aralığı insan okunur metin (boşsa "dükkân saatleri")
function kuralSaatMetni(rule){
  if(!rule.from && !rule.to) return 'dükkân saatleri';
  return (rule.from || 'açılış') + '–' + (rule.to || 'kapanış');
}

// Bu kişi bu bölüme bakabilir mi? (ana görev veya yedek görev)
function canCover(p, zone){ return p.flex || p.primary.includes(zone) || (p.backup || []).includes(zone); }

// "İhtiyaç halinde çağrılan" personel otomatik listede atanmaz (yedek/joker)
function isOnCall(p){ return !!p.onCall; }

// Tam zamanlı mı? (part-time değil ve günlük 8 saat ve üzeri)
const isFullTime = p => !/part/i.test(p.type || '') && (p.hours || 0) >= 8;
