import { useState, useEffect } from 'react'
import { useStore } from '../store/index'
import { addProduct } from '../store/actions'
import { WEIGHT_UNITS, CURRENCIES } from '../utils/units'
import { fetchPriceSuggestion, getRationaleText } from '../services/priceEngine'
import { enqueueOfflineAction, getPendingSyncCount } from '../store/index'

/**
 * Form component for adding new products
 * Includes image upload, unit/currency selectors, and validation
 */
export function AddProductForm({ onSuccess }) {
  const { state, dispatch } = useStore()
  const currentUser = state.ui.currentUser

  const [formData, setFormData] = useState({
    name: '',
    quantity: '',
    unit: 'kg',
    pricePerUnit: '',
    currency: 'INR',
    images: [],
    address: '',
    source: 'WEB',
  })

  const [errors, setErrors] = useState({})
  const [imagePreview, setImagePreview] = useState([])
  const [priceSuggestion, setPriceSuggestion] = useState(null)
  const [isOffline, setIsOffline] = useState(false)
  const [showVoiceModal, setShowVoiceModal] = useState(false)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }))
    }
    // Update price suggestion when price or quantity changes
    if ((name === 'pricePerUnit' || name === 'quantity') && formData.name && value) {
      updatePriceSuggestion()
    }
  }

  const updatePriceSuggestion = async () => {
    if (!formData.name || !formData.pricePerUnit) {
      setPriceSuggestion(null)
      return
    }
    const productData = {
      name: formData.name,
      pricePerUnit: parseFloat(formData.pricePerUnit) || 0,
      currency: formData.currency,
      quantity: parseFloat(formData.quantity) || 0,
      source: formData.source,
    }
    try {
      const suggestion = await fetchPriceSuggestion(productData)
      setPriceSuggestion(suggestion)
    } catch (err) {
      console.warn('Price suggestion fetch failed:', err.message)
    }
  }

  const handleVoiceUpload = () => {
    setShowVoiceModal(true)
    // TODO: Integrate real SMS gateway (Twilio/MSG91) and IVR parser for voice uploads
    // Simulate voice parsing
    setTimeout(() => {
      // Mock parsed data
      const mockParsed = {
        name: 'Tomato',
        quantity: '100',
        unit: 'kg',
        pricePerUnit: '25',
        address: 'Near Demo Village',
      }
      setFormData(prev => ({
        ...prev,
        ...mockParsed,
        quantity: mockParsed.quantity,
        pricePerUnit: mockParsed.pricePerUnit,
      }))
      setShowVoiceModal(false)
      updatePriceSuggestion()
    }, 1500)
  }

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    const newImages = []
    const newPreviews = []

    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (event) => {
          const dataUrl = event.target.result
          newImages.push(dataUrl)
          newPreviews.push(dataUrl)

          if (newImages.length === files.length) {
            setFormData(prev => ({
              ...prev,
              images: [...prev.images, ...newImages],
            }))
            setImagePreview(prev => [...prev, ...newPreviews])
          }
        }
        reader.readAsDataURL(file)
      }
    })
  }

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }))
    setImagePreview(prev => prev.filter((_, i) => i !== index))
  }

  const validate = () => {
    const newErrors = {}
    
    if (!formData.name.trim()) newErrors.name = 'Crop name is required'
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      newErrors.quantity = 'Valid quantity is required'
    }
    if (!formData.pricePerUnit || parseFloat(formData.pricePerUnit) <= 0) {
      newErrors.pricePerUnit = 'Valid price is required'
    }
    if (!formData.address.trim()) newErrors.address = 'Address is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (!validate()) return
    if (!currentUser || currentUser.role !== 'farmer') {
      alert('Only farmers can add products')
      return
    }

    const now = new Date().toISOString()
    const newProduct = {
      id: `product-${Date.now()}`,
      farmerId: currentUser.id,
      name: formData.name.trim(),
      quantity: parseFloat(formData.quantity),
      unit: formData.unit,
      pricePerUnit: parseFloat(formData.pricePerUnit),
      currency: formData.currency,
      images: formData.images,
      location: {
        address: formData.address.trim(),
        lat: 0,
        lng: 0,
      },
      status: isOffline ? 'ON_HOLD_OFFLINE' : 'AVAILABLE',
      source: formData.source,
      lastSyncedAt: now,
      availabilityConfidence: formData.source === 'WEB' ? 'HIGH' : formData.source === 'MOBILE' ? 'MEDIUM' : 'LOW',
      priceSuggestion: priceSuggestion || null,
      createdAt: now,
      updatedAt: now,
    }

    if (isOffline) {
      // Enqueue to offline queue
      const actionId = enqueueOfflineAction(dispatch, {
        type: 'PRODUCT_ADD',
        payload: newProduct,
      })
      // Increment farmer sync count
      dispatch({ type: 'FARMER_INCREMENT_SYNC_COUNT', payload: currentUser.id })
    } else {
      dispatch(addProduct(newProduct))
    }
    
    // Reset form
    setFormData({
      name: '',
      quantity: '',
      unit: 'kg',
      pricePerUnit: '',
      currency: 'INR',
      images: [],
      address: '',
      source: 'WEB',
    })
    setImagePreview([])
    setErrors({})
    setPriceSuggestion(null)

    if (onSuccess) onSuccess()
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Add New Product</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Source Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Source *
          </label>
          <select
            name="source"
            value={formData.source}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="WEB">Web</option>
            <option value="MOBILE">Mobile App</option>
            <option value="SMS">SMS</option>
            <option value="VOICE">Voice</option>
          </select>
        </div>

        {/* Voice Upload CTA */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleVoiceUpload}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <span className="text-xl">🎤</span>
            <span>Voice Upload</span>
          </button>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isOffline}
              onChange={(e) => setIsOffline(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-600">Offline Mode</span>
          </label>
        </div>

        {/* Crop Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Crop Name *
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-md ${
              errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="e.g., Organic Tomatoes"
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
        </div>

        {/* Quantity and Unit */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity *
            </label>
            <input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleInputChange}
              step="0.01"
              min="0"
              className={`w-full px-3 py-2 border rounded-md ${
                errors.quantity ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="100"
            />
            {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit *
            </label>
            <select
              name="unit"
              value={formData.unit}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {WEIGHT_UNITS.map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Price and Currency */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price per Unit *
            </label>
            <input
              type="number"
              name="pricePerUnit"
              value={formData.pricePerUnit}
              onChange={handleInputChange}
              step="0.01"
              min="0"
              className={`w-full px-3 py-2 border rounded-md ${
                errors.pricePerUnit ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="40"
            />
            {errors.pricePerUnit && <p className="text-red-500 text-xs mt-1">{errors.pricePerUnit}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency *
            </label>
            <select
              name="currency"
              value={formData.currency}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {CURRENCIES.map(currency => (
                <option key={currency} value={currency}>{currency}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Price Suggestion */}
        {priceSuggestion && formData.pricePerUnit && (
          <div className="p-4 bg-blue-50 rounded-md border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-medium text-gray-700">Suggested Price</div>
                <div className="text-lg font-bold text-blue-600">
                  {priceSuggestion.value} {priceSuggestion.currency}/{formData.unit}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {priceSuggestion.rationale || getRationaleText(priceSuggestion.rationaleId)} — confidence{' '}
                  {Math.round(priceSuggestion.confidence * 100)}%
                  {priceSuggestion.source === 'API' && (
                    <span className="ml-1 text-green-600 font-medium">● Live</span>
                  )}
                  {priceSuggestion.source === 'FALLBACK' && (
                    <span className="ml-1 text-yellow-600 font-medium">● Offline</span>
                  )}
                </div>
                {priceSuggestion.minPrice != null && priceSuggestion.maxPrice != null && (
                  <div className="text-xs text-gray-500 mt-1">
                    Market range: ₹{priceSuggestion.minPrice} – ₹{priceSuggestion.maxPrice}
                    {priceSuggestion.msp != null && ` | MSP: ₹${priceSuggestion.msp}`}
                    {priceSuggestion.trend && ` | Trend: ${priceSuggestion.trend}`}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, pricePerUnit: priceSuggestion.value.toString() }))
                  }}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => setPriceSuggestion(null)}
                  className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Override
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Images */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product Images
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
          <p className="text-xs text-gray-500 mt-1">
            {/* TODO: Migrate to cloud storage (AWS S3, Cloudinary, etc.) */}
            Images are stored as base64 in mock DB. In production, upload to cloud storage.
          </p>
          
          {imagePreview.length > 0 && (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {imagePreview.map((preview, index) => (
                <div key={index} className="relative">
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-24 object-cover rounded"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pickup Address *
          </label>
          <textarea
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            rows="2"
            className={`w-full px-3 py-2 border rounded-md ${
              errors.address ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Farm Road, Village, Taluk, District"
          />
          {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
        </div>

        {/* Submit Button */}
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 font-medium"
          >
            Add Product
          </button>
          <button
            type="button"
            onClick={() => {
              setFormData({
                name: '',
                quantity: '',
                unit: 'kg',
                pricePerUnit: '',
                currency: 'INR',
                images: [],
                address: '',
              })
              setImagePreview([])
              setErrors({})
            }}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Reset
          </button>
        </div>
      </form>

      {/* Voice Upload Modal */}
      {showVoiceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Voice Upload</h3>
            <p className="text-sm text-gray-600 mb-4">
              Simulating voice parsing... This would integrate with IVR parser in production.
            </p>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </div>
      )}

      {/* Offline Badge */}
      {isOffline && (
        <div className="mt-4 p-2 bg-yellow-100 border border-yellow-300 rounded text-sm text-yellow-800">
          ⚠️ Offline mode: Product will be queued for sync. Pending sync count:{' '}
          {getPendingSyncCount(state, currentUser?.id) || 0}
        </div>
      )}
    </div>
  )
}

