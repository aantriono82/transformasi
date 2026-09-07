// ==================== DEKLARASI ELEMEN DOM ====================
const canvas = document.getElementById('transformCanvas');
const ctx = canvas.getContext('2d');
const applyButton = document.getElementById('applyTransform');
const clearButton = document.getElementById('clearPoints');
const closePolygonButton = document.getElementById('closePolygon');
const resetButton = document.getElementById('resetTransform');
const sampleButton = document.getElementById('sampleShape');
const coordinateTableBody = document.getElementById('coordinateTableBody');
const resetViewButton = document.getElementById('resetView');
const zoomInButton = document.getElementById('zoomIn');
const zoomOutButton = document.getElementById('zoomOut');
const manualPointInput = document.getElementById('manualPointInput');
const addManualPointButton = document.getElementById('addManualPoint');
const loadPresetButton = document.getElementById('loadPreset');
const shapePreset = document.getElementById('shapePreset');
const undoButton = document.getElementById('undoAction');
const redoButton = document.getElementById('redoAction');
const exportButton = document.getElementById('exportCanvas');
const helpBtn = document.getElementById('helpBtn');
const helpModal = document.getElementById('helpModal');

// ==================== VARIABEL GLOBAL ====================
let points = [];
let transformedPoints = [];
let isPolygonClosed = false;
let currentTransform = 'reflection';
let history = [];
let historyIndex = -1;

// Variabel untuk transformasi view (pan dan zoom)
let viewOffsetX = 0;
let viewOffsetY = 0;
let viewScale = 10; // Skala awal (1 unit = 10 pixel)
const minScale = 2;
const maxScale = 50;

// Variabel untuk debounce resize
let resizeTimeout;
const transformLabels = {
    reflection: 'Refleksi terhadap sumbu X',
    rotation: 'Rotasi 90° dengan pusat (0, 0)',
    dilation: 'Dilatasi dengan faktor 2',
    translation: 'Translasi dengan vektor (50, 30)'
};
const transformNames = {
    reflection: 'refleksi',
    rotation: 'rotasi',
    dilation: 'dilatasi',
    translation: 'translasi'
};

// ==================== FUNGSI UTAMA ====================

// Fungsi untuk setup ukuran canvas
function setupCanvasSize() {
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

// Fungsi untuk mengubah koordinat dunia ke koordinat layar
function worldToScreen(worldX, worldY) {
    const canvasCenterX = canvas.offsetWidth / 2;
    const canvasCenterY = canvas.offsetHeight / 2;
    const screenX = canvasCenterX + (worldX - viewOffsetX) * viewScale;
    const screenY = canvasCenterY - (worldY - viewOffsetY) * viewScale;
    return { x: screenX, y: screenY };
}

// Fungsi untuk mengubah koordinat layar ke koordinat dunia
function screenToWorld(screenX, screenY) {
    const canvasCenterX = canvas.offsetWidth / 2;
    const canvasCenterY = canvas.offsetHeight / 2;
    const worldX = viewOffsetX + (screenX - canvasCenterX) / viewScale;
    const worldY = viewOffsetY - (screenY - canvasCenterY) / viewScale;
    return { x: worldX, y: worldY };
}

// Inisialisasi aplikasi
function init() {
    // Setup ukuran canvas pertama kali
    setupCanvasSize();
    drawGridAndAxes();
    updateCoordinateTable();
    
    // Setup event listeners
    setupEventListeners();
    setupHelpModal();
    
    // Set tombol refleksi sebagai aktif default
    const defaultTransformBtn = document.querySelector('[data-transform="reflection"]');
    if (defaultTransformBtn) {
        setActiveTransformButton(defaultTransformBtn);
        initShareButtons();
         initBackToTop();
    }
    
    // Buat contoh bentuk awal
    createSampleShape();
}

// ==================== FUNGSI TOMBOL TRANSFORMASI ====================

// Fungsi untuk mengatur tombol transformasi aktif
function setActiveTransformButton(button) {
    // Hapus kelas active dari semua tombol
    document.querySelectorAll('.transform-btn').forEach(btn => {
        btn.classList.remove('active-transform', 'border-secondary-500');
        btn.classList.add('border-transparent');
        btn.setAttribute('aria-pressed', 'false');
    });
    
    // Tambahkan kelas active ke tombol yang diklik
    button.classList.remove('border-transparent');
    button.classList.add('active-transform', 'border-secondary-500');
    button.setAttribute('aria-pressed', 'true');
    
    // Tampilkan parameter yang sesuai
    currentTransform = button.dataset.transform;
    showTransformParams(currentTransform);
    updateTransformStatus();
}

function updateTransformStatus() {
    const status = document.querySelector('.canvas-status');
    if (status) status.textContent = transformLabels[currentTransform] || 'Transformasi aktif';
}

// ==================== FUNGSI MODAL PETUNJUK ====================

// Fungsi untuk menampilkan modal petunjuk
function showHelpModal() {
    helpModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    const closeBtn = helpModal.querySelector('.close-modal');
    if (closeBtn) closeBtn.focus();
}

// Fungsi untuk menyembunyikan modal petunjuk
function hideHelpModal() {
    helpModal.classList.add('hidden');
    document.body.style.overflow = 'auto';
    if (helpBtn) helpBtn.focus();
}

// Fungsi untuk setup modal petunjuk
function setupHelpModal() {
    const closeBtn = helpModal.querySelector('.close-modal');
    const closeBtnFooter = helpModal.querySelector('.btn-close-modal');
    
    // Event listener untuk tombol petunjuk
    helpBtn.addEventListener('click', showHelpModal);
    
    // Event listener untuk tombol tutup (X)
    closeBtn.addEventListener('click', hideHelpModal);
    
    // Event listener untuk tombol tutup di footer
    closeBtnFooter.addEventListener('click', hideHelpModal);
    
    // Tutup modal ketika klik di luar konten modal
    helpModal.addEventListener('click', (event) => {
        if (event.target === helpModal) {
            hideHelpModal();
        }
    });
    
    // Tutup modal dengan tombol ESC
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !helpModal.classList.contains('hidden')) {
            hideHelpModal();
        }
    });
}

