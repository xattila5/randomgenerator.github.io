(function () {
  'use strict';

  const SEEN_KEY   = 'sal_seen_ids';
  const POLL_MS    = 15 * 60 * 1000; // 15 perc
  const SECTIONS   = ['world', 'politics', 'business'];

  function getSeenIds() {
    try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); }
    catch { return new Set(); }
  }

  function saveSeenIds(set) {
    // Max 500 ID tárolása
    localStorage.setItem(SEEN_KEY, JSON.stringify([...set].slice(-500)));
  }

  async function fetchSection(section) {
    try {
      const r = await fetch(`/api/guardian?section=${section}`);
      if (!r.ok) return [];
      const d = await r.json();
      return d.response?.results || [];
    } catch { return []; }
  }

  async function checkAndNotify() {
    if (!('serviceWorker' in navigator)) return;
    if (Notification.permission !== 'granted') return;

    const seen       = getSeenIds();
    const firstLoad  = seen.size === 0;
    const all        = (await Promise.all(SECTIONS.map(fetchSection))).flat();

    if (all.length === 0) return;

    const newOnes = firstLoad ? [] : all.filter(a => !seen.has(a.id));
    all.forEach(a => seen.add(a.id));
    saveSeenIds(seen);

    if (newOnes.length === 0) return;

    const sw = await navigator.serviceWorker.ready;
    if (!sw.active) return;

    sw.active.postMessage({
      type:  'NOTIFY',
      title: newOnes.length === 1 ? 'Új hír érkezett' : `${newOnes.length} új hír érkezett`,
      body:  newOnes.slice(0, 3).map(a => a.webTitle).join('\n'),
      url:   '/hirek.html',
    });
  }

  async function init() {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return;

    // Engedély kérése csak egyszer, ha még nem döntött
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    await checkAndNotify();
    setInterval(checkAndNotify, POLL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
