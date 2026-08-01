import React from 'react';
import { Clock, TrendingUp, TrendingDown, Route, AlertTriangle, CloudRain, Sun } from 'lucide-react';

export default function MetricCards({ routeData, history, config, weather }) {
  const isSeattleToKirkland = config.direction === 'seattle_to_kirkland';
  const data = routeData[config.direction];

  if (!data) return null;

  const sr520Total = data.sr520Time;
  const i90Total = data.i90Time;
  const fastestRoute = sr520Total <= i90Total ? 'SR-520' : 'I-90';
  const fastestTime = Math.min(sr520Total, i90Total);
  const diff = Math.abs(sr520Total - i90Total);

  let historicalAvg = '--';
  if (history.length > 0) {
    const curHour = new Date().getHours();
    const recentSameHour = history.filter(h => h.hour === curHour);
    if (recentSameHour.length > 0) {
      let sum = 0;
      let count = 0;
      recentSameHour.forEach(h => {
        const val = isSeattleToKirkland ? h.morning?.sr520Time : h.evening?.sr520Time;
        if (val) {
          sum += val;
          count++;
        }
      });
      if (count > 0) historicalAvg = Math.round(sum / count);
    }
  }

  const isWorseThanAvg = historicalAvg !== '--' && fastestTime > historicalAvg;
  const isRaining = weather?.rain > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      
      {/* Recommended Route */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-5 rounded-2xl flex flex-col justify-between">
        <div className="flex justify-between items-start mb-2">
          <div className="text-sm text-slate-400 font-medium">Recommended Route</div>
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Route className="w-4 h-4 text-emerald-400" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-100">{fastestRoute}</span>
          <span className="text-emerald-400 font-medium text-sm">({fastestTime} min)</span>
        </div>
        <div className="text-xs text-slate-500 mt-2">
          Saves {diff} min compared to {fastestRoute === 'SR-520' ? 'I-90' : 'SR-520'}
        </div>
      </div>

      {/* Traffic Status */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-5 rounded-2xl flex flex-col justify-between">
        <div className="flex justify-between items-start mb-2">
          <div className="text-sm text-slate-400 font-medium">Current Status</div>
          <div className={`p-2 rounded-lg ${isWorseThanAvg ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
            <Clock className={`w-4 h-4 ${isWorseThanAvg ? 'text-red-400' : 'text-emerald-400'}`} />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-bold ${isWorseThanAvg ? 'text-red-400' : 'text-emerald-400'}`}>
            {isWorseThanAvg ? 'Heavy' : 'Light'}
          </span>
        </div>
        <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
          {isWorseThanAvg ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {historicalAvg !== '--' ? `vs ${historicalAvg}m historical avg at this hour` : 'Awaiting history'}
        </div>
      </div>

      {/* Weather Impact */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-5 rounded-2xl flex flex-col justify-between">
        <div className="flex justify-between items-start mb-2">
          <div className="text-sm text-slate-400 font-medium">Weather Impact</div>
          <div className={`p-2 rounded-lg ${isRaining ? 'bg-blue-500/10' : 'bg-amber-500/10'}`}>
            {isRaining ? <CloudRain className="w-4 h-4 text-blue-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-100">
            {isRaining ? '+15%' : 'None'}
          </span>
        </div>
        <div className="text-xs text-slate-500 mt-2">
          {isRaining ? 'Rain increases typical delay' : 'Clear conditions, optimal flow'}
        </div>
      </div>

      {/* Incidents (Mocked) */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-5 rounded-2xl flex flex-col justify-between">
        <div className="flex justify-between items-start mb-2">
          <div className="text-sm text-slate-400 font-medium">Reported Incidents</div>
          <div className="p-2 bg-amber-500/10 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-100">0</span>
          <span className="text-slate-400 text-sm">on route</span>
        </div>
        <div className="text-xs text-slate-500 mt-2">
          No major accidents reported
        </div>
      </div>

    </div>
  );
}
