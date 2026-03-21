import { useState } from 'react'
import { useStore } from '../store/index'
import { updateOrder } from '../store/actions'

/**
 * Support/Dispute component for raising disputes on orders
 */
export function SupportDispute({ order, onClose }) {
  const { dispatch } = useStore()
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState([])
  const [error, setError] = useState('')

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files)
    files.forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (event) => {
          setPhotos((prev) => [...prev, event.target.result])
        }
        reader.readAsDataURL(file)
      }
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!description.trim()) {
      setError('Description is required')
      return
    }

    // Update order with dispute status
    dispatch(updateOrder({
      ...order,
      status: 'DISPUTED',
    }))

    // In production, this would create a dispute record and notify support team

    alert('Dispute raised successfully. Support team will review your case.')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold">Raise Dispute</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Order ID
            </label>
            <div className="text-sm text-gray-600">{order.id}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                setError('')
              }}
              rows="4"
              className={`w-full px-3 py-2 border rounded-md ${
                error ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Describe the issue..."
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Attach Photos
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            {photos.length > 0 && (
              <div className="mt-2 grid grid-cols-4 gap-2">
                {photos.map((photo, index) => (
                  <div key={index} className="relative">
                    <img
                      src={photo}
                      alt={`Dispute photo ${index + 1}`}
                      className="w-full h-24 object-cover rounded"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Raise Dispute
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

