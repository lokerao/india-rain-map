import { db, ref, onValue, set } from './firebase-config.js';
import { getWeather, getRouteWeather } from './weather-service.js';

// Store global variables
let map;
let directionsService;
let directionsRenderer;
let startPicker;
let endPicker;
let weatherMarkers = new Map();
let routeWeatherData = [];
let currentRoute = null;

// Custom map styles
const mapStyles = [
    {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ visibility: "simplified" }]
    },
    {
        featureType: "road.arterial",
        elementType: "geometry",
        stylers: [{ color: "#ffffff" }]
    },
    {
        featureType: "landscape",
        elementType: "geometry",
        stylers: [{ color: "#f5f5f5" }]
    },
    {
        featureType: "poi",
        elementType: "labels",
        stylers: [{ visibility: "off" }]
    },
    {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#c9eaf9" }]
    }
];

// Initialize map and services
async function initializeMap() {
    console.log('Initializing map...');
    
    // Wait for custom elements to be defined
    await customElements.whenDefined('gmp-map');
    await customElements.whenDefined('gmpx-place-picker');

    // Get map instance
    const mapElement = document.querySelector('gmp-map');
    map = await mapElement.innerMap;

    // Set map options
    map.setOptions({
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
        styles: mapStyles
    });

    // Initialize directions service and renderer
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        polylineOptions: {
            strokeColor: '#4a90e2',
            strokeWeight: 5,
            strokeOpacity: 0.8
        }
    });

    // Initialize place pickers
    startPicker = document.getElementById('start-location');
    endPicker = document.getElementById('end-location');

    // Configure place pickers for India
    [startPicker, endPicker].forEach(picker => {
        picker.componentRestrictions = { country: 'in' };
        picker.types = ['geocode', 'establishment'];
        
        picker.addEventListener('gmpx-placechange', () => {
            const place = picker.value;
            if (place && place.location) {
                map.panTo(place.location);
            }
        });
    });

    // Add event listeners
    document.getElementById('get-route').addEventListener('click', calculateRoute);
    setupLocationButtons();
}

/**
 * Create a weather marker with custom icon and enhanced info window
 */
function createWeatherMarker(position, weather) {
    const markerElement = document.createElement('gmp-advanced-marker');
    markerElement.position = position;
    
    const markerContent = document.createElement('div');
    markerContent.className = 'weather-marker';
    markerContent.style.backgroundColor = weather.isRaining ? '#4a90e2' : '#f5b041';
    markerContent.style.borderColor = weather.isRaining ? '#2471a3' : '#d35400';
    
    markerElement.appendChild(markerContent);
    markerElement.map = map;

    // Create enhanced info window
    const infoWindow = new google.maps.InfoWindow({
        content: `
            <div class="weather-info">
                <p>
                    <strong>Weather Status:</strong>
                    <span>${weather.isRaining ? '🌧️ Raining' : '☀️ Dry'}</span>
                </p>
                <p>
                    <strong>Confidence:</strong>
                    <span>${weather.confidence.toFixed(1)}%</span>
                </p>
                <p>
                    <strong>Description:</strong>
                    <span>${weather.description}</span>
                </p>
                <div class="weather-details">
                    <div class="weather-detail">
                        <strong>${weather.temperature}°C</strong>
                        <span>Temperature</span>
                    </div>
                    <div class="weather-detail">
                        <strong>${weather.humidity}%</strong>
                        <span>Humidity</span>
                    </div>
                    <div class="weather-detail">
                        <strong>${weather.windSpeed} km/h</strong>
                        <span>Wind Speed</span>
                    </div>
                    <div class="weather-detail">
                        <strong>${weather.sources}</strong>
                        <span>Sources</span>
                    </div>
                </div>
            </div>
        `
    });

    markerElement.addEventListener('click', () => {
        infoWindow.open(map, markerElement);
    });

    return markerElement;
}

/**
 * Update route weather display with colored segments
 */
