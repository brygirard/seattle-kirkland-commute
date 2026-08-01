export function applyMovingAverage(arr, windowSize = 3) {
  if (!Array.isArray(arr) || arr.length <= 2) return arr;
  const result = [];
  const half = Math.floor(windowSize / 2);

  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === null || arr[i] === undefined) {
      result.push(null);
      continue;
    }
    let sum = 0;
    let count = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < arr.length && typeof arr[j] === 'number' && arr[j] !== null) {
        sum += arr[j];
        count++;
      }
    }
    result.push(count > 0 ? Math.round((sum / count) * 10) / 10 : arr[i]);
  }
  return result;
}

export function aggregateHistoryByTimeBucket(history, isSeattleToKirkland) {
  const buckets = {};
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 5) {
      const key = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      buckets[key] = { s520: [], i90: [] };
    }
  }

  history.forEach(item => {
    const s520 = isSeattleToKirkland ? (item.morning?.sr520Time || 0) : (item.evening?.sr520Time || 0);
    const i90  = isSeattleToKirkland ? (item.morning?.i90Time || 0) : (item.evening?.i90Time || 0);

    if (s520 > 5 && i90 > 5 && item.timeStr) {
      const isPM = item.timeStr.includes('PM');
      let [hStr, mStr] = item.timeStr.split(' ')[0].split(':');
      let h = parseInt(hStr, 10);
      if (isPM && h !== 12) h += 12;
      if (!isPM && h === 12) h = 0;
      
      const bucketMin = Math.floor(parseInt(mStr, 10) / 5) * 5;
      const key = `${String(h).padStart(2, '0')}:${String(bucketMin).padStart(2, '0')}`;
      
      if (buckets[key]) {
        buckets[key].s520.push(s520);
        buckets[key].i90.push(i90);
      }
    }
  });

  const keys = Object.keys(buckets).sort();
  const rawSR520 = [];
  const rawI90 = [];
  const labels = [];

  keys.forEach(key => {
    const b = buckets[key];
    const [hStr, mStr] = key.split(':');
    const h = parseInt(hStr, 10);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    labels.push(mStr === '00' ? `${displayH}:00 ${period}` : '');

    if (b.s520.length > 0) {
      const avg520 = b.s520.reduce((a, v) => a + v, 0) / b.s520.length;
      const avgI90 = b.i90.reduce((a, v) => a + v, 0) / b.i90.length;
      rawSR520.push(Math.round(avg520 * 10) / 10);
      rawI90.push(Math.round(avgI90 * 10) / 10);
    } else {
      rawSR520.push(null);
      rawI90.push(null);
    }
  });

  return { labels, keys, rawSR520, rawI90 };
}

// Emulate TomTom historical curves (same as legacy)
export function getTomTomBaselineForTime(hour, minute, isSeattleToKirkland, dayFilter) {
  let isWeekend = false;
  if (dayFilter === '0' || dayFilter === '6' || dayFilter === 'Saturday' || dayFilter === 'Sunday') {
    isWeekend = true;
  }

  const sr520_base = isSeattleToKirkland ? 16 : 18;
  const i90_base = isSeattleToKirkland ? 20 : 22;

  let sr520_multiplier = 1.0;
  let i90_multiplier = 1.0;

  const timeFloat = hour + (minute / 60);

  if (!isWeekend) {
    if (isSeattleToKirkland) {
      if (timeFloat >= 6 && timeFloat <= 10) {
        const peak = 8.5;
        const dist = Math.abs(timeFloat - peak);
        sr520_multiplier = 1.0 + Math.max(0, (2 - dist) * 0.4);
        i90_multiplier = 1.0 + Math.max(0, (2 - dist) * 0.3);
      } else if (timeFloat >= 15 && timeFloat <= 19) {
        const peak = 17.5;
        const dist = Math.abs(timeFloat - peak);
        sr520_multiplier = 1.0 + Math.max(0, (2 - dist) * 0.15);
        i90_multiplier = 1.0 + Math.max(0, (2 - dist) * 0.1);
      }
    } else {
      if (timeFloat >= 15 && timeFloat <= 19) {
        const peak = 17.0;
        const dist = Math.abs(timeFloat - peak);
        sr520_multiplier = 1.0 + Math.max(0, (2 - dist) * 0.5);
        i90_multiplier = 1.0 + Math.max(0, (2 - dist) * 0.4);
      } else if (timeFloat >= 6 && timeFloat <= 10) {
        const peak = 8.0;
        const dist = Math.abs(timeFloat - peak);
        sr520_multiplier = 1.0 + Math.max(0, (2 - dist) * 0.15);
        i90_multiplier = 1.0 + Math.max(0, (2 - dist) * 0.1);
      }
    }
  }

  return {
    sr520: Math.round(sr520_base * sr520_multiplier * 10) / 10,
    i90: Math.round(i90_base * i90_multiplier * 10) / 10
  };
}
