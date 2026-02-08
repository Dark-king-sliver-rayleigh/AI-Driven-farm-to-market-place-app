# Logistics Tracking API Reference

## Overview

The Logistics Tracking API provides real-time delivery tracking functionality for the AgroDirect Farm-to-Consumer Marketplace. It enables visualization of driver movement on MapLibre GL (web) / MapLibre Native (mobile) maps with Geoapify tiles, along with state-based lifecycle management.

## Base URL

```
http://localhost:5000/api/logistics/tracking
```

## Authentication

All endpoints (except `/states`) require Bearer token authentication:

```
Authorization: Bearer <token>
```

---

## Logistics State Machine (FSM)

The delivery lifecycle follows a strict finite state machine:

```
ORDER_CONFIRMED → DRIVER_ASSIGNED → PICKUP_STARTED → PICKUP_COMPLETED 
                → IN_TRANSIT → NEAR_DESTINATION → DELIVERED
```

### State Definitions

| State | Description | Marker Color |
|-------|-------------|--------------|
| `ORDER_CONFIRMED` | Order placed, awaiting driver assignment | Gray (#9CA3AF) |
| `DRIVER_ASSIGNED` | Driver assigned to the order | Blue (#3B82F6) |
| `PICKUP_STARTED` | Driver en route to farmer/pickup location | Amber (#F59E0B) |
| `PICKUP_COMPLETED` | Driver has collected the goods | Green (#10B981) |
| `IN_TRANSIT` | Driver traveling from farmer to consumer | Green (#10B981) |
| `NEAR_DESTINATION` | Driver within 500m of destination | Purple (#8B5CF6) |
| `DELIVERED` | Order successfully delivered (terminal) | Dark Green (#059669) |

### Valid State Transitions

| Current State | Allowed Next States |
|---------------|---------------------|
| `ORDER_CONFIRMED` | `DRIVER_ASSIGNED` |
| `DRIVER_ASSIGNED` | `PICKUP_STARTED` |
| `PICKUP_STARTED` | `PICKUP_COMPLETED` |
| `PICKUP_COMPLETED` | `IN_TRANSIT` |
| `IN_TRANSIT` | `NEAR_DESTINATION`, `DELIVERED` |
| `NEAR_DESTINATION` | `DELIVERED` |
| `DELIVERED` | *(terminal state)* |

---

## Endpoints

### GET /states

Get logistics states information (public endpoint).

**Response:**
```json
{
  "success": true,
  "states": [
    {
      "state": "ORDER_CONFIRMED",
      "message": "Order confirmed, waiting for driver",
      "markerColor": "#9CA3AF",
      "allowedTransitions": ["DRIVER_ASSIGNED"]
    }
  ],
  "nearDestinationThreshold": 500
}
```

---

### GET /:orderId

Get tracking data for an order. **This is the primary polling endpoint.**

**Authorization:** Consumer, Farmer, or Logistics (order participants only)

**Polling:** Call every 5-10 seconds for real-time updates.

**Response:**
```json
{
  "success": true,
  "tracking": {
    "orderId": "65a1b2c3d4e5f6g7h8i9j0k1",
    "deliveryId": "65a1b2c3d4e5f6g7h8i9j0k2",
    "currentState": "IN_TRANSIT",
    "stateMessage": "Your order is on the way",
    "markerColor": "#10B981",
    "driverLocation": {
      "lat": 19.0760,
      "lng": 72.8777
    },
    "farmerLocation": {
      "address": "Farm Road, Village XYZ",
      "coordinates": {
        "lat": 19.0850,
        "lng": 72.8900
      }
    },
    "consumerLocation": {
      "address": "123 Main Street, City ABC",
      "coordinates": {
        "lat": 19.0650,
        "lng": 72.8650
      }
    },
    "routePolyline": "encoded_polyline_string",
    "routeProgress": {
      "currentIndex": 12,
      "totalPoints": 25,
      "percentComplete": 48
    },
    "distance": {
      "total": "5.2 km",
      "remaining": "2.7 km",
      "remainingMeters": 2700
    },
    "eta": {
      "arrival": "2026-02-04T15:30:00.000Z",
      "seconds": 540,
      "text": "9 mins"
    },
    "driver": {
      "name": "Rajesh Kumar",
      "phone": "+91 9876543210",
      "vehicleNumber": "MH 12 AB 1234"
    },
    "lastUpdate": "2026-02-04T15:21:00.000Z",
    "isActive": true,
    "deliveredAt": null,
    "stateHistory": [
      {
        "from": null,
        "to": "ORDER_CONFIRMED",
        "timestamp": "2026-02-04T15:00:00.000Z",
        "remarks": "Tracking initialized"
      },
      {
        "from": "ORDER_CONFIRMED",
        "to": "DRIVER_ASSIGNED",
        "timestamp": "2026-02-04T15:02:00.000Z",
        "remarks": "Driver Rajesh Kumar assigned"
      }
    ]
  }
}
```

---

### GET /active

Get driver's active tracking records.

**Authorization:** Logistics only

**Response:**
```json
{
  "success": true,
  "count": 2,
  "trackings": [
    { /* TrackingData object */ },
    { /* TrackingData object */ }
  ]
}
```

---

### POST /:orderId/initialize

Initialize tracking for an order. Called when driver accepts an order.

**Authorization:** Logistics only (assigned driver)

**Response:**
```json
{
  "success": true,
  "tracking": { /* TrackingData object */ },
  "message": "Tracking initialized successfully"
}
```

---

### POST /:orderId/location

Update driver location. **Called by driver's device every 5-10 seconds.**

**Authorization:** Logistics only (assigned driver)

**CRITICAL:** All driver location updates must come through this endpoint. Frontend must NEVER compute fake locations.

**Request Body:**
```json
{
  "lat": 19.0760,
  "lng": 72.8777,
  "routeIndex": 12
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `lat` | number | Yes | Latitude (-90 to 90) |
| `lng` | number | Yes | Longitude (-180 to 180) |
| `routeIndex` | number | No | Current index in route points |

**Response:**
```json
{
  "success": true,
  "tracking": { /* Updated TrackingData object */ }
}
```

---

### POST /:orderId/state

Update logistics state. Validates transition before applying.

**Authorization:** Logistics only (assigned driver)

**Request Body:**
```json
{
  "state": "PICKUP_COMPLETED",
  "remarks": "Goods collected from farmer"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `state` | string | Yes | New logistics state (from FSM) |
| `remarks` | string | No | Optional remarks for audit trail |

**Response:**
```json
{
  "success": true,
  "tracking": { /* Updated TrackingData object */ },
  "message": "State updated to PICKUP_COMPLETED"
}
```

**Error (Invalid Transition):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TRANSITION",
    "message": "Invalid status transition from DRIVER_ASSIGNED to IN_TRANSIT",
    "details": {
      "currentStatus": "DRIVER_ASSIGNED",
      "requestedStatus": "IN_TRANSIT",
      "allowedTransitions": ["PICKUP_STARTED"]
    }
  }
}
```

---

### POST /:orderId/simulate

Simulate driver movement along the route. **FOR DEVELOPMENT/TESTING ONLY.**

**Authorization:** Logistics only

**Not available in production environment.**

**Request Body:**
```json
{
  "steps": 2
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `steps` | number | No | Number of route points to advance (default: 1) |

**Response:**
```json
{
  "success": true,
  "tracking": { /* Updated TrackingData object */ },
  "message": "Driver moved 2 step(s) along route"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { /* Additional context */ }
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication token |
| `FORBIDDEN` | 403 | User not authorized for this resource |
| `NOT_FOUND` | 404 | Order/tracking not found |
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `INVALID_TRANSITION` | 400 | Invalid state transition attempted |
| `SERVER_ERROR` | 500 | Internal server error |

---

## Integration Guide

### Frontend Polling Strategy

```javascript
const POLLING_INTERVAL = 5000; // 5 seconds
let pollingTimer = null;

function startPolling(orderId) {
  const poll = async () => {
    try {
      const response = await fetch(`/api/logistics/tracking/${orderId}`);
      const data = await response.json();
      
      if (data.success && data.tracking) {
        updateUI(data.tracking);
        
        // Stop polling when delivery complete
        if (!data.tracking.isActive) {
          stopPolling();
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
      // Implement exponential backoff
    }
  };
  
  poll(); // Initial fetch
  pollingTimer = setInterval(poll, POLLING_INTERVAL);
}

function stopPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}
```

### MapLibre GL + Geoapify Integration

```javascript
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;

// Initialize MapLibre map with Geoapify tiles
const map = new maplibregl.Map({
  container: 'map',
  style: `https://maps.geoapify.com/v1/styles/osm-bright/style.json?apiKey=${GEOAPIFY_API_KEY}`,
  center: [lng, lat],
  zoom: 12
});

// Decode polyline for route visualization
function decodePolyline(encoded) {
  const points = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

// Add route as GeoJSON LineString
map.on('load', () => {
  const coords = decodePolyline(tracking.routePolyline).map(p => [p.lng, p.lat]);
  map.addSource('route', {
    type: 'geojson',
    data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }
  });
  map.addLayer({
    id: 'route-line', type: 'line', source: 'route',
    paint: { 'line-color': '#10B981', 'line-width': 4 }
  });
});

// Create driver marker using DOM element
const el = document.createElement('div');
el.style.cssText = 'width:40px;height:40px;border-radius:50%;background:#10B981;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;';
el.textContent = '🚚';
const driverMarker = new maplibregl.Marker({ element: el })
  .setLngLat([driverLocation.lng, driverLocation.lat])
  .addTo(map);

// Animate marker movement
function animateMarkerTo(marker, to, duration = 500) {
  const from = marker.getLngLat();
  const start = performance.now();
  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    marker.setLngLat([
      from.lng + (to.lng - from.lng) * t,
      from.lat + (to.lat - from.lat) * t
    ]);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
```

---

## Environment Variables

```env
# Geoapify API Key (required for route computation on the server)
GEOAPIFY_API_KEY=your_api_key_here

# Geoapify API Key for frontend (required for map tiles & style)
VITE_GEOAPIFY_API_KEY=your_api_key_here

# If not set, mock routes will be generated for development
```

---

## Notes

1. **All location updates come from backend** - Frontend must never compute or fake driver locations.

2. **State transitions are validated** - Only valid FSM transitions are allowed.

3. **Polling is required** - No WebSocket support initially; use polling every 5-10 seconds.

4. **Route polyline is cached** - Computed once when tracking is initialized.

5. **NEAR_DESTINATION auto-transitions** - When driver is within 500m during IN_TRANSIT.
