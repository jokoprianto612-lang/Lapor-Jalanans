// Location Picker Component
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Card, Badge } from '@/components/ui';
import { MapPin, X, Crosshair, Map, CheckCircle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { clsx } from 'clsx';

function MapClickHandler({ onClick }: { onClick: (e: L.LeafletMouseEvent) => void }) {
  useMapEvents({ click: onClick });
  return null;
}

interface LocationPickerProps {
  onSelect: (location: { latitude: number; longitude: number }) => void;
  onClose: () => void;
  initialLocation?: { latitude: number; longitude: number } | null;
}

const DEFAULT_CENTER: [number, number] = [-6.2, 106.8]; // Jakarta

export function LocationPicker({ onSelect, onClose, initialLocation }: LocationPickerProps) {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(initialLocation ? 
    { lat: initialLocation.latitude, lng: initialLocation.longitude } : null
  );
  const [address, setAddress] = useState<string>('');
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [zoom, setZoom] = useState(15);
  const mapRef = useRef<any>(null);

  // Reverse geocode when position changes
  useEffect(() => {
    if (!position) return;
    
    const fetchAddress = async () => {
      setLoadingAddress(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.lat}&lon=${position.lng}&zoom=18&addressdetails=1`
        );
        const data = await response.json();
        if (data.display_name) {
          setAddress(data.display_name);
        }
      } catch (error) {
        console.error('Geocoding error:', error);
      } finally {
        setLoadingAddress(false);
      }
    };
    
    fetchAddress();
  }, [position]);

  // Handle map click
  const handleMapClick = (e: any) => {
    const { lat, lng } = e.latlng;
    setPosition({ lat, lng });
  };

  // Get current location
  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolokasi tidak didukung browser ini');
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(newPos);
        if (mapRef.current) {
          mapRef.current.flyTo([newPos.lat, newPos.lng], 17);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Tidak bisa mendapatkan lokasi: ' + error.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Search for place
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setSearchResults([]);
      return;
    }
    
    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
      );
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => handleSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const handleResultClick = (result: any) => {
    const newPos = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
    setPosition(newPos);
    setAddress(result.display_name);
    setSearchResults([]);
    setSearchQuery('');
    if (mapRef.current) {
      mapRef.current.flyTo([newPos.lat, newPos.lng], 17);
    }
  };

  const handleConfirm = () => {
    if (position) {
      onSelect({ latitude: position.lat, longitude: position.lng });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-4xl h-[90vh] max-h-[90vh] flex flex-col overflow-hidden animate-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-secondary-200 dark:border-secondary-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Pilih Lokasi Kerusakan</h2>
              <p className="text-xs text-secondary-500">Klik peta atau cari alamat</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-secondary-200 dark:border-secondary-700">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400">
              <MapPin className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari alamat, nama tempat, atau landmark..."
              className="w-full pl-10 pr-4 py-2.5 border border-secondary-300 dark:border-secondary-600 rounded-lg bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
            {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>}
          </div>
          
          {searchResults.length > 0 && (
            <div className="mt-2 absolute z-10 w-full max-h-60 overflow-y-auto bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg shadow-lg">
              {searchResults.map((result: any) => (
                <button
                  key={result.place_id}
                  onClick={() => handleResultClick(result)}
                  className="w-full px-4 py-3 text-left hover:bg-secondary-100 dark:hover:bg-secondary-700 first:rounded-t-lg last:rounded-b-lg transition-colors"
                >
                  <div className="font-medium text-sm text-secondary-900 dark:text-white">{result.display_name.split(',')[0]}</div>
                  <div className="text-xs text-secondary-500 truncate">{result.display_name}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="flex-1 relative overflow-hidden">
          <MapContainer
            ref={mapRef}
            center={position ? [position.lat, position.lng] : DEFAULT_CENTER}
            zoom={zoom}
            zoomControl={false}
            scrollWheelZoom={true}
            className="w-full h-full"
          >
            <MapClickHandler onClick={handleMapClick} />
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            {position && (
              <Marker position={[position.lat, position.lng]}>
                <div className="relative">
                  <div className="w-8 h-8 bg-danger-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                    <div className="w-3 h-3 bg-white rounded-full" />
                  </div>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-secondary-900 text-white text-xs rounded whitespace-nowrap shadow">
                    Lokasi dipilih
                  </div>
                </div>
              </Marker>
            )}
          </MapContainer>
          
          {/* Map Controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-2">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleCurrentLocation}
              className="shadow-lg"
              aria-label="Lokasi saat ini"
            >
              <Crosshair className="w-4 h-4" />
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => mapRef.current?.flyTo(DEFAULT_CENTER, 10)}
              className="shadow-lg"
              aria-label="Reset ke Jakarta"
            >
              <Map className="w-4 h-4" />
            </Button>
          </div>

          {/* Zoom Controls */}
          <div className="absolute top-4 right-4 flex flex-col gap-1">
            <Button variant="secondary" size="sm" onClick={() => setZoom(z => Math.min(z + 1, 19))} aria-label="Zoom in">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m-6-6h12"/></svg>
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setZoom(z => Math.max(z - 1, 5))} aria-label="Zoom out">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h12"/></svg>
            </Button>
          </div>
        </div>

        {/* Selected Location Info */}
        {position && (
          <div className="p-4 border-t border-secondary-200 dark:border-secondary-700 bg-secondary-50 dark:bg-secondary-900/50">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 flex-shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm text-secondary-900 dark:text-white">Lokasi Terpilih</span>
                  <Badge variant="primary" className="text-xs">
                    {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
                  </Badge>
                </div>
                {loadingAddress ? (
                  <div className="flex items-center gap-2 text-sm text-secondary-500">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Mencari alamat...
                  </div>
                ) : (
                  <p className="text-sm text-secondary-600 dark:text-secondary-300 truncate">{address || 'Alamat tidak ditemukan'}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-secondary-200 dark:border-secondary-700">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!position}
            className="ml-auto"
          >
            <CheckCircle className="w-4 h-4" />
            {position ? 'Gunakan Lokasi Ini' : 'Pilih Lokasi'}
          </Button>
        </div>
      </Card>
    </div>
  );
}