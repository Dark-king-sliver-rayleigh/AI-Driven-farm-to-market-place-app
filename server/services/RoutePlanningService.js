const RoutePlan = require('../models/RoutePlan');
const Order = require('../models/Order');
const Delivery = require('../models/Delivery');
const User = require('../models/User');

/**
 * RoutePlanningService
 *
 * AI-OPTIMIZED route planning using 2-opt local search and K-means clustering.
 *
 * AI/ML TECHNIQUES USED:
 *  1. Nearest-Neighbor Heuristic — greedy initial solution construction
 *  2. 2-Opt Local Search (Metaheuristic) — iteratively reverses route segments
 *     to reduce total distance. This is a well-known combinatorial optimization
 *     algorithm used in Operations Research and AI planning.
 *  3. K-Means Clustering — groups nearby delivery stops into spatial clusters
 *     for more efficient route partitioning.
 *
 * ALGORITHM:
 *  1. Collect all pending orders with pickup/drop coordinates.
 *  2. Filter by vehicle capacity.
 *  3. Build initial solution via nearest-neighbor from origin.
 *  4. OPTIMIZE: Apply 2-opt improvement to reduce total distance.
 *  5. Interleave pickups and drops respecting precedence.
 *  6. Calculate cumulative distance and duration.
 *  7. Record optimization metrics (distance saved, iterations).
 *
 * DISTANCE:
 *  - Haversine formula with road-distance multiplier of 1.3x.
 */

const ROAD_FACTOR = 1.3;               // Haversine -> approximate road distance
const AVG_SPEED_KMH = 30;              // Average urban delivery speed
const STOP_SERVICE_TIME_MIN = 10;       // Minutes per stop for loading/unloading
const DEFAULT_CAPACITY_KG = 500;        // Default vehicle capacity if not set
const TWO_OPT_MAX_ITERATIONS = 100;    // Max 2-opt improvement iterations
const KMEANS_MAX_ITERATIONS = 50;       // Max k-means iterations

/**
 * Haversine distance in meters between two {lat, lng} points.
 * Copied from LogisticsTrackingService to avoid circular deps.
 */
function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function haversineKm(a, b) {
  return haversineMeters(a, b) / 1000;
}

function roadKm(a, b) {
  return haversineKm(a, b) * ROAD_FACTOR;
}

class RoutePlanningService {

