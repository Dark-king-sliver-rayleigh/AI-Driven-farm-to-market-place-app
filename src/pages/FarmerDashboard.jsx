import { useState } from 'react'
import { useStore } from '../store/index'
import { updateFarmer } from '../store/actions'
import { AddProductForm } from '../components/AddProductForm'
import { InventoryTable } from '../components/InventoryTable'
import { FeedbackList } from '../components/FeedbackList'
import { LocationPicker } from '../components/integrated/LocationPicker'

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
    addressLat: farmer.location?.lat || '',
    addressLng: farmer.location?.lng || '',
  })
  const [profileImage, setProfileImage] = useState(farmer.profileImage)

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
      location: {
        address: profileForm.address,
        lat: Number(profileForm.addressLat) || 0,
        lng: Number(profileForm.addressLng) || 0,
      },
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

              {/* Address with Location Picker */}
              <div>
                <LocationPicker
                  value={{
                    address: profileForm.address,
                    lat: profileForm.addressLat,
                    lng: profileForm.addressLng,
                  }}
                  onChange={(loc) => {
                    setProfileForm(prev => ({
                      ...prev,
                      address: loc.address || '',
                      addressLat: loc.lat || '',
                      addressLng: loc.lng || '',
                    }))
                  }}
                  label="📍 Address + Village/Taluk/District *"
                  placeholder="Farm Road, Village, Taluk, District"
                  showMap={true}
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
                  <span className="text-lg">💻</span>
                  <span className="text-sm text-gray-900">{farmer.onboardingMethod || 'WEB'}</span>
                </div>
              </div>


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

    </div>
  )
}

