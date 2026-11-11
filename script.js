// ==================== DEKLARASI ELEMEN DOM ====================
const {
    parsePointInput, formatCoordinate, niceStep, wheelZoomFactor, fitView, describeTransform, createHistory, placeLabels,
    affineCoefficients, formatAffineRule, affineMatrix, generalRule, createQuestion, checkAnswer
} = AppUtils;

const canvas = document.getElementById('transformCanvas');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);
const applyButton = $('applyTransform');
const clearButton = $('clearPoints');
const closePolygonButton = $('closePolygon');
const resetButton = $('resetTransform');
const coordinateTableBody = $('coordinateTableBody');
const resetViewButton = $('resetView');
const zoomInButton = $('zoomIn');
const zoomOutButton = $('zoomOut');
const manualPointInput = $('manualPointInput');
const addManualPointButton = $('addManualPoint');
const undoButton = $('undoAction');
const redoButton = $('redoAction');
const exportButton = $('exportCanvas');
const helpBtn = $('helpBtn');
const helpModal = $('helpModal');
const announcer = $('srAnnouncer');
const showCoordinatesInput = $('showCoordinates');
const controlPanel = $('controlPanel');
const sheetToggle = $('sheetToggle');
const smallScreen = window.matchMedia('(max-width: 1023px)');
const formulaEls = {
    title: $('formulaTitle'),
    general: $('formulaGeneral'),
    note: $('formulaNote'),
    specific: $('formulaSpecific'),
    matrix: $('formulaMatrix'),
    example: $('formulaExample')
};

// ==================== VARIABEL GLOBAL ====================
let points = [];
let transformedPoints = [];
// Info transformasi yang menghasilkan transformedPoints (jenis dan pusatnya).
let resultMeta = null;
let isPolygonClosed = false;
let currentTransform = 'reflection';
const history = createHistory();

// Indeks titik yang disorot (kanvas atau tabel); label lengkap & cincin sorot.
let hoveredIndex = null;
// Animasi bentuk asli menuju bayangannya setelah "Terapkan Transformasi".
let animation = null;
const ANIMATION_MS = 750;

// Transformasi tampilan (pan dan zoom)
const DEFAULT_SCALE = 30; // 1 unit = 30 piksel
let viewOffsetX = 0;
let viewOffsetY = 0;
let viewScale = DEFAULT_SCALE;
const minScale = 2;
const maxScale = 80;

let redrawFrame = 0;
let canvasWidth = 0;
let canvasHeight = 0;

const CANVAS_FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
// Palet kanvas per tema. Warna garis bantu per transformasi sama dengan
// --accent-strong (tema terang) dan --accent (tema gelap) di CSS.
const CANVAS_THEMES = {
    light: {
        background: '#f8fafc',
        gridMinor: 'rgba(200, 200, 200, 0.4)',
        gridMajor: 'rgba(160, 160, 160, 0.6)',
        axis: '#333333',
        labelBackground: 'rgba(248, 250, 252, 0.85)',
        original: '#2196f3',
        result: '#ff9800',
        highlight: '#f43f5e',
        helpers: { reflection: '#9333ea', rotation: '#16a34a', dilation: '#db2777', translation: '#0891b2' }
    },
    dark: {
        background: '#0b1324',
        gridMinor: 'rgba(148, 163, 184, 0.12)',
        gridMajor: 'rgba(148, 163, 184, 0.3)',
        axis: '#cbd5e1',
        labelBackground: 'rgba(15, 23, 42, 0.85)',
        original: '#60a5fa',
        result: '#fbbf24',
        highlight: '#fb7185',
        helpers: { reflection: '#c084fc', rotation: '#4ade80', dilation: '#f472b6', translation: '#22d3ee' }
    }
};

