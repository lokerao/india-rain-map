const fetch = require('node-fetch');

// Weather API configurations
const OPENWEATHER_API_KEY = process.env.OPENWEATHERMAP_API_KEY;
const WEATHERAPI_KEY = process.env.WEATHERAPI_KEY;
const TOMORROW_API_KEY = process.env.TOMORROW_API_KEY;

/**
 * Get weather from OpenWeatherMap
 */
async function getOpenWeatherData(lat, lon) {
    try {
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}`
        );
        
        if (!response.ok) throw new Error(`OpenWeather API responded with ${response.status}`);
        const data = await response.json();

        return {
            isRaining: Boolean(data.rain || data.weather[0]?.main === 'Rain'),
            description: data.weather[0]?.description || 'unknown'
        };
    } catch (error) {
        console.error('OpenWeather error:', error);
        return null;
    }
}

/**
 * Get weather from WeatherAPI
 */
async function getWeatherAPIData(lat, lon) {
    try {
        const response = await fetch(
            `https://api.weatherapi.com/v1/current.json?key=${WEATHERAPI_KEY}&q=${lat},${lon}`
        );
        
        if (!response.ok) throw new Error(`WeatherAPI responded with ${response.status}`);
        const data = await response.json();

        return {
            isRaining: data.current.precip_mm > 0 || data.current.condition.text.toLowerCase().includes('rain'),
            description: data.current.condition.text
        };
    } catch (error) {
        console.error('WeatherAPI error:', error);
        return null;
    }
}

/**
 * Get weather from Tomorrow.io
 */
async function getTomorrowIOData(lat, lon) {
    try {
        const response = await fetch(
            `https://api.tomorrow.io/v4/weather/realtime?location=${lat},${lon}&apikey=${TOMORROW_API_KEY}`
        );
        
        if (!response.ok) throw new Error(`Tomorrow.io API responded with ${response.status}`);
        const data = await response.json();

        return {
            isRaining: data.data.values.precipitationIntensity > 0,
            description: data.data.values.precipitationType === 0 ? 'No precipitation' : 'Rain'
        };
    } catch (error) {
        console.error('Tomorrow.io error:', error);
        return null;
    }
}

exports.handler = async function(event, context) {
    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { lat, lon, source } = event.queryStringParameters;

        if (!lat || !lon) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing latitude or longitude parameters' })
            };
        }

        let weatherData;

        // Handle specific source requests
        switch (source) {
            case 'openweather':
                weatherData = await getOpenWeatherData(lat, lon);
                break;
            case 'weatherapi':
                weatherData = await getWeatherAPIData(lat, lon);
                break;
            case 'tomorrow':
                weatherData = await getTomorrowIOData(lat, lon);
                break;
            default:
                // If no specific source requested, try OpenWeatherMap as default
                weatherData = await getOpenWeatherData(lat, lon);
        }

        if (!weatherData) {
            throw new Error('Failed to fetch weather data');
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
            },
            body: JSON.stringify(weatherData)
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch weather data' })
        };
    }
}; 