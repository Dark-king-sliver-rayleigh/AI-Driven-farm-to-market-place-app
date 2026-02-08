/**
 * LogisticsTrackingCore - Shared Business Logic Layer
 * 
 * PURPOSE:
 * Platform-agnostic business logic for real-time logistics tracking.
 * Shared between Web (React), Android (Kotlin), and iOS (Swift).
 * 
 * This module contains:
 * - API client for tracking endpoints
 * - State machine definitions
 * - Polling logic
 * - Data transformations
 * 
 * USAGE:
 * - Web: Import directly in React components
 * - Android: Transpile to Kotlin or use via JS bridge
 * - iOS: Transpile to Swift or use via JS bridge
 * 
 * CRITICAL RULE:
 * All driver location updates MUST come from the backend.
 * NO client-side location computation or faking is allowed.
 */

// ============================================
// CONFIGURATION
// ============================================

export const CONFIG = {
  // Polling interval in milliseconds
  POLLING_INTERVAL_MS: 5000,
  
  // Maximum retry interval for exponential backoff
  MAX_RETRY_INTERVAL_MS: 30000,
  
  // Initial retry delay
  INITIAL_RETRY_DELAY_MS: 1000,
  
  // Near destination threshold in meters
  NEAR_DESTINATION_THRESHOLD_METERS: 500,
  
  // Driver marker animation duration
  MARKER_ANIMATION_DURATION_MS: 500
};

// ============================================
// LOGISTICS STATE MACHINE
// ============================================

/**
 * Logistics states enum
 */
export const LogisticsState = {
  ORDER_CONFIRMED: 'ORDER_CONFIRMED',
  DRIVER_ASSIGNED: 'DRIVER_ASSIGNED',
  PICKUP_STARTED: 'PICKUP_STARTED',
  PICKUP_COMPLETED: 'PICKUP_COMPLETED',
  IN_TRANSIT: 'IN_TRANSIT',
  NEAR_DESTINATION: 'NEAR_DESTINATION',
  DELIVERED: 'DELIVERED'
};

/**
 * State transition rules
 */
export const StateTransitions = {
  [LogisticsState.ORDER_CONFIRMED]: [LogisticsState.DRIVER_ASSIGNED],
  [LogisticsState.DRIVER_ASSIGNED]: [LogisticsState.PICKUP_STARTED],
  [LogisticsState.PICKUP_STARTED]: [LogisticsState.PICKUP_COMPLETED],
  [LogisticsState.PICKUP_COMPLETED]: [LogisticsState.IN_TRANSIT],
  [LogisticsState.IN_TRANSIT]: [LogisticsState.NEAR_DESTINATION, LogisticsState.DELIVERED],
  [LogisticsState.NEAR_DESTINATION]: [LogisticsState.DELIVERED],
  [LogisticsState.DELIVERED]: []
};

/**
 * State display messages
 */
export const StateMessages = {
  [LogisticsState.ORDER_CONFIRMED]: 'Order confirmed, waiting for driver',
  [LogisticsState.DRIVER_ASSIGNED]: 'Driver assigned to your order',
  [LogisticsState.PICKUP_STARTED]: 'Driver heading to pickup location',
  [LogisticsState.PICKUP_COMPLETED]: 'Package collected, delivery starting',
  [LogisticsState.IN_TRANSIT]: 'Your order is on the way',
  [LogisticsState.NEAR_DESTINATION]: 'Driver is nearby',
  [LogisticsState.DELIVERED]: 'Order delivered successfully'
};

/**
 * State marker colors (hex)
 */
export const StateMarkerColors = {
  [LogisticsState.ORDER_CONFIRMED]: '#9CA3AF',
  [LogisticsState.DRIVER_ASSIGNED]: '#3B82F6',
  [LogisticsState.PICKUP_STARTED]: '#F59E0B',
  [LogisticsState.PICKUP_COMPLETED]: '#10B981',
  [LogisticsState.IN_TRANSIT]: '#10B981',
  [LogisticsState.NEAR_DESTINATION]: '#8B5CF6',
  [LogisticsState.DELIVERED]: '#059669'
};

/**
 * Driver action configurations
 */
export const DriverActions = {
  [LogisticsState.DRIVER_ASSIGNED]: {
    nextState: LogisticsState.PICKUP_STARTED,
    buttonText: 'Start Pickup',
    buttonColor: '#F59E0B'
  },
  [LogisticsState.PICKUP_STARTED]: {
    nextState: LogisticsState.PICKUP_COMPLETED,
    buttonText: 'Confirm Pickup',
    buttonColor: '#10B981'
  },
  [LogisticsState.PICKUP_COMPLETED]: {
    nextState: LogisticsState.IN_TRANSIT,
    buttonText: 'Start Delivery',
    buttonColor: '#10B981'
  },
  [LogisticsState.IN_TRANSIT]: {
    nextState: LogisticsState.DELIVERED,
    buttonText: 'Mark Delivered',
    buttonColor: '#059669'
  },
  [LogisticsState.NEAR_DESTINATION]: {
    nextState: LogisticsState.DELIVERED,
    buttonText: 'Mark Delivered',
    buttonColor: '#059669'
  }
};