function currentTheme() {
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function palette() {
    return CANVAS_THEMES[currentTheme()];
}

const transformNames = {
    reflection: 'refleksi',
    rotation: 'rotasi',
    dilation: 'dilatasi',
    translation: 'translasi'
};

// ==================== FUNGSI UTAMA ====================

function setupCanvasSize() {
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    canvasWidth = canvas.clientWidth;
    canvasHeight = canvas.clientHeight;
    canvas.width = Math.floor(canvasWidth * ratio);
    canvas.height = Math.floor(canvasHeight * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function currentView() {
    return { width: canvasWidth, height: canvasHeight, scale: viewScale, offsetX: viewOffsetX, offsetY: viewOffsetY };
}

function worldToScreen(worldX, worldY) {
    return AppUtils.worldToScreen(currentView(), worldX, worldY);
}

function screenToWorld(screenX, screenY) {
    return AppUtils.screenToWorld(currentView(), screenX, screenY);
}

function init() {
    setupCanvasSize();
    setupEventListeners();
    setupHelpModal();
    setupCanvasResizeHandling();

    // Buka tab dari hash URL (mis. #rotasi), default ke refleksi
    setActiveTab(findTabByHash(location.hash) || transformTabs[0], { updateHash: false, record: false });
    syncParamDisplays();
    initShareButtons();
    initPractice();
    initTheme();
    initBackToTop();
    registerServiceWorker();

    // Mulai dengan kanvas kosong; simpan sebagai titik awal riwayat undo
    saveHistory();
    updateCoordinateTable();
    redrawCanvas();
}

// ==================== TAB TRANSFORMASI ====================

const transformTabs = Array.from(document.querySelectorAll('.transform-tab'));

function findTabByHash(hash) {
    const key = (hash || '').replace(/^#/, '');
    return transformTabs.find(tab => tab.dataset.hash === key || tab.dataset.transform === key);
}

// Aktifkan satu tab. Hasil transformasi tab lain dibersihkan dan dicatat ke
// riwayat, sehingga undo mengembalikan hasil sekaligus tab asalnya.
function setActiveTab(tab, { focus = false, updateHash = true, record = true, keepResult = false } = {}) {
    if (!tab) return;
    const changed = tab.dataset.transform !== currentTransform;

    transformTabs.forEach(item => {
        const selected = item === tab;
        item.classList.toggle('is-active', selected);
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
    });
    if (focus) tab.focus();

    currentTransform = tab.dataset.transform;
    document.body.dataset.transform = currentTransform;
    showTransformParams(currentTransform);
    updateTransformStatus();

    if (updateHash && location.hash !== '#' + tab.dataset.hash) {
        window.history.replaceState(null, '', '#' + tab.dataset.hash);
    }
    if (changed && !keepResult && transformedPoints.length > 0) {
        transformedPoints = [];
        resultMeta = null;
        if (record) saveHistory();
        updateCoordinateTable();
    }
    redrawCanvas();
}

function handleTabKeydown(event) {
    const index = transformTabs.indexOf(event.currentTarget);
    let next = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = transformTabs[(index + 1) % transformTabs.length];
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = transformTabs[(index - 1 + transformTabs.length) % transformTabs.length];
    else if (event.key === 'Home') next = transformTabs[0];
    else if (event.key === 'End') next = transformTabs[transformTabs.length - 1];
    if (!next) return;
    event.preventDefault();
    setActiveTab(next, { focus: true });
}

function updateTransformStatus() {
    const status = document.querySelector('.canvas-status');
    if (status) status.textContent = describeTransform(currentTransform, getTransformParams(currentTransform));
    $('sheetTitle').textContent = `Atur ${transformNames[currentTransform]}`;
    updateFormula();
}

// ==================== MODAL PETUNJUK ====================

let modalReturnFocus = null;

function getFocusableInModal() {
    return Array.from(helpModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter(el => !el.disabled && el.offsetParent !== null);
}

function showHelpModal() {
    modalReturnFocus = document.activeElement;
    helpModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    const closeBtn = helpModal.querySelector('.close-modal');
    if (closeBtn) closeBtn.focus();
}

function hideHelpModal() {
    helpModal.classList.add('hidden');
    document.body.style.overflow = '';
    (modalReturnFocus && document.contains(modalReturnFocus) ? modalReturnFocus : helpBtn).focus();
}

function setupHelpModal() {
    helpBtn.addEventListener('click', showHelpModal);
    helpModal.querySelector('.close-modal').addEventListener('click', hideHelpModal);
    helpModal.querySelector('.btn-close-modal').addEventListener('click', hideHelpModal);
    helpModal.addEventListener('click', (event) => {
        if (event.target === helpModal) hideHelpModal();
    });

    document.addEventListener('keydown', (event) => {
        if (helpModal.classList.contains('hidden')) return;
        if (event.key === 'Escape') {
            hideHelpModal();
            return;
        }
        // Jaga fokus tetap di dalam modal
        if (event.key === 'Tab') {
            const focusable = getFocusableInModal();
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && (document.activeElement === first || !helpModal.contains(document.activeElement))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });
}

// ==================== EVENT LISTENERS ====================

const paramInputIds = [
    'reflectionAxis', 'reflectionM', 'reflectionC', 'reflectionK',
    'rotationAngle', 'rotationCenterX', 'rotationCenterY',
    'scaleFactor', 'dilationCenterX', 'dilationCenterY',
    'translationX', 'translationY'
];

function setupEventListeners() {
    // Satu alur pointer untuk mouse, touch, dan stylus.
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerCancel);
    canvas.addEventListener('pointerleave', () => setHovered(null));
    canvas.addEventListener('wheel', handleCanvasWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('keydown', handleCanvasKeydown);

    transformTabs.forEach(tab => {
        tab.addEventListener('click', () => setActiveTab(tab));
        tab.addEventListener('keydown', handleTabKeydown);
    });
    window.addEventListener('hashchange', () => {
        const tab = findTabByHash(location.hash);
        if (tab) setActiveTab(tab, { updateHash: false });
    });

    applyButton.addEventListener('click', applyTransform);
    clearButton.addEventListener('click', clearPoints);
    closePolygonButton.addEventListener('click', closePolygon);
    resetButton.addEventListener('click', resetTransform);
    document.querySelectorAll('.shape-chip').forEach(chip => {
        chip.addEventListener('click', () => loadPreset(chip.dataset.preset));
    });
    sheetToggle.addEventListener('click', () => setSheetExpanded(controlPanel.classList.contains('is-collapsed')));
    undoButton.addEventListener('click', undo);
    redoButton.addEventListener('click', redo);
    exportButton.addEventListener('click', exportCanvasImage);
    resetViewButton.addEventListener('click', resetView);
    zoomInButton.addEventListener('click', () => zoomAt(1.25));
    zoomOutButton.addEventListener('click', () => zoomAt(0.8));

    showCoordinatesInput.addEventListener('change', redrawCanvas);

    // Menyorot baris tabel juga menyorot titik asli dan bayangannya di kanvas.
    coordinateTableBody.addEventListener('pointerover', (event) => {
        const row = event.target.closest('tr[data-index]');
        setHovered(row ? Number(row.dataset.index) : null);
    });
    coordinateTableBody.addEventListener('pointerleave', () => setHovered(null));

    addManualPointButton.addEventListener('click', addManualPoint);
    manualPointInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addManualPoint();
    });

    // Pilihan garis refleksi bergambar mengisi <select> tersembunyi.
    document.querySelectorAll('input[name="reflectionAxisChoice"]').forEach(radio => {
        radio.addEventListener('change', () => {
            $('reflectionAxis').value = radio.value;
            handleParamChange();
        });
        radio.addEventListener('focus', () => radio.closest('.axis-option').classList.add('has-focus'));
        radio.addEventListener('blur', () => radio.closest('.axis-option').classList.remove('has-focus'));
    });
    document.querySelectorAll('.quick-value').forEach(button => {
        button.addEventListener('click', () => {
            $(button.dataset.target).value = button.dataset.value;
            handleParamChange();
        });
    });

    // Setiap perubahan parameter memperbarui label status dan pratinjau garis/pusat.
    paramInputIds.forEach(id => {
        const input = $(id);
        input.addEventListener('input', handleParamChange);
        input.addEventListener('change', handleParamChange);
    });
}

function handleParamChange() {
    syncParamDisplays();
    updateTransformStatus();
    redrawCanvas();
}

function setupCanvasResizeHandling() {
    const resize = () => {
        setupCanvasSize();
        drawNow();
    };
    if ('ResizeObserver' in window) {
        new ResizeObserver(resize).observe(canvas);
    } else {
        window.addEventListener('resize', resize);
    }
    // Perubahan devicePixelRatio (mis. pindah monitor atau zoom browser)
    const watchPixelRatio = () => {
        const query = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
        query.addEventListener('change', () => {
            resize();
            watchPixelRatio();
        }, { once: true });
    };
    if (window.matchMedia) watchPixelRatio();
}

// ==================== RIWAYAT (UNDO/REDO) ====================

function clonePoints(value) {
    return value.map(point => ({ x: point.x, y: point.y }));
}

function saveHistory() {
    stopAnimation();
    history.push({
        points: clonePoints(points),
        transformedPoints: clonePoints(transformedPoints),
        resultMeta: resultMeta && { ...resultMeta },
        isPolygonClosed,
        transform: currentTransform
    });
    updateHistoryButtons();
}

function restoreSnapshot(snapshot) {
    stopAnimation();
    points = clonePoints(snapshot.points);
    transformedPoints = clonePoints(snapshot.transformedPoints);
    resultMeta = snapshot.resultMeta && { ...snapshot.resultMeta };
    isPolygonClosed = snapshot.isPolygonClosed;

    // Hasil transformasi selalu ditampilkan di tab yang menghasilkannya.
    const tabTransform = AppUtils.snapshotTransform(snapshot);
    const tab = transformTabs.find(item => item.dataset.transform === tabTransform);
    if (tab && tabTransform !== currentTransform) setActiveTab(tab, { keepResult: true });

    redrawCanvas();
    updateCoordinateTable();
    updateHistoryButtons();
}

function updateHistoryButtons() {
    undoButton.disabled = !history.canUndo();
    redoButton.disabled = !history.canRedo();
}

function undo() {
    const snapshot = history.undo();
    if (!snapshot) return;
    restoreSnapshot(snapshot);
    showMessage('Perubahan terakhir dibatalkan', 'success');
}

function redo() {
    const snapshot = history.redo();
    if (!snapshot) return;
    restoreSnapshot(snapshot);
    showMessage('Perubahan dipulihkan', 'success');
}

function exportCanvasImage() {
    drawNow();
    // Gabungkan dengan latar kanvas agar PNG tidak transparan di penampil mana pun.
    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    const outputCtx = output.getContext('2d');
    outputCtx.fillStyle = palette().background;
    outputCtx.fillRect(0, 0, output.width, output.height);
    outputCtx.drawImage(canvas, 0, 0);

    output.toBlob((blob) => {
        if (!blob) {
            showMessage('Gagal mengekspor gambar', 'error');
            return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'geometri-transformasi.png';
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showMessage('Visualisasi berhasil diekspor', 'success');
    }, 'image/png');
}

// ==================== CANVAS DAN GRID ====================

function drawGridAndAxes() {
    ctx.fillStyle = palette().background;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const gridStep = niceStep(viewScale, 12);
    const majorStep = gridStep * 5;
    const labelInterval = niceStep(viewScale, 28);

    const leftWorld = viewOffsetX - canvasWidth / 2 / viewScale;
    const rightWorld = viewOffsetX + canvasWidth / 2 / viewScale;
    const topWorld = viewOffsetY + canvasHeight / 2 / viewScale;
    const bottomWorld = viewOffsetY - canvasHeight / 2 / viewScale;

    const drawGridLines = (from, to, isVertical) => {
        const start = Math.ceil(from / gridStep) * gridStep;
        for (let value = start; value <= to; value += gridStep) {
            if (Math.abs(value) < 1e-9) continue;
            const isMajor = Math.abs(value % majorStep) < 1e-9;
            ctx.strokeStyle = isMajor ? palette().gridMajor : palette().gridMinor;
            ctx.lineWidth = isMajor ? 1 : 0.5;
            const pos = isVertical ? worldToScreen(value, 0).x : worldToScreen(0, value).y;
            ctx.beginPath();
            if (isVertical) {
                ctx.moveTo(pos, 0);
                ctx.lineTo(pos, canvasHeight);
            } else {
                ctx.moveTo(0, pos);
                ctx.lineTo(canvasWidth, pos);
            }
            ctx.stroke();
        }
    };
    drawGridLines(leftWorld, rightWorld, true);
    drawGridLines(bottomWorld, topWorld, false);

    // Sumbu X dan Y
    const origin = worldToScreen(0, 0);
    ctx.strokeStyle = palette().axis;
    ctx.fillStyle = palette().axis;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, origin.y);
    ctx.lineTo(canvasWidth, origin.y);
    ctx.moveTo(origin.x, 0);
    ctx.lineTo(origin.x, canvasHeight);
    ctx.stroke();

    // Panah sumbu
    ctx.beginPath();
    ctx.moveTo(canvasWidth - 10, origin.y - 5);
    ctx.lineTo(canvasWidth, origin.y);
    ctx.lineTo(canvasWidth - 10, origin.y + 5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(origin.x - 5, 10);
    ctx.lineTo(origin.x, 0);
    ctx.lineTo(origin.x + 5, 10);
    ctx.fill();

    ctx.font = `bold 14px ${CANVAS_FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('X', canvasWidth - 20, origin.y - 10);
    ctx.fillText('Y', origin.x + 10, 20);

    if (origin.x > 15 && origin.x < canvasWidth - 15 && origin.y > 15 && origin.y < canvasHeight - 15) {
        ctx.font = `bold 13px ${CANVAS_FONT}`;
        ctx.fillText('(0,0)', origin.x + 10, origin.y - 10);
    }

    // Angka pada sumbu
    ctx.font = `12px ${CANVAS_FONT}`;
    ctx.lineWidth = 2;
    ctx.textAlign = 'center';
    for (let worldX = Math.ceil(leftWorld / labelInterval) * labelInterval; worldX <= rightWorld; worldX += labelInterval) {
        if (Math.abs(worldX) < 1e-9) continue;
        const pos = worldToScreen(worldX, 0);
        if (pos.x <= 30 || pos.x >= canvasWidth - 30) continue;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y - 5);
        ctx.lineTo(pos.x, pos.y + 5);
        ctx.stroke();
        ctx.fillText(formatCoordinate(worldX), pos.x, pos.y + 20);
    }

    ctx.textAlign = 'right';
    for (let worldY = Math.ceil(bottomWorld / labelInterval) * labelInterval; worldY <= topWorld; worldY += labelInterval) {
        if (Math.abs(worldY) < 1e-9) continue;
        const pos = worldToScreen(0, worldY);
        if (pos.y <= 20 || pos.y >= canvasHeight - 20) continue;
        ctx.beginPath();
        ctx.moveTo(pos.x - 5, pos.y);
        ctx.lineTo(pos.x + 5, pos.y);
        ctx.stroke();
        ctx.fillText(formatCoordinate(worldY), pos.x - 10, pos.y + 4);
    }
}

// ==================== INPUT TITIK ====================

function addPoint(x, y) {
    points.push({ x, y });
    isPolygonClosed = false;
    transformedPoints = [];
    resultMeta = null;
    saveHistory();
    redrawCanvas();
    updateCoordinateTable();
    showMessage(`Titik P${points.length}(${formatCoordinate(x)}, ${formatCoordinate(y)}) ditambahkan`, 'success');
}

function addManualPoint() {
    const inputText = manualPointInput.value.trim();
    if (!inputText) {
        showMessage('Masukkan koordinat titik!', 'error');
        return;
    }
    const coordinates = parsePointInput(inputText);
    if (!coordinates) {
        showMessage('Format koordinat tidak valid. Contoh: (3, 5), 2 -4, atau (1,5; 2)', 'error');
        return;
    }
    manualPointInput.value = '';
    addPoint(coordinates.x, coordinates.y);
}

function addPointAtScreen(screenX, screenY) {
    const world = screenToWorld(screenX, screenY);
    // Bulatkan ke koordinat bulat terdekat (atau 0,5 saat sangat diperbesar).
    const snap = viewScale >= 60 ? 0.5 : 1;
    const x = Math.round(world.x / snap) * snap;
    const y = Math.round(world.y / snap) * snap;
    addPoint(x + 0, y + 0); // +0 menghindari -0
}

// ==================== PESAN ====================

let messageTimer = 0;

function announce(text) {
    if (!announcer) return;
    // Kosongkan dulu agar pesan yang sama tetap dibacakan ulang.
    announcer.textContent = '';
    requestAnimationFrame(() => { announcer.textContent = text; });
}

function showMessage(message, type) {
    document.querySelectorAll('.temp-message').forEach(el => el.remove());
    clearTimeout(messageTimer);

    const messageElement = document.createElement('div');
    messageElement.className = `temp-message ${type}`;
    messageElement.setAttribute('aria-hidden', 'true'); // dibacakan lewat #srAnnouncer
    messageElement.textContent = message;
    document.body.appendChild(messageElement);
    announce(message);

    messageTimer = setTimeout(() => messageElement.remove(), 3000);
}

// ==================== INTERAKSI POINTER ====================

const activePointers = new Map();
const TAP_TOLERANCE = 6; // piksel
let pointerPanStart = null;
let pointerPinchStart = null;
let tapCandidate = null;
// Titik asli atau pusat transformasi yang sedang diseret.
let dragState = null;

function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function startPan(position) {
    pointerPanStart = { x: position.x, y: position.y, offsetX: viewOffsetX, offsetY: viewOffsetY, moved: false };
}

function startPinch() {
    const [first, second] = [...activePointers.values()];
    const centerX = (first.x + second.x) / 2;
    const centerY = (first.y + second.y) / 2;
    const world = screenToWorld(centerX, centerY);
    pointerPinchStart = {
        distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
        scale: viewScale,
        worldX: world.x,
        worldY: world.y
    };
    pointerPanStart = null;
}

function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    const position = pointerPosition(event);
    activePointers.set(event.pointerId, position);
    canvas.setPointerCapture(event.pointerId);

    const primary = event.pointerType !== 'mouse' || event.button === 0;
    if (activePointers.size === 1) {
        const target = primary ? dragTargetAt(position) : null;
        if (target) {
            startDrag(target, event.pointerId, position);
            return;
        }
        startPan(position);
        // Hanya klik kiri / ketukan satu jari yang menambah titik.
        tapCandidate = primary ? { id: event.pointerId, x: position.x, y: position.y } : null;
    } else if (activePointers.size === 2) {
        // Jari kedua mengubah seret menjadi pinch zoom.
        if (dragState) finishDrag();
        tapCandidate = null;
        startPinch();
    }
}

// ==================== SERET TITIK DAN PUSAT ====================

const DRAG_RADIUS = 14; // piksel; sedikit lebih longgar dari radius sorot

function centerInputIds() {
    if (currentTransform === 'rotation') return ['rotationCenterX', 'rotationCenterY'];
    if (currentTransform === 'dilation') return ['dilationCenterX', 'dilationCenterY'];
    return null;
}

// Yang bisa diseret: titik asli (diutamakan) dan pusat rotasi/dilatasi.
function dragTargetAt(position) {
    const distanceTo = (world) => {
        const screen = worldToScreen(world.x, world.y);
        return Math.hypot(screen.x - position.x, screen.y - position.y);
    };
    let best = null;
    let bestDistance = DRAG_RADIUS;
    points.forEach((point, index) => {
        const distance = distanceTo(point);
        if (distance <= bestDistance) {
            bestDistance = distance;
            best = { kind: 'point', index };
        }
    });
    if (best) return best;
    const ids = centerInputIds();
    if (ids && distanceTo({ x: numberValue(ids[0]), y: numberValue(ids[1]) }) <= DRAG_RADIUS) {
        return { kind: 'center' };
    }
    return null;
}

function snapToGrid(world) {
    const snap = viewScale >= 60 ? 0.5 : 1;
    return { x: Math.round(world.x / snap) * snap + 0, y: Math.round(world.y / snap) * snap + 0 };
}

function startDrag(target, pointerId, position) {
    stopAnimation();
    dragState = { target, pointerId, start: position, moved: false, changed: false };
    tapCandidate = null;
    pointerPanStart = null;
    if (target.kind === 'point') setHovered(target.index);
}

function moveDrag(position) {
    if (!dragState.moved) {
        if (Math.hypot(position.x - dragState.start.x, position.y - dragState.start.y) < TAP_TOLERANCE) return;
        dragState.moved = true;
        canvas.style.cursor = 'grabbing';
    }
    const world = snapToGrid(screenToWorld(position.x, position.y));
    const { target } = dragState;

    if (target.kind === 'point') {
        const current = points[target.index];
        if (current.x === world.x && current.y === world.y) return;
        points[target.index] = world;
        // Bayangan yang sudah diterapkan ikut bergerak bersama titik aslinya.
        if (resultMeta && resultMeta.params && transformedPoints.length === points.length) {
            transformedPoints = GeometryTransformations.apply(points, resultMeta.transform, resultMeta.params);
        }
        dragState.changed = true;
        updateCoordinateTable();
        redrawCanvas();
    } else {
        const [idX, idY] = centerInputIds();
        if (numberValue(idX) === world.x && numberValue(idY) === world.y) return;
        $(idX).value = String(world.x);
        $(idY).value = String(world.y);
        dragState.changed = true;
        handleParamChange();
    }
}

function finishDrag() {
    const { target, changed } = dragState;
    dragState = null;
    canvas.style.cursor = '';
    if (!changed) return;
    if (target.kind === 'point') {
        saveHistory();
        const p = points[target.index];
        showMessage(`Titik P${target.index + 1} dipindah ke (${formatCoordinate(p.x)}, ${formatCoordinate(p.y)})`, 'success');
    } else {
        const params = getTransformParams(currentTransform);
        showMessage(`Pusat ${transformNames[currentTransform]} dipindah ke (${formatCoordinate(params.centerX)}, ${formatCoordinate(params.centerY)})`, 'success');
    }
}

function setHovered(index) {
    if (index === hoveredIndex) return;
    hoveredIndex = index;
    coordinateTableBody.querySelectorAll('tr[data-index]').forEach(row => {
        row.classList.toggle('is-highlighted', Number(row.dataset.index) === index);
    });
    redrawCanvas();
}

const HOVER_RADIUS = 12; // piksel

// Cari titik (asli atau bayangan) terdekat dari kursor.
function pointIndexAt(position) {
    let best = null;
    let bestDistance = HOVER_RADIUS;
    [points, transformedPoints].forEach(list => list.forEach((point, index) => {
        const screen = worldToScreen(point.x, point.y);
        const distance = Math.hypot(screen.x - position.x, screen.y - position.y);
        if (distance <= bestDistance) {
            bestDistance = distance;
            best = index;
        }
    }));
    return best;
}

function handlePointerMove(event) {
    if (!activePointers.has(event.pointerId)) {
        if (event.pointerType === 'mouse') {
            const position = pointerPosition(event);
            setHovered(pointIndexAt(position));
            canvas.style.cursor = dragTargetAt(position) ? 'grab' : '';
        }
        return;
    }
    event.preventDefault();
    const position = pointerPosition(event);
    activePointers.set(event.pointerId, position);

    if (dragState && dragState.pointerId === event.pointerId) {
        moveDrag(position);
        return;
    }

    if (activePointers.size === 2 && pointerPinchStart) {
        const [first, second] = [...activePointers.values()];
        const centerX = (first.x + second.x) / 2;
        const centerY = (first.y + second.y) / 2;
        const distance = Math.hypot(second.x - first.x, second.y - first.y);
        viewScale = clampScale(pointerPinchStart.scale * distance / pointerPinchStart.distance);
        // Titik dunia di bawah jari tetap di bawah jari (zoom + pan dua jari).
        viewOffsetX = pointerPinchStart.worldX - (centerX - canvasWidth / 2) / viewScale;
        viewOffsetY = pointerPinchStart.worldY + (centerY - canvasHeight / 2) / viewScale;
        redrawCanvas();
    } else if (activePointers.size === 1 && pointerPanStart) {
        const dx = position.x - pointerPanStart.x;
        const dy = position.y - pointerPanStart.y;
        if (!pointerPanStart.moved && Math.hypot(dx, dy) < TAP_TOLERANCE) return;
        pointerPanStart.moved = true;
        tapCandidate = null;
        canvas.style.cursor = 'grabbing';
        viewOffsetX = pointerPanStart.offsetX - dx / viewScale;
        viewOffsetY = pointerPanStart.offsetY + dy / viewScale;
        redrawCanvas();
    }
}

function endPointer(event, allowTap) {
    if (!activePointers.has(event.pointerId)) return;

    if (dragState && dragState.pointerId === event.pointerId) {
        activePointers.delete(event.pointerId);
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        const { target, moved } = dragState;
        finishDrag();
        // Ketukan pada P1 menutup poligon (bila belum tertutup).
        if (allowTap && !moved && target.kind === 'point' && target.index === 0
            && points.length >= 3 && !isPolygonClosed) {
            closePolygon();
        }
        return;
    }
    const wasTap = allowTap && tapCandidate && tapCandidate.id === event.pointerId && activePointers.size === 1;
    activePointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);

    if (wasTap) addPointAtScreen(tapCandidate.x, tapCandidate.y);
    tapCandidate = null;
    pointerPinchStart = null;

    // Setelah pinch, jari yang tersisa melanjutkan pan tanpa lompatan.
    if (activePointers.size === 1) {
        startPan([...activePointers.values()][0]);
        pointerPanStart.moved = true;
    } else {
        pointerPanStart = null;
        canvas.style.cursor = '';
    }
}

function handlePointerUp(event) {
    endPointer(event, true);
}

function handlePointerCancel(event) {
    endPointer(event, false);
}

function handleCanvasWheel(event) {
    event.preventDefault();
    const position = pointerPosition(event);
    zoomAt(wheelZoomFactor(event.deltaY, event.deltaMode), position.x, position.y);
}

function handleCanvasKeydown(event) {
    const panPixels = event.shiftKey ? 120 : 40;
    const actions = {
        ArrowLeft: () => panBy(-panPixels, 0),
        ArrowRight: () => panBy(panPixels, 0),
        ArrowUp: () => panBy(0, -panPixels),
        ArrowDown: () => panBy(0, panPixels),
        '+': () => zoomAt(1.25),
        '=': () => zoomAt(1.25),
        '-': () => zoomAt(0.8),
        '_': () => zoomAt(0.8),
        '0': () => resetView()
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
}

// ==================== ZOOM DAN VIEW ====================

function clampScale(value) {
    return Math.max(minScale, Math.min(maxScale, value));
}

function panBy(screenDx, screenDy) {
    viewOffsetX += screenDx / viewScale;
    viewOffsetY -= screenDy / viewScale;
    redrawCanvas();
}

// Zoom dengan titik (screenX, screenY) tetap di tempat; default: tengah kanvas.
function zoomAt(factor, screenX = canvasWidth / 2, screenY = canvasHeight / 2) {
    const before = screenToWorld(screenX, screenY);
    viewScale = clampScale(viewScale * factor);
    const after = screenToWorld(screenX, screenY);
    viewOffsetX += before.x - after.x;
    viewOffsetY += before.y - after.y;
    redrawCanvas();
}

function resetView() {
    viewOffsetX = 0;
    viewOffsetY = 0;
    viewScale = DEFAULT_SCALE;
    redrawCanvas();
    showMessage('Tampilan koordinat direset ke posisi awal', 'success');
}

// Pastikan semua titik (asli, hasil, dan pusat) terlihat di kanvas.
function ensureVisible(extraPoints = []) {
    const next = fitView(points.concat(transformedPoints, extraPoints), {
        width: canvasWidth,
        height: canvasHeight,
        scale: viewScale,
        offsetX: viewOffsetX,
        offsetY: viewOffsetY
    }, { minScale, maxScale });
    if (!next) return;
    viewScale = next.scale;
    viewOffsetX = next.offsetX;
    viewOffsetY = next.offsetY;
}

// ==================== GAMBAR TITIK, GARIS, DAN ELEMEN BANTU ====================

// Gambar poligon/polyline. Pratinjau digambar putus-putus dan transparan.
function drawShape(shapePoints, color, { preview = false } = {}) {
    if (!shapePoints.length) return;
    const screenPoints = shapePoints.map(p => worldToScreen(p.x, p.y));
    const closed = isPolygonClosed && screenPoints.length > 2;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = preview ? 2 : 3;
    ctx.lineJoin = 'round';
    ctx.setLineDash(preview ? [6, 5] : []);
    if (preview) ctx.globalAlpha = 0.65;

    if (screenPoints.length > 1) {
        ctx.beginPath();
        screenPoints.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        if (closed) {
            ctx.closePath();
            const alpha = ctx.globalAlpha;
            ctx.globalAlpha = preview ? 0.06 : 0.14;
            ctx.fill();
            ctx.globalAlpha = alpha;
        }
        ctx.stroke();
    }

    ctx.setLineDash([]);
    screenPoints.forEach(p => {
        ctx.beginPath();
        if (preview) {
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    ctx.restore();
}

// Cincin sorot pada titik asli dan bayangannya yang berindeks sama.
function drawHighlight(resultPoints) {
    if (hoveredIndex === null) return;
    ctx.save();
    ctx.strokeStyle = palette().highlight;
    ctx.lineWidth = 2.5;
    [points[hoveredIndex], resultPoints[hoveredIndex]].forEach(point => {
        if (!point) return;
        const p = worldToScreen(point.x, point.y);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
        ctx.stroke();
    });
    ctx.restore();
}

const LABEL_FONT_SIZE = 13;
const LABEL_PADDING = 3;

// Label ringkas (P1, P'1) agar kanvas tidak penuh. Koordinat lengkap tampil
// untuk titik yang disorot, atau untuk semua titik bila "Koordinat" dicentang.
function drawPointLabels(resultPoints) {
    ctx.font = `bold ${LABEL_FONT_SIZE}px ${CANVAS_FONT}`;
    const showAll = showCoordinatesInput.checked;
    const makeLabels = (shapePoints, prefix, color, prefer) => shapePoints.map((point, i) => {
        const full = showAll || i === hoveredIndex;
        const name = `${prefix}${i + 1}`;
        const text = full ? `${name}(${formatCoordinate(point.x)}, ${formatCoordinate(point.y)})` : name;
        const screen = worldToScreen(point.x, point.y);
        return {
            text,
            color,
            prefer,
            x: screen.x,
            y: screen.y,
            width: ctx.measureText(text).width + LABEL_PADDING * 2,
            height: LABEL_FONT_SIZE + LABEL_PADDING * 2
        };
    });
    const labels = makeLabels(points, 'P', palette().original, 'above')
        .concat(makeLabels(resultPoints, "P'", palette().result, 'below'));
    if (!labels.length) return;

    const positions = placeLabels(labels, {
        bounds: { x: 0, y: 0, width: canvasWidth, height: canvasHeight }
    });

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    labels.forEach((label, i) => {
        const { x, y } = positions[i];
        ctx.fillStyle = palette().labelBackground;
        ctx.fillRect(x, y, label.width, label.height);
        ctx.fillStyle = label.color;
        ctx.fillText(label.text, x + LABEL_PADDING, y + LABEL_PADDING);
    });
    ctx.textBaseline = 'alphabetic';
}

function drawDashedSegment(a, b) {
    const from = worldToScreen(a.x, a.y);
    const to = worldToScreen(b.x, b.y);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
}

function drawArrowHead(a, b) {
    const from = worldToScreen(a.x, a.y);
    const to = worldToScreen(b.x, b.y);
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    if (Math.hypot(to.x - from.x, to.y - from.y) < 12) return;
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - 10 * Math.cos(angle - 0.4), to.y - 10 * Math.sin(angle - 0.4));
    ctx.lineTo(to.x - 10 * Math.cos(angle + 0.4), to.y - 10 * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
}

function drawCenterMarker(center, label) {
    const p = worldToScreen(center.x, center.y);
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    // Isi putih menandakan pusat bisa diseret.
    const fill = ctx.fillStyle;
    ctx.fillStyle = palette().background;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(p.x - 11, p.y);
    ctx.lineTo(p.x + 11, p.y);
    ctx.moveTo(p.x, p.y - 11);
    ctx.lineTo(p.x, p.y + 11);
    ctx.stroke();
    if (center.x === 0 && center.y === 0) return; // label "(0,0)" sudah ada
    ctx.font = `bold 12px ${CANVAS_FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${label}(${formatCoordinate(center.x)}, ${formatCoordinate(center.y)})`, p.x - 12, p.y + 18);
}

// Busur lintasan titik saat dirotasi, dengan panah di ujungnya. Sumbu Y layar
// terbalik, jadi sudut positif (berlawanan jarum jam) digambar anticlockwise.
function drawRotationArc(center, point, angle) {
    const c = worldToScreen(center.x, center.y);
    const p = worldToScreen(point.x, point.y);
    const radius = Math.hypot(p.x - c.x, p.y - c.y);
    if (radius < 4 || angle === 0) return;
    const start = Math.atan2(p.y - c.y, p.x - c.x);
    const end = start - angle * Math.PI / 180;
    ctx.beginPath();
    ctx.arc(c.x, c.y, radius, start, end, angle > 0);
    ctx.stroke();

    // Panah searah gerakan di ujung busur.
    const tangent = end + (angle > 0 ? -Math.PI / 2 : Math.PI / 2);
    const tip = { x: c.x + radius * Math.cos(end), y: c.y + radius * Math.sin(end) };
    const dash = ctx.getLineDash();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(tip.x - 9 * Math.cos(tangent - 0.45), tip.y - 9 * Math.sin(tangent - 0.45));
    ctx.lineTo(tip.x - 9 * Math.cos(tangent + 0.45), tip.y - 9 * Math.sin(tangent + 0.45));
    ctx.closePath();
    ctx.fill();
    ctx.setLineDash(dash);
}

// Garis cermin sebagai dua titik dunia jauh di luar layar.
function getMirrorLine(params) {
    const far = (Math.max(canvasWidth, canvasHeight) / viewScale) * 2 + Math.hypot(viewOffsetX, viewOffsetY);
    const { axis, m, c, k } = params;
    if (axis === 'x') return [{ x: -far, y: 0 }, { x: far, y: 0 }];
    if (axis === 'y') return [{ x: 0, y: -far }, { x: 0, y: far }];
    if (axis === 'y=x') return [{ x: -far, y: -far }, { x: far, y: far }];
    if (axis === 'y=-x') return [{ x: -far, y: far }, { x: far, y: -far }];
    if (axis === 'x=h') return [{ x: k, y: -far }, { x: k, y: far }];
    if (axis === 'y=k') return [{ x: -far, y: k }, { x: far, y: k }];
    const dx = far / Math.sqrt(1 + m * m);
    return [{ x: -dx, y: -m * dx + c }, { x: dx, y: m * dx + c }];
}

function drawHelpers() {
    const params = getTransformParams(currentTransform);
    ctx.save();
    const helperColor = palette().helpers[currentTransform];
    ctx.strokeStyle = helperColor;
    ctx.fillStyle = helperColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);

    // Pratinjau parameter aktif: garis cermin atau titik pusat.
    if (currentTransform === 'reflection') {
        const [a, b] = getMirrorLine(params);
        drawDashedSegment(a, b);
    } else if (currentTransform === 'rotation' || currentTransform === 'dilation') {
        drawCenterMarker({ x: params.centerX, y: params.centerY }, 'O');
    }

    // Garis bantu antara titik asli dan bayangannya.
    if (resultMeta && !animation && transformedPoints.length === points.length) {
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        points.forEach((p, i) => {
            const image = transformedPoints[i];
            if (resultMeta.transform === 'rotation' && resultMeta.params) {
                drawRotationArc(resultMeta.center, p, resultMeta.params.angle);
            } else if (resultMeta.center) {
                drawDashedSegment(resultMeta.center, p);
                drawDashedSegment(resultMeta.center, image);
            } else {
                drawDashedSegment(p, image);
                if (resultMeta.transform === 'translation') drawArrowHead(p, image);
            }
        });
    }
    ctx.restore();
}

// ==================== PRATINJAU DAN ANIMASI ====================

function sameParams(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

// Bayangan sementara dari parameter yang sedang diatur. Tidak digambar bila
// hasil yang sudah diterapkan memakai parameter yang sama persis.
function previewPoints() {
    if (!points.length || animation) return null;
    const params = getTransformParams(currentTransform);
    if (currentTransform === 'dilation' && params.factor === 0) return null;
    if (resultMeta && resultMeta.transform === currentTransform && sameParams(resultMeta.params, params)) return null;
    return GeometryTransformations.apply(points, currentTransform, params);
}

function prefersReducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function animationPoints() {
    const progress = Math.min(1, (performance.now() - animation.start) / ANIMATION_MS);
    return GeometryTransformations.interpolate(animation.from, animation.type, animation.params, easeInOutCubic(progress));
}

function startAnimation(type, params) {
    stopAnimation();
    if (prefersReducedMotion() || !points.length) return;
    animation = { from: clonePoints(points), type, params, start: performance.now(), frame: 0 };
    const step = (now) => {
        if (!animation) return;
        if (now - animation.start >= ANIMATION_MS) {
            animation = null;
            drawNow();
            return;
        }
        drawNow();
        animation.frame = requestAnimationFrame(step);
    };
    animation.frame = requestAnimationFrame(step);
}

function stopAnimation() {
    if (!animation) return;
    cancelAnimationFrame(animation.frame);
    animation = null;
}

function drawNow() {
    if (redrawFrame) {
        cancelAnimationFrame(redrawFrame);
        redrawFrame = 0;
    }
    drawGridAndAxes();
    drawHelpers();
    const preview = previewPoints();
    if (preview) drawShape(preview, palette().result, { preview: true });
    drawShape(points, palette().original);
    const resultPoints = animation ? animationPoints() : transformedPoints;
    drawShape(resultPoints, palette().result);
    drawHighlight(resultPoints);
    drawPointLabels(animation ? [] : transformedPoints);
}

function redrawCanvas() {
    if (redrawFrame) return;
    redrawFrame = requestAnimationFrame(() => {
        redrawFrame = 0;
        drawNow();
    });
}

// ==================== PARAMETER TRANSFORMASI ====================

function numberValue(id, fallback = 0) {
    const value = parseFloat($(id).value);
    return Number.isFinite(value) ? value : fallback;
}

function getTransformParams(type) {
    switch (type) {
        case 'reflection':
            return {
                axis: $('reflectionAxis').value,
                m: numberValue('reflectionM', 1),
                c: numberValue('reflectionC'),
                k: numberValue('reflectionK')
            };
        case 'rotation':
            return { angle: numberValue('rotationAngle'), centerX: numberValue('rotationCenterX'), centerY: numberValue('rotationCenterY') };
        case 'dilation':
            return { factor: numberValue('scaleFactor', 1), centerX: numberValue('dilationCenterX'), centerY: numberValue('dilationCenterY') };
        case 'translation':
            return { tx: numberValue('translationX'), ty: numberValue('translationY') };
        default:
            return {};
    }
}

function showTransformParams(transformType) {
    document.querySelectorAll('.transform-params').forEach(param => {
        param.classList.toggle('hidden', param.id !== `${transformType}-params`);
    });
}

// Sinkronkan teks nilai slider dan kolom parameter refleksi yang relevan.
function syncParamDisplays() {
    const axis = $('reflectionAxis').value;
    $('customReflectionParams').classList.toggle('hidden', axis !== 'custom');
    $('lineConstantParams').classList.toggle('hidden', axis !== 'x=h' && axis !== 'y=k');
    $('reflectionKLabel').textContent = axis === 'y=k' ? 'Nilai k:' : 'Nilai h:';

    $('reflectionMValue').textContent = formatCoordinate(numberValue('reflectionM', 1));
    $('reflectionCValue').textContent = formatCoordinate(numberValue('reflectionC'));
    $('rotationAngleValue').textContent = `${formatCoordinate(numberValue('rotationAngle'))}°`;
    $('scaleFactorValue').textContent = formatCoordinate(numberValue('scaleFactor', 1));
    document.querySelectorAll('.range-input').forEach(positionRangeBubble);

    document.querySelectorAll('input[name="reflectionAxisChoice"]').forEach(radio => {
        radio.checked = radio.value === axis;
        radio.closest('.axis-option').classList.toggle('is-selected', radio.checked);
    });
    document.querySelectorAll('.quick-value').forEach(button => {
        const selected = numberValue(button.dataset.target) === Number(button.dataset.value);
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', String(selected));
    });
}

// Letakkan gelembung nilai tepat di atas pegangan slider (lebar pegangan ±16px).
function positionRangeBubble(input) {
    const bubble = input.parentElement.querySelector('.range-bubble');
    if (!bubble) return;
    const min = Number(input.min);
    const max = Number(input.max);
    const ratio = max > min ? (Number(input.value) - min) / (max - min) : 0;
    bubble.style.left = `calc(${ratio * 100}% + ${(0.5 - ratio) * 16}px)`;
}

function computeTransform(type, params) {
    return GeometryTransformations.apply(points, type, params);
}

function applyTransform() {
    if (points.length === 0) {
        showMessage('Tambahkan titik terlebih dahulu!', 'error');
        return;
    }
    const params = getTransformParams(currentTransform);
    if (currentTransform === 'dilation' && params.factor === 0) {
        showMessage('Faktor dilatasi tidak boleh 0', 'error');
        return;
    }

    transformedPoints = computeTransform(currentTransform, params);
    const hasCenter = currentTransform === 'rotation' || currentTransform === 'dilation';
    const center = hasCenter ? { x: params.centerX, y: params.centerY } : null;
    resultMeta = { transform: currentTransform, center, params };
    saveHistory();

    ensureVisible(center ? [center] : []);
    startAnimation(currentTransform, params);
    if (smallScreen.matches) {
        setSheetExpanded(false);
        revealCanvas();
    }
    redrawCanvas();
    updateCoordinateTable();
    showMessage(`Transformasi ${transformNames[currentTransform]} berhasil diterapkan!`, 'success');
}

// ==================== MANAJEMEN TITIK ====================

function setShape(newPoints, closed) {
    points = clonePoints(newPoints);
    transformedPoints = [];
    resultMeta = null;
    isPolygonClosed = closed;
    saveHistory();
    ensureVisible();
    redrawCanvas();
    updateCoordinateTable();
}

function clearPoints() {
    setShape([], false);
    showMessage('Semua titik telah dihapus', 'success');
}

function closePolygon() {
    if (points.length < 3) {
        showMessage('Minimal 3 titik untuk membuat poligon!', 'error');
        return;
    }
    isPolygonClosed = true;
    saveHistory();
    redrawCanvas();
    showMessage('Poligon telah ditutup', 'success');
}

function resetTransform() {
    transformedPoints = [];
    resultMeta = null;
    saveHistory();
    redrawCanvas();
    updateCoordinateTable();
    showMessage('Transformasi telah direset', 'success');
}

const presets = {
    triangle: [{ x: -3, y: -2 }, { x: 0, y: 4 }, { x: 3, y: -2 }],
    square: [{ x: -3, y: -3 }, { x: 3, y: -3 }, { x: 3, y: 3 }, { x: -3, y: 3 }],
    pentagon: [{ x: -3, y: 2 }, { x: 0, y: 5 }, { x: 3, y: 2 }, { x: 2, y: -1 }, { x: -2, y: -1 }]
};

const presetNames = { triangle: 'segitiga', square: 'persegi', pentagon: 'segilima' };

function loadPreset(name) {
    const key = presets[name] ? name : 'pentagon';
    setShape(presets[key], true);
    showMessage(`Contoh bentuk ${presetNames[key]} telah dibuat`, 'success');
}

// ==================== BOTTOM SHEET (LAYAR KECIL) ====================

function setSheetExpanded(expanded) {
    controlPanel.classList.toggle('is-collapsed', !expanded);
    sheetToggle.setAttribute('aria-expanded', String(expanded));
    document.body.classList.toggle('sheet-open', expanded);
}

// Di layar kecil, pastikan kanvas terlihat agar animasi hasil tidak terlewat.
function revealCanvas() {
    // Seluruh kotak kanvas (termasuk label status di atasnya) harus terlihat.
    const shell = canvas.closest('.canvas-shell') || canvas;
    const rect = shell.getBoundingClientRect();
    const sheetTop = smallScreen.matches ? controlPanel.getBoundingClientRect().top : window.innerHeight;
    if (rect.top >= 0 && rect.bottom <= sheetTop) return;
    shell.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

function createCell(text, extraClass = '') {
    const cell = document.createElement('td');
    cell.textContent = text;
    cell.className = `py-2 sm:py-3 px-3 sm:px-4 text-blue-100 ${extraClass}`.trim();
    return cell;
}

function updateCoordinateTable() {
    const format = (p) => (p ? `(${formatCoordinate(p.x)}, ${formatCoordinate(p.y)})` : '-');
    const maxRows = Math.max(points.length, transformedPoints.length);
    const fragment = document.createDocumentFragment();

    if (maxRows === 0) {
        const row = document.createElement('tr');
        const cell = createCell('Belum ada titik. Klik kanvas atau gunakan input manual di atas.', 'py-4 sm:py-6 text-center text-blue-300');
        cell.colSpan = 3;
        row.appendChild(cell);
        fragment.appendChild(row);
    }
    for (let i = 0; i < maxRows; i++) {
        const row = document.createElement('tr');
        row.dataset.index = String(i);
        if (i === hoveredIndex) row.classList.add('is-highlighted');
        row.appendChild(createCell(`P${i + 1}`, 'font-medium'));
        row.appendChild(createCell(format(points[i])));
        row.appendChild(createCell(format(transformedPoints[i])));
        fragment.appendChild(row);
    }
    coordinateTableBody.replaceChildren(fragment);
    updateFormula();
}

// ==================== KARTU RUMUS ====================

function matrixElement(rows) {
    const element = document.createElement('span');
    element.className = 'matrix';
    element.style.gridTemplateColumns = `repeat(${rows[0].length}, auto)`;
    rows.flat().forEach(value => {
        const cell = document.createElement('span');
        cell.textContent = typeof value === 'number' ? formatCoordinate(value) : value;
        element.appendChild(cell);
    });
    return element;
}

// (x', y') = M·(x, y) + t, disusun sebagai matriks kolom agar mudah dibaca.
function renderMatrix(container, form) {
    container.replaceChildren();
    if (!form) {
        container.textContent = '-';
        return;
    }
    const symbol = (text) => {
        const span = document.createElement('span');
        span.className = 'matrix-symbol';
        span.textContent = text;
        return span;
    };
    container.append(
        matrixElement([["x'"], ["y'"]]),
        symbol(form.exact ? '=' : '≈'),
        matrixElement(form.matrix),
        matrixElement([['x'], ['y']])
    );
    if (form.translation) {
        container.append(symbol('+'), matrixElement([[form.translation[0]], [form.translation[1]]]));
    }
}

function updateFormula() {
    const params = getTransformParams(currentTransform);
    const general = generalRule(currentTransform, params);
    formulaEls.title.textContent = transformNames[currentTransform];
    formulaEls.general.textContent = general.rule;
    formulaEls.note.textContent = general.note;

    const invalid = currentTransform === 'dilation' && params.factor === 0;
    const coefficients = affineCoefficients(p => GeometryTransformations.apply([p], currentTransform, params)[0]);
    formulaEls.specific.textContent = invalid ? 'Faktor k tidak boleh 0' : formatAffineRule(coefficients);
    renderMatrix(formulaEls.matrix, invalid ? null : affineMatrix(coefficients));

    const example = formulaEls.example;
    example.replaceChildren();
    if (!points.length || invalid) {
        const empty = document.createElement('span');
        empty.className = 'formula-example-empty';
        empty.textContent = invalid ? '-' : 'Tambahkan titik untuk melihat contoh perhitungan.';
        example.appendChild(empty);
        return;
    }
    const image = GeometryTransformations.apply([points[0]], currentTransform, params)[0];
    const format = (name, p) => `${name}(${formatCoordinate(p.x)}, ${formatCoordinate(p.y)})`;
    const original = document.createElement('span');
    original.className = 'formula-example-original';
    original.textContent = format('P1', points[0]);
    const result = document.createElement('span');
    result.className = 'formula-example-result';
    result.textContent = format("P'1", image);
    example.append(original, ' → ', result);
}

// ==================== TEMA TERANG/GELAP ====================

const themeToggle = $('themeToggle');

function applyTheme(theme, { persist = false } = {}) {
    document.documentElement.dataset.theme = theme;
    const next = theme === 'light' ? 'gelap' : 'terang';
    themeToggle.setAttribute('aria-label', `Ganti ke tema ${next}`);
    themeToggle.querySelector('i').className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f1f5f9' : '#0b1120');
    if (persist) {
        try {
            localStorage.setItem('theme', theme);
        } catch {
            // Penyimpanan tidak tersedia (mis. mode privat); tema tetap berlaku sampai halaman ditutup.
        }
    }
    drawNow();
}

function storedTheme() {
    try {
        return localStorage.getItem('theme');
    } catch {
        return null;
    }
}

function initTheme() {
    applyTheme(currentTheme());
    themeToggle.addEventListener('click', () => {
        applyTheme(currentTheme() === 'light' ? 'dark' : 'light', { persist: true });
        showMessage(`Tema ${currentTheme() === 'light' ? 'terang' : 'gelap'} aktif`, 'success');
    });
    // Ikuti perubahan tema sistem selama pengguna belum memilih sendiri.
    const query = window.matchMedia('(prefers-color-scheme: light)');
    query.addEventListener('change', (event) => {
        if (!storedTheme()) applyTheme(event.matches ? 'light' : 'dark');
    });
}

// ==================== LATIHAN ====================

const practice = { question: null, attempted: false, correct: 0, total: 0 };

function renderPracticeQuestion() {
    const { question } = practice;
    const text = $('practiceQuestion');
    text.replaceChildren();
    // Sorot nama titik agar soal mudah dipindai.
    const [before, after] = question.text.split(/A\([^)]*\)/);
    const name = document.createElement('strong');
    name.textContent = `A(${formatCoordinate(question.point.x)}, ${formatCoordinate(question.point.y)})`;
    text.append(before, name, after);
}

function newPracticeQuestion() {
    practice.question = createQuestion();
    practice.attempted = false;
    renderPracticeQuestion();
    $('practiceAnswer').value = '';
    setPracticeFeedback('', '');
}

function setPracticeFeedback(message, state) {
    const feedback = $('practiceFeedback');
    feedback.textContent = message;
    feedback.classList.toggle('is-correct', state === 'correct');
    feedback.classList.toggle('is-wrong', state === 'wrong');
}

function updatePracticeScore() {
    $('practiceScore').textContent = `Benar ${practice.correct} dari ${practice.total}`;
}

function checkPracticeAnswer() {
    const { question } = practice;
    const result = checkAnswer(question, $('practiceAnswer').value);
    if (!result.valid) {
        setPracticeFeedback('Tulis jawaban sebagai koordinat, mis. (2, -3).', 'wrong');
        return;
    }
    // Skor dihitung dari percobaan pertama setiap soal.
    if (!practice.attempted) {
        practice.attempted = true;
        practice.total += 1;
        if (result.correct) practice.correct += 1;
        updatePracticeScore();
    }
    const answer = `A'(${formatCoordinate(question.answer.x)}, ${formatCoordinate(question.answer.y)})`;
    if (result.correct) {
        setPracticeFeedback(`Benar! Bayangannya ${answer}.`, 'correct');
    } else {
        const rule = generalRule(question.type, question.params);
        setPracticeFeedback(`Belum tepat. Petunjuk: ${rule.rule}${rule.note ? ` dengan ${rule.note}` : ''}.`, 'wrong');
    }
}

// Tampilkan soal di kanvas: titik A, tab dan parameter yang sesuai, lalu terapkan.
function showPracticeOnCanvas() {
    const { question } = practice;
    const { params } = question;
    const set = (id, value) => { $(id).value = String(value); };
    if (question.type === 'reflection') {
        set('reflectionAxis', params.axis);
        set('reflectionK', params.k);
    } else if (question.type === 'rotation') {
        set('rotationAngle', params.angle);
        set('rotationCenterX', params.centerX);
        set('rotationCenterY', params.centerY);
    } else if (question.type === 'dilation') {
        set('scaleFactor', params.factor);
        set('dilationCenterX', params.centerX);
        set('dilationCenterY', params.centerY);
    } else {
        set('translationX', params.tx);
        set('translationY', params.ty);
    }
    const tab = transformTabs.find(item => item.dataset.transform === question.type);
    setActiveTab(tab);
    handleParamChange();
    setShape([question.point], false);
    applyTransform();
    revealCanvas();
}

function initPractice() {
    $('practiceCheck').addEventListener('click', checkPracticeAnswer);
    $('practiceAnswer').addEventListener('keydown', (event) => {
        if (event.key === 'Enter') checkPracticeAnswer();
    });
    $('practiceNext').addEventListener('click', newPracticeQuestion);
    $('practiceShow').addEventListener('click', showPracticeOnCanvas);
    newPracticeQuestion();
}

// ==================== TOMBOL BERBAGI ====================

function initShareButtons() {
    const shareText = '🔷 Aplikasi Geometri Transformasi 📐\n\nBelajar transformasi geometri (refleksi, rotasi, dilatasi, translasi) dengan visualisasi interaktif dan real-time.\n\n✨ Fitur:\n• Visualisasi interaktif\n• 4 jenis transformasi\n• Input koordinat manual\n• Tabel hasil transformasi\n\n';
    const twitterText = '🔷 Aplikasi Geometri Transformasi 📐\n\nBelajar transformasi geometri dengan visualisasi interaktif!\n\n✨ Refleksi • Rotasi • Dilatasi • Translasi\n\n';
    // URL dibaca saat diklik agar hash tab yang aktif ikut terbagikan.
    const shareTargets = {
        'share-whatsapp': (url) => `https://wa.me/?text=${encodeURIComponent(shareText + url)}`,
        'share-facebook': (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        'share-twitter': (url) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(twitterText)}`,
        'share-telegram': (url) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`
    };
    Object.entries(shareTargets).forEach(([id, buildUrl]) => {
        $(id).addEventListener('click', (e) => {
            e.preventDefault();
            window.open(buildUrl(window.location.href), '_blank', 'noopener,noreferrer');
        });
    });

    const copyButton = $('share-copy');
    copyButton.addEventListener('click', async (e) => {
        e.preventDefault();
        const fullText = shareText + window.location.href;
        try {
            if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard API tidak tersedia');
            await navigator.clipboard.writeText(fullText);
        } catch {
            if (!legacyCopy(fullText)) {
                showMessage('Gagal menyalin tautan', 'error');
                return;
            }
        }
        const iconLink = copyButton.querySelector('.fa-link');
        const iconCheck = copyButton.querySelector('.fa-check');
        if (iconLink && iconCheck) {
            iconLink.classList.add('hidden');
            iconCheck.classList.remove('hidden');
            setTimeout(() => {
                iconCheck.classList.add('hidden');
                iconLink.classList.remove('hidden');
            }, 2000);
        }
        showMessage('Tautan berhasil disalin!', 'success');
    });
}

function legacyCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    let ok = false;
    try {
        ok = document.execCommand('copy');
    } catch {
        ok = false;
    }
    textArea.remove();
    return ok;
}

// ==================== KEMBALI KE ATAS ====================

function initBackToTop() {
    const backToTopBtn = $('backToTop');
    let ticking = false;
    function updateBackToTop() {
        backToTopBtn.classList.toggle('show', window.scrollY > 300);
        ticking = false;
    }
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(updateBackToTop);
            ticking = true;
        }
    }, { passive: true });

    backToTopBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
}

// ==================== MODE OFFLINE (SERVICE WORKER) ====================

// Di localhost SW tidak dipasang agar perubahan saat pengembangan langsung
// terlihat; tambahkan ?sw pada URL untuk mengujinya secara lokal.
function shouldRegisterServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return false;
    const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    return !isLocal || new URLSearchParams(location.search).has('sw');
}

function registerServiceWorker() {
    if (!shouldRegisterServiceWorker()) return;
    // Muat ulang hanya bila pengguna meminta pembaruan. controllerchange juga
    // terjadi saat SW pertama kali mengambil alih (clients.claim), dan saat itu
    // halaman tidak boleh dimuat ulang agar pekerjaan di kanvas tidak hilang.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (updateRequested) location.reload();
    });

    navigator.serviceWorker.register('sw.js').then((registration) => {
        const offerUpdate = (worker) => {
            if (worker && navigator.serviceWorker.controller) showUpdateBanner(worker);
        };
        offerUpdate(registration.waiting);
        registration.addEventListener('updatefound', () => {
            const worker = registration.installing;
            if (!worker) return;
            worker.addEventListener('statechange', () => {
                if (worker.state === 'installed') offerUpdate(worker);
            });
        });
    }).catch((error) => console.error('Service worker gagal didaftarkan:', error));
}

