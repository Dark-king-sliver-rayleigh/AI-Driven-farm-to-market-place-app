import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store/index'
import { formatCurrency } from '../utils/units'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

export function OrderDetailTracker() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state } = useStore()

  const order = useMemo(() => state.orders.find((o) => o.id === id), [state.orders, id])
  const product = useMemo(
    () => (order ? state.products.find((p) => p.id === order.productId) : null),
    [state.products, order]
  )
  const logistics = useMemo(
    () => (order?.assignedLogisticsId
      ? state.logistics.find((l) => l.agentId === order.assignedLogisticsId)
      : null),
    [state.logistics, order]
  )

  if (!order) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-gray-600">Order not found.</p>
      </div>
    )
  }

  const productLocation = product?.location
  const logisticsLocation = logistics?.currentGeo

  // Mock SMS timeline if logistics position unavailable
  const smsTimeline = logisticsLocation
    ? []
    : [
        { timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), message: 'Order picked up' },
        { timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), message: 'En route to delivery location' },
      ]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-600 hover:text-gray-800 mb-4"
      >
        ← Back
      </button>

      <div className="bg-white rounded-lg shadow p-6 mb-4">
        <h1 className="text-2xl font-bold mb-4">Order Details</h1>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600">Product</div>
            <div className="font-medium">{product?.name || 'Product'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Status</div>
            <div className="font-medium">{order.status}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Quantity</div>
            <div className="font-medium">
              {order.quantity} {order.unit}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Total Price</div>
            <div className="font-medium">{formatCurrency(order.totalPrice, order.currency)}</div>
          </div>
          {order.escrowStatus && (
            <div>
              <div className="text-sm text-gray-600">Escrow Status</div>
              <div className="font-medium">{order.escrowStatus}</div>
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="bg-white rounded-lg shadow p-6 mb-4">
        <h2 className="text-lg font-semibold mb-4">Delivery Tracking</h2>
        {productLocation && (
          <div className="h-64 mb-4">
            <MapContainer
              center={[productLocation.lat || 12.9716, productLocation.lng || 77.5946]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <Marker position={[productLocation.lat, productLocation.lng]}>
                <Popup>Product Location</Popup>
              </Marker>
              {logisticsLocation && (
                <Marker position={[logisticsLocation.lat, logisticsLocation.lng]}>
                  <Popup>Delivery Agent</Popup>
                </Marker>
              )}
            </MapContainer>
          </div>
        )}
        {!logisticsLocation && logistics && (
          <div className="text-sm text-gray-600 mb-2">
            Last synced: {logistics.lastSyncedAt ? new Date(logistics.lastSyncedAt).toLocaleString() : 'N/A'}
          </div>
        )}
        {smsTimeline.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium mb-2">SMS Timeline</h3>
            <div className="space-y-2">
              {smsTimeline.map((sms, index) => (
                <div key={index} className="text-sm text-gray-600 border-l-2 border-blue-500 pl-2">
                  <div className="font-medium">{sms.message}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(sms.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delivery Audit */}
      {order.deliveryAudit && order.deliveryAudit.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Delivery Audit Trail</h2>
          <div className="space-y-4">
            {order.deliveryAudit.map((audit, index) => (
              <div key={index} className="border-l-2 border-green-500 pl-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{audit.eventType}</div>
                    <div className="text-sm text-gray-600">
                      {new Date(audit.timestamp).toLocaleString()}
                    </div>
                    {audit.agentId && (
                      <div className="text-xs text-gray-500">Agent: {audit.agentId}</div>
                    )}
                  </div>
                  {audit.photoUrl && (
                    <img
                      src={audit.photoUrl}
                      alt={`Audit ${index + 1}`}
                      className="w-20 h-20 object-cover rounded"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

