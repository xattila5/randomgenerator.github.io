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
    const karakterszam = parseInt(document.getElementById('karakterszam').value);
    const randomText = generateRandomText(karakterszam);
    document.getElementById('randomText').innerText = randomText;
    resizeOutputContainer();
}

function generateRandomText(targetLength) {
    const prefix = `${targetLength} `;
    let result = prefix;
    let currentLength = result.length;

    const maxLength = prefix.length > 20 ? targetLength + prefix.length : targetLength + 20;

    while (currentLength < maxLength) {
        const randomWord = words[Math.floor(Math.random() * words.length)];
        if (currentLength + randomWord.length + 1 <= maxLength) {
            if (currentLength !== prefix.length) { // Csak akkor adjunk hozzá szóközt, ha már volt szó hozzáadva
                result += ' ';
                currentLength++;
            }
            result += randomWord;
            currentLength += randomWord.length;
        } else {
            break;
        }
    }

    if (currentLength !== targetLength) {
        if (currentLength < targetLength) {
            while (currentLength < targetLength) {
                const randomWord = words[Math.floor(Math.random() * words.length)];
                if (currentLength + randomWord.length + 1 <= targetLength) {
                    if (currentLength !== prefix.length) { // Csak akkor adjunk hozzá szóközt, ha már volt szó hozzáadva
                        result += ' ';
                        currentLength++;
                    }
                    result += randomWord;
                    currentLength += randomWord.length;
                } else {
                    break;
                }
            }
        } else {
            result = result.substring(0, targetLength);
        }
    }

    return result.trim();
}

function highlightCharacters() {
    const indices = document.getElementById('highlightIndex').value.split(',').map(index => parseInt(index.trim()));
    const randomTextElement = document.getElementById('randomText');
    let text = randomTextElement.textContent;
    let highlightedText = '';
    let prefixLength = parseInt(text.split(' ')[0]) + 1; // Prefix hossza, +1 a szóköz miatt
    let currentPos = 1; // Kezdeti pozíció a prefix után

    for (let i = 0; i < text.length; i++) {
        if (text[i] !== ' ') { // Csak ha nem szóköz karakter, akkor ellenőrizzük, hogy a jelenlegi pozíciónk a megfelelő helyen van-e
            if (indices.includes(currentPos)) {
                highlightedText += `<span style="background-color: yellow;">${text[i]}</span>`;
            } else {
                highlightedText += text[i];
            }
            currentPos++;
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
            copyButton.style.backgroundColor = '#28a745'; // Zöld háttérszín a jelzéshez
            setTimeout(() => {
                copyButton.textContent = 'Másolás';
                copyButton.style.backgroundColor = '#747474'; // Visszaállítja az eredeti háttérszínt
            }, 2000); // 2 másodperc után visszaáll az eredeti állapotra
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