// ==================== SETUP EVENT LISTENERS ====================

// Setup semua event listeners
function setupEventListeners() {
    // Satu alur pointer untuk mouse, touch, dan stylus.
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);
    canvas.addEventListener('wheel', handleCanvasWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Event listeners untuk tombol transformasi
    document.querySelectorAll('.transform-btn').forEach(button => {
        button.addEventListener('click', function() {
            setActiveTransformButton(this);
        });
    });
    
    // Event listeners untuk tombol aksi
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
    zoomInButton.addEventListener('click', () => zoom(1.2));
    zoomOutButton.addEventListener('click', () => zoom(0.8));
    
    // Event listeners untuk input titik manual
    addManualPointButton.addEventListener('click', addManualPoint);
    manualPointInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addManualPoint();
        }
    });

    // Event listeners untuk input range
    document.getElementById('reflectionM').addEventListener('input', updateReflectionParams);
    document.getElementById('reflectionC').addEventListener('input', updateReflectionParams);
    document.getElementById('rotationAngle').addEventListener('input', updateRotationParams);
    document.getElementById('scaleFactor').addEventListener('input', updateDilationParams);
    
    // Event listener untuk pilihan refleksi
    document.getElementById('reflectionAxis').addEventListener('change', toggleCustomReflection);
    
    // Event listener untuk resize window dengan debounce
    window.addEventListener('resize', handleWindowResize);
}

function clonePoints(value) {
    return value.map(point => ({ x: point.x, y: point.y }));
}

function saveHistory() {
    history = history.slice(0, historyIndex + 1);
    history.push({ points: clonePoints(points), transformedPoints: clonePoints(transformedPoints), isPolygonClosed });
    historyIndex = history.length - 1;
    updateHistoryButtons();
}

function restoreHistory(index) {
    const snapshot = history[index];
    if (!snapshot) return;
    points = clonePoints(snapshot.points);
    transformedPoints = clonePoints(snapshot.transformedPoints);
    isPolygonClosed = snapshot.isPolygonClosed;
    historyIndex = index;
    redrawCanvas();
    updateCoordinateTable();
    updateHistoryButtons();
}

function updateHistoryButtons() {
    if (undoButton) undoButton.disabled = historyIndex <= 0;
    if (redoButton) redoButton.disabled = historyIndex >= history.length - 1;
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
    const link = document.createElement('a');
    link.download = 'geometri-transformasi.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showMessage('Visualisasi berhasil diekspor', 'success');
}

// ==================== FUNGSI CANVAS DAN GRID ====================

// Grid size optimal
function getGridSize() {
    if (viewScale > 20) return 1;
    if (viewScale > 10) return 2;
    if (viewScale > 5) return 4;
    return 10;
}

// Fungsi untuk menentukan interval label
function getLabelInterval() {
    if (viewScale > 30) return 1;
    if (viewScale > 15) return 2;
    if (viewScale > 8) return 5;
    return 10;
}

