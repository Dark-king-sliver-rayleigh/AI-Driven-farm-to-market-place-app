import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { useLogisticsTracking } from '../../context/LogisticsTrackingContext';

/**
 * LogisticsTrackingMap Component
 * 
 * PURPOSE:
 * Real-time delivery tracking visualization using MapLibre GL + Geoapify tiles.
 * Shows farmer location, consumer location, driver movement, and route polyline.
 * 
 * FEATURES:
 * - MapLibre GL map with Geoapify tiles/style
 * - Static farmer marker (green)
 * - Static consumer marker (blue)
 * - Dynamic driver marker with state-based color
 * - Animated driver movement along polyline
 * - Route polyline decoded from encoded string
 * - Distance and ETA display
 * - Locked interactions (zoom/pan only)
 * 
 * PROPS:
 * @param {string} orderId - Order ID to track
 * @param {string} geoapifyApiKey - Geoapify API key (from environment)
 * @param {function} onStateChange - Callback when logistics state changes
 * @param {function} onDelivered - Callback when delivery is complete
 * @param {string} className - Additional CSS classes
 * 
 * IMPORTANT:
 * All driver location updates come from the backend via polling.
 * No client-side location computation or faking is allowed.
 */

/**
 * Decode encoded polyline string to array of coordinates
 * @param {string} encoded - Encoded polyline string
 * @returns {Array<{lat: number, lng: number}>} Decoded coordinates
 */
function decodePolyline(encoded) {
  if (!encoded) return [];
  
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  
  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    
    shift = 0;
    result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    
    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5
    });
  }
  
  return points;
}

/**
 * Create custom marker DOM element
 * @param {string} color - Hex color code
 * @param {string} emoji - Emoji to display
 * @param {number} size - Element size in px
 * @returns {HTMLElement} Marker DOM element
 */
function createMarkerElement(color, emoji, size = 40) {
  const el = document.createElement('div');
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = '50%';
  el.style.backgroundColor = color;
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.border = '3px solid white';
  el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
  el.style.cursor = 'pointer';
  el.style.fontSize = `${size * 0.45}px`;
  el.textContent = emoji;
  return el;
}

// Marker colors for different entities
const MARKER_COLORS = {
  farmer: '#22C55E',    // Green
  consumer: '#3B82F6',  // Blue
  driver: '#10B981'     // Emerald (changes based on state)
};

