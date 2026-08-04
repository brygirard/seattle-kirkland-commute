export const LA_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  weekday: 'long',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
});

export const LA_H24_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  hour: 'numeric',
  hourCycle: 'h23'
});

export function normalizeHistoryItem(item) {
  const ts = item.timestamp || Date.now();
  const d = new Date(ts);

  const parts = LA_FORMATTER.formatToParts(d);
  let dayOfWeek = 'Monday';
  let hourStr = '12';
  let minStr = '00';
  let dayPeriod = 'AM';

  parts.forEach(p => {
    if (p.type === 'weekday') dayOfWeek = p.value;
    if (p.type === 'hour') hourStr = p.value;
    if (p.type === 'minute') minStr = p.value;
    if (p.type === 'dayPeriod') dayPeriod = p.value;
  });

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayIndex = dayNames.indexOf(dayOfWeek);

  const h24Parts = LA_H24_FORMATTER.formatToParts(d);
  const hourPart = h24Parts.find(p => p.type === 'hour');
  const hour = hourPart ? parseInt(hourPart.value, 10) % 24 : d.getHours();

  const timeStr = `${hourStr}:${minStr.padStart(2, '0')} ${dayPeriod}`;

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

export function getHistoricalDatabase() {
  try {
    return JSON.parse(localStorage.getItem('commute_historical_db') || '[]');
  } catch (e) {
    return [];
  }
}

export function saveHistoricalDatabase(history) {
  localStorage.setItem('commute_historical_db', JSON.stringify(history));
}

export async function syncCloudData() {
  try {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocal ? './data' : 'https://raw.githubusercontent.com/brygirard/seattle-kirkland-commute/main/data';
    
    let filesToFetch = [`${baseUrl}/history_2026-07.json`, `${baseUrl}/history_2026-08.json`];
    try {
      const index = await fetch(`${baseUrl}/index.json`).then(r => r.ok ? r.json() : []);
      if (Array.isArray(index) && index.length > 0) {
        filesToFetch = index.map(f => `${baseUrl}/${f}`);
      }
    } catch (e) {
      console.warn("Index fetch failed, using default files", e);
    }

    let localData = getHistoricalDatabase().filter(item => {
      const m520 = item.morning?.sr520Time || item.sr520Time || 0;
      const e520 = item.evening?.sr520Time || item.sr520Time || 0;
      const mI90 = item.morning?.i90Time || item.i90Time || 0;
      const eI90 = item.evening?.i90Time || item.i90Time || 0;
      return m520 > 5 && e520 > 5 && mI90 > 5 && eI90 > 5;
    });

    const localTimestamps = new Set(localData.map(d => d?.timestamp).filter(Boolean));

    for (const fileUrl of filesToFetch) {
      try {
        const res = await fetch(fileUrl);
        if (res.ok) {
          const cloudData = await res.json();
          if (Array.isArray(cloudData)) {
            cloudData.forEach(item => {
              if (item && item.timestamp && !localTimestamps.has(item.timestamp)) {
                const m520 = item.morning?.sr520Time || item.sr520Time || 0;
                const e520 = item.evening?.sr520Time || item.sr520Time || 0;
                const mI90 = item.morning?.i90Time || item.i90Time || 0;
                const eI90 = item.evening?.i90Time || item.i90Time || 0;

                if (m520 > 5 && e520 > 5 && mI90 > 5 && eI90 > 5) {
                  localData.push(item);
                  localTimestamps.add(item.timestamp);
                }
              }
            });
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch ${fileUrl}`, err);
      }
    }

    localData.sort((a, b) => (a?.timestamp || 0) - (b?.timestamp || 0));
    saveHistoricalDatabase(localData);
    return localData;
  } catch (err) {
    console.warn("Cloud sync failed", err);
    return getHistoricalDatabase();
  }
}
