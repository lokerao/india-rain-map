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
    const { lat, lon, source } = event.queryStringParameters;

    if (!lat || !lon) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Latitude and longitude are required' })
        };
    }

    try {
        let response;
        
        switch(source) {
            case 'google':
                response = await getGoogleWeather(lat, lon);
                break;
            case 'openweather':
                response = await getOpenWeatherData(lat, lon);
                break;
            case 'weatherapi':
                response = await getWeatherAPIData(lat, lon);
                break;
            case 'tomorrow':
                response = await getTomorrowIOData(lat, lon);
                break;
            default:
                throw new Error('Invalid weather source');
        }

        return {
            statusCode: 200,
            body: JSON.stringify(response)
        };
    } catch (error) {
        console.error('Weather API Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch weather data' })
        };
    }
};

async function getGoogleWeather(lat, lon) {
    const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/weather/v1/current?location=${lat},${lon}&key=${API_KEY}&language=en`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Google Weather API request failed');
    
    return await response.json();
}

async function getOpenWeather(lat, lon) {
    const API_KEY = process.env.OPENWEATHERMAP_API_KEY;
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('OpenWeatherMap API request failed');
    
    const data = await response.json();
    return {
        isRaining: data.rain || data.weather[0].main.toLowerCase().includes('rain'),
        description: data.weather[0].description,
        temperature: data.main.temp,
        humidity: data.main.humidity,
        windSpeed: data.wind.speed
    };
}

async function getWeatherAPI(lat, lon) {
    const API_KEY = process.env.WEATHERAPI_KEY;
    const url = `https://api.weatherapi.com/v1/current.json?key=${API_KEY}&q=${lat},${lon}&aqi=no`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('WeatherAPI request failed');
    
    const data = await response.json();
    return {
        isRaining: data.current.precip_mm > 0,
        description: data.current.condition.text,
        temperature: data.current.temp_c,
        humidity: data.current.humidity,
        windSpeed: data.current.wind_kph
    };
}

async function getTomorrowIO(lat, lon) {
    const API_KEY = process.env.TOMORROW_API_KEY;
    const url = `https://api.tomorrow.io/v4/weather/realtime?location=${lat},${lon}&apikey=${API_KEY}&units=metric`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Tomorrow.io API request failed');
    
    const data = await response.json();
    return {
        isRaining: data.data.values.precipitationIntensity > 0,
        description: data.data.values.weatherCode,
        temperature: data.data.values.temperature,
        humidity: data.data.values.humidity,
        windSpeed: data.data.values.windSpeed
    };
} 