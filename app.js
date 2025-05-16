import { db, ref, onValue, set } from './firebase-config.js';
import { throttledFetchStreets } from './overpass-query.js';

// Initialize map centered on India
const map = L.map('map', {
    preferCanvas: true, // Use Canvas renderer for better performance
    wheelDebounceTime: 150,
    wheelPxPerZoomLevel: 120
}).setView([20.5937, 78.9629], 5);

// Add OpenStreetMap tile layer
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
    minZoom: 5,
    crossOrigin: true,
    maxNativeZoom: 18,
    maxBounds: [
        [8.0661, 68.1097], // Southwest coordinates of India
        [37.2937, 97.4152]  // Northeast coordinates of India
    ],
    bounds: [
        [8.0661, 68.1097], // Southwest coordinates of India
        [37.2937, 97.4152]  // Northeast coordinates of India
    ]
}).addTo(map);

// Initialize marker cluster group
const markerCluster = L.markerClusterGroup({
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: false,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true
});
map.addLayer(markerCluster);

// Initialize geocoder
const geocoder = L.Control.Geocoder.nominatim({
    geocodingQueryParams: {
        countrycodes: 'in', // Limit to India
        bounded: 1,
        viewbox: '68.1097,8.0661,97.4152,37.2937', // India bounds
        limit: 5
    }
});

// Search functionality
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const searchResults = document.getElementById('search-results');
let searchTimeout = null;
let searchMarker = null;

async function performSearch(query) {
    if (!query.trim()) {
        searchResults.innerHTML = '';
        searchResults.classList.remove('active');
        return;
    }

    try {
        showLoading();
        const results = await new Promise((resolve) => {
            geocoder.geocode(query, resolve);
        });

        searchResults.innerHTML = '';
        
        if (results.length === 0) {
            searchResults.innerHTML = '<div class="search-result-item">No results found</div>';
        } else {
            results.forEach((result, index) => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.textContent = result.name;
                item.addEventListener('click', () => selectSearchResult(result));
                searchResults.appendChild(item);
            });
        }
        
        searchResults.classList.add('active');
    } catch (error) {
        console.error('Search error:', error);
        searchResults.innerHTML = '<div class="search-result-item">Search failed</div>';
    } finally {
        hideLoading();
    }
}

function selectSearchResult(result) {
    // Remove previous search marker if any
    if (searchMarker) {
        map.removeLayer(searchMarker);
    }

    // Create new marker
    searchMarker = L.marker([result.center.lat, result.center.lng], {
        icon: L.divIcon({
            className: 'search-marker',
            html: '📍',
            iconSize: [24, 24]
        })
    }).addTo(map);

    // Fly to location
    map.flyTo([result.center.lat, result.center.lng], 16);

    // Clear search results
    searchResults.innerHTML = '';
    searchResults.classList.remove('active');
    searchInput.value = result.name;

    // Load streets for this area
    loadStreets();
}

// Event listeners for search
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => performSearch(e.target.value), 300);
});

searchButton.addEventListener('click', () => {
    performSearch(searchInput.value);
});

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        performSearch(searchInput.value);
    }
});

// Close search results when clicking outside
document.addEventListener('click', (e) => {
    if (!searchResults.contains(e.target) && !searchInput.contains(e.target)) {
        searchResults.classList.remove('active');
    }
});

// Store street data and markers
const streets = new Map();
const rainMarkers = new Map();
const userReports = new Map();

// Create marker icons once
const rainIcon = L.divIcon({
    className: 'rain-marker',
    html: '🌧️',
    iconSize: [20, 20]
});

const dryIcon = L.divIcon({
    className: 'dry-marker',
    html: '☀️',
    iconSize: [20, 20]
});

// Loading indicator
const loading = document.getElementById('loading');
function showLoading() {
    loading.classList.add('active');
}
function hideLoading() {
    loading.classList.remove('active');
}

// Batch marker updates
const markerUpdateQueue = new Set();
let updateTimeout = null;

function processMarkerUpdates() {
    markerCluster.clearLayers();
    for (const marker of markerUpdateQueue) {
        markerCluster.addLayer(marker);
    }
    markerUpdateQueue.clear();
    updateTimeout = null;
}

function queueMarkerUpdate(marker) {
    markerUpdateQueue.add(marker);
    if (!updateTimeout) {
        updateTimeout = setTimeout(processMarkerUpdates, 100);
    }
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
        const oldMarker = rainMarkers.get(streetId);
        markerCluster.removeLayer(oldMarker);
    }

    // Create new marker
    const coords = street.geometry.coordinates;
    const center = [coords[Math.floor(coords.length / 2)][1], coords[Math.floor(coords.length / 2)][0]];
    
    const marker = L.marker(center, {
        icon: isRaining ? rainIcon : dryIcon
    });

    marker.bindPopup(`
        <strong>${street.properties.name}</strong><br>
        Status: ${isRaining ? 'Raining' : 'Dry'}<br>
        Source: ${source}
    `);

    rainMarkers.set(streetId, marker);
    queueMarkerUpdate(marker);

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