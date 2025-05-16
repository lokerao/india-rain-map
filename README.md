# India Rain Map

A real-time weather mapping application for India that shows rain conditions along routes with data aggregated from multiple weather services.

## Features

- Route planning with Google Maps integration
- Real-time weather data from multiple sources
- Weather visualization along routes
- Route statistics (distance, duration, rain percentage)
- Location autocomplete for Indian addresses
- Current location detection
- Responsive design

## Setup

1. Clone the repository
```bash
git clone <repository-url>
cd india-rain-map
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
# Google Maps API Key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Weather API Keys
OPENWEATHERMAP_API_KEY=your_openweathermap_api_key_here
WEATHERAPI_KEY=your_weatherapi_key_here
TOMORROW_API_KEY=your_tomorrow_io_api_key_here

# Firebase Configuration
FIREBASE_API_KEY=your_firebase_api_key_here
FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain_here
FIREBASE_PROJECT_ID=your_firebase_project_id_here
FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket_here
FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id_here
FIREBASE_APP_ID=your_firebase_app_id_here
```

4. Update the Google Maps API key in `index.html`
5. Deploy to Netlify or run locally using:
```bash
netlify dev
```

## API Keys Required

You'll need to obtain API keys from:
1. [Google Maps Platform](https://console.cloud.google.com/google/maps-apis)
2. [OpenWeatherMap](https://openweathermap.org/api)
3. [WeatherAPI](https://www.weatherapi.com/)
4. [Tomorrow.io](https://www.tomorrow.io/)
5. [Firebase](https://console.firebase.google.com/)

## Security Notes

- Never commit the `.env` file to version control
- Keep API keys secure and rotate them periodically
- Use environment variables in production
- Set up proper CORS and API request limiting

## Development

The application uses:
- Google Maps JavaScript API for mapping and routing
- Multiple weather APIs for accurate precipitation data
- Firebase for real-time updates
- Netlify for hosting and serverless functions

## License

MIT License - See LICENSE file for details
