import React, { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { aggregateHistoryByTimeBucket, applyMovingAverage } from '../lib/utils';
import { History, ChevronRight, Layers, LayoutGrid } from 'lucide-react';

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

function IndividualDayMiniChart({ dateStr, dayHistory, isSeattleToKirkland, config, routeFilter }) {
  const chartData = useMemo(() => {
    const { labels, rawSR520, rawI90 } = aggregateHistoryByTimeBucket(dayHistory, isSeattleToKirkland);
    const windowSize = Math.max(1, config.smoothing * 2 - 1);
    const smoothed520 = config.smoothing > 1 ? applyMovingAverage(rawSR520, windowSize) : rawSR520;
    const smoothedI90 = config.smoothing > 1 ? applyMovingAverage(rawI90, windowSize) : rawI90;

    const datasets = [];
    if (routeFilter === 'all' || routeFilter === 'sr520') {
      datasets.push({
        label: 'SR-520',
        data: smoothed520,
        borderColor: '#10b981', // Emerald
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: false,
      });
    }
    if (routeFilter === 'all' || routeFilter === 'i90') {
      datasets.push({
        label: 'I-90',
        data: smoothedI90,
        borderColor: '#8b5cf6', // Purple
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: false,
      });
    }

    return { labels, datasets };
  }, [dayHistory, isSeattleToKirkland, config.smoothing, routeFilter]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      y: {
        min: 10,
        max: 60,
        grid: { color: 'rgba(51, 65, 85, 0.4)' },
        ticks: { color: '#94a3b8', font: { size: 10 } },
      },
      x: {
        grid: { color: 'rgba(51, 65, 85, 0.15)' },
        ticks: { 
          color: '#94a3b8',
          font: { size: 10 },
          maxTicksLimit: 6,
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
        labels: { color: '#e2e8f0', usePointStyle: true, boxWidth: 6, font: { size: 11 } }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#f1f5f9',
        bodyColor: '#cbd5e1',
        cornerRadius: 6,
      }
    }
  };

  return (
    <div className="w-[360px] sm:w-[450px] md:w-[500px] flex-shrink-0 snap-start bg-slate-900/70 border border-slate-700/60 rounded-xl p-4 flex flex-col shadow-lg">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold text-slate-100 border-l-2 border-emerald-400 pl-2">
          {dateStr}
        </span>
        <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700/60">
          {dayHistory.length} records
        </span>
      </div>
      <div className="h-[270px] w-full mt-1">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}

export default function HistoricalDowChart({ history, dayOfWeek = 'Monday', numWeeks = 10, direction, config }) {
  const [routeFilter, setRouteFilter] = useState('all'); // 'all', 'sr520', 'i90'
  const [viewMode, setViewMode] = useState('scroll'); // 'scroll', 'overlay'

  const isSeattleToKirkland = direction === 'seattle_to_kirkland';

  const processedData = useMemo(() => {
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
    const targetDates = allDates.slice(-numWeeks);
    // Reverse so newest date comes first in scroll list
    const datesReversed = [...targetDates].reverse();

    // 3. Build combined overlay chart dataset
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
      dateMap,
      targetDates,
      datesReversed,
      overlayChartData: {
        labels: commonLabels,
        datasets
      }
    };
  }, [history, dayOfWeek, numWeeks, direction, config.smoothing, routeFilter, isSeattleToKirkland]);

  const overlayOptions = {
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
            return processedData.overlayChartData.labels[index] ? processedData.overlayChartData.labels[index] : '';
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
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 h-full flex flex-col justify-between">
      <div>
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-400" />
              Last {processedData.targetDates.length} {dayOfWeek}s ({isSeattleToKirkland ? 'Morning' : 'Evening'})
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              Scroll through the last {processedData.targetDates.length} {dayOfWeek}s horizontally
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-lg border border-slate-700">
              <button
                onClick={() => setViewMode('scroll')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'scroll' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Individual Line (Scroll)
              </button>
              <button
                onClick={() => setViewMode('overlay')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'overlay' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Combined Overlay
              </button>
            </div>

            {/* Route Filter */}
            <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-lg border border-slate-700">
              <button
                onClick={() => setRouteFilter('all')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  routeFilter === 'all' ? 'bg-slate-700 text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setRouteFilter('sr520')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  routeFilter === 'sr520' ? 'bg-slate-700 text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                SR-520
              </button>
              <button
                onClick={() => setRouteFilter('i90')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  routeFilter === 'i90' ? 'bg-slate-700 text-purple-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                I-90
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'scroll' ? (
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Showing {processedData.datesReversed.length} daily charts (most recent first)</span>
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                Scroll horizontally <ChevronRight className="w-3.5 h-3.5 animate-pulse" />
              </span>
            </div>
            
            <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800/40">
              {processedData.datesReversed.map((dateStr) => {
                const dayHistory = processedData.dateMap.get(dateStr) || [];
                return (
                  <IndividualDayMiniChart
                    key={dateStr}
                    dateStr={dateStr}
                    dayHistory={dayHistory}
                    isSeattleToKirkland={isSeattleToKirkland}
                    config={config}
                    routeFilter={routeFilter}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <div className="h-[400px] w-full">
            <Line data={processedData.overlayChartData} options={overlayOptions} />
          </div>
        )}
      </div>
    </div>
  );
}
