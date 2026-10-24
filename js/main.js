// ============================================================
//  Точка входа
// ============================================================
(function init() {
  bindEvents();
  if (!load()) newGame('Лудус Батиата');
  else migrateState();
  STATE.settings = STATE.settings || { mode: 'auto' };
  if (typeof META !== 'undefined') META.init();
  // фоновая музыка лудуса; заиграет после первого клика или нажатия клавиши
  if (typeof SFX !== 'undefined' && SFX.music) SFX.music('menu');
  // сохранения старых версий: внешность бойцов
  STATE.gladiators.forEach(ensureLook);
  STATE.market.forEach(ensureLook);
  STATE.events.forEach(e => e.enemies.forEach(ensureLook));
  STATE.graveyard.forEach(d => { if (!d.look) d.look = randomLook(); });
  render();
  try {
    if (sessionStorage.getItem('ludus_imported')) { sessionStorage.removeItem('ludus_imported'); toast(`Сохранение загружено: ${saveSummary(STATE)}.`); }
  } catch (e) { /* хранилище недоступно */ }
})();
