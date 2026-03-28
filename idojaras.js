const WEATHER_CODES = {
    0:  { icon: '☀️',  desc: 'Derült' },
    1:  { icon: '🌤️', desc: 'Enyhén felhős' },
    2:  { icon: '⛅',  desc: 'Részben felhős' },
    3:  { icon: '☁️',  desc: 'Borult' },
    45: { icon: '🌫️', desc: 'Köd' },
    48: { icon: '🌫️', desc: 'Zúzmarás köd' },
    51: { icon: '🌦️', desc: 'Gyenge szitálás' },
    53: { icon: '🌦️', desc: 'Szitálás' },
    55: { icon: '🌧️', desc: 'Erős szitálás' },
    61: { icon: '🌧️', desc: 'Gyenge eső' },
    63: { icon: '🌧️', desc: 'Eső' },
    65: { icon: '🌧️', desc: 'Erős eső' },
    71: { icon: '🌨️', desc: 'Gyenge havazás' },
    73: { icon: '🌨️', desc: 'Havazás' },
    75: { icon: '❄️',  desc: 'Erős havazás' },
    77: { icon: '🌨️', desc: 'Hópelyhek' },
    80: { icon: '🌦️', desc: 'Gyenge záporok' },
    81: { icon: '🌧️', desc: 'Záporok' },
    82: { icon: '⛈️',  desc: 'Erős záporok' },
    85: { icon: '🌨️', desc: 'Hózáporok' },
    86: { icon: '❄️',  desc: 'Erős hózáporok' },
    95: { icon: '⛈️',  desc: 'Zivatar' },
    96: { icon: '⛈️',  desc: 'Zivatar jégesővel' },
    99: { icon: '⛈️',  desc: 'Erős zivatar jégesővel' },
};

const DAY_NAMES = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'];

function getWeatherEffect(code) {
    if (code === 0 || code === 1) return 'sun';
    if (code === 2 || code === 3) return 'cloud';
    if (code >= 45 && code <= 48) return 'fog';
    if ((code >= 51 && code <= 65) || (code >= 80 && code <= 82)) return 'rain';
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snow';
    if (code >= 95) return 'thunder';
    return 'cloud';
}

async function fetchWeather() {
    const container = document.getElementById('weatherContainer');
    const btn = document.getElementById('refreshBtn');

    if (btn) btn.classList.add('loading');
    container.innerHTML = '<div class="weather-loading"><div class="weather-spinner"></div><div>Időjárás betöltése...</div></div>';

    try {
        const url = 'https://api.open-meteo.com/v1/forecast'
            + '?latitude=47.4979&longitude=19.0402'
            + '&hourly=temperature_2m,weathercode,windspeed_10m,precipitation_probability'
            + '&timezone=Europe%2FBudapest'
            + '&forecast_days=5';

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        renderWeather(data, container);

        const now = new Date();
        const el = document.getElementById('lastUpdated');
        if (el) el.textContent = 'Frissítve: ' + now.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
    } catch (err) {
        container.innerHTML = `
            <div class="weather-error">
                <div class="weather-error-icon">⚠️</div>
                <div>Nem sikerült betölteni az időjárást.</div>
                <div style="font-size:0.62rem;margin-top:4px;opacity:0.5">${err.message}</div>
                <button class="btn-primary" style="margin-top:20px" onclick="fetchWeather()"><span>Újrapróbálás</span></button>
            </div>`;
    } finally {
        if (btn) btn.classList.remove('loading');
    }
}

function renderWeather(data, container) {
    const { time, temperature_2m, weathercode, windspeed_10m, precipitation_probability } = data.hourly;
    const hourly = { temperature_2m, weathercode, windspeed_10m, precipitation_probability };

    const days = [];
    for (let i = 0; i < 5; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().slice(0, 10);
        const noonIdx    = time.indexOf(`${dateStr}T12:00`);
        const eveningIdx = time.indexOf(`${dateStr}T20:00`);
        const dateLabel  = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}.`;
        days.push({ d, dateLabel, dayName: DAY_NAMES[d.getDay()], noonIdx, eveningIdx });
    }

    // Today — centered large card with canvas weather effect
    const today = days[0];
    const effectCode = today.noonIdx !== -1 ? weathercode[today.noonIdx]
                     : today.eveningIdx !== -1 ? weathercode[today.eveningIdx] : 0;
    const bgEffect = getWeatherEffect(effectCode);

    if (typeof WeatherCanvas !== 'undefined') WeatherCanvas.setEffect(bgEffect);

    const todayHTML = `
    <div class="weather-today-wrapper">
        <div class="weather-today-card">
            <div class="weather-card-accent"></div>
            <div style="position:relative;z-index:1">
                <div class="weather-day-label">${today.dateLabel}</div>
                <div class="weather-day-name">Ma</div>
            </div>
            ${renderPeriod('Nappal · 12:00', today.noonIdx, hourly, true)}
            ${renderPeriod('Este · 20:00', today.eveningIdx, hourly, true)}
        </div>
    </div>`;

    // Other 4 days
    const otherHTML = days.slice(1).map(({ dateLabel, dayName, noonIdx, eveningIdx }) => `
    <div class="weather-day-card">
        <div class="weather-card-accent"></div>
        <div>
            <div class="weather-day-label">${dateLabel}</div>
            <div class="weather-day-name">${dayName}</div>
        </div>
        ${renderPeriod('Nappal · 12:00', noonIdx, hourly, false)}
        ${renderPeriod('Este · 20:00', eveningIdx, hourly, false)}
    </div>`).join('');

    container.innerHTML = `${todayHTML}<div class="weather-days-row">${otherHTML}</div>`;
}

function renderPeriod(label, idx, { temperature_2m, weathercode, windspeed_10m, precipitation_probability }, large) {
    const cls = large ? 'weather-period weather-period--large' : 'weather-period';

    if (idx === -1) {
        return `<div class="${cls}">
            <div class="weather-period-label">${label}</div>
            <div class="weather-desc" style="margin-top:4px">Nincs adat</div>
        </div>`;
    }

    const code   = weathercode[idx];
    const wInfo  = WEATHER_CODES[code] ?? { icon: '🌡️', desc: 'Ismeretlen' };
    const temp   = Math.round(temperature_2m[idx]);
    const wind   = Math.round(windspeed_10m[idx]);
    const precip = precipitation_probability[idx] ?? 0;

    return `
    <div class="${cls}">
        <div class="weather-period-label">${label}</div>
        <div class="weather-icon">${wInfo.icon}</div>
        <div class="weather-temp">${temp}°C</div>
        <div class="weather-desc">${wInfo.desc}</div>
        <div class="weather-meta">
            <div class="weather-meta-item">💨 <b>${wind} km/h</b></div>
            <div class="weather-meta-item">🌧 <b>${precip}%</b> csapadék</div>
        </div>
    </div>`;
}

fetchWeather();
