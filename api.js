/**
 * api.js — Breeze Weather App API Module
 * 
 * Handles all data persistence (localStorage) and OpenWeatherMap API interactions.
 * Exports functions for API key management, city persistence, weather fetching,
 * and weather condition code mapping.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const OWM_BASE = 'https://api.openweathermap.org/data/2.5/weather';
const STORAGE_KEYS = {
  apiKey: 'breeze_api_key',
  lastCity: 'breeze_last_city',
};

// ─── OWM Condition Code → Simplified Type Mapping ───────────────────────────
// Reference: https://openweathermap.org/weather-conditions
// Group IDs: 2xx = Thunderstorm, 3xx = Drizzle, 5xx = Rain,
//            6xx = Snow, 7xx = Atmosphere, 800 = Clear, 80x = Clouds

const CONDITION_MAP = {
  // Thunderstorm group (2xx)
  200: 'thunderstorm', 201: 'thunderstorm', 202: 'thunderstorm',
  210: 'thunderstorm', 211: 'thunderstorm', 212: 'thunderstorm',
  221: 'thunderstorm', 230: 'thunderstorm', 231: 'thunderstorm',
  232: 'thunderstorm',

  // Drizzle group (3xx)
  300: 'drizzle', 301: 'drizzle', 302: 'drizzle',
  310: 'drizzle', 311: 'drizzle', 312: 'drizzle',
  313: 'drizzle', 314: 'drizzle', 321: 'drizzle',

  // Rain group (5xx)
  500: 'rain', 501: 'rain', 502: 'rain', 503: 'rain', 504: 'rain',
  511: 'rain', 520: 'rain', 521: 'rain', 522: 'rain', 531: 'rain',

  // Snow group (6xx)
  600: 'snow', 601: 'snow', 602: 'snow',
  611: 'snow', 612: 'snow', 613: 'snow',
  615: 'snow', 616: 'snow',
  620: 'snow', 621: 'snow', 622: 'snow',

  // Atmosphere group (7xx) — mist, fog, haze, etc.
  701: 'mist', 711: 'mist', 721: 'mist', 731: 'mist',
  741: 'mist', 751: 'mist', 761: 'mist', 762: 'mist',
  771: 'mist', 781: 'mist',

  // Clear (800)
  800: 'clear',

  // Clouds (80x)
  801: 'clouds', 802: 'clouds', 803: 'clouds', 804: 'clouds',
};

// ─── LocalStorage Helpers ────────────────────────────────────────────────────

/**
 * Retrieve the saved OpenWeatherMap API key from localStorage.
 * @returns {string|null} The API key, or null if not set.
 */
export function getApiKey() {
  return localStorage.getItem(STORAGE_KEYS.apiKey);
}

/**
 * Save the OpenWeatherMap API key to localStorage.
 * @param {string} key — The API key to persist.
 */
export function setApiKey(key) {
  localStorage.setItem(STORAGE_KEYS.apiKey, key.trim());
}

/**
 * Retrieve the last searched city from localStorage.
 * @returns {string|null} The city name, or null if not set.
 */
export function getLastCity() {
  return localStorage.getItem(STORAGE_KEYS.lastCity);
}

/**
 * Save the last searched city name to localStorage.
 * @param {string} city — The city name to persist.
 */
export function setLastCity(city) {
  localStorage.setItem(STORAGE_KEYS.lastCity, city.trim());
}

// ─── API Fetching ────────────────────────────────────────────────────────────

/**
 * Internal helper that performs the actual fetch, handles HTTP errors,
 * and returns parsed JSON.
 * 
 * @param {string} url — Fully-formed OWM API URL.
 * @returns {Promise<Object>} Parsed weather data with an added `conditionType` field.
 * @throws {Error} User-friendly error messages for common failure modes.
 */
async function _fetchWeather(url) {
  let response;

  try {
    response = await fetch(url);
  } catch (networkError) {
    // fetch() itself rejected — network issue, CORS, DNS, offline, etc.
    throw new Error(
      'Unable to reach the weather service. Please check your internet connection and try again.'
    );
  }

  // Handle HTTP error statuses with friendly messages
  if (!response.ok) {
    switch (response.status) {
      case 401:
        throw new Error(
          'Invalid API key. Please check your OpenWeatherMap API key and try again.'
        );
      case 404:
        throw new Error(
          'City not found. Please check the spelling and try again.'
        );
      case 429:
        throw new Error(
          'Too many requests. The free API tier is rate-limited — please wait a minute and try again.'
        );
      default:
        throw new Error(
          `Weather service returned an error (${response.status}). Please try again later.`
        );
    }
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Received an invalid response from the weather service.');
  }

  // Attach our simplified condition type for easy consumption by UI / animations
  if (data.weather && data.weather.length > 0) {
    const conditionId = data.weather[0].id;
    data.conditionType = CONDITION_MAP[conditionId] || 'clear';
  } else {
    data.conditionType = 'clear';
  }

  return data;
}

/**
 * Fetch weather data for a given city name.
 * 
 * @param {string} city — City name (e.g. "London", "Tokyo,JP").
 * @param {string} apiKey — OpenWeatherMap API key.
 * @returns {Promise<Object>} Parsed weather JSON with `conditionType`.
 */
export async function fetchWeatherByCity(city, apiKey) {
  if (!city || !city.trim()) {
    throw new Error('Please enter a city name.');
  }
  if (!apiKey || !apiKey.trim()) {
    throw new Error('API key is missing. Please set your OpenWeatherMap API key.');
  }

  const url = `${OWM_BASE}?q=${encodeURIComponent(city.trim())}&appid=${encodeURIComponent(apiKey.trim())}&units=metric`;
  return _fetchWeather(url);
}

/**
 * Fetch weather data for geographic coordinates.
 * 
 * @param {number} lat — Latitude.
 * @param {number} lon — Longitude.
 * @param {string} apiKey — OpenWeatherMap API key.
 * @returns {Promise<Object>} Parsed weather JSON with `conditionType`.
 */
export async function fetchWeatherByCoords(lat, lon, apiKey) {
  if (lat == null || lon == null) {
    throw new Error('Geographic coordinates are missing.');
  }
  if (!apiKey || !apiKey.trim()) {
    throw new Error('API key is missing. Please set your OpenWeatherMap API key.');
  }

  const url = `${OWM_BASE}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&appid=${encodeURIComponent(apiKey.trim())}&units=metric`;
  return _fetchWeather(url);
}

/**
 * Map an OWM weather condition code to a simplified type string.
 * Useful when you already have the code and just need the type.
 * 
 * @param {number} code — OWM condition code (e.g. 500, 800).
 * @returns {string} One of: clear, clouds, rain, thunderstorm, snow, mist, drizzle.
 */
export function mapConditionCode(code) {
  return CONDITION_MAP[code] || 'clear';
}
