/**
 * Utility functions for fetching street data from Overpass API
 */

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

/**
 * Converts bounds to Overpass area query
 * @param {Object} bounds - Leaflet bounds object
 * @returns {string} - Overpass query string
 */
function buildQuery(bounds) {
    const south = bounds.getSouth();
    const west = bounds.getWest();
    const north = bounds.getNorth();
    const east = bounds.getEast();

    return `
        [out:json][timeout:25];
        (
            way["highway"]["name"]
                (${south},${west},${north},${east});
        );
        out body;
        >;
        out skel qt;
    `;
}

/**
 * Fetches street data for given bounds
 * @param {Object} bounds - Leaflet bounds object
 * @returns {Promise<Object>} - GeoJSON object
 */
export async function fetchStreetGeoJSON(bounds) {
    try {
        const query = buildQuery(bounds);
        const response = await fetch(OVERPASS_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `data=${encodeURIComponent(query)}`
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Convert OSM data to GeoJSON
        const osmtogeojson = await import('https://cdn.skypack.dev/osmtogeojson');
        return osmtogeojson.default(data);
    } catch (error) {
        console.error('Error fetching street data:', error);
        throw error;
    }
}

/**
 * Throttled version of fetchStreetGeoJSON to prevent API abuse
 * @param {Object} bounds - Leaflet bounds object
 * @returns {Promise<Object>} - GeoJSON object
 */
export const throttledFetchStreets = (() => {
    let lastCall = 0;
    const THROTTLE_MS = 2000; // Minimum 2 seconds between calls

    return async (bounds) => {
        const now = Date.now();
        if (now - lastCall < THROTTLE_MS) {
            await new Promise(resolve => setTimeout(resolve, THROTTLE_MS - (now - lastCall)));
        }
        lastCall = Date.now();
        return fetchStreetGeoJSON(bounds);
    };
})(); 