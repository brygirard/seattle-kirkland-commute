import React, { useState } from 'react';
import Header from './components/Header';
import MetricCards from './components/MetricCards';
import RouteCards from './components/RouteCards';
import InteractiveMap from './components/InteractiveMap';
import DirectionTrendChart from './components/DirectionTrendChart';
import MultiDayChart from './components/MultiDayChart';
import { useCommuteState } from './hooks/useCommuteState';
import { Settings as SettingsIcon, X } from 'lucide-react';

function SettingsModal({ config, updateConfig, onClose }) {
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [quota, setQuota] = useState(config.dailyQuotaLimit);

  const handleSave = () => {
    updateConfig({ apiKey, dailyQuotaLimit: parseInt(quota, 10) });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-emerald-400" />
            Settings
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">TomTom API Key</label>
            <input 
              type="password" 
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5"
              placeholder="Enter your API key"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Daily Quota Limit</label>
            <input 
              type="number" 
              value={quota}
              onChange={e => setQuota(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5"
            />
          </div>
          <button 
            onClick={handleSave}
            className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)]"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const state = useCommuteState();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <Header 
          config={state.config} 
          updateConfig={state.updateConfig} 
          weather={state.weather} 
          refresh={state.refresh}
          showSettings={() => setShowSettings(true)}
        />
        
        {!state.config.apiKey ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <SettingsIcon className="w-16 h-16 text-slate-600 mb-4" />
            <h2 className="text-2xl font-bold text-slate-200 mb-2">TomTom API Key Required</h2>
            <p className="mb-6 max-w-md text-center">Please configure your TomTom API key in settings to fetch live routing data and history.</p>
            <button 
              onClick={() => setShowSettings(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg text-sm px-6 py-3 transition-colors shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)]"
            >
              Open Settings
            </button>
          </div>
        ) : state.routeData.seattle_to_kirkland ? (
          <>
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 mb-8 gap-4">
              
              {/* Left Side: Single Day Controls */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-300">Filter Day:</span>
                  <select
                    value={state.config.dayFilter}
                    onChange={(e) => state.updateConfig({ dayFilter: e.target.value })}
                    className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2"
                  >
                    <option value="all">All Days</option>
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-300">Global Smoothing:</span>
                  <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    value={state.config.smoothing}
                    onChange={(e) => state.updateConfig({ smoothing: parseInt(e.target.value, 10) })}
                    className="w-24 sm:w-32 accent-emerald-500"
                  />
                </div>
              </div>

              {/* Right Side: Multi Day Comparison Controls */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-300">Compare Days:</span>
                <div className="flex bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden flex-wrap">
                  {[0, 1, 2, 3, 4, 5, 6].map(day => {
                    const dayNamesFull = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    return (
                      <button
                        key={day}
                        onClick={() => state.toggleMultiDay(day)}
                        className={`px-2 md:px-3 py-1.5 text-xs font-medium transition-colors border-r border-slate-700/50 last:border-0 ${
                          state.multiDayActive.includes(day)
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                        }`}
                      >
                        {dayNamesFull[day]}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
              <DirectionTrendChart 
                history={state.history} 
                config={state.config} 
                updateConfig={state.updateConfig}
                direction="seattle_to_kirkland"
              />
              <MultiDayChart 
                history={state.history}
                multiDayActive={state.multiDayActive}
                toggleMultiDay={state.toggleMultiDay}
                direction="seattle_to_kirkland"
                config={state.config}
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
              <DirectionTrendChart 
                history={state.history} 
                config={state.config} 
                updateConfig={state.updateConfig}
                direction="kirkland_to_seattle"
              />
              <MultiDayChart 
                history={state.history}
                multiDayActive={state.multiDayActive}
                toggleMultiDay={state.toggleMultiDay}
                direction="kirkland_to_seattle"
                config={state.config}
              />
            </div>

            <MetricCards 
              routeData={state.routeData} 
              history={state.history} 
              config={state.config} 
              weather={state.weather} 
            />
            
            <RouteCards 
              routeData={state.routeData} 
              config={state.config} 
            />
            
            <div className="mb-8">
              <InteractiveMap 
                config={state.config} 
                routeData={state.routeData} 
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mb-4"></div>
            <p>Loading routing data...</p>
          </div>
        )}

        {showSettings && (
          <SettingsModal 
            config={state.config} 
            updateConfig={state.updateConfig} 
            onClose={() => setShowSettings(false)} 
          />
        )}
      </div>
    </div>
  );
}

export default App;