// ============================================
// STATE VALIDATION
// ============================================

/**
 * Check if a state transition is valid
 * @param {string} currentState - Current logistics state
 * @param {string} newState - Desired new state
 * @returns {boolean} Whether the transition is allowed
 */
export function isValidTransition(currentState, newState) {
  if (currentState === newState) return true;
  const allowed = StateTransitions[currentState] || [];
  return allowed.includes(newState);
}

/**
 * Get allowed next states
 * @param {string} state - Current state
 * @returns {string[]} Array of allowed next states
 */
export function getAllowedTransitions(state) {
  return StateTransitions[state] || [];
}

/**
 * Check if state is terminal
 * @param {string} state - State to check
 * @returns {boolean} Whether state is terminal
 */
export function isTerminalState(state) {
  return state === LogisticsState.DELIVERED;
}

// ============================================
// API CLIENT
// ============================================

/**
 * LogisticsTrackingAPI - Platform-agnostic API client
 */
export class LogisticsTrackingAPI {
  constructor(baseUrl, getAuthToken) {
    this.baseUrl = baseUrl;
    this.getAuthToken = getAuthToken;
  }
  
  /**
   * Make authenticated API request
   */
  async request(endpoint, options = {}) {
    const token = await this.getAuthToken();
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || data.message || 'API request failed');
    }
    
    return data;
  }
  
  /**
   * Get tracking data for an order
   * POLLING ENDPOINT - call every 5-10 seconds
   */
  async getTracking(orderId) {
    return this.request(`/logistics/tracking/${orderId}`);
  }
  
  /**
   * Initialize tracking for an order
   */
  async initializeTracking(orderId) {
    return this.request(`/logistics/tracking/${orderId}/initialize`, {
      method: 'POST'
    });
  }
  
  /**
   * Update driver location
   * @param {string} orderId - Order ID
   * @param {Object} location - { lat: number, lng: number }
   * @param {number} routeIndex - Current route index (optional)
   */
  async updateDriverLocation(orderId, location, routeIndex = null) {
    return this.request(`/logistics/tracking/${orderId}/location`, {
      method: 'POST',
      body: JSON.stringify({
        lat: location.lat,
        lng: location.lng,
        routeIndex
      })
    });
  }
  
  /**
   * Update logistics state
   * @param {string} orderId - Order ID
   * @param {string} state - New state
   * @param {string} remarks - Optional remarks
   */
  async updateState(orderId, state, remarks = null) {
    return this.request(`/logistics/tracking/${orderId}/state`, {
      method: 'POST',
      body: JSON.stringify({ state, remarks })
    });
  }
  
  /**
   * Simulate driver movement (dev only)
   */
  async simulateMovement(orderId, steps = 1) {
    return this.request(`/logistics/tracking/${orderId}/simulate`, {
      method: 'POST',
      body: JSON.stringify({ steps })
    });
  }
  
  /**
   * Get driver's active tracking
   */
  async getDriverActiveTracking() {
    return this.request('/logistics/tracking/active');
  }
  
  /**
   * Get states info
   */
  async getStatesInfo() {
    return this.request('/logistics/tracking/states');
  }
}

// ============================================
// TRACKING MANAGER
// ============================================

/**
 * TrackingManager - Manages polling and state updates
 */
export class TrackingManager {
  constructor(api, onUpdate, onError) {
    this.api = api;
    this.onUpdate = onUpdate;
    this.onError = onError;
    
    this.orderId = null;
    this.pollingInterval = null;
    this.retryDelay = CONFIG.INITIAL_RETRY_DELAY_MS;
    this.isPolling = false;
    this.lastTracking = null;
  }
  
  /**
   * Start tracking an order
   * @param {string} orderId - Order ID to track
   */
  async startTracking(orderId) {
    if (this.isPolling && this.orderId === orderId) {
      return; // Already tracking this order
    }
    
    this.stopTracking();
    this.orderId = orderId;
    this.isPolling = true;
    this.retryDelay = CONFIG.INITIAL_RETRY_DELAY_MS;
    
    // Initial fetch
    await this.fetchTracking();
    
    // Start polling
    this.pollingInterval = setInterval(
      () => this.fetchTracking(),
      CONFIG.POLLING_INTERVAL_MS
    );
  }
  
