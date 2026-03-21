import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore, actions } from '../store/index'
import { getAvailabilityConfidence } from '../store/index'
import { formatCurrency, convertUnit } from '../utils/units'
import { QuantityUnitSelector } from '../components/QuantityUnitSelector'
import { NegotiationChat } from '../components/NegotiationChat'
import { getRationaleText, predictFarmerAcceptance } from '../services/priceEngine'

export function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state, dispatch } = useStore()
  const [selection, setSelection] = useState({ quantity: 1, unit: 'kg' })
  const [error, setError] = useState('')
  const [showChat, setShowChat] = useState(false)
  const [negotiationOffer, setNegotiationOffer] = useState('')

  const product = useMemo(
    () => state.products.find((p) => p.id === id),
    [state.products, id]
  )

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-gray-600">Product not found.</p>
      </div>
    )
  }

  const maxQuantity = product.quantity

  const handleAddToCart = () => {
    try {
      const requestedBase = convertUnit(selection.quantity, selection.unit, product.unit)
      if (requestedBase > maxQuantity) {
        setError(`Requested quantity exceeds available stock (${maxQuantity} ${product.unit}).`)
        return
      }
      setError('')
      const pricePerBaseUnit = product.pricePerUnit
      const totalPrice = requestedBase * pricePerBaseUnit
      actions.addToCart(dispatch, {
        productId: product.id,
        quantity: selection.quantity,
        unit: selection.unit,
        pricePerUnit: pricePerBaseUnit,
        currency: product.currency,
        totalPrice,
      })
      navigate('/cart')
    } catch (e) {
      setError('Unable to add to cart due to unit conversion error.')
    }
  }

  const handleBuyNow = () => {
    handleAddToCart()
    navigate('/checkout')
  }

  const canNegotiate = product.status === 'AVAILABLE'

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-600 hover:text-gray-800 mb-4"
      >
        ← Back
      </button>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gallery */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="h-72 bg-gray-100 flex items-center justify-center mb-4">
            {product.images && product.images[0] ? (
              // TODO: Move base64 images to external storage in production
              <img
                src={product.images[0]}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-gray-400 text-sm">No Image</span>
            )}
          </div>
          <div className="text-xs text-gray-500">
            Images are stored as base64 for prototype only. In production, use a CDN or object
            storage.
          </div>
        </div>

        {/* Details */}
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{product.name}</h1>
          <p className="text-gray-600 mt-1">{product.location?.address}</p>

          <div className="mt-4">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(product.pricePerUnit, product.currency)} / {product.unit}
            </div>
            {/* Show converted price when a different unit is selected */}
            {selection.unit && selection.unit !== product.unit && (() => {
              try {
                const factor = convertUnit(1, product.unit, selection.unit)
                const convertedPrice = product.pricePerUnit / factor
                return (
                  <div className="text-base font-semibold text-primary-600 mt-1">
                    ≈ {formatCurrency(convertedPrice, product.currency)} / {selection.unit}
                  </div>
                )
              } catch { return null }
            })()}
            <div className="text-sm text-gray-500 mt-1">
              Available: {product.quantity} {product.unit}
              {selection.unit && selection.unit !== product.unit && (() => {
                try {
                  const converted = convertUnit(product.quantity, product.unit, selection.unit)
                  return <span className="text-gray-400 ml-1">({Number.isInteger(converted) ? converted : converted.toFixed(2)} {selection.unit})</span>
                } catch { return null }
              })()}
            </div>
          </div>

          {/* Price Suggestion */}
          {product.priceSuggestion && (
            <div className="mt-4 p-4 bg-blue-50 rounded-md border border-blue-200">
              <div className="text-sm font-medium text-gray-700 mb-1">Suggested Price</div>
              <div className="text-lg font-bold text-blue-600">
                {product.priceSuggestion.value} {product.priceSuggestion.currency} / {product.unit}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {product.priceSuggestion.rationale || getRationaleText(product.priceSuggestion.rationaleId)} — confidence{' '}
                {Math.round(product.priceSuggestion.confidence * 100)}%
                {product.priceSuggestion.source === 'API' && (
                  <span className="ml-1 text-green-600 font-medium">● Live</span>
                )}
              </div>
              {product.priceSuggestion.minPrice != null && product.priceSuggestion.maxPrice != null && (
                <div className="text-xs text-gray-500 mt-1">
                  Market range: ₹{product.priceSuggestion.minPrice} – ₹{product.priceSuggestion.maxPrice}
                  {product.priceSuggestion.msp != null && ` | MSP: ₹${product.priceSuggestion.msp}`}
                  {product.priceSuggestion.trend && ` | Trend: ${product.priceSuggestion.trend}`}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 space-y-3">
            <div>
              <span className="block text-sm font-medium text-gray-700 mb-1">
                Quantity &amp; Unit
              </span>
              <QuantityUnitSelector
                value={selection}
                baseUnit={product.unit}
                maxQuantity={product.quantity}
                onChange={(val) => setSelection(val)}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleAddToCart}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Add to Cart
              </button>
              <button
                onClick={handleBuyNow}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Buy Now
              </button>
            </div>

            {/* Negotiation */}
            {canNegotiate && (
              <div className="mt-4 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={negotiationOffer}
                    onChange={(e) => setNegotiationOffer(e.target.value)}
                    placeholder="Your price offer"
                    step="0.01"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (negotiationOffer) {
                        const offer = parseFloat(negotiationOffer)
                        const likelihood = predictFarmerAcceptance(product, offer)
                        alert(
                          `Predicted farmer acceptance likelihood: ${Math.round(likelihood * 100)}%`
                        )
                        setShowChat(true)
                      } else {
                        setShowChat(true)
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    Open Negotiation
                  </button>
                </div>
                {negotiationOffer && product.priceSuggestion && (
                  <div className="text-xs text-gray-600">
                    Acceptance likelihood:{' '}
                    {Math.round(
                      predictFarmerAcceptance(product, parseFloat(negotiationOffer)) * 100
                    )}
                    %
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {showChat && (
        <NegotiationChat
          product={product}
          order={null}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  )
}


