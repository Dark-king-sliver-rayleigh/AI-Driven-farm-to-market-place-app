import { formatCurrency, convertUnit } from '../utils/units'
import { getAvailabilityConfidence } from '../store/index'

export function ProductCard({ product, displayUnit, onAddToCart, onView, onContactFarmer }) {
  if (!product || product.status === 'NOT_HARVESTED') return null

  const thumbnail = product.images && product.images[0]
  const availabilityConfidence = getAvailabilityConfidence(product)
  const isLowConfidence = availabilityConfidence === 'LOW'
  const source = product.source || 'WEB'

  // Unit conversion: convert price and quantity to the chosen display unit
  const effectiveUnit = displayUnit || product.unit
  let displayPrice = product.pricePerUnit
  let displayQuantity = product.quantity
  let displayUnitLabel = product.unit

  if (effectiveUnit && effectiveUnit !== product.unit) {
    try {
      // Price conversion: if product is ₹2000/quintal, then per kg = 2000 / 100 = ₹20
      // convertUnit(1, product.unit, effectiveUnit) gives how many effectiveUnits are in 1 product.unit
      // So price per effectiveUnit = pricePerProductUnit / conversionFactor
      const conversionFactor = convertUnit(1, product.unit, effectiveUnit)
      displayPrice = product.pricePerUnit / conversionFactor
      displayQuantity = convertUnit(product.quantity, product.unit, effectiveUnit)
      displayUnitLabel = effectiveUnit
    } catch {
      // Fallback to original if conversion fails
      displayPrice = product.pricePerUnit
      displayQuantity = product.quantity
      displayUnitLabel = product.unit
    }
  } else {
    displayUnitLabel = product.unit
  }

  const getSourceIcon = (src) => {
    switch (src) {
      case 'MOBILE':
        return '📲'
      default:
        return '💻'
    }
  }

  const getConfidenceColor = (conf) => {
    switch (conf) {
      case 'HIGH':
        return 'bg-green-100 text-green-800'
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800'
      case 'LOW':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className={`group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col border border-gray-100 ${isLowConfidence ? 'opacity-75' : ''}`}>
      <div className="h-48 bg-gray-50 flex items-center justify-center relative overflow-hidden">
        {thumbnail ? (
          // TODO: Store images in cloud storage instead of base64 for production
          <img 
            src={thumbnail} 
            alt={product.name} 
            className="h-full w-full object-cover transform group-hover:scale-110 transition-transform duration-500" 
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-300">
            <span className="text-4xl">🥬</span>
            <span className="text-xs font-medium mt-2">No Image</span>
          </div>
        )}
        <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
          <span 
            className="w-8 h-8 flex items-center justify-center bg-white/90 backdrop-blur rounded-full shadow-sm text-sm" 
            title={`Source: ${source}`}
          >
            {getSourceIcon(source)}
          </span>
          <span
            className={`px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full shadow-sm ${getConfidenceColor(availabilityConfidence)}`}
            title={`Availability Confidence: ${availabilityConfidence}`}
          >
            {availabilityConfidence}
          </span>
        </div>
      </div>
      
      <div className="p-5 flex-1 flex flex-col">
        <div className="mb-2">
           <h3 className="text-lg font-bold text-gray-900 leading-tight group-hover:text-green-600 transition-colors">{product.name}</h3>
           <p className="text-xs font-medium text-gray-400 mt-1 flex items-center gap-1">
             <span className="inline-block w-1 h-1 rounded-full bg-gray-300"></span>
             {product.location?.address || 'Unknown Location'}
           </p>
        </div>

        <div className="mt-auto pt-4 border-t border-gray-50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xl font-bold text-gray-900">
                {formatCurrency(displayPrice, product.currency)}
                <span className="text-sm text-gray-400 font-normal ml-1">/ {displayUnitLabel}</span>
              </div>
              <div className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full inline-block mt-1">
                {Number.isInteger(displayQuantity) ? displayQuantity : displayQuantity.toFixed(2)} {displayUnitLabel} left
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onView}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors duration-200"
            >
              Details
            </button>
            {isLowConfidence ? (
              <button
                onClick={onContactFarmer}
                className="px-4 py-2.5 text-sm font-semibold text-white bg-yellow-500 hover:bg-yellow-600 shadow-sm hover:shadow rounded-xl transition-all duration-200"
              >
                Contact
              </button>
            ) : (
              <button
                onClick={onAddToCart}
                className="px-4 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 shadow-green-200 shadow-sm hover:shadow-green-300 hover:shadow-md rounded-xl transition-all duration-200"
              >
                Add to Cart
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


