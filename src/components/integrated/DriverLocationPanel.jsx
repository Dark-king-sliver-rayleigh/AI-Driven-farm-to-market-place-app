import React, { useState, useEffect, useCallback, useRef } from 'react';
import { locationAPI } from '../../services/api';

/**
 * DriverLocationPanel Component
 * 
 * Driver-side panel for:
 * - Availability toggle (Active / Inactive)
 * - Real-time GPS location sharing (every 30s when active)
 * - Current location display on Geoapify map
 * - Location status indicator
 */
export function DriverLocationPanel() {
  const [isAvailable, setIsAvailable] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [gpsActive, setGpsActive] = useState(false);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);

  const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY || '';

  // Fetch initial status
  useEffect(() => {
    async function fetchStatus() {
      try {
        setLoading(true);
        const response = await locationAPI.getDriverStatus();
        const status = response.status;
        setIsAvailable(status.isAvailable);
        if (status.currentLocation?.coordinates?.lat) {
          setCurrentLocation({
            lat: status.currentLocation.coordinates.lat,
            lng: status.currentLocation.coordinates.lng
          });
          setLastUpdate(status.currentLocation.updatedAt);
        }
      } catch (err) {
        console.error('Fetch status error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let cancelled = false;

    async function initMap() {
      try {
        const maplibregl = (await import('maplibre-gl')).default;
        await import('maplibre-gl/dist/maplibre-gl.css');

        if (cancelled) return;

        const center = currentLocation
          ? [currentLocation.lng, currentLocation.lat]
          : [78.9629, 20.5937]; // India center

        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: apiKey
            ? `https://maps.geoapify.com/v1/styles/osm-bright/style.json?apiKey=${apiKey}`
            : 'https://demotiles.maplibre.org/style.json',
          center,
          zoom: currentLocation ? 14 : 5
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        map.on('load', () => {
          if (currentLocation) {
            addDriverMarker(map, maplibregl, currentLocation);
          }
        });

        mapRef.current = map;
      } catch (err) {
        console.error('Map init error:', err);
      }
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [apiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const addDriverMarker = useCallback(async (map, maplibregl, loc) => {
    if (markerRef.current) {
      markerRef.current.setLngLat([loc.lng, loc.lat]);
    } else {
      // Create driver marker
      const el = document.createElement('div');
      el.style.width = '40px';
      el.style.height = '40px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = isAvailable ? '#10B981' : '#9CA3AF';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
      el.style.fontSize = '18px';
      el.textContent = '🚗';

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([loc.lng, loc.lat])
        .addTo(map);
      
      markerRef.current = marker;
    }

    map.flyTo({ center: [loc.lng, loc.lat], zoom: 15 });
  }, [isAvailable]);

  /**
   * Send location to server
   */
  const sendLocationToServer = useCallback(async (lat, lng, heading) => {
    try {
      await locationAPI.updateDriverLocation({ lat, lng, heading });
      setCurrentLocation({ lat, lng });
      setLastUpdate(new Date().toISOString());
      setError(null);

      // Update marker on map
      if (mapRef.current && markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
        mapRef.current.flyTo({ center: [lng, lat], zoom: 15 });
      } else if (mapRef.current) {
        const maplibregl = (await import('maplibre-gl')).default;
        addDriverMarker(mapRef.current, maplibregl, { lat, lng });
      }
    } catch (err) {
      console.error('Send location error:', err);
      setError('Failed to update location');
    }
  }, [addDriverMarker]);

  /**
   * Start GPS tracking
   */
  const startGPSTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    setGpsActive(true);

    // Get immediate position
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        sendLocationToServer(pos.coords.latitude, pos.coords.longitude, pos.coords.heading);
      },
      (err) => setError('GPS error: ' + err.message),
      { enableHighAccuracy: true }
    );

    // Watch position continuously
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => console.error('Watch error:', err),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    // Send to server every 30 seconds
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          sendLocationToServer(pos.coords.latitude, pos.coords.longitude, pos.coords.heading);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }, 30000);
  }, [sendLocationToServer]);

  /**
   * Stop GPS tracking
   */
  const stopGPSTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setGpsActive(false);
  }, []);

  // Start/stop GPS based on availability
  useEffect(() => {
    if (isAvailable && !loading) {
      startGPSTracking();
    } else {
      stopGPSTracking();
    }

    return () => stopGPSTracking();
  }, [isAvailable, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Toggle availability
   */
  const handleToggleAvailability = async () => {
    try {
      setToggling(true);
      const newValue = !isAvailable;
      await locationAPI.toggleDriverAvailability(newValue);
      setIsAvailable(newValue);
    } catch (err) {
      setError(err.message);
    } finally {
      setToggling(false);
    }
  };

  const formatTime = (isoStr) => {
    if (!isoStr) return 'Never';
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-500">Loading status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Availability Toggle Card */}
      <div className={`rounded-xl shadow-sm p-5 transition-colors ${
        isAvailable ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200' 
                    : 'bg-gray-50 border-2 border-gray-200'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              {isAvailable ? '🟢' : '🔴'} 
              {isAvailable ? 'You are Active' : 'You are Offline'}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {isAvailable 
                ? 'You are visible and can receive delivery orders' 
                : 'You will not receive new orders'}
            </p>
          </div>

          {/* Toggle Switch */}
          <button
            onClick={handleToggleAvailability}
            disabled={toggling}
            className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isAvailable 
                ? 'bg-green-500 focus:ring-green-500' 
                : 'bg-gray-300 focus:ring-gray-400'
            } ${toggling ? 'opacity-50' : ''}`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ${
                isAvailable ? 'translate-x-9' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* GPS Status */}
        {isAvailable && (
          <div className="mt-3 pt-3 border-t border-green-200">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${gpsActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                <span className="text-gray-600">
                  GPS: {gpsActive ? 'Tracking' : 'Inactive'}
                </span>
              </div>
              {lastUpdate && (
                <div className="text-gray-400">
                  Last update: {formatTime(lastUpdate)}
                </div>
              )}
              {currentLocation && (
                <div className="text-gray-400">
                  {currentLocation.lat?.toFixed(4)}, {currentLocation.lng?.toFixed(4)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-bold">×</button>
        </div>
      )}

      {/* Map */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h4 className="font-semibold text-gray-800 flex items-center gap-2">
            <span>🗺️</span> Your Location
          </h4>
        </div>
        <div
          ref={mapContainerRef}
          className="w-full h-64"
        />
        {!currentLocation && (
          <div className="p-4 text-center text-sm text-gray-400">
            Enable GPS tracking to see your location on the map
          </div>
        )}
      </div>
    </div>
  );
}

export default DriverLocationPanel;
