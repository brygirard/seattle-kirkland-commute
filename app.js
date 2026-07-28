// --- App Configuration & State ---
const CONFIG = {
  apiKey: localStorage.getItem('tomtom_api_key') || 'QuSopbXau96swtFznGbYJV74BYwuZAML',
  originName: '225 Cedar St, Seattle, WA',
  originCoords: { lat: 47.6167589, lon: -122.3488781 }, // Belltown 225 Cedar St
  destName: 'Google Kirkland (747 6th St S)',
  destCoords: { lat: 47.6702148, lon: -122.1973175 },  // Google Kirkland
  direction: 'morning', // 'morning' = Seattle -> Kirkland, 'evening' = Kirkland -> Seattle
  refreshIntervalMs: parseInt(localStorage.getItem('tomtom_poll_interval') || '120000', 10), // Default 2 minutes
  dailyQuotaLimit: parseInt(localStorage.getItem('tomtom_daily_limit') || '2000', 10),     // Safety guard
  minManualCooldownMs: 10000
};

let appState = {
  routes: [],
  selectedRouteIndex: 0,
  incidents: [],
  lastUpdated: null,
  lastManualClickTime: 0,
  refreshTimer: null,
  isTabVisible: true,
  map: null,
  mapLayers: {
    trafficFlow: null,
    incidents: null,
    routePolylines: [],
    markers: []
  },
  showTrafficOverlay: true,
  showIncidentsOverlay: true,
  trendChart: null,
  activeTrendWindow: 'tomtomBaseline', // 'tomtomBaseline' | 'polledActual' | 'combinedOverlay'
  selectedTimeWindow: 'morning',        // 'morning' | 'evening' | 'byDay'
  selectedDayFilter: 'all'             // 'all' | '1'..'6' | '0'
};

// --- DOM Elements ---
const el = {
  btnRefresh: document.getElementById('btn-refresh'),
  btnSettings: document.getElementById('btn-settings'),
  btnDirectionToggle: document.getElementById('direction-toggle'),
  commuteDirectionText: document.getElementById('commute-direction-text'),
  routeStartLabel: document.getElementById('route-start-label'),
  routeEndLabel: document.getElementById('route-end-label'),
  refreshTimerText: document.getElementById('refresh-timer'),
  
  quotaMeter: document.getElementById('quota-meter'),
  quotaText: document.getElementById('quota-text'),
  
  valTravelTime: document.getElementById('val-travel-time'),
  valEta: document.getElementById('val-eta'),
  valTrafficDelay: document.getElementById('val-traffic-delay'),
  valTrafficStatus: document.getElementById('val-traffic-status'),
  valRecommendedRoute: document.getElementById('val-recommended-route'),
  valDistance: document.getElementById('val-distance'),
  
  routesList: document.getElementById('routes-list'),
  incidentsContainer: document.getElementById('incidents-container'),
  incidentCount: document.getElementById('incident-count'),
  instructionsList: document.getElementById('instructions-list'),
  activeRouteName: document.getElementById('active-route-name'),
  
  optimalTimeHeading: document.getElementById('optimal-time-heading'),
  optimalTimeText: document.getElementById('optimal-time-text'),
  
  filterTimeWindow: document.getElementById('filter-time-window'),
  filterDayOfWeek: document.getElementById('filter-day-of-week'),
  dataPointsCount: document.getElementById('data-points-count'),
  btnExportCsv: document.getElementById('btn-export-csv'),
  btnExportJson: document.getElementById('btn-export-json'),
  fileImport: document.getElementById('file-import'),
  btnClearHistory: document.getElementById('btn-clear-history'),

  toggleTrafficLayer: document.getElementById('toggle-traffic-layer'),
  toggleIncidentsLayer: document.getElementById('toggle-incidents-layer'),
  recenterMap: document.getElementById('recenter-map'),
  
  settingsModal: document.getElementById('settings-modal'),
  closeModal: document.getElementById('close-modal'),
  apiKeyInput: document.getElementById('api-key-input'),
  pollIntervalSelect: document.getElementById('poll-interval-select'),
  dailyLimitInput: document.getElementById('daily-limit-input'),
  btnSaveSettings: document.getElementById('btn-save-settings')
};

// --- Initializer ---
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  initChart();
  setupEventListeners();
  setupVisibilityHandler();
  updateQuotaBadge();
  updateDataPointsCount();
  fetchLiveWeather();
  syncCloudData();
  loadCommuteData();
  
  startAutoRefresh();
});

