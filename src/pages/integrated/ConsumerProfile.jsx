import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profileAPI } from '../../services/api';
import { ConsumerAddressManager } from '../../components/integrated/ConsumerAddressManager';

/**
 * Consumer Profile Page
 * Features: User info display, Edit profile, Photo upload, Logout
 */
export function ConsumerProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    profilePhoto: null
  });

  // Fetch profile on mount
  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true);
        setError(null);
        const response = await profileAPI.getProfile();
        setProfile(response.user);
        // Initialize form data
        setFormData({
          name: response.user?.name || '',
          phone: response.user?.phone || '',
          address: response.user?.address || response.user?.location || '',
          profilePhoto: response.user?.profilePhoto || null
        });
      } catch (err) {
        setError(err.message);
        // Initialize from user context if API fails
        if (user) {
          setFormData({
            name: user.name || '',
            phone: user.phone || '',
            address: user.address || user.location || '',
            profilePhoto: user.profilePhoto || null
          });
        }
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [user]);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setSaveError('Please select an image file');
        return;
      }
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setSaveError('Image size must be less than 2MB');
        return;
      }
      
      // Convert to base64 for storage
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, profilePhoto: reader.result }));
        setSaveError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setFormData(prev => ({ ...prev, profilePhoto: null }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveError(null);
      
      await profileAPI.updateProfile({
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        profilePhoto: formData.profilePhoto
      });
      
      // Update local profile state
      setProfile(prev => ({
        ...prev,
        ...formData
      }));
      
      setSaveSuccess(true);
      setIsEditing(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    // Reset form to current profile values
    setFormData({
      name: profile?.name || user?.name || '',
      phone: profile?.phone || user?.phone || '',
      address: profile?.address || profile?.location || user?.address || '',
      profilePhoto: profile?.profilePhoto || user?.profilePhoto || null
    });
    setIsEditing(false);
    setSaveError(null);
  };

  // Use profile data or fall back to user context
  const displayUser = profile || user || {};

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          {/* Avatar with Photo */}
          <div className="relative inline-block">
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white/30 mx-auto">
              {formData.profilePhoto ? (
                <img 
                  src={formData.profilePhoto} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-white/20 flex items-center justify-center">
                  <span className="text-5xl">👤</span>
                </div>
              )}
            </div>
            {/* Always show camera button for photo upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors"
              title="Change photo"
            >
              📷
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>
          <h1 className="text-3xl font-bold mt-4">{displayUser.name || 'Welcome'}</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Success Message */}
        {saveSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center gap-2">
            <span>✅</span> Profile updated successfully!
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading profile...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
            <p>{error}</p>
          </div>
        )}

        {/* Profile Content */}
        {!loading && (
          <div className="space-y-6">
            {/* Personal Information */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span>👤</span> Personal Information
                </h2>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium"
                  >
                    ✏️ Edit Profile
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancelEdit}
                      disabled={saving}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : '✓ Save'}
                    </button>
                  </div>
                )}
              </div>

              {/* Save Error */}
              {saveError && (
                <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {saveError}
                </div>
              )}

              <div className="p-6 space-y-4">
                {/* Profile Photo Section (only in edit mode) */}
                {isEditing && (
                  <div className="pb-4 border-b border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Profile Photo</label>
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100">
                        {formData.profilePhoto ? (
                          <img src={formData.profilePhoto} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl text-gray-400">👤</div>
                        )}
                      </div>
                      <div className="flex-1">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                        >
                          📷 Upload Photo
                        </button>
                        {formData.profilePhoto && (
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            className="ml-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                          >
                            Remove
                          </button>
                        )}
                        <p className="text-xs text-gray-400 mt-1">JPG, PNG or GIF. Max 2MB.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Name Field */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 mb-1">Full Name</p>
                    {isEditing ? (
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter your name"
                      />
                    ) : (
                      <p className="text-lg font-medium text-gray-900">{displayUser.name || '—'}</p>
                    )}
                  </div>
                  {!isEditing && <span className="text-2xl opacity-50 ml-4">👤</span>}
                </div>
                
                {/* Phone Number (read-only - used for login) */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 mb-1">Phone Number</p>
                    <p className="text-lg font-medium text-gray-900">{displayUser.phone || '—'}</p>
                    {isEditing && <p className="text-xs text-gray-400 mt-1">Phone number cannot be changed (used for login)</p>}
                  </div>
                  <span className="text-2xl opacity-50 ml-4">📱</span>
                </div>

                {/* Address Field */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 mb-1">Delivery Address</p>
                    {isEditing ? (
                      <textarea
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                        placeholder="Enter your delivery address"
                      />
                    ) : (
                      <p className="text-lg font-medium text-gray-900">
                        {displayUser.address || displayUser.location || '—'}
                      </p>
                    )}
                  </div>
                  {!isEditing && <span className="text-2xl opacity-50 ml-4">📍</span>}
                </div>

                {/* Account Type (read-only) */}
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-gray-500">Account Type</p>
                    <p className="text-lg font-medium text-gray-900">{displayUser.role || 'Consumer'}</p>
                  </div>
                  <span className="text-2xl opacity-50">🛒</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span>⚡</span> Quick Actions
                </h2>
              </div>
              <div className="p-6 space-y-3">
                <button
                  onClick={() => navigate('/consumer/home')}
                  className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <span className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-xl">🛒</span>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Browse Products</p>
                    <p className="text-sm text-gray-500">Shop fresh produce from local farmers</p>
                  </div>
                  <span className="ml-auto text-gray-400">→</span>
                </button>

                <button
                  onClick={() => navigate('/consumer/orders')}
                  className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <span className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-xl">📦</span>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">My Orders</p>
                    <p className="text-sm text-gray-500">Track and manage your purchases</p>
                  </div>
                  <span className="ml-auto text-gray-400">→</span>
                </button>
              </div>
            </div>

            {/* Delivery Addresses */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-6">
                <ConsumerAddressManager />
              </div>
            </div>

            {/* Logout */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-6">
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full py-4 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loggingOut ? (
                    <>
                      <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                      Logging out...
                    </>
                  ) : (
                    <>
                      <span>🚪</span> Logout
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Account Info Footer */}
            <div className="text-center text-sm text-gray-400 py-4">
              <p>Member since {new Date(displayUser.createdAt || Date.now()).toLocaleDateString()}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
