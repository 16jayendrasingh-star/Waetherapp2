/**
 * ui.js — Breeze Weather App UI Module
 * 
 * Manages all DOM interactions: rendering weather data, showing/hiding
 * loading & error states, theme updates, unit toggling, SVG weather icons,
 * and various formatting utilities.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const UNIT_KEY = 'breeze_unit'; // localStorage key for temperature unit
let errorTimeout = null;        // reference for auto-dismiss timer
let currentData = null;         // cached weather data for unit toggling

// ─── DOM Element Getters (lazy, resilient) ───────────────────────────────────

const $ = (sel) => document.querySelector(sel);

// ─── Country Code → Flag Emoji ───────────────────────────────────────────────

/**
 * Convert a 2-letter ISO country code to its corresponding flag emoji.
 * Works by offsetting each letter into the Regional Indicator Symbol range.
 * 
 * @param {string} countryCode — e.g. "US", "GB", "IN"
 * @returns {string} Flag emoji, or empty string if invalid.
 */
export function countryCodeToFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '';
  const cc = countryCode.toUpperCase();
  const first = 0x1F1E6 + (cc.charCodeAt(0) - 65);
  const second = 0x1F1E6 + (cc.charCodeAt(1) - 65);
  return String.fromCodePoint(first, second);
}

// ─── Time Formatting ─────────────────────────────────────────────────────────

/**
 * Format a Unix timestamp (seconds) to a local time string.
 * Uses the timezone offset from the weather data if available.
 * 
 * @param {number} unixTimestamp — Seconds since epoch (UTC).
 * @param {number} [timezoneOffset=0] — Timezone offset in seconds from UTC (from OWM data).
 * @returns {string} Formatted time, e.g. "6:32 AM".
 */
