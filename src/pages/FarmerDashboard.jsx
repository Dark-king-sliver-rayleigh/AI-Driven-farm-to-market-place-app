import { useState } from 'react'
import { useStore } from '../store/index'
import { updateFarmer } from '../store/actions'
import { AddProductForm } from '../components/AddProductForm'
import { InventoryTable } from '../components/InventoryTable'
import { FeedbackList } from '../components/FeedbackList'

/**
 * Main farmer dashboard page
 * Includes profile management, add product, inventory, and feedback sections
 */
export function FarmerDashboard() {
  const { state, dispatch } = useStore()
  const currentUser = state.ui.currentUser

  const farmer = state.farmers.find(f => f.id === currentUser?.id) || {
    id: currentUser?.id,
    name: '',
    phone: '',
    email: '',
    address: '',
    profileImage: null,
    verified: false,
    ratings: { avg: 0, count: 0 },
  }

  const [activeTab, setActiveTab] = useState('profile')
  const [profileForm, setProfileForm] = useState({
    name: farmer.name || '',
    phone: farmer.phone || '',
    email: farmer.email || '',
    address: farmer.address || '',
  })
  const [profileImage, setProfileImage] = useState(farmer.profileImage)
  const [showSMSModal, setShowSMSModal] = useState(false)

  const handleProfileImageUpload = (e) => {
    const file = e.target.files[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const dataUrl = event.target.result
        setProfileImage(dataUrl)
        // TODO: Migrate to cloud storage
      }
      reader.readAsDataURL(file)
    }
  }

  const handleProfileSave = () => {
    dispatch(updateFarmer({
      ...farmer,
      ...profileForm,
      profileImage,
    }))
    alert('Profile updated successfully!')
  }

  const farmerProducts = state.products.filter(
    p => p.farmerId === currentUser?.id
  )
  const availableProducts = farmerProducts.filter(p => p.status === 'AVAILABLE').length
  const pendingOrders = state.orders.filter(o => {
    const product = state.products.find(p => p.id === o.productId)
    return product?.farmerId === currentUser?.id && o.status === 'PENDING'
  }).length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Farmer Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Manage your farm products and business
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600">Total Products</div>
          <div className="text-2xl font-bold text-gray-800 mt-2">
            {farmerProducts.length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600">Available Products</div>
          <div className="text-2xl font-bold text-green-600 mt-2">
            {availableProducts}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm text-gray-600">Pending Orders</div>
          <div className="text-2xl font-bold text-yellow-600 mt-2">
            {pendingOrders}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b">
          <div className="flex space-x-1 p-4">
            {[
              { id: 'profile', label: 'Profile' },
              { id: 'add-product', label: 'Add Product' },
              { id: 'inventory', label: 'Inventory' },
              { id: 'feedback', label: 'Feedback' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-t-lg font-medium ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800">Farmer Profile</h2>

              {/* Profile Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Profile Photo
                </label>
                <div className="flex items-center gap-4">
                  {profileImage ? (
                    <img
                      src={profileImage}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-400">No Image</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfileImageUpload}
                    className="text-sm"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {/* TODO: Migrate to cloud storage */}
                  Images stored as base64. In production, upload to cloud storage.
                </p>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Your name"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="+91 9876543210"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="your@email.com"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address + Village/Taluk/District *
                </label>
                <textarea
                  value={profileForm.address}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, address: e.target.value })
                  }
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Farm Road, Village, Taluk, District"
                />
              </div>

              {/* Verification Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Verification Status
                </label>
                <div
                  className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                    farmer.verified
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {farmer.verified ? '✓ Verified' : 'Pending Verification'}
                </div>
              </div>

              {/* Onboarding Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Onboarding Method
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {farmer.onboardingMethod === 'SMS' ? '📱' : farmer.onboardingMethod === 'VOICE' ? '📞' : '💻'}
                  </span>
                  <span className="text-sm text-gray-900">{farmer.onboardingMethod || 'WEB'}</span>
                </div>
              </div>

              {/* Pending Sync Count */}
              {farmer.pendingSyncCount > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pending Sync
                  </label>
                  <div className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold">
                    {farmer.pendingSyncCount} item{farmer.pendingSyncCount !== 1 ? 's' : ''} pending
                  </div>
                </div>
              )}

              {/* Ratings */}
              {farmer.ratings && farmer.ratings.count > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Average Rating
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">
                      {farmer.ratings.avg.toFixed(1)}
                    </span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`${
                            star <= farmer.ratings.avg
                              ? 'text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    <span className="text-sm text-gray-600">
                      ({farmer.ratings.count} reviews)
                    </span>
                  </div>
                </div>
              )}

              {/* SMS/Voice Listing Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Listing via SMS / Voice
                </label>
                <button
                  onClick={() => setShowSMSModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  How to list via SMS/Voice
                </button>
              </div>

              <button
                onClick={handleProfileSave}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
              >
                Save Profile
              </button>
            </div>
          )}

          {activeTab === 'add-product' && (
            <AddProductForm
              onSuccess={() => {
                setActiveTab('inventory')
                alert('Product added successfully!')
              }}
            />
          )}

          {activeTab === 'inventory' && <InventoryTable />}

          {activeTab === 'feedback' && <FeedbackList />}
        </div>
      </div>

      {/* SMS/Voice Modal */}
      {showSMSModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">How to list via SMS/Voice</h3>
              <button
                onClick={() => setShowSMSModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">SMS Format:</h4>
                <div className="bg-gray-50 p-3 rounded text-sm font-mono">
                  LIST [Crop Name] [Quantity] [Unit] [Price] [Address]
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Example: LIST Tomato 100 kg 25 Near Demo Village
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Short Codes:</h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Send to: <strong>AGRO-123</strong></li>
                  <li>For help: <strong>HELP</strong></li>
                  <li>To check status: <strong>STATUS</strong></li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Voice:</h4>
                <p className="text-sm text-gray-600">
                  Call <strong>+91-XXX-XXX-XXXX</strong> and follow the IVR prompts to list your product.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  TODO: Integrate real SMS gateway (Twilio/MSG91) and IVR parser for voice uploads
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

