import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers } from 'lucide-react';

const SEATTLE = [47.616641, -122.349692];
const KIRKLAND = [47.673898, -122.193077];
const SR520_WAYPOINTS = [
  SEATTLE,
  [47.6438, -122.2963], // Bridge approach
  [47.6366, -122.2530], // Floating bridge
  KIRKLAND
];
const I90_WAYPOINTS = [
  SEATTLE,
  [47.5900, -122.2980], // I-90 bridge approach
  [47.5850, -122.2350], // Mercer Island
  [47.6150, -122.1880], // I-405 N
  KIRKLAND
];

export default function InteractiveMap({ config, routeData }) {
  const isSeattleToKirkland = config.direction === 'seattle_to_kirkland';
  const data = routeData[config.direction];
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return <div className="h-[400px] w-full bg-slate-800 animate-pulse rounded-2xl" />;

  const sr520Color = data?.sr520Time <= data?.i90Time ? '#10b981' : '#64748b'; // Emerald if fastest, else slate
  const i90Color = data?.i90Time < data?.sr520Time ? '#10b981' : '#64748b';

  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 mb-8 relative overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            Live Route Map
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            {isSeattleToKirkland ? 'Seattle ➔ Kirkland' : 'Kirkland ➔ Seattle'}
          </p>
        </div>
      </div>
      
      <div className="h-[400px] w-full rounded-xl overflow-hidden border border-slate-700/50">
        <MapContainer 
          center={[47.64, -122.27]} 
          zoom={11} 
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />
          <Polyline 
            positions={isSeattleToKirkland ? SR520_WAYPOINTS : [...SR520_WAYPOINTS].reverse()} 
            pathOptions={{ color: sr520Color, weight: 6, opacity: 0.8 }} 
          />
          <Polyline 
            positions={isSeattleToKirkland ? I90_WAYPOINTS : [...I90_WAYPOINTS].reverse()} 
            pathOptions={{ color: i90Color, weight: 6, opacity: 0.8 }} 
          />
        </MapContainer>
      </div>

      <div className="absolute bottom-10 right-10 bg-slate-900/90 backdrop-blur border border-slate-700 p-3 rounded-xl shadow-xl flex flex-col gap-2 z-[400]">
        <div className="flex items-center gap-2 text-sm">
          <div className="w-4 h-1 bg-emerald-500 rounded-full"></div>
          <span className="text-slate-200">Fastest Route</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-4 h-1 bg-slate-500 rounded-full"></div>
          <span className="text-slate-200">Alternative</span>
        </div>
      </div>
    </div>
  );
}
