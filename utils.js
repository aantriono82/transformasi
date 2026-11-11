/* Logika murni (tanpa DOM) untuk input, format, tampilan, dan label transformasi. */
(function (global) {
    const NUMBER_PATTERN = /^[-+]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/;

    function toNumber(text) {
        const value = text.trim();
        if (!NUMBER_PATTERN.test(value)) return null;
        const number = Number(value.replace(',', '.'));
        return Number.isFinite(number) ? number : null;
    }

    function toPair(a, b) {
        const x = toNumber(a);
        const y = toNumber(b);
        return x === null || y === null ? null : { x, y };
    }

    /**
     * Mengurai teks koordinat. Format yang diterima:
     * (3, 5) | 3, 5 | A(1, 2) | x=3 y=5 | 3 5 | 3; 5
     * Desimal koma didukung bila tidak ambigu: (1,5; 2) atau (1,5, 2,5).
     */
    function parsePointInput(input) {
        let text = String(input ?? '').trim();
        if (!text) return null;

        const named = text.match(/^x\s*=\s*(\S+?)[,;\s]+y\s*=\s*(\S+)$/i);
        if (named) return toPair(named[1], named[2]);

        text = text.replace(/^[A-Za-z][A-Za-z0-9]*'*\s*(?=\()/, '');
        const inParens = text.match(/^\((.*)\)$/);
        if (inParens) text = inParens[1].trim();

        let parts;
        if (text.includes(';')) {
            parts = text.split(';');
        } else if ((text.match(/,/g) || []).length === 1) {
            parts = text.split(',');
        } else if (/,\s+/.test(text)) {
            parts = text.split(/,\s+/);
        } else {
            parts = text.split(/\s+/);
        }
        return parts.length === 2 ? toPair(parts[0], parts[1]) : null;
    }

    function formatCoordinate(value) {
        const rounded = Math.round(value * 100) / 100;
        if (Object.is(rounded, -0)) return '0';
        return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    }

    /** Langkah grid "rapi" (1, 2, 5, 10, ...) agar jarak antar garis minimal `minPixels`. */
    function niceStep(scale, minPixels) {
        const raw = minPixels / scale;
        const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
        for (const multiplier of [1, 2, 5, 10]) {
            const step = multiplier * magnitude;
            if (step >= raw) return Math.max(1, step);
        }
        return Math.max(1, 10 * magnitude);
    }

    /** Faktor zoom halus untuk wheel mouse maupun trackpad. */
    function wheelZoomFactor(deltaY, deltaMode = 0) {
        const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
        return Math.min(2, Math.max(0.5, Math.exp(-pixels * 0.0015)));
    }

    /**
     * Hitung tampilan agar semua titik terlihat. Mengembalikan null bila semua
     * titik sudah terlihat pada tampilan sekarang (tidak perlu diubah).
     */
    function fitView(pointList, view, options = {}) {
        const { width, height, scale, offsetX, offsetY } = view;
        const { padding = 40, minScale = 2, maxScale = 50 } = options;
        if (!pointList.length || width <= 0 || height <= 0) return null;

        const halfW = (width / 2 - padding) / scale;
        const halfH = (height / 2 - padding) / scale;
        const allVisible = pointList.every(({ x, y }) =>
            Math.abs(x - offsetX) <= halfW && Math.abs(y - offsetY) <= halfH);
        if (allVisible) return null;

        const xs = pointList.map(p => p.x).concat(0);
        const ys = pointList.map(p => p.y).concat(0);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const spanX = Math.max(maxX - minX, 1e-6);
        const spanY = Math.max(maxY - minY, 1e-6);
        const fitScale = Math.min((width - 2 * padding) / spanX, (height - 2 * padding) / spanY);
        return {
            scale: Math.max(minScale, Math.min(maxScale, scale, fitScale)),
            offsetX: (minX + maxX) / 2,
            offsetY: (minY + maxY) / 2
        };
    }

    function formatSigned(value) {
        const text = formatCoordinate(Math.abs(value));
        return value < 0 ? `- ${text}` : `+ ${text}`;
    }

    function describeLine(m, c) {
        const slope = m === 1 ? 'x' : m === -1 ? '-x' : m === 0 ? '' : `${formatCoordinate(m)}x`;
        if (!slope) return `y = ${formatCoordinate(c)}`;
        return c === 0 ? `y = ${slope}` : `y = ${slope} ${formatSigned(c)}`;
    }

    /** Label status yang selalu sesuai dengan parameter yang sedang dipakai. */
    function describeTransform(type, params = {}) {
        const point = (x, y) => `(${formatCoordinate(x)}, ${formatCoordinate(y)})`;
        switch (type) {
            case 'reflection': {
                const { axis = 'x', m = 1, c = 0, k = 0 } = params;
                if (axis === 'x') return 'Refleksi terhadap sumbu X';
                if (axis === 'y') return 'Refleksi terhadap sumbu Y';
                if (axis === 'y=x') return 'Refleksi terhadap garis y = x';
                if (axis === 'y=-x') return 'Refleksi terhadap garis y = -x';
                if (axis === 'x=h') return `Refleksi terhadap garis x = ${formatCoordinate(k)}`;
                if (axis === 'y=k') return `Refleksi terhadap garis y = ${formatCoordinate(k)}`;
                return `Refleksi terhadap garis ${describeLine(m, c)}`;
            }
            case 'rotation': {
                const { angle = 0, centerX = 0, centerY = 0 } = params;
                const direction = angle < 0 ? ' (searah jarum jam)' : '';
                return `Rotasi ${formatCoordinate(angle)}°${direction} dengan pusat ${point(centerX, centerY)}`;
            }
            case 'dilation': {
                const { factor = 1, centerX = 0, centerY = 0 } = params;
                return `Dilatasi faktor ${formatCoordinate(factor)} dengan pusat ${point(centerX, centerY)}`;
            }
            case 'translation': {
                const { tx = 0, ty = 0 } = params;
                return `Translasi dengan vektor ${point(tx, ty)}`;
            }
            default:
                return 'Transformasi aktif';
        }
    }

    // ==================== RUMUS TRANSFORMASI ====================

    /**
     * Semua transformasi di aplikasi ini affine: x' = a·x + b·y + e dan
     * y' = c·x + d·y + f. Koefisiennya dibaca dari peta tiga titik acuan.
     */
    function affineCoefficients(map) {
        const o = map({ x: 0, y: 0 });
        const ex = map({ x: 1, y: 0 });
        const ey = map({ x: 0, y: 1 });
        return { a: ex.x - o.x, b: ey.x - o.x, e: o.x, c: ex.y - o.y, d: ey.y - o.y, f: o.y };
    }

    const round2 = (value) => Math.round(value * 100) / 100;

    /** Ekspresi linear yang rapi, mis. "-x + 2y - 3" atau "0". */
    function formatLinear(coefX, coefY, constant) {
        const terms = [];
        const add = (coef, symbol) => {
            const value = round2(coef);
            if (value === 0) return;
            const abs = Math.abs(value);
            const body = symbol && abs === 1 ? symbol : `${formatCoordinate(abs)}${symbol}`;
            terms.push({ negative: value < 0, body });
        };
        add(coefX, 'x');
        add(coefY, 'y');
        add(constant, '');
        if (!terms.length) return '0';
        return terms.map((term, i) => {
            if (i === 0) return (term.negative ? '-' : '') + term.body;
            return (term.negative ? ' - ' : ' + ') + term.body;
        }).join('');
    }

    /** Aturan dengan angka, mis. "(x, y) → (-y, x)"; diawali "≈" bila dibulatkan. */
    function formatAffineRule(k) {
        const exact = [k.a, k.b, k.c, k.d, k.e, k.f].every(v => Math.abs(v - round2(v)) < 1e-9);
        return `(x, y) → ${exact ? '' : '≈ '}(${formatLinear(k.a, k.b, k.e)}, ${formatLinear(k.c, k.d, k.f)})`;
    }

    /**
     * Bentuk matriks: (x', y') = M·(x, y) + t. Nilai dibulatkan 2 desimal;
     * exact=false bila ada pembulatan. translation=null bila t = (0, 0).
     */
    function affineMatrix(k) {
        const values = [k.a, k.b, k.c, k.d, k.e, k.f];
        const exact = values.every(v => Math.abs(v - round2(v)) < 1e-9);
        const clean = (v) => (round2(v) === 0 ? 0 : round2(v));
        const translation = round2(k.e) === 0 && round2(k.f) === 0 ? null : [clean(k.e), clean(k.f)];
        return { matrix: [[clean(k.a), clean(k.b)], [clean(k.c), clean(k.d)]], translation, exact };
    }

    /** Rumus umum (simbolik) beserta keterangan nilai simbolnya. */
    function generalRule(type, params = {}) {
        const point = (x, y) => `(${formatCoordinate(x)}, ${formatCoordinate(y)})`;
        switch (type) {
            case 'reflection': {
                const { axis = 'x', m = 1, c = 0, k = 0 } = params;
                const rules = {
                    x: '(x, y) → (x, -y)',
                    y: '(x, y) → (-x, y)',
                    'y=x': '(x, y) → (y, x)',
                    'y=-x': '(x, y) → (-y, -x)'
                };
                if (rules[axis]) return { rule: rules[axis], note: '' };
                if (axis === 'x=h') return { rule: '(x, y) → (2h - x, y)', note: `h = ${formatCoordinate(k)}` };
                if (axis === 'y=k') return { rule: '(x, y) → (x, 2k - y)', note: `k = ${formatCoordinate(k)}` };
                return {
                    rule: "x' = [(1 - m²)x + 2m(y - c)] / (1 + m²),  y' = [2mx + (m² - 1)(y - c)] / (1 + m²) + c",
                    note: `m = ${formatCoordinate(m)}, c = ${formatCoordinate(c)}`
                };
            }
            case 'rotation': {
                const { angle = 0, centerX = 0, centerY = 0 } = params;
                if (centerX === 0 && centerY === 0) {
                    return { rule: '(x, y) → (x cos θ - y sin θ,  x sin θ + y cos θ)', note: `θ = ${formatCoordinate(angle)}°` };
                }
                return {
                    rule: "x' = a + (x - a) cos θ - (y - b) sin θ,  y' = b + (x - a) sin θ + (y - b) cos θ",
                    note: `pusat (a, b) = ${point(centerX, centerY)}, θ = ${formatCoordinate(angle)}°`
                };
            }
            case 'dilation': {
                const { factor = 1, centerX = 0, centerY = 0 } = params;
                if (centerX === 0 && centerY === 0) return { rule: '(x, y) → (kx, ky)', note: `k = ${formatCoordinate(factor)}` };
                return {
                    rule: '(x, y) → (a + k(x - a),  b + k(y - b))',
                    note: `pusat (a, b) = ${point(centerX, centerY)}, k = ${formatCoordinate(factor)}`
                };
            }
            case 'translation': {
                const { tx = 0, ty = 0 } = params;
                return { rule: '(x, y) → (x + a, y + b)', note: `vektor (a, b) = ${point(tx, ty)}` };
            }
            default:
                return { rule: '', note: '' };
        }
    }

    // ==================== LATIHAN ====================

    const geometry = global.GeometryTransformations
        || (typeof require === 'function' ? require('./transformations.js') : null);

    /**
     * Soal acak: bayangan satu titik bulat oleh satu transformasi. Parameter
     * dipilih agar jawabannya bulat atau setengah (mudah dihitung manual).
     * `random` dapat diganti untuk tes yang deterministik.
     */
    function createQuestion(random = Math.random) {
        const int = (min, max) => min + Math.floor(random() * (max - min + 1));
        const pick = (items) => items[Math.floor(random() * items.length)];
        const nonZero = (min, max) => {
            const value = int(min, max - 1);
            return value >= 0 ? value + 1 : value;
        };

        let point;
        do {
            point = { x: int(-6, 6), y: int(-6, 6) };
        } while (point.x === 0 && point.y === 0);

        const type = pick(['reflection', 'rotation', 'dilation', 'translation']);
        const atOrigin = random() < 0.6;
        const center = () => (atOrigin ? { centerX: 0, centerY: 0 } : { centerX: int(-2, 2), centerY: int(-2, 2) });
        let params;
        if (type === 'reflection') {
            const axis = pick(['x', 'y', 'y=x', 'y=-x', 'x=h', 'y=k']);
            params = { axis, m: 1, c: 0, k: axis === 'x=h' || axis === 'y=k' ? nonZero(-3, 3) : 0 };
        } else if (type === 'rotation') {
            params = { angle: pick([90, -90, 180, 270]), ...center() };
        } else if (type === 'dilation') {
            params = { factor: pick([2, 3, -1, -2, 0.5]), ...center() };
        } else {
            params = { tx: nonZero(-5, 5), ty: int(-5, 5) };
        }

        const answer = geometry.apply([point], type, params)[0];
        const clean = (value) => (Object.is(round2(value), -0) ? 0 : round2(value));
        const description = describeTransform(type, params);
        return {
            point,
            type,
            params,
            answer: { x: clean(answer.x), y: clean(answer.y) },
            text: `Tentukan bayangan titik A(${formatCoordinate(point.x)}, ${formatCoordinate(point.y)}) oleh `
                + `${description.charAt(0).toLowerCase()}${description.slice(1)}.`
        };
    }

    /** Periksa jawaban teks. valid=false bila formatnya tidak dapat dibaca. */
    function checkAnswer(question, text) {
        const parsed = parsePointInput(text);
        if (!parsed) return { valid: false, correct: false };
        const close = (a, b) => Math.abs(a - b) < 0.011;
        return { valid: true, correct: close(parsed.x, question.answer.x) && close(parsed.y, question.answer.y) };
    }

    // ==================== KONVERSI KOORDINAT ====================
    // view = { width, height, scale, offsetX, offsetY }; sumbu Y layar terbalik.

    function worldToScreen(view, x, y) {
        return {
            x: view.width / 2 + (x - view.offsetX) * view.scale,
            y: view.height / 2 - (y - view.offsetY) * view.scale
        };
    }

    function screenToWorld(view, x, y) {
        return {
            x: view.offsetX + (x - view.width / 2) / view.scale,
            y: view.offsetY - (y - view.height / 2) / view.scale
        };
    }

    // ==================== RIWAYAT UNDO/REDO ====================

    /**
     * Riwayat linear berbasis snapshot. Menambah snapshot setelah undo membuang
     * cabang redo. `limit` membatasi jumlah snapshot yang disimpan.
     */
    function createHistory(limit = 200) {
        let entries = [];
        let index = -1;
        return {
            push(snapshot) {
                entries = entries.slice(0, index + 1);
                entries.push(snapshot);
                if (entries.length > limit) entries = entries.slice(entries.length - limit);
                index = entries.length - 1;
                return snapshot;
            },
            undo() {
                if (index <= 0) return null;
                index -= 1;
                return entries[index];
            },
            redo() {
                if (index >= entries.length - 1) return null;
                index += 1;
                return entries[index];
            },
            current() { return index >= 0 ? entries[index] : null; },
            canUndo() { return index > 0; },
            canRedo() { return index < entries.length - 1; },
            get size() { return entries.length; }
        };
    }

    /** Tab yang harus aktif saat snapshot dipulihkan: tab asal hasil transformasi. */
    function snapshotTransform(snapshot) {
        return snapshot.resultMeta ? snapshot.resultMeta.transform : snapshot.transform;
    }

    // ==================== PENEMPATAN LABEL ====================

    function boxesOverlap(a, b) {
        return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    }

    function overlapArea(a, b) {
        const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        return w > 0 && h > 0 ? w * h : 0;
    }

    /**
     * Tempatkan label agar tidak saling tumpuk dan tidak menutupi titik.
     * items: [{ x, y, width, height, prefer?: 'above'|'below' }] (koordinat layar
     * titik, ukuran label). Hasil: [{ x, y }] = pojok kiri-atas setiap label.
     * Bila tidak ada posisi bebas, dipilih posisi dengan tumpang-tindih terkecil.
     */
    function placeLabels(items, { gap = 8, dotRadius = 7, bounds = null } = {}) {
        const dots = items.map(item => ({
            x: item.x - dotRadius, y: item.y - dotRadius, width: dotRadius * 2, height: dotRadius * 2
        }));
        const placed = [];

        return items.map(item => {
            const { x, y, width: w, height: h } = item;
            const above = { x: x + gap, y: y - gap - h };
            const below = { x: x + gap, y: y + gap };
            const candidates = [
                ...(item.prefer === 'below' ? [below, above] : [above, below]),
                { x: x - gap - w, y: y - gap - h },
                { x: x - gap - w, y: y + gap },
                { x: x + gap + 2, y: y - h / 2 },
                { x: x - gap - 2 - w, y: y - h / 2 },
                { x: x - w / 2, y: y - gap - 2 * h },
                { x: x - w / 2, y: y + gap + h }
            ];

            let best = null;
            let bestCost = Infinity;
            for (const candidate of candidates) {
                const box = { ...candidate, width: w, height: h };
                let cost = 0;
                for (const other of placed) cost += overlapArea(box, other);
                for (const dot of dots) cost += overlapArea(box, dot) * 2;
                if (bounds) {
                    const outside = (box.width * box.height) - overlapArea(box, bounds);
                    cost += outside * 0.5;
                }
                if (cost < bestCost) {
                    bestCost = cost;
                    best = box;
                    if (cost === 0) break;
                }
            }
            placed.push(best);
            return { x: best.x, y: best.y };
        });
    }

    const api = {
        parsePointInput, formatCoordinate, niceStep, wheelZoomFactor, fitView, describeTransform, describeLine,
        worldToScreen, screenToWorld, createHistory, snapshotTransform, placeLabels, boxesOverlap,
        affineCoefficients, formatLinear, formatAffineRule, affineMatrix, generalRule, createQuestion, checkAnswer
    };
    global.AppUtils = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
