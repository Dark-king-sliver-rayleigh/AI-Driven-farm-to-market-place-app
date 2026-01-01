import { useState } from 'react'
import { useStore } from '../store/index'
import { DeliveryCard } from '../components/DeliveryCard'
import { OfflineBanner } from '../components/OfflineBanner'
import { sortByPriority } from '../utils/logisticsHelpers'

/**
 * Logistics Dashboard - Main screen for delivery partners
 * Shows today's assigned deliveries with priority sorting
 */
export function LogisticsDashboard() {
  const { state } = useStore()
  const currentUser = state.ui.currentUser
  const [activeFilter, setActiveFilter] = useState('all')

  // Get driver's current location (mock for demo)
  const driverLocation = state.logistics.find(l => l.agentId === currentUser?.id)?.currentGeo || {
    lat: 12.9716,
    lng: 77.5946,
  }

  // Filter orders assigned to this driver or pending assignment
  const logisticsOrders = state.orders.filter(order => {
    // For demo: show all orders with logistics-relevant statuses
    const isAssignedToMe = order.assignedLogisticsId === currentUser?.id
    const isPendingAssignment = order.status === 'PENDING_ASSIGNMENT' || order.status === 'ACCEPTED'
    const isInProgress = ['AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT'].includes(order.status)
    const isCompleted = ['DELIVERED', 'FAILED'].includes(order.status)
    
    return isAssignedToMe || isPendingAssignment || isInProgress || isCompleted
  })

  // Apply filter
  const filteredOrders = logisticsOrders.filter(order => {
    switch (activeFilter) {
      case 'pending':
        return ['PENDING_ASSIGNMENT', 'ACCEPTED'].includes(order.status)
      case 'active':
        return ['AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT'].includes(order.status)
      case 'completed':
        return ['DELIVERED', 'FAILED'].includes(order.status)
      default:
        return true
    }
  })

  // Sort by priority
  const sortedOrders = sortByPriority(filteredOrders, driverLocation)

  // Get related data for each order
  const getOrderData = (order) => {
    const product = state.products.find(p => p.id === order.productId)
    const farmer = state.farmers.find(f => f.id === product?.farmerId) || 
                   state.users.find(u => u.id === product?.farmerId)
    const consumer = state.users.find(u => u.id === order.consumerId)
    return { product, farmer, consumer }
  }

  const filters = [
    { id: 'all', label: 'All', count: logisticsOrders.length },
    { id: 'pending', label: 'Pending', count: logisticsOrders.filter(o => ['PENDING_ASSIGNMENT', 'ACCEPTED'].includes(o.status)).length },
    { id: 'active', label: 'Active', count: logisticsOrders.filter(o => ['AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT'].includes(o.status)).length },
    { id: 'completed', label: 'Done', count: logisticsOrders.filter(o => ['DELIVERED', 'FAILED'].includes(o.status)).length },
  ]

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <OfflineBanner />
      
      {/* Header */}
      <div className="bg-purple-600 text-white px-4 py-6">
        <h1 className="text-xl font-bold">Today's Deliveries</h1>
        <p className="text-purple-200 text-sm mt-1">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="flex">
          {filters.map(filter => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
                activeFilter === filter.id
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {filter.label}
              <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                activeFilter === filter.id ? 'bg-purple-100' : 'bg-gray-100'
              }`}>
                {filter.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Delivery List */}
      <div className="p-4 space-y-3">
        {sortedOrders.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No deliveries</h3>
            <p className="text-gray-500 text-sm">
              {activeFilter === 'all' 
                ? 'No deliveries assigned yet. Check back soon!'
                : `No ${activeFilter} deliveries right now.`}
            </p>
          </div>
        ) : (
          sortedOrders.map(order => {
            const { product, farmer, consumer } = getOrderData(order)
            return (
              <DeliveryCard
                key={order.id}
                order={order}
                product={product}
                farmer={farmer}
                consumer={consumer}
                driverLocation={driverLocation}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
