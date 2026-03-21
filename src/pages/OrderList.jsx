import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/index'
import { formatCurrency } from '../utils/units'

export function OrderList() {
  const { state } = useStore()
  const navigate = useNavigate()

  const orders = useMemo(() => {
    return state.orders.filter(
      (o) => o.consumerId === state.ui.currentUser?.id
    )
  }, [state.orders, state.ui.currentUser])

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
      case 'OUT_FOR_DELIVERY':
        return 'bg-purple-100 text-purple-800'
      case 'DELIVERED':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (orders.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-4">My Orders</h1>
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No orders yet. Start shopping!
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-4">My Orders</h1>
      <div className="space-y-4">
        {orders.map((order) => {
          const product = state.products.find((p) => p.id === order.productId)
          return (
            <div
              key={order.id}
              className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{product?.name || 'Product'}</h3>
                  <p className="text-sm text-gray-600">Order ID: {order.id}</p>
                </div>
                <div className="flex gap-2">
                  <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                      order.status
                    )}`}
                  >
                    {order.status}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-600">Quantity</div>
                  <div className="text-sm font-medium">
                    {order.quantity} {order.unit}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Total Price</div>
                  <div className="text-sm font-medium">
                    {formatCurrency(order.totalPrice, order.currency)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => navigate(`/orders/${order.id}`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                View Details
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

