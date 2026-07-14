/**
 * app.js — Breeze Weather App Main Entry Point
 * 
 * Orchestrates the application: imports all modules, wires up event listeners,
 * manages the fetch-display pipeline, and handles geolocation.
 * 
 * Usage in HTML:
 *   <script type="module" src="js/app.js"></script>
 */

import {
  getApiKey,
  setApiKey,
  getLastCity,
  setLastCity,
  fetchWeatherByCity,
  fetchWeatherByCoords,
} from './api.js';

import {
  renderWeather,
  showLoading,
  hideLoading,
  showError,
  hideError,
  updateTheme,
  toggleUnit,
  showApiModal,
  hideApiModal,
} from './ui.js';

import {
  initCanvas,
  setWeatherAnimation,
  stopAnimation,
} from './animations.js';

// ─── Debounce Utility ────────────────────────────────────────────────────────

/**
 * Create a debounced version of a function.
 * The function will only execute after `delay` ms of inactivity.
 * 
 * @param {Function} fn — The function to debounce.
 * @param {number} delay — Delay in milliseconds.
 * @returns {Function} Debounced function.
 */
function debounce(fn, delay = 400) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ─── Fetch & Display Pipeline ────────────────────────────────────────────────

/**
 * Orchestrate the entire fetch-render cycle.
 * Shows loading → fetches data → renders UI → updates theme → starts animation.
 * On failure, shows an error toast.
 * 
 * @param {Function} fetchFn — An async function that returns OWM weather JSON.
 *   Should be a partial-applied call like () => fetchWeatherByCity('London', key).
 */
async function fetchAndDisplay(fetchFn) {
  showLoading();
  hideError();
  stopAnimation();

  try {
    const data = await fetchFn();

    // Persist the city name for auto-load on next visit
    if (data.name) {
      setLastCity(data.name);
    }

    // Render the weather data to DOM
    renderWeather(data);

    // Determine the weather type and icon code
    const weatherType = data.conditionType || 'clear';
    const iconCode = data.weather?.[0]?.icon || '01d';
    const isNight = iconCode.endsWith('n');

    // Update CSS theme
    updateTheme(weatherType, iconCode);

    // Determine the animation type string
    let animType;
    if (weatherType === 'clear') {
      animType = isNight ? 'clear-night' : 'clear-day';
    } else {
      animType = weatherType; // rain, snow, clouds, thunderstorm, mist, drizzle
    }

    setWeatherAnimation(animType);
  } catch (err) {
    showError(err.message || 'An unexpected error occurred.');
  } finally {
    hideLoading();
  }
}

// ─── Geolocation Helper ──────────────────────────────────────────────────────

/**
 * Attempt to get the user's current position via the Geolocation API
 * and fetch weather for those coordinates.
 */
function fetchByGeolocation() {
  const apiKey = getApiKey();
  if (!apiKey) {
    showApiModal();
    return;
  }

  if (!navigator.geolocation) {
    showError('Geolocation is not supported by your browser.');
    return;
  }

  // Show loading immediately — geolocation can take a moment
  showLoading();

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      fetchAndDisplay(() => fetchWeatherByCoords(latitude, longitude, apiKey));
    },
    (geoError) => {
      hideLoading();
      switch (geoError.code) {
        case geoError.PERMISSION_DENIED:
          showError(
            'Location access denied. Please allow location access or search for a city manually.'
          );
          break;
        case geoError.POSITION_UNAVAILABLE:
          showError('Location information is unavailable. Please search for a city manually.');
          break;
        case geoError.TIMEOUT:
          showError('Location request timed out. Please try again or search manually.');
          break;
        default:
          showError('Unable to determine your location. Please search for a city manually.');
      }
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000, // 5 minutes cache is fine for weather
    }
  );
}

// ─── Event Wiring ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialise the canvas animation system
  initCanvas();

  // 2. Grab references to interactive elements
  const saveApiKeyBtn = document.querySelector('#save-api-key');
  const apiKeyInput = document.querySelector('#api-key-input');
  const searchForm = document.querySelector('#search-form');
  const cityInput = document.querySelector('#city-input');
  const geoBtn = document.querySelector('#geo-btn');
  const unitToggleBtn = document.querySelector('#unit-toggle');

  // 3. Check for existing API key
  const existingKey = getApiKey();
  if (!existingKey) {
    showApiModal();
  } else {
    // Key exists — try to load last city or fallback to geolocation
    const lastCity = getLastCity();
    if (lastCity) {
      fetchAndDisplay(() => fetchWeatherByCity(lastCity, existingKey));
    } else {
      fetchByGeolocation();
    }
  }

  // ── Save API Key ──────────────────────────────────────────────────────

  if (saveApiKeyBtn) {
    saveApiKeyBtn.addEventListener('click', () => {
      const key = apiKeyInput?.value?.trim();
      if (!key) {
        showError('Please enter a valid API key.');
        return;
      }
      setApiKey(key);
      hideApiModal();
      // After saving key, try geolocation for first-time use
      fetchByGeolocation();
    });
  }

  // Also allow pressing Enter in the API key input
  if (apiKeyInput) {
    apiKeyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveApiKeyBtn?.click();
      }
    });
  }

  // ── Search Form ───────────────────────────────────────────────────────

  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const city = cityInput?.value?.trim();
      if (!city) {
        showError('Please enter a city name.');
        return;
      }
      const apiKey = getApiKey();
      if (!apiKey) {
        showApiModal();
        return;
      }
      fetchAndDisplay(() => fetchWeatherByCity(city, apiKey));
    });
  }

  // ── Geolocation Button ────────────────────────────────────────────────

  if (geoBtn) {
    geoBtn.addEventListener('click', debounce(() => {
      fetchByGeolocation();
    }, 500));
  }

  // ── Unit Toggle ───────────────────────────────────────────────────────

  if (unitToggleBtn) {
    unitToggleBtn.addEventListener('click', () => {
      toggleUnit();
    });
  }
});