// Gambar grid dan sumbu
function drawGridAndAxes() {
    // Bersihkan canvas
    ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    
    const labelInterval = getLabelInterval();
    
    const canvasCenterX = canvas.offsetWidth / 2;
    const canvasCenterY = canvas.offsetHeight / 2;
    
    const leftWorld = viewOffsetX - canvasCenterX / viewScale;
    const rightWorld = viewOffsetX + canvasCenterX / viewScale;
    const topWorld = viewOffsetY + canvasCenterY / viewScale;
    const bottomWorld = viewOffsetY - canvasCenterY / viewScale;
    
    // Gambar grid utama
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.4)';
    ctx.lineWidth = 0.5;
    
    // Garis vertikal grid
    for (let worldX = Math.floor(leftWorld); worldX <= Math.ceil(rightWorld); worldX += 1) {
        if (Math.abs(worldX) < 0.0001) continue;
        
        const screenPos = worldToScreen(worldX, 0);
        
        if (worldX % 5 === 0) {
            ctx.strokeStyle = 'rgba(180, 180, 180, 0.6)';
            ctx.lineWidth = 1;
        } else {
            ctx.strokeStyle = 'rgba(200, 200, 200, 0.4)';
            ctx.lineWidth = 0.5;
        }
        
        ctx.beginPath();
        ctx.moveTo(screenPos.x, 0);
        ctx.lineTo(screenPos.x, canvas.offsetHeight);
        ctx.stroke();
    }
    
    // Garis horizontal grid
    for (let worldY = Math.floor(bottomWorld); worldY <= Math.ceil(topWorld); worldY += 1) {
        if (Math.abs(worldY) < 0.0001) continue;
        
        const screenPos = worldToScreen(0, worldY);
        
        if (worldY % 5 === 0) {
            ctx.strokeStyle = 'rgba(180, 180, 180, 0.6)';
            ctx.lineWidth = 1;
        } else {
            ctx.strokeStyle = 'rgba(200, 200, 200, 0.4)';
            ctx.lineWidth = 0.5;
        }
        
        ctx.beginPath();
        ctx.moveTo(0, screenPos.y);
        ctx.lineTo(canvas.offsetWidth, screenPos.y);
        ctx.stroke();
    }
    
    // Gambar sumbu X dan Y
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    
    // Sumbu X
    const xAxisStart = worldToScreen(leftWorld, 0);
    const xAxisEnd = worldToScreen(rightWorld, 0);
    ctx.beginPath();
    ctx.moveTo(0, xAxisStart.y);
    ctx.lineTo(canvas.offsetWidth, xAxisEnd.y);
    ctx.stroke();
    
    // Sumbu Y
    const yAxisStart = worldToScreen(0, topWorld);
    const yAxisEnd = worldToScreen(0, bottomWorld);
    ctx.beginPath();
    ctx.moveTo(yAxisStart.x, 0);
    ctx.lineTo(yAxisEnd.x, canvas.offsetHeight);
    ctx.stroke();
    
    // Panah sumbu X
    ctx.beginPath();
    ctx.moveTo(canvas.offsetWidth - 10, xAxisEnd.y - 5);
    ctx.lineTo(canvas.offsetWidth, xAxisEnd.y);
    ctx.lineTo(canvas.offsetWidth - 10, xAxisEnd.y + 5);
    ctx.fillStyle = '#333';
    ctx.fill();
    
    // Panah sumbu Y
    ctx.beginPath();
    ctx.moveTo(yAxisStart.x - 5, 10);
    ctx.lineTo(yAxisStart.x, 0);
    ctx.lineTo(yAxisStart.x + 5, 10);
    ctx.fill();
    
    // Label sumbu
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('X', canvas.offsetWidth - 20, xAxisEnd.y - 10);
    ctx.fillText('Y', yAxisStart.x + 10, 20);
    
    // Label titik asal (0,0)
    const origin = worldToScreen(0, 0);
    if (origin.x > 15 && origin.x < canvas.offsetWidth - 15 && origin.y > 15 && origin.y < canvas.offsetHeight - 15) {
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('(0,0)', origin.x + 10, origin.y - 10);
    }
    
    // Gambar angka pada sumbu X
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    
    const startX = Math.ceil(leftWorld / labelInterval) * labelInterval;
    const endX = Math.floor(rightWorld / labelInterval) * labelInterval;
    
    for (let worldX = startX; worldX <= endX; worldX += labelInterval) {
        if (Math.abs(worldX) < 0.0001) continue;
        
        const screenPos = worldToScreen(worldX, 0);
        
        if (screenPos.x > 30 && screenPos.x < canvas.offsetWidth - 30) {
            ctx.beginPath();
            ctx.moveTo(screenPos.x, screenPos.y - 5);
            ctx.lineTo(screenPos.x, screenPos.y + 5);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.fillText(worldX.toString(), screenPos.x, screenPos.y + 20);
        }
    }
    
    // Gambar angka pada sumbu Y
    ctx.textAlign = 'right';
    
    const startY = Math.ceil(bottomWorld / labelInterval) * labelInterval;
    const endY = Math.floor(topWorld / labelInterval) * labelInterval;
    
    for (let worldY = startY; worldY <= endY; worldY += labelInterval) {
        if (Math.abs(worldY) < 0.0001) continue;
        
        const screenPos = worldToScreen(0, worldY);
        
        if (screenPos.y > 20 && screenPos.y < canvas.offsetHeight - 20) {
            ctx.beginPath();
            ctx.moveTo(screenPos.x - 5, screenPos.y);
            ctx.lineTo(screenPos.x + 5, screenPos.y);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.fillText(worldY.toString(), screenPos.x - 10, screenPos.y + 4);
        }
    }
}

