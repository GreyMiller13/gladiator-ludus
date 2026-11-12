// Прогрев ближайших изображений. Очередь не меняет STATE и не задерживает переходы.
const IMAGE_PRELOAD = (() => {
  const ready = new Set(), failed = new Set();
  let loaded = document.readyState === 'complete', wanted = [], busy = false, scheduled = false;
  const absolute = url => new URL(url, document.baseURI).href;
  const allowed = () => !document.hidden && navigator.onLine !== false
    && !navigator.connection?.saveData && !['slow-2g', '2g'].includes(navigator.connection?.effectiveType);

  function portraitUrl(line) {
    if (!line) return null;
    let key = line.key || line.who;
    if (key === 'holder') key = STATE?.debt?.holder || 'lender';
    if (key === 'me') key = STATE?.lanista?.portrait || 'm1';
    return PORTRAIT.assetUrl(key, line.expr, 310);
  }

  function nextPortrait(creating) {
    if (creating) return portraitUrl(STORY.SCENES.prologue[0]);
    if (!STATE?.story) return null;
    const current = sceneOpen() ? portraitUrl(SCENE.lines[SCENE.i]) : null;
    // Читаем реплики напрямую: не вызываем takeScenes/markSeen и не вычисляем тексты.
    if (sceneOpen()) {
      const next = SCENE.lines.slice(SCENE.i + 1).map(portraitUrl).find(url => url && url !== current);
      if (next) return next;
    }
    const ids = sceneOpen() ? SCENE.ids : STATE.story.queue || [];
    const id = ids.find(id => !STATE.story.seen[id] && STORY.SCENES[id]);
    return (STORY.SCENES[id] || []).map(portraitUrl).find(url => url && url !== current) || null;
  }

  function plan() {
    const creating = !STATE || (MENU.open && MENU_PAGES.page === 'new');
    const current = creating ? 0 : arenaTab();
    const tier = typeof current === 'number' ? current : STATE.bet?.tier ?? maxTier();
    wanted = [...new Set([nextPortrait(creating), ARENA_ART[tier]].filter(Boolean).map(absolute))];
    schedule();
  }

  function schedule() {
    if (!loaded || scheduled || busy || !allowed() || !wanted.some(url => !ready.has(url) && !failed.has(url))) return;
    scheduled = true;
    const run = () => { scheduled = false; pump(); };
    if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 1500 });
    else setTimeout(run, 150);
  }

  function pump() {
    if (!loaded || busy || !allowed()) return;
    // Сначала загружаются изображения текущего экрана, включая миниатюры новой игры.
    const visible = [...document.images].filter(img => img.getClientRects().length);
    for (const img of visible) {
      if (img.complete && img.naturalWidth && wanted.includes(img.currentSrc || img.src)) ready.add(img.currentSrc || img.src);
    }
    if (visible.some(img => !img.complete)) return;
    const url = wanted.find(url => !ready.has(url) && !failed.has(url));
    if (!url) return;
    busy = true;
    const img = new Image();
    img.fetchPriority = 'low';
    img.decoding = 'async';
    const finish = () => { img.onload = img.onerror = null; busy = false; schedule(); };
    img.onload = async () => {
      if (img.decode) await img.decode().catch(() => {});
      ready.add(url);
      finish();
    };
    img.onerror = () => { failed.add(url); finish(); };
    img.src = url;
    // После завершения запроса Image освобождается, остаётся только URL в Set.
  }

  if (loaded) queueMicrotask(plan);
  else window.addEventListener('load', () => { loaded = true; plan(); }, { once: true });
  document.addEventListener('load', schedule, true);
  document.addEventListener('error', schedule, true);
  document.addEventListener('visibilitychange', schedule);
  window.addEventListener('online', () => { failed.clear(); plan(); });
  return { plan };
})();
