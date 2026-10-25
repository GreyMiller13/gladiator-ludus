// ============================================================
//  Точка входа
// ============================================================
(function init() {
  bindEvents();
  if (load()) prepareState();
  // фоновая музыка лудуса; заиграет после первого клика или нажатия клавиши
  if (typeof SFX !== 'undefined' && SFX.music) SFX.music('menu');
  if (STATE) render();
  // после импорта сохранения сразу продолжаем игру, иначе встречает главное меню
  let imported = false;
  try { imported = !!sessionStorage.getItem('ludus_imported'); sessionStorage.removeItem('ludus_imported'); } catch (e) { /* хранилище недоступно */ }
  if (imported && STATE) {
    toast(`Сохранение загружено: ${saveSummary(STATE)}.`);
    if (STATE.lost) showDebtLost();
    else flushScenes(() => resumeStory());
  } else showMenu();
})();

// Загруженное сохранение: миграция и поля, которых не было в старых версиях
function prepareState() {
  migrateState();
  STATE.settings = STATE.settings || { mode: 'auto' };
  if (typeof META !== 'undefined') META.init();
  if (typeof STORY !== 'undefined') STORY.init();
  // сохранения старых версий: внешность бойцов
  STATE.gladiators.forEach(ensureLook);
  STATE.market.forEach(ensureLook);
  STATE.events.forEach(e => e.enemies.forEach(ensureLook));
  STATE.graveyard.forEach(d => { if (!d.look) d.look = randomLook(); });
}