// ==================== FUNGSI INPUT TITIK MANUAL ====================

// Fungsi untuk menambahkan titik manual
function addManualPoint() {
    const inputText = manualPointInput.value.trim();
    
    if (!inputText) {
        showMessage('Masukkan koordinat titik!', 'error');
        return;
    }
    
    const coordinates = parsePointInput(inputText);
    
    if (coordinates) {
        const { x, y } = coordinates;
        
        points.push({ x, y });
        isPolygonClosed = false;
        transformedPoints = [];
        saveHistory();
        
        manualPointInput.value = '';
        
        redrawCanvas();
        updateCoordinateTable();
        
        showMessage(`Titik (${Math.round(x)}, ${Math.round(y)}) berhasil ditambahkan!`, 'success');
    } else {
        showMessage('Format koordinat tidak valid. Gunakan format: (x, y) atau x, y', 'error');
    }
}

// Fungsi untuk mengurai input titik
function parsePointInput(input) {
    input = input.trim();
    
    // Format 1: (x, y)
    let matches = input.match(/\(\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\)/);
    if (matches) {
        const x = parseFloat(matches[1]);
        const y = parseFloat(matches[2]);
        if (!isNaN(x) && !isNaN(y)) {
            return { x, y };
        }
    }
    
    // Format 2: x, y (tanpa tanda kurung)
    matches = input.match(/^\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*$/);
    if (matches) {
        const x = parseFloat(matches[1]);
        const y = parseFloat(matches[2]);
        if (!isNaN(x) && !isNaN(y)) {
            return { x, y };
        }
    }
    
    // Format 3: A(x, y)
    matches = input.match(/^[A-Za-z]\s*\(\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\)$/);
    if (matches) {
        const x = parseFloat(matches[1]);
        const y = parseFloat(matches[2]);
        if (!isNaN(x) && !isNaN(y)) {
            return { x, y };
        }
    }
    
    // Format 4: x=3 y=5
    matches = input.match(/x\s*=\s*([-+]?\d*\.?\d+)[,\s]+y\s*=\s*([-+]?\d*\.?\d+)/i);
    if (matches) {
        const x = parseFloat(matches[1]);
        const y = parseFloat(matches[2]);
        if (!isNaN(x) && !isNaN(y)) {
            return { x, y };
        }
    }
    
    // Format 5: Dua angka dipisahkan spasi
    matches = input.match(/^\s*([-+]?\d*\.?\d+)\s+([-+]?\d*\.?\d+)\s*$/);
    if (matches) {
        const x = parseFloat(matches[1]);
        const y = parseFloat(matches[2]);
        if (!isNaN(x) && !isNaN(y)) {
            return { x, y };
        }
    }
    
    // Format 6: Koordinat dengan titik koma
    matches = input.match(/^\s*([-+]?\d*\.?\d+)\s*;\s*([-+]?\d*\.?\d+)\s*$/);
    if (matches) {
        const x = parseFloat(matches[1]);
        const y = parseFloat(matches[2]);
        if (!isNaN(x) && !isNaN(y)) {
            return { x, y };
        }
    }
    
    return null;
}

// ==================== FUNGSI PESAN ====================

