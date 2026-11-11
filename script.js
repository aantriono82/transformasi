// ==================== DEKLARASI ELEMEN DOM ====================
const { parsePointInput, formatCoordinate, niceStep, wheelZoomFactor, fitView, describeTransform } = AppUtils;

const canvas = document.getElementById('transformCanvas');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);
const applyButton = $('applyTransform');
const clearButton = $('clearPoints');
const closePolygonButton = $('closePolygon');
const resetButton = $('resetTransform');
const sampleButton = $('sampleShape');
const coordinateTableBody = $('coordinateTableBody');
const resetViewButton = $('resetView');
const zoomInButton = $('zoomIn');
const zoomOutButton = $('zoomOut');
const manualPointInput = $('manualPointInput');
const addManualPointButton = $('addManualPoint');
const loadPresetButton = $('loadPreset');
const shapePreset = $('shapePreset');
const undoButton = $('undoAction');
const redoButton = $('redoAction');
const exportButton = $('exportCanvas');
const helpBtn = $('helpBtn');
const helpModal = $('helpModal');
const announcer = $('srAnnouncer');

// ==================== VARIABEL GLOBAL ====================
let points = [];
let transformedPoints = [];
// Info transformasi yang menghasilkan transformedPoints (jenis dan pusatnya).
let resultMeta = null;
let isPolygonClosed = false;
let currentTransform = 'reflection';
let history = [];
let historyIndex = -1;

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
const COLORS = {
    original: '#2196f3',
    result: '#ff9800',
    helper: '#9333ea',
    axis: '#333'
};
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

function worldToScreen(worldX, worldY) {
    return {
        x: canvasWidth / 2 + (worldX - viewOffsetX) * viewScale,
        y: canvasHeight / 2 - (worldY - viewOffsetY) * viewScale
    };
}

function screenToWorld(screenX, screenY) {
    return {
        x: viewOffsetX + (screenX - canvasWidth / 2) / viewScale,
        y: viewOffsetY - (screenY - canvasHeight / 2) / viewScale
    };
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
    initBackToTop();

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
    sampleButton.addEventListener('click', createSampleShape);
    loadPresetButton.addEventListener('click', loadSelectedPreset);
    undoButton.addEventListener('click', undo);
    redoButton.addEventListener('click', redo);
    exportButton.addEventListener('click', exportCanvasImage);
    resetViewButton.addEventListener('click', resetView);
    zoomInButton.addEventListener('click', () => zoomAt(1.25));
    zoomOutButton.addEventListener('click', () => zoomAt(0.8));

    addManualPointButton.addEventListener('click', addManualPoint);
    manualPointInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addManualPoint();
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
    history = history.slice(0, historyIndex + 1);
    history.push({
        points: clonePoints(points),
        transformedPoints: clonePoints(transformedPoints),
        resultMeta: resultMeta && { ...resultMeta },
        isPolygonClosed,
        transform: currentTransform
    });
    historyIndex = history.length - 1;
    updateHistoryButtons();
}

function restoreHistory(index) {
    const snapshot = history[index];
    if (!snapshot) return;
    points = clonePoints(snapshot.points);
    transformedPoints = clonePoints(snapshot.transformedPoints);
    resultMeta = snapshot.resultMeta && { ...snapshot.resultMeta };
    isPolygonClosed = snapshot.isPolygonClosed;
    historyIndex = index;

    // Hasil transformasi selalu ditampilkan di tab yang menghasilkannya.
    const tabTransform = resultMeta ? resultMeta.transform : snapshot.transform;
    const tab = transformTabs.find(item => item.dataset.transform === tabTransform);
    if (tab && tabTransform !== currentTransform) setActiveTab(tab, { keepResult: true });

    redrawCanvas();
    updateCoordinateTable();
    updateHistoryButtons();
}

function updateHistoryButtons() {
    undoButton.disabled = historyIndex <= 0;
    redoButton.disabled = historyIndex >= history.length - 1;
}

function undo() {
    if (historyIndex > 0) {
        restoreHistory(historyIndex - 1);
        showMessage('Perubahan terakhir dibatalkan', 'success');
    }
}

function redo() {
    if (historyIndex < history.length - 1) {
        restoreHistory(historyIndex + 1);
        showMessage('Perubahan dipulihkan', 'success');
    }
}

