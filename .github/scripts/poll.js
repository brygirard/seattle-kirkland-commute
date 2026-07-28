const fs = require('fs');
const path = require('path');

const apiKey = process.env.TOMTOM_API_KEY || 'QuSopbXau96swtFznGbYJV74BYwuZAML';

const seattleCoords = { lat: 47.6167589, lon: -122.3488781 }; // 225 Cedar St, Seattle
const kirklandCoords = { lat: 47.6702148, lon: -122.1973175 }; // Google Kirkland

// Calculate WSDOT 520 Bridge Good To Go Toll Rate based on Seattle local time & day
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

  // Weekdays (Mon-Fri) WSDOT schedule
  if ((hour >= 7 && hour < 10) || (hour >= 15 && hour < 19)) return 4.90; // Peak
  if ((hour >= 6 && hour < 7) || (hour >= 10 && hour < 15) || (hour >= 19 && hour < 21)) return 3.60; // Shoulder
  if (hour >= 21 || hour < 6) return 1.40; // Night off-peak

  return 3.60;
}

async function fetchRouteData(start, end) {
  const routeUrl = `https://api.tomtom.com/routing/1/calculateRoute/${start.lat},${start.lon}:${end.lat},${end.lon}/json?key=${apiKey}&computeTravelTimeFor=all&traffic=true&maxAlternatives=2&instructionsType=text`;
  const res = await fetch(routeUrl).then(r => r.json());
  
  if (!res.routes || res.routes.length === 0) {
    return { sr520Time: 0, sr520Delay: 0, sr520SpeedMph: 0, i90Time: 0, i90Delay: 0, i90SpeedMph: 0 };
  }

  const routes = res.routes.map(r => {
    const miles = parseFloat((r.summary.lengthInMeters / 1609.34).toFixed(1));
    const travelTimeMins = Math.round(r.summary.travelTimeInSeconds / 60);
    const delayMins = Math.round(r.summary.trafficDelayInSeconds / 60);
    const speedMph = travelTimeMins > 0 ? Math.round((miles / (travelTimeMins / 60))) : 0;
    const text = r.guidance?.instructions?.map(i => i.message).join(' ') || '';
    
    let name = 'Alternate Route';
    if (text.includes('520') || miles < 14) name = 'SR-520 Bridge';
    else if (text.includes('90') || miles >= 15) name = 'I-90 Bridge';

    return { name, travelTimeMins, delayMins, miles, speedMph };
  });

  const sr520 = routes.find(r => r.name.includes('520')) || routes[0];
  const i90 = routes.find(r => r.name.includes('90')) || routes[1] || sr520;

  return {
    sr520Time: sr520.travelTimeMins,
    sr520Delay: sr520.delayMins,
    sr520SpeedMph: sr520.speedMph,
    i90Time: i90.travelTimeMins,
    i90Delay: i90.delayMins,
    i90SpeedMph: i90.speedMph
  };
}

async function fetchWeather() {
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=47.6167&longitude=-122.3489&current=temperature_2m,precipitation,weather_code&temperature_unit=fahrenheit&precipitation_unit=inch';
    const res = await fetch(url).then(r => r.json());
    if (res.current) {
      return {
        temp: Math.round(res.current.temperature_2m),
        rain: res.current.precipitation,
        code: res.current.weather_code
      };
    }
  } catch (e) {
    console.warn('Weather fetch error:', e.message);
  }
  return { temp: 60, rain: 0, code: 0 };
}

async function pollTraffic() {
  const bbox = '-122.38,47.58,-122.15,47.72';
  const incidentUrl = `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${apiKey}&bbox=${bbox}&fields={incidents{type}}`;

  try {
    const now = new Date();
    const tollRate = getSR520TollRate(now);

    const [morningData, eveningData, weatherData, incidentRes] = await Promise.all([
      fetchRouteData(seattleCoords, kirklandCoords), // Morning: Seattle -> Kirkland
      fetchRouteData(kirklandCoords, seattleCoords), // Evening: Kirkland -> Seattle
      fetchWeather(),
      fetch(incidentUrl).then(r => r.json()).catch(() => ({ incidents: [] }))
    ]);

    const snapshot = {
      timestamp: now.getTime(),
      morning: morningData,
      evening: eveningData,
      weather: weatherData,
      toll520: tollRate,
      incidents: (incidentRes.incidents || []).length
    };

    const yearMonth = now.toISOString().slice(0, 7); // e.g. "2026-07"
    const activeFileName = `history_${yearMonth}.json`;
    const dataDir = path.join(__dirname, '..', '..', 'data');
    const filePath = path.join(dataDir, activeFileName);
    const indexPath = path.join(dataDir, 'index.json');

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    let history = [];
    if (fs.existsSync(filePath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (Array.isArray(raw)) history = raw;
      } catch (e) {}
    }

    history.push(snapshot);
    fs.writeFileSync(filePath, JSON.stringify(history, null, 2), 'utf-8');

    let index = [];
    if (fs.existsSync(indexPath)) {
      try {
        const rawIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        if (Array.isArray(rawIndex)) index = rawIndex;
      } catch (e) {}
    }
    if (!index.includes(activeFileName)) {
      index.push(activeFileName);
      fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
    }

    const pDate = now.toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hour12: false });
    console.log(`[Cloud Poller] ${pDate} PT | Toll:$${tollRate.toFixed(2)} | 520 Speed:${morningData.sr520SpeedMph}mph | I90 Speed:${morningData.i90SpeedMph}mph`);

  } catch (err) {
    console.error('Error polling traffic in cloud script:', err);
  }
}

pollTraffic();
