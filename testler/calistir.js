/* =====================================================================
   TEST CALISTIRICI
   Kullanim:  node calistir.js
   Tum testleri sirayla calistirir ve sonuclari ekrana yazar.
===================================================================== */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const KOK = path.resolve(__dirname, '..');
const APP = path.join(KOK, 'app');
const GECICI = path.join(__dirname, '.gecici');

if (!fs.existsSync(GECICI)) fs.mkdirSync(GECICI);

// ---- 1) Uygulamadaki JS yukleme sirasini index.html'den oku ----
const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
const disDosyalar = [...html.matchAll(/src="(js\/[^"]+)"/g)].map(m => path.join(APP, m[1].split("?")[0]));
const inlineJS = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');

// ---- 2) HTML'deki tum element id'lerini topla ----
const tumMetin = html + disDosyalar.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const idler = [...new Set([...tumMetin.matchAll(/id=["']([A-Za-z0-9_-]+)["']/g)].map(m => m[1]))];
fs.writeFileSync(path.join(GECICI, 'idler.json'), JSON.stringify(idler));

// ---- 3) Gercek yedegi test verisi olarak yukle ----
const yedekKlasor = path.join(KOK, 'yedekler');
const yedekler = fs.readdirSync(yedekKlasor).filter(f => f.endsWith('.json')).sort();
if (!yedekler.length) { console.error('HATA: yedekler/ klasorunde JSON yedek yok.'); process.exit(1); }
const yedek = JSON.parse(fs.readFileSync(path.join(yedekKlasor, yedekler[yedekler.length - 1]), 'utf8'));
const tohum = { 'petek:settings': JSON.stringify(yedek.settings) };
for (const [k, v] of Object.entries(yedek.weeks || {})) tohum['petek:' + k] = JSON.stringify(v);
fs.writeFileSync(path.join(GECICI, 'seed.json'), JSON.stringify(tohum));

console.log('Test verisi :', yedekler[yedekler.length - 1]);
console.log('JS dosyasi  :', disDosyalar.length, '+ index.html ici kod');
console.log('');

// ---- 4) Testleri sirayla calistir ----
const testler = [
  ['KURAL DENETIMI (7 hafta)',        'kural_denetimi.js'],
  ['IZIN GUNU KORUMASI',              'test_izin_gunu.js'],
  ['BORC IZNI',                        'test_borc_izin.js'],
  ['BORC/ALACAK PANEL YENILENMESI',   'test_borc_alacak_yenileme.js'],
  ['HAFTA KILIDI',                    'test_hafta_kilidi.js'],
  ['CANLI DURUM PANELI',             'test_canli_durum.js'],
  ['BOS HAFTA / ELLE DOLDURMA',         'test_bos_hafta.js'],
  ['HUCRE DUZENLEME (oneri saat, bos sabit)', 'test_hucre_duzenleme.js'],
  ['SURUKLE-BIRAK KOPYALAMA',        'test_surukle_birak.js'],
  ['YILLIK IZIN SAYACI',             'test_yillik_izin.js'],
  ['DUKKAN SAATLERI (tarihli duzen)', 'test_dukkan_saatleri.js'],
  ['SEKMELER (Cizelge/Sayaclar/Ayarlar)', 'test_sekmeler.js'],
  ['BULUT SENKRONU (Firebase, sahte sunucu)', 'test_bulut.js'],
  ['BIRLIKTE CALISMA UYARISI',        'test_birlikte.js'],
  ['YENILE DUGMESI',                  'test_yenile.js'],
  ['OTOMATIK KOPYALAR (gunluk, geri donus)', 'test_oto_kopya.js'],
  ['YENI SURUM SERIDI',               'test_surum_kontrol.js'],
  ['ORNEK VERI (deneme modu)',       'test_ornek_veri.js'],
  ['ANA/YEDEK GOREV ONCELIGI',       'test_ana_yedek_gorev.js'],
  ['ERKEN CIKIS = KAPANISA KALMAMA', 'test_erken_cikis.js'],
  ['KAPANIS SINIRI + GRUP',          'test_kapanis_siniri.js'],
  ['KADRO GECERLILIK TARIHI',        'test_kadro_tarihi.js'],
  ['PERSONEL SILME (tamamen)',       'test_personel_silme.js'],
  ['GORSEL INDIRME (PNG)',           'test_gorsel.js'],
  ['GORSEL TASMA KONTROLU',          'test_gorsel_tasma.js'],
  ['KALITE RAPORU (4 hafta)',        'kalite_raporu.js'],
];

let hata = 0;
for (const [baslik, dosya] of testler) {
  console.log('='.repeat(70));
  console.log('  ' + baslik);
  console.log('='.repeat(70));

  const parcalar = [
    fs.readFileSync(path.join(__dirname, '_tarayici_taklidi.js'), 'utf8'),
    ...disDosyalar.map(f => fs.readFileSync(f, 'utf8')),
    inlineJS,
    fs.readFileSync(path.join(__dirname, dosya), 'utf8'),
  ];
  const birlesik = path.join(GECICI, 'calisan_' + dosya);
  fs.writeFileSync(birlesik, parcalar.join('\n'));

  const r = cp.spawnSync(process.execPath, [birlesik], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, {
      IDFILE: path.join(GECICI, 'idler.json'),
      SEEDFILE: path.join(GECICI, 'seed.json'),
      APPDIR: APP,            // kaynak kodu kontrolu yapan testler icin
    }),
  });
  process.stdout.write(r.stdout || '');
  if (r.stderr) { process.stderr.write(r.stderr); hata++; }
  console.log('');
}

console.log('='.repeat(70));
console.log(hata ? '  ' + hata + ' testte HATA cikti (yukariya bak)' : '  Tum testler calisti.');
console.log('  Bulgularin hangisi normal, hangisi degil: CALISTIR.md dosyasina bak.');
console.log('='.repeat(70));
