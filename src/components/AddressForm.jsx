import { useState } from 'react'

/**
 * Simple address form for checkout.
 * Uses browser geolocation if available as a convenience (prototype only).
 */
export function AddressForm({ initialValue, onChange }) {
  const [address, setAddress] = useState(initialValue?.address || '')
  const [lat, setLat] = useState(initialValue?.lat ?? '')
  const [lng, setLng] = useState(initialValue?.lng ?? '')

  const emitChange = (next) => {
    onChange?.(next)
  }

  const handleAddressChange = (value) => {
    setAddress(value)
    emitChange({ address: value, lat: Number(lat) || 0, lng: Number(lng) || 0, label: initialValue?.label || 'Home' })
  }

  const handleLatChange = (value) => {
    setLat(value)
    emitChange({ address, lat: Number(value) || 0, lng: Number(lng) || 0, label: initialValue?.label || 'Home' })
  }

  const handleLngChange = (value) => {
    setLng(value)
    emitChange({ address, lat: Number(lat) || 0, lng: Number(value) || 0, label: initialValue?.label || 'Home' })
  }

  const handleUseGeo = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setLat(latitude)
        setLng(longitude)
        emitChange({ address, lat: latitude, lng: longitude, label: initialValue?.label || 'Home' })
      },
      () => {
        // Silent failure for prototype
      }
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
        <textarea
          rows={3}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          value={address}
          onChange={(e) => handleAddressChange(e.target.value)}
          placeholder="House / Street, Area, City, State"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
          <input
            type="number"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            value={lat}
            onChange={(e) => handleLatChange(e.target.value)}
            step="0.000001"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
          <input
            type="number"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            value={lng}
            onChange={(e) => handleLngChange(e.target.value)}
            step="0.000001"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={handleUseGeo}
        className="text-xs text-blue-600 hover:text-blue-700 underline"
      >
        Use current location (browser geolocation, prototype only)
      </button>
    </div>
  )
}