function exportCanvasImage() {
    drawNow();
    // Gabungkan dengan latar putih agar PNG terbaca di penampil bertema gelap.
    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    const outputCtx = output.getContext('2d');
    outputCtx.fillStyle = '#ffffff';
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
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

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
            ctx.strokeStyle = isMajor ? 'rgba(160, 160, 160, 0.6)' : 'rgba(200, 200, 200, 0.4)';
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
    ctx.strokeStyle = COLORS.axis;
    ctx.fillStyle = COLORS.axis;
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
    const isSuccess = type === 'success';
    messageElement.style.cssText = `
        position: fixed;
        padding: 15px 20px;
        border-radius: 8px;
        font-weight: 600;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        color: white;
        background-color: ${isSuccess ? 'rgba(46, 125, 50, 0.95)' : 'rgba(198, 40, 40, 0.95)'};
        border-left: 5px solid ${isSuccess ? '#4CAF50' : '#F44336'};
    `;
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

    if (activePointers.size === 1) {
        startPan(position);
        // Hanya klik kiri / ketukan satu jari yang menambah titik.
        tapCandidate = (event.pointerType !== 'mouse' || event.button === 0)
            ? { id: event.pointerId, x: position.x, y: position.y }
            : null;
    } else if (activePointers.size === 2) {
        tapCandidate = null;
        startPinch();
    }
}

function handlePointerMove(event) {
    if (!activePointers.has(event.pointerId)) return;
    event.preventDefault();
    const position = pointerPosition(event);
    activePointers.set(event.pointerId, position);

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

function drawShape(shapePoints, color, labelPrefix, labelOffsetY) {
    if (!shapePoints.length) return;
    const screenPoints = shapePoints.map(p => worldToScreen(p.x, p.y));

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);

    if (screenPoints.length > 1) {
        ctx.beginPath();
        screenPoints.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        if (isPolygonClosed && screenPoints.length > 2) ctx.closePath();
        ctx.stroke();
    }

    ctx.font = `bold 14px ${CANVAS_FONT}`;
    ctx.textAlign = 'left';
    screenPoints.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        const point = shapePoints[i];
        ctx.fillText(`${labelPrefix}${i + 1}(${formatCoordinate(point.x)}, ${formatCoordinate(point.y)})`, p.x + 8, p.y + labelOffsetY);
    });
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
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.stroke();
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
    ctx.strokeStyle = COLORS.helper;
    ctx.fillStyle = COLORS.helper;
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
    if (resultMeta && transformedPoints.length === points.length) {
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        points.forEach((p, i) => {
            const image = transformedPoints[i];
            if (resultMeta.center) {
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

function drawNow() {
    if (redrawFrame) {
        cancelAnimationFrame(redrawFrame);
        redrawFrame = 0;
    }
    drawGridAndAxes();
    drawHelpers();
    drawShape(points, COLORS.original, 'P', -8);
    drawShape(transformedPoints, COLORS.result, "P'", 20);
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
}

function computeTransform(type, params) {
    const T = GeometryTransformations;
    switch (type) {
        case 'reflection': return T.reflect(points, params.axis, params);
        case 'rotation': return T.rotate(points, params.angle, params.centerX, params.centerY);
        case 'dilation': return T.dilate(points, params.factor, params.centerX, params.centerY);
        case 'translation': return T.translate(points, params.tx, params.ty);
        default: return [];
    }
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
    resultMeta = { transform: currentTransform, center };
    saveHistory();

    ensureVisible(center ? [center] : []);
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

function createSampleShape() {
    setShape(presets.pentagon, true);
    showMessage('Contoh bentuk segilima telah dibuat', 'success');
}

function loadSelectedPreset() {
    setShape(presets[shapePreset.value] || presets.pentagon, true);
    showMessage('Preset bentuk berhasil dimuat', 'success');
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
        row.appendChild(createCell(`P${i + 1}`, 'font-medium'));
        row.appendChild(createCell(format(points[i])));
        row.appendChild(createCell(format(transformedPoints[i])));
        fragment.appendChild(row);
    }
    coordinateTableBody.replaceChildren(fragment);
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
        const iconCheck = copyButton.querySelector('.fa-check');
        if (iconCheck) {
            iconCheck.classList.remove('hidden');
            setTimeout(() => iconCheck.classList.add('hidden'), 2000);
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

// ==================== INISIALISASI ====================

document.addEventListener('DOMContentLoaded', () => {
    try {
        init();
    } catch (error) {
        console.error('Error saat inisialisasi:', error);
        showMessage('Terjadi kesalahan saat memuat aplikasi. Silakan refresh halaman.', 'error');
    }
});