  /**
   * Stop tracking
   */
  stopTracking() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    this.orderId = null;
    this.lastTracking = null;
  }
  
  /**
   * Fetch tracking data
   */
  async fetchTracking() {
    if (!this.orderId) return;
    
    try {
      const response = await this.api.getTracking(this.orderId);
      
      if (response.success && response.tracking) {
        this.lastTracking = response.tracking;
        this.retryDelay = CONFIG.INITIAL_RETRY_DELAY_MS;
        
        // Notify listener
        if (this.onUpdate) {
          this.onUpdate(response.tracking);
        }
        
        // Stop polling if delivery is complete
        if (!response.tracking.isActive) {
          this.stopTracking();
        }
      }
      
      return response;
    } catch (error) {
      // Implement exponential backoff
      this.retryDelay = Math.min(
        this.retryDelay * 2,
        CONFIG.MAX_RETRY_INTERVAL_MS
      );
      
      if (this.onError) {
        this.onError(error);
      }
      
      throw error;
    }
  }
  
  /**
   * Update logistics state
   */
  async updateState(state, remarks = null) {
    if (!this.orderId) {
      throw new Error('No order is being tracked');
    }
    
    const response = await this.api.updateState(this.orderId, state, remarks);
    
    if (response.success && response.tracking) {
      this.lastTracking = response.tracking;
      
      if (this.onUpdate) {
        this.onUpdate(response.tracking);
      }
    }
    
    return response;
  }
  
  /**
   * Update driver location
   */
  async updateDriverLocation(location, routeIndex = null) {
    if (!this.orderId) {
      throw new Error('No order is being tracked');
    }
    
    const response = await this.api.updateDriverLocation(
      this.orderId,
      location,
      routeIndex
    );
    
    if (response.success && response.tracking) {
      this.lastTracking = response.tracking;
      
      if (this.onUpdate) {
        this.onUpdate(response.tracking);
      }
    }
    
    return response;
  }
  
  /**
   * Get current tracking data
   */
  getTracking() {
    return this.lastTracking;
  }
  
  /**
   * Check if currently polling
   */
  getIsPolling() {
    return this.isPolling;
  }
}

// ============================================
// UTILITIES
// ============================================

/**
 * Decode Google Maps encoded polyline
 * @param {string} encoded - Encoded polyline string
 * @returns {Array<{lat: number, lng: number}>} Decoded coordinates
 */
export function decodePolyline(encoded) {
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
 * Calculate distance between two coordinates (Haversine formula)
 * @param {Object} coord1 - { lat, lng }
 * @param {Object} coord2 - { lat, lng }
 * @returns {number} Distance in meters
 */
export function calculateDistance(coord1, coord2) {
  const R = 6371000; // Earth's radius in meters
  const lat1 = coord1.lat * Math.PI / 180;
  const lat2 = coord2.lat * Math.PI / 180;
  const deltaLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const deltaLng = (coord2.lng - coord1.lng) * Math.PI / 180;
  
  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Format distance for display
 * @param {number} meters - Distance in meters
 * @returns {string} Formatted distance string
 */
export function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format duration for display
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string
 */
export function formatDuration(seconds) {
  if (seconds <= 0) return 'Arriving now';
  
  if (seconds < 60) {
    return `${Math.round(seconds)} sec`;
  }
  if (seconds < 3600) {
    const mins = Math.round(seconds / 60);
    return `${mins} min${mins !== 1 ? 's' : ''}`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

/**
 * Calculate map center between two coordinates
 * @param {Object} coord1 - { lat, lng }
 * @param {Object} coord2 - { lat, lng }
 * @returns {Object} Center coordinate
 */
export function calculateMapCenter(coord1, coord2) {
  return {
    lat: (coord1.lat + coord2.lat) / 2,
    lng: (coord1.lng + coord2.lng) / 2
  };
}

/**
 * Calculate appropriate zoom level based on distance
 * @param {Object} coord1 - { lat, lng }
 * @param {Object} coord2 - { lat, lng }
 * @returns {number} Zoom level (1-20)
 */
export function calculateZoomLevel(coord1, coord2) {
  const latDiff = Math.abs(coord1.lat - coord2.lat);
  const lngDiff = Math.abs(coord1.lng - coord2.lng);
  const maxDiff = Math.max(latDiff, lngDiff);
  
  if (maxDiff > 0.5) return 9;
  if (maxDiff > 0.2) return 10;
  if (maxDiff > 0.1) return 11;
  if (maxDiff > 0.05) return 12;
  if (maxDiff > 0.02) return 13;
  return 14;
}

/**
 * Interpolate between two coordinates for smooth animation
 * @param {Object} from - Start coordinate
 * @param {Object} to - End coordinate
 * @param {number} t - Interpolation factor (0-1)
 * @returns {Object} Interpolated coordinate
 */
export function interpolateCoordinate(from, to, t) {
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t
  };
}

// ============================================
// EXPORT ALL
// ============================================

export default {
  // Configuration
  CONFIG,
  
  // State machine
  LogisticsState,
  StateTransitions,
  StateMessages,
  StateMarkerColors,
  DriverActions,
  
  // State validation
  isValidTransition,
  getAllowedTransitions,
  isTerminalState,
  
  // Classes
  LogisticsTrackingAPI,
  TrackingManager,
  
  // Utilities
  decodePolyline,
  calculateDistance,
  formatDistance,
  formatDuration,
  calculateMapCenter,
  calculateZoomLevel,
  interpolateCoordinate
};