export function LogisticsTrackingMap({
  orderId,
  geoapifyApiKey,
  onStateChange,
  onDelivered,
  className = ''
}) {
  // Map refs
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const farmerMarkerRef = useRef(null);
  const consumerMarkerRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const driverElRef = useRef(null);
  const previousStateRef = useRef(null);
  const animFrameRef = useRef(null);
  
  // Local state
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  
  // Get tracking context
  const {
    tracking,
    isLoading,
    error,
    isPolling,
    currentState,
    stateMessage,
    markerColor,
    driverLocation,
    farmerLocation,
    consumerLocation,
    routePolyline,
    distance,
    eta,
    driver,
    isDelivered,
    isActive,
    progressPercentage,
    etaCountdown,
    startTracking,
    stopTracking,
    formatEtaCountdown
  } = useLogisticsTracking();
  
  /**
   * Start tracking when component mounts
   */
  useEffect(() => {
    if (orderId) {
      startTracking(orderId);
    }
    
    return () => {
      stopTracking();
    };
  }, [orderId, startTracking, stopTracking]);
  
  /**
   * Notify on state changes
   */
  useEffect(() => {
    if (currentState && currentState !== previousStateRef.current) {
      if (previousStateRef.current !== null && onStateChange) {
        onStateChange(previousStateRef.current, currentState);
      }
      previousStateRef.current = currentState;
      
      if (currentState === 'DELIVERED' && onDelivered) {
        onDelivered();
      }
    }
  }, [currentState, onStateChange, onDelivered]);
  
  /**
   * Calculate map center between farmer and consumer
   */
  const mapCenter = useMemo(() => {
    if (!farmerLocation?.coordinates || !consumerLocation?.coordinates) {
      return null;
    }
    
    return {
      lat: (farmerLocation.coordinates.lat + consumerLocation.coordinates.lat) / 2,
      lng: (farmerLocation.coordinates.lng + consumerLocation.coordinates.lng) / 2
    };
  }, [farmerLocation, consumerLocation]);
  
  /**
   * Calculate appropriate zoom level based on distance
   */
  const calculateZoom = useCallback((farmer, consumer) => {
    if (!farmer || !consumer) return 12;
    
    const latDiff = Math.abs(farmer.lat - consumer.lat);
    const lngDiff = Math.abs(farmer.lng - consumer.lng);
    const maxDiff = Math.max(latDiff, lngDiff);
    
    if (maxDiff > 0.5) return 9;
    if (maxDiff > 0.2) return 10;
    if (maxDiff > 0.1) return 11;
    if (maxDiff > 0.05) return 12;
    if (maxDiff > 0.02) return 13;
    return 14;
  }, []);
  
  /**
   * Initialize MapLibre GL map when data is ready
   */
  useEffect(() => {
    if (!mapContainerRef.current || !mapCenter || mapRef.current) return;
    
    const apiKey = geoapifyApiKey;
    if (!apiKey) {
      setMapError('Geoapify API key is required');
      return;
    }
    
    const zoom = calculateZoom(
      farmerLocation?.coordinates,
      consumerLocation?.coordinates
    );
    
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: `https://maps.geoapify.com/v1/styles/osm-bright/style.json?apiKey=${apiKey}`,
      center: [mapCenter.lng, mapCenter.lat],
      zoom,
      dragRotate: false,
      touchPitch: false
    });
    
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    
    map.on('load', () => {
      setMapLoaded(true);
    });
    
    map.on('error', (e) => {
      console.error('MapLibre error:', e);
      setMapError('Failed to load map');
    });
    
    mapRef.current = map;
    
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      map.remove();
      mapRef.current = null;
      farmerMarkerRef.current = null;
      consumerMarkerRef.current = null;
      driverMarkerRef.current = null;
      driverElRef.current = null;
      setMapLoaded(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapCenter, geoapifyApiKey]);
  
  /**
   * Create/update farmer marker
   */
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !farmerLocation?.coordinates) return;
    
    if (farmerMarkerRef.current) {
      farmerMarkerRef.current.setLngLat([farmerLocation.coordinates.lng, farmerLocation.coordinates.lat]);
    } else {
      const el = createMarkerElement(MARKER_COLORS.farmer, '🌾', 44);
      farmerMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([farmerLocation.coordinates.lng, farmerLocation.coordinates.lat])
        .setPopup(new maplibregl.Popup({ offset: 25 }).setText(`Pickup: ${farmerLocation.address}`))
        .addTo(mapRef.current);
    }
  }, [mapLoaded, farmerLocation]);
  
  /**
   * Create/update consumer marker
   */
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !consumerLocation?.coordinates) return;
    
    if (consumerMarkerRef.current) {
      consumerMarkerRef.current.setLngLat([consumerLocation.coordinates.lng, consumerLocation.coordinates.lat]);
    } else {
      const el = createMarkerElement(MARKER_COLORS.consumer, '🏠', 44);
      consumerMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([consumerLocation.coordinates.lng, consumerLocation.coordinates.lat])
        .setPopup(new maplibregl.Popup({ offset: 25 }).setText(`Delivery: ${consumerLocation.address}`))
        .addTo(mapRef.current);
    }
  }, [mapLoaded, consumerLocation]);
  
  /**
   * Create/update driver marker with animation
   */
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !driverLocation) return;
    
    const driverColor = markerColor || MARKER_COLORS.driver;
    
    if (driverMarkerRef.current) {
      // Animate to new position
      const currentLngLat = driverMarkerRef.current.getLngLat();
      animateDriverTo(currentLngLat, { lng: driverLocation.lng, lat: driverLocation.lat });
      
      // Update colour
      if (driverElRef.current) {
        driverElRef.current.style.backgroundColor = driverColor;
      }
    } else {
      const el = createMarkerElement(driverColor, '🚚', 40);
      driverElRef.current = el;
      driverMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([driverLocation.lng, driverLocation.lat])
        .addTo(mapRef.current);
    }
  }, [mapLoaded, driverLocation, markerColor]);
  
  /**
   * Animate driver marker movement smoothly
   */
  const animateDriverTo = useCallback((from, to) => {
    if (!driverMarkerRef.current) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    
    const duration = 500;
    const startTime = performance.now();
    
    const step = (now) => {
      const t = Math.min((now - startTime) / duration, 1);
      const lng = from.lng + (to.lng - from.lng) * t;
      const lat = from.lat + (to.lat - from.lat) * t;
      driverMarkerRef.current.setLngLat([lng, lat]);
      
      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      }
    };
    
    animFrameRef.current = requestAnimationFrame(step);
  }, []);
  
  /**
   * Draw route polyline via GeoJSON source + layer
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    
    // Determine coordinates
    let coords = [];
    if (routePolyline) {
      const pts = decodePolyline(routePolyline);
      coords = pts.map(p => [p.lng, p.lat]);
    } else if (farmerLocation?.coordinates && consumerLocation?.coordinates) {
      coords = [
        [farmerLocation.coordinates.lng, farmerLocation.coordinates.lat],
        [consumerLocation.coordinates.lng, consumerLocation.coordinates.lat]
      ];
    }
    
    const geojson = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coords
      }
    };
    
    if (map.getSource('route')) {
      map.getSource('route').setData(geojson);
    } else {
      map.addSource('route', { type: 'geojson', data: geojson });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#10B981',
          'line-width': 4,
          'line-opacity': 0.8
        }
      });
    }
  }, [mapLoaded, routePolyline, farmerLocation, consumerLocation]);
  
  // Loading state
  if (!mapLoaded && !mapError) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`} style={{ minHeight: '400px' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (mapError || error) {
    return (
      <div className={`flex items-center justify-center bg-red-50 rounded-lg ${className}`} style={{ minHeight: '400px' }}>
        <div className="text-center p-6">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <p className="text-red-600 font-medium">{mapError || error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  // No tracking data yet
  if (!tracking && !isLoading) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 rounded-lg ${className}`} style={{ minHeight: '400px' }}>
        <div className="text-center p-6">
          <div className="text-gray-400 text-4xl mb-4">📍</div>
          <p className="text-gray-600">Tracking not yet available for this order</p>
          <p className="text-sm text-gray-400 mt-2">Tracking will start once a driver is assigned</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`relative ${className}`}>
      {/* Map Container */}
      <div
        ref={mapContainerRef}
        className="w-full rounded-lg overflow-hidden"
        style={{ height: '400px' }}
      />
      
      {/* Status Overlay */}
      <div className="absolute top-4 left-4 right-4 z-10">
        <div className="bg-white rounded-lg shadow-lg p-4">
          {/* Status Badge */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span
                className="w-3 h-3 rounded-full animate-pulse"
                style={{ backgroundColor: markerColor }}
              />
              <span className="font-semibold text-gray-800">{stateMessage}</span>
            </div>
            {isPolling && (
              <span className="text-xs text-gray-400 flex items-center">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse" />
                Live
              </span>
            )}
          </div>
          
          {/* Distance and ETA */}
          {isActive && !isDelivered && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4">
                {distance?.remaining && (
                  <span className="text-gray-600">
                    📏 {distance.remaining}
                  </span>
                )}
                {etaCountdown !== null && (
                  <span className="text-gray-600">
                    ⏱️ {formatEtaCountdown(etaCountdown)}
                  </span>
                )}
              </div>
              
              {/* Progress bar */}
              <div className="w-24 bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPercentage}%`,
                    backgroundColor: markerColor
                  }}
                />
              </div>
            </div>
          )}
          
          {/* Delivered badge */}
          {isDelivered && (
            <div className="flex items-center text-green-600 text-sm font-medium">
              <span className="mr-2">✅</span>
              Delivered successfully
            </div>
          )}
        </div>
      </div>
      
      {/* Driver Info Card */}
      {driver && isActive && (
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <div className="bg-white rounded-lg shadow-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl"
                  style={{ backgroundColor: markerColor }}
                >
                  🚚
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{driver.name}</p>
                  <p className="text-sm text-gray-500">{driver.vehicleNumber}</p>
                </div>
              </div>
              <a
                href={`tel:${driver.phone}`}
                className="p-3 bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition-colors"
              >
                📞
              </a>
            </div>
          </div>
        </div>
      )}
      
      {/* Loading overlay */}
      {isLoading && !tracking && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500"></div>
        </div>
      )}
    </div>
  );
}

export default LogisticsTrackingMap;
