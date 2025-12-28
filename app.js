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
    }, 10);
});

const removeBtn = document.getElementById('remove-btn');
removeBtn.addEventListener('click', () => {
    currentData = null;
    updateLayer([]);
});

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
