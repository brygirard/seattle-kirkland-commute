import React from 'react';
import { Navigation } from 'lucide-react';

export default function RouteCards({ routeData, config }) {
  const data = routeData[config.direction];
  if (!data) return null;

  const sr520Total = data.sr520Time;
  const i90Total = data.i90Time;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      {/* SR-520 Card */}
      <div className={`p-6 rounded-2xl border transition-all duration-300 ${
        sr520Total <= i90Total 
          ? 'bg-gradient-to-br from-emerald-900/20 to-slate-900 border-emerald-500/30 shadow-[0_0_30px_-5px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20' 
          : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50'
      }`}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              SR-520
              {sr520Total <= i90Total && (
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">
                  Fastest
                </span>
              )}
            </h3>
            <p className="text-sm text-slate-400 mt-1">Via Floating Bridge (Toll)</p>
          </div>
          <div className={`p-3 rounded-xl ${sr520Total <= i90Total ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-400'}`}>
            <Navigation className="w-5 h-5" />
          </div>
        </div>

        <div className="flex items-end gap-3 mb-6">
          <span className="text-5xl font-black tracking-tight text-slate-100">{sr520Total}</span>
          <span className="text-lg text-slate-400 font-medium mb-1">min</span>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Current Delay</span>
            <span className={`font-semibold ${data.sr520Delay > 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
              +{data.sr520Delay} min
            </span>
          </div>
          <div className="w-full bg-slate-700/50 rounded-full h-1.5">
            <div 
              className={`h-1.5 rounded-full ${data.sr520Delay > 5 ? 'bg-amber-400' : 'bg-emerald-400'}`}
              style={{ width: `${Math.min(100, (data.sr520Delay / 15) * 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* I-90 Card */}
      <div className={`p-6 rounded-2xl border transition-all duration-300 ${
        i90Total < sr520Total 
          ? 'bg-gradient-to-br from-emerald-900/20 to-slate-900 border-emerald-500/30 shadow-[0_0_30px_-5px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20' 
          : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50'
      }`}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              I-90
              {i90Total < sr520Total && (
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">
                  Fastest
                </span>
              )}
            </h3>
            <p className="text-sm text-slate-400 mt-1">Via Mercer Island (No Toll)</p>
          </div>
          <div className={`p-3 rounded-xl ${i90Total < sr520Total ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-400'}`}>
            <Navigation className="w-5 h-5" />
          </div>
        </div>

        <div className="flex items-end gap-3 mb-6">
          <span className="text-5xl font-black tracking-tight text-slate-100">{i90Total}</span>
          <span className="text-lg text-slate-400 font-medium mb-1">min</span>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Current Delay</span>
            <span className={`font-semibold ${data.i90Delay > 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
              +{data.i90Delay} min
            </span>
          </div>
          <div className="w-full bg-slate-700/50 rounded-full h-1.5">
            <div 
              className={`h-1.5 rounded-full ${data.i90Delay > 5 ? 'bg-amber-400' : 'bg-emerald-400'}`}
              style={{ width: `${Math.min(100, (data.i90Delay / 15) * 100)}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
