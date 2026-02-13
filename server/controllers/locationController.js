const User = require('../models/User');

/**
 * Location Controller
 * 
 * Handles location management for all user roles:
 * - Farmers: Pickup point CRUD
 * - Consumers: Delivery address CRUD
 * - Drivers: Real-time location updates, availability toggle
 * - Smart driver assignment based on proximity
 */

// ============================================
// DISTANCE UTILITIES
// ============================================

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {Object} coord1 - { lat, lng }
 * @param {Object} coord2 - { lat, lng }
 * @returns {number} Distance in kilometers
 */
function haversineDistanceKm(coord1, coord2) {
  const R = 6371; // Earth's radius in km
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================
// PRIMARY LOCATION (All Roles)
// ============================================

/**
 * @desc    Update user's primary location
 * @route   PATCH /api/location/primary
 * @access  Private (all roles)
 */
const updatePrimaryLocation = async (req, res) => {
  try {
    const { address, lat, lng } = req.body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ success: false, message: 'Valid latitude and longitude are required' });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ success: false, message: 'Coordinates out of valid range' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        location: {
          address: address || '',
          coordinates: { lat, lng },
          updatedAt: new Date()
        }
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Primary location updated',
      location: user.location
    });
  } catch (error) {
    console.error('Update primary location error:', error);
    res.status(500).json({ success: false, message: 'Server error updating location' });
  }
};

/**
 * @desc    Get user's primary location
 * @route   GET /api/location/primary
 * @access  Private
 */
