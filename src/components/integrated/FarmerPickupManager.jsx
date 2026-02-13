import React, { useState, useEffect, useCallback } from 'react';
import { locationAPI } from '../../services/api';
import { LocationPicker } from './LocationPicker';

/**
 * FarmerPickupManager Component
 * 
 * Allows farmers to manage multiple pickup point locations.
 * Features:
 * - Add new pickup locations with map
 * - Edit existing locations
 * - Set default pickup point
 * - Delete locations
 * - Share current GPS location
 */
export function FarmerPickupManager() {
  const [pickupLocations, setPickupLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    label: 'Farm',
    address: '',
    lat: '',
    lng: '',
    isDefault: false
  });

  // Fetch pickup locations
  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await locationAPI.getPickupLocations();
      setPickupLocations(response.pickupLocations || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const resetForm = () => {
    setFormData({ label: 'Farm', address: '', lat: '', lng: '', isDefault: false });
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.address || !formData.lat || !formData.lng) {
      setError('Please provide address and coordinates');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        label: formData.label,
        address: formData.address,
        lat: Number(formData.lat),
        lng: Number(formData.lng),
        isDefault: formData.isDefault
      };

      if (editingId) {
        await locationAPI.updatePickupLocation(editingId, payload);
      } else {
        await locationAPI.addPickupLocation(payload);
      }

      await fetchLocations();
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (location) => {
    setFormData({
      label: location.label || 'Farm',
      address: location.address || '',
      lat: location.coordinates?.lat || '',
      lng: location.coordinates?.lng || '',
      isDefault: location.isDefault || false
    });
    setEditingId(location._id);
    setShowAddForm(true);
  };

  const handleDelete = async (locationId) => {
    if (!confirm('Delete this pickup location?')) return;
    try {
      await locationAPI.deletePickupLocation(locationId);
      await fetchLocations();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSetDefault = async (locationId) => {
    try {
      await locationAPI.updatePickupLocation(locationId, { isDefault: true });
      await fetchLocations();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-500">Loading pickup locations...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <span>📍</span> Pickup Locations
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Set where logistics drivers should collect your products
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors text-sm"
          >
            + Add Location
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-bold">×</button>
        </div>
      )}

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-green-200 p-6">
          <h4 className="text-md font-semibold text-gray-800 mb-4">
            {editingId ? 'Edit Pickup Location' : 'Add New Pickup Location'}
          </h4>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Label */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location Label</label>
              <select
                value={formData.label}
                onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="Farm">Farm</option>
                <option value="Warehouse">Warehouse</option>
                <option value="Cold Storage">Cold Storage</option>
                <option value="Market Yard">Market Yard</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Location Picker */}
            <LocationPicker
              value={{
                address: formData.address,
                lat: formData.lat,
                lng: formData.lng
              }}
              onChange={(loc) => {
                setFormData(prev => ({
                  ...prev,
                  address: loc.address,
                  lat: loc.lat,
                  lng: loc.lng
                }));
              }}
              label="Pickup Point"
              placeholder="Enter farm/warehouse address..."
            />

            {/* Default Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">Set as default pickup location</span>
            </label>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : (editingId ? 'Update' : 'Save Location')}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Saved Locations List */}
      {pickupLocations.length === 0 && !showAddForm ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <span className="text-4xl block mb-3">📍</span>
          <p className="text-gray-600 mb-2">No pickup locations set</p>
          <p className="text-sm text-gray-400">
            Add your farm or warehouse location so drivers know where to collect products.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pickupLocations.map((location) => (
            <div
              key={location._id}
              className={`bg-white rounded-xl shadow-sm p-4 border-2 transition-colors ${
                location.isDefault ? 'border-green-400 bg-green-50/30' : 'border-transparent'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">
                      {location.label === 'Farm' ? '🌾' :
                       location.label === 'Warehouse' ? '🏭' :
                       location.label === 'Cold Storage' ? '❄️' :
                       location.label === 'Market Yard' ? '🏪' : '📍'}
                    </span>
                    <span className="font-semibold text-gray-800">{location.label}</span>
                    {location.isDefault && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 ml-8">{location.address}</p>
                  <p className="text-xs text-gray-400 ml-8 mt-1">
                    {location.coordinates?.lat?.toFixed(4)}, {location.coordinates?.lng?.toFixed(4)}
                  </p>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {!location.isDefault && (
                    <button
                      onClick={() => handleSetDefault(location._id)}
                      className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded transition-colors"
                      title="Set as default"
                    >
                      ⭐ Default
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(location)}
                    className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDelete(location._id)}
                    className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FarmerPickupManager;