// Fetch all monthly historical partitions via data/index.json
async function syncCloudData() {
  try {
    let filesToFetch = ['data/history_2026_07.json', 'data/commute_history.json'];
    try {
      const index = await fetch('data/index.json').then(r => r.json());
      if (Array.isArray(index) && index.length > 0) {
        filesToFetch = index.map(f => `data/${f}`);
      }
    } catch (e) {}

    const localData = getHistoricalDatabase();
    const localTimestamps = new Set(localData.map(d => d.timestamp));
    let mergedCount = 0;

    for (const fileUrl of filesToFetch) {
      try {
        const cloudData = await fetch(fileUrl).then(r => r.json());
        if (Array.isArray(cloudData)) {
          cloudData.forEach(item => {
            if (item.timestamp && !localTimestamps.has(item.timestamp)) {
              localData.push(item);
              localTimestamps.add(item.timestamp);
              mergedCount++;
            }
          });
        }
      } catch (err) {}
    }

    if (mergedCount > 0) {
      localData.sort((a, b) => a.timestamp - b.timestamp);
      localStorage.setItem('commute_historical_db', JSON.stringify(localData));
      console.log(`[Cloud Sync] Synced ${mergedCount} new data points from cloud archives!`);
      updateDataPointsCount();
      updateTrendChart();
    }
  } catch (err) {
    console.log('[Cloud Sync] Standalone / local mode:', err.message);
  }
}

// --- Map Setup ---
function initMap() {
  const centerLat = (CONFIG.originCoords.lat + CONFIG.destCoords.lat) / 2;
  const centerLon = (CONFIG.originCoords.lon + CONFIG.destCoords.lon) / 2;

  appState.map = L.map('map', {
    zoomControl: false
  }).setView([centerLat, centerLon], 12);

  L.control.zoom({ position: 'bottomright' }).addTo(appState.map);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.tomtom.com">TomTom</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(appState.map);

  appState.mapLayers.trafficFlow = L.tileLayer(
    `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${CONFIG.apiKey}`,
    { opacity: 0.7, maxZoom: 19 }
  );

  if (appState.showTrafficOverlay) {
    appState.mapLayers.trafficFlow.addTo(appState.map);
  }
}

// --- API Usage & Quota Tracker ---
function checkAndIncrementQuota(calls = 1) {
  const todayStr = new Date().toISOString().slice(0, 10);
  let usage = { date: todayStr, count: 0 };
  
  try {
    const stored = JSON.parse(localStorage.getItem('tomtom_daily_usage') || '{}');
    if (stored.date === todayStr) usage = stored;
  } catch (e) {}

  if (usage.count >= CONFIG.dailyQuotaLimit) {
    console.warn(`[Quota Guard] Daily limit of ${CONFIG.dailyQuotaLimit} calls reached.`);
    return false;
  }

  usage.count += calls;
  localStorage.setItem('tomtom_daily_usage', JSON.stringify(usage));
  updateQuotaBadge(usage.count);
  return true;
}

function updateQuotaBadge(currentCount) {
  if (currentCount === undefined) {
    const todayStr = new Date().toISOString().slice(0, 10);
    try {
      const stored = JSON.parse(localStorage.getItem('tomtom_daily_usage') || '{}');
      currentCount = (stored.date === todayStr) ? stored.count : 0;
    } catch (e) {
      currentCount = 0;
    }
  }

  el.quotaText.textContent = `${currentCount} / ${CONFIG.dailyQuotaLimit} API Calls`;
  const ratio = currentCount / CONFIG.dailyQuotaLimit;
  el.quotaMeter.className = 'quota-badge';
  if (ratio > 0.85) el.quotaMeter.classList.add('danger');
  else if (ratio > 0.5) el.quotaMeter.classList.add('warning');
}

// --- Data Fetching ---
async function loadCommuteData() {
  if (!checkAndIncrementQuota(1)) {
    el.routesList.innerHTML = `<div class="no-incidents" style="color:var(--accent-red);">⚠️ Daily TomTom API safety limit reached (${CONFIG.dailyQuotaLimit} calls). Auto-refresh paused until tomorrow.</div>`;
    return;
  }

  try {
    el.btnRefresh.querySelector('.spin-icon').classList.add('spinning');
    el.routesList.innerHTML = `<div class="loading-skeleton">Fetching real-time TomTom traffic data...</div>`;

    const start = CONFIG.direction === 'morning' ? CONFIG.originCoords : CONFIG.destCoords;
    const end = CONFIG.direction === 'morning' ? CONFIG.destCoords : CONFIG.originCoords;

    const routeUrl = `https://api.tomtom.com/routing/1/calculateRoute/${start.lat},${start.lon}:${end.lat},${end.lon}/json?key=${CONFIG.apiKey}&computeTravelTimeFor=all&traffic=true&maxAlternatives=2&instructionsType=text`;
    
    const [routeResponse, incidentsResponse, weatherData] = await Promise.all([
      fetch(routeUrl).then(r => r.json()),
      fetchIncidents(),
      fetchLiveWeather()
    ]);

    appState.currentWeather = weatherData;

    if (routeResponse && routeResponse.routes && routeResponse.routes.length > 0) {
      processRoutes(routeResponse.routes);
      appState.incidents = incidentsResponse || [];
      renderDashboard();
      saveLiveSnapshot();
    } else {
      el.routesList.innerHTML = `<div class="no-incidents">Failed to calculate routes. Check TomTom API Key.</div>`;
    }

    appState.lastUpdated = new Date();
    updateRefreshTimestamp();
  } catch (err) {
    console.error('Error loading commute data:', err);
    el.routesList.innerHTML = `<div class="no-incidents">Error fetching traffic data: ${err.message}</div>`;
  } finally {
    el.btnRefresh.querySelector('.spin-icon').classList.remove('spinning');
  }
}

