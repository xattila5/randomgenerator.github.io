/* ─────────────────────────────────────────────────────────
   effects.js  –  Scroll reveal, spotlight, 3D tilt,
                  magnetic buttons, cursor glow, ripple
                  S.A.L. Tools
   ───────────────────────────────────────────────────────── */

'use strict';

// ── Helper: querySelectorAll that also checks root itself ─
function _sel(root, selector) {
    const hits = [];
    try { if (root.matches && root.matches(selector)) hits.push(root); } catch(e) {}
    root.querySelectorAll(selector).forEach(el => hits.push(el));
    return hits;
}


// ── 1. Cursor glow – disabled on news page ───────────────
if (!document.body.classList.contains('news-body')) {
    const _glow = document.createElement('div');
    _glow.className = 'cursor-glow';
    document.body.appendChild(_glow);

    let _mx = innerWidth / 2, _my = innerHeight / 2;
    let _gx = _mx, _gy = _my;

    window.addEventListener('mousemove', e => { _mx = e.clientX; _my = e.clientY; }, { passive: true });

    (function _animGlow() {
        _gx += (_mx - _gx) * 0.06;
        _gy += (_my - _gy) * 0.06;
        _glow.style.transform = `translate(${_gx - 200}px, ${_gy - 200}px)`;
        requestAnimationFrame(_animGlow);
    })();
}


// ── 2. Scroll reveal (IntersectionObserver) ──────────────
const _revObs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.05, rootMargin: '0px 0px -24px 0px' });

function _observeReveal(el) {
    if (!el.classList.contains('reveal')) el.classList.add('reveal');
    _revObs.observe(el);
}


// ── 3. Spotlight – cursor-tracking radial inside card ────
function _attachSpotlight(el) {
    if (el._sal_spot) return;
    el._sal_spot = true;

    const layer = document.createElement('div');
    layer.className = 'spotlight-layer';
    el.appendChild(layer);

    el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--sx', ((e.clientX - r.left) / r.width  * 100) + '%');
        el.style.setProperty('--sy', ((e.clientY - r.top)  / r.height * 100) + '%');
    }, { passive: true });
}


// ── 4. 3D tilt on hover ──────────────────────────────────
function _attachTilt(el) {
    if (el._sal_tilt) return;
    el._sal_tilt = true;

    el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width  - 0.5;
        const y = (e.clientY - r.top)  / r.height - 0.5;
        el.style.transform =
            `translateY(-4px) perspective(700px) ` +
            `rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateZ(8px)`;
    }, { passive: true });

    el.addEventListener('mouseleave', () => {
        el.style.transition = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)';
        el.style.transform = '';
        setTimeout(() => { el.style.transition = ''; }, 500);
    });
}


// ── 5. Magnetic pull on buttons ──────────────────────────
function _attachMagnetic(el) {
    if (el._sal_mag) return;
    el._sal_mag = true;

    el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width  / 2) * 0.22;
        const y = (e.clientY - r.top  - r.height / 2) * 0.22;
        el.style.transform = `translate(${x}px, ${y}px)`;
    }, { passive: true });

    el.addEventListener('mouseleave', () => {
        el.style.transition = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)';
        el.style.transform = '';
        setTimeout(() => { el.style.transition = ''; }, 500);
    });
}


// ── 6. Ripple on click ───────────────────────────────────
function _attachRipple(el) {
    if (el._sal_ripple) return;
    el._sal_ripple = true;

    el.addEventListener('click', e => {
        const r  = el.getBoundingClientRect();
        const rp = document.createElement('span');
        rp.className  = 'ripple-effect';
        rp.style.left = (e.clientX - r.left) + 'px';
        rp.style.top  = (e.clientY - r.top)  + 'px';
        el.appendChild(rp);
        setTimeout(() => rp.remove(), 700);
    });
}


