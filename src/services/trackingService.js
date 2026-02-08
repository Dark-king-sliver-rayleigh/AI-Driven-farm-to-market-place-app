/**
 * Logistics Tracking API Service
 * 
 * PURPOSE:
 * Provides API methods for real-time logistics tracking.
 * All location updates come from the backend - no client-side location computation.
 * 
 * POLLING STRATEGY:
 * - Call getTracking() every 5-10 seconds for real-time updates
 * - Stop polling when delivery is complete (isActive === false)
 * - Implement exponential backoff on errors
 * 
 * USAGE:
 * import { trackingAPI } from './trackingService';
 * const data = await trackingAPI.getTracking(orderId);
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Get stored auth token
 */
function getToken() {
  return sessionStorage.getItem('authToken');
}

/**
 * Create headers with auth token
 */
function authHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
}

/**
 * Handle API response
 */
async function handleResponse(response) {
  const data = await response.json();
  
  if (!response.ok) {
    if (response.status === 401) {
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('authUser');
      window.location.href = '/login';
      throw new Error('Session expired. Please login again.');
    }
    
    throw new Error(data.error?.message || data.message || 'An error occurred');
  }
  
  return data;
}

/**
 * API request helper
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: authHeaders(),
    ...options
  };
  
  const response = await fetch(url, config);
  return handleResponse(response);
}

// ============================================
// TRACKING API METHODS
// ============================================

export const trackingAPI = {
  /**
   * Get tracking data for an order
   * POLLING ENDPOINT - call every 5-10 seconds
   * 
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Tracking data with driver location, ETA, state
   */
  async getTracking(orderId) {
    return apiRequest(`/logistics/tracking/${orderId}`);
  },
  
  /**
   * Initialize tracking for an order (driver only)
   * Called when driver accepts an order
   * 
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Initialized tracking data
   */
  async initializeTracking(orderId) {
    return apiRequest(`/logistics/tracking/${orderId}/initialize`, {
      method: 'POST'
    });
  },
  
  /**
   * Update driver location (driver only)
   * Called every 5-10 seconds with GPS coordinates
   * 
   * @param {string} orderId - Order ID
   * @param {Object} location - { lat: number, lng: number }
   * @param {number} routeIndex - Current index in route (optional)
   * @returns {Promise<Object>} Updated tracking data
   */
  async updateDriverLocation(orderId, location, routeIndex = null) {
    return apiRequest(`/logistics/tracking/${orderId}/location`, {
      method: 'POST',
      body: JSON.stringify({
        lat: location.lat,
        lng: location.lng,
        routeIndex
      })
    });
  },
  
  /**
   * Update logistics state (driver only)
   * Transitions delivery through the FSM
   * 
   * @param {string} orderId - Order ID
   * @param {string} state - New state
   * @param {string} remarks - Optional remarks
   * @returns {Promise<Object>} Updated tracking data
   */
  async updateState(orderId, state, remarks = null) {
    return apiRequest(`/logistics/tracking/${orderId}/state`, {
      method: 'POST',
      body: JSON.stringify({ state, remarks })
    });
  },
  
  /**
   * Simulate driver movement (development only)
   * 
   * @param {string} orderId - Order ID
   * @param {number} steps - Number of route points to advance
   * @returns {Promise<Object>} Updated tracking data
   */
  async simulateMovement(orderId, steps = 1) {
    return apiRequest(`/logistics/tracking/${orderId}/simulate`, {
      method: 'POST',
      body: JSON.stringify({ steps })
    });
  },
  
  /**
   * Get driver's active tracking (driver only)
   * 
   * @returns {Promise<Object>} Active tracking records
   */
  async getDriverActiveTracking() {
    return apiRequest('/logistics/tracking/active');
  },
  
  /**
   * Get logistics states info
   * Returns FSM configuration for UI display
   * 
   * @returns {Promise<Object>} States with messages and colors
   */
  async getStatesInfo() {
    return apiRequest('/logistics/tracking/states');
  }
};

// ============================================
// LOGISTICS STATE CONSTANTS
// ============================================

/**
 * Logistics states for UI display
 * Mirror of backend FSM states
 */
export const LOGISTICS_STATES = {
  ORDER_CONFIRMED: 'ORDER_CONFIRMED',
  DRIVER_ASSIGNED: 'DRIVER_ASSIGNED',
  PICKUP_STARTED: 'PICKUP_STARTED',
  PICKUP_COMPLETED: 'PICKUP_COMPLETED',
  IN_TRANSIT: 'IN_TRANSIT',
  NEAR_DESTINATION: 'NEAR_DESTINATION',
  DELIVERED: 'DELIVERED'
};

/**
 * State display messages
 */
export const STATE_MESSAGES = {
  ORDER_CONFIRMED: 'Order confirmed, waiting for driver',
  DRIVER_ASSIGNED: 'Driver assigned to your order',
  PICKUP_STARTED: 'Driver heading to pickup location',
  PICKUP_COMPLETED: 'Package collected, delivery starting',
  IN_TRANSIT: 'Your order is on the way',
  NEAR_DESTINATION: 'Driver is nearby',
  DELIVERED: 'Order delivered successfully'
};

/**
 * State marker colors (hex)
 */
export const STATE_MARKER_COLORS = {
  ORDER_CONFIRMED: '#9CA3AF',
  DRIVER_ASSIGNED: '#3B82F6',
  PICKUP_STARTED: '#F59E0B',
  PICKUP_COMPLETED: '#10B981',
  IN_TRANSIT: '#10B981',
  NEAR_DESTINATION: '#8B5CF6',
  DELIVERED: '#059669'
};

/**
 * Driver state action buttons configuration
 * Used by driver UI to show next possible actions
 */
export const DRIVER_ACTIONS = {
  DRIVER_ASSIGNED: {
    nextState: 'PICKUP_STARTED',
    buttonText: 'Start Pickup',
    buttonColor: 'bg-amber-500'
  },
  PICKUP_STARTED: {
    nextState: 'PICKUP_COMPLETED',
    buttonText: 'Confirm Pickup',
    buttonColor: 'bg-green-500'
  },
  PICKUP_COMPLETED: {
    nextState: 'IN_TRANSIT',
    buttonText: 'Start Delivery',
    buttonColor: 'bg-green-500'
  },
  IN_TRANSIT: {
    nextState: 'DELIVERED',
    buttonText: 'Mark Delivered',
    buttonColor: 'bg-emerald-600'
  },
  NEAR_DESTINATION: {
    nextState: 'DELIVERED',
    buttonText: 'Mark Delivered',
    buttonColor: 'bg-emerald-600'
  }
};

export default trackingAPI;