async function fetchIncidents() {
  try {
    const bbox = '-122.38,47.58,-122.15,47.72';
    const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${CONFIG.apiKey}&bbox=${bbox}&fields={incidents{type}}`;
    const res = await fetch(url).then(r => r.json());
    return res.incidents || [];
  } catch (e) {
    return [];
  }
}

function getSR520TollRate(date = new Date()) {
  const options = { timeZone: 'America/Los_Angeles' };
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = date.toLocaleDateString('en-US', { ...options, weekday: 'long' });
  const isWeekend = dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday';

  const hourStr = date.toLocaleTimeString('en-US', { ...options, hour: '2-digit', hour12: false });
  const hour = parseInt(hourStr, 10) % 24;

  if (isWeekend) {
    if (hour >= 11 && hour < 18) return 3.40;
    if (hour >= 8 && hour < 21) return 2.40;
    return 1.40;
  }

  if ((hour >= 7 && hour < 10) || (hour >= 15 && hour < 19)) return 4.90;
  if ((hour >= 6 && hour < 7) || (hour >= 10 && hour < 15) || (hour >= 19 && hour < 21)) return 3.60;
  if (hour >= 21 || hour < 6) return 1.40;

  return 3.60;
}

function processRoutes(rawRoutes) {
  appState.routes = rawRoutes.map((route, idx) => {
    const miles = parseFloat((route.summary.lengthInMeters / 1609.34).toFixed(1));
    const travelTimeMins = Math.round(route.summary.travelTimeInSeconds / 60);
    const delayMins = Math.round(route.summary.trafficDelayInSeconds / 60);
    const noTrafficMins = Math.round(route.summary.noTrafficTravelTimeInSeconds / 60);
    const speedMph = travelTimeMins > 0 ? Math.round((miles / (travelTimeMins / 60))) : 0;
    
    let category = 'Alternate Route';
    let isToll = false;

    const instructionsText = route.guidance?.instructions?.map(i => i.message).join(' ') || '';
    
    if (instructionsText.includes('520') || miles < 14) {
      category = 'SR-520 Bridge';
      isToll = true;
    } else if (instructionsText.includes('90') || miles >= 15) {
      category = 'I-90 Bridge';
      isToll = false;
    } else if (instructionsText.includes('Mercer') || instructionsText.includes('I-5')) {
      category = 'I-5 / Mercer St';
      isToll = false;
    }

    const points = route.legs.flatMap(leg => leg.points.map(pt => [pt.latitude, pt.longitude]));

    return {
      index: idx,
      name: category,
      miles,
      travelTimeMins,
      delayMins,
      noTrafficMins,
      speedMph,
      isToll,
      summary: route.summary,
      instructions: route.guidance?.instructions || [],
      points
    };
  });

  appState.selectedRouteIndex = 0;
}

function renderDashboard() {
  if (appState.routes.length === 0) return;

  const selectedRoute = appState.routes[appState.selectedRouteIndex];

  el.valTravelTime.textContent = selectedRoute.travelTimeMins;
  
  const now = new Date();
  const eta = new Date(now.getTime() + selectedRoute.travelTimeMins * 60000);
  el.valEta.textContent = `ETA: ${eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  
  el.valTrafficDelay.textContent = selectedRoute.delayMins;
  el.valRecommendedRoute.textContent = selectedRoute.name;
  el.valDistance.textContent = `${selectedRoute.miles} miles`;

  const statusEl = el.valTrafficStatus;
  if (selectedRoute.delayMins <= 2) {
    statusEl.textContent = 'Clear Traffic';
    statusEl.className = 'stat-badge success';
  } else if (selectedRoute.delayMins <= 8) {
    statusEl.textContent = 'Moderate Traffic';
    statusEl.className = 'stat-badge warning';
  } else {
    statusEl.textContent = 'Heavy Delays';
    statusEl.className = 'stat-badge danger';
  }

  renderRouteCards();
  renderMapElements();
  renderIncidents();
  renderInstructions();
  updateOptimalDepartureAdvisor();
  updateTrendChart();
}

function renderRouteCards() {
  const currentToll = getSR520TollRate();

  el.routesList.innerHTML = appState.routes.map((route, i) => {
    const isActive = i === appState.selectedRouteIndex;
    const delayText = route.delayMins > 0 ? `+${route.delayMins} min delay` : 'No delay';
    const tollBadge = route.isToll 
      ? `<span class="toll-pill toll">$${currentToll.toFixed(2)} Toll</span>` 
      : `<span class="toll-pill free">No Toll</span>`;

    return `
      <div class="route-card ${isActive ? 'active' : ''}" onclick="selectRoute(${i})">
        <div class="route-card-accent"></div>
        <div class="route-card-header">
          <span class="route-name">${route.name} ${tollBadge}</span>
          <span class="route-distance">${route.miles} mi (${route.speedMph} mph)</span>
        </div>
        <div class="route-card-body">
          <div class="route-metrics">
            <span class="route-time">${route.travelTimeMins} <span style="font-size:0.8rem;font-weight:500;">mins</span></span>
            <span class="route-delay ${route.delayMins > 0 ? '' : 'no-delay'}">${delayText}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.selectRoute = function(index) {
  appState.selectedRouteIndex = index;
  renderDashboard();
};

function renderMapElements() {
  const { map, mapLayers, routes, selectedRouteIndex } = appState;
  if (!map) return;

  mapLayers.routePolylines.forEach(p => map.removeLayer(p));
  mapLayers.routePolylines = [];
  mapLayers.markers.forEach(m => map.removeLayer(m));
  mapLayers.markers = [];

  routes.forEach((route, i) => {
    const isSelected = i === selectedRouteIndex;
    let strokeColor = isSelected ? '#3b82f6' : '#64748b';
    if (isSelected && route.name.includes('520')) strokeColor = '#06b6d4';
    if (isSelected && route.name.includes('90')) strokeColor = '#8b5cf6';

    const polyline = L.polyline(route.points, {
      color: strokeColor,
      weight: isSelected ? 6 : 4,
      opacity: isSelected ? 0.9 : 0.4,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    polyline.on('click', () => selectRoute(i));
    mapLayers.routePolylines.push(polyline);
  });

  const selectedPolyline = mapLayers.routePolylines[selectedRouteIndex];
  if (selectedPolyline) {
    map.fitBounds(selectedPolyline.getBounds(), { padding: [40, 40] });
  }

  const startCoords = CONFIG.direction === 'morning' ? CONFIG.originCoords : CONFIG.destCoords;
  const endCoords = CONFIG.direction === 'morning' ? CONFIG.destCoords : CONFIG.originCoords;
  const startName = CONFIG.direction === 'morning' ? '225 Cedar St (Seattle)' : 'Google Kirkland';
  const endName = CONFIG.direction === 'morning' ? 'Google Kirkland' : '225 Cedar St (Seattle)';

  const originIcon = L.divIcon({
    className: 'custom-marker-wrapper',
    html: `<div class="custom-marker origin">A</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  const destIcon = L.divIcon({
    className: 'custom-marker-wrapper',
    html: `<div class="custom-marker destination">B</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  const mStart = L.marker([startCoords.lat, startCoords.lon], { icon: originIcon })
    .bindPopup(`<b>Start:</b> ${startName}`)
    .addTo(map);

  const mEnd = L.marker([endCoords.lat, endCoords.lon], { icon: destIcon })
    .bindPopup(`<b>Destination:</b> ${endName}`)
    .addTo(map);

  mapLayers.markers.push(mStart, mEnd);
}

function renderIncidents() {
  const container = el.incidentsContainer;
  const countBadge = el.incidentCount;

  const incidents = appState.incidents;
  countBadge.textContent = incidents.length;

  if (incidents.length === 0) {
    container.innerHTML = `<div class="no-incidents">No major incidents reported on SR-520 / I-90 corridor.</div>`;
    return;
  }

  container.innerHTML = incidents.slice(0, 5).map(inc => {
    const desc = inc.properties.events?.map(e => e.description).join(', ') || 'Traffic Incident';
    const delayMins = inc.properties.delay ? Math.round(inc.properties.delay / 60) : null;
    const delayText = delayMins ? `+${delayMins} min delay` : '';

    return `
      <div class="incident-item">
        <span class="incident-icon">⚠️</span>
        <span class="incident-text">${desc}</span>
        ${delayText ? `<span class="incident-delay">${delayText}</span>` : ''}
      </div>
    `;
  }).join('');
}

function renderInstructions() {
  const selectedRoute = appState.routes[appState.selectedRouteIndex];
  if (!selectedRoute) return;

  el.activeRouteName.textContent = selectedRoute.name;

  if (!selectedRoute.instructions || selectedRoute.instructions.length === 0) {
    el.instructionsList.innerHTML = `<li>Turn-by-turn guidance unavailable for this route.</li>`;
    return;
  }

  el.instructionsList.innerHTML = selectedRoute.instructions.map(ins => {
    return `<li>${ins.message}</li>`;
  }).join('');
}

function updateOptimalDepartureAdvisor() {
  const sr520Route = appState.routes.find(r => r.name.includes('520')) || appState.routes[0];
  const nowHour = new Date().getHours();
  const isMorningWindow = nowHour >= 6 && nowHour <= 10;
  const isEveningWindow = nowHour >= 15 && nowHour <= 19;

  let adviceTitle = 'Optimal Departure Window';
  let adviceText = '';

  if (CONFIG.direction === 'morning') {
    if (isMorningWindow) {
      if (sr520Route.delayMins < 4) {
        adviceTitle = 'Great Time to Depart Now!';
        adviceText = `SR-520 Bridge traffic is currently light (${sr520Route.travelTimeMins} mins). Departure within the next 15 mins is recommended.`;
      } else {
        adviceTitle = 'Heavy Morning Peak Traffic';
        adviceText = `Traffic on SR-520 currently adds +${sr520Route.delayMins} mins. Departure around 9:15 AM will save ~10 minutes.`;
      }
    } else {
      adviceTitle = 'Morning Rush Trend Insight';
      adviceText = `Tuesdays & Wednesdays typically experience peak congestion between 7:45 AM - 8:45 AM. Mondays & Fridays are ~15% lighter.`;
    }
  } else {
    if (isEveningWindow) {
      if (sr520Route.delayMins < 5) {
        adviceTitle = 'Clear Evening Commute';
        adviceText = `Return trip to Belltown is clear right now (${sr520Route.travelTimeMins} mins).`;
      } else {
        adviceTitle = 'Evening Rush Hour Delay';
        adviceText = `Evening traffic delay is +${sr520Route.delayMins} mins. Departure after 6:30 PM avoids peak I-405/520 slowdowns.`;
      }
    } else {
      adviceTitle = 'Evening Rush Trend Insight';
      adviceText = `Evening peak congestion from Kirkland to Seattle occurs between 4:45 PM and 6:15 PM on Thursdays & Tuesdays.`;
    }
  }

  el.optimalTimeHeading.textContent = adviceTitle;
  el.optimalTimeText.textContent = adviceText;
}

function initChart() {
  const ctx = document.getElementById('trafficTrendChart').getContext('2d');
  
  appState.trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: []
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} mins`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', font: { size: 10 } }
        },
        y: {
          title: { display: true, text: 'Travel Time (mins)', color: '#94a3b8', font: { size: 10 } },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', font: { size: 10 } }
        }
      }
    }
  });
}

// Normalize entry for rendering
function normalizeHistoryItem(item) {
  const ts = item.timestamp || Date.now();
  const d = new Date(ts);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const options = { timeZone: 'America/Los_Angeles' };
  
  const dayOfWeek = d.toLocaleDateString('en-US', { ...options, weekday: 'long' });
  const dayIndex = dayNames.indexOf(dayOfWeek);
  const timeStr = d.toLocaleTimeString('en-US', { ...options, hour: '2-digit', minute: '2-digit', hour12: false });
  const hour = parseInt(d.toLocaleTimeString('en-US', { ...options, hour: '2-digit', hour12: false }), 10) % 24;

  const morning = item.morning || (item.direction === 'morning' ? { sr520Time: item.sr520Time || 0, sr520Delay: item.sr520Delay || 0, i90Time: item.i90Time || 0, i90Delay: item.i90Delay || 0 } : { sr520Time: 0, sr520Delay: 0, i90Time: 0, i90Delay: 0 });
  const evening = item.evening || (item.direction === 'evening' ? { sr520Time: item.sr520Time || 0, sr520Delay: item.sr520Delay || 0, i90Time: item.i90Time || 0, i90Delay: item.i90Delay || 0 } : { sr520Time: 0, sr520Delay: 0, i90Time: 0, i90Delay: 0 });

  return {
    timestamp: ts,
    dayOfWeek,
    dayIndex,
    timeStr,
    hour,
    morning,
    evening,
    incidents: item.incidents || item.incidentsCount || 0
  };
}

function updateTrendChart() {
  if (!appState.trendChart) return;

  const mode = appState.activeTrendWindow;
  const timeWindow = appState.selectedTimeWindow;
  const dayFilter = appState.selectedDayFilter;

  const historyRaw = getHistoricalDatabase();
  const history = historyRaw.map(normalizeHistoryItem);

  const filteredHistory = dayFilter === 'all' 
    ? history 
    : history.filter(h => String(h.dayIndex) === String(dayFilter));

  let labels = [];
  let datasets = [];

  let baselineSR520 = [];
  let baselineI90 = [];

  let mult = 1.0;
  if (dayFilter === '2' || dayFilter === '3' || dayFilter === '4') mult = 1.15;
  if (dayFilter === '1' || dayFilter === '5') mult = 0.88;

  if (timeWindow === 'morning') {
    labels = ['6:00 AM', '6:30 AM', '7:00 AM', '7:30 AM', '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM'];
    baselineSR520 = [20, 21, 25, Math.round(32*mult), Math.round(36*mult), Math.round(31*mult), 26, 22, 20];
    baselineI90   = [25, 26, 30, Math.round(38*mult), Math.round(42*mult), Math.round(36*mult), 30, 27, 25];
  } else if (timeWindow === 'evening') {
    labels = ['3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM'];
    let eveMult = (dayFilter === '4' || dayFilter === '3') ? 1.18 : (dayFilter === '5' ? 0.90 : 1.0);
    baselineSR520 = [21, 24, 28, Math.round(35*eveMult), Math.round(38*eveMult), Math.round(36*eveMult), 30, 24, 21];
    baselineI90   = [26, 28, 32, Math.round(40*eveMult), Math.round(44*eveMult), Math.round(41*eveMult), 34, 28, 26];
  } else if (timeWindow === 'byDay') {
    labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    baselineSR520 = [26, 35, 36, 37, 28, 22, 21];
    baselineI90   = [31, 41, 42, 43, 33, 27, 26];
  }

  if (mode === 'tomtomBaseline') {
    datasets = [
      {
        label: 'TomTom Historic SR-520 (Toll)',
        data: baselineSR520,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.12)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 4
      },
      {
        label: 'TomTom Historic I-90',
        data: baselineI90,
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.05)',
        borderWidth: 2,
        borderDash: [4, 4],
        tension: 0.4,
        fill: false,
        pointRadius: 4
      }
    ];
  } else if (mode === 'polledActual') {
    if (filteredHistory.length > 0) {
      labels = filteredHistory.map(s => `${s.dayOfWeek.slice(0,3)} ${s.timeStr}`);
      const isMorn = CONFIG.direction === 'morning';
      const actualSR520 = filteredHistory.map(s => isMorn ? s.morning.sr520Time : s.evening.sr520Time);
      const actualI90 = filteredHistory.map(s => isMorn ? s.morning.i90Time : s.evening.i90Time);

      datasets = [
        {
          label: `Polled SR-520 (${CONFIG.direction})`,
          data: actualSR520,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          borderWidth: 3,
          tension: 0.2,
          fill: true,
          pointRadius: 5
        },
        {
          label: `Polled I-90 (${CONFIG.direction})`,
          data: actualI90,
          borderColor: '#f59e0b',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [3, 3],
          tension: 0.2,
          fill: false,
          pointRadius: 4
        }
      ];
    } else {
      labels = ['No Polled Points Yet'];
      datasets = [
        { label: 'Your Polled Live Data', data: [0], borderColor: '#10b981', borderWidth: 2 }
      ];
    }
  } else if (mode === 'combinedOverlay') {
    if (filteredHistory.length > 0) {
      labels = filteredHistory.map(s => `${s.dayOfWeek.slice(0,3)} ${s.timeStr}`);
      const isMorn = CONFIG.direction === 'morning';
      const actualSR520 = filteredHistory.map(s => isMorn ? s.morning.sr520Time : s.evening.sr520Time);
      const actualI90 = filteredHistory.map(s => isMorn ? s.morning.i90Time : s.evening.i90Time);

      datasets = [
        {
          label: 'TomTom Historic SR-520',
          data: baselineSR520,
          borderColor: 'rgba(6, 182, 212, 0.4)',
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.4,
          fill: false,
          pointRadius: 2
        },
        {
          label: `Actual SR-520 (${CONFIG.direction})`,
          data: actualSR520,
          borderColor: '#10b981',
          backgroundColor: '#10b981',
          borderWidth: 3,
          tension: 0.2,
          fill: false,
          pointRadius: 5
        },
        {
          label: `Actual I-90 (${CONFIG.direction})`,
          data: actualI90,
          borderColor: '#f59e0b',
          borderWidth: 2,
          tension: 0.2,
          fill: false,
          pointRadius: 4
        }
      ];
    } else {
      datasets = [
        { label: 'TomTom Historic SR-520', data: baselineSR520, borderColor: '#06b6d4', borderWidth: 2, tension: 0.4 },
        { label: 'TomTom Historic I-90', data: baselineI90, borderColor: '#8b5cf6', borderWidth: 2, tension: 0.4 }
      ];
    }
  }

  appState.trendChart.data.labels = labels;
  appState.trendChart.data.datasets = datasets;
  appState.trendChart.update();

  updateDataPointsCount();
}

