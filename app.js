import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay as DeckOverlay } from '@deck.gl/mapbox';
import { ScatterplotLayer } from '@deck.gl/layers';
import maplibregl from 'maplibre-gl';
import { webgpuAdapter } from '@luma.gl/webgpu';

// --- Configuration ---
const INITIAL_VIEW_STATE = {
    longitude: 0,
    latitude: 0,
    zoom: 1,
    maxZoom: 16,
    pitch: 0,
    bearing: 0
};

// --- State Management ---
let currentData = null;
let pointCount = 0;

// --- Initialize Map ---
const map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
    zoom: INITIAL_VIEW_STATE.zoom,
    maxZoom: INITIAL_VIEW_STATE.maxZoom,
    pitch: INITIAL_VIEW_STATE.pitch,
    bearing: INITIAL_VIEW_STATE.bearing
});

// --- Initialize Deck Context ---
const deckOverlay = new DeckOverlay({
    deviceProps: {
        adapters: [webgpuAdapter]
    },
    layers: []
});

map.addControl(deckOverlay);
map.addControl(new maplibregl.NavigationControl());

// --- Core Logic ---

function updateLayer(data) {
    const start = performance.now();

    let layer;
    if (data.attributes) {
        // Binary data
        layer = new ScatterplotLayer({
            id: 'scatterplot',
            data: {
                length: data.length,
                attributes: data.attributes
            },
            getPosition: { strategy: 'attribute' }, // Tell deck.gl to use binary attributes
            getFillColor: { strategy: 'attribute' },
            getRadius: 30,
            radiusMinPixels: 0.25,
            pickable: true
        });
    } else {
        // Standard JSON data
        layer = new ScatterplotLayer({
            id: 'scatterplot',
            data: data,
            getPosition: d => [d[0], d[1]],
            getFillColor: d => (d[2] === 1 ? [0, 128, 255] : [255, 0, 128]),
            getRadius: 30,
            radiusMinPixels: 0.25,
            pickable: true
        });
    }

    deckOverlay.setProps({ layers: [layer] });

    const end = performance.now();
    document.getElementById('count-display').innerText = (data.length || data.length === 0 ? data.length : data.length).toLocaleString();
    document.getElementById('time-display').innerText = `${Math.round(end - start)}ms (render update)`;
}

// Highly efficient generation using typed arrays
function generatePoints(count) {
    const startTime = performance.now();
    const positions = new Float32Array(count * 2);
    const colors = new Uint8Array(count * 3);

    // Use a simpler distribution for speed: full world
    for (let i = 0; i < count; i++) {
        const i2 = i * 2;
        const i3 = i * 3;

        // Random worldwide coordinates
        positions[i2] = (Math.random() - 0.5) * 360;
        positions[i2 + 1] = (Math.random() - 0.5) * 170; // Stay within map range

        // Random colors
        colors[i3] = Math.random() * 255;
        colors[i3 + 1] = Math.random() * 255;
        colors[i3 + 2] = Math.random() * 255;
    }

    const endTime = performance.now();
    console.log(`Generated ${count} points in ${endTime - startTime}ms`);

    return {
        length: count,
        attributes: {
            getPosition: { value: positions, size: 2 },
            getFillColor: { value: colors, size: 3 }
        }
    };
}

// --- UI Interaction ---

const pointInput = document.getElementById('point-count');
const generateBtn = document.getElementById('generate-btn');
const dropZone = document.getElementById('drop-zone');

generateBtn.addEventListener('click', () => {
    // Parse number, removing dots/commas
    const rawValue = pointInput.value.replace(/[.,]/g, '');
    const count = parseInt(rawValue, 10);

    if (isNaN(count)) {
        alert('Please enter a valid number');
        return;
    }

    generateBtn.innerText = 'Generating...';
    generateBtn.disabled = true;

    // Small timeout to allow UI to update
    setTimeout(() => {
        const data = generatePoints(count);
        currentData = data;
        updateLayer(data);
        generateBtn.innerText = 'Generate';
        generateBtn.disabled = false;

        // Auto-close on mobile after generation
        if (window.innerWidth <= 768) {
            controlPanel.classList.remove('open');
        }
    }, 10);
});

