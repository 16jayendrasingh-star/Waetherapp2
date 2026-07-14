/**
 * animations.js — Breeze Weather App Canvas Animation Module
 * 
 * Full-viewport canvas-based particle effects for each weather condition.
 * Uses requestAnimationFrame for smooth ~60fps rendering. Manages its own
 * lifecycle: init, transition between types, and cleanup.
 * 
 * Particle systems:
 *   - Rain:         Angled falling lines, 80-150 particles
 *   - Drizzle:      Lighter/fewer rain lines, 40-60 particles
 *   - Snow:         Sine-wave drifting circles, 50-100 particles
 *   - Clear Day:    Subtle golden light rays, 3-4 rays
 *   - Clear Night:  Twinkling star dots, 40-60 particles
 *   - Thunderstorm: Rain + periodic lightning flash overlay
 *   - Mist/Fog:     CSS class toggle on overlay
 *   - Clouds:       CSS class toggle on overlay
 */

// ─── State ───────────────────────────────────────────────────────────────────

let canvas = null;
let ctx = null;
let rafId = null;
let particles = [];
let currentType = null;
let lightningTimer = null;

// Cached dimensions (updated on resize)
let W = 0;
let H = 0;

// For smooth transitions — we fade canvas opacity
let targetOpacity = 1;
let currentOpacity = 0;
const FADE_SPEED = 0.03; // per frame

// ─── Init ────────────────────────────────────────────────────────────────────

/**
 * Initialise the canvas: grab the element, set size to viewport,
 * and attach a resize listener.
 */
export function initCanvas() {
  canvas = document.querySelector('canvas#weather-canvas');
  if (!canvas) {
    console.warn('[animations] canvas#weather-canvas not found in DOM.');
    return;
  }
  ctx = canvas.getContext('2d');
  _resize();
  window.addEventListener('resize', _debounceResize);
}

/** Set canvas dimensions to match the viewport. */
function _resize() {
  if (!canvas) return;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W;
  canvas.height = H;
}

let resizeTimer = null;
function _debounceResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(_resize, 150);
}

// ─── Master Controller ───────────────────────────────────────────────────────

/**
 * Set the active weather animation type.
 * Gracefully transitions from the current animation to the new one.
 * 
 * @param {string} type — One of: 'clear-day', 'clear-night', 'clouds',
 *   'rain', 'drizzle', 'thunderstorm', 'snow', 'mist'
 */
export function setWeatherAnimation(type) {
  if (type === currentType) return; // no-op if already active

  // Clean up previous
  _stopRaf();
  _clearLightning();
  _clearOverlayClasses();

  currentType = type;
  particles = [];
  currentOpacity = 0; // fade-in fresh
  targetOpacity = 1;

  switch (type) {
    case 'clear-day':
      _initSunRays();
      _startLoop(_drawSunRays);
      break;

    case 'clear-night':
      _initStars();
      _startLoop(_drawStars);
      break;

    case 'clouds':
      // Clouds use CSS-driven overlay, no canvas particles needed
      _addOverlayClass('clouds-active');
      break;

    case 'rain':
      _initRain(120); // 80-150 range, 120 is a good middle
      _startLoop(_drawRain);
      break;

    case 'drizzle':
      _initDrizzle();
      _startLoop(_drawRain); // reuse rain draw, particles are lighter
      break;

    case 'thunderstorm':
      _initRain(140);
      _startLoop(_drawRain);
      _startLightning();
      break;

    case 'snow':
      _initSnow();
      _startLoop(_drawSnow);
      break;

    case 'mist':
      _addOverlayClass('fog-active');
      break;

    default:
      // Unknown type — fall back to clear day
      _initSunRays();
      _startLoop(_drawSunRays);
      break;
  }
}

/**
 * Stop and clean up the current animation.
 */
