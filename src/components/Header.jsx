import React from 'react';
import { RefreshCcw, Activity, Map, ArrowRightLeft, Settings } from 'lucide-react';

export default function Header({ config, updateConfig, weather, refresh, pointsCount, showSettings }) {
  const isSeattleToKirkland = config.direction === 'seattle_to_kirkland';
  
  const toggleDirection = () => {
    updateConfig({ direction: isSeattleToKirkland ? 'kirkland_to_seattle' : 'seattle_to_kirkland' });
  };

  const weatherBadge = weather ? (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 rounded-full border border-slate-700/50 text-sm">
      <span className="text-amber-400">🌤️</span>
      <span className="font-medium">{weather.temp}°F</span>
      <span className="text-slate-400 text-xs ml-1">
        {weather.rain > 0 ? `🌧️ ${weather.rain}"` : 'No rain'}
      </span>
    </div>
  ) : null;

  return (
    <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
          <Map className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Commute & Traffic Optimizer
          </h1>
          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            Live TomTom Data
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {weatherBadge}
        
        <button 
          onClick={toggleDirection}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg border border-slate-700/50 font-medium text-sm text-slate-200"
        >
          <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
          <span className="hidden sm:inline">
            {isSeattleToKirkland ? 'Seattle ➔ Kirkland' : 'Kirkland ➔ Seattle'}
          </span>
          <span className="sm:hidden">Switch Dir</span>
        </button>

        <button 
          onClick={refresh}
          className="p-2 bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg border border-slate-700/50 text-slate-400 hover:text-emerald-400"
          title="Refresh Data"
        >
          <RefreshCcw className="w-4 h-4" />
        </button>
        
        <button 
          onClick={showSettings}
          className="p-2 bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg border border-slate-700/50 text-slate-400 hover:text-slate-200"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
