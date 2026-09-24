(async () => {
  await new Promise(r=>setTimeout(r,80));
  currentMonday = new Date(2026,7,17); await loadWeek(); ensureWeekPeople();

  const gunler = () => [...Array(7)].map((_,i)=>fmtDate(addDays(currentMonday,i)));
  const izinGunleri = (ad) => gunler().map((k,i)=>({k,i}))
      .filter(({k}) => isOffLeave(weekData.days[k].assignments[ad])).map(({i})=>DAY_NAMES[i]);
  const calisilanGun = (ad) => gunler().filter(k => isWorking(weekData.days[k].assignments[ad])).length;

  // 1) Normal olustur
  generateWeek();
  const kisi = ROSTER.find(p => !isOnCall(p) && izinGunleri(p.name).length > 0);
  const ilkIzin = izinGunleri(kisi.name);
  console.log('1) Normal olusturma:');
  console.log('   ' + kisi.name + ' -> izin gunu:', ilkIzin.join(', '), '| calistigi gun:', calisilanGun(kisi.name));

  // 2) Kullanici o izin gunune "calissin" yaziyor (elle, sabit)
  const izinIdx = DAY_NAMES.indexOf(ilkIzin[0]);
  const hedefGun = gunler()[izinIdx];
  weekData.days[hedefGun].assignments[kisi.name] =
      {leave:'NONE', start:'09:00', end:'19:00', zone:kisi.primary[0], manual:true};
  console.log('');
  console.log('2) Kullanici ' + ilkIzin[0] + ' gunune "calissin 09:00-19:00" yazdi (sabit)');

  // 3) Tekrar olustur
  generateWeek();
  const sonIzin = izinGunleri(kisi.name);
  const sonCalisma = calisilanGun(kisi.name);
  console.log('');
  console.log('3) Yeniden olusturma sonrasi:');
  console.log('   ' + kisi.name + ' -> izin gunu:', sonIzin.length ? sonIzin.join(', ') : '(HIC YOK)');
  console.log('   calistigi gun sayisi:', sonCalisma, '/ 7');
  console.log('');
  console.log(sonIzin.length === 0
    ? '   >>> HATA DOGRULANDI: personel IZINSIZ, 7 gun calisiyor'
    : '   >>> sorun yok, izin gunu korunmus');
})();
