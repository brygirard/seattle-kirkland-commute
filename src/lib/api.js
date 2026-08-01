const TOMTOM_BASE_URL = 'https://api.tomtom.com/routing/1/calculateRoute';

const ROUTES = {
  seattle_to_kirkland: {
    sr520: '47.616641,-122.349692:47.673898,-122.193077', // 225 Cedar St -> Google Kirkland
    i90: '47.616641,-122.349692:47.673898,-122.193077'
  },
  kirkland_to_seattle: {
    sr520: '47.673898,-122.193077:47.616641,-122.349692', // Google Kirkland -> 225 Cedar St
    i90: '47.673898,-122.193077:47.616641,-122.349692'
  }
};

const AVOID_OPTIONS = {
  sr520: '', 
  i90: 'tollRoads' // Avoid SR-520 tolls to force I-90
};

export async function fetchRouteData(apiKey, routeKey, direction) {
  const coords = ROUTES[direction][routeKey];
  const avoid = AVOID_OPTIONS[routeKey];
  const avoidParam = avoid ? `&avoid=${avoid}` : '';
  const url = `${TOMTOM_BASE_URL}/${coords}/json?key=${apiKey}&traffic=true&travelMode=car${avoidParam}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`TomTom API Error: ${response.status}`);
  const data = await response.json();
  const summary = data.routes[0].summary;

  return {
    travelTime: Math.round(summary.travelTimeInSeconds / 60),
    trafficDelay: Math.round(summary.trafficDelayInSeconds / 60),
    distance: (summary.lengthInMeters * 0.000621371).toFixed(1)
  };
}

export async function fetchWeather() {
  try {
    // Kirkland WA approx coordinates for weather
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=47.68&longitude=-122.20&current=temperature_2m,precipitation,weather_code&temperature_unit=fahrenheit');
    const data = await res.json();
    return {
      temp: Math.round(data.current.temperature_2m),
      rain: data.current.precipitation,
      code: data.current.weather_code
    };
  } catch (err) {
    console.warn("Weather fetch failed:", err);
    return null;
  }
}