const removeBtn = document.getElementById('remove-btn');
removeBtn.addEventListener('click', () => {
    currentData = null;
    updateLayer([]);

    // Auto-close on mobile after removal
    if (window.innerWidth <= 768) {
        controlPanel.classList.remove('open');
    }
});

// --- Mobile UI Drawer Logic ---
const controlPanel = document.getElementById('control-panel');
const dragHandle = document.querySelector('.drag-handle');

let startY = 0;
let currentY = 0;
let isDragging = false;
let panelHeight = 0;

function setPanelTranslate(y) {
    controlPanel.style.transform = `translateY(${y}px)`;
}

function updatePanelState(isOpen) {
    controlPanel.classList.toggle('open', isOpen);
    controlPanel.style.transform = ''; // Clear inline styles to let CSS take over
}

// Gesture Handling
function onTouchStart(e) {
    if (window.innerWidth > 768) return;

    // Only allow dragging from handle or header area to avoid conflict with content scroll
    const touchY = e.touches[0].clientY;
    const panelRect = controlPanel.getBoundingClientRect();

    // Check if touch is in the top portion of the panel
    if (touchY - panelRect.top > 80) return;

    startY = touchY;
    panelHeight = panelRect.height;
    isDragging = true;
    controlPanel.style.transition = 'none'; // Instant feedback
}

function onTouchMove(e) {
    if (!isDragging) return;

    const touchY = e.touches[0].clientY;
    const deltaY = touchY - startY;

    // Calculate new position
    // If open (translateY = 0), deltaY > 0 moves down (closing)
    // If closed (translateY = height - 60), deltaY < 0 moves up (opening)
    const isCurrentlyOpen = controlPanel.classList.contains('open');
    const baseTranslate = isCurrentlyOpen ? 0 : (panelHeight - 60);
    let newTranslate = baseTranslate + deltaY;

    // Bounds: don't push too high or too low
    newTranslate = Math.max(0, Math.min(newTranslate, panelHeight - 60));

    setPanelTranslate(newTranslate);
    currentY = newTranslate;

    // Prevent background scrolling
    if (e.cancelable) e.preventDefault();
}

function onTouchEnd() {
    if (!isDragging) return;
    isDragging = false;
    controlPanel.style.transition = ''; // Restore smooth CSS transition

    const isCurrentlyOpen = controlPanel.classList.contains('open');
    const threshold = panelHeight * 0.3; // 30% of height needed to toggle

    if (isCurrentlyOpen) {
        // Closing: if moved more than 30% down, close it
        updatePanelState(currentY < threshold);
    } else {
        // Opening: if moved more than 30% up from closed state
        const closedPos = panelHeight - 60;
        updatePanelState(currentY < closedPos - threshold);
    }
}

// Attach listeners to the panel itself for broad hit area, 
// filtered by onTouchStart's position check
controlPanel.addEventListener('touchstart', onTouchStart, { passive: false });
window.addEventListener('touchmove', onTouchMove, { passive: false });
window.addEventListener('touchend', onTouchEnd);

// --- Drag and Drop ---

window.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('active');
});

window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (e.relatedTarget === null) {
        dropZone.classList.remove('active');
    }
});

window.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('active');

    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/json' || file.name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target.result);
                currentData = json;
                updateLayer(json);
            } catch (err) {
                alert('Failed to parse JSON file');
                console.error(err);
            }
        };
        reader.readAsText(file);
    } else {
        alert('Please drop a valid JSON file');
    }
});

// Load initial data if present (optional)
// fetch('world_points.json').then(res => res.json()).then(updateLayer).catch(() => {});
