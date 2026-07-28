const fs = require('fs');
const path = require('path');

const apiKey = process.env.TOMTOM_API_KEY || 'QuSopbXau96swtFznGbYJV74BYwuZAML';

const originCoords = { lat: 47.6167589, lon: -122.3488781 }; // 225 Cedar St, Seattle
const destCoords = { lat: 47.6702148, lon: -122.1973175 };   // Google Kirkland

async function pollTraffic(direction = 'morning') {
  const start = direction === 'morning' ? originCoords : destCoords;
  const end = direction === 'morning' ? destCoords : originCoords;

  const routeUrl = `https://api.tomtom.com/routing/1/calculateRoute/${start.lat},${start.lon}:${end.lat},${end.lon}/json?key=${apiKey}&computeTravelTimeFor=all&traffic=true&maxAlternatives=2&instructionsType=text`;
  const bbox = '-122.38,47.58,-122.15,47.72';
  const incidentUrl = `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${apiKey}&bbox=${bbox}&fields={incidents{type,properties{iconCategory,magnitudeOfDelay,events{description},length,delay}}}`;

  try {
    const [routeRes, incidentRes] = await Promise.all([
      fetch(routeUrl).then(r => r.json()),
      fetch(incidentUrl).then(r => r.json()).catch(() => ({ incidents: [] }))
    ]);

    if (!routeRes.routes || routeRes.routes.length === 0) {
      console.error('No routes returned from TomTom API');
      return;
    }

    const routes = routeRes.routes.map(r => {
      const miles = (r.summary.lengthInMeters / 1609.34).toFixed(1);
      const travelTimeMins = Math.round(r.summary.travelTimeInSeconds / 60);
      const delayMins = Math.round(r.summary.trafficDelayInSeconds / 60);
      const instructionsText = r.guidance?.instructions?.map(i => i.message).join(' ') || '';
      
      let name = 'Alternate Route';
      if (instructionsText.includes('520') || miles < 14) name = 'SR-520 Bridge';
      else if (instructionsText.includes('90') || miles >= 15) name = 'I-90 Bridge';

      return { name, travelTimeMins, delayMins, miles };
    });

    const sr520 = routes.find(r => r.name.includes('520')) || routes[0];
    const i90 = routes.find(r => r.name.includes('90')) || routes[1] || sr520;

    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const snapshot = {
      id: `snap_${now.getTime()}`,
      timestamp: now.getTime(),
      isoDate: now.toISOString(),
      dateStr: now.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' }),
      dayOfWeek: dayNames[now.getDay()],
      dayIndex: now.getDay(),
      timeStr: now.toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hour12: false }),
      hour: now.getHours(),
      direction,
      sr520Time: sr520.travelTimeMins,
      sr520Delay: sr520.delayMins,
      sr520Distance: sr520.miles,
      i90Time: i90.travelTimeMins,
      i90Delay: i90.delayMins,
      i90Distance: i90.miles,
      incidentsCount: (incidentRes.incidents || []).length
    };

    const filePath = path.join(__dirname, '..', '..', 'data', 'commute_history.json');
    let history = [];
    if (fs.existsSync(filePath)) {
      try { history = JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch (e) {}
    }

    history.push(snapshot);
    if (history.length > 10000) history.shift(); // Keep last 10,000 snapshots

    fs.writeFileSync(filePath, JSON.stringify(history, null, 2), 'utf-8');
    console.log(`[Cloud Poller Success] Recorded snapshot at ${snapshot.timeStr} (${direction}): SR-520 ${sr520.travelTimeMins}m, I-90 ${i90.travelTimeMins}m`);

  } catch (err) {
    console.error('Error polling traffic in cloud script:', err);
  }
}

async function run() {
  const currentHour = new Date().getHours();
  // Morning direction (Seattle -> Kirkland) for AM, Evening (Kirkland -> Seattle) for PM
  const direction = (currentHour >= 12) ? 'evening' : 'morning';
  await pollTraffic(direction);
}

run();
