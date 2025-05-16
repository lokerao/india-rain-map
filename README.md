# India Rain Map

A real-time, crowd-sourced rain mapping application for Indian streets. This application combines weather API data with user reports to show which streets are currently experiencing rainfall.

## Features

- 🗺️ Interactive map using Leaflet and OpenStreetMap
- 🌧️ Real-time weather data from OpenWeatherMap API
- 👥 Crowd-sourced rain reports from users
- 🔄 Automatic updates when new reports come in
- 📱 Responsive design for mobile and desktop

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Map**: Leaflet.js with OpenStreetMap tiles
- **Street Data**: Overpass API with osmtogeojson
- **Weather Data**: OpenWeatherMap API (free tier)
- **Database**: Firebase Realtime Database (free Spark plan)
- **API Proxy**: Netlify Functions (free tier)
- **Hosting**: GitHub Pages or Netlify (free tier)

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/india-rain-map.git
   cd india-rain-map
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a Firebase project:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Realtime Database
   - Copy your Firebase config to `firebase-config.js`

4. Get an OpenWeatherMap API key:
   - Sign up at [OpenWeatherMap](https://openweathermap.org/api)
   - Copy your API key

5. Set up environment variables:
   Create a `.env` file:
   ```
   OPENWEATHERMAP_API_KEY=your_api_key_here
   ```

6. For local development:
   ```bash
   npm start
   ```

## Deployment

### Option 1: GitHub Pages

1. Update the repository settings to enable GitHub Pages
2. Push your changes to the `main` branch
3. Your site will be available at `https://yourusername.github.io/india-rain-map`

### Option 2: Netlify (Recommended)

1. Connect your repository to Netlify
2. Set the environment variables in Netlify dashboard
3. Deploy! Netlify will automatically build and deploy your site

## Environment Variables

- `OPENWEATHERMAP_API_KEY`: Your OpenWeatherMap API key

## API Rate Limits

- OpenWeatherMap: 60 calls/minute (free tier)
- Overpass API: No strict limit, but be respectful
- Firebase Realtime Database: 100 simultaneous connections (Spark plan)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- OpenStreetMap contributors for the map data
- OpenWeatherMap for weather data
- Firebase for the realtime database
- Netlify for hosting and serverless functions 