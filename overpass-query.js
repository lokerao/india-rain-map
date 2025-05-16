/**
 * Utility functions for fetching street data from Overpass API
 */

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
const streetCache = new Map();

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
            way["highway"~"^(primary|secondary|tertiary|residential)$"]["name"]
                (${south},${west},${north},${east});
        );
        out body;
        >;
        out skel qt;
    `;
}

/**
 * Creates a cache key from bounds
 * @param {Object} bounds - Leaflet bounds object
 * @returns {string} - Cache key
 */
function getCacheKey(bounds) {
    const precision = 3; // Reduce precision to group similar areas
    return `${bounds.getSouth().toFixed(precision)},${bounds.getWest().toFixed(precision)},${bounds.getNorth().toFixed(precision)},${bounds.getEast().toFixed(precision)}`;
}

/**
 * Fetches street data for given bounds
 * @param {Object} bounds - Leaflet bounds object
 * @returns {Promise<Object>} - GeoJSON object
 */
export async function fetchStreetGeoJSON(bounds) {
    const cacheKey = getCacheKey(bounds);
    const cached = streetCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
        return cached.data;
    }

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
        const osmtogeojson = await import('osmtogeojson');
        const geoJSON = osmtogeojson.default(data);

        // Cache the result
        streetCache.set(cacheKey, {
            data: geoJSON,
            timestamp: Date.now()
        });

        // Clean up old cache entries
        const now = Date.now();
        for (const [key, value] of streetCache) {
            if (now - value.timestamp > CACHE_DURATION) {
                streetCache.delete(key);
            }
        }

        return geoJSON;
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
    let pendingPromise = null;

    return async (bounds) => {
        const now = Date.now();
        if (pendingPromise) {
            return pendingPromise;
        }
        
        if (now - lastCall < THROTTLE_MS) {
            await new Promise(resolve => setTimeout(resolve, THROTTLE_MS - (now - lastCall)));
        }
        
        lastCall = Date.now();
        try {
            pendingPromise = fetchStreetGeoJSON(bounds);
            const result = await pendingPromise;
            return result;
        } finally {
            pendingPromise = null;
        }
    };
})(); 