export function stopAnimation() {
  _stopRaf();
  _clearLightning();
  _clearOverlayClasses();
  currentType = null;
  particles = [];

  // Clear the canvas
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// ─── RAF Management ──────────────────────────────────────────────────────────

function _startLoop(drawFn) {
  if (!ctx) return;
  function loop() {
    // Smooth opacity transition
    if (currentOpacity < targetOpacity) {
      currentOpacity = Math.min(currentOpacity + FADE_SPEED, targetOpacity);
    }
    canvas.style.opacity = currentOpacity;

    ctx.clearRect(0, 0, W, H);
    drawFn();
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);
}

function _stopRaf() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

// ─── Overlay Class Helpers ───────────────────────────────────────────────────

const OVERLAY_CLASSES = ['fog-active', 'clouds-active', 'lightning-flash'];

function _addOverlayClass(cls) {
  const overlay = document.querySelector('.weather-overlay');
  if (overlay) overlay.classList.add(cls);
}

function _removeOverlayClass(cls) {
  const overlay = document.querySelector('.weather-overlay');
  if (overlay) overlay.classList.remove(cls);
}

function _clearOverlayClasses() {
  const overlay = document.querySelector('.weather-overlay');
  if (!overlay) return;
  OVERLAY_CLASSES.forEach((cls) => overlay.classList.remove(cls));
}

// ─── Rain Particles ──────────────────────────────────────────────────────────

function _initRain(count = 120) {
  particles = [];
  const num = _clamp(count, 80, 150);
  for (let i = 0; i < num; i++) {
    particles.push(_createRainDrop());
  }
}

function _createRainDrop() {
  return {
    x: Math.random() * (W + 100) - 50,      // allow off-screen start for angle
    y: Math.random() * H - H,                // start above viewport
    length: 15 + Math.random() * 20,          // line length
    speed: 8 + Math.random() * 8,             // fall speed
    opacity: 0.2 + Math.random() * 0.5,       // transparency variation
    wind: 2 + Math.random() * 2,              // horizontal drift (angled rain)
  };
}

function _drawRain() {
  ctx.lineCap = 'round';
  for (const p of particles) {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + p.wind * 2, p.y + p.length);
    ctx.strokeStyle = `rgba(174, 194, 224, ${p.opacity})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Update position
    p.y += p.speed;
    p.x += p.wind;

    // Reset when off-screen
    if (p.y > H + p.length) {
      p.y = -p.length;
      p.x = Math.random() * (W + 100) - 50;
    }
  }
}

// ─── Drizzle (lighter rain) ──────────────────────────────────────────────────

function _initDrizzle() {
  particles = [];
  const num = 40 + Math.floor(Math.random() * 20); // 40-60
  for (let i = 0; i < num; i++) {
    particles.push({
      x: Math.random() * W,
      y: Math.random() * H - H,
      length: 8 + Math.random() * 8,            // shorter lines
      speed: 4 + Math.random() * 4,             // slower
      opacity: 0.15 + Math.random() * 0.3,
      wind: 0.5 + Math.random() * 1,
    });
  }
}

// ─── Snow Particles ──────────────────────────────────────────────────────────

function _initSnow() {
  particles = [];
  const num = 50 + Math.floor(Math.random() * 50); // 50-100
  for (let i = 0; i < num; i++) {
    particles.push(_createSnowflake());
  }
}

function _createSnowflake() {
  return {
    x: Math.random() * W,
    y: Math.random() * H - H,
    radius: 2 + Math.random() * 4,
    speed: 0.8 + Math.random() * 2,
    opacity: 0.4 + Math.random() * 0.5,
    drift: Math.random() * Math.PI * 2, // phase for sine-wave horizontal movement
    driftSpeed: 0.01 + Math.random() * 0.02,
    driftAmplitude: 30 + Math.random() * 40,
  };
}

function _drawSnow() {
  for (const p of particles) {
    ctx.beginPath();
    ctx.arc(p.x + Math.sin(p.drift) * p.driftAmplitude, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
    ctx.fill();

    // Update
    p.y += p.speed;
    p.drift += p.driftSpeed;

    // Reset when off-screen
    if (p.y > H + p.radius * 2) {
      p.y = -p.radius * 2;
      p.x = Math.random() * W;
      p.drift = Math.random() * Math.PI * 2;
    }
  }
}

// ─── Clear Day (Sun Rays) ────────────────────────────────────────────────────

let rays = [];

function _initSunRays() {
  rays = [];
  const numRays = 3 + Math.floor(Math.random() * 2); // 3-4 rays
  for (let i = 0; i < numRays; i++) {
    rays.push({
      angle: (Math.PI / 6) + (i * Math.PI) / (numRays + 1), // spread across top
      width: 60 + Math.random() * 100,
      opacity: 0.03 + Math.random() * 0.04, // very subtle
      speed: 0.0005 + Math.random() * 0.001,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

function _drawSunRays() {
  // Origin: top-right area (where the "sun" conceptually is)
  const originX = W * 0.8;
  const originY = -20;
  const rayLength = Math.max(W, H) * 1.5;

  for (const r of rays) {
    const pulse = 0.5 + 0.5 * Math.sin(r.phase); // 0-1 pulsation
    const alpha = r.opacity * (0.6 + 0.4 * pulse);

    ctx.save();
    ctx.translate(originX, originY);
    ctx.rotate(r.angle);

    const grad = ctx.createLinearGradient(0, 0, rayLength, 0);
    grad.addColorStop(0, `rgba(255, 223, 100, ${alpha})`);
    grad.addColorStop(1, 'rgba(255, 223, 100, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -r.width / 2);
    ctx.lineTo(rayLength, -r.width * 1.5);
    ctx.lineTo(rayLength, r.width * 1.5);
    ctx.lineTo(0, r.width / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Gentle oscillation
    r.phase += r.speed;
  }
}

// ─── Clear Night (Stars) ─────────────────────────────────────────────────────

function _initStars() {
  particles = [];
  const num = 40 + Math.floor(Math.random() * 20); // 40-60
  for (let i = 0; i < num; i++) {
    particles.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.7, // mostly upper portion of sky
      radius: 0.5 + Math.random() * 2,
      baseOpacity: 0.3 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.01 + Math.random() * 0.04,
    });
  }
}

function _drawStars() {
  for (const s of particles) {
    const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(s.phase));
    const alpha = s.baseOpacity * twinkle;

    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 240, ${alpha})`;
    ctx.fill();

    // Subtle glow for larger stars
    if (s.radius > 1.2) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius * 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 240, ${alpha * 0.1})`;
      ctx.fill();
    }

    s.phase += s.twinkleSpeed;
  }
}

// ─── Thunderstorm (Lightning Flash) ──────────────────────────────────────────

function _startLightning() {
  _clearLightning();
  _scheduleLightning();
}

function _scheduleLightning() {
  // Random interval between flashes: 3-8 seconds
  const delay = 3000 + Math.random() * 5000;
  lightningTimer = setTimeout(() => {
    _flash();
    _scheduleLightning(); // schedule next
  }, delay);
}

function _flash() {
  const overlay = document.querySelector('.weather-overlay');
  if (!overlay) return;
  overlay.classList.add('lightning-flash');
  // Remove after brief flash
  setTimeout(() => overlay.classList.remove('lightning-flash'), 150);
  // Occasional double-flash
  if (Math.random() > 0.5) {
    setTimeout(() => {
      overlay.classList.add('lightning-flash');
      setTimeout(() => overlay.classList.remove('lightning-flash'), 100);
    }, 250);
  }
}

function _clearLightning() {
  if (lightningTimer) {
    clearTimeout(lightningTimer);
    lightningTimer = null;
  }
  _removeOverlayClass('lightning-flash');
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function _clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}
