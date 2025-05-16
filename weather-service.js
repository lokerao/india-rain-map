/**
 * Weather Service that aggregates data from multiple weather APIs
 */

// Cache for weather data
const weatherCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for more real-time updates

/**
 * Get weather data from Google Maps Weather API
 */
async function getGoogleWeatherData(lat, lon) {
    try {
        const response = await fetch(`/.netlify/functions/weather?lat=${lat}&lon=${lon}&source=google`);
        if (!response.ok) throw new Error('Google Weather API error');
        const data = await response.json();
        
        return {
            isRaining: data.precipitation?.intensity > 0,
            confidence: data.precipitation?.probability * 100,
            description: data.conditions?.description || 'Unknown',
            temperature: data.temperature?.current,
            humidity: data.humidity?.percentage,
            windSpeed: data.wind?.speed
        };
    } catch (error) {
        console.error('Google Weather API error:', error);
        return null;
    }
}

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
function aggregateWeatherData(googleWeather, openWeather, weatherAPI, tomorrowIO) {
    const sources = [googleWeather, openWeather, weatherAPI, tomorrowIO].filter(Boolean);
    if (sources.length === 0) return null;

    // Count rain reports with weighted confidence
    let totalConfidence = 0;
    let rainConfidence = 0;

    sources.forEach(source => {
        const weight = source === googleWeather ? 2 : 1; // Give more weight to Google Weather data
        totalConfidence += weight * (source.confidence || 100);
        if (source.isRaining) {
            rainConfidence += weight * (source.confidence || 100);
        }
    });

    const isRaining = rainConfidence > totalConfidence / 2;
    const confidence = (rainConfidence / totalConfidence) * 100;

    return {
        isRaining,
        confidence,
        description: googleWeather?.description || sources[0]?.description || 'Unknown',
        temperature: googleWeather?.temperature || sources[0]?.temperature,
        humidity: googleWeather?.humidity || sources[0]?.humidity,
        windSpeed: googleWeather?.windSpeed || sources[0]?.windSpeed,
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
    const [googleWeather, openWeather, weatherAPI, tomorrowIO] = await Promise.all([
        getGoogleWeatherData(lat, lon),
        getOpenWeatherData(lat, lon),
        getWeatherAPIData(lat, lon),
        getTomorrowIOData(lat, lon)
    ]);

    const aggregatedData = aggregateWeatherData(googleWeather, openWeather, weatherAPI, tomorrowIO);
    
    if (aggregatedData) {
        weatherCache.set(cacheKey, {
            data: aggregatedData,
            timestamp: Date.now()
        });
    }

    return aggregatedData;
}

/**
 * Get weather data for a route with optimized sampling
 */
export async function getRouteWeather(path) {
    // Optimize sampling based on route length and complexity
    const MINIMUM_DISTANCE = 0.02; // ~2km in degrees
    const sampledPoints = [];
    let lastPoint = null;

    for (let i = 0; i < path.length; i++) {
        const point = path[i];
        
        // Always include first and last points
        if (i === 0 || i === path.length - 1) {
            sampledPoints.push(point);
            lastPoint = point;
            continue;
        }

        // Check distance from last sampled point
        if (lastPoint) {
            const distance = Math.sqrt(
                Math.pow(point.lat - lastPoint.lat, 2) + 
                Math.pow(point.lng - lastPoint.lng, 2)
            );

            // Sample point if it's far enough from the last one
            if (distance >= MINIMUM_DISTANCE) {
                sampledPoints.push(point);
                lastPoint = point;
            }
        }
    }

    // Get weather for sampled points in parallel
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