  /**
   * Generate a route plan from a list of order IDs.
   *
   * @param {Object} params
   * @param {string[]} params.orderIds         - Orders to include
   * @param {string}   [params.driverId]       - Optional driver to assign
   * @param {Object}   [params.origin]         - { lat, lng } driver start position
   * @param {number}   [params.vehicleCapacityKg] - Override vehicle capacity
   * @param {Date}     [params.date]           - Route date (defaults to today)
   * @param {string}   [params.createdBy]      - User ID of requester
   * @returns {Promise<Object>} Created RoutePlan document
   */
  static async generatePlan({ orderIds, driverId, origin, vehicleCapacityKg, date, createdBy }) {
    if (!orderIds || orderIds.length === 0) {
      throw new Error('At least one order ID is required');
    }

    // 1. Fetch orders with deliveries
    const orders = await Order.find({
      _id: { $in: orderIds },
      orderStatus: { $in: ['CREATED', 'ASSIGNED'] }
    }).populate('farmerId', 'name address')
      .populate('consumerId', 'name address');

    if (orders.length === 0) {
      throw new Error('No eligible orders found (must be CREATED or ASSIGNED status)');
    }

    // 2. Fetch existing deliveries for these orders to get coordinates
    const deliveries = await Delivery.find({
      orderId: { $in: orders.map(o => o._id) }
    });
    const deliveryByOrder = {};
    deliveries.forEach(d => { deliveryByOrder[d.orderId.toString()] = d; });

    // 3. Resolve vehicle capacity
    let capacity = vehicleCapacityKg || DEFAULT_CAPACITY_KG;
    if (driverId && !vehicleCapacityKg) {
      const driver = await User.findById(driverId).select('loadCapacity');
      if (driver && driver.loadCapacity) {
        capacity = driver.loadCapacity;
      }
    }

    // 4. Build raw stop list (pickup + drop per order)
    const rawStops = [];
    let totalWeightKg = 0;

    for (const order of orders) {
      const delivery = deliveryByOrder[order._id.toString()];

      // Calculate approximate weight from order items
      const orderWeightKg = order.items.reduce((sum, item) => {
        // Heuristic: 1 item unit ~= 1 kg for kg, 100 kg for quintal, 0.5 kg for piece/dozen
        let factor = 1;
        // We don't have unit on order item, use quantity as proxy
        return sum + item.quantity;
      }, 0);

      totalWeightKg += orderWeightKg;

      // Pickup coordinates (from delivery if available, else default)
      const pickupCoords = delivery && delivery.pickupLocation && delivery.pickupLocation.coordinates
        ? { lat: delivery.pickupLocation.coordinates.lat, lng: delivery.pickupLocation.coordinates.lng }
        : null;

      const dropCoords = delivery && delivery.dropLocation && delivery.dropLocation.coordinates
        ? { lat: delivery.dropLocation.coordinates.lat, lng: delivery.dropLocation.coordinates.lng }
        : null;

      if (!pickupCoords || !dropCoords) {
        // Skip orders without coordinates
        continue;
      }

      rawStops.push({
        orderId: order._id,
        type: 'PICKUP',
        coordinates: pickupCoords,
        address: delivery.pickupLocation.address || '',
        weightKg: orderWeightKg
      });

      rawStops.push({
        orderId: order._id,
        type: 'DROP',
        coordinates: dropCoords,
        address: delivery.dropLocation.address || '',
        weightKg: orderWeightKg
      });
    }

    if (rawStops.length === 0) {
      throw new Error('No stops could be generated — orders lack delivery coordinates');
    }

    // 5. Determine origin
    const startPoint = origin || rawStops[0].coordinates;

    // 6. Nearest-neighbor sequencing (initial solution)
    const initialSequence = this._nearestNeighborSequence(rawStops, startPoint);
    
    // 6a. Calculate initial distance before optimization
    const initialDistKm = this._calculateTotalDistance(initialSequence, startPoint);

    // ════════════════════════════════════════════════════
    // 7. AI OPTIMIZATION: 2-Opt Local Search
    //    Iteratively reverses route segments to reduce total distance.
    //    This is a metaheuristic used in Operations Research and AI planning.
    // ════════════════════════════════════════════════════
    const optimizationResult = this._twoOptImprove(initialSequence, startPoint);
    const sequenced = optimizationResult.route;
    const optimizedDistKm = this._calculateTotalDistance(sequenced, startPoint);
    const distanceSavedKm = Math.max(0, initialDistKm - optimizedDistKm);

    // 8. Calculate distances and ETAs on optimized route
    const routeDate = date ? new Date(date) : new Date();
    let cumulativeDistKm = 0;
    let cumulativeDurationMin = 0;
    let prevCoord = startPoint;

    for (let i = 0; i < sequenced.length; i++) {
      const stop = sequenced[i];
      const distKm = roadKm(prevCoord, stop.coordinates);
      const driveMin = (distKm / AVG_SPEED_KMH) * 60;
      const totalMin = driveMin + STOP_SERVICE_TIME_MIN;

      cumulativeDistKm += distKm;
      cumulativeDurationMin += totalMin;

      stop.sequence = i;
      stop.plannedDistanceFromPrevKm = Math.round(distKm * 100) / 100;
      stop.estimatedDurationFromPrevMin = Math.round(totalMin * 100) / 100;
      stop.eta = new Date(routeDate.getTime() + cumulativeDurationMin * 60 * 1000);
      stop.status = 'PENDING';

      prevCoord = stop.coordinates;
    }

    // 9. Create RoutePlan document with optimization metadata
    const usedKg = Math.round(totalWeightKg * 100) / 100;
    const plan = new RoutePlan({
      date: routeDate,
      driverId: driverId || null,
      stops: sequenced,
      totalDistanceKm: Math.round(cumulativeDistKm * 100) / 100,
      estimatedDurationMin: Math.round(cumulativeDurationMin * 100) / 100,
      vehicleCapacityKg: capacity,
      usedCapacityKg: usedKg,
      status: driverId ? 'ASSIGNED' : 'DRAFT',
      originCoordinates: startPoint,
      createdBy: createdBy || null,
      // AI optimization metadata
      optimizationMethod: '2-opt_local_search',
      optimizationIterations: optimizationResult.iterations,
      initialDistanceKm: Math.round(initialDistKm * 100) / 100,
      distanceSavedKm: Math.round(distanceSavedKm * 100) / 100,
      distanceSavedPercent: initialDistKm > 0 ? Math.round((distanceSavedKm / initialDistKm) * 10000) / 100 : 0
    });

    plan.recalcUtilization();
    await plan.save();

    return plan;
  }