const getPrimaryLocation = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('location');
    res.status(200).json({ success: true, location: user.location || null });
  } catch (error) {
    console.error('Get primary location error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ============================================
// FARMER PICKUP LOCATIONS
// ============================================

/**
 * @desc    Add a pickup location for farmer
 * @route   POST /api/location/pickup
 * @access  Private (FARMER only)
 */
const addPickupLocation = async (req, res) => {
  try {
    const { label, address, lat, lng, isDefault } = req.body;

    if (!address) {
      return res.status(400).json({ success: false, message: 'Address is required' });
    }
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ success: false, message: 'Valid latitude and longitude are required' });
    }

    const user = await User.findById(req.user._id);

    // If this is marked as default, unset other defaults
    if (isDefault) {
      user.pickupLocations.forEach(loc => { loc.isDefault = false; });
    }

    // If this is the first location, make it default
    const makeDefault = isDefault || user.pickupLocations.length === 0;

    user.pickupLocations.push({
      label: label || 'Farm',
      address,
      coordinates: { lat, lng },
      isDefault: makeDefault,
      createdAt: new Date()
    });

    // Also update primary location if no primary set
    if (!user.location || !user.location.coordinates || !user.location.coordinates.lat) {
      user.location = {
        address,
        coordinates: { lat, lng },
        updatedAt: new Date()
      };
    }

    await user.save();

    res.status(201).json({
      success: true,
      message: 'Pickup location added',
      pickupLocations: user.pickupLocations
    });
  } catch (error) {
    console.error('Add pickup location error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get all pickup locations for farmer
 * @route   GET /api/location/pickup
 * @access  Private (FARMER only)
 */
const getPickupLocations = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('pickupLocations');
    res.status(200).json({
      success: true,
      pickupLocations: user.pickupLocations || []
    });
  } catch (error) {
    console.error('Get pickup locations error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Update a pickup location
 * @route   PATCH /api/location/pickup/:locationId
 * @access  Private (FARMER only)
 */
const updatePickupLocation = async (req, res) => {
  try {
    const { locationId } = req.params;
    const { label, address, lat, lng, isDefault } = req.body;

    const user = await User.findById(req.user._id);
    const location = user.pickupLocations.id(locationId);

    if (!location) {
      return res.status(404).json({ success: false, message: 'Pickup location not found' });
    }

    if (label !== undefined) location.label = label;
    if (address !== undefined) location.address = address;
    if (typeof lat === 'number' && typeof lng === 'number') {
      location.coordinates = { lat, lng };
    }
    if (isDefault) {
      user.pickupLocations.forEach(loc => { loc.isDefault = false; });
      location.isDefault = true;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Pickup location updated',
      pickupLocations: user.pickupLocations
    });
  } catch (error) {
    console.error('Update pickup location error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Delete a pickup location
 * @route   DELETE /api/location/pickup/:locationId
 * @access  Private (FARMER only)
 */
const deletePickupLocation = async (req, res) => {
  try {
    const { locationId } = req.params;
    const user = await User.findById(req.user._id);

    const location = user.pickupLocations.id(locationId);
    if (!location) {
      return res.status(404).json({ success: false, message: 'Pickup location not found' });
    }

    location.deleteOne();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Pickup location deleted',
      pickupLocations: user.pickupLocations
    });
  } catch (error) {
    console.error('Delete pickup location error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ============================================
// CONSUMER DELIVERY ADDRESSES
// ============================================

/**
 * @desc    Add a delivery address for consumer
 * @route   POST /api/location/delivery-address
 * @access  Private (CONSUMER only)
 */
const addDeliveryAddress = async (req, res) => {
  try {
    const { label, address, lat, lng, isDefault } = req.body;

    if (!address) {
      return res.status(400).json({ success: false, message: 'Address is required' });
    }
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ success: false, message: 'Valid latitude and longitude are required' });
    }

    const user = await User.findById(req.user._id);

    if (isDefault) {
      user.deliveryAddresses.forEach(addr => { addr.isDefault = false; });
    }

    const makeDefault = isDefault || user.deliveryAddresses.length === 0;

    user.deliveryAddresses.push({
      label: label || 'Home',
      address,
      coordinates: { lat, lng },
      isDefault: makeDefault,
      createdAt: new Date()
    });

    // Also update primary location
    if (!user.location || !user.location.coordinates || !user.location.coordinates.lat) {
      user.location = {
        address,
        coordinates: { lat, lng },
        updatedAt: new Date()
      };
    }

    await user.save();

    res.status(201).json({
      success: true,
      message: 'Delivery address added',
      deliveryAddresses: user.deliveryAddresses
    });
  } catch (error) {
    console.error('Add delivery address error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get all delivery addresses for consumer
 * @route   GET /api/location/delivery-address
 * @access  Private (CONSUMER only)
 */
const getDeliveryAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('deliveryAddresses');
    res.status(200).json({
      success: true,
      deliveryAddresses: user.deliveryAddresses || []
    });
  } catch (error) {
    console.error('Get delivery addresses error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Update a delivery address
 * @route   PATCH /api/location/delivery-address/:addressId
 * @access  Private (CONSUMER only)
 */
const updateDeliveryAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const { label, address, lat, lng, isDefault } = req.body;

    const user = await User.findById(req.user._id);
    const addr = user.deliveryAddresses.id(addressId);

    if (!addr) {
      return res.status(404).json({ success: false, message: 'Delivery address not found' });
    }

    if (label !== undefined) addr.label = label;
    if (address !== undefined) addr.address = address;
    if (typeof lat === 'number' && typeof lng === 'number') {
      addr.coordinates = { lat, lng };
    }
    if (isDefault) {
      user.deliveryAddresses.forEach(a => { a.isDefault = false; });
      addr.isDefault = true;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Delivery address updated',
      deliveryAddresses: user.deliveryAddresses
    });
  } catch (error) {
    console.error('Update delivery address error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Delete a delivery address
 * @route   DELETE /api/location/delivery-address/:addressId
 * @access  Private (CONSUMER only)
 */
const deleteDeliveryAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user._id);

    const addr = user.deliveryAddresses.id(addressId);
    if (!addr) {
      return res.status(404).json({ success: false, message: 'Delivery address not found' });
    }

    addr.deleteOne();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Delivery address deleted',
      deliveryAddresses: user.deliveryAddresses
    });
  } catch (error) {
    console.error('Delete delivery address error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ============================================
// DRIVER LOCATION & AVAILABILITY
// ============================================

/**
 * @desc    Update driver's current location (real-time GPS)
 * @route   POST /api/location/driver/current
 * @access  Private (LOGISTICS only)
 */
const updateDriverCurrentLocation = async (req, res) => {
  try {
    const { lat, lng, heading } = req.body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ success: false, message: 'Valid latitude and longitude are required' });
    }

    const updateData = {
      'currentLocation.coordinates.lat': lat,
      'currentLocation.coordinates.lng': lng,
      'currentLocation.updatedAt': new Date()
    };
    if (typeof heading === 'number') {
      updateData['currentLocation.heading'] = heading;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true }
    );

    res.status(200).json({
      success: true,
      currentLocation: user.currentLocation
    });
  } catch (error) {
    console.error('Update driver location error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Toggle driver availability
 * @route   PATCH /api/location/driver/availability
 * @access  Private (LOGISTICS only)
 */
const toggleDriverAvailability = async (req, res) => {
  try {
    const { isAvailable } = req.body;

    if (typeof isAvailable !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isAvailable must be a boolean' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { isAvailable },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: `Driver is now ${isAvailable ? 'available' : 'unavailable'}`,
      isAvailable: user.isAvailable
    });
  } catch (error) {
    console.error('Toggle availability error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get driver's current location and availability
 * @route   GET /api/location/driver/status
 * @access  Private (LOGISTICS only)
 */
const getDriverStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('isAvailable currentLocation vehicleType loadCapacity serviceArea');

    res.status(200).json({
      success: true,
      status: {
        isAvailable: user.isAvailable,
        currentLocation: user.currentLocation || null,
        vehicleType: user.vehicleType,
        loadCapacity: user.loadCapacity,
        serviceArea: user.serviceArea
      }
    });
  } catch (error) {
    console.error('Get driver status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ============================================
// SMART DRIVER ASSIGNMENT
// ============================================

/**
 * @desc    Find nearest available drivers for an order
 * @route   POST /api/location/find-drivers
 * @access  Private (FARMER, CONSUMER, LOGISTICS)
 * 
 * Body: { pickupLat, pickupLng, deliveryLat, deliveryLng, maxDistanceKm? }
 */
const findNearestDrivers = async (req, res) => {
  try {
    const { pickupLat, pickupLng, deliveryLat, deliveryLng, maxDistanceKm = 50 } = req.body;

    if (typeof pickupLat !== 'number' || typeof pickupLng !== 'number') {
      return res.status(400).json({ success: false, message: 'Valid pickup coordinates are required' });
    }

    // Find all available logistics drivers with current location
    const drivers = await User.find({
      role: 'LOGISTICS',
      isAvailable: true,
      'currentLocation.coordinates.lat': { $exists: true, $ne: null }
    }).select('name phone vehicleType loadCapacity currentLocation serviceArea');

    // Calculate distances and score each driver
    const pickup = { lat: pickupLat, lng: pickupLng };
    const delivery = deliveryLat && deliveryLng
      ? { lat: deliveryLat, lng: deliveryLng }
      : null;

    const scoredDrivers = drivers
      .map(driver => {
        const driverLoc = {
          lat: driver.currentLocation.coordinates.lat,
          lng: driver.currentLocation.coordinates.lng
        };

        const distanceToPickup = haversineDistanceKm(driverLoc, pickup);
        const pickupToDelivery = delivery ? haversineDistanceKm(pickup, delivery) : 0;
        const totalDistance = distanceToPickup + pickupToDelivery;

        // Estimated cost: ₹10/km base + ₹5/km after 5km
        const baseCost = Math.min(distanceToPickup, 5) * 10;
        const extraCost = Math.max(0, distanceToPickup - 5) * 5;
        const estimatedCost = Math.round(baseCost + extraCost + pickupToDelivery * 8);

        // Estimated time: avg 30 km/h in city
        const estimatedTimeMin = Math.round((totalDistance / 30) * 60);

        return {
          driverId: driver._id,
          name: driver.name,
          phone: driver.phone,
          vehicleType: driver.vehicleType,
          loadCapacity: driver.loadCapacity,
          currentLocation: driverLoc,
          distanceToPickupKm: Math.round(distanceToPickup * 10) / 10,
          totalDistanceKm: Math.round(totalDistance * 10) / 10,
          estimatedCost,
          estimatedTimeMin,
          // Score: lower is better (weighted distance + time)
          score: distanceToPickup * 1.0 + estimatedTimeMin * 0.1
        };
      })
      .filter(d => d.distanceToPickupKm <= maxDistanceKm)
      .sort((a, b) => a.score - b.score);

    res.status(200).json({
      success: true,
      count: scoredDrivers.length,
      drivers: scoredDrivers,
      assignmentLogic: {
        algorithm: 'Proximity-weighted scoring',
        factors: ['Distance to pickup (primary)', 'Estimated total time', 'Vehicle capacity'],
        maxDistanceKm
      }
    });
  } catch (error) {
    console.error('Find nearest drivers error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get farmer's location for a specific order (for consumers)
 * @route   GET /api/location/order/:orderId/origin
 * @access  Private (CONSUMER, LOGISTICS)
 */
const getOrderOriginLocation = async (req, res) => {
  try {
    const Order = require('../models/Order');
    const { orderId } = req.params;

    const order = await Order.findById(orderId).populate('farmerId', 'name pickupLocations location');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check authorization
    const userId = req.user._id.toString();
    const isConsumer = order.consumerId.toString() === userId;
    const isLogistics = req.user.role === 'LOGISTICS';
    if (!isConsumer && !isLogistics) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const farmer = order.farmerId;
    const pickupLocation = order.pickupLocation ||
      farmer.pickupLocations?.find(l => l.isDefault) ||
      farmer.pickupLocations?.[0] ||
      (farmer.location?.coordinates?.lat ? farmer.location : null);

    res.status(200).json({
      success: true,
      farmerName: farmer.name,
      pickupLocation: pickupLocation || null,
      deliveryAddress: order.deliveryAddress || null
    });
  } catch (error) {
    console.error('Get order origin error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  updatePrimaryLocation,
  getPrimaryLocation,
  addPickupLocation,
  getPickupLocations,
  updatePickupLocation,
  deletePickupLocation,
  addDeliveryAddress,
  getDeliveryAddresses,
  updateDeliveryAddress,
  deleteDeliveryAddress,
  updateDriverCurrentLocation,
  toggleDriverAvailability,
  getDriverStatus,
  findNearestDrivers,
  getOrderOriginLocation,
  haversineDistanceKm
};