// ── 7. Counter-up for price numbers (prefix preserved) ───
function _animateCounter(el) {
    if (el._sal_counted) return;
    const text   = el.textContent;
    const prefix = text.match(/^[^0-9]*/)?.[0] ?? '';   // e.g. '$'
    const raw    = text.replace(/[^0-9.]/g, '');
    const num    = parseFloat(raw);
    if (isNaN(num) || num === 0) return;
    el._sal_counted = true;

    const start    = performance.now();
    const dur      = 900;
    const from     = num * 0.6;
    const decimals = raw.includes('.') ? (raw.split('.')[1] || '').length : 0;

    const fmt = v => prefix + (num >= 1000
        ? v.toLocaleString('en-US', { maximumFractionDigits: 0 })
        : v.toFixed(decimals));

    (function step(now) {
        const t   = Math.min((now - start) / dur, 1);
        const eas = 1 - Math.pow(1 - t, 3);
        el.textContent = fmt(from + (num - from) * eas);
        if (t < 1) requestAnimationFrame(step);
        else el.textContent = fmt(num);
    })(start);
}


// ── 8. News card slide-in: direction by DOM index ────────
function _applyNewsCard(el) {
    if (el.getAttribute('data-fx')) return;
    el.setAttribute('data-fx', '1');

    // Determine column direction based on position in parent
    const siblings = el.parentElement ? Array.from(el.parentElement.children) : [];
    const idx = siblings.indexOf(el);
    const dir = idx % 2 === 0 ? 'reveal-left' : 'reveal-right';
    el.classList.add(dir);
    _revObs.observe(el);
    _attachSpotlight(el);
}


// ── 9. Apply all effects ─────────────────────────────────
function _apply(root) {
    // News cards: slide from sides
    _sel(root, '.news-card:not([data-fx])').forEach(_applyNewsCard);

    // Asset cards: reveal up + spotlight (no tilt — conflicts with CSS hover)
    _sel(root, '.asset-card:not([data-fx])').forEach(el => {
        el.setAttribute('data-fx', '1');
        _observeReveal(el);
        _attachSpotlight(el);
    });

    // Weather day cards: reveal up + spotlight + tilt
    _sel(root, '.weather-day-card:not([data-fx])').forEach(el => {
        el.setAttribute('data-fx', '1');
        _observeReveal(el);
        _attachSpotlight(el);
        _attachTilt(el);
    });

    // Static cards: spotlight only
    _sel(root, '.card:not([data-fx]), .output-card:not([data-fx]), .weather-today-card:not([data-fx])').forEach(el => {
        el.setAttribute('data-fx', '1');
        _attachSpotlight(el);
    });

    // Buttons: magnetic + ripple
    _sel(root,
        '.btn-primary:not([data-fx]), .btn-secondary:not([data-fx]), ' +
        '.hamburger-btn:not([data-fx]), .stock-search-btn:not([data-fx]), ' +
        '.grafikon-back-btn:not([data-fx]), .btn-city:not([data-fx]), ' +
        '.btn-refresh:not([data-fx])'
    ).forEach(el => {
        el.setAttribute('data-fx', '1');
        _attachMagnetic(el);
        _attachRipple(el);
    });

    // Asset prices: count up on enter
    _sel(root, '.asset-price:not([data-fx])').forEach(el => {
        el.setAttribute('data-fx', '1');
        const obs = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) { _animateCounter(el); obs.disconnect(); }
        }, { threshold: 0.5 });
        obs.observe(el);
    });
}

// ── 10. Boot ─────────────────────────────────────────────
_apply(document);

new MutationObserver(muts => {
    muts.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType === 1) _apply(n);
    }));
}).observe(document.body, { childList: true, subtree: true });

// ── 11. Fallback: ensure nothing stays invisible ─────────
setTimeout(() => {
    document.querySelectorAll('.reveal:not(.visible), .reveal-left:not(.visible), .reveal-right:not(.visible)')
        .forEach(el => el.classList.add('visible'));
}, 4000);
