const WeatherCanvas = (() => {
    let canvas, ctx, W, H;
    let particles = [];
    let effect = null;
    let animId = null;
    let t = 0;
    let lightning = { timer: 150, alpha: 0, x: 0 };

    /* ── Init ─────────────────────────────────────────── */

    function init() {
        canvas = document.createElement('canvas');
        canvas.style.cssText = [
            'position:fixed', 'top:0', 'left:0',
            'width:100%', 'height:100%',
            'z-index:0', 'pointer-events:none',
        ].join(';');
        document.body.insertBefore(canvas, document.body.firstChild);
        ctx = canvas.getContext('2d');
        resize();
        window.addEventListener('resize', resize);
    }

    function resize() {
        canvas.width  = W = window.innerWidth;
        canvas.height = H = window.innerHeight;
    }

    /* ── Public: change effect ────────────────────────── */

    function setEffect(name) {
        effect = name;
        particles = [];
        t = 0;
        lightning = { timer: 150, alpha: 0, x: 0 };
        buildParticles();
        if (animId) cancelAnimationFrame(animId);
        loop();
    }

    /* ── Particle factories ───────────────────────────── */

    function buildParticles() {
        if (effect === 'rain' || effect === 'thunder') {
            for (let i = 0; i < 200; i++) addRaindrop(true);
        } else if (effect === 'snow') {
            for (let i = 0; i < 130; i++) addSnowflake(true);
        } else if (effect === 'fog') {
            for (let i = 0; i < 12; i++) addFogPuff(true);
        } else if (effect === 'cloud') {
            for (let i = 0; i < 6; i++) addCloud(true);
        }
    }

    function addRaindrop(scatter) {
        particles.push({
            type: 'rain',
            x: Math.random() * W * 1.4 - W * 0.2,
            y: scatter ? Math.random() * H : -20,
            len: Math.random() * 18 + 10,
            spd: Math.random() * 14 + 10,
            alpha: Math.random() * 0.28 + 0.08,
            w: Math.random() * 0.7 + 0.3,
        });
    }

    function addSnowflake(scatter) {
        particles.push({
            type: 'snow',
            x: Math.random() * W,
            y: scatter ? Math.random() * H : -10,
            r: Math.random() * 3.5 + 1,
            spd: Math.random() * 1.2 + 0.4,
            drift: (Math.random() - 0.5) * 0.6,
            alpha: Math.random() * 0.55 + 0.25,
            phase: Math.random() * Math.PI * 2,
            wobble: Math.random() * 0.8 + 0.4,
        });
    }

    function addFogPuff(scatter) {
        const w = W * (Math.random() * 0.7 + 0.5);
        particles.push({
            type: 'fog',
            x: scatter ? Math.random() * W * 1.8 - W * 0.4 : -w * 0.5,
            y: Math.random() * H * 0.85 + H * 0.05,
            w, h: Math.random() * 180 + 90,
            spd: Math.random() * 0.25 + 0.06,
            alpha: Math.random() * 0.07 + 0.025,
            dir: Math.random() < 0.5 ? 1 : -1,
        });
    }

    function addCloud(scatter) {
        const w = W * (Math.random() * 0.5 + 0.35);
        const spd = Math.random() * 0.35 + 0.12;
        particles.push({
            type: 'cloud',
            x: scatter ? Math.random() * (W + w) - w * 0.5 : -w,
            y: H * (Math.random() * 0.45 + 0.02),
            w, h: w * (Math.random() * 0.3 + 0.25),
            spd,
            alpha: Math.random() * 0.12 + 0.04,
        });
    }

    /* ── Background gradients ─────────────────────────── */

    function drawBg() {
        let stops;
        switch (effect) {
            case 'sun':
                stops = [
                    [0,    'rgba(18, 70, 140, 0.92)'],
                    [0.4,  'rgba(14, 50, 105, 0.75)'],
                    [1,    'rgba(14, 14,  16, 0)'],
                ];
                break;
            case 'rain':
                stops = [
                    [0,   'rgba(10, 22, 45, 0.88)'],
                    [0.5, 'rgba(14, 28, 52, 0.6)'],
                    [1,   'rgba(14, 14, 16, 0)'],
                ];
                break;
            case 'thunder':
                stops = [
                    [0,   'rgba(6,  6, 18, 0.95)'],
                    [0.5, 'rgba(10,10, 28, 0.7)'],
                    [1,   'rgba(14,14, 16, 0)'],
                ];
                break;
            case 'snow':
                stops = [
                    [0,   'rgba(18, 22, 52, 0.88)'],
                    [0.5, 'rgba(22, 28, 60, 0.65)'],
                    [1,   'rgba(14, 14, 16, 0)'],
                ];
                break;
            case 'fog':
                stops = [
                    [0,   'rgba(38, 42, 58, 0.78)'],
                    [0.5, 'rgba(30, 34, 50, 0.5)'],
                    [1,   'rgba(14, 14, 16, 0)'],
                ];
                break;
            case 'cloud':
                stops = [
                    [0,   'rgba(22, 28, 48, 0.82)'],
                    [0.5, 'rgba(18, 24, 42, 0.6)'],
                    [1,   'rgba(14, 14, 16, 0)'],
                ];
                break;
            default:
                return;
        }
        const g = ctx.createLinearGradient(0, 0, 0, H);
        stops.forEach(([s, c]) => g.addColorStop(s, c));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    }

    /* ── Sun ──────────────────────────────────────────── */

    function drawSun() {
        const cx = W * 0.72, cy = H * 0.18;
        const pulse = Math.sin(t * 0.018) * 0.5 + 0.5;

        // Outer atmospheric glow
        const atm = ctx.createRadialGradient(cx, cy, 0, cx, cy, H * 0.55);
        atm.addColorStop(0,   `rgba(255, 190, 60, ${0.12 + pulse * 0.06})`);
        atm.addColorStop(0.3, `rgba(255, 140, 20, ${0.05 + pulse * 0.03})`);
        atm.addColorStop(1,   'rgba(255, 100, 0, 0)');
        ctx.fillStyle = atm;
        ctx.fillRect(0, 0, W, H);

        // Rotating light rays
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * 0.004);
        const rayCount = 16;
        for (let i = 0; i < rayCount; i++) {
            const a = (i / rayCount) * Math.PI * 2;
            const inner = 52;
            const outer = inner + 55 + (i % 3) * 30 + Math.sin(t * 0.025 + i) * 15;
            const w0 = 2.5, w1 = 0;
            ctx.save();
            ctx.rotate(a);
            ctx.beginPath();
            ctx.moveTo(-w0, inner);
            ctx.lineTo(-w1, outer);
            ctx.lineTo( w1, outer);
            ctx.lineTo( w0, inner);
            ctx.closePath();
            ctx.fillStyle = `rgba(255, 220, 100, ${0.07 + pulse * 0.04})`;
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();

        // Sun disc
        ctx.save();
        ctx.translate(cx, cy);
        const disc = ctx.createRadialGradient(0, -8, 0, 0, 0, 52);
        disc.addColorStop(0,   `rgba(255, 248, 180, ${0.92 + pulse * 0.08})`);
        disc.addColorStop(0.55, 'rgba(255, 220,  80, 0.8)');
        disc.addColorStop(1,   'rgba(255, 180,  20, 0)');
        ctx.fillStyle = disc;
        ctx.beginPath();
        ctx.arc(0, 0, 52, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /* ── Rain ─────────────────────────────────────────── */

    function drawRain() {
        ctx.save();
        particles.forEach(p => {
            ctx.globalAlpha = p.alpha;
            ctx.strokeStyle = 'rgba(175, 215, 255, 1)';
            ctx.lineWidth = p.w;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.len * 0.18, p.y + p.len);
            ctx.stroke();

            p.y += p.spd;
            p.x -= p.spd * 0.14;

            if (p.y > H + 30 || p.x < -50) {
                p.y = -20;
                p.x = Math.random() * W * 1.4 - W * 0.2;
            }
        });
        ctx.restore();
    }

    /* ── Lightning ────────────────────────────────────── */

    function drawLightning() {
        lightning.timer--;
        if (lightning.timer <= 0) {
            lightning.timer  = Math.random() * 260 + 140;
            lightning.alpha  = 0.7 + Math.random() * 0.3;
            lightning.x      = W * (0.2 + Math.random() * 0.6);
            // draw bolt
            drawBolt(lightning.x, 0, lightning.x + (Math.random()-0.5)*80, H * 0.6, 8);
        }
        if (lightning.alpha > 0.01) {
            ctx.fillStyle = `rgba(210, 195, 255, ${lightning.alpha * 0.18})`;
            ctx.fillRect(0, 0, W, H);
            lightning.alpha *= 0.78;
        }
    }

    function drawBolt(x1, y1, x2, y2, depth) {
        if (depth <= 0) return;
        const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * (y2 - y1) * 0.4;
        const my = (y1 + y2) / 2;
        ctx.strokeStyle = `rgba(220, 210, 255, ${lightning.alpha * 0.85})`;
        ctx.lineWidth = depth * 0.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(mx, my);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        drawBolt(x1, y1, mx, my, depth - 2);
        drawBolt(mx, my, x2, y2, depth - 2);
    }

    /* ── Snow ─────────────────────────────────────────── */

    function drawSnow() {
        particles.forEach(p => {
            p.phase += 0.022;
            p.x += Math.sin(p.phase * p.wobble) * 0.5 + p.drift;
            p.y += p.spd;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(220, 235, 255, ${p.alpha})`;
            ctx.fill();

            if (p.y > H + 15) {
                p.y = -12;
                p.x = Math.random() * W;
            }
        });
    }

    /* ── Fog ──────────────────────────────────────────── */

    function drawFog() {
        particles.forEach(p => {
            p.x += p.spd * p.dir;
            if (p.dir > 0 && p.x > W + p.w * 0.6) {
                p.x = -p.w * 0.6;
                p.y = Math.random() * H * 0.85 + H * 0.05;
            } else if (p.dir < 0 && p.x < -p.w * 0.6) {
                p.x = W + p.w * 0.6;
                p.y = Math.random() * H * 0.85 + H * 0.05;
            }

            const g = ctx.createRadialGradient(
                p.x, p.y, 0,
                p.x, p.y, Math.max(p.w, p.h) * 0.6
            );
            g.addColorStop(0,   `rgba(185, 192, 210, ${p.alpha})`);
            g.addColorStop(0.5, `rgba(185, 192, 210, ${p.alpha * 0.5})`);
            g.addColorStop(1,   'rgba(185, 192, 210, 0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, p.w * 0.6, p.h * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    /* ── Clouds ───────────────────────────────────────── */

    function drawClouds() {
        particles.forEach(p => {
            p.x += p.spd;
            if (p.x > W + p.w * 0.6) {
                p.x = -p.w * 0.6;
                p.y = H * (Math.random() * 0.45 + 0.02);
            }
            drawCloudShape(p.x, p.y, p.w, p.h, p.alpha);
        });
    }

    function drawCloudShape(x, y, w, h, alpha) {
        const n = 7;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(200, 208, 228, 1)';
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const t2 = i / (n - 1);
            const bx = x - w * 0.5 + t2 * w;
            const by = y + Math.sin(t2 * Math.PI) * (-h * 0.5);
            const r  = h * (0.35 + Math.sin(t2 * Math.PI) * 0.45);
            ctx.moveTo(bx + r, y);
            ctx.arc(bx, by, r, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();
    }

    /* ── Main loop ────────────────────────────────────── */

    function loop() {
        ctx.clearRect(0, 0, W, H);
        t++;

        drawBg();

        switch (effect) {
            case 'sun':     drawSun();    break;
            case 'rain':    drawRain();   break;
            case 'thunder': drawRain();   drawLightning(); break;
            case 'snow':    drawSnow();   break;
            case 'fog':     drawFog();    break;
            case 'cloud':   drawClouds(); break;
        }

        animId = requestAnimationFrame(loop);
    }

    return { init, setEffect };
})();

WeatherCanvas.init();
