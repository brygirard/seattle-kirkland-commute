import React, { useState } from 'react';
import Header from './components/Header';
import MetricCards from './components/MetricCards';
import RouteCards from './components/RouteCards';
import InteractiveMap from './components/InteractiveMap';
import DirectionTrendChart from './components/DirectionTrendChart';
import MultiDayChart from './components/MultiDayChart';
import DateComparisonChart from './components/DateComparisonChart';
import HistoricalDowChart from './components/HistoricalDowChart';
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
  const [activeTab, setActiveTab] = useState('trend'); // 'trend', 'comparison', 'calendar', 'historical_dow'

  return (
    <div className="min-h-screen bg-slate-900 p-3 sm:p-5 font-sans w-full">
      <div className="w-full">
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
            <div className="flex border-b border-slate-700/50 mb-6 space-x-2 md:space-x-4 overflow-x-auto pb-1">
              <button 
                onClick={() => setActiveTab('trend')} 
                className={`py-2 px-3 md:px-4 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${activeTab === 'trend' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600'}`}
              >
                Commute Trend
              </button>
              <button 
                onClick={() => setActiveTab('comparison')} 
                className={`py-2 px-3 md:px-4 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${activeTab === 'comparison' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600'}`}
              >
                Full Comparison
              </button>
              <button 
                onClick={() => setActiveTab('calendar')} 
                className={`py-2 px-3 md:px-4 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${activeTab === 'calendar' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600'}`}
              >
                Calendar Date Comparison
              </button>
              <button 
                onClick={() => setActiveTab('historical_dow')} 
                className={`py-2 px-3 md:px-4 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${activeTab === 'historical_dow' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600'}`}
              >
                Last {state.historicalDowCount} {state.historicalDow}s
              </button>
            </div>

            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 mb-8 gap-4">
              <div className="flex flex-wrap items-center gap-4">
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
                
                {activeTab === 'trend' && (
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
                )}

                {activeTab === 'historical_dow' && (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-300">Select Day:</span>
                      <select
                        value={state.historicalDow}
                        onChange={(e) => state.setHistoricalDow(e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2"
                      >
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
                      <span className="text-sm font-medium text-slate-300">Weeks:</span>
                      <select
                        value={state.historicalDowCount}
                        onChange={(e) => state.setHistoricalDowCount(parseInt(e.target.value, 10))}
                        className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2"
                      >
                        <option value={5}>Last 5</option>
                        <option value={10}>Last 10</option>
                        <option value={15}>Last 15</option>
                        <option value={20}>Last 20</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              {activeTab === 'comparison' && (
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
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {activeTab === 'trend' && (
                <>
                  <DirectionTrendChart 
                    history={state.history} 
                    config={state.config} 
                    updateConfig={state.updateConfig}
                    direction="seattle_to_kirkland"
                  />
                  <DirectionTrendChart 
                    history={state.history} 
                    config={state.config} 
                    updateConfig={state.updateConfig}
                    direction="kirkland_to_seattle"
                  />
                </>
              )}
              {activeTab === 'comparison' && (
                <>
                  <MultiDayChart 
                    history={state.history}
                    multiDayActive={state.multiDayActive}
                    toggleMultiDay={state.toggleMultiDay}
                    direction="seattle_to_kirkland"
                    config={state.config}
                  />
                  <MultiDayChart 
                    history={state.history}
                    multiDayActive={state.multiDayActive}
                    toggleMultiDay={state.toggleMultiDay}
                    direction="kirkland_to_seattle"
                    config={state.config}
                  />
                </>
              )}
              {activeTab === 'calendar' && (
                <>
                  <DateComparisonChart 
                    history={state.history}
                    date1={state.compareDate1}
                    date2={state.compareDate2}
                    setDate1={state.setCompareDate1}
                    setDate2={state.setCompareDate2}
                    uniqueDates={state.uniqueDates}
                    direction="seattle_to_kirkland"
                    config={state.config}
                  />
                  <DateComparisonChart 
                    history={state.history}
                    date1={state.compareDate1}
                    date2={state.compareDate2}
                    setDate1={state.setCompareDate1}
                    setDate2={state.setCompareDate2}
                    uniqueDates={state.uniqueDates}
                    direction="kirkland_to_seattle"
                    config={state.config}
                  />
                </>
              )}
              {activeTab === 'historical_dow' && (
                <>
                  <HistoricalDowChart 
                    history={state.history}
                    dayOfWeek={state.historicalDow}
                    numWeeks={state.historicalDowCount}
                    direction="seattle_to_kirkland"
                    config={state.config}
                  />
                  <HistoricalDowChart 
                    history={state.history}
                    dayOfWeek={state.historicalDow}
                    numWeeks={state.historicalDowCount}
                    direction="kirkland_to_seattle"
                    config={state.config}
                  />
                </>
              )}
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
