import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { aggregateHistoryByTimeBucket, applyMovingAverage } from '../lib/utils';
import { CalendarDays } from 'lucide-react';

export default function MultiDayChart({ history, multiDayActive, toggleMultiDay, direction, config }) {
  const chartData = useMemo(() => {
    const isSeattleToKirkland = direction === 'seattle_to_kirkland';
    
    // Day index to label mapping
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const colors = [
      '#ef4444', // 0 Sun - Red
      '#3b82f6', // 1 Mon - Blue
      '#eab308', // 2 Tue - Yellow
      '#10b981', // 3 Wed - Emerald
      '#8b5cf6', // 4 Thu - Purple
      '#f97316', // 5 Fri - Orange
      '#64748b'  // 6 Sat - Slate
    ];

    const datasets = [];
    let commonLabels = [];

    // Apply same smoothing as main chart
    const windowSize = Math.max(1, config.smoothing * 2 - 1);

    multiDayActive.forEach(dayIdx => {
      const dayHistory = history.filter(h => h.dayIndex === dayIdx);
      if (dayHistory.length === 0) return;

      const { labels, rawSR520, rawI90 } = aggregateHistoryByTimeBucket(dayHistory, isSeattleToKirkland);
      if (commonLabels.length === 0) commonLabels = labels;

      const smoothed520 = config.smoothing > 1 ? applyMovingAverage(rawSR520, windowSize) : rawSR520;
      const smoothedI90 = config.smoothing > 1 ? applyMovingAverage(rawI90, windowSize) : rawI90;

      datasets.push({
        label: `${dayNames[dayIdx]} (SR-520)`,
        data: smoothed520,
        borderColor: colors[dayIdx],
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: false,
      });

      datasets.push({
        label: `${dayNames[dayIdx]} (I-90)`,
        data: smoothedI90,
        borderColor: colors[dayIdx],
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0.4,
        fill: false,
      });
    });

    return {
      labels: commonLabels,
      datasets
    };
  }, [history, multiDayActive, direction, config.smoothing]);

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

  const dayNamesFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 h-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-emerald-400" />
            Day-over-Day Comparison ({direction === 'seattle_to_kirkland' ? 'Morning' : 'Evening'})
          </h3>
          <p className="text-sm text-slate-400 mt-1">Travel patterns across selected days</p>
        </div>
      </div>

      <div className="h-[400px] w-full">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
