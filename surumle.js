/* =====================================================================
   SURUM DAMGASI — tarayici onbellegi sorununu cozer
   GitHub Pages dosyalari 10 dakika onbellekte tutar; guncelleme sonrasi kullanici
   yeni index.html + eski css/js gorebilir (bozuk gorunum). Bu betik app/index.html
   icindeki yerel css/js adreslerine ?v=ZAMAN ekler/gunceller; her yayindan once
   calistirilir. Adres degisince tarayici dosyayi yeniden indirmek zorunda kalir.
   Kullanim:  node surumle.js
===================================================================== */
const fs = require('fs');
const path = require('path');
const dosya = path.join(__dirname, 'app', 'index.html');
let html = fs.readFileSync(dosya, 'utf8');
const d = new Date();
const p = n => String(n).padStart(2, '0');
const damga = `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`;
let say = 0;
html = html.replace(/(href|src)="((?:css|js)\/[^"?]+)(?:\?v=[^"]*)?"/g, (m, nitelik, yol) => { say++; return `${nitelik}="${yol}?v=${damga}"`; });
fs.writeFileSync(dosya, html, 'utf8');
console.log(`${say} adrese surum damgasi yazildi: ?v=${damga}`);
