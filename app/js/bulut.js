/* =====================================================================
   BULUT SENKRONU (Firebase / Firestore)
   Verinin kalıcı yeri tarayıcı yerine Firestore olur; iki bilgisayar
   (patron + sen) aynı veriyi görür, yedek derdi biter.

   NASIL ÇALIŞIR
     - Giriş: kullanıcı adı + şifre (Firebase E-posta/Şifre). Veriye yalnızca erişim
       kuralındaki (Firestore rules) hesap kimliği (uid) ulaşabilir; kural sunucudadır,
       kodla aşılamaz. Kullanıcı adı "petek" arka planda petek@petek.app olur (sahte adres).
     - Her kayıt (ayarlar + her hafta) Firestore'da AYRI bir belge:
         workspaces/petek/kv/<anahtar>   { value: "<json metni>", updatedAt, by }
     - Başlangıçta bütün belgeler belleğe alınır; store.get/listKeys bellekten
       okur (76 haftalık hesaplar ağa gitmez). Yazma: belleğe + Firestore'a.
     - Çevrimdışı çalışır (Firestore yerel önbelleği); bağlantı gelince gönderir.
     - Diğer bilgisayarda bir şey değişince `Bulut.uzakDegisince(anahtarlar)`
       çağrılır, ekran kendini tazeler.

   BU DOSYA YALNIZCA ÇEKİRDEĞİ + FİREBASE KÖPRÜSÜNÜ İÇERİR. Depolama
   yönlendirmesi js/storage.js içinde (store → Bulut).

   Şu durumlarda bulut KAPALIDIR, program eskisi gibi tarayıcıda çalışır:
     - firebase-config.js boş            - dosya olarak açıldıysa (file://)
     - ?deneme modunda (test verisi buluta karışmasın)
     - Firebase kütüphanesi yüklenemediyse
===================================================================== */
const Bulut = (function(){
  let BEKLEME_MS = 15000;            // ilk veri bu sürede gelmezse "yüklenemedi" denir
  let _aktif = false, adapter = null, hazir = false;
  const veri = new Map();            // anahtar -> json metni
  let bekleyen = 0, sonHata = null;
  const api = {
    uzakDegisince: null,             // (anahtarlar[]) => diğer bilgisayardan değişiklik geldi
    hataVar: null,                   // (hata) => yazma/okuma hatası (izin yok vb.)
    kullanici: null,                 // {email}
  };

  api.aktif = () => _aktif;
  api.hazirMi = () => hazir;
  api.bekleyenYazma = () => bekleyen;
  api.sonHata = () => sonHata;
  api.cevrimici = () => (typeof navigator === 'undefined') ? true : navigator.onLine !== false;

  api.yapilandirildi = function(){
    const c = (typeof window !== 'undefined') ? window.PETEK_FIREBASE : null;
    if(typeof location !== 'undefined' && location.protocol === 'file:') return false;
    if(typeof DENEME_MODU !== 'undefined' && DENEME_MODU) return false;
    return !!(c && c.apiKey && c.projectId && window.firebase && window.firebase.initializeApp);
  };

  /* ---------- ÇEKİRDEK (Firebase'den bağımsız, test edilebilir) ----------
     adapter:
       dinle(onVeri, onHata)  onVeri([{id, value, yerel, silindi}])
       yaz(id, value) -> Promise
       sil(id) -> Promise                                                   */
  api.cekirdegiBaslat = function(ad){
    adapter = ad; _aktif = true; hazir = false; veri.clear();
    return new Promise((coz, reddet) => {
      let ilk = true;
      const zamanAsimi = setTimeout(() => {
        if(ilk){ ilk = false; reddet(Object.assign(new Error('zaman-asimi'), {code: 'zaman-asimi'})); }
      }, BEKLEME_MS);
      ad.dinle(liste => {
        const degisen = [];
        liste.forEach(x => {
          if(x.silindi){
            if(veri.delete(x.id) && !ilk && !x.yerel) degisen.push(x.id);
          } else if(veri.get(x.id) !== x.value){
            veri.set(x.id, x.value);
            if(!ilk && !x.yerel) degisen.push(x.id);      // kendi yazdığımız değişiklik "uzak" sayılmaz
          }
        });
        if(ilk){ ilk = false; hazir = true; clearTimeout(zamanAsimi); coz(); return; }
        if(degisen.length && api.uzakDegisince) api.uzakDegisince(degisen);
      }, hata => {
        sonHata = hata;
        if(ilk){ ilk = false; clearTimeout(zamanAsimi); reddet(hata); }
        else if(api.hataVar) api.hataVar(hata);
      });
    });
  };

  api.get = async function(key){
    return veri.has(key) ? {value: veri.get(key)} : null;
  };

  api.set = async function(key, val){
    veri.set(key, val);
    bekleyen++;
    Promise.resolve(adapter.yaz(key, val)).then(
      () => { bekleyen--; },
      e => { bekleyen--; sonHata = e; if(api.hataVar) api.hataVar(e); });
    return {value: val};
  };

  api.listKeys = async function(prefix){
    return [...veri.keys()].filter(k => k.startsWith(prefix || ''));
  };

  // Bulutta hiç kayıt yok mu? (ilk kurulum / taşıma kararı için)
  api.bosMu = () => veri.size === 0;

  /* ---------- FİREBASE KÖPRÜSÜ ---------- */
  function firebaseAdapter(cfg){
    const fb = window.firebase;
    if(!fb.apps.length) fb.initializeApp(cfg);
    const auth = fb.auth();
    const db = fb.firestore();
    try{ db.settings({ignoreUndefinedProperties: true}); }catch(e){ /* zaten ayarlı */ }
    const kalici = db.enablePersistence({synchronizeTabs: true}).catch(() => { /* desteklenmiyor: yalnız çevrimiçi */ });
    const kol = db.collection('workspaces').doc('petek').collection('kv');
    return {
      auth, kalici,
      email: () => (auth.currentUser && auth.currentUser.email) || '',
      dinle(onVeri, onHata){
        return kol.onSnapshot(snap => {
          onVeri(snap.docChanges().map(c => ({
            id: c.doc.id,
            value: c.type === 'removed' ? null : c.doc.data().value,
            yerel: c.doc.metadata.hasPendingWrites,
            silindi: c.type === 'removed',
          })));
        }, onHata);
      },
      yaz(id, value){
        return kol.doc(id).set({
          value,
          updatedAt: fb.firestore.FieldValue.serverTimestamp(),
          by: (auth.currentUser && auth.currentUser.email) || '',
        });
      },
      sil(id){ return kol.doc(id).delete(); },
    };
  }

  /* ---------- Giriş / engel ekranları ---------- */
  function ekran(html){
    let el = document.getElementById('bulutEkran');
    if(!el){
      el = document.createElement('div');
      el.id = 'bulutEkran';
      el.className = 'bulut-ekran';
      document.body.appendChild(el);
    }
    el.innerHTML = '<div class="bulut-kutu">' + html + '</div>';
    return el;
  }
  function ekraniKapat(){
    const el = document.getElementById('bulutEkran');
    if(el) el.remove();
  }

  const HATA_METNI = {
    'auth/invalid-credential': 'Kullanıcı adı ya da şifre yanlış.',
    'auth/wrong-password': 'Kullanıcı adı ya da şifre yanlış.',
    'auth/user-not-found': 'Kullanıcı adı ya da şifre yanlış.',
    'auth/invalid-email': 'Kullanıcı adı geçersiz.',
    'auth/missing-password': 'Şifreyi yaz.',
    'auth/too-many-requests': 'Çok fazla yanlış deneme. Biraz bekleyip tekrar dene.',
    'auth/network-request-failed': 'İnternet bağlantısı yok gibi görünüyor.',
    'auth/operation-not-allowed': 'Firebase konsolunda E-posta/Şifre girişi açık değil (Authentication → Sign-in method).',
  };

  // Kullanıcı adı (ör. "petek") Firebase için e-posta biçimine çevrilir; gerçek bir
  // e-posta değildir, hiçbir yere posta gitmez. "@" içeriyorsa olduğu gibi kullanılır.
  const EPOSTA_ALANI = '@petek.app';
  function kullaniciEpostasi(ad){
    ad = (ad || '').trim().toLowerCase();
    return ad.indexOf('@') >= 0 ? ad : ad + EPOSTA_ALANI;
  }
  function gosterilecekAd(email){ return (email || '').replace(EPOSTA_ALANI, ''); }

  function girisEkrani(auth){
    return new Promise(resolve => {
      const el = ekran(
        '<h2>Petek Çalışma Programı</h2>' +
        '<p>Giriş yap; bütün bilgisayarlar aynı veriyi görür.</p>' +
        '<form id="bulutForm" novalidate>' +
        '<label>Kullanıcı adı<input type="text" id="bulutKullanici" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false"></label>' +
        '<label>Şifre<input type="password" id="bulutSifre" autocomplete="current-password"></label>' +
        '<label class="bulut-goster"><input type="checkbox" id="bulutGoster"> Şifreyi göster</label>' +
        '<button type="submit" class="primary" id="bulutGiris">Giriş yap</button>' +
        '</form>' +
        '<p class="bulut-hata" id="bulutHata" role="alert"></p>');
      const hata = t => { el.querySelector('#bulutHata').textContent = t || ''; };
      const kutu = el.querySelector('#bulutKullanici');
      el.querySelector('#bulutGoster').onchange = ev => { el.querySelector('#bulutSifre').type = ev.target.checked ? 'text' : 'password'; };
      setTimeout(() => kutu && kutu.focus(), 50);
      el.querySelector('#bulutForm').onsubmit = async ev => {
        ev.preventDefault();
        const ad = kutu.value, sifre = el.querySelector('#bulutSifre').value;
        if(!ad.trim() || !sifre){ hata('Kullanıcı adı ve şifreyi yaz.'); return; }
        const dugme = el.querySelector('#bulutGiris');
        dugme.disabled = true; hata('');
        try{
          const cred = await auth.signInWithEmailAndPassword(kullaniciEpostasi(ad), sifre);
          ekraniKapat(); resolve(cred.user);
        }catch(e){
          dugme.disabled = false;
          hata((e && HATA_METNI[e.code]) || (e && e.message) || 'Giriş yapılamadı.');
        }
      };
    });
  }

  function engel(baslik, metin, auth){
    const el = ekran('<h2>' + baslik + '</h2><p>' + metin + '</p>' +
      '<div class="bulut-dugmeler"><button class="ghost" id="bulutYenile">Sayfayı yenile</button>' +
      (auth ? '<button class="primary" id="bulutCikis">Başka kullanıcıyla giriş yap</button>' : '') + '</div>');
    el.querySelector('#bulutYenile').onclick = () => location.reload();
    const c = el.querySelector('#bulutCikis');
    if(c) c.onclick = () => auth.signOut().then(() => location.reload());
  }

  function hesapRozeti(auth, email){
    const yer = document.getElementById('verBadge');
    if(!yer) return;
    yer.innerHTML = '';
    const s = document.createElement('span');
    s.textContent = '☁ ' + gosterilecekAd(email) + ' · ';
    const b = document.createElement('button');
    b.className = 'linkbtn';
    b.textContent = 'çıkış yap';
    b.onclick = () => { if(confirm('Çıkış yapılsın mı? (Veri bulutta durur, tekrar girince gelir.)')) auth.signOut().then(() => location.reload()); };
    yer.appendChild(s); yer.appendChild(b);
  }

  /* Programın açılışta çağırdığı ana fonksiyon.
     Başarılıysa bulut aktif ve veri belleğe yüklenmiştir.
     Başarısızsa program DURDURULUR (eski/boş veriyle üzerine yazmasın). */
  api.baglan = async function(){
    const ad = firebaseAdapter(window.PETEK_FIREBASE);
    const auth = ad.auth;
    await ad.kalici;
    // Yönlendirmeyle girişten dönüldüyse sonucu al
    try{ await auth.getRedirectResult(); }catch(e){ /* önemli değil */ }
    let user = await new Promise(r => { const off = auth.onAuthStateChanged(u => { off(); r(u); }); });
    if(!user) user = await girisEkrani(auth);
    api.kullanici = {email: user.email || ''};
    // Başka cihazda/sekmede çıkış yapılırsa yenile
    auth.onAuthStateChanged(u => { if(!u) location.reload(); });
    try{
      await api.cekirdegiBaslat(ad);
    }catch(e){
      _aktif = false;
      if(e && e.code === 'permission-denied'){
        engel('Bu hesaba izin verilmedi',
          '<b>' + gosterilecekAd(user.email) + '</b> kullanıcısı bu programın verilerine erişemiyor. ' +
          'Erişim yalnızca izin verilen hesaba açık. Doğru kullanıcı adıyla giriş yapmayı dene.', auth);
      } else {
        engel('Veriler yüklenemedi',
          'Buluttaki verilere ulaşılamadı. İnternet bağlantını kontrol edip sayfayı yenile. ' +
          '<br><small>' + (e && (e.code || e.message) || '') + '</small>', null);
      }
      throw e;
    }
    api.hataVar = e => {
      if(e && e.code === 'permission-denied') engel('Erişim kaldırıldı', 'Bu hesabın verilere erişim izni artık yok.', auth);
    };
    hesapRozeti(auth, user.email || '');
  };

  // Test için: sahte adapter ile başlat
  api._testBaslat = (ad) => api.cekirdegiBaslat(ad);
  api._testBeklemeMs = ms => { BEKLEME_MS = ms; };
  api._testSifirla =() => { _aktif = false; adapter = null; hazir = false; veri.clear(); bekleyen = 0; sonHata = null; api.uzakDegisince = null; api.hataVar = null; };

  return api;
})();
