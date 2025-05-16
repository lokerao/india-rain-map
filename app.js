import { db, ref, onValue, set } from './firebase-config.js';
import { getWeather, getRouteWeather } from './weather-service.js';

// Store global variables
let map;
let directionsService;
let directionsRenderer;
let startAutocomplete;
let endAutocomplete;
let weatherMarkers = new Map();
let routeWeatherData = [];
let currentRoute = null;

// Initialize map and services
function initializeMap() {
    console.log('Initializing map...');
    
    // Initialize map centered on India
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 20.5937, lng: 78.9629 },
        zoom: 5,
        restriction: {
            latLngBounds: {
                north: 37.2937,
                south: 8.0661,
                west: 68.1097,
                east: 97.4152
            },
            strictBounds: true
        },
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        styles: [
            {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }]
            }
        ]
    });

    // Initialize directions service and renderer
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        polylineOptions: {
            strokeColor: '#4a90e2',
            strokeWeight: 4
        }
    });

    // Initialize Places Autocomplete with session token
    const sessionToken = new google.maps.places.AutocompleteSessionToken();
    const startInput = document.getElementById('start-location');
    const endInput = document.getElementById('end-location');

    const autocompleteOptions = {
        componentRestrictions: { country: 'in' },
        fields: ['formatted_address', 'geometry', 'name'],
        sessionToken: sessionToken,
        types: ['geocode', 'establishment'],
        strictBounds: false
    };

    startAutocomplete = new google.maps.places.Autocomplete(startInput, autocompleteOptions);
    endAutocomplete = new google.maps.places.Autocomplete(endInput, autocompleteOptions);

    // Bias the autocomplete results to current map bounds
    map.addListener('bounds_changed', () => {
        startAutocomplete.setBounds(map.getBounds());
        endAutocomplete.setBounds(map.getBounds());
    });

    // Add event listeners
    document.getElementById('get-route').addEventListener('click', calculateRoute);
    setupLocationButtons();
}

// Loading indicator
const loading = document.getElementById('loading');
function showLoading() {
    loading.classList.add('active');
}
function hideLoading() {
    loading.classList.remove('active');
}

/**
 * Create a weather marker
 */
function createWeatherMarker(position, weather) {
    const marker = new google.maps.Marker({
        position,
        map,
        icon: {
            url: `data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><text y="50" x="50" text-anchor="middle" dominant-baseline="middle" font-size="80px">${weather.isRaining ? '🌧️' : '☀️'}</text></svg>`,
            scaledSize: new google.maps.Size(40, 40)
        }
    });

    const infoWindow = new google.maps.InfoWindow({
        content: `
            <div class="weather-info">
                <p><strong>Weather Status:</strong> ${weather.isRaining ? 'Raining' : 'Dry'}</p>
                <p><strong>Confidence:</strong> ${weather.confidence.toFixed(1)}%</p>
                <p><strong>Description:</strong> ${weather.description}</p>
                <p><small>Based on ${weather.sources} weather sources</small></p>
            </div>
        `
    });

    marker.addListener('click', () => {
        infoWindow.open(map, marker);
    });

    return marker;
}

/**
 * Update route weather display
 */
async function updateRouteWeather(route) {
    // Clear existing markers
    weatherMarkers.forEach(marker => marker.setMap(null));
    weatherMarkers.clear();
    
    // Get route path
    const path = route.overview_path.map(point => ({
        lat: point.lat(),
        lng: point.lng()
    }));

    // Get weather data for route
    const weatherPoints = await getRouteWeather(path);

    // Create markers for weather points
    weatherPoints.forEach(point => {
        if (point.weather) {
            const marker = createWeatherMarker(
                { lat: point.lat, lng: point.lng },
                point.weather
            );
            weatherMarkers.set(`${point.lat},${point.lng}`, marker);
        }
    });

    // Update route info
    const routeInfo = document.getElementById('route-info');
    const rainPercentage = (weatherPoints.filter(p => p.weather?.isRaining).length / weatherPoints.length * 100).toFixed(1);
    
    routeInfo.innerHTML = `
        <div class="route-summary">
            <p><strong>Distance:</strong> ${(route.distance.value / 1000).toFixed(1)} km</p>
            <p><strong>Duration:</strong> ${Math.round(route.duration.value / 60)} mins</p>
            <p><strong>Rain Chance:</strong> ${rainPercentage}% of route</p>
        </div>
    `;
}

/**
 * Calculate and display route
 */
async function calculateRoute() {
    const start = startAutocomplete.getPlace();
    const end = endAutocomplete.getPlace();

    if (!start?.geometry || !end?.geometry) {
        alert('Please select locations from the dropdown suggestions');
        return;
    }

    showLoading();
    try {
        const result = await new Promise((resolve, reject) => {
            directionsService.route({
                origin: start.geometry.location,
                destination: end.geometry.location,
                travelMode: google.maps.TravelMode.DRIVING,
                optimizeWaypoints: true
            }, (result, status) => {
                if (status === google.maps.DirectionsStatus.OK) {
                    resolve(result);
                } else {
                    reject(new Error(`Route calculation failed: ${status}`));
                }
            });
        });

        directionsRenderer.setDirections(result);
        currentRoute = result.routes[0].legs[0];
        
        // Fit the map to show the entire route
        const bounds = new google.maps.LatLngBounds();
        result.routes[0].legs[0].steps.forEach(step => {
            bounds.extend(step.start_location);
            bounds.extend(step.end_location);
        });
        map.fitBounds(bounds);
        
        await updateRouteWeather(currentRoute);
    } catch (error) {
        console.error('Route error:', error);
        alert('Failed to calculate route. Please try again.');
    } finally {
        hideLoading();
    }
}

/**
 * Setup location buttons
 */
function setupLocationButtons() {
    document.querySelectorAll('.location-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (navigator.geolocation) {
                showLoading();
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const input = btn.dataset.type === 'start' ? startInput : endInput;
                        const geocoder = new google.maps.Geocoder();
                        
                        geocoder.geocode({
                            location: {
                                lat: position.coords.latitude,
                                lng: position.coords.longitude
                            }
                        }, (results, status) => {
                            hideLoading();
                            if (status === google.maps.GeocoderStatus.OK && results[0]) {
                                input.value = results[0].formatted_address;
                            } else {
                                alert('Could not find address for this location');
                            }
                        });
                    },
                    (error) => {
                        hideLoading();
                        alert('Error getting your location: ' + error.message);
                    }
                );
            } else {
                alert('Geolocation is not supported by your browser');
            }
        });
    });
}

// Initialize the map when the script loads
window.addEventListener('load', () => {
    console.log('Page loaded, checking Google Maps API...');
    if (window.google && window.google.maps) {
        initializeMap();
    } else {
        console.error('Google Maps API not loaded');
        alert('Error loading Google Maps. Please check your internet connection and try again.');
    }
}); 