import React, { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { aggregateHistoryByTimeBucket, applyMovingAverage } from '../lib/utils';
import { History } from 'lucide-react';

const PALETTE = [
  '#3b82f6', // Blue (most recent)
  '#10b981', // Emerald
  '#f97316', // Orange
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#eab308', // Yellow
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
  '#84cc16', // Lime
  '#6366f1', // Indigo
];

export default function HistoricalDowChart({ history, dayOfWeek = 'Monday', numWeeks = 10, direction, config }) {
  const [routeFilter, setRouteFilter] = useState('all'); // 'all', 'sr520', 'i90'

  const chartData = useMemo(() => {
    const isSeattleToKirkland = direction === 'seattle_to_kirkland';

    // 1. Filter history by dayOfWeek
    const filteredHistory = history.filter(h => h.dayOfWeek === dayOfWeek);

    // 2. Get unique dates preserving chronological order
    const dateMap = new Map();
    filteredHistory.forEach(h => {
      if (h.dateStr && !dateMap.has(h.dateStr)) {
        dateMap.set(h.dateStr, []);
      }
      if (h.dateStr) {
        dateMap.get(h.dateStr).push(h);
      }
    });

    const allDates = Array.from(dateMap.keys());
    // Pick last numWeeks dates
    const targetDates = allDates.slice(-numWeeks);

    const datasets = [];
    let commonLabels = [];
    const windowSize = Math.max(1, config.smoothing * 2 - 1);

    targetDates.forEach((dateStr, idx) => {
      const dayHistory = dateMap.get(dateStr) || [];
      if (dayHistory.length === 0) return;

      const { labels, rawSR520, rawI90 } = aggregateHistoryByTimeBucket(dayHistory, isSeattleToKirkland);
      if (commonLabels.length === 0) commonLabels = labels;

      const smoothed520 = config.smoothing > 1 ? applyMovingAverage(rawSR520, windowSize) : rawSR520;
      const smoothedI90 = config.smoothing > 1 ? applyMovingAverage(rawI90, windowSize) : rawI90;

      const color = PALETTE[idx % PALETTE.length];

      if (routeFilter === 'all' || routeFilter === 'sr520') {
        datasets.push({
          label: `${dateStr} (SR-520)`,
          data: smoothed520,
          borderColor: color,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          fill: false,
        });
      }

      if (routeFilter === 'all' || routeFilter === 'i90') {
        datasets.push({
          label: `${dateStr} (I-90)`,
          data: smoothedI90,
          borderColor: color,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          tension: 0.4,
          fill: false,
        });
      }
    });

    return {
      labels: commonLabels,
      datasets,
      count: targetDates.length
    };
  }, [history, dayOfWeek, numWeeks, direction, config.smoothing, routeFilter]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      y: {
        min: 10,
        max: 60,
        grid: { color: 'rgba(51, 65, 85, 0.5)' },
        ticks: { color: '#94a3b8' },
        title: { display: true, text: 'Minutes', color: '#64748b' }
      },
      x: {
        grid: { color: 'rgba(51, 65, 85, 0.2)' },
        ticks: { 
          color: '#94a3b8',
          maxTicksLimit: 12,
          autoSkip: true,
          callback: function(val, index) {
            return chartData.labels[index] ? chartData.labels[index] : '';
          }
        }
      }
    },
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#e2e8f0', usePointStyle: true, boxWidth: 8 }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#f1f5f9',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(51, 65, 85, 0.8)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
      }
    }
  };

  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 mb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-400" />
            Last {chartData.count} {dayOfWeek}s Trend ({direction === 'seattle_to_kirkland' ? 'Morning' : 'Evening'})
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Comparing the most recent {chartData.count} {dayOfWeek}s in recorded history
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => setRouteFilter('all')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              routeFilter === 'all' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Routes
          </button>
          <button
            onClick={() => setRouteFilter('sr520')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              routeFilter === 'sr520' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            SR-520 Only
          </button>
          <button
            onClick={() => setRouteFilter('i90')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              routeFilter === 'i90' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            I-90 Only
          </button>
        </div>
      </div>

      <div className="h-[420px] w-full">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
