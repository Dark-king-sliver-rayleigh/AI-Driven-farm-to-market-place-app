import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, actions } from '../store/index'
import { formatCurrency } from '../utils/units'

export function Cart() {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()

  const cartItems = useMemo(() => {
    return state.cart.map((item) => {
      const product = state.products.find((p) => p.id === item.productId)
      return { ...item, product }
    })
  }, [state.cart, state.products])

  const total = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.totalPrice, 0)
  }, [cartItems])

  const handleRemove = (productId) => {
    actions.removeCartItem(dispatch, { productId })
  }

  const handleUpdateQuantity = (productId, newQuantity) => {
    const item = cartItems.find((i) => i.productId === productId)
    if (item) {
      actions.updateCartItem(dispatch, {
        productId,
        quantity: newQuantity,
        pricePerUnit: item.pricePerUnit,
        totalPrice: newQuantity * item.pricePerUnit,
      })
    }
  }

  if (cartItems.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-4">Shopping Cart</h1>
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Your cart is empty. Start shopping!
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-4">Shopping Cart</h1>
      <div className="bg-white rounded-lg shadow divide-y">
        {cartItems.map((item) => (
          <div key={item.productId} className="p-4 flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-medium">{item.product?.name || 'Product'}</h3>
              <p className="text-sm text-gray-500">
                {formatCurrency(item.pricePerUnit, item.currency)} / {item.unit}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => handleUpdateQuantity(item.productId, parseFloat(e.target.value))}
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
              />
              <div className="w-32 text-right font-medium">
                {formatCurrency(item.totalPrice, item.currency)}
              </div>
              <button
                onClick={() => handleRemove(item.productId)}
                className="text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-lg font-semibold">Total</span>
          <span className="text-xl font-bold">
            {formatCurrency(total, cartItems[0]?.currency || 'INR')}
          </span>
        </div>
        <button
          onClick={() => navigate('/checkout')}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          Proceed to Checkout
        </button>
      </div>
    </div>
  )
}

