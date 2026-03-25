'use client';

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Search, Loader2 } from 'lucide-react';

// Fix for default marker icons in Leaflet with Next.js
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface LocationPickerProps {
  onLocationSelect: (location: string) => void;
  initialValue?: string;
}

function MapEvents({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function LocationPicker({ onLocationSelect, initialValue }: LocationPickerProps) {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    if (initialValue && !searchQuery) {
      setSearchQuery(initialValue);
    }
    // Only run on initial mount or if initialValue changes when searchQuery is empty
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  // Default to London if no position
  const defaultCenter: [number, number] = [51.505, -0.09];

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'SozoDiscovery/1.0',
          },
        }
      );
      const data = await response.json();
      
      const city = data.address.city || data.address.town || data.address.village || data.address.suburb || 'Unknown City';
      const country = data.address.country || 'Unknown Country';
      
      const formatted = `${city}, ${country}`;
      onLocationSelect(formatted);
      setSearchQuery(formatted);
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
        {
          headers: {
            'User-Agent': 'SozoDiscovery/1.0',
          },
        }
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const newPos: [number, number] = [parseFloat(lat), parseFloat(lon)];
        setPosition(newPos);
        
        // Try to extract city and country from display_name or just use the query if it looks like city, country
        // For consistency, let's reverse geocode the result to get clean city, country
        await reverseGeocode(newPos[0], newPos[1]);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleMapClick = async (lat: number, lng: number) => {
    setPosition([lat, lng]);
    await reverseGeocode(lat, lng);
  };

  return (
    <div className="space-y-2 w-full">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="OPERATIONAL LOCATION (city, country)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowMap(true)}
            className="w-full bg-black border border-[#1c1c1c] p-[12px] sm:p-[14px] font-mono text-[12px] sm:text-[13px] text-white placeholder:text-[#2a2a2a] focus:outline-none focus:border-[#e8ff00] transition-colors rounded-none pr-10"
          />
          <button
            onClick={handleSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a5a5a] hover:text-[#e8ff00] transition-colors"
          >
            {isSearching ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
          </button>
        </div>
        <button
          onClick={() => setShowMap(!showMap)}
          className={`p-[12px] border transition-colors ${showMap ? 'border-[#e8ff00] text-[#e8ff00]' : 'border-[#1c1c1c] text-[#5a5a5a] hover:border-[#e8ff00] hover:text-[#e8ff00]'}`}
        >
          <MapPin size={20} />
        </button>
      </div>

      {showMap && (
        <div className="h-[200px] sm:h-[250px] w-full border border-[#1c1c1c] relative z-20">
          <MapContainer
            center={position || defaultCenter}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {position && <Marker position={position} />}
            <MapEvents onLocationSelect={handleMapClick} />
            {position && <ChangeView center={position} />}
          </MapContainer>
          <div className="absolute bottom-2 right-2 z-[1000] bg-black/80 border border-[#1c1c1c] p-2 font-mono text-[9px] text-[#5a5a5a] uppercase">
            Click map to set location
          </div>
        </div>
      )}
    </div>
  );
}
