import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import { useStore } from '../store/index'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix for default marker icons in React Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

/**
 * Map tracker component for viewing logistics pickup and delivery status
 * Shows real-time location of delivery agent and route
 */
export function MapTracker() {
  const { state } = useStore()
  const currentUser = state.ui.currentUser

  const farmerOrders = state.orders.filter(
    o => {
      const product = state.products.find(p => p.id === o.productId)
      return product?.farmerId === currentUser?.id && o.assignedLogisticsId
    }
  )

  const [selectedOrder, setSelectedOrder] = useState(
    farmerOrders.length > 0 ? farmerOrders[0] : null
  )
  const [agentLocation, setAgentLocation] = useState(null)

  // Mock real-time location updates
  useEffect(() => {
    if (!selectedOrder) return

    // Simulate agent location (in production, this would come from GPS/WSS)
    const product = state.products.find(p => p.id === selectedOrder.productId)
    if (product?.location) {
      // Simulate agent moving from farm to a delivery location
      const farmLocation = [product.location.lat, product.location.lng]
      const deliveryLocation = [12.9352, 77.6245] // Mock delivery location

      // Start at farm
      setAgentLocation(farmLocation)

      // Simulate movement
      const interval = setInterval(() => {
        setAgentLocation(prev => {
          if (!prev) return farmLocation
          const [lat, lng] = prev
          const targetLat = deliveryLocation[0]
          const targetLng = deliveryLocation[1]

          // Move 10% closer to target each update
          const newLat = lat + (targetLat - lat) * 0.1
          const newLng = lng + (targetLng - lng) * 0.1

          // Stop when close enough
          if (Math.abs(newLat - targetLat) < 0.001 && Math.abs(newLng - targetLng) < 0.001) {
            clearInterval(interval)
            return deliveryLocation
          }

          return [newLat, newLng]
        })
      }, 2000)

      return () => clearInterval(interval)
    }
  }, [selectedOrder, state.products])

  if (farmerOrders.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
        No orders with assigned logistics yet. Orders will appear here once logistics are assigned.
      </div>
    )
  }

  const product = selectedOrder
    ? state.products.find(p => p.id === selectedOrder.productId)
    : null

  const center = product?.location
    ? [product.location.lat, product.location.lng]
    : [12.9716, 77.5946] // Default to Bangalore

  const route = agentLocation && product?.location
    ? [
        [product.location.lat, product.location.lng], // Farm
        agentLocation, // Current agent location
        [12.9352, 77.6245], // Delivery destination (mock)
      ]
    : []

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Track Logistics</h1>
        <p className="text-gray-600 mt-2">
          Monitor real-time pickup and delivery status
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Selection */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-lg font-semibold mb-4">Active Orders</h2>
            <div className="space-y-2">
              {farmerOrders.map((order) => {
                const prod = state.products.find(p => p.id === order.productId)
                return (
                  <button
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className={`w-full text-left p-3 rounded border ${
                      selectedOrder?.id === order.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-sm">{prod?.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Status: {order.status}
                    </div>
                  </button>
                )
              })}
            </div>

            {selectedOrder && (
              <div className="mt-4 p-3 bg-gray-50 rounded">
                <div className="text-sm font-medium mb-2">Order Details</div>
                <div className="text-xs space-y-1">
                  <div>
                    <span className="font-medium">Order ID:</span> {selectedOrder.id}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span> {selectedOrder.status}
                  </div>
                  <div>
                    <span className="font-medium">Logistics ID:</span>{' '}
                    {selectedOrder.assignedLogisticsId || 'Not assigned'}
                  </div>
                  {agentLocation && (
                    <div className="mt-2 pt-2 border-t">
                      <div className="font-medium">Agent Location:</div>
                      <div className="text-xs">
                        {agentLocation[0].toFixed(6)}, {agentLocation[1].toFixed(6)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md overflow-hidden" style={{ height: '600px' }}>
            <MapContainer
              center={center}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Farm location marker */}
              {product?.location && (
                <Marker position={[product.location.lat, product.location.lng]}>
                  <Popup>
                    <div>
                      <strong>Farm Location</strong>
                      <br />
                      {product.location.address}
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Agent location marker */}
              {agentLocation && (
                <Marker
                  position={agentLocation}
                  icon={L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                  })}
                >
                  <Popup>
                    <div>
                      <strong>Delivery Agent</strong>
                      <br />
                      Real-time location
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Route polyline */}
              {route.length > 1 && (
                <Polyline
                  positions={route}
                  color="blue"
                  weight={3}
                  opacity={0.7}
                />
              )}
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

