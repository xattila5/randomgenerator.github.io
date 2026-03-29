function toggleNav() {
    document.getElementById('navDropdown').classList.toggle('open');
}

document.addEventListener('click', function (e) {
    const btn = document.getElementById('hamburgerBtn');
    const dropdown = document.getElementById('navDropdown');
    if (dropdown.classList.contains('open') && !btn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
    }
});

// ── PWA: Service Worker regisztráció ────────────────────
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// ── PWA: Telepítő gomb ──────────────────────────────────
let _installPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _installPrompt = e;
    const btn = document.getElementById('pwaInstallBtn');
    if (btn) btn.style.display = 'inline-flex';
});

window.addEventListener('appinstalled', () => {
    _installPrompt = null;
    const btn = document.getElementById('pwaInstallBtn');
    if (btn) btn.style.display = 'none';
});

function pwaInstall() {
    if (!_installPrompt) return;
    _installPrompt.prompt();
    _installPrompt.userChoice.then(() => { _installPrompt = null; });
}