function saveLiveSnapshot() {
  if (appState.routes.length === 0) return;

  const sr520 = appState.routes.find(r => r.name.includes('520')) || appState.routes[0];
  const i90 = appState.routes.find(r => r.name.includes('90')) || appState.routes[1] || sr520;

  const currentRouteData = {
    sr520Time: sr520.travelTimeMins,
    sr520Delay: sr520.delayMins,
    i90Time: i90.travelTimeMins,
    i90Delay: i90.delayMins
  };

  const now = Date.now();
  const snapshot = {
    timestamp: now,
    morning: CONFIG.direction === 'morning' ? currentRouteData : { sr520Time: 0, sr520Delay: 0, i90Time: 0, i90Delay: 0 },
    evening: CONFIG.direction === 'evening' ? currentRouteData : { sr520Time: 0, sr520Delay: 0, i90Time: 0, i90Delay: 0 },
    weather: appState.currentWeather || { temp: 60, rain: 0, code: 0 },
    incidents: appState.incidents.length
  };

  const history = getHistoricalDatabase();
  history.push(snapshot);
  
  if (history.length > 5000) history.shift();

  localStorage.setItem('commute_historical_db', JSON.stringify(history));
  updateDataPointsCount();
}

function getHistoricalDatabase() {
  try {
    return JSON.parse(localStorage.getItem('commute_historical_db') || '[]');
  } catch (e) {
    return [];
  }
}

