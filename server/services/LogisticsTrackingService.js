const LogisticsTracking = require('../models/LogisticsTracking');
const Delivery = require('../models/Delivery');
const Order = require('../models/Order');
const User = require('../models/User');

/**
 * LogisticsTrackingService - Business Logic Layer
 * 
 * PURPOSE:
 * Encapsulates all business logic for real-time logistics tracking.
 * Handles route computation, location updates, state transitions, and ETA calculation.
 * 
 * DESIGN PRINCIPLES:
 * 1. All driver location updates must come through this service (no client-side faking)
 * 2. State transitions are validated and logged
 * 3. Route data is computed server-side using Geoapify APIs
 * 4. Service layer is platform-agnostic (works for web, Android, iOS)
 * 
 * DEPENDENCIES:
 * - Geoapify Routing API (for route computation)
 * - Haversine helper (for fallback ETA calculation)
 */

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY;

/**
 * Encode an array of {lat, lng} points into a Google-compatible encoded polyline string.
 * Clients already know how to decode this format so we keep compatibility.
 *
 * @param {Array<{lat: number, lng: number}>} points
 * @returns {string} Encoded polyline string
 */
function encodePolyline(points) {
  let encoded = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const point of points) {
    const lat = Math.round(point.lat * 1e5);
    const lng = Math.round(point.lng * 1e5);

    encoded += encodeSignedValue(lat - prevLat);
    encoded += encodeSignedValue(lng - prevLng);

    prevLat = lat;
    prevLng = lng;
  }

  return encoded;
}

/**
 * Encode a single signed value for the polyline algorithm.
 * @param {number} value
 * @returns {string}
 */
