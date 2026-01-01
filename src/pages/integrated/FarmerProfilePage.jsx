import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profileAPI } from '../../services/api';

/**
 * Farmer Profile Page
 * Edit profile info: name, address, farm area, profile photo
 */
export function FarmerProfilePage() {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    farmArea: '',
    profilePhoto: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Load profile data on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const response = await profileAPI.getProfile();
        const userData = response.user;
        setFormData({
          name: userData.name || '',
          address: userData.address || '',
          farmArea: userData.farmArea || '',
          profilePhoto: userData.profilePhoto || ''
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setSuccess(null);
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setFormData(prev => ({ ...prev, profilePhoto: event.target.result }));
      setError(null);
      setSuccess(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await profileAPI.updateProfile({
        name: formData.name.trim(),
        address: formData.address.trim(),
        farmArea: formData.farmArea.trim(),
        profilePhoto: formData.profilePhoto
      });

      // Update auth context if available
      if (updateUser && response.user) {
        updateUser(response.user);
      }

      setSuccess('Profile updated successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/farmer/settings"
          className="text-2xl text-gray-600 hover:text-gray-800"
        >
          ←
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">👤 My Profile</h1>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-600">
            {success}
          </div>
        )}

        {/* Profile Photo */}
        <div className="flex flex-col items-center">
          <div className="relative mb-3">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 border-4 border-white shadow-lg">
              {formData.profilePhoto ? (
                <img
                  src={formData.profilePhoto}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl text-gray-400">
                  👤
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-green-600"
            >
              📷
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
          />
          <p className="text-xs text-gray-500">Tap to change photo</p>
        </div>

        {/* Mobile Number (read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mobile Number
          </label>
          <input
            type="text"
            value={user?.phone || ''}
            disabled
            className="w-full px-4 py-3 text-lg border-2 border-gray-200 rounded-xl bg-gray-100 text-gray-600"
          />
          <p className="text-xs text-gray-500 mt-1">Mobile number cannot be changed</p>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Full Name
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            disabled={saving}
            className="w-full px-4 py-3 text-lg border-2 border-gray-200 rounded-xl focus:border-green-500 outline-none transition-colors"
            placeholder="Enter your name"
          />
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Address
          </label>
          <textarea
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            disabled={saving}
            rows={3}
            className="w-full px-4 py-3 text-lg border-2 border-gray-200 rounded-xl focus:border-green-500 outline-none transition-colors resize-none"
            placeholder="Enter your address"
          />
        </div>

        {/* Farm Area */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Farm Area / Location
          </label>
          <input
            type="text"
            name="farmArea"
            value={formData.farmArea}
            onChange={handleInputChange}
            disabled={saving}
            className="w-full px-4 py-3 text-lg border-2 border-gray-200 rounded-xl focus:border-green-500 outline-none transition-colors"
            placeholder="e.g., 5 acres in Karnataka"
          />
        </div>

        {/* Save Button */}
        <button
          type="submit"
          disabled={saving}
          className={`w-full py-4 rounded-xl font-bold text-lg text-white transition-all ${
            saving
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl'
          }`}
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </span>
          ) : (
            '✓ Save Changes'
          )}
        </button>
      </form>
    </div>
  );
}
