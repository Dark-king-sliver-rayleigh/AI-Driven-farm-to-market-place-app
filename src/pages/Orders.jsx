import { useState } from 'react'
import { useStore } from '../store/index'
import { updateOrder } from '../store/actions'
import { NegotiationChat } from '../components/NegotiationChat'
import { formatCurrency } from '../utils/units'

/**
 * Orders page for farmers to view and manage customer orders
 * Supports accept/reject and negotiation chat
 */
export function Orders() {
  const { state, dispatch } = useStore()
  const currentUser = state.ui.currentUser

  const farmerProducts = state.products
    .filter(p => p.farmerId === currentUser?.id)
    .map(p => p.id)

  const orders = state.orders.filter(o => farmerProducts.includes(o.productId))
  const [selectedOrder, setSelectedOrder] = useState(null)

  const handleAccept = (order) => {
    dispatch(updateOrder({ ...order, status: 'ACCEPTED' }))
  }

  const handleReject = (order) => {
    if (window.confirm('Are you sure you want to reject this order?')) {
      dispatch(updateOrder({ ...order, status: 'REJECTED' }))
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'ACCEPTED':
        return 'bg-green-100 text-green-800'
      case 'REJECTED':
        return 'bg-red-100 text-red-800'
      case 'PICKED_UP':
        return 'bg-blue-100 text-blue-800'
      case 'DELIVERED':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
        No orders yet. Your orders will appear here when customers place them.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Customer Orders</h1>
        <p className="text-gray-600 mt-2">
          Manage and respond to orders from consumers
        </p>
      </div>

      <div className="grid gap-4">
        {orders.map((order) => {
          const product = state.products.find(p => p.id === order.productId)
          const consumer = state.farmers.find(f => f.id === order.consumerId) || {
            name: 'Consumer',
            phone: 'N/A',
          }

          return (
            <div
              key={order.id}
              className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {product?.name || 'Product'}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Order ID: {order.id}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                    order.status
                  )}`}
                >
                  {order.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm font-medium text-gray-700">Consumer</div>
                  <div className="text-sm text-gray-900">{consumer.name}</div>
                  <div className="text-xs text-gray-500">{consumer.phone}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700">Quantity</div>
                  <div className="text-sm text-gray-900">
                    {order.quantity} {order.unit}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700">Total Price</div>
                  <div className="text-sm text-gray-900 font-semibold">
                    {formatCurrency(order.totalPrice, order.currency)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700">Order Date</div>
                  <div className="text-sm text-gray-900">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {order.negotiation && order.negotiation.length > 0 && (
                <div className="mb-4 p-3 bg-gray-50 rounded">
                  <div className="text-sm font-medium text-gray-700 mb-1">
                    Recent Negotiation:
                  </div>
                  <div className="text-sm text-gray-600">
                    {order.negotiation[order.negotiation.length - 1].message}
                  </div>
                </div>
              )}

              {/* Escrow Status */}
              {order.escrowStatus && (
                <div className="mb-2">
                  <span className={`px-2 py-1 text-xs font-semibold rounded ${
                    order.escrowStatus === 'HELD' ? 'bg-blue-100 text-blue-800' :
                    order.escrowStatus === 'RELEASED' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    Escrow: {order.escrowStatus}
                  </span>
                </div>
              )}

              {/* Logistics Info */}
              {order.assignedLogisticsId && (
                <div className="mb-2 text-sm text-gray-600">
                  <span className="font-medium">Logistics Agent:</span> {order.assignedLogisticsId}
                  {order.routeId && <span className="ml-2">Route: {order.routeId}</span>}
                </div>
              )}

              {/* Delivery Audit Preview */}
              {order.deliveryAudit && order.deliveryAudit.length > 0 && (
                <div className="mb-2 text-sm">
                  <span className="font-medium">Delivery Updates:</span> {order.deliveryAudit.length} event{order.deliveryAudit.length !== 1 ? 's' : ''}
                </div>
              )}

              <div className="flex gap-2">
                {order.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => handleAccept(order)}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Accept Order
                    </button>
                    <button
                      onClick={() => handleReject(order)}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      Reject Order
                    </button>
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Negotiate
                    </button>
                  </>
                )}
                {order.status === 'ACCEPTED' && (
                  <button
                    onClick={() => setSelectedOrder(order)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    View Chat
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {selectedOrder && (
        <NegotiationChat
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  )
}