function encodeSignedValue(value) {
  let v = value < 0 ? ~(value << 1) : (value << 1);
  let encoded = '';
  while (v >= 0x20) {
    encoded += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  encoded += String.fromCharCode(v + 63);
  return encoded;
}

/**
 * Format distance for display
 * @param {number} meters - Distance in meters
 * @returns {string} Formatted distance string
 */
function formatDistance(meters) {
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
function formatDuration(seconds) {
  if (seconds < 60) {
    return `${Math.round(seconds)} sec`;
  }
  if (seconds < 3600) {
    const mins = Math.round(seconds / 60);
    return `${mins} min${mins !== 1 ? 's' : ''}`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return `${hours} hr${hours !== 1 ? 's' : ''} ${mins} min${mins !== 1 ? 's' : ''}`;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {Object} coord1 - { lat, lng }
 * @param {Object} coord2 - { lat, lng }
 * @returns {number} Distance in meters
 */
function calculateDistance(coord1, coord2) {
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

class LogisticsTrackingService {
  
  /**
   * Initialize tracking for an order when driver is assigned
   * Creates a new LogisticsTracking document with route information
   * 
   * @param {string} orderId - Order ID
   * @param {string} deliveryId - Delivery ID
   * @param {string} driverId - Assigned driver's ID
   * @returns {Promise<Object>} Created tracking document
   */
  static async initializeTracking(orderId, deliveryId, driverId) {
    // Check if tracking already exists
    const existing = await LogisticsTracking.findOne({ orderId });
    if (existing) {
      throw new Error('Tracking already exists for this order');
    }
    
    // Fetch delivery with populated order
    const delivery = await Delivery.findById(deliveryId)
      .populate({
        path: 'orderId',
        populate: [
          { path: 'farmerId', select: 'name phone address' },
          { path: 'consumerId', select: 'name phone address' }
        ]
      });
    
    if (!delivery) {
      throw new Error('Delivery not found');
    }
    
    // Fetch driver info
    const driver = await User.findById(driverId).select('name phone vehicleNumber');
    if (!driver) {
      throw new Error('Driver not found');
    }
    
    // Extract location data
    const farmerLocation = {
      address: delivery.pickupLocation.address,
      coordinates: {
        lat: delivery.pickupLocation.coordinates.lat,
        lng: delivery.pickupLocation.coordinates.lng
      }
    };
    
    const consumerLocation = {
      address: delivery.dropLocation.address,
      coordinates: {
        lat: delivery.dropLocation.coordinates.lat,
        lng: delivery.dropLocation.coordinates.lng
      }
    };
    
    // Driver starts at their current location (default to farmer location initially)
    const initialDriverLocation = {
      lat: farmerLocation.coordinates.lat,
      lng: farmerLocation.coordinates.lng
    };
    
    // Fetch route from Geoapify Routing API
    const routeData = await this.fetchRouteFromGeoapify(
      farmerLocation.coordinates,
      consumerLocation.coordinates
    );
    
    // Create tracking document
    const tracking = new LogisticsTracking({
      orderId,
      deliveryId,
      driverId,
      farmerLocation,
      consumerLocation,
      driverLocation: initialDriverLocation,
      routePolyline: routeData.polyline,
      routePoints: routeData.points.map((point, index) => ({
        lat: point.lat,
        lng: point.lng,
        pathIndex: index
      })),
      currentRouteIndex: 0,
      totalDistanceMeters: routeData.distanceMeters,
      remainingDistanceMeters: routeData.distanceMeters,
      totalDistanceText: routeData.distanceText,
      remainingDistanceText: routeData.distanceText,
      estimatedArrival: new Date(Date.now() + routeData.durationSeconds * 1000),
      etaSeconds: routeData.durationSeconds,
      etaText: routeData.durationText,
      driverInfo: {
        name: driver.name,
        phone: driver.phone,
        vehicleNumber: driver.vehicleNumber || 'N/A'
      },
      currentState: 'ORDER_CONFIRMED',
      stateHistory: [{
        fromState: null,
        toState: 'ORDER_CONFIRMED',
        timestamp: new Date(),
        driverLocation: initialDriverLocation,
        remarks: 'Tracking initialized'
      }]
    });
    
    await tracking.save();
    
    // Transition to DRIVER_ASSIGNED
    await this.updateState(orderId, 'DRIVER_ASSIGNED', {
      remarks: `Driver ${driver.name} assigned`
    });
    
    return tracking.toTrackingResponse();
  }
  
  /**
   * Fetch route from Geoapify Routing API
   * 
   * @param {Object} origin - { lat, lng }
   * @param {Object} destination - { lat, lng }
   * @returns {Promise<Object>} Route data with polyline, points, distance, duration
   */
  static async fetchRouteFromGeoapify(origin, destination) {
    // If no API key, use mock data for development
    if (!GEOAPIFY_API_KEY) {
      console.warn('GEOAPIFY_API_KEY not set, using mock route data');
      return this.generateMockRoute(origin, destination);
    }
    
    try {
      // Geoapify uses lon,lat order as waypoints
      const waypoints = `${origin.lat},${origin.lng}|${destination.lat},${destination.lng}`;
      const url = new URL('https://api.geoapify.com/v1/routing');
      url.searchParams.set('waypoints', waypoints);
      url.searchParams.set('mode', 'drive');
      url.searchParams.set('apiKey', GEOAPIFY_API_KEY);
      
      const response = await fetch(url.toString());
      const data = await response.json();
      
      if (!data.features || data.features.length === 0) {
        console.error('Geoapify Routing API returned no routes');
        return this.generateMockRoute(origin, destination);
      }
      
      const feature = data.features[0];
      const props = feature.properties;
      
      // Extract distance and duration from top-level properties
      const distanceMeters = Math.round(props.distance); // meters
      const durationSeconds = Math.round(props.time);     // seconds
      
      // Collect all coordinates from the GeoJSON geometry
      // Geometry can be LineString or MultiLineString
      let coordinates = [];
      if (feature.geometry.type === 'MultiLineString') {
        for (const line of feature.geometry.coordinates) {
          coordinates = coordinates.concat(line);
        }
      } else if (feature.geometry.type === 'LineString') {
        coordinates = feature.geometry.coordinates;
      }
      
      // Convert GeoJSON [lon, lat] to {lat, lng}
      const points = coordinates.map(coord => ({
        lat: coord[1],
        lng: coord[0]
      }));
      
      // Encode points into a polyline string for client compatibility
      const polyline = encodePolyline(points);
      
      return {
        polyline,
        points,
        distanceMeters,
        distanceText: formatDistance(distanceMeters),
        durationSeconds,
        durationText: formatDuration(durationSeconds)
      };
    } catch (error) {
      console.error('Error fetching route from Geoapify:', error);
      return this.generateMockRoute(origin, destination);
    }
  }
  
  /**
   * Generate mock route for development/testing when Google API is unavailable
   * Creates a simple straight-line route with interpolated points
   * 
   * @param {Object} origin - { lat, lng }
   * @param {Object} destination - { lat, lng }
   * @returns {Object} Mock route data
   */
  static generateMockRoute(origin, destination) {
    const points = [];
    const numPoints = 20; // Number of points along the route
    
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      points.push({
        lat: origin.lat + (destination.lat - origin.lat) * t,
        lng: origin.lng + (destination.lng - origin.lng) * t
      });
    }
    
    // Calculate straight-line distance
    const distanceMeters = calculateDistance(origin, destination);
    
    // Estimate duration (assuming average speed of 30 km/h in city)
    const durationSeconds = Math.round((distanceMeters / 1000) * 120); // 2 mins per km
    
    return {
      polyline: encodePolyline(points), // Encoded polyline even in mock for client compat
      points,
      distanceMeters: Math.round(distanceMeters),
      distanceText: formatDistance(distanceMeters),
      durationSeconds,
      durationText: formatDuration(durationSeconds)
    };
  }
  
  /**
   * Get tracking data for an order
   * This is the main polling endpoint for real-time updates
   * 
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Tracking response data
   */
  static async getTracking(orderId) {
    const tracking = await LogisticsTracking.findOne({ orderId });
    
    if (!tracking) {
      return null;
    }
    
    return tracking.toTrackingResponse();
  }
  
  /**
   * Get tracking by delivery ID
   * 
   * @param {string} deliveryId - Delivery ID
   * @returns {Promise<Object>} Tracking response data
   */
  static async getTrackingByDelivery(deliveryId) {
    const tracking = await LogisticsTracking.findOne({ deliveryId });
    
    if (!tracking) {
      return null;
    }
    
    return tracking.toTrackingResponse();
  }
  
  /**
   * Update logistics state with validation
   * 
   * @param {string} orderId - Order ID
   * @param {string} newState - New logistics state
   * @param {Object} options - Additional options (remarks, driverLocation)
   * @returns {Promise<Object>} Updated tracking response
   */
  static async updateState(orderId, newState, options = {}) {
    const tracking = await LogisticsTracking.findOne({ orderId });
    
    if (!tracking) {
      throw new Error('Tracking not found for this order');
    }
    
    if (!tracking.isActive && newState !== 'DELIVERED') {
      throw new Error('Cannot update state for completed delivery');
    }
    
    // Perform state transition (throws if invalid)
    tracking.transitionTo(newState, {
      remarks: options.remarks,
      driverLocation: options.driverLocation || tracking.driverLocation
    });
    
    await tracking.save();
    
    return tracking.toTrackingResponse();
  }
  
  /**
   * Update driver location
   * This is called periodically (every 5-10 seconds) by the driver's device
   * 
   * @param {string} orderId - Order ID
   * @param {Object} location - { lat, lng }
   * @param {number} routeIndex - Current index in route points (optional)
   * @returns {Promise<Object>} Updated tracking response
   */
  static async updateDriverLocation(orderId, location, routeIndex = null) {
    const tracking = await LogisticsTracking.findOne({ orderId });
    
    if (!tracking) {
      throw new Error('Tracking not found for this order');
    }
    
    if (!tracking.isActive) {
      throw new Error('Cannot update location for completed delivery');
    }
    
    // Update driver location
    tracking.updateDriverLocation(location, routeIndex);
    
    // Calculate remaining distance based on current position
    const distanceToConsumer = calculateDistance(
      location,
      tracking.consumerLocation.coordinates
    );
    
    tracking.remainingDistanceMeters = Math.round(distanceToConsumer);
    tracking.remainingDistanceText = formatDistance(distanceToConsumer);
    
    // Update ETA (simple linear interpolation based on remaining distance)
    if (tracking.totalDistanceMeters > 0) {
      const progressRatio = 1 - (distanceToConsumer / tracking.totalDistanceMeters);
      const originalDuration = tracking.stateHistory[0]?.timestamp
        ? (tracking.estimatedArrival - tracking.stateHistory[0].timestamp) / 1000
        : tracking.etaSeconds;
      
      const remainingDuration = Math.max(0, originalDuration * (1 - progressRatio));
      tracking.etaSeconds = Math.round(remainingDuration);
      tracking.etaText = formatDuration(remainingDuration);
      tracking.estimatedArrival = new Date(Date.now() + remainingDuration * 1000);
    }
    
    // Auto-transition to NEAR_DESTINATION if applicable
    if (tracking.currentState === 'IN_TRANSIT' && tracking.isNearDestination()) {
      tracking.transitionTo('NEAR_DESTINATION', {
        remarks: 'Driver within 500m of destination',
        driverLocation: location
      });
    }
    
    await tracking.save();
    
    return tracking.toTrackingResponse();
  }
  
  /**
   * Simulate driver movement along the route
   * FOR TESTING/DEMO PURPOSES ONLY
   * In production, real GPS updates come from driver's device
   * 
   * @param {string} orderId - Order ID
   * @param {number} stepCount - Number of route points to advance
   * @returns {Promise<Object>} Updated tracking response
   */
  static async simulateDriverMovement(orderId, stepCount = 1) {
    const tracking = await LogisticsTracking.findOne({ orderId });
    
    if (!tracking) {
      throw new Error('Tracking not found for this order');
    }
    
    if (!tracking.isActive) {
      throw new Error('Cannot simulate movement for completed delivery');
    }
    
    if (tracking.routePoints.length === 0) {
      throw new Error('No route points available for simulation');
    }
    
    // Calculate new route index
    let newIndex = tracking.currentRouteIndex + stepCount;
    newIndex = Math.min(newIndex, tracking.routePoints.length - 1);
    
    // Get new position
    const newPosition = tracking.routePoints[newIndex];
    
    // Update location
    return this.updateDriverLocation(orderId, newPosition, newIndex);
  }
  
  /**
   * Get active tracking for a driver
   * Returns all orders currently being delivered by this driver
   * 
   * @param {string} driverId - Driver's user ID
   * @returns {Promise<Array>} Array of tracking responses
   */
  static async getDriverActiveTracking(driverId) {
    const trackings = await LogisticsTracking.find({
      driverId,
      isActive: true
    }).sort({ createdAt: -1 });
    
    return trackings.map(t => t.toTrackingResponse());
  }
  
  /**
   * Get tracking history for a consumer
   * Returns all tracking records for orders placed by this consumer
   * 
   * @param {string} consumerId - Consumer's user ID
   * @param {boolean} activeOnly - Only return active tracking
   * @returns {Promise<Array>} Array of tracking responses
   */
  static async getConsumerTracking(consumerId, activeOnly = false) {
    // First get consumer's orders
    const orders = await Order.find({ consumerId }).select('_id');
    const orderIds = orders.map(o => o._id);
    
    const query = { orderId: { $in: orderIds } };
    if (activeOnly) {
      query.isActive = true;
    }
    
    const trackings = await LogisticsTracking.find(query)
      .sort({ createdAt: -1 });
    
    return trackings.map(t => t.toTrackingResponse());
  }
  
  /**
   * Cancel tracking for an order
   * Called when an order is cancelled
   * 
   * @param {string} orderId - Order ID
   * @returns {Promise<boolean>} Whether cancellation was successful
   */
  static async cancelTracking(orderId) {
    const tracking = await LogisticsTracking.findOne({ orderId });
    
    if (!tracking) {
      return false;
    }
    
    tracking.isActive = false;
    tracking.stateHistory.push({
      fromState: tracking.currentState,
      toState: tracking.currentState,
      timestamp: new Date(),
      remarks: 'Tracking cancelled due to order cancellation'
    });
    
    await tracking.save();
    return true;
  }
  
  /**
   * Get distance/duration between two points using Geoapify Routing API.
   * Falls back to Haversine calculation if API key is missing.
   * 
   * @param {Object} origin - { lat, lng }
   * @param {Object} destination - { lat, lng }
   * @returns {Promise<Object>} Distance and duration data
   */
  static async getDistanceMatrix(origin, destination) {
    if (!GEOAPIFY_API_KEY) {
      // Return mock data
      const distance = calculateDistance(origin, destination);
      const duration = Math.round((distance / 1000) * 120);
      return {
        distanceMeters: Math.round(distance),
        distanceText: formatDistance(distance),
        durationSeconds: duration,
        durationText: formatDuration(duration)
      };
    }
    
    try {
      const waypoints = `${origin.lat},${origin.lng}|${destination.lat},${destination.lng}`;
      const url = new URL('https://api.geoapify.com/v1/routing');
      url.searchParams.set('waypoints', waypoints);
      url.searchParams.set('mode', 'drive');
      url.searchParams.set('apiKey', GEOAPIFY_API_KEY);
      
      const response = await fetch(url.toString());
      const data = await response.json();
      
      if (!data.features || data.features.length === 0) {
        throw new Error('Geoapify Routing returned no features');
      }
      
      const props = data.features[0].properties;
      
      return {
        distanceMeters: Math.round(props.distance),
        distanceText: formatDistance(props.distance),
        durationSeconds: Math.round(props.time),
        durationText: formatDuration(props.time)
      };
    } catch (error) {
      console.error('Error fetching distance from Geoapify:', error);
      // Fall back to mock data
      const distance = calculateDistance(origin, destination);
      const duration = Math.round((distance / 1000) * 120);
      return {
        distanceMeters: Math.round(distance),
        distanceText: formatDistance(distance),
        durationSeconds: duration,
        durationText: formatDuration(duration)
      };
    }
  }
}

module.exports = LogisticsTrackingService;
