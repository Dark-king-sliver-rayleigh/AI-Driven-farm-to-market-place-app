const express = require('express');
const router = express.Router();
const {
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
  getOrderOriginLocation
} = require('../controllers/locationController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

/**
 * Location Routes
 * 
 * Manages location data for all user roles:
 * 
 * ALL ROLES:
 *   GET    /api/location/primary          - Get primary location
 *   PATCH  /api/location/primary          - Update primary location
 * 
 * FARMER:
 *   GET    /api/location/pickup           - Get all pickup locations
 *   POST   /api/location/pickup           - Add pickup location
 *   PATCH  /api/location/pickup/:id       - Update pickup location
 *   DELETE /api/location/pickup/:id       - Delete pickup location
 * 
 * CONSUMER:
 *   GET    /api/location/delivery-address          - Get all delivery addresses
 *   POST   /api/location/delivery-address          - Add delivery address
 *   PATCH  /api/location/delivery-address/:id      - Update delivery address
 *   DELETE /api/location/delivery-address/:id      - Delete delivery address
 * 
 * LOGISTICS:
 *   POST   /api/location/driver/current            - Update current GPS location
 *   PATCH  /api/location/driver/availability       - Toggle availability
 *   GET    /api/location/driver/status              - Get status & location
 * 
 * SHARED:
 *   POST   /api/location/find-drivers               - Find nearest drivers
 *   GET    /api/location/order/:orderId/origin       - Get order origin location
 */

// All routes require authentication
router.use(authenticateUser);

// === PRIMARY LOCATION (All Roles) ===
router.get('/primary', getPrimaryLocation);
router.patch('/primary', updatePrimaryLocation);

// === FARMER PICKUP LOCATIONS ===
router.get('/pickup', authorizeRoles('FARMER'), getPickupLocations);
router.post('/pickup', authorizeRoles('FARMER'), addPickupLocation);
router.patch('/pickup/:locationId', authorizeRoles('FARMER'), updatePickupLocation);
router.delete('/pickup/:locationId', authorizeRoles('FARMER'), deletePickupLocation);

// === CONSUMER DELIVERY ADDRESSES ===
router.get('/delivery-address', authorizeRoles('CONSUMER'), getDeliveryAddresses);
router.post('/delivery-address', authorizeRoles('CONSUMER'), addDeliveryAddress);
router.patch('/delivery-address/:addressId', authorizeRoles('CONSUMER'), updateDeliveryAddress);
router.delete('/delivery-address/:addressId', authorizeRoles('CONSUMER'), deleteDeliveryAddress);

// === DRIVER LOCATION & AVAILABILITY ===
router.post('/driver/current', authorizeRoles('LOGISTICS'), updateDriverCurrentLocation);
router.patch('/driver/availability', authorizeRoles('LOGISTICS'), toggleDriverAvailability);
router.get('/driver/status', authorizeRoles('LOGISTICS'), getDriverStatus);

// === SMART DRIVER ASSIGNMENT ===
router.post('/find-drivers', findNearestDrivers);

// === ORDER ORIGIN LOCATION ===
router.get('/order/:orderId/origin', getOrderOriginLocation);

module.exports = router;
