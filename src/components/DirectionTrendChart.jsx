import React, { useMemo, useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { applyMovingAverage, aggregateHistoryByTimeBucket, getTomTomBaselineForTime } from '../lib/utils';
import { SlidersHorizontal } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function DirectionTrendChart({ history, config, updateConfig, direction }) {
  const isSeattleToKirkland = direction === 'seattle_to_kirkland';

  const chartData = useMemo(() => {
    let filteredHistory = history;
    if (!config.dayFilter || config.dayFilter === 'all') {
      // Exclude Saturday and Sunday from all days combined
      filteredHistory = history.filter(h => h.dayIndex !== 0 && h.dayIndex !== 6);
    } else {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const selectedIdx = dayNames.indexOf(config.dayFilter);
      if (selectedIdx !== -1) {
        filteredHistory = history.filter(h => h.dayIndex === selectedIdx);
      }
    }

    const { labels, keys, rawSR520, rawI90 } = aggregateHistoryByTimeBucket(filteredHistory, isSeattleToKirkland);
    
    // Apply smoothing based on user slider (1 to 10 mapped to window sizes)
    const windowSize = Math.max(1, config.smoothing * 2 - 1);
    const s520Smoothed = config.smoothing > 1 ? applyMovingAverage(rawSR520, windowSize) : rawSR520;
    const i90Smoothed = config.smoothing > 1 ? applyMovingAverage(rawI90, windowSize) : rawI90;

    return {
      labels,
      datasets: [
        {
          label: 'SR-520',
          data: s520Smoothed,
          borderColor: '#10b981', // Emerald
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          fill: false,
        },
        {
          label: 'I-90',
          data: i90Smoothed,
          borderColor: '#8b5cf6', // Purple
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          fill: false,
        }
      ]
    };
  }, [history, isSeattleToKirkland, config.smoothing, config.dayFilter]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false, // Prevents lag on slider change
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
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 h-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-100">
            {isSeattleToKirkland ? 'Morning Commute Trend' : 'Evening Commute Trend'}
          </h3>
          <p className="text-sm text-slate-400 mt-1">Average travel times by time of day</p>
        </div>
      </div>
      
      <div className="h-[400px] w-full">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
