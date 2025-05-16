import { db, ref, onValue, set } from './firebase-config.js';
import { throttledFetchStreets } from './overpass-query.js';

// Initialize map centered on India
const map = L.map('map').setView([20.5937, 78.9629], 5);

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Store street data and markers
const streets = new Map();
const rainMarkers = new Map();
const userReports = new Map();

// Loading indicator
const loading = document.getElementById('loading');
function showLoading() {
    loading.classList.add('active');
}
function hideLoading() {
    loading.classList.remove('active');
}

/**
 * Fetch weather data for a location
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} Weather data
 */
async function fetchWeather(lat, lon) {
    try {
        const response = await fetch(`/.netlify/functions/weather?lat=${lat}&lon=${lon}`);
        if (!response.ok) throw new Error('Weather request failed');
        return response.json();
    } catch (error) {
        console.error('Error fetching weather:', error);
        return null;
    }
}

/**
 * Update street weather status
 * @param {string} streetId - Street identifier
 * @param {boolean} isRaining - Rain status
 * @param {string} source - Data source ('api' or 'user')
 */
function updateStreetStatus(streetId, isRaining, source) {
    const street = streets.get(streetId);
    if (!street) return;

    // Remove existing marker if any
    if (rainMarkers.has(streetId)) {
        map.removeLayer(rainMarkers.get(streetId));
    }

    // Create new marker
    const coords = street.geometry.coordinates;
    const center = [coords[Math.floor(coords.length / 2)][1], coords[Math.floor(coords.length / 2)][0]];
    
    const marker = L.marker(center, {
        icon: L.divIcon({
            className: isRaining ? 'rain-marker' : 'dry-marker',
            html: isRaining ? '🌧️' : '☀️',
            iconSize: [20, 20]
        })
    });

    marker.bindPopup(`
        <strong>${street.properties.name}</strong><br>
        Status: ${isRaining ? 'Raining' : 'Dry'}<br>
        Source: ${source}
    `);

    marker.addTo(map);
    rainMarkers.set(streetId, marker);

    // Update Firebase if user reported
    if (source === 'user') {
        const reportRef = ref(db, `reports/${streetId}`);
        set(reportRef, {
            name: street.properties.name,
            isRaining,
            timestamp: Date.now(),
            location: center
        });
    }
}

/**
 * Load streets in current view
 */
async function loadStreets() {
    showLoading();
    try {
        const bounds = map.getBounds();
        const data = await throttledFetchStreets(bounds);
        
        // Process each street
        data.features.forEach(street => {
            const id = street.properties.id;
            streets.set(id, street);
            
            // Check for existing report
            const reportRef = ref(db, `reports/${id}`);
            onValue(reportRef, (snapshot) => {
                const report = snapshot.val();
                if (report && (Date.now() - report.timestamp < 3600000)) { // Reports valid for 1 hour
                    updateStreetStatus(id, report.isRaining, 'user');
                } else {
                    // Fetch weather data if no recent report
                    const coords = street.geometry.coordinates;
                    const center = coords[Math.floor(coords.length / 2)];
                    fetchWeather(center[1], center[0])
                        .then(weather => {
                            if (weather) {
                                updateStreetStatus(id, weather.rain, 'api');
                            }
                        });
                }
            });
        });
    } catch (error) {
        console.error('Error loading streets:', error);
    } finally {
        hideLoading();
    }
}

// Event Listeners
map.on('moveend', loadStreets);

// Handle user reports
let selectedStreet = null;
const locationStatus = document.querySelector('.location-status');

map.on('click', (e) => {
    const point = e.latlng;
    
    // Find nearest street
    let nearest = null;
    let minDist = Infinity;
    
    streets.forEach(street => {
        const coords = street.geometry.coordinates;
        const center = [coords[Math.floor(coords.length / 2)][1], coords[Math.floor(coords.length / 2)][0]];
        const dist = point.distanceTo(L.latLng(center));
        
        if (dist < minDist && dist < 500) { // Within 500 meters
            minDist = dist;
            nearest = street;
        }
    });
    
    if (nearest) {
        selectedStreet = nearest;
        locationStatus.textContent = `Selected: ${nearest.properties.name}`;
    } else {
        selectedStreet = null;
        locationStatus.textContent = 'Click closer to a street';
    }
});

document.querySelectorAll('.report-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (!selectedStreet) {
            alert('Please select a street first');
            return;
        }
        
        const isRaining = btn.dataset.condition === 'rain';
        updateStreetStatus(selectedStreet.properties.id, isRaining, 'user');
        
        selectedStreet = null;
        locationStatus.textContent = 'Click on the map to select location';
    });
}); 