// Fungsi untuk menampilkan pesan sementara
function showMessage(message, type) {
    const existingMessage = document.querySelector('.temp-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = `temp-message ${type}`;
    messageElement.setAttribute('role', type === 'error' ? 'alert' : 'status');
    messageElement.setAttribute('aria-live', 'polite');
    messageElement.textContent = message;
    messageElement.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        font-weight: 600;
        z-index: 1000;
        animation: fadeIn 0.3s, fadeOut 0.3s 2.7s;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    `;
    
    if (type === 'success') {
        messageElement.style.backgroundColor = 'rgba(76, 175, 80, 0.9)';
        messageElement.style.color = 'white';
        messageElement.style.borderLeft = '5px solid #4CAF50';
    } else {
        messageElement.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
        messageElement.style.color = 'white';
        messageElement.style.borderLeft = '5px solid #F44336';
    }
    
    document.body.appendChild(messageElement);
    
    setTimeout(() => {
        if (messageElement.parentNode) {
            messageElement.style.animation = 'fadeOut 0.3s';
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.remove();
                }
            }, 300);
        }
    }, 3000);
}

// Interaksi terpadu untuk mouse, touch, dan stylus.
const activePointers = new Map();
let pointerPanStart = null;
let pointerPinchStart = null;

function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function handlePointerDown(event) {
    event.preventDefault();
    activePointers.set(event.pointerId, pointerPosition(event));
    canvas.setPointerCapture(event.pointerId);

    if (activePointers.size === 1 && (event.pointerType !== 'mouse' || event.button === 2)) {
        const position = activePointers.get(event.pointerId);
        pointerPanStart = {
            x: position.x,
            y: position.y,
            offsetX: viewOffsetX,
            offsetY: viewOffsetY
        };
        canvas.style.cursor = 'grabbing';
    }

    if (activePointers.size === 2) {
        const [first, second] = [...activePointers.values()];
        const centerX = (first.x + second.x) / 2;
        const centerY = (first.y + second.y) / 2;
        pointerPinchStart = {
            distance: Math.hypot(second.x - first.x, second.y - first.y),
            scale: viewScale,
            centerX,
            centerY,
            worldX: screenToWorld(centerX, centerY).x,
            worldY: screenToWorld(centerX, centerY).y
        };
        pointerPanStart = null;
    }
}

function handlePointerMove(event) {
    if (!activePointers.has(event.pointerId)) return;
    event.preventDefault();
    activePointers.set(event.pointerId, pointerPosition(event));

    if (activePointers.size === 2 && pointerPinchStart) {
        const [first, second] = [...activePointers.values()];
        const centerX = (first.x + second.x) / 2;
        const centerY = (first.y + second.y) / 2;
        const distance = Math.hypot(second.x - first.x, second.y - first.y);
        viewScale = Math.max(minScale, Math.min(maxScale, pointerPinchStart.scale * distance / pointerPinchStart.distance));
        const worldAfter = screenToWorld(centerX, centerY);
        viewOffsetX += pointerPinchStart.worldX - worldAfter.x;
        viewOffsetY += pointerPinchStart.worldY - worldAfter.y;
        redrawCanvas();
    } else if (activePointers.size === 1 && pointerPanStart) {
        const position = activePointers.get(event.pointerId);
        viewOffsetX = pointerPanStart.offsetX - (position.x - pointerPanStart.x) / viewScale;
        viewOffsetY = pointerPanStart.offsetY + (position.y - pointerPanStart.y) / viewScale;
        redrawCanvas();
    }
}

function handlePointerUp(event) {
    activePointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    pointerPinchStart = null;
    pointerPanStart = null;
    canvas.style.cursor = 'default';
}

// Tangani scroll wheel untuk zoom
function handleCanvasWheel(event) {
    event.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const worldPosBeforeZoom = screenToWorld(x, y);
    
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    
    viewScale *= zoomFactor;
    viewScale = Math.max(minScale, Math.min(maxScale, viewScale));
    
    const worldPosAfterZoom = screenToWorld(x, y);
    
    viewOffsetX += worldPosAfterZoom.x - worldPosBeforeZoom.x;
    viewOffsetY += worldPosAfterZoom.y - worldPosBeforeZoom.y;
    
    redrawCanvas();
}

// ==================== FUNGSI ZOOM DAN VIEW CONTROL ====================

// Fungsi zoom dengan faktor tertentu
function zoom(factor) {
    const centerX = canvas.offsetWidth / 2;
    const centerY = canvas.offsetHeight / 2;
    
    const worldPosBeforeZoom = screenToWorld(centerX, centerY);
    
    viewScale *= factor;
    viewScale = Math.max(minScale, Math.min(maxScale, viewScale));
    
    const worldPosAfterZoom = screenToWorld(centerX, centerY);
    
    viewOffsetX += worldPosAfterZoom.x - worldPosBeforeZoom.x;
    viewOffsetY += worldPosAfterZoom.y - worldPosBeforeZoom.y;
    
    redrawCanvas();
}

// Reset tampilan ke posisi awal
function resetView() {
    viewOffsetX = 0;
    viewOffsetY = 0;
    viewScale = 10;
    redrawCanvas();
    showMessage('Tampilan koordinat direset ke posisi awal', 'success');
}

// Handle window resize dengan debounce
function handleWindowResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        setupCanvasSize();
        redrawCanvas();
    }, 250);
}

// ==================== FUNGSI GAMBAR TITIK DAN GARIS ====================

// Fungsi untuk membulatkan koordinat
function formatCoordinate(coord) {
    const rounded = Math.round(coord * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

// Gambar semua titik dan garis
function drawPoints() {
    // Gambar titik asli
    ctx.fillStyle = '#2196f3';
    ctx.strokeStyle = '#2196f3';
    ctx.lineWidth = 3;
    
    for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const screenPos = worldToScreen(point.x, point.y);
        
        // Gambar titik
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Gambar label titik
        ctx.fillStyle = '#2196f3';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`P${i+1}(${formatCoordinate(point.x)}, ${formatCoordinate(point.y)})`, screenPos.x + 8, screenPos.y - 8);
        
        // Gambar garis antara titik-titik
        if (i > 0) {
            const prevPoint = points[i-1];
            const prevScreenPos = worldToScreen(prevPoint.x, prevPoint.y);
            
            ctx.beginPath();
            ctx.moveTo(prevScreenPos.x, prevScreenPos.y);
            ctx.lineTo(screenPos.x, screenPos.y);
            ctx.stroke();
        }
    }
    
    // Gambar garis penutup jika poligon ditutup
    if (isPolygonClosed && points.length > 2) {
        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];
        const firstScreenPos = worldToScreen(firstPoint.x, firstPoint.y);
        const lastScreenPos = worldToScreen(lastPoint.x, lastPoint.y);
        
        ctx.beginPath();
        ctx.moveTo(lastScreenPos.x, lastScreenPos.y);
        ctx.lineTo(firstScreenPos.x, firstScreenPos.y);
        ctx.stroke();
    }
    
    // Gambar titik hasil transformasi
    if (transformedPoints.length > 0) {
        ctx.fillStyle = '#ff9800';
        ctx.strokeStyle = '#ff9800';
        ctx.lineWidth = 3;
        
        for (let i = 0; i < transformedPoints.length; i++) {
            const point = transformedPoints[i];
            const screenPos = worldToScreen(point.x, point.y);
            
            // Gambar titik
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, 6, 0, Math.PI * 2);
            ctx.fill();
            
            // Gambar label titik
            ctx.fillStyle = '#ff9800';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`P'${i+1}(${formatCoordinate(point.x)}, ${formatCoordinate(point.y)})`, screenPos.x + 8, screenPos.y + 20);
            
            // Gambar garis antara titik-titik
            if (i > 0) {
                const prevPoint = transformedPoints[i-1];
                const prevScreenPos = worldToScreen(prevPoint.x, prevPoint.y);
                
                ctx.beginPath();
                ctx.moveTo(prevScreenPos.x, prevScreenPos.y);
                ctx.lineTo(screenPos.x, screenPos.y);
                ctx.stroke();
            }
        }
        
        // Gambar garis penutup jika poligon ditutup
        if (isPolygonClosed && transformedPoints.length > 2) {
            const firstPoint = transformedPoints[0];
            const lastPoint = transformedPoints[transformedPoints.length - 1];
            const firstScreenPos = worldToScreen(firstPoint.x, firstPoint.y);
            const lastScreenPos = worldToScreen(lastPoint.x, lastPoint.y);
            
            ctx.beginPath();
            ctx.moveTo(lastScreenPos.x, lastScreenPos.y);
            ctx.lineTo(firstScreenPos.x, firstScreenPos.y);
            ctx.stroke();
        }
    }
}

