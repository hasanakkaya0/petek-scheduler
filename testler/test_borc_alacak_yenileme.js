(async () => {
  await new Promise(r=>setTimeout(r,80));

  // Depolama okumasini yavaslat ki gercek hayattaki gecikme taklit edilsin
  const _get = store.get.bind(store);
  store.get = async (k) => { await new Promise(r=>setTimeout(r,3)); return _get(k); };

  // 1) Bos haftada basla
  currentMonday = new Date(2026,7,10); await loadWeek(); await renderLedger();
  console.log('  baslangic (10 Agustos):', (balanceCache['Kişi A']||{}).thisWeek);

  // 2) renderLedger'i BASLAT ama BEKLEME (hesap suruyor)
  const ilk = renderLedger();

  // 3) Hesap surerken kullanici hafta degistiriyor
  await new Promise(r=>setTimeout(r,5));
  currentMonday = new Date(2026,6,27); await loadWeek();
  renderLedger();                       // <- eski kodda bu SESSIZCE DUSER

  await ilk;
  await new Promise(r=>setTimeout(r,400));

  const s = (balanceCache['Kişi A']||{}).thisWeek;
  console.log('  hafta 27 Temmuz\'a gecti, ekrandaki deger:', s, ' (dogrusu: -21)');
  console.log(s === -21 ? '  >>> GECTI' : '  >>> KALDI — panelde ESKI deger takili');
})();
