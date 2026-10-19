/* =====================================================================
   ÖRNEK VERİ — yalnızca DENEME MODUNDA (adresin sonuna ?deneme)
   Programı ilk kez gören biri (portföy ziyaretçisi, yeni kullanıcı) boş bir
   ekranla karşılaşmasın diye UYDURMA bir kadro yükler ve bir hafta kurar.
   Buradaki isimlerin hiçbiri gerçek bir kişiye ait değildir.

   Gerçek modda (bulut) bu düğme yoktur; deneme verisi ayrı kutuda
   ("petek-deneme:") tutulur, gerçek veriye ve buluta hiç karışmaz.
===================================================================== */
const ORNEK_PERSONEL = [
  {name:'Ada',     hasRow:true, type:'Tam zamanlı', hours:10, primary:['KASA'],            backup:['MUHASEBE'],            sup:true},
  {name:'Berk',    hasRow:true, type:'Tam zamanlı', hours:10, primary:['KASA'],            backup:['KIRTASIYE'],           sup:true},
  {name:'Ceren',   hasRow:true, type:'Tam zamanlı', hours:10, primary:['KIRTASIYE'],       backup:['KASA','FOTOKOPI'],     sup:false, prefOff:'weekend'},
  {name:'Deniz',   hasRow:true, type:'Tam zamanlı', hours:10, primary:['KIRTASIYE'],       backup:['CANTA','FOTOKOPI'],    sup:false},
  {name:'Emre',    hasRow:true, type:'Tam zamanlı', hours:10, primary:['DERS_KITAPLARI'],  backup:['KIRTASIYE'],           sup:false},
  {name:'Fulya',   hasRow:true, type:'Tam zamanlı', hours:10, primary:['DERS_KITAPLARI'],  backup:['KASA'],                sup:false},
  {name:'Gül',     hasRow:true, type:'Tam zamanlı', hours:10, primary:['DERS_KITAPLARI'],  backup:['KIRTASIYE'],           sup:false},
  {name:'Gökhan',  hasRow:true, type:'Tam zamanlı', hours:9,  primary:['FOTOKOPI'],        backup:['DEPO','KIRTASIYE'],    sup:false},
  {name:'Hale',    hasRow:true, type:'Tam zamanlı', hours:9,  primary:['OKUMA_KITABI','KAFE','SANATSAL'], backup:['OYUNCAK'], sup:true},
  {name:'İlker',   hasRow:true, type:'Tam zamanlı', hours:9,  primary:['KAFE','SANATSAL','OKUMA_KITABI','OYUNCAK'], backup:[], sup:false, prefOff:'weekend-alt'},
  {name:'Kaan',    hasRow:true, type:'Tam zamanlı', hours:10, primary:['DEPO','SEVKIYAT'], backup:['FOTOKOPI','CANTA'],    sup:false},
  {name:'Lale',    hasRow:true, type:'Tam zamanlı', hours:9,  primary:['KAFE','OKUMA_KITABI','SANATSAL'], backup:['OYUNCAK'], sup:false},
  {name:'Müdür',   hasRow:false, type:'Yönetici',   hours:null, primary:[],               backup:[],                      sup:true},
];

// ÇEKİRDEK: kadroyu, kuralları ve borç/alacak kayıtlarını örnek veriyle değiştirir (test edilebilir)
function ornekVeriyiKur(){
  PEOPLE = ORNEK_PERSONEL.map(p => JSON.parse(JSON.stringify(p)));
  rules = JSON.parse(JSON.stringify(DEFAULT_RULES));
  // Fotokopi tek kişilik ve gün 12 saat: gerçek dükkândaki gibi kural 11:00'den itibaren geçerli (sabah boşluğu "açık" sayılmaz)
  rules.forEach(r => { if(r.id === 'fotokopi') r.from = '11:00'; });
  ledger = [];
  rebuildPeople();
}

// ARAYÜZ: deneme modundaki turuncu şeritteki "Örnek personeli yükle" düğmesi
async function ornekVeriYukle(){
  if(!DENEME_MODU){
    alert('Örnek veri yalnızca deneme modunda yüklenebilir (adresin sonuna ?deneme ekle).');
    return;
  }
  if(PEOPLE.length && !confirm('Deneme kadrosunun üzerine örnek personel yazılacak.\n\nDevam edilsin mi?')) return;
  ornekVeriyiKur();
  await saveSettings();
  haftayaGoreKadroyuTazele();
  ensureWeekPeople();
  if(!haftaKilitli()){
    prevSundayOff = new Set();
    undoKaydet();
    const rapor = generateWeek();
    renderGenReport(rapor);
  }
  scheduleSave();
  renderAll();
  bildirimGoster('Örnek personel yüklendi ve bu hafta otomatik oluşturuldu. İstediğin hücreye tıklayıp değiştirebilirsin.');
}