// Gambar ulang seluruh canvas
function redrawCanvas() {
    drawGridAndAxes();
    drawPoints();
}

// ==================== FUNGSI TRANSFORMASI ====================

// Tampilkan parameter transformasi yang dipilih
function showTransformParams(transformType) {
    document.querySelectorAll('.transform-params').forEach(param => {
        param.style.display = 'none';
    });
    
    document.getElementById(`${transformType}-params`).style.display = 'block';
    
    // Jika refleksi, periksa apakah kustom dipilih
    if (transformType === 'reflection') {
        toggleCustomReflection();
    }
}

// Toggle parameter refleksi kustom
function toggleCustomReflection() {
    const axis = document.getElementById('reflectionAxis').value;
    const customParams = document.getElementById('customReflectionParams');
    
    if (axis === 'custom') {
        customParams.style.display = 'block';
    } else {
        customParams.style.display = 'none';
    }

    const labels = {
        x: 'Refleksi terhadap sumbu X',
        y: 'Refleksi terhadap sumbu Y',
        'y=x': 'Refleksi terhadap garis y = x',
        'y=-x': 'Refleksi terhadap garis y = -x',
        custom: 'Refleksi terhadap garis kustom'
    };
    transformLabels.reflection = labels[axis] || labels.x;
    updateTransformStatus();
}

// Update nilai parameter refleksi
function updateReflectionParams() {
    document.getElementById('reflectionMValue').textContent = document.getElementById('reflectionM').value;
    document.getElementById('reflectionCValue').textContent = document.getElementById('reflectionC').value;
    updateTransformStatus();
}

// Update nilai parameter rotasi
function updateRotationParams() {
    document.getElementById('rotationAngleValue').textContent = document.getElementById('rotationAngle').value + '°';
    transformLabels.rotation = `Rotasi ${document.getElementById('rotationAngle').value}° dengan pusat (0, 0)`;
    updateTransformStatus();
}

// Update nilai parameter dilatasi
function updateDilationParams() {
    document.getElementById('scaleFactorValue').textContent = document.getElementById('scaleFactor').value;
    transformLabels.dilation = `Dilatasi dengan faktor ${document.getElementById('scaleFactor').value}`;
    updateTransformStatus();
}

