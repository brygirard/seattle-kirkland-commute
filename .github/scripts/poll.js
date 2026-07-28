const fs = require('fs');
const path = require('path');

const apiKey = process.env.TOMTOM_API_KEY || 'QuSopbXau96swtFznGbYJV74BYwuZAML';

const seattleCoords = { lat: 47.6167589, lon: -122.3488781 }; // 225 Cedar St, Seattle
const kirklandCoords = { lat: 47.6702148, lon: -122.1973175 }; // Google Kirkland

async function fetchRouteData(start, end) {
  const routeUrl = `https://api.tomtom.com/routing/1/calculateRoute/${start.lat},${start.lon}:${end.lat},${end.lon}/json?key=${apiKey}&computeTravelTimeFor=all&traffic=true&maxAlternatives=2&instructionsType=text`;
  const res = await fetch(routeUrl).then(r => r.json());
  
  if (!res.routes || res.routes.length === 0) {
    return { sr520Time: 0, sr520Delay: 0, i90Time: 0, i90Delay: 0 };
  }

  const routes = res.routes.map(r => {
    const miles = (r.summary.lengthInMeters / 1609.34).toFixed(1);
    const travelTimeMins = Math.round(r.summary.travelTimeInSeconds / 60);
    const delayMins = Math.round(r.summary.trafficDelayInSeconds / 60);
    const text = r.guidance?.instructions?.map(i => i.message).join(' ') || '';
    
    let name = 'Alternate Route';
    if (text.includes('520') || miles < 14) name = 'SR-520 Bridge';
    else if (text.includes('90') || miles >= 15) name = 'I-90 Bridge';

    return { name, travelTimeMins, delayMins };
  });

  const sr520 = routes.find(r => r.name.includes('520')) || routes[0];
  const i90 = routes.find(r => r.name.includes('90')) || routes[1] || sr520;

  return {
    sr520Time: sr520.travelTimeMins,
    sr520Delay: sr520.delayMins,
    i90Time: i90.travelTimeMins,
    i90Delay: i90.delayMins
  };
}

async function pollTraffic() {
  const bbox = '-122.38,47.58,-122.15,47.72';
  const incidentUrl = `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${apiKey}&bbox=${bbox}&fields={incidents{type}}`;

  try {
    const [morningData, eveningData, incidentRes] = await Promise.all([
      fetchRouteData(seattleCoords, kirklandCoords), // Morning: Seattle -> Kirkland
      fetchRouteData(kirklandCoords, seattleCoords), // Evening: Kirkland -> Seattle
      fetch(incidentUrl).then(r => r.json()).catch(() => ({ incidents: [] }))
    ]);

    const snapshot = {
      timestamp: Date.now(),
      morning: morningData,
      evening: eveningData,
      incidents: (incidentRes.incidents || []).length
    };

    const filePath = path.join(__dirname, '..', '..', 'data', 'commute_history.json');
    let history = [];
    if (fs.existsSync(filePath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (Array.isArray(raw)) history = raw;
      } catch (e) {}
    }

    history.push(snapshot);
    if (history.length > 10000) history.shift();

    fs.writeFileSync(filePath, JSON.stringify(history, null, 2), 'utf-8');
    
    const pDate = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hour12: false });
    console.log(`[Cloud Poller] ${pDate} PT | Morning 520:${morningData.sr520Time}m I90:${morningData.i90Time}m | Evening 520:${eveningData.sr520Time}m I90:${eveningData.i90Time}m`);

  } catch (err) {
    console.error('Error polling traffic in cloud script:', err);
  }
}

pollTraffic();
