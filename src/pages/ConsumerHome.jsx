import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/index'
import { ProductCard } from '../components/ProductCard'
import { WEIGHT_UNITS } from '../utils/units'

// Helper function for availability confidence (add this temporarily)
function getAvailabilityConfidence(product) {
  if (!product.quantity || product.quantity <= 0) return 'LOW'
  if (product.quantity < 10) return 'MEDIUM'
  return 'HIGH'
}

export function ConsumerHome() {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('recent')
  const [displayUnit, setDisplayUnit] = useState('kg')

  const products = useMemo(() => {
    let list = state.products.filter((p) => p.status !== 'NOT_HARVESTED')

    if (search.trim()) {
      const term = search.toLowerCase()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.location?.address?.toLowerCase().includes(term)
      )
    }

    if (sortBy === 'price_low') {
      list = [...list].sort((a, b) => a.pricePerUnit - b.pricePerUnit)
    } else if (sortBy === 'price_high') {
      list = [...list].sort((a, b) => b.pricePerUnit - a.pricePerUnit)
    } else {
      // recent
      list = [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    }

    return list
  }, [state.products, search, sortBy])

  const [showContactModal, setShowContactModal] = useState(null)

  const handleAddToCart = (product) => {
    const availabilityConfidence = getAvailabilityConfidence(product)
    
    if (availabilityConfidence === 'LOW') {
      setShowContactModal(product)
      return
    }

    // Dispatch add to cart action directly
    dispatch({
      type: 'CART_ADD_ITEM',
      payload: {
        productId: product.id,
        quantity: 1,
        unit: product.unit,
        pricePerUnit: product.pricePerUnit,
        currency: product.currency,
        totalPrice: product.pricePerUnit,
        availabilityConfidence,
      }
    })
  }

  const handleContactFarmer = (product) => {
    setShowContactModal(product)
  }

  const handleRequestConfirmation = (product) => {
    // Mock notification
    dispatch({
      type: 'UI_ADD_NOTIFICATION',
      payload: {
        id: `notif-${Date.now()}`,
        type: 'info',
        message: `Confirmation request sent to farmer for ${product.name}`,
        timestamp: new Date().toISOString(),
      }
    })
    setShowContactModal(null)
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 text-white py-12 px-4 sm:px-6 lg:px-8 mb-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            Fresh from Farmers
          </h1>
          <p className="text-lg text-primary-100 max-w-2xl font-light leading-relaxed">
            Direct farm-to-table access. Browse premium produce directly from verified local farmers, ensuring the highest quality and fair prices.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar filters */}
          <aside className="w-full lg:w-72 flex-shrink-0 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-24">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-xl">🔍</span> Filters
              </h2>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Search
                  </label>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search produce..."
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Sort Order
                  </label>
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm appearance-none focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
                    >
                      <option value="recent">✨ Recently Added</option>
                      <option value="price_low">💰 Price: Low to High</option>
                      <option value="price_high">💎 Price: High to Low</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">
                      ▼
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Weight Unit
                  </label>
                  <div className="relative">
                    <select
                      value={displayUnit}
                      onChange={(e) => setDisplayUnit(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm appearance-none focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
                    >
                      {WEIGHT_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u === 'kg' ? '⚖️ Kilogram (kg)' : u === 'quintal' ? '📦 Quintal' : u === 'ton' ? '🏗️ Ton' : '🔢 Pound (lb)'}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">
                      ▼
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <div className="p-4 bg-primary-50 rounded-xl text-xs text-primary-700 leading-relaxed">
                    <strong>Tip:</strong> You can filter by organic certification and distance in the advanced view.
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Product grid */}
          <section className="flex-1">
            {products.length === 0 ? (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-12 text-center">
                <div className="text-6xl mb-4">🌾</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-500">Try adjusting your filters or check back later.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    displayUnit={displayUnit}
                    onView={() => navigate(`/consumer/product/${product.id}`)}
                    onAddToCart={() => handleAddToCart(product)}
                    onContactFarmer={() => handleContactFarmer(product)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Contact Farmer Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Contact Farmer</h3>
            <p className="text-sm text-gray-600 mb-4">
              This product has low availability confidence. Would you like to contact the farmer
              to confirm availability?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleRequestConfirmation(showContactModal)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Request Confirmation
              </button>
              <button
                onClick={() => setShowContactModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