export function formatTime(unixTimestamp, timezoneOffset = 0) {
  if (!unixTimestamp) return '--:--';
  // OWM gives UTC timestamp + timezone offset in seconds
  const date = new Date((unixTimestamp + timezoneOffset) * 1000);
  // Use UTC methods since we already applied the offset
  let hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const amPm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${String(minutes).padStart(2, '0')} ${amPm}`;
}

// ─── Wind Direction ──────────────────────────────────────────────────────────

/**
 * Convert wind direction in degrees to a compass direction string.
 * 
 * @param {number} deg — Degrees (0-360).
 * @returns {string} Compass direction, e.g. "N", "NE", "SW".
 */
export function windDegToDirection(deg) {
  if (deg == null || isNaN(deg)) return '--';
  // Normalize to 0-360
  const d = ((deg % 360) + 360) % 360;
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(d / 45) % 8;
  return directions[index];
}

// ─── Temperature Unit ────────────────────────────────────────────────────────

/**
 * Get the currently selected temperature unit.
 * @returns {'C'|'F'} The unit character.
 */
function getUnit() {
  return localStorage.getItem(UNIT_KEY) || 'C';
}

/**
 * Convert Celsius to Fahrenheit.
 * @param {number} c — Temperature in Celsius.
 * @returns {number} Temperature in Fahrenheit.
 */
function cToF(c) {
  return (c * 9) / 5 + 32;
}

/**
 * Format a temperature value according to the current unit.
 * @param {number} tempC — Temperature in Celsius (as returned by OWM with units=metric).
 * @returns {string} Rounded temperature string (no degree symbol).
 */
function formatTemp(tempC) {
  if (tempC == null || isNaN(tempC)) return '--';
  const unit = getUnit();
  const value = unit === 'F' ? cToF(tempC) : tempC;
  return Math.round(value).toString();
}

// ─── SVG Weather Icons ───────────────────────────────────────────────────────

/**
 * Return an inline SVG string representing the given weather condition.
 * Icons are designed to be 64×64 and use soft, rounded strokes.
 * 
 * @param {string} weatherMain — Simplified weather type (clear, clouds, rain, snow, thunderstorm, mist, drizzle).
 * @param {string} iconCode — OWM icon code (e.g. "01d", "09n"). Ending in 'n' = night.
 * @returns {string} SVG markup string.
 */
export function getWeatherIcon(weatherMain, iconCode) {
  const isNight = iconCode && iconCode.endsWith('n');
  const type = (weatherMain || '').toLowerCase();

  switch (type) {
    case 'clear':
      return isNight ? _svgMoon() : _svgSun();
    case 'clouds':
      return isNight ? _svgCloudNight() : _svgCloudDay();
    case 'rain':
      return _svgRain();
    case 'drizzle':
      return _svgDrizzle();
    case 'thunderstorm':
      return _svgThunderstorm();
    case 'snow':
      return _svgSnow();
    case 'mist':
      return _svgMist();
    default:
      return isNight ? _svgMoon() : _svgSun();
  }
}

function _svgSun() {
  return `<svg viewBox="0 0 64 64" width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="12" fill="#FFD93D" stroke="#F5A623" stroke-width="2"/>
    <g stroke="#FFD93D" stroke-width="2.5" stroke-linecap="round">
      <line x1="32" y1="4" x2="32" y2="12"/>
      <line x1="32" y1="52" x2="32" y2="60"/>
      <line x1="4" y1="32" x2="12" y2="32"/>
      <line x1="52" y1="32" x2="60" y2="32"/>
      <line x1="12.2" y1="12.2" x2="17.9" y2="17.9"/>
      <line x1="46.1" y1="46.1" x2="51.8" y2="51.8"/>
      <line x1="12.2" y1="51.8" x2="17.9" y2="46.1"/>
      <line x1="46.1" y1="17.9" x2="51.8" y2="12.2"/>
    </g>
  </svg>`;
}

function _svgMoon() {
  return `<svg viewBox="0 0 64 64" width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M40 12 A20 20 0 1 0 52 40 A16 16 0 0 1 40 12Z" fill="#E8D5A3" stroke="#C9B458" stroke-width="1.5"/>
    <circle cx="48" cy="10" r="1.5" fill="#E8D5A3" opacity="0.6"/>
    <circle cx="54" cy="20" r="1" fill="#E8D5A3" opacity="0.4"/>
    <circle cx="56" cy="14" r="0.8" fill="#E8D5A3" opacity="0.5"/>
  </svg>`;
}

function _svgCloudDay() {
  return `<svg viewBox="0 0 64 64" width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="22" cy="22" r="8" fill="#FFD93D" stroke="#F5A623" stroke-width="1.5"/>
    <g stroke="#FFD93D" stroke-width="2" stroke-linecap="round">
      <line x1="22" y1="8" x2="22" y2="12"/>
      <line x1="10" y1="16" x2="13" y2="18"/>
      <line x1="10" y1="28" x2="13" y2="26"/>
      <line x1="8" y1="22" x2="12" y2="22"/>
    </g>
    <path d="M48 44 A8 8 0 0 0 40 36 A10 10 0 0 0 22 34 A10 10 0 0 0 14 44 Z"
          fill="#E0E8F0" stroke="#B0BEC5" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`;
}

function _svgCloudNight() {
  return `<svg viewBox="0 0 64 64" width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M26 10 A10 10 0 1 0 36 22 A8 8 0 0 1 26 10Z" fill="#E8D5A3" stroke="#C9B458" stroke-width="1"/>
    <path d="M48 44 A8 8 0 0 0 40 36 A10 10 0 0 0 22 34 A10 10 0 0 0 14 44 Z"
          fill="#C5CDE0" stroke="#8E99A8" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`;
}

function _svgRain() {
  return `<svg viewBox="0 0 64 64" width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 32 A8 8 0 0 0 42 24 A10 10 0 0 0 24 22 A10 10 0 0 0 16 32 Z"
          fill="#B0BEC5" stroke="#78909C" stroke-width="1.5" stroke-linejoin="round"/>
    <g stroke="#5C9CE6" stroke-width="2" stroke-linecap="round">
      <line x1="22" y1="38" x2="18" y2="50"/>
      <line x1="30" y1="38" x2="26" y2="50"/>
      <line x1="38" y1="38" x2="34" y2="50"/>
      <line x1="26" y1="52" x2="23" y2="60"/>
      <line x1="34" y1="52" x2="31" y2="60"/>
    </g>
  </svg>`;
}

function _svgDrizzle() {
  return `<svg viewBox="0 0 64 64" width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 32 A8 8 0 0 0 42 24 A10 10 0 0 0 24 22 A10 10 0 0 0 16 32 Z"
          fill="#CFD8DC" stroke="#90A4AE" stroke-width="1.5" stroke-linejoin="round"/>
    <g stroke="#82B1E6" stroke-width="1.5" stroke-linecap="round" opacity="0.7">
      <line x1="24" y1="40" x2="22" y2="46"/>
      <line x1="32" y1="40" x2="30" y2="46"/>
      <line x1="40" y1="40" x2="38" y2="46"/>
    </g>
  </svg>`;
}

function _svgThunderstorm() {
  return `<svg viewBox="0 0 64 64" width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 28 A8 8 0 0 0 42 20 A10 10 0 0 0 24 18 A10 10 0 0 0 16 28 Z"
          fill="#78909C" stroke="#546E7A" stroke-width="1.5" stroke-linejoin="round"/>
    <polygon points="30,32 26,44 32,44 28,58 40,40 34,40 38,32"
             fill="#FFD93D" stroke="#F5A623" stroke-width="1" stroke-linejoin="round"/>
  </svg>`;
}

function _svgSnow() {
  return `<svg viewBox="0 0 64 64" width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 30 A8 8 0 0 0 42 22 A10 10 0 0 0 24 20 A10 10 0 0 0 16 30 Z"
          fill="#E0E8F0" stroke="#B0BEC5" stroke-width="1.5" stroke-linejoin="round"/>
    <g fill="#A8D0E6">
      <circle cx="22" cy="40" r="2.5"/>
      <circle cx="33" cy="42" r="2"/>
      <circle cx="42" cy="39" r="2.5"/>
      <circle cx="27" cy="52" r="2"/>
      <circle cx="37" cy="54" r="2.5"/>
    </g>
  </svg>`;
}

function _svgMist() {
  return `<svg viewBox="0 0 64 64" width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g stroke="#90A4AE" stroke-width="2.5" stroke-linecap="round" opacity="0.6">
      <line x1="10" y1="20" x2="54" y2="20"/>
      <line x1="14" y1="28" x2="50" y2="28"/>
      <line x1="8"  y1="36" x2="56" y2="36"/>
      <line x1="14" y1="44" x2="50" y2="44"/>
      <line x1="10" y1="52" x2="54" y2="52"/>
    </g>
  </svg>`;
}

// ─── Render Weather Data ─────────────────────────────────────────────────────

/**
 * Populate all DOM elements with weather data from the OWM response.
 * Caches the data so unit toggling can re-render without a new fetch.
 * 
 * @param {Object} data — Parsed OWM JSON (with our added `conditionType`).
 */
export function renderWeather(data) {
  if (!data) return;
  currentData = data;

  const unit = getUnit();

  // City name & country flag
  const cityEl = $('#city-name');
  const flagEl = $('#country-flag');
  if (cityEl) cityEl.textContent = data.name || 'Unknown';
  if (flagEl) flagEl.textContent = data.sys ? countryCodeToFlag(data.sys.country) : '';

  // Animated weather icon
  const iconContainer = $('#weather-icon-container');
  if (iconContainer && data.weather && data.weather[0]) {
    iconContainer.innerHTML = getWeatherIcon(
      data.conditionType,
      data.weather[0].icon
    );
  }

  // Temperature
  const tempEl = $('#temperature');
  if (tempEl) tempEl.textContent = formatTemp(data.main?.temp);

  // Unit toggle button label
  const unitBtn = $('#unit-toggle');
  if (unitBtn) unitBtn.textContent = unit === 'C' ? '°F' : '°C';

  // Description
  const descEl = $('#weather-description');
  if (descEl && data.weather && data.weather[0]) {
    // Capitalize first letter of each word
    const raw = data.weather[0].description || '';
    descEl.textContent = raw.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // Detail cards
  _setDetail('feels-like', `${formatTemp(data.main?.feels_like)}°${unit}`);
  _setDetail('humidity', `${data.main?.humidity ?? '--'}%`);

  // Wind — speed in m/s with direction
  const windSpeed = data.wind?.speed != null ? `${data.wind.speed.toFixed(1)} m/s` : '-- m/s';
  const windDir = windDegToDirection(data.wind?.deg);
  _setDetail('wind', `${windSpeed} ${windDir}`);

  _setDetail('pressure', `${data.main?.pressure ?? '--'} hPa`);

  // Visibility — OWM returns meters, convert to km
  const visKm = data.visibility != null ? (data.visibility / 1000).toFixed(1) : '--';
  _setDetail('visibility', `${visKm} km`);

  // Sunrise & Sunset
  const tz = data.timezone || 0;
  const sunrise = data.sys?.sunrise ? formatTime(data.sys.sunrise, tz) : '--:--';
  const sunset = data.sys?.sunset ? formatTime(data.sys.sunset, tz) : '--:--';
  _setDetail('sunrise-sunset', `${sunrise} / ${sunset}`);

  // Ensure weather container is visible
  const container = $('#weather-container');
  if (container) { container.style.display = ''; container.classList.remove('hidden'); }
}

/**
 * Helper: set the text content of a detail card by its data-type attribute.
 * @param {string} type — The data-type value.
 * @param {string} value — The text to display.
 */
function _setDetail(type, value) {
  const card = document.querySelector(`.detail-card[data-type="${type}"]`);
  if (!card) return;
  // Try to find a dedicated value element inside the card; fallback to a span
  const valueEl =
    card.querySelector('.detail-value') ||
    card.querySelector('[data-value]') ||
    card.querySelector('span:last-child') ||
    card.querySelector('p');
  if (valueEl) {
    valueEl.textContent = value;
  }
}

// ─── Loading State ───────────────────────────────────────────────────────────

/**
 * Show the loading indicator and hide the weather container.
 */
export function showLoading() {
  const loader = $('#loading-container');
  const weather = $('#weather-container');
  if (loader) { loader.style.display = ''; loader.classList.remove('hidden'); }
  if (weather) { weather.style.display = 'none'; weather.classList.add('hidden'); }
}

/**
 * Hide the loading indicator.
 */
export function hideLoading() {
  const loader = $('#loading-container');
  if (loader) { loader.style.display = 'none'; loader.classList.add('hidden'); }
}

// ─── Error Toast ─────────────────────────────────────────────────────────────

/**
 * Show an error message toast that auto-dismisses after 4 seconds.
 * @param {string} msg — The error message to display.
 */
export function showError(msg) {
  const container = $('#error-container');
  const messageEl = $('#error-message');
  if (!container) return;

  if (messageEl) messageEl.textContent = msg;
  container.style.display = 'flex';
  container.classList.remove('hidden');
  // Trigger reflow so CSS transition plays
  void container.offsetWidth;
  container.classList.add('show');

  // Clear any existing timeout so rapid calls don't cause premature dismissal
  if (errorTimeout) clearTimeout(errorTimeout);
  errorTimeout = setTimeout(() => hideError(), 4000);
}

/**
 * Immediately hide the error toast.
 */
export function hideError() {
  const container = $('#error-container');
  if (container) {
    container.classList.remove('show');
    // Wait for transition before hiding
    setTimeout(() => { container.style.display = 'none'; }, 500);
  }
  if (errorTimeout) {
    clearTimeout(errorTimeout);
    errorTimeout = null;
  }
}

// ─── Theme / Body Attributes ─────────────────────────────────────────────────

/**
 * Update the <body> element's data attributes for CSS theming.
 * Sets `data-weather` (e.g. "rain", "clear") and `data-time` ("day" | "night").
 * 
 * @param {string} weatherMain — Simplified weather type.
 * @param {string} iconCode — OWM icon code; codes ending in 'n' indicate night.
 */
export function updateTheme(weatherMain, iconCode) {
  const isNight = iconCode && iconCode.endsWith('n');
  document.body.setAttribute('data-weather', (weatherMain || 'clear').toLowerCase());
  document.body.setAttribute('data-time', isNight ? 'night' : 'day');
}

// ─── Unit Toggle ─────────────────────────────────────────────────────────────

/**
 * Toggle the temperature unit between Celsius and Fahrenheit.
 * Re-renders the weather display with the new unit (client-side conversion).
 */
export function toggleUnit() {
  const current = getUnit();
  const next = current === 'C' ? 'F' : 'C';
  localStorage.setItem(UNIT_KEY, next);

  // Re-render with cached data
  if (currentData) {
    renderWeather(currentData);
  } else {
    // No data yet — just update the button label
    const unitBtn = $('#unit-toggle');
    if (unitBtn) unitBtn.textContent = next === 'C' ? '°F' : '°C';
  }
}

// ─── API Key Modal ───────────────────────────────────────────────────────────

/**
 * Show the API key entry modal.
 */
export function showApiModal() {
  const modal = $('#api-modal');
  if (modal) {
    modal.style.display = '';
    modal.classList.remove('hidden');
    // Small delay to trigger CSS transition
    requestAnimationFrame(() => modal.classList.add('active'));
    // Focus the input for convenience
    const input = $('#api-key-input');
    if (input) setTimeout(() => input.focus(), 100);
  }
}

/**
 * Hide the API key entry modal.
 */
export function hideApiModal() {
  const modal = $('#api-modal');
  if (modal) {
    modal.classList.remove('active');
    // Wait for CSS transition to finish
    setTimeout(() => { modal.style.display = 'none'; }, 500);
  }
}
