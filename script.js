let words = [
    "alma.", "banán!", "cseresznye:", "dinnye%", "eper,", "füge()", "gránátalma<",
    "szőlő>", "körte-", "citrom&", "narancs#", "kiwi@", "mango{", "papaya}", "kókuszä",
    "szeder=", "áfonya", "ribizli", "málna", "egres", "barack", "szilva", "meggy",
    "dió", "mandula", "mogyoró", "gesztenye", "datolya", "füge", "grapefruit",
    "lime", "klementin", "mandarin", "körte", "kivi", "avokádó", "ananász",
    "passiógyümölcs", "guava", "licsi", "búzafű", "líra"
];

document.addEventListener('DOMContentLoaded', () => {});

function updateCharCount(text) {
    const el = document.getElementById('charCount');
    if (!text || text.trim() === '') { el.innerHTML = ''; return; }
    el.innerHTML = `<span>${text.length}</span> karakter`;
}

function setStatus(active) {
    document.getElementById('statusDot').classList.toggle('active', active);
}

function displayRandomText() {
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

    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            const btn = document.getElementById('copyButton');
            btn.textContent = '✓ Másolva';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.textContent = 'Másolás';
                btn.classList.remove('copied');
            }, 2000);
        })
        .catch(err => console.error('Másolási hiba:', err));
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