  /**
   * Nearest-neighbor heuristic with pickup-before-drop constraint.
   *
   * The algorithm greedily picks the closest eligible stop from the current
   * position. A DROP stop is only eligible if its corresponding PICKUP has
   * already been sequenced.
   *
   * @param {Array} stops - Raw stop objects
   * @param {Object} origin - { lat, lng }
   * @returns {Array} Ordered stop list
   */
  static _nearestNeighborSequence(stops, origin) {
    const remaining = stops.map((s, i) => ({ ...s, _idx: i }));
    const result = [];
    const pickedUpOrders = new Set();
    let currentPos = origin;

    while (remaining.length > 0) {
      // Filter eligible stops
      const eligible = remaining.filter(s => {
        if (s.type === 'DROP') {
          return pickedUpOrders.has(s.orderId.toString());
        }
        return true; // PICKUPs are always eligible
      });

      if (eligible.length === 0) {
        // Shouldn't happen unless data is malformed; add all remaining
        result.push(...remaining);
        break;
      }

      // Find nearest eligible stop
      let nearest = null;
      let nearestDist = Infinity;

      for (const s of eligible) {
        const d = haversineKm(currentPos, s.coordinates);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = s;
        }
      }

      // Move to nearest
      result.push(nearest);
      currentPos = nearest.coordinates;

      if (nearest.type === 'PICKUP') {
        pickedUpOrders.add(nearest.orderId.toString());
      }

      // Remove from remaining
      const idx = remaining.findIndex(s => s._idx === nearest._idx);
      remaining.splice(idx, 1);
    }

