/* ── API kulcsok sablon ────────────────────────────────
   1. Másold le config.js néven:  cp config.example.js config.js
   2. Töltsd ki a saját kulcsaiddal (lentebb a linkek)
   3. A config.js NEM kerül git-be (.gitignore tiltja)
   4. Vercel-en a szerver oldali env változók érvényesek,
      ez a fájl csak lokális fejlesztéshez kell.
──────────────────────────────────────────────────── */
const SAL_CONFIG = {
    GUARDIAN_KEY: '',   // Ingyenes kulcs: https://open-platform.theguardian.com/access/
    DEEPL_KEY:    '',   // Ingyenes kulcs (500 000 kar./hó): https://www.deepl.com/pro-api
};
