import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, actions } from '../store/index'
import { formatCurrency } from '../utils/units'
import { ConsumerAddressManager } from '../components/integrated/ConsumerAddressManager'

export function Checkout() {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const [escrowConfirmed, setEscrowConfirmed] = useState(false)
  const [deliveryWindow, setDeliveryWindow] = useState('')
  const [deliveryConstraints, setDeliveryConstraints] = useState('')
  const [selectedAddress, setSelectedAddress] = useState(null)

  const cartItems = state.cart
  const total = cartItems.reduce((sum, item) => sum + item.totalPrice, 0)
  const currency = cartItems[0]?.currency || 'INR'

  const handlePlaceOrder = () => {
    if (!escrowConfirmed) {
      alert('Please confirm the escrow terms to proceed')
      return
    }

    if (!selectedAddress) {
      alert('Please select a delivery address')
      return
    }

    // Create orders for each cart item
    cartItems.forEach((item) => {
      const product = state.products.find((p) => p.id === item.productId)
      const order = {
        id: `order-${Date.now()}-${Math.random()}`,
        productId: item.productId,
        consumerId: state.ui.currentUser?.id || 'u1',
        quantity: item.quantity,
        unit: item.unit,
        totalPrice: item.totalPrice,
        currency: item.currency,
        status: 'PENDING',
        escrowStatus: 'HELD', // Set escrow status to HELD on checkout
        negotiation: [],
        assignedLogisticsId: null,
        deliveryAudit: [],
        deliveryWindow,
        deliveryConstraints,
        deliveryAddress: selectedAddress,
        createdAt: new Date().toISOString(),
      }
      actions.addOrder(dispatch, order)
    })

    // Clear cart
    actions.clearCart(dispatch)

    // TODO: Integrate payment gateway supporting UPI and payment holds / escrow (production compliance required)
    alert('Order placed successfully! Funds are held in escrow until delivery is verified.')
    navigate('/orders')
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-4">Checkout</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-4">
        <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
        <div className="space-y-2 mb-4">
          {cartItems.map((item) => {
            const product = state.products.find((p) => p.id === item.productId)
            return (
              <div key={item.productId} className="flex justify-between text-sm">
                <span>
                  {product?.name || 'Product'} × {item.quantity} {item.unit}
                </span>
                <span>{formatCurrency(item.totalPrice, item.currency)}</span>
              </div>
            )
          })}
        </div>
        <div className="border-t pt-4 flex justify-between font-semibold">
          <span>Total</span>
          <span>{formatCurrency(total, currency)}</span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-4">
        <h2 className="text-lg font-semibold mb-4">Delivery Address</h2>
        <ConsumerAddressManager
          compact={true}
          onSelect={(address) => setSelectedAddress(address)}
        />
        {selectedAddress && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
            <span className="font-medium text-green-700">✓ Delivering to:</span>{' '}
            <span className="text-green-800">
              {selectedAddress.label} — {selectedAddress.address}
            </span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-4">
        <h2 className="text-lg font-semibold mb-4">Delivery Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delivery Window (Optional)
            </label>
            <input
              type="text"
              value={deliveryWindow}
              onChange={(e) => setDeliveryWindow(e.target.value)}
              placeholder="e.g., Morning 9-12 PM"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delivery Constraints / Special Instructions (Optional)
            </label>
            <textarea
              value={deliveryConstraints}
              onChange={(e) => setDeliveryConstraints(e.target.value)}
              rows="3"
              placeholder="Any special delivery instructions..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <h3 className="font-semibold mb-2">Escrow Protection</h3>
        <p className="text-sm text-gray-700 mb-3">
          Your payment will be held in escrow until the delivery is verified. This protects both
          you and the farmer. Funds will be released to the farmer only after you confirm delivery.
        </p>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={escrowConfirmed}
            onChange={(e) => setEscrowConfirmed(e.target.checked)}
            className="mt-1"
            required
          />
          <span className="text-sm">
            I acknowledge funds will be held in escrow until verified delivery *
          </span>
        </label>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => navigate('/cart')}
          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Back to Cart
        </button>
        <button
          onClick={handlePlaceOrder}
          disabled={!escrowConfirmed}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Place Order
        </button>
      </div>
    </div>
  )
}

