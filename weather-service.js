/**
 * Weather Service that aggregates data from multiple weather APIs
 */

// Cache for weather data
const weatherCache = new Map();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Get weather data from OpenWeatherMap
 */
async function getOpenWeatherData(lat, lon) {
    try {
        const response = await fetch(`/.netlify/functions/weather?lat=${lat}&lon=${lon}&source=openweather`);
        if (!response.ok) throw new Error('OpenWeather API error');
        return await response.json();
    } catch (error) {
        console.error('OpenWeather error:', error);
        return null;
    }
}

/**
 * Get weather data from WeatherAPI
 */
async function getWeatherAPIData(lat, lon) {
    try {
        const response = await fetch(`/.netlify/functions/weather?lat=${lat}&lon=${lon}&source=weatherapi`);
        if (!response.ok) throw new Error('WeatherAPI error');
        return await response.json();
    } catch (error) {
        console.error('WeatherAPI error:', error);
        return null;
    }
}

/**
 * Get weather data from Tomorrow.io
 */
async function getTomorrowIOData(lat, lon) {
    try {
        const response = await fetch(`/.netlify/functions/weather?lat=${lat}&lon=${lon}&source=tomorrow`);
        if (!response.ok) throw new Error('Tomorrow.io API error');
        return await response.json();
    } catch (error) {
        console.error('Tomorrow.io error:', error);
        return null;
    }
}

/**
 * Create cache key from coordinates
 */
function getCacheKey(lat, lon) {
    return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

/**
 * Aggregate weather data from multiple sources
 */
function aggregateWeatherData(openWeather, weatherAPI, tomorrowIO) {
    const sources = [openWeather, weatherAPI, tomorrowIO].filter(Boolean);
    if (sources.length === 0) return null;

    // Count rain reports
    const rainCount = sources.filter(source => source.isRaining).length;
    
    return {
        isRaining: rainCount > sources.length / 2, // Majority vote
        confidence: (rainCount / sources.length) * 100,
        description: sources[0]?.description || 'Unknown',
        sources: sources.length
    };
}

/**
 * Get weather data for a location
 */
export async function getWeather(lat, lon) {
    const cacheKey = getCacheKey(lat, lon);
    const cached = weatherCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
        return cached.data;
    }

    // Fetch from all sources in parallel
    const [openWeather, weatherAPI, tomorrowIO] = await Promise.all([
        getOpenWeatherData(lat, lon),
        getWeatherAPIData(lat, lon),
        getTomorrowIOData(lat, lon)
    ]);

    const aggregatedData = aggregateWeatherData(openWeather, weatherAPI, tomorrowIO);
    
    if (aggregatedData) {
        weatherCache.set(cacheKey, {
            data: aggregatedData,
            timestamp: Date.now()
        });
    }

    return aggregatedData;
}

/**
 * Get weather data for a route
 * @param {Array} path - Array of LatLng points along the route
 * @returns {Array} Weather data for points along the route
 */
export async function getRouteWeather(path) {
    // Sample points along the route (every ~5km)
    const sampledPoints = [];
    const SAMPLE_DISTANCE = 0.05; // ~5km in degrees

    for (let i = 0; i < path.length - 1; i++) {
        const start = path[i];
        const end = path[i + 1];
        
        // Calculate number of samples needed
        const distance = Math.sqrt(
            Math.pow(end.lat - start.lat, 2) + 
            Math.pow(end.lng - start.lng, 2)
        );
        const samples = Math.ceil(distance / SAMPLE_DISTANCE);

        // Sample points
        for (let j = 0; j < samples; j++) {
            const fraction = j / samples;
            const point = {
                lat: start.lat + (end.lat - start.lat) * fraction,
                lng: start.lng + (end.lng - start.lng) * fraction
            };
            sampledPoints.push(point);
        }
    }
    
    // Add the last point
    sampledPoints.push(path[path.length - 1]);

    // Get weather for each sampled point
    const weatherData = await Promise.all(
        sampledPoints.map(point => getWeather(point.lat, point.lng))
    );

    return sampledPoints.map((point, index) => ({
        ...point,
        weather: weatherData[index]
    }));
}

// Clean up old cache entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of weatherCache) {
        if (now - value.timestamp > CACHE_DURATION) {
            weatherCache.delete(key);
        }
    }
}, CACHE_DURATION); 