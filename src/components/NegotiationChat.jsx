import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store/index'
import { addNegotiationMessage, updateOrder } from '../store/actions'

/**
 * Negotiation chat component for order price discussions
 * Uses mock WebSocket for real-time messaging simulation
 */
export function NegotiationChat({ order, onClose }) {
  const { state, dispatch } = useStore()
  const [message, setMessage] = useState('')
  const [priceOffer, setPriceOffer] = useState('')
  const messagesEndRef = useRef(null)

  const currentUser = state.ui.currentUser
  const product = state.products.find(p => p.id === order.productId)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [order.negotiation])

  const handleSend = (e) => {
    e.preventDefault()
    if (!message.trim() && !priceOffer) return

    const negotiationMessage = {
      from: currentUser?.role === 'farmer' ? 'farmer' : 'consumer',
      message: message.trim(),
      priceOffer: priceOffer ? parseFloat(priceOffer) : null,
      createdAt: new Date().toISOString(),
    }

    dispatch(addNegotiationMessage(order.id, negotiationMessage))

    // If price offer is included, update order total
    if (priceOffer) {
      const newTotal = parseFloat(priceOffer) * order.quantity
      dispatch(updateOrder({
        ...order,
        totalPrice: newTotal,
      }))
    }

    setMessage('')
    setPriceOffer('')
  }

  const handleAcceptPrice = () => {
    if (priceOffer) {
      const newTotal = parseFloat(priceOffer) * order.quantity
      dispatch(updateOrder({
        ...order,
        totalPrice: newTotal,
        status: 'ACCEPTED',
      }))
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold">Negotiation Chat</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        <div className="p-4 border-b bg-gray-50">
          <div className="text-sm">
            <span className="font-medium">Product:</span> {product?.name}
          </div>
          <div className="text-sm">
            <span className="font-medium">Current Price:</span>{' '}
            {order.totalPrice} {order.currency}
          </div>
          <div className="text-sm">
            <span className="font-medium">Quantity:</span> {order.quantity} {order.unit}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {order.negotiation && order.negotiation.length > 0 ? (
            order.negotiation.map((msg, index) => (
              <div
                key={index}
                className={`flex ${
                  msg.from === (currentUser?.role === 'farmer' ? 'farmer' : 'consumer')
                    ? 'justify-end'
                    : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs rounded-lg p-3 ${
                    msg.from === (currentUser?.role === 'farmer' ? 'farmer' : 'consumer')
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  <div className="text-sm font-medium mb-1">
                    {msg.from === 'farmer' ? 'You (Farmer)' : 'Consumer'}
                  </div>
                  {msg.message && <div className="text-sm">{msg.message}</div>}
                  {msg.priceOffer && (
                    <div className="text-sm font-semibold mt-1">
                      Price Offer: {msg.priceOffer} {order.currency}/{order.unit}
                      {msg.fromPriceSuggestion && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                          AI Suggested
                        </span>
                      )}
                    </div>
                  )}
                  <div className="text-xs opacity-75 mt-1">
                    {new Date(msg.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500 py-8">
              No messages yet. Start the negotiation!
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="p-4 border-t space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
            />
            <input
              type="number"
              value={priceOffer}
              onChange={(e) => setPriceOffer(e.target.value)}
              placeholder="Price/unit (optional)"
              step="0.01"
              className="w-32 px-3 py-2 border border-gray-300 rounded-md"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Send
            </button>
          </div>
          {priceOffer && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAcceptPrice}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Accept This Price
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

