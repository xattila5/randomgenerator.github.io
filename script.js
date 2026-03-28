let words = [];
let wordsLoading = null;

const FALLBACK_WORDS = [
    'alma', 'banán', 'cseresznye', 'dinnye', 'eper', 'füge', 'körte', 'citrom',
    'narancs', 'szőlő', 'áfonya', 'ribizli', 'málna', 'barack', 'szilva', 'meggy',
    'dió', 'mandula', 'mogyoró', 'gesztenye', 'datolya', 'avokádó', 'ananász',
    'ház', 'kert', 'erdő', 'folyó', 'hegy', 'völgy', 'szél', 'eső', 'nap', 'hold',
    'könyv', 'szék', 'asztal', 'ablak', 'ajtó', 'tükör', 'lámpa', 'óra', 'toll',
    'kutya', 'macska', 'madár', 'hal', 'ló', 'tehén', 'birka', 'kecske', 'nyúl',
    'virág', 'fa', 'levél', 'gyökér', 'ág', 'bokor', 'fű', 'mező', 'rét', 'tó',
];

async function loadWords() {
    if (words.length > 0) return;
    if (wordsLoading) return wordsLoading;

    wordsLoading = (async () => {
        try {
            const url = 'https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/hu/index.dic';
            const res = await fetch(url);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const text = await res.text();
            const parsed = text.split('\n')
                .slice(1)
                .map(l => l.split('/')[0].trim())
                .filter(w => w.length >= 3 && w.length <= 14 &&
                             /^[a-záéíóöőúüűA-ZÁÉÍÓÖŐÚÜŰ]+$/.test(w));
            words = parsed.length >= 100 ? parsed : FALLBACK_WORDS;
        } catch {
            words = FALLBACK_WORDS;
        }
    })();
    return wordsLoading;
}

document.addEventListener('DOMContentLoaded', () => { loadWords(); });

function updateCharCount(text) {
    const el = document.getElementById('charCount');
    if (!text || text.trim() === '') { el.innerHTML = ''; return; }
    el.innerHTML = `<span>${text.length}</span> karakter`;
}

function setStatus(active) {
    document.getElementById('statusDot').classList.toggle('active', active);
}

async function displayRandomText() {
    const input = document.getElementById('karakterszam').value.trim();
    const karakterszam = parseInt(input);

    if (input === '' || isNaN(karakterszam) || karakterszam < 1) {
        shakeInput('karakterszam'); return;
    }
    if (karakterszam > 100000) {
        alert("A generálandó szöveg túl hosszú."); return;
    }

    const outputCard = document.getElementById('outputCard');
    outputCard.classList.add('generating');

    await loadWords();

    setTimeout(() => {
        const randomText = generateRandomText(karakterszam);
        outputCard.classList.remove('generating');
        const el = document.getElementById('randomText');
        el.textContent = randomText;
        updateCharCount(randomText);
        setStatus(true);
        animateIn(el);
    }, 300);
}

function generateRandomText(targetLength) {
    // Prefix: "100 " jelzi a kért hosszt, a maradék karakterek töltik fel a szöveget
    const prefix = `${targetLength} `;

    // Ha a prefix már eléri vagy meghaladja a kért hosszt, csak azt adjuk vissza
    if (prefix.length >= targetLength) {
        return prefix.substring(0, targetLength);
    }

    const contentLength = targetLength - prefix.length;
    let content = '';
    let currentLength = 0;

    while (currentLength < contentLength) {
        const randomWord = words[Math.floor(Math.random() * words.length)];
        const separator = currentLength === 0 ? '' : ' ';
        const addition = separator + randomWord;

        if (currentLength + addition.length <= contentLength) {
            content += addition;
            currentLength += addition.length;
        } else {
            const remaining = contentLength - currentLength;
            if (remaining > 0) {
                const sep = currentLength === 0 ? '' : ' ';
                const available = remaining - sep.length;
                if (available > 0) {
                    content += sep + randomWord.substring(0, available);
                }
            }
            break;
        }
    }

    return prefix + content;
}

function highlightCharacters() {
    const randomTextElement = document.getElementById('randomText');
    const text = randomTextElement.textContent;

    if (!text || text.trim() === '') { shakeInput('highlightIndex'); return; }

    const inputVal = document.getElementById('highlightIndex').value.trim();
    if (!inputVal) { shakeInput('highlightIndex'); return; }

    const indices = new Set();
    for (const raw of inputVal.split(',')) {
        const idx = parseInt(raw.trim());
        if (!isNaN(idx) && idx >= 1 && idx <= text.length) {
            indices.add(idx - 1); // 1-alapú → 0-alapú
        }
    }

    let html = '';
    for (let i = 0; i < text.length; i++) {
        if (indices.has(i)) {
            html += `<span class="highlight-char">${escapeHtml(text[i])}</span>`;
        } else {
            html += escapeHtml(text[i]);
        }
    }
    randomTextElement.innerHTML = html;
}

function escapeHtml(char) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
    return map[char] || char;
}

function copyToClipboard() {
    const textToCopy = document.getElementById('randomText').innerText;
    if (!textToCopy || textToCopy.trim() === '') return;

    const btn = document.getElementById('copyButton');
    launchConfetti(btn);
    btn.textContent = '✓ Másolva';
    btn.classList.add('copied');
    setTimeout(() => {
        btn.textContent = 'Másolás';
        btn.classList.remove('copied');
    }, 2000);

    navigator.clipboard.writeText(textToCopy)
        .catch(err => console.error('Másolási hiba:', err));
}

function launchConfetti(originEl) {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const rect = originEl.getBoundingClientRect();
    const ox = rect.left + rect.width / 2;
    const oy = rect.top + rect.height / 2;

    const colors = ['#d4b87a', '#b89a5a', '#f0d49a', '#8a6e38', '#e8cc88', '#fae8b4'];

    const particles = Array.from({ length: 72 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 6;
        const size = 4 + Math.random() * 6;
        return {
            x: ox, y: oy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - (2 + Math.random() * 3),
            w: size, h: size * (0.3 + Math.random() * 0.5),
            rot: Math.random() * 360,
            rotV: (Math.random() - 0.5) * 8,
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: 1,
            gravity: 0.18 + Math.random() * 0.1
        };
    });

    let frame;
    function tick() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;
        for (const p of particles) {
            p.vy += p.gravity;
            p.x += p.vx;
            p.y += p.vy;
            p.rot += p.rotV;
            p.alpha -= 0.014;
            if (p.alpha <= 0) continue;
            alive = true;
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot * Math.PI / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        }
        if (alive) {
            frame = requestAnimationFrame(tick);
        } else {
            canvas.remove();
        }
    }
    frame = requestAnimationFrame(tick);
}

function shakeInput(id) {
    const el = document.getElementById(id);
    let count = 0;
    el.style.borderColor = 'rgba(255, 80, 80, 0.5)';
    const interval = setInterval(() => {
        el.style.transform = count % 2 === 0 ? 'translateX(5px)' : 'translateX(-5px)';
        count++;
        if (count > 5) {
            clearInterval(interval);
            el.style.transform = '';
        }
    }, 60);
    setTimeout(() => { el.style.borderColor = ''; }, 500);
}

function animateIn(el) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(4px)';
    el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
    });
}