async function updateRouteWeather(route) {
    // Clear existing markers and polylines
    weatherMarkers.forEach(marker => marker.map = null);
    weatherMarkers.clear();
    
    // Get route path
    const path = route.overview_path.map(point => ({
        lat: point.lat(),
        lng: point.lng()
    }));

    // Get weather data for route
    const weatherPoints = await getRouteWeather(path);

    // Create markers and colored route segments
    for (let i = 0; i < weatherPoints.length - 1; i++) {
        const point = weatherPoints[i];
        const nextPoint = weatherPoints[i + 1];

        if (point.weather) {
            // Create weather marker
            const marker = createWeatherMarker(
                { lat: point.lat, lng: point.lng },
                point.weather
            );
            weatherMarkers.set(`${point.lat},${point.lng}`, marker);

            // Create colored route segment
            if (nextPoint) {
                new google.maps.Polyline({
                    path: [
                        { lat: point.lat, lng: point.lng },
                        { lat: nextPoint.lat, lng: nextPoint.lng }
                    ],
                    geodesic: true,
                    strokeColor: point.weather.isRaining ? '#2471a3' : '#808B96',
                    strokeOpacity: 0.8,
                    strokeWeight: 5,
                    map: map
                });
            }
        }
    }

    // Add marker for the last point
    const lastPoint = weatherPoints[weatherPoints.length - 1];
    if (lastPoint?.weather) {
        const marker = createWeatherMarker(
            { lat: lastPoint.lat, lng: lastPoint.lng },
            lastPoint.weather
        );
        weatherMarkers.set(`${lastPoint.lat},${lastPoint.lng}`, marker);
    }

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
 * Calculate and display optimized route
 */
async function calculateRoute() {
    const start = startPicker.value;
    const end = endPicker.value;

    if (!start?.location || !end?.location) {
        alert('Please select both start and end locations from the suggestions');
        return;
    }

    showLoading();
    try {
        // Get route alternatives
        const result = await new Promise((resolve, reject) => {
            directionsService.route({
                origin: start.location,
                destination: end.location,
                travelMode: google.maps.TravelMode.DRIVING,
                provideRouteAlternatives: true,
                optimizeWaypoints: true
            }, (result, status) => {
                if (status === google.maps.DirectionsStatus.OK) {
                    resolve(result);
                } else {
                    reject(new Error(`Route calculation failed: ${status}`));
                }
            });
        });

        // Get weather data for all routes
        const routesWithWeather = await Promise.all(
            result.routes.map(async route => {
                const path = route.overview_path.map(point => ({
                    lat: point.lat(),
                    lng: point.lng()
                }));
                const weatherPoints = await getRouteWeather(path);
                const rainPercentage = (weatherPoints.filter(p => p.weather?.isRaining).length / weatherPoints.length * 100);
                
                return {
                    route,
                    weatherPoints,
                    rainPercentage,
                    distance: route.legs[0].distance.value,
                    duration: route.legs[0].duration.value
                };
            })
        );

        // Find the best route (minimize rain and duration)
        const bestRoute = routesWithWeather.reduce((best, current) => {
            const currentScore = (current.rainPercentage * 0.7) + ((current.duration / 60) * 0.3);
            const bestScore = (best.rainPercentage * 0.7) + ((best.duration / 60) * 0.3);
            return currentScore < bestScore ? current : best;
        });

        // Display the best route
        directionsRenderer.setDirections({
            routes: [bestRoute.route],
            request: result.request
        });
        currentRoute = bestRoute.route.legs[0];
        
        // Fit the map to show the entire route
        const bounds = new google.maps.LatLngBounds();
        bestRoute.route.legs[0].steps.forEach(step => {
            bounds.extend(step.start_location);
            bounds.extend(step.end_location);
        });
        map.fitBounds(bounds);
        
        // Update weather visualization
        await updateRouteWeather(currentRoute, bestRoute.weatherPoints);

        // Update route info with enhanced weather stats
        const routeInfo = document.getElementById('route-info');
        routeInfo.innerHTML = `
            <div class="route-summary">
                <div class="weather-stats">
                    <div class="weather-stat">
                        <div class="weather-stat-value">${(bestRoute.distance / 1000).toFixed(1)} km</div>
                        <div class="weather-stat-label">Distance</div>
                    </div>
                    <div class="weather-stat">
                        <div class="weather-stat-value">${Math.round(bestRoute.duration / 60)} mins</div>
                        <div class="weather-stat-label">Duration</div>
                    </div>
                    <div class="weather-stat">
                        <div class="weather-stat-value">${bestRoute.rainPercentage.toFixed(1)}%</div>
                        <div class="weather-stat-label">Rain Chance</div>
                    </div>
                </div>
            </div>
        `;
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
                    async (position) => {
                        const picker = btn.dataset.type === 'start' ? startPicker : endPicker;
                        const geocoder = new google.maps.Geocoder();
                        
                        try {
                            const result = await geocoder.geocode({
                                location: {
                                    lat: position.coords.latitude,
                                    lng: position.coords.longitude
                                }
                            });
                            
                            if (result.results[0]) {
                                picker.value = {
                                    location: result.results[0].geometry.location,
                                    formattedAddress: result.results[0].formatted_address,
                                    name: result.results[0].formatted_address
                                };
                            } else {
                                alert('Could not find address for this location');
                            }
                        } catch (error) {
                            console.error('Geocoding error:', error);
                            alert('Error getting address for your location');
                        } finally {
                            hideLoading();
                        }
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

// Loading indicator
const loading = document.getElementById('loading');
function showLoading() {
    loading.classList.add('active');
}
function hideLoading() {
    loading.classList.remove('active');
}

// Initialize the map when the script loads
document.addEventListener('DOMContentLoaded', initializeMap); 