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

const CITIES = {
    budapest: { name: 'Budapest', lat: 47.4979,  lon: 19.0402,  tz: 'Europe/Budapest' },
    gyula:    { name: 'Gyula',    lat: 46.6469,  lon: 21.2803,  tz: 'Europe/Budapest' },
    szeged:   { name: 'Szeged',   lat: 46.2530,  lon: 20.1414,  tz: 'Europe/Budapest' },
    xian:     { name: "Xi'an",    lat: 34.3416,  lon: 108.9398, tz: 'Asia/Shanghai'   },
};

let selectedCity = 'budapest';

function isNightHour(h) {
    return h >= 20 || h < 6;
}

function getWeatherEffect(code, hour = 12) {
    const night = isNightHour(hour);
    if (code === 0) return night ? 'moon'      : 'sun';
    if (code === 1) return night ? 'mooncloud' : 'sun';
    if (code === 2 || code === 3) return 'cloud';
    if (code >= 45 && code <= 48) return 'fog';
    if ((code >= 51 && code <= 65) || (code >= 80 && code <= 82)) return 'rain';
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snow';
    if (code >= 95) return 'thunder';
    return 'cloud';
}

const NIGHT_ICON_OVERRIDE = {
    0: '🌙', 1: '🌙', 2: '☁️',
    51: '🌧️', 53: '🌧️',
    80: '🌧️',
};

function getIcon(code, hour) {
    if (isNightHour(hour) && NIGHT_ICON_OVERRIDE[code] !== undefined)
        return NIGHT_ICON_OVERRIDE[code];
    return (WEATHER_CODES[code] ?? { icon: '🌡️' }).icon;
}

let hourlyData       = null;
let selectedDay      = 0;
let days             = [];
let weatherContainer = null;
let swapping         = false;

/* ── Legjellemzőbb hatás egy naphoz ───────────────────── */

function dominantEffect(day) {
    const counts = {};
    day.indices.forEach((idx, h) => {
        if (idx === -1 || h < 6 || h >= 20) return; // csak nappal
        const fx = getWeatherEffect(hourlyData.weathercode[idx], h);
        counts[fx] = (counts[fx] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'cloud';
}

/* ── Városváltás ──────────────────────────────────────── */

function selectCity(cityKey) {
    if (cityKey === selectedCity) return;
    selectedCity = cityKey;
    document.querySelectorAll('.btn-city').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('city-' + cityKey);
    if (btn) btn.classList.add('active');
    const title = document.getElementById('cityTitle');
    if (title) title.textContent = CITIES[cityKey].name + ' \u2014 9 napos előrejelzés';
    fetchWeather();
}

/* ── Fetch ────────────────────────────────────────────── */

const IS_NETLIFY_W = window.location.hostname !== 'localhost' &&
                     window.location.hostname !== '127.0.0.1' &&
                     !window.location.protocol.startsWith('file');

async function fetchWeather(force = false) {
    const container = document.getElementById('weatherContainer');
    weatherContainer = container;
    const btn = document.getElementById('refreshBtn');
    if (btn) btn.classList.add('loading');

    // Csak force refresh esetén mutatunk teljes spinnert
    if (force || !hourlyData) {
        container.innerHTML = '<div class="weather-loading"><div class="weather-spinner"></div><div>Időjárás betöltése...</div></div>';
    }

    try {
        let data;
        if (IS_NETLIFY_W) {
            const params = `city=${selectedCity}${force ? '&force=1' : ''}`;
            const res = await fetch(`/api/weather?${params}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            data = await res.json();
        } else {
            const city = CITIES[selectedCity];
            const url = 'https://api.open-meteo.com/v1/forecast'
                + `?latitude=${city.lat}&longitude=${city.lon}`
                + '&hourly=temperature_2m,weathercode,windspeed_10m,precipitation_probability'
                + `&timezone=${encodeURIComponent(city.tz)}`
                + '&forecast_days=9';
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            data = await res.json();
            data._cachedAt = Date.now();
        }

        renderWeather(data, container);

        const el = document.getElementById('lastUpdated');
        if (el && data._cachedAt) {
            el.textContent = 'Frissítve: ' + new Date(data._cachedAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
        }
    } catch (err) {
        container.innerHTML = `
            <div class="weather-error">
                <div class="weather-error-icon">⚠️</div>
                <div>Nem sikerült betölteni az időjárást.</div>
                <div style="font-size:0.62rem;margin-top:4px;opacity:0.5">${err.message}</div>
                <button class="btn-primary" style="margin-top:20px" onclick="fetchWeather(true)"><span>Újrapróbálás</span></button>
            </div>`;
    } finally {
        if (btn) btn.classList.remove('loading');
    }
}

/* ── Build data model ─────────────────────────────────── */

function renderWeather(data, container) {
    weatherContainer = container;
    const { time, temperature_2m, weathercode, windspeed_10m, precipitation_probability } = data.hourly;
    hourlyData = { time, temperature_2m, weathercode, windspeed_10m, precipitation_probability };

    const city = CITIES[selectedCity];
    // "Ma" dátuma a város időzónájában
    const todayLocal = new Intl.DateTimeFormat('sv', {
        timeZone: city.tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    const [ty, tm, td] = todayLocal.split('-').map(Number);

    days = [];
    for (let i = 0; i < 9; i++) {
        const d = new Date(ty, tm - 1, td + i);
        const year  = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day   = String(d.getDate()).padStart(2, '0');
        const dateStr   = `${year}-${month}-${day}`;
        const dateLabel = `${year}.${month}.${day}.`;

        const indices = [];
        for (let h = 0; h < 24; h++) {
            indices.push(time.indexOf(`${dateStr}T${String(h).padStart(2, '0')}:00`));
        }

        const validIdxs = indices.filter(idx => idx !== -1);
        const temps     = validIdxs.map(idx => temperature_2m[idx]);

        days.push({
            d, dateStr, dateLabel,
            dayName:  i === 0 ? 'Ma' : DAY_NAMES[d.getDay()],
            indices,
            minTemp:  temps.length ? Math.round(Math.min(...temps)) : null,
            maxTemp:  temps.length ? Math.round(Math.max(...temps)) : null,
        });
    }

    selectedDay = 0;
    renderAll();
}

/* ── Render ───────────────────────────────────────────── */

function renderAll() {
    const currentHour = parseInt(new Intl.DateTimeFormat('en', {
        timeZone: CITIES[selectedCity].tz, hour: 'numeric', hour12: false,
    }).format(new Date()), 10);
    const mainDay     = days[selectedDay];
    const isToday     = selectedDay === 0;

    // Background: today → aktuális óra, más nap → legjellemzőbb időjárás
    let bgEffect;
    if (isToday) {
        const idx = mainDay.indices[currentHour];
        const code = (idx != null && idx !== -1) ? hourlyData.weathercode[idx] : 0;
        bgEffect = getWeatherEffect(code);
    } else {
        bgEffect = dominantEffect(mainDay);
    }
    if (typeof WeatherCanvas !== 'undefined') WeatherCanvas.setEffect(bgEffect);

    const mainHTML = `
        <div class="weather-card-accent"></div>
        <div style="position:relative;z-index:1">
            <div class="weather-day-label">${mainDay.dateLabel}</div>
            <div class="weather-day-name">${mainDay.dayName}</div>
        </div>
        <div class="weather-periods-row">
            ${renderPeriod('Nappal · átlag', computePeriodStats(mainDay.indices, 8, 19, 12), true)}
            ${renderPeriod('Este · átlag',   computePeriodStats(mainDay.indices, 20, 7, 22, days[selectedDay + 1]?.indices), true)}
        </div>
        ${renderHourlyRow(mainDay, isToday ? currentHour : -1)}`;

    const otherHTML = days
        .map((day, i) => ({ day, i }))
        .filter(({ i }) => i !== selectedDay)
        .map(({ day, i }) => renderDayTile(day, i))
        .join('');

    weatherContainer.innerHTML = `
        <div class="weather-today-wrapper">
            <div class="weather-today-card" id="mainCard">${mainHTML}</div>
        </div>
        <div class="weather-days-row">${otherHTML}</div>`;

    if (isToday) {
        setTimeout(() => {
            const cur = document.querySelector('.weather-hour-item--current');
            if (cur) cur.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }, 80);
    }
}

// wrapIndices: következő nap indices tömbje, ha a periódus átnyúlik éjfélen
function computePeriodStats(indices, startH, endH, iconHour, wrapIndices) {
    const valid = [];
    if (endH >= startH) {
        // Normál tartomány (pl. 8-19)
        for (let h = startH; h <= endH; h++) {
            const idx = indices[h];
            if (idx !== undefined && idx !== -1) valid.push(idx);
        }
    } else {
        // Éjfélen átnyúló (pl. 20-7): startH-23 az aktuális, 0-endH a következő napból
        for (let h = startH; h <= 23; h++) {
            const idx = indices[h];
            if (idx !== undefined && idx !== -1) valid.push(idx);
        }
        const next = wrapIndices || [];
        for (let h = 0; h <= endH; h++) {
            const idx = next[h];
            if (idx !== undefined && idx !== -1) valid.push(idx);
        }
    }
    if (!valid.length) return null;
    const temps   = valid.map(i => hourlyData.temperature_2m[i]);
    const winds   = valid.map(i => hourlyData.windspeed_10m[i]);
    const precips = valid.map(i => hourlyData.precipitation_probability[i] ?? 0);
    const codes   = valid.map(i => hourlyData.weathercode[i]);
    const cnt = {};
    codes.forEach(c => { cnt[c] = (cnt[c] || 0) + 1; });
    const code = parseInt(Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0]);
    return {
        avgTemp: Math.round(temps.reduce((a, b) => a + b, 0) / temps.length),
        code,
        wind:    Math.round(winds.reduce((a, b) => a + b, 0) / winds.length),
        precip:  Math.round(Math.max(...precips)),
        iconHour,
    };
}

function renderPeriod(label, stats, large) {
    const cls = large ? 'weather-period weather-period--large' : 'weather-period';
    if (!stats) {
        return `<div class="${cls}"><div class="weather-period-label">${label}</div><div class="weather-desc" style="margin-top:4px">Nincs adat</div></div>`;
    }
    const wInfo = WEATHER_CODES[stats.code] ?? { icon: '🌡️', desc: 'Ismeretlen' };
    const icon  = getIcon(stats.code, stats.iconHour);
    return `
        <div class="${cls}">
            <div class="weather-period-label">${label}</div>
            <div class="weather-icon">${icon}</div>
            <div class="weather-temp">${stats.avgTemp}°C</div>
            <div class="weather-desc">${wInfo.desc}</div>
            <div class="weather-meta">
                <div class="weather-meta-item">💨 <b>${stats.wind} km/h</b></div>
                <div class="weather-meta-item">🌧 <b>${stats.precip}%</b> csapadék</div>
            </div>
        </div>`;
}

function renderHourlyRow(day, currentHour) {
    const items = day.indices.map((idx, h) => {
        if (idx === -1) return '';
        const code   = hourlyData.weathercode[idx];
        const icon   = getIcon(code, h);
        const temp   = Math.round(hourlyData.temperature_2m[idx]);
        const precip = hourlyData.precipitation_probability[idx] ?? 0;
        const isCur  = h === currentHour;
        return `
            <div class="weather-hour-item${isCur ? ' weather-hour-item--current' : ''}">
                <div class="weather-hour-label">${String(h).padStart(2, '0')}:00</div>
                <div class="weather-hour-icon">${icon}</div>
                <div class="weather-hour-temp">${temp}°</div>
                <div class="weather-hour-precip">${precip > 0 ? `💧${precip}%` : ''}</div>
            </div>`;
    }).join('');
    return `
        <div class="weather-hourly-divider"></div>
        <div class="weather-hourly-row">${items}</div>`;
}

function renderDayTile(day, dayIndex) {
    const dayStats = computePeriodStats(day.indices, 8, 19, 12);
    const eveStats = computePeriodStats(day.indices, 20, 7, 22, days[dayIndex + 1]?.indices);
    const nIcon  = dayStats ? getIcon(dayStats.code, 12) : '❓';
    const eIcon  = eveStats ? getIcon(eveStats.code, 20) : '❓';
    const nTemp  = dayStats?.avgTemp ?? null;
    const eTemp  = eveStats?.avgTemp ?? null;
    return `
        <div class="weather-day-card" data-day-index="${dayIndex}" onclick="selectDay(${dayIndex})">
            <div class="weather-card-accent"></div>
            <div>
                <div class="weather-day-label">${day.dateLabel}</div>
                <div class="weather-day-name">${day.dayName}</div>
            </div>
            <div class="weather-day-tile-icons">
                <span>${nIcon}</span>
                <span class="weather-tile-slash">\</span>
                <span>${eIcon}</span>
            </div>
            <div class="weather-day-tile-temps">
                <span class="weather-tile-max">${nTemp !== null ? nTemp + '°' : ''}</span>
                <span class="weather-tile-slash">\</span>
                <span class="weather-tile-min">${eTemp !== null ? eTemp + '°' : ''}</span>
            </div>
        </div>`;
}

/* ── Card swap (asztalon csúszó lapok) ────────────────── */

function selectDay(dayIndex) {
    if (dayIndex === selectedDay || swapping) return;
    swapping = true;

    const mainCard = document.getElementById('mainCard');
    const dayCard  = document.querySelector(`[data-day-index="${dayIndex}"]`);

    if (!mainCard || !dayCard) {
        selectedDay = dayIndex;
        swapping = false;
        renderAll();
        return;
    }

    const mRect = mainCard.getBoundingClientRect();
    const dRect = dayCard.getBoundingClientRect();

    // Overlay container – above everything, no pointer events
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:800;pointer-events:none;';
    document.body.appendChild(overlay);

    // Clone main card → will slide to day card position
    const mc = mainCard.cloneNode(true);
    Object.assign(mc.style, {
        position:   'fixed',
        top:        mRect.top  + 'px',
        left:       mRect.left + 'px',
        width:      mRect.width  + 'px',
        height:     mRect.height + 'px',
        margin:     '0',
        zIndex:     '801',
        willChange: 'transform',
    });
    overlay.appendChild(mc);

    // Clone day card → will slide to main card position (on top)
    const dc = dayCard.cloneNode(true);
    Object.assign(dc.style, {
        position:   'fixed',
        top:        dRect.top  + 'px',
        left:       dRect.left + 'px',
        width:      dRect.width  + 'px',
        height:     dRect.height + 'px',
        margin:     '0',
        zIndex:     '802',
        willChange: 'transform',
    });
    overlay.appendChild(dc);

    // Hide originals while clones animate
    mainCard.style.visibility = 'hidden';
    dayCard.style.visibility  = 'hidden';

    // Target translations
    const mcTx = dRect.left - mRect.left;
    const mcTy = dRect.top  - mRect.top;
    const dcTx = mRect.left - dRect.left;
    const dcTy = mRect.top  - dRect.top;

    // Set CSS vars for keyframe animation
    mc.style.setProperty('--tx', mcTx + 'px');
    mc.style.setProperty('--ty', mcTy + 'px');
    dc.style.setProperty('--tx', dcTx + 'px');
    dc.style.setProperty('--ty', dcTy + 'px');

    // Trigger animation on next paint
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            mc.style.animation = 'cardSlideDown 0.44s cubic-bezier(0.4, 0, 0.2, 1) forwards';
            dc.style.animation = 'cardSlideUp   0.44s cubic-bezier(0.4, 0, 0.2, 1) forwards';
        });
    });

    setTimeout(() => {
        // Re-render alatta, amíg az overlay még látható
        selectedDay = dayIndex;
        swapping = false;
        renderAll();
        // Overlay simán eltűnik
        overlay.style.transition = 'opacity 0.18s ease';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 200);
    }, 420);
}

fetchWeather();
