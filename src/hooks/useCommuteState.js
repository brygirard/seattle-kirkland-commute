import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchRouteData, fetchWeather } from '../lib/api';
import { getHistoricalDatabase, syncCloudData, saveHistoricalDatabase, normalizeHistoryItem } from '../lib/history';

export function useCommuteState() {
  const [config, setConfig] = useState(() => {
    return {
      apiKey: localStorage.getItem('tomtom_api_key') || 'QuSopbXau96swtFznGbYJV74BYwuZAML',
      refreshIntervalMs: parseInt(localStorage.getItem('commute_poll_interval') || '300000', 10),
      dailyQuotaLimit: parseInt(localStorage.getItem('commute_quota_limit') || '2500', 10),
      direction: 'seattle_to_kirkland',
      dayFilter: new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'long' })
        .formatToParts(new Date()).find(p => p.type === 'weekday')?.value || 'all',
      smoothing: 2,
    };
  });

  const [routeData, setRouteData] = useState({
    seattle_to_kirkland: null,
    kirkland_to_seattle: null,
  });

  const weatherRef = useRef(null);
  const [weather, setWeather] = useState(null);
  const [rawHistory, setRawHistory] = useState([]);
  const [multiDayActive, setMultiDayActive] = useState([0, 1, 2, 3, 4, 5, 6]);

  const [compareDate1, setCompareDate1] = useState(null);
  const [compareDate2, setCompareDate2] = useState(null);
  const [historicalDow, setHistoricalDow] = useState('Monday');
  const [historicalDowCount, setHistoricalDowCount] = useState(10);

  // Load history on mount
  useEffect(() => {
    setRawHistory(getHistoricalDatabase());
    syncCloudData().then(data => setRawHistory(data));
  }, []);

  const history = useMemo(() => {
    return rawHistory.map(normalizeHistoryItem);
  }, [rawHistory]);

  const uniqueDates = useMemo(() => {
    const dates = new Set(history.map(h => h.dateStr));
    return Array.from(dates);
  }, [history]);

  useEffect(() => {
    if (uniqueDates.length > 0) {
      if (!compareDate1 && !uniqueDates.includes(compareDate1)) {
        setCompareDate1(uniqueDates[uniqueDates.length - 1]);
      }
      if (!compareDate2 && !uniqueDates.includes(compareDate2)) {
        setCompareDate2(uniqueDates.length > 1 ? uniqueDates[uniqueDates.length - 2] : uniqueDates[0]);
      }
    }
  }, [uniqueDates, compareDate1, compareDate2]);

  const updateConfig = (newConfig) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    if (newConfig.apiKey !== undefined) localStorage.setItem('tomtom_api_key', newConfig.apiKey);
    if (newConfig.refreshIntervalMs !== undefined) localStorage.setItem('commute_poll_interval', String(newConfig.refreshIntervalMs));
    if (newConfig.dailyQuotaLimit !== undefined) localStorage.setItem('commute_quota_limit', String(newConfig.dailyQuotaLimit));
  };

  const isFetchingRef = useRef(false);

  const fetchLiveTraffic = useCallback(async () => {
    if (!config.apiKey || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const delay = (ms) => new Promise(res => setTimeout(res, ms));
      
      const skSr520 = await fetchRouteData(config.apiKey, 'sr520', 'seattle_to_kirkland');
      await delay(300);
      const skI90 = await fetchRouteData(config.apiKey, 'i90', 'seattle_to_kirkland');
      await delay(300);
      const ksSr520 = await fetchRouteData(config.apiKey, 'sr520', 'kirkland_to_seattle');
      await delay(300);
      const ksI90 = await fetchRouteData(config.apiKey, 'i90', 'kirkland_to_seattle');

      const skData = {
        sr520Time: skSr520.travelTime, sr520Delay: skSr520.trafficDelay,
        i90Time: skI90.travelTime, i90Delay: skI90.trafficDelay,
        timestamp: Date.now()
      };
      
      const ksData = {
        sr520Time: ksSr520.travelTime, sr520Delay: ksSr520.trafficDelay,
        i90Time: ksI90.travelTime, i90Delay: ksI90.trafficDelay,
        timestamp: Date.now()
      };

      setRouteData({
        seattle_to_kirkland: skData,
        kirkland_to_seattle: ksData
      });

      // Save to history snapshot
      setRawHistory(prev => {
        const newHistory = [...prev];
        newHistory.push({
          timestamp: Date.now(),
          morning: skData,
          evening: ksData,
          weather: weatherRef.current || { temp: 60, rain: 0, code: 0 },
          incidents: 0
        });
        if (newHistory.length > 5000) newHistory.shift();
        saveHistoricalDatabase(newHistory);
        return newHistory;
      });

    } catch (e) {
      console.warn("Live fetch failed", e);
    } finally {
      isFetchingRef.current = false;
    }
  }, [config.apiKey]);

  // Weather polling
  useEffect(() => {
    const updateWeather = async () => {
      const w = await fetchWeather();
      if (w) {
        setWeather(w);
        weatherRef.current = w;
      }
    };
    updateWeather();
    const interval = setInterval(updateWeather, 1800000); // 30 mins
    return () => clearInterval(interval);
  }, []);

  // Traffic polling
  useEffect(() => {
    fetchLiveTraffic();
    const interval = setInterval(fetchLiveTraffic, config.refreshIntervalMs);
    return () => clearInterval(interval);
  }, [fetchLiveTraffic, config.refreshIntervalMs]);

  const toggleMultiDay = (day) => {
    setMultiDayActive(prev => {
      if (prev.includes(day)) {
        return prev.length > 1 ? prev.filter(d => d !== day) : prev;
      } else {
        return [...prev, day];
      }
    });
  };

  return {
    config,
    updateConfig,
    routeData,
    weather,
    history,
    multiDayActive,
    toggleMultiDay,
    uniqueDates,
    compareDate1,
    setCompareDate1,
    compareDate2,
    setCompareDate2,
    historicalDow,
    setHistoricalDow,
    historicalDowCount,
    setHistoricalDowCount,
    refresh: fetchLiveTraffic
  };
}