let updateRequested = false;

// Versi baru tidak langsung diaktifkan agar pekerjaan di kanvas tidak hilang
// tiba-tiba; pengguna memilih kapan memuat ulang.
function showUpdateBanner(worker) {
    if (document.getElementById('updateBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'updateBanner';
    banner.className = 'update-banner';
    banner.setAttribute('role', 'status');

    const text = document.createElement('span');
    text.textContent = 'Versi baru aplikasi tersedia.';
    const reloadButton = document.createElement('button');
    reloadButton.type = 'button';
    reloadButton.textContent = 'Muat ulang';
    reloadButton.addEventListener('click', () => {
        reloadButton.disabled = true;
        updateRequested = true;
        worker.postMessage('SKIP_WAITING');
    });
    const dismissButton = document.createElement('button');
    dismissButton.type = 'button';
    dismissButton.className = 'update-banner-dismiss';
    dismissButton.setAttribute('aria-label', 'Nanti saja');
    dismissButton.textContent = '×';
    dismissButton.addEventListener('click', () => banner.remove());

    banner.append(text, reloadButton, dismissButton);
    document.body.appendChild(banner);
}

// ==================== INISIALISASI ====================

document.addEventListener('DOMContentLoaded', () => {
    try {
        init();
    } catch (error) {
        console.error('Error saat inisialisasi:', error);
        showMessage('Terjadi kesalahan saat memuat aplikasi. Silakan refresh halaman.', 'error');
    }
});
