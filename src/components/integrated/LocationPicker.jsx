import React, { useEffect, useRef, useState, useCallback } from 'react';

/**
 * LocationPicker Component
 * 
 * Reusable map-based location picker using Geoapify tiles + MapLibre GL.
 * Supports:
 * - Click-to-select on map
 * - GPS geolocation (browser)
 * - Manual lat/lng entry
 * - Address text input
 * - Reverse geocoding via Geoapify
 * 
 * @param {Object} props
 * @param {Object} props.value - Current value: { address, lat, lng }
 * @param {function} props.onChange - Callback with { address, lat, lng }
 * @param {string} props.label - Optional label text
 * @param {string} props.placeholder - Address placeholder
 * @param {boolean} props.showMap - Whether to show the map (default true)
 * @param {string} props.className - Additional CSS classes
 */
export function LocationPicker({
  value = {},
  onChange,
  label = 'Location',
  placeholder = 'Enter address...',
  showMap = true,
  className = ''
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [address, setAddress] = useState(value?.address || '');
  const [lat, setLat] = useState(value?.lat || '');
  const [lng, setLng] = useState(value?.lng || '');

  const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY || '';

  // Sync external value changes
  useEffect(() => {
    if (value?.address !== undefined) setAddress(value.address);
    if (value?.lat !== undefined) setLat(value.lat);
    if (value?.lng !== undefined) setLng(value.lng);
  }, [value?.address, value?.lat, value?.lng]);

  const emitChange = useCallback((data) => {
    onChange?.({
      address: data.address ?? address,
      lat: Number(data.lat ?? lat) || 0,
      lng: Number(data.lng ?? lng) || 0
    });
  }, [onChange, address, lat, lng]);

  // Initialize map
  useEffect(() => {
    if (!showMap || !mapContainerRef.current || mapRef.current) return;

    let cancelled = false;

    async function initMap() {
      try {
        const maplibregl = (await import('maplibre-gl')).default;
        await import('maplibre-gl/dist/maplibre-gl.css');

        if (cancelled) return;

        const centerLat = Number(lat) || 20.5937;
        const centerLng = Number(lng) || 78.9629;

        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: apiKey
            ? `https://maps.geoapify.com/v1/styles/osm-bright/style.json?apiKey=${apiKey}`
            : 'https://demotiles.maplibre.org/style.json',
          center: [centerLng, centerLat],
          zoom: Number(lat) ? 14 : 5
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        map.on('load', () => {
          setMapLoaded(true);

          // Add initial marker if coords exist
          if (Number(lat) && Number(lng)) {
            const marker = new maplibregl.Marker({ color: '#22C55E', draggable: true })
              .setLngLat([Number(lng), Number(lat)])
              .addTo(map);
            
            marker.on('dragend', () => {
              const pos = marker.getLngLat();
              setLat(pos.lat.toFixed(6));
              setLng(pos.lng.toFixed(6));
              emitChange({ lat: pos.lat, lng: pos.lng });
              reverseGeocode(pos.lat, pos.lng);
            });

            markerRef.current = marker;
          }
        });

        // Click to place marker
        map.on('click', (e) => {
          const { lng: clickLng, lat: clickLat } = e.lngLat;

          if (markerRef.current) {
            markerRef.current.setLngLat([clickLng, clickLat]);
          } else {
            const marker = new maplibregl.Marker({ color: '#22C55E', draggable: true })
              .setLngLat([clickLng, clickLat])
              .addTo(map);
            
            marker.on('dragend', () => {
              const pos = marker.getLngLat();
              setLat(pos.lat.toFixed(6));
              setLng(pos.lng.toFixed(6));
              emitChange({ lat: pos.lat, lng: pos.lng });
              reverseGeocode(pos.lat, pos.lng);
            });

            markerRef.current = marker;
          }

          setLat(clickLat.toFixed(6));
          setLng(clickLng.toFixed(6));
          emitChange({ lat: clickLat, lng: clickLng });
          reverseGeocode(clickLat, clickLng);
        });

        mapRef.current = map;
      } catch (err) {
        console.error('Map init failed:', err);
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
  }, [showMap, apiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update marker when coordinates change externally
  useEffect(() => {
    if (!mapRef.current || !Number(lat) || !Number(lng)) return;
    
    const map = mapRef.current;
    if (markerRef.current) {
      markerRef.current.setLngLat([Number(lng), Number(lat)]);
    }
    map.flyTo({ center: [Number(lng), Number(lat)], zoom: 14 });
  }, [lat, lng]);

  /**
   * Reverse geocode coordinates to address
   */
  const reverseGeocode = async (latitude, longitude) => {
    if (!apiKey) return;
    try {
      const resp = await fetch(
        `https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&apiKey=${apiKey}`
      );
      const data = await resp.json();
      if (data.features && data.features.length > 0) {
        const props = data.features[0].properties;
        const addr = props.formatted || `${props.city || ''}, ${props.country || ''}`;
        setAddress(addr);
        emitChange({ address: addr, lat: latitude, lng: longitude });
      }
    } catch (err) {
      console.error('Reverse geocode error:', err);
    }
  };

  /**
   * Use browser geolocation
   */
  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported by your browser');
      return;
    }

    setGeoLoading(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude.toFixed(6));
        setLng(longitude.toFixed(6));
        emitChange({ lat: latitude, lng: longitude });
        reverseGeocode(latitude, longitude);
        setGeoLoading(false);

        // Move map to location
        if (mapRef.current) {
          mapRef.current.flyTo({ center: [longitude, latitude], zoom: 15 });
        }
      },
      (err) => {
        setGeoError('Unable to get location: ' + err.message);
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {label && (
        <label className="block text-sm font-semibold text-gray-700">{label}</label>
      )}

      {/* Address Input */}
      <div>
        <textarea
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            emitChange({ address: e.target.value });
          }}
          placeholder={placeholder}
        />
      </div>

      {/* Coordinate Inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Latitude</label>
          <input
            type="number"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={lat}
            onChange={(e) => {
              setLat(e.target.value);
              emitChange({ lat: e.target.value });
            }}
            step="0.000001"
            min="-90"
            max="90"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Longitude</label>
          <input
            type="number"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={lng}
            onChange={(e) => {
              setLng(e.target.value);
              emitChange({ lng: e.target.value });
            }}
            step="0.000001"
            min="-180"
            max="180"
          />
        </div>
      </div>

      {/* GPS Button */}
      <button
        type="button"
        onClick={handleUseGPS}
        disabled={geoLoading}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
      >
        {geoLoading ? (
          <>
            <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Getting location...
          </>
        ) : (
          <>
            <span>📍</span>
            Use Current GPS Location
          </>
        )}
      </button>

      {geoError && (
        <p className="text-xs text-red-500">{geoError}</p>
      )}

      {/* Map */}
      {showMap && (
        <div className="relative">
          <div
            ref={mapContainerRef}
            className="w-full h-64 rounded-lg border border-gray-200 overflow-hidden"
          />
          {!mapLoaded && (
            <div className="absolute inset-0 bg-gray-100 flex items-center justify-center rounded-lg">
              <div className="text-center">
                <div className="w-8 h-8 border-3 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-500">Loading map...</p>
              </div>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-1">Click on the map to set location, or drag the marker</p>
        </div>
      )}
    </div>
  );
}

export default LocationPicker;