// Terapkan transformasi yang dipilih
function applyTransform() {
    if (points.length === 0) {
        showMessage('Tambahkan titik terlebih dahulu!', 'error');
        return;
    }
    
    // Reset titik transformasi
    transformedPoints = [];
    
    // Terapkan transformasi sesuai jenis
    switch (currentTransform) {
        case 'reflection':
            applyReflection();
            break;
        case 'rotation':
            applyRotation();
            break;
        case 'dilation':
            applyDilation();
            break;
        case 'translation':
            applyTranslation();
            break;
    }

    saveHistory();
    
    // Gambar ulang canvas
    redrawCanvas();
    updateCoordinateTable();
    
    // Tampilkan pesan
    showMessage(`Transformasi ${transformNames[currentTransform]} berhasil diterapkan!`, 'success');
}

// Terapkan refleksi
function applyReflection() {
    const axis = document.getElementById('reflectionAxis').value;
    const m = parseFloat(document.getElementById('reflectionM').value);
    const c = parseFloat(document.getElementById('reflectionC').value);
    transformedPoints.push(...GeometryTransformations.reflect(points, axis, m, c));
}

// Terapkan rotasi
function applyRotation() {
    const angle = parseFloat(document.getElementById('rotationAngle').value);
    const centerX = parseFloat(document.getElementById('rotationCenterX').value) || 0;
    const centerY = parseFloat(document.getElementById('rotationCenterY').value) || 0;
    
    transformedPoints.push(...GeometryTransformations.rotate(points, angle, centerX, centerY));
}

// Terapkan dilatasi
function applyDilation() {
    const factor = parseFloat(document.getElementById('scaleFactor').value);
    const centerX = parseFloat(document.getElementById('dilationCenterX').value) || 0;
    const centerY = parseFloat(document.getElementById('dilationCenterY').value) || 0;
    
    transformedPoints.push(...GeometryTransformations.dilate(points, factor, centerX, centerY));
}

// Terapkan translasi
function applyTranslation() {
    const tx = parseFloat(document.getElementById('translationX').value) || 0;
    const ty = parseFloat(document.getElementById('translationY').value) || 0;
    
    transformedPoints.push(...GeometryTransformations.translate(points, tx, ty));
}

// ==================== FUNGSI MANAJEMEN TITIK ====================

// Hapus semua titik
function clearPoints() {
    points = [];
    transformedPoints = [];
    isPolygonClosed = false;
    saveHistory();
    redrawCanvas();
    updateCoordinateTable();
    showMessage('Semua titik telah dihapus', 'success');
}

// Tutup poligon
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

// Reset transformasi
function resetTransform() {
    transformedPoints = [];
    saveHistory();
    redrawCanvas();
    updateCoordinateTable();
    showMessage('Transformasi telah direset', 'success');
}

// Buat contoh bentuk
function createSampleShape() {
    points = [
        { x: -3, y: 2 },
        { x: 0, y: 5 },
        { x: 3, y: 2 },
        { x: 2, y: -1 },
        { x: -2, y: -1 }
    ];
    
    isPolygonClosed = true;
    transformedPoints = [];
    saveHistory();
    redrawCanvas();
    updateCoordinateTable();
    showMessage('Contoh bentuk segilima telah dibuat', 'success');
}

function loadSelectedPreset() {
    const presets = {
        triangle: [{ x: -3, y: -2 }, { x: 0, y: 4 }, { x: 3, y: -2 }],
        square: [{ x: -3, y: -3 }, { x: 3, y: -3 }, { x: 3, y: 3 }, { x: -3, y: 3 }],
        pentagon: [{ x: -3, y: 2 }, { x: 0, y: 5 }, { x: 3, y: 2 }, { x: 2, y: -1 }, { x: -2, y: -1 }]
    };
    points = clonePoints(presets[shapePreset.value] || presets.pentagon);
    transformedPoints = [];
    isPolygonClosed = true;
    saveHistory();
    redrawCanvas();
    updateCoordinateTable();
    showMessage('Preset bentuk berhasil dimuat', 'success');
}

// Update tabel koordinat
function updateCoordinateTable() {
    coordinateTableBody.innerHTML = '';
    
    // Tentukan jumlah baris maksimum
    const maxRows = Math.max(points.length, transformedPoints.length);
    
    for (let i = 0; i < maxRows; i++) {
        const row = document.createElement('tr');
        
        // Kolom nomor titik
        const pointCell = document.createElement('td');
        pointCell.textContent = `P${i+1}`;
        pointCell.className = 'py-2 sm:py-3 px-3 sm:px-4 text-blue-100 font-medium';
        row.appendChild(pointCell);
        
        // Kolom koordinat asli
        const originalCell = document.createElement('td');
        if (i < points.length) {
            originalCell.textContent = `(${formatCoordinate(points[i].x)}, ${formatCoordinate(points[i].y)})`;
        } else {
            originalCell.textContent = '-';
        }
        originalCell.className = 'py-2 sm:py-3 px-3 sm:px-4 text-blue-100';
        row.appendChild(originalCell);
        
        // Kolom koordinat hasil
        const transformedCell = document.createElement('td');
        if (i < transformedPoints.length) {
            transformedCell.textContent = `(${formatCoordinate(transformedPoints[i].x)}, ${formatCoordinate(transformedPoints[i].y)})`;
        } else {
            transformedCell.textContent = '-';
        }
        transformedCell.className = 'py-2 sm:py-3 px-3 sm:px-4 text-blue-100';
        row.appendChild(transformedCell);
        
        coordinateTableBody.appendChild(row);
    }
}

