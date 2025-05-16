const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { lat, lon } = event.queryStringParameters;

        if (!lat || !lon) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing latitude or longitude parameters' })
            };
        }

        // Get API key from environment variable
        const apiKey = process.env.OPENWEATHERMAP_API_KEY;
        if (!apiKey) {
            throw new Error('OpenWeatherMap API key not configured');
        }

        // Make request to OpenWeatherMap API
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}`
        );

        if (!response.ok) {
            throw new Error(`Weather API responded with ${response.status}`);
        }

        const data = await response.json();

        // Return only the necessary weather data
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
            },
            body: JSON.stringify({
                rain: data.rain ? true : false,
                description: data.weather[0]?.description || 'unknown',
                timestamp: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch weather data' })
        };
    }
}; 