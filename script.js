let words = [
    "alma.", "banán!", "cseresznye:", "dinnye%", "eper,", "füge()", "gránátalma<",
    "szőlő>", "körte-", "citrom&", "narancs#", "kiwi@", "mango{", "papaya}", "kókuszä",
    "szeder=", "áfonya", "ribizli", "málna", "egres", "barack", "szilva", "meggy",
    "dió", "mandula", "mogyoró", "gesztenye", "datolya", "füge", "grapefruit",
    "lime", "klementin", "mandarin", "körte", "kivi", "avokádó", "ananász",
    "passiógyümölcs", "guava", "licsi", "búzafű", "líra"
];

document.addEventListener('DOMContentLoaded', () => {
    // Ha szükséges, itt tudsz aszinkron adatokat betölteni
});

function displayRandomText() {
    const input = document.getElementById('karakterszam').value.trim();
    const karakterszam = parseInt(input);

    // BUG FIX #4: Input validáció - üres, NaN, negatív és túl nagy értékek kezelése
    if (input === '' || isNaN(karakterszam)) {
        alert("Kérlek, adj meg egy érvényes számot!");
        return;
    }
    if (karakterszam < 0) {
        alert("A karakterszám nem lehet negatív!");
        return;
    }
    if (karakterszam === 0) {
        document.getElementById('randomText').innerText = '';
        resizeOutputContainer();
        return;
    }
    if (karakterszam > 100000) {
        alert("A generálandó szöveg túl hosszú.");
        return;
    }

    const randomText = generateRandomText(karakterszam);
    document.getElementById('randomText').innerText = randomText;
    resizeOutputContainer();
}

function generateRandomText(targetLength) {
    // BUG FIX #1: Eltávolítottuk a prefix-et (pl. "100 ..."),
    // ami beleszámított a karakterszámba és félrevezető volt.
    // Most a generált szöveg pontosan targetLength karakter hosszú lesz.
    let result = '';
    let currentLength = 0;

    while (currentLength < targetLength) {
        const randomWord = words[Math.floor(Math.random() * words.length)];
        const separator = currentLength === 0 ? '' : ' ';
        const addition = separator + randomWord;

        if (currentLength + addition.length <= targetLength) {
            result += addition;
            currentLength += addition.length;
        } else {
            // Ha a szó nem fér el egészben, karakterenként töltjük fel a maradékot
            const remaining = targetLength - currentLength;
            if (remaining > 0) {
                result += (currentLength === 0 ? '' : ' ').substring(0, Math.min(1, remaining));
                currentLength = result.length;
                if (currentLength < targetLength) {
                    result += randomWord.substring(0, targetLength - currentLength);
                    currentLength = result.length;
                }
            }
            break;
        }
    }

    return result;
}

function highlightCharacters() {
    const randomTextElement = document.getElementById('randomText');
    let text = randomTextElement.textContent;

    if (!text || text.trim() === '') {
        alert("Először generálj szöveget!");
        return;
    }

    const inputVal = document.getElementById('highlightIndex').value.trim();
    if (!inputVal) {
        alert("Kérlek, adj meg legalább egy index értéket!");
        return;
    }

    // BUG FIX #2 & #3: Eltávolítottuk a nem használt prefixLength változót.
    // Az indexelés most 1-alapú és a teljes szövegre vonatkozik (beleértve szóközöket is),
    // pontosan úgy ahogy a felhasználó látja a szöveget.
    const rawIndices = inputVal.split(',');
    const indices = new Set();

    for (const raw of rawIndices) {
        const idx = parseInt(raw.trim());
        if (!isNaN(idx) && idx >= 1 && idx <= text.length) {
            indices.add(idx - 1); // 1-alapú indexről 0-alapúra konvertálunk
        }
    }

    let highlightedText = '';
    for (let i = 0; i < text.length; i++) {
        if (indices.has(i)) {
            highlightedText += `<span style="background-color: yellow; color: #333;">${text[i]}</span>`;
        } else {
            highlightedText += text[i];
        }
    }
    randomTextElement.innerHTML = highlightedText;
}

function copyToClipboard() {
    const textToCopy = document.getElementById('randomText').innerText;
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            const copyButton = document.getElementById('copyButton');
            copyButton.textContent = '✓Másolva!';
            copyButton.style.backgroundColor = '#28a745';
            setTimeout(() => {
                copyButton.textContent = 'Másolás';
                copyButton.style.backgroundColor = '#747474';
            }, 2000);
        })
        .catch(err => {
            console.error('Hiba történt a másolás során:', err);
        });
}

function resizeOutputContainer() {
    const outputContainer = document.getElementById('output-container');
    const headerHeight = document.getElementById('output-header').clientHeight;
    outputContainer.style.paddingTop = headerHeight + 'px';
}