// FUNGSI SHARE BUTTONS
function initShareButtons() {
  const currentUrl = window.location.href;
  const shareTitle = '🔷 Aplikasi Geometri Transformasi - Visualisasi Interaktif';
  const shareText = '🔷 Aplikasi Geometri Transformasi 📐\n\nBelajar transformasi geometri (refleksi, rotasi, dilatasi, translasi) dengan visualisasi interaktif dan real-time.\n\n✨ Fitur:\n• Visualisasi interaktif\n• 4 jenis transformasi\n• Input koordinat manual\n• Tabel hasil transformasi\n\n';
  
  // WhatsApp
  document.getElementById('share-whatsapp').addEventListener('click', function(e) {
    e.preventDefault();
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText + currentUrl)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    showMessage('Tautan dibagikan ke WhatsApp!', 'success');
  });
  
  // Facebook
  document.getElementById('share-facebook').addEventListener('click', function(e) {
    e.preventDefault();
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}&quote=${encodeURIComponent(shareText)}`;
    window.open(facebookUrl, '_blank', 'noopener,noreferrer');
    showMessage('Tautan dibagikan ke Facebook!', 'success');
  });
  
  // Twitter/X
  document.getElementById('share-twitter').addEventListener('click', function(e) {
    e.preventDefault();
    const twitterText = '🔷 Aplikasi Geometri Transformasi 📐\n\nBelajar transformasi geometri dengan visualisasi interaktif!\n\n✨ Refleksi • Rotasi • Dilatasi • Translasi\n\n';
    const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(currentUrl)}&text=${encodeURIComponent(twitterText)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    showMessage('Tautan dibagikan ke Twitter!', 'success');
  });
  
  // Telegram
  document.getElementById('share-telegram').addEventListener('click', function(e) {
    e.preventDefault();
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(currentUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(telegramUrl, '_blank', 'noopener,noreferrer');
    showMessage('Tautan dibagikan ke Telegram!', 'success');
  });
  
  // Copy Link
  document.getElementById('share-copy').addEventListener('click', function(e) {
    e.preventDefault();
    const fullText = shareText + currentUrl;
    navigator.clipboard.writeText(fullText).then(function() {
      // Show check icon
      const btn = this;
      const iconLink = btn.querySelector('.fa-link');
      const iconCheck = btn.querySelector('.fa-check');
      iconLink.classList.add('hidden');
      iconCheck.classList.remove('hidden');
      
      showMessage('Tautan berhasil disalin!', 'success');
      
      // Reset icon after 2 seconds
      setTimeout(() => {
        iconLink.classList.remove('hidden');
        iconCheck.classList.add('hidden');
      }, 2000);
    }.bind(this)).catch(function() {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = fullText;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        showMessage('Tautan berhasil disalin!', 'success');
      } catch (err) {
        showMessage('Gagal menyalin tautan', 'error');
      }
      document.body.removeChild(textArea);
    });
  });
}
// FUNGSI BACK TO TOP
function initBackToTop() {
  const backToTopBtn = document.getElementById('backToTop');
  
  // Show/hide button on scroll
  let ticking = false;
  function updateBackToTop() {
    if (window.scrollY > 300) {
      backToTopBtn.classList.add('show');
    } else {
      backToTopBtn.classList.remove('show');
    }
    ticking = false;
  }
  
  window.addEventListener('scroll', function() {
    if (!ticking) {
      requestAnimationFrame(updateBackToTop);
      ticking = true;
    }
  });
  
  // Smooth scroll to top
  backToTopBtn.addEventListener('click', function(e) {
    e.preventDefault();
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
    showMessage('Kembali ke atas!', 'success');
  });
}


// Inisialisasi aplikasi saat halaman dimuat
document.addEventListener('DOMContentLoaded', function() {
    console.log('Aplikasi Geometri Transformasi dimuat...');
    
    try {
        // Panggil fungsi init
        init();
        
        console.log('Aplikasi berhasil diinisialisasi');
    } catch (error) {
        console.error('Error saat inisialisasi:', error);
        showMessage('Terjadi kesalahan saat memuat aplikasi. Silakan refresh halaman.', 'error');
    }
});
