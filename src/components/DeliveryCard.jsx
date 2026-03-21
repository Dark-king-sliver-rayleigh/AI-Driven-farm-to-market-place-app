import { Link } from 'react-router-dom'
import { getStatusDisplay, formatDistance, calculateDistance } from '../utils/logisticsHelpers'

/**
 * DeliveryCard component
 * Large, touch-friendly card for delivery drivers
 */
export function DeliveryCard({ order, product, farmer, consumer, driverLocation }) {
  const status = getStatusDisplay(order.status)
  
  // Calculate distances
  const pickupDistance = driverLocation && order.pickupLocation
    ? calculateDistance(
        driverLocation.lat,
        driverLocation.lng,
        order.pickupLocation.lat,
        order.pickupLocation.lng
      )
    : null

  const dropDistance = order.pickupLocation && order.dropLocation
    ? calculateDistance(
        order.pickupLocation.lat,
        order.pickupLocation.lng,
        order.dropLocation.lat,
        order.dropLocation.lng
      )
    : null

  // Determine which screen to navigate to based on status
  const getActionUrl = () => {
    switch (order.status) {
      case 'PENDING_ASSIGNMENT':
      case 'ACCEPTED':
      case 'AT_PICKUP':
        return `/logistics/pickup/${order.id}`
      case 'PICKED_UP':
      case 'IN_TRANSIT':
        return `/logistics/delivery/${order.id}`
      default:
        return `/logistics/delivery/${order.id}`
    }
  }

  return (
    <Link
      to={getActionUrl()}
      className="block bg-white rounded-xl shadow-md border-l-4 p-4 active:bg-gray-50 transition-colors"
      style={{ borderLeftColor: order.status === 'PENDING_ASSIGNMENT' ? '#EAB308' : order.status === 'IN_TRANSIT' ? '#F97316' : '#3B82F6' }}
    >
      {/* Header: Order ID + Status */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500">#{order.id.slice(-6).toUpperCase()}</span>
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${status.bgColor} ${status.color}`}>
          {status.label}
        </span>
      </div>

      {/* Pickup Location */}
      <div className="flex items-start gap-3 mb-2">
        <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">
            {farmer?.name || 'Farmer'}
          </div>
          <div className="text-xs text-gray-500 truncate">
            {order.pickupLocation?.address || product?.location?.address || 'Pickup location'}
          </div>
        </div>
        {pickupDistance && (
          <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
            {formatDistance(pickupDistance)}
          </span>
        )}
      </div>

      {/* Arrow */}
      <div className="ml-3 border-l-2 border-dashed border-gray-200 h-4" />

      {/* Drop Location */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">
            {consumer?.name || 'Consumer'}
          </div>
          <div className="text-xs text-gray-500 truncate">
            {order.dropLocation?.address || consumer?.defaultAddress?.address || 'Drop location'}
          </div>
        </div>
        {dropDistance && (
          <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
            {formatDistance(dropDistance)}
          </span>
        )}
      </div>

      {/* Footer: Product + Payment */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="text-sm text-gray-600">
          <span className="font-medium">{product?.name || 'Product'}</span>
          <span className="text-gray-400 mx-1">•</span>
          <span>{order.quantity} {order.unit}</span>
        </div>
      </div>
    </Link>
  )
}