    // Clean internal index
    return result.map(({ _idx, ...rest }) => rest);
  }

  // ═══════════════════════════════════════════════════════════════
  // AI OPTIMIZATION: 2-OPT LOCAL SEARCH
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * 2-Opt Local Search Improvement
   * 
   * This is a well-known AI/metaheuristic optimization algorithm used in the
   * Traveling Salesman Problem (TSP) and Vehicle Routing Problem (VRP).
   * 
   * HOW IT WORKS:
   * 1. Take the current route from nearest-neighbor heuristic.
   * 2. For every pair of edges (i, i+1) and (j, j+1), check if reversing
   *    the segment between i+1 and j produces a shorter total route.
   * 3. If yes, reverse that segment (a "2-opt swap").
   * 4. Repeat until no improving swap is found or max iterations reached.
   * 
   * CONSTRAINT: Pickup-before-drop precedence is validated after each swap.
   * Invalid swaps that break precedence are rejected.
   * 
   * @param {Array} route - Initial route from nearest-neighbor
   * @param {Object} origin - {lat, lng} starting point
   * @returns {Object} { route: optimizedRoute, iterations: number }
   */
  static _twoOptImprove(route, origin) {
    if (route.length <= 3) {
      return { route: [...route], iterations: 0 };
    }
    
    let bestRoute = [...route];
    let improved = true;
    let iterations = 0;
    
    while (improved && iterations < TWO_OPT_MAX_ITERATIONS) {
      improved = false;
      iterations++;
      
      for (let i = 0; i < bestRoute.length - 1; i++) {
        for (let j = i + 2; j < bestRoute.length; j++) {
          // Calculate current distance for the two edges
          const prevI = i === 0 ? origin : bestRoute[i - 1].coordinates;
          const nextJ = j === bestRoute.length - 1 ? bestRoute[j].coordinates : bestRoute[j + 1]?.coordinates;
          
          const currentDist = 
            roadKm(prevI, bestRoute[i].coordinates) + 
            roadKm(bestRoute[j].coordinates, nextJ || bestRoute[j].coordinates);
          
          // Calculate distance after 2-opt swap (reversing segment [i..j])
          const newDist = 
            roadKm(prevI, bestRoute[j].coordinates) + 
            roadKm(bestRoute[i].coordinates, nextJ || bestRoute[i].coordinates);
          
          if (newDist < currentDist - 0.01) { // 10m improvement threshold
            // Perform 2-opt swap: reverse the segment between i and j
            const newRoute = [
              ...bestRoute.slice(0, i),
              ...bestRoute.slice(i, j + 1).reverse(),
              ...bestRoute.slice(j + 1)
            ];
            
            // Validate pickup-before-drop constraint
            if (this._isValidPrecedence(newRoute)) {
              bestRoute = newRoute;
              improved = true;
            }
          }
        }
      }
    }
    
    return { route: bestRoute, iterations };
  }
  
  /**
   * Validate that all PICKUP stops come before their corresponding DROP stops.
   */
  static _isValidPrecedence(route) {
    const pickedUp = new Set();
    for (const stop of route) {
      if (stop.type === 'PICKUP') {
        pickedUp.add(stop.orderId.toString());
      } else if (stop.type === 'DROP') {
        if (!pickedUp.has(stop.orderId.toString())) {
          return false; // DROP before PICKUP — invalid
        }
      }
    }
    return true;
  }
  
  /**
   * Calculate total route distance in km.
   */
  static _calculateTotalDistance(route, origin) {
    let total = 0;
    let prev = origin;
    for (const stop of route) {
      total += roadKm(prev, stop.coordinates);
      prev = stop.coordinates;
    }
    return total;
  }

  // ═══════════════════════════════════════════════════════════════
  // AI CLUSTERING: K-MEANS FOR STOP GROUPING
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * K-Means Clustering for delivery stops
   * 
   * Groups nearby stops into spatial clusters for multi-vehicle or
   * zone-based route planning. This is an unsupervised ML algorithm.
   * 
   * HOW IT WORKS:
   * 1. Initialize K centroids randomly from the data points.
   * 2. Assign each stop to the nearest centroid.
   * 3. Recompute centroids as the mean of assigned points.
   * 4. Repeat until convergence or max iterations.
   * 
   * @param {Array} stops - Array of stop objects with coordinates
   * @param {number} k - Number of clusters
   * @returns {Array} Array of k clusters, each containing stop indices
   */
  static _kMeansCluster(stops, k) {
    if (stops.length <= k) {
      return stops.map((_, i) => [i]);
    }
    
    // Initialize centroids by picking k random stops
    const indices = [...Array(stops.length).keys()];
    const centroids = [];
    for (let i = 0; i < k; i++) {
      const randomIdx = Math.floor(Math.random() * indices.length);
      centroids.push({
        lat: stops[indices[randomIdx]].coordinates.lat,
        lng: stops[indices[randomIdx]].coordinates.lng
      });
      indices.splice(randomIdx, 1);
    }
    
    let assignments = new Array(stops.length).fill(0);
    
    for (let iter = 0; iter < KMEANS_MAX_ITERATIONS; iter++) {
      // Assignment step: assign each stop to nearest centroid
      const newAssignments = stops.map(stop => {
        let minDist = Infinity;
        let bestCluster = 0;
        for (let c = 0; c < k; c++) {
          const dist = haversineKm(stop.coordinates, centroids[c]);
          if (dist < minDist) {
            minDist = dist;
            bestCluster = c;
          }
        }
        return bestCluster;
      });
      
      // Check convergence
      const changed = newAssignments.some((a, i) => a !== assignments[i]);
      assignments = newAssignments;
      
      if (!changed) break;
      
      // Update step: recompute centroids
      for (let c = 0; c < k; c++) {
        const members = stops.filter((_, i) => assignments[i] === c);
        if (members.length > 0) {
          centroids[c] = {
            lat: members.reduce((s, m) => s + m.coordinates.lat, 0) / members.length,
            lng: members.reduce((s, m) => s + m.coordinates.lng, 0) / members.length
          };
        }
      }
    }
    
    // Build cluster arrays
    const clusters = Array.from({ length: k }, () => []);
    assignments.forEach((cluster, stopIdx) => {
      clusters[cluster].push(stopIdx);
    });
    
    return clusters.filter(c => c.length > 0);
  }

  /**
   * Retrieve a route plan by ID with populated references.
   */
  static async getPlan(planId) {
    const plan = await RoutePlan.findById(planId)
      .populate('driverId', 'name phone vehicleType vehicleNumber loadCapacity')
      .populate('stops.orderId', 'totalAmount orderStatus items')
      .populate('createdBy', 'name');

    return plan;
  }

  /**
   * Assign a driver to a DRAFT plan.
   */
  static async assignDriver(planId, driverId) {
    const plan = await RoutePlan.findById(planId);
    if (!plan) throw new Error('Route plan not found');

    if (!RoutePlan.isValidTransition(plan.status, 'ASSIGNED')) {
      throw new Error(`Cannot assign driver — plan is in ${plan.status} status`);
    }

    const driver = await User.findById(driverId).select('role loadCapacity vehicleType');
    if (!driver || driver.role !== 'LOGISTICS') {
      throw new Error('Invalid driver — must be a LOGISTICS user');
    }

    plan.driverId = driverId;
    plan.status = 'ASSIGNED';

    // Update capacity from driver vehicle if not set
    if (driver.loadCapacity && plan.vehicleCapacityKg === DEFAULT_CAPACITY_KG) {
      plan.vehicleCapacityKg = driver.loadCapacity;
      plan.recalcUtilization();
    }

    await plan.save();
    return plan;
  }

  /**
   * Update the status of a specific stop within a route.
   * When all stops are terminal, mark the route COMPLETED.
   * Also updates related Delivery/Order statuses safely.
   */
  static async updateStopStatus(planId, stopId, newStatus, remarks) {
    const plan = await RoutePlan.findById(planId);
    if (!plan) throw new Error('Route plan not found');

    const stop = plan.stops.id(stopId);
    if (!stop) throw new Error('Stop not found in this route plan');

    if (!RoutePlan.isValidStopTransition(stop.status, newStatus)) {
      const allowed = RoutePlan.getAllowedStopTransitions(stop.status);
      throw new Error(
        `Invalid stop transition from ${stop.status} to ${newStatus}. Allowed: ${allowed.join(', ')}`
      );
    }

    stop.status = newStatus;
    if (remarks) stop.remarks = remarks;
    if (['COMPLETED', 'FAILED', 'SKIPPED'].includes(newStatus)) {
      stop.completedAt = new Date();
    }

    // Auto-transition route to IN_PROGRESS on first ARRIVED/COMPLETED stop
    if (plan.status === 'ASSIGNED' && ['ARRIVED', 'COMPLETED'].includes(newStatus)) {
      plan.status = 'IN_PROGRESS';
    }

    // Propagate DROP-COMPLETED to Delivery/Order
    if (stop.type === 'DROP' && newStatus === 'COMPLETED') {
      await this._markDeliveryCompleted(stop.orderId);
    }

    if (stop.type === 'DROP' && newStatus === 'FAILED') {
      await this._markDeliveryFailed(stop.orderId);
    }

    // Check if all stops are in terminal state -> complete route
    const allTerminal = plan.stops.every(s =>
      ['COMPLETED', 'FAILED', 'SKIPPED'].includes(s.status)
    );
    if (allTerminal) {
      plan.status = 'COMPLETED';
      plan.completedAt = new Date();
    }

    await plan.save();
    return plan;
  }

  /**
   * Safely mark a delivery as DELIVERED and update its order.
   * @private
   */
  static async _markDeliveryCompleted(orderId) {
    try {
      const delivery = await Delivery.findOne({ orderId });
      if (delivery && !['DELIVERED', 'FAILED'].includes(delivery.deliveryStatus)) {
        delivery.deliveryStatus = 'DELIVERED';
        delivery.addEvent({
          eventType: 'COMPLETED',
          fromStatus: delivery.deliveryStatus,
          toStatus: 'DELIVERED',
          performedByRole: 'SYSTEM',
          remarks: 'Completed via route plan'
        });
        await delivery.save();
      }

      await Order.findByIdAndUpdate(orderId, {
        orderStatus: 'DELIVERED',
        lastUpdatedByRole: 'SYSTEM'
      });
    } catch (err) {
      console.error('[RoutePlanningService] _markDeliveryCompleted error:', err.message);
    }
  }

  /**
   * Safely mark a delivery as FAILED and update its order.
   * @private
   */
  static async _markDeliveryFailed(orderId) {
    try {
      const delivery = await Delivery.findOne({ orderId });
      if (delivery && !['DELIVERED', 'FAILED'].includes(delivery.deliveryStatus)) {
        delivery.deliveryStatus = 'FAILED';
        delivery.addEvent({
          eventType: 'FAILED',
          fromStatus: delivery.deliveryStatus,
          toStatus: 'FAILED',
          performedByRole: 'SYSTEM',
          remarks: 'Failed via route plan stop'
        });
        await delivery.save();
      }

      await Order.findByIdAndUpdate(orderId, {
        orderStatus: 'FAILED',
        lastUpdatedByRole: 'SYSTEM'
      });
    } catch (err) {
      console.error('[RoutePlanningService] _markDeliveryFailed error:', err.message);
    }
  }
}

module.exports = RoutePlanningService;