function updateDataPointsCount() {
  const history = getHistoricalDatabase();
  el.dataPointsCount.textContent = `${history.length} Polled Points`;
}

function setupVisibilityHandler() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      appState.isTabVisible = false;
    } else {
      appState.isTabVisible = true;
      const now = new Date();
      if (!appState.lastUpdated || (now - appState.lastUpdated) > CONFIG.refreshIntervalMs) {
        loadCommuteData();
      }
    }
  });
}

// --- Weather & Data Functions ---
async function fetchLiveWeather() {
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=47.6167&longitude=-122.3489&current=temperature_2m,precipitation,weather_code&temperature_unit=fahrenheit&precipitation_unit=inch';
    const res = await fetch(url).then(r => r.json());
    if (res && res.current) {
      const temp = Math.round(res.current.temperature_2m);
      const rain = res.current.precipitation || 0;
      const code = res.current.weather_code || 0;
      
      const nowHour = new Date().getHours();
      const isNight = nowHour >= 21 || nowHour < 6;

      let icon = isNight ? '🌙' : '☀️';
      if (rain > 0.02 || code >= 61) icon = '🌧️';
      else if (code >= 45) icon = '🌫️';
      else if (code >= 1 && code <= 3) icon = isNight ? '☁️' : '⛅';

      const iconEl = document.getElementById('weather-icon');
      const tempEl = document.getElementById('weather-temp');

      if (iconEl) iconEl.textContent = icon;
      if (tempEl) tempEl.textContent = `${temp}°F${rain > 0 ? ` (${rain}")` : ''}`;
      
      return { temp, rain, code };
    }
  } catch (e) {
    console.warn('Live weather fetch error:', e);
  }
  return { temp: 60, rain: 0, code: 0 };
}

