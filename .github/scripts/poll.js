const fs = require('fs');
const path = require('path');

const apiKey = process.env.TOMTOM_API_KEY || 'QuSopbXau96swtFznGbYJV74BYwuZAML';

const originCoords = { lat: 47.6167589, lon: -122.3488781 }; // 225 Cedar St, Seattle
const destCoords = { lat: 47.6702148, lon: -122.1973175 };   // Google Kirkland

function getPacificTime(date = new Date()) {
  const options = { timeZone: 'America/Los_Angeles' };
  
  const dateStr = date.toLocaleDateString('en-US', { ...options, year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeStr = date.toLocaleTimeString('en-US', { ...options, hour: '2-digit', minute: '2-digit', hour12: false });
  const dayOfWeek = date.toLocaleDateString('en-US', { ...options, weekday: 'long' });
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayIndex = dayNames.indexOf(dayOfWeek);

  const hourStr = date.toLocaleTimeString('en-US', { ...options, hour: '2-digit', hour12: false });
  const hour = parseInt(hourStr, 10) % 24;

  return { dateStr, dayOfWeek, dayIndex, timeStr, hour };
}

async function pollTraffic() {
  const now = new Date();
  const pt = getPacificTime(now);

  // Morning direction (Seattle -> Kirkland) for 4:00 AM - 12:00 PM, Evening (Kirkland -> Seattle) for 12:00 PM - 4:00 AM
  const direction = (pt.hour >= 4 && pt.hour < 12) ? 'morning' : 'evening';
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

    const snapshot = {
      id: `snap_${now.getTime()}`,
      timestamp: now.getTime(),
      isoDate: now.toISOString(),
      dateStr: pt.dateStr,
      dayOfWeek: pt.dayOfWeek,
      dayIndex: pt.dayIndex,
      timeStr: pt.timeStr,
      hour: pt.hour,
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
    if (history.length > 10000) history.shift();

    fs.writeFileSync(filePath, JSON.stringify(history, null, 2), 'utf-8');
    console.log(`[Cloud Poller Success] Recorded snapshot at ${pt.dateStr} ${pt.timeStr} ${pt.dayOfWeek} (Hour: ${pt.hour}, Direction: ${direction}): SR-520 ${sr520.travelTimeMins}m, I-90 ${i90.travelTimeMins}m`);

  } catch (err) {
    console.error('Error polling traffic in cloud script:', err);
  }
}

pollTraffic();
