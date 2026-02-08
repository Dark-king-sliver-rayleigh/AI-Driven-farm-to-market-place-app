/**
 * Logistics helper utilities
 * Provides distance calculation, sorting, and navigation integration
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
export function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371 // Earth's radius in km
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg) {
  return deg * (Math.PI / 180)
}

/**
 * Format distance for display
 * @param {number} km - Distance in kilometers
 * @returns {string} Formatted distance string
 */
export function formatDistance(km) {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`
  }
  return `${km.toFixed(1)} km`
}

/**
 * Get navigation URL for driving directions.
 * Uses a generic geo: URI that works on mobile, and falls back
 * to OpenStreetMap directions on desktop browsers.
 * @param {number} lat - Destination latitude
 * @param {number} lng - Destination longitude
 * @returns {string} Navigation deep link URL
 */
export function getNavigationUrl(lat, lng) {
  // On mobile devices the geo: URI opens the default map app
  if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
    return `geo:${lat},${lng}?q=${lat},${lng}`;
  }
  // Desktop fallback – OpenStreetMap directions
  return `https://www.openstreetmap.org/directions?route=;;${lat},${lng}`;
}

/**
 * Get tel: link for calling
 * @param {string} phone - Phone number
 * @returns {string} Tel URL
 */
export function getTelUrl(phone) {
  return `tel:${phone.replace(/\s/g, '')}`
}

/**
 * Delivery status priority for sorting (lower = higher priority)
 */
const STATUS_PRIORITY = {
  PENDING_ASSIGNMENT: 0,
  ACCEPTED: 1,
  AT_PICKUP: 2,
  PICKED_UP: 3,
  IN_TRANSIT: 4,
  DELIVERED: 10,
  FAILED: 10,
  REJECTED: 11,
}

/**
 * Sort orders by priority: nearest pickup first, then by status
 * @param {Array} orders - Array of orders
 * @param {Object} driverLocation - { lat, lng } of driver
 * @returns {Array} Sorted orders
 */
export function sortByPriority(orders, driverLocation) {
  return [...orders].sort((a, b) => {
    // First sort by status priority
    const statusA = STATUS_PRIORITY[a.status] ?? 5
    const statusB = STATUS_PRIORITY[b.status] ?? 5
    if (statusA !== statusB) return statusA - statusB

    // Then by distance to pickup
    if (driverLocation && a.pickupLocation && b.pickupLocation) {
      const distA = calculateDistance(
        driverLocation.lat,
        driverLocation.lng,
        a.pickupLocation.lat,
        a.pickupLocation.lng
      )
      const distB = calculateDistance(
        driverLocation.lat,
        driverLocation.lng,
        b.pickupLocation.lat,
        b.pickupLocation.lng
      )
      return distA - distB
    }

    return 0
  })
}

/**
 * Get status display info
 * @param {string} status - Order status
 * @returns {Object} { label, color, bgColor }
 */
export function getStatusDisplay(status) {
  const statusMap = {
    PENDING_ASSIGNMENT: { label: 'Pending', color: 'text-yellow-800', bgColor: 'bg-yellow-100' },
    ACCEPTED: { label: 'Accepted', color: 'text-blue-800', bgColor: 'bg-blue-100' },
    AT_PICKUP: { label: 'At Pickup', color: 'text-purple-800', bgColor: 'bg-purple-100' },
    PICKED_UP: { label: 'Picked Up', color: 'text-indigo-800', bgColor: 'bg-indigo-100' },
    IN_TRANSIT: { label: 'In Transit', color: 'text-orange-800', bgColor: 'bg-orange-100' },
    DELIVERED: { label: 'Delivered', color: 'text-green-800', bgColor: 'bg-green-100' },
    FAILED: { label: 'Failed', color: 'text-red-800', bgColor: 'bg-red-100' },
    REJECTED: { label: 'Rejected', color: 'text-gray-800', bgColor: 'bg-gray-100' },
  }
  return statusMap[status] || { label: status, color: 'text-gray-800', bgColor: 'bg-gray-100' }
}

/**
 * Rejection reasons
 */
export const REJECTION_REASONS = [
  { id: 'DISTANCE', label: 'Too far away' },
  { id: 'VEHICLE_ISSUE', label: 'Vehicle issue' },
  { id: 'UNAVAILABLE', label: 'Not available' },
]

/**
 * Delivery failure reasons
 */
export const FAILURE_REASONS = [
  { id: 'CUSTOMER_ABSENT', label: 'Customer not available' },
  { id: 'ADDRESS_ISSUE', label: 'Address not found' },
  { id: 'OTHER', label: 'Other issue' },
]
