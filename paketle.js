/* =====================================================================
   PAKETLEYICI — dagitim icin TEK DOSYA uretir
   Kullanim:  PAKETLE.bat dosyasina cift tikla (ya da: node paketle.js)

   app/ klasorundeki index.html + css + js dosyalarini birlestirip
   dagitim/PetekProgram.html dosyasini olusturur.
   Bu tek dosya baska bir bilgisayara kopyalanip cift tiklandiginda calisir.
===================================================================== */
const fs = require('fs');
const path = require('path');

const KOK = __dirname;
const APP = path.join(KOK, 'app');
const CIKTI_KLASOR = path.join(KOK, 'dagitim');
const CIKTI = path.join(CIKTI_KLASOR, 'PetekProgram.html');

function bugun(){
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}

try {
  let html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');

  // --- 1) CSS'i icine goem ---
  const cssEtiketleri = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)];
  if (!cssEtiketleri.length) throw new Error('index.html icinde CSS baglantisi bulunamadi.');
  for (const m of cssEtiketleri) {
    const yol = path.join(APP, m[1].split("?")[0]);
    if (!fs.existsSync(yol)) throw new Error('Eksik dosya: ' + m[1]);
    html = html.replace(m[0], '<style>\n' + fs.readFileSync(yol, 'utf8') + '\n</style>');
  }

  // --- 2) JS dosyalarini sirasiyla icine goem ---
  const jsEtiketleri = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)];
  if (!jsEtiketleri.length) throw new Error('index.html icinde JS baglantisi bulunamadi.');
  let sayac = 0;
  for (const m of jsEtiketleri) {
    if (/^https?:/.test(m[1])) continue;   // dis kutuphane (Firebase CDN) — oldugu gibi birak
    const yol = path.join(APP, m[1].split("?")[0]);
    if (!fs.existsSync(yol)) throw new Error('Eksik dosya: ' + m[1]);
    const kod = fs.readFileSync(yol, 'utf8');
    html = html.replace(m[0], '<script>\n/* ===== ' + m[1] + ' ===== */\n' + kod + '\n</script>');
    sayac++;
  }

  // --- 3) Kontrol: disariya baglanti kalmadi mi? ---
  const kalan = html.match(/(src|href)="(?!https?:|#|data:)[^"]*\.(js|css)"/g);
  if (kalan) throw new Error('Hala dis dosya baglantisi var: ' + kalan.join(', '));

  // --- 4) Surum notu ekle ---
  html = html.replace(
    /<title>([^<]*)<\/title>/,
    `<title>$1</title>\n<!-- Tek dosya surum — ${bugun()} tarihinde paketlendi. Kaynak: D:\\Coding\\PetekCalismaProgrami -->`
  );

  if (!fs.existsSync(CIKTI_KLASOR)) fs.mkdirSync(CIKTI_KLASOR);
  fs.writeFileSync(CIKTI, html, 'utf8');

  const kb = Math.round(fs.statSync(CIKTI).size / 1024);
  console.log('');
  console.log('  TAMAM — tek dosya olusturuldu');
  console.log('');
  console.log('  Dosya : dagitim\\PetekProgram.html');
  console.log('  Boyut : ' + kb + ' KB');
  console.log('  Icerik: 1 CSS + ' + sayac + ' JS dosyasi birlestirildi');
  console.log('');
  console.log('  Bu dosyayi tek basina baska bir bilgisayara kopyalayabilirsin.');
  console.log('  Cift tiklayinca tarayicida acilir, baska hicbir seye ihtiyaci yok.');
  console.log('');
} catch (e) {
  console.log('');
  console.log('  HATA: ' + e.message);
  console.log('  Paketleme yapilamadi.');
  console.log('');
  process.exitCode = 1;
}