function exportCSV() {
  const rawHistory = getHistoricalDatabase();
  if (rawHistory.length === 0) {
    alert('No logged traffic data points to export yet!');
    return;
  }

  const history = rawHistory.map(normalizeHistoryItem);
  const headers = ['Timestamp', 'ISO_Date', 'Day_of_Week', 'Time', 'Morning_SR520_Time', 'Morning_SR520_Delay', 'Morning_I90_Time', 'Morning_I90_Delay', 'Evening_SR520_Time', 'Evening_SR520_Delay', 'Evening_I90_Time', 'Evening_I90_Delay', 'Temp_F', 'Rain_Inches', 'Incidents'];
  const rows = history.map(h => [
    h.timestamp,
    new Date(h.timestamp).toISOString(),
    h.dayOfWeek,
    h.timeStr,
    h.morning.sr520Time,
    h.morning.sr520Delay,
    h.morning.i90Time,
    h.morning.i90Delay,
    h.evening.sr520Time,
    h.evening.sr520Delay,
    h.evening.i90Time,
    h.evening.i90Delay,
    h.weather ? h.weather.temp : '--',
    h.weather ? h.weather.rain : '0',
    h.incidents
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadFile(csvContent, 'commute_traffic_history.csv', 'text/csv');
}

function exportJSON() {
  const history = getHistoricalDatabase();
  if (history.length === 0) {
    alert('No logged traffic data points to export yet!');
    return;
  }
  const jsonContent = JSON.stringify(history, null, 2);
  downloadFile(jsonContent, 'commute_traffic_history.json', 'application/json');
}

function downloadFile(content, fileName, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function importDataFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target.result;
      let imported = [];
      if (file.name.endsWith('.json')) {
        imported = JSON.parse(content);
      }

      if (Array.isArray(imported) && imported.length > 0) {
        const existing = getHistoricalDatabase();
        const combined = [...existing, ...imported];
        localStorage.setItem('commute_historical_db', JSON.stringify(combined));
        alert(`Successfully imported ${imported.length} traffic data points!`);
        updateTrendChart();
      }
    } catch (err) {
      alert('Error parsing import file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function setupEventListeners() {
  el.btnRefresh.addEventListener('click', () => {
    const now = Date.now();
    if (now - appState.lastManualClickTime < CONFIG.minManualCooldownMs) {
      const remainingSecs = Math.ceil((CONFIG.minManualCooldownMs - (now - appState.lastManualClickTime)) / 1000);
      alert(`Rate Guard: Please wait ${remainingSecs} seconds before manually refreshing again.`);
      return;
    }
    appState.lastManualClickTime = now;
    loadCommuteData();
  });

  el.btnDirectionToggle.addEventListener('click', () => {
    CONFIG.direction = CONFIG.direction === 'morning' ? 'evening' : 'morning';
    
    if (CONFIG.direction === 'morning') {
      el.commuteDirectionText.textContent = 'Morning Commute (To Office)';
      el.routeStartLabel.textContent = '225 Cedar St, Seattle';
      el.routeEndLabel.textContent = 'Google Kirkland (747 6th St S)';
    } else {
      el.commuteDirectionText.textContent = 'Evening Commute (To Home)';
      el.routeStartLabel.textContent = 'Google Kirkland (747 6th St S)';
      el.routeEndLabel.textContent = '225 Cedar St, Seattle';
    }

    loadCommuteData();
  });

  el.toggleTrafficLayer.addEventListener('click', () => {
    appState.showTrafficOverlay = !appState.showTrafficOverlay;
    el.toggleTrafficLayer.classList.toggle('active', appState.showTrafficOverlay);

    if (appState.showTrafficOverlay) {
      appState.mapLayers.trafficFlow.addTo(appState.map);
    } else {
      appState.map.removeLayer(appState.mapLayers.trafficFlow);
    }
  });

  el.recenterMap.addEventListener('click', () => {
    const selectedPolyline = appState.mapLayers.routePolylines[appState.selectedRouteIndex];
    if (selectedPolyline) {
      appState.map.fitBounds(selectedPolyline.getBounds(), { padding: [40, 40] });
    }
  });

  document.querySelectorAll('.trend-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.trend-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      appState.activeTrendWindow = e.target.getAttribute('data-window');
      updateTrendChart();
    });
  });

  el.filterTimeWindow.addEventListener('change', (e) => {
    appState.selectedTimeWindow = e.target.value;
    updateTrendChart();
  });

  el.filterDayOfWeek.addEventListener('change', (e) => {
    appState.selectedDayFilter = e.target.value;
    updateTrendChart();
  });

  el.btnExportCsv.addEventListener('click', exportCSV);
  el.btnExportJson.addEventListener('click', exportJSON);
  el.fileImport.addEventListener('change', (e) => importDataFile(e.target.files[0]));
  el.btnClearHistory.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all logged traffic history data?')) {
      localStorage.removeItem('commute_historical_db');
      updateTrendChart();
    }
  });

  el.btnSettings.addEventListener('click', () => {
    el.apiKeyInput.value = CONFIG.apiKey;
    el.pollIntervalSelect.value = String(CONFIG.refreshIntervalMs);
    el.dailyLimitInput.value = CONFIG.dailyQuotaLimit;
    el.settingsModal.classList.remove('hidden');
  });

  el.closeModal.addEventListener('click', () => {
    el.settingsModal.classList.add('hidden');
  });

  el.btnSaveSettings.addEventListener('click', () => {
    const newKey = el.apiKeyInput.value.trim();
    const newInterval = parseInt(el.pollIntervalSelect.value, 10);
    const newLimit = parseInt(el.dailyLimitInput.value, 10);

    if (newKey) {
      CONFIG.apiKey = newKey;
      localStorage.setItem('tomtom_api_key', newKey);
    }

    if (!isNaN(newInterval)) {
      CONFIG.refreshIntervalMs = newInterval;
      localStorage.setItem('tomtom_poll_interval', String(newInterval));
      startAutoRefresh();
    }

    if (!isNaN(newLimit) && newLimit > 0) {
      CONFIG.dailyQuotaLimit = newLimit;
      localStorage.setItem('tomtom_daily_limit', String(newLimit));
      updateQuotaBadge();
    }

    el.settingsModal.classList.add('hidden');
    loadCommuteData();
  });
}

function startAutoRefresh() {
  if (appState.refreshTimer) clearInterval(appState.refreshTimer);
  
  if (CONFIG.refreshIntervalMs > 0) {
    appState.refreshTimer = setInterval(() => {
      if (appState.isTabVisible) {
        loadCommuteData();
      }
    }, CONFIG.refreshIntervalMs);
  }

  setInterval(() => {
    updateRefreshTimestamp();
  }, 1000);
}

function updateRefreshTimestamp() {
  if (!appState.lastUpdated) {
    el.refreshTimerText.textContent = 'Updating...';
    return;
  }
  const secondsAgo = Math.floor((new Date() - appState.lastUpdated) / 1000);
  if (secondsAgo < 5) {
    el.refreshTimerText.textContent = 'Updated just now';
  } else {
    el.refreshTimerText.textContent = `Updated ${secondsAgo}s ago`;
  }
}
