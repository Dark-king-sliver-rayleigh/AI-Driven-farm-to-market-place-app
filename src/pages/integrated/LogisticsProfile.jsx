import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profileAPI } from '../../services/api';

/**
 * Logistics Profile Page
 * Name, Mobile, Vehicle type, Service area, Availability
 */
export function LogisticsProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    vehicleType: 'BIKE',
    serviceArea: '',
    isAvailable: true
  });

  // Fetch profile
  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true);
        const response = await profileAPI.getProfile();
        setProfile(response.user);
        setFormData({
          name: response.user?.name || '',
          phone: response.user?.phone || '',
          vehicleType: response.user?.vehicleType || 'BIKE',
          serviceArea: response.user?.serviceArea || response.user?.location || '',
          isAvailable: response.user?.isAvailable ?? true
        });
      } catch (err) {
        console.error('Failed to fetch profile:', err);
        if (user) {
          setFormData({
            name: user.name || '',
            phone: user.phone || '',
            vehicleType: user.vehicleType || 'BIKE',
            serviceArea: user.serviceArea || user.location || '',
            isAvailable: user.isAvailable ?? true
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

  const handleSave = async () => {
    try {
      setSaving(true);
      await profileAPI.updateProfile(formData);
      setProfile(prev => ({ ...prev, ...formData }));
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const displayUser = profile || user || {};

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 text-white py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => navigate(-1)} className="mb-4 p-2 hover:bg-purple-700 rounded-full">
            ← Back
          </button>
          <div className="text-center">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-4xl">🚚</span>
            </div>
            <h1 className="text-2xl font-bold">{displayUser.name || 'Driver'}</h1>
            <p className="text-purple-200">Logistics Partner</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* Personal Info */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                <h2 className="font-semibold text-gray-900">Personal Information</h2>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-purple-600 text-sm font-medium"
                  >
                    ✏️ Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setIsEditing(false)} className="text-gray-500 text-sm">Cancel</button>
                    <button 
                      onClick={handleSave} 
                      disabled={saving}
                      className="text-purple-600 text-sm font-medium"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
              <div className="p-4 space-y-4">
                {/* Name */}
                <div>
                  <label className="text-sm text-gray-500">Full Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  ) : (
                    <p className="text-lg font-medium text-gray-900">{displayUser.name || '—'}</p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label className="text-sm text-gray-500">Mobile Number</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  ) : (
                    <p className="text-lg font-medium text-gray-900">{displayUser.phone || '—'}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="text-sm text-gray-500">Email</label>
                  <p className="text-lg font-medium text-gray-900">{displayUser.email || '—'}</p>
                </div>
              </div>
            </div>

            {/* Vehicle & Service Info */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Vehicle & Service</h2>
              </div>
              <div className="p-4 space-y-4">
                {/* Vehicle Type */}
                <div>
                  <label className="text-sm text-gray-500">Vehicle Type</label>
                  {isEditing ? (
                    <select
                      value={formData.vehicleType}
                      onChange={(e) => setFormData(prev => ({ ...prev, vehicleType: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="BIKE">🏍️ Motorcycle</option>
                      <option value="SCOOTER">🛵 Scooter</option>
                      <option value="CAR">🚗 Car</option>
                      <option value="VAN">🚐 Van</option>
                      <option value="TRUCK">🚛 Truck</option>
                    </select>
                  ) : (
                    <p className="text-lg font-medium text-gray-900">
                      {formData.vehicleType === 'BIKE' && '🏍️ Motorcycle'}
                      {formData.vehicleType === 'SCOOTER' && '🛵 Scooter'}
                      {formData.vehicleType === 'CAR' && '🚗 Car'}
                      {formData.vehicleType === 'VAN' && '🚐 Van'}
                      {formData.vehicleType === 'TRUCK' && '🚛 Truck'}
                    </p>
                  )}
                </div>

                {/* Service Area */}
                <div>
                  <label className="text-sm text-gray-500">Service Area</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.serviceArea}
                      onChange={(e) => setFormData(prev => ({ ...prev, serviceArea: e.target.value }))}
                      placeholder="e.g., Mumbai, Pune"
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  ) : (
                    <p className="text-lg font-medium text-gray-900">{formData.serviceArea || '—'}</p>
                  )}
                </div>

                {/* Availability Toggle */}
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-gray-900">Available for Deliveries</p>
                    <p className="text-sm text-gray-500">Toggle to go online/offline</p>
                  </div>
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, isAvailable: !prev.isAvailable }))}
                    className={`w-14 h-8 rounded-full transition-colors ${
                      formData.isAvailable ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full shadow transition-transform ${
                      formData.isAvailable ? 'translate-x-7' : 'translate-x-1'
                    }`}></div>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <button
                onClick={() => navigate('/logistics/earnings')}
                className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 mb-3"
              >
                <span className="text-2xl">💰</span>
                <span className="font-medium text-gray-900">View Earnings</span>
                <span className="ml-auto text-gray-400">→</span>
              </button>
              <button
                onClick={() => navigate('/logistics/history')}
                className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100"
              >
                <span className="text-2xl">📜</span>
                <span className="font-medium text-gray-900">Delivery History</span>
                <span className="ml-auto text-gray-400">→</span>
              </button>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full py-4 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 flex items-center justify-center gap-2"
            >
              {loggingOut ? 'Logging out...' : '🚪 Logout'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
