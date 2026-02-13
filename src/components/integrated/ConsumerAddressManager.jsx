import React, { useState, useEffect, useCallback } from 'react';
import { locationAPI } from '../../services/api';
import { LocationPicker } from './LocationPicker';

/**
 * ConsumerAddressManager Component
 * 
 * Allows consumers to manage saved delivery addresses.
 * Features:
 * - Add delivery addresses with map
 * - Edit / delete addresses
 * - Set default delivery address
 * - GPS geolocation support
 */
export function ConsumerAddressManager({ onSelect, compact = false }) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const [formData, setFormData] = useState({
    label: 'Home',
    address: '',
    lat: '',
    lng: '',
    isDefault: false
  });

  const fetchAddresses = useCallback(async () => {
    try {
      setLoading(true);
      const response = await locationAPI.getDeliveryAddresses();
      const addrs = response.deliveryAddresses || [];
      setAddresses(addrs);
      
      // Auto-select default
      const def = addrs.find(a => a.isDefault) || addrs[0];
      if (def && !selectedId) {
        setSelectedId(def._id);
        onSelect?.({
          label: def.label,
          address: def.address,
          coordinates: def.coordinates
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onSelect, selectedId]);

  useEffect(() => {
    fetchAddresses();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    setFormData({ label: 'Home', address: '', lat: '', lng: '', isDefault: false });
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
        await locationAPI.updateDeliveryAddress(editingId, payload);
      } else {
        await locationAPI.addDeliveryAddress(payload);
      }

      await fetchAddresses();
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (addr) => {
    setFormData({
      label: addr.label || 'Home',
      address: addr.address || '',
      lat: addr.coordinates?.lat || '',
      lng: addr.coordinates?.lng || '',
      isDefault: addr.isDefault || false
    });
    setEditingId(addr._id);
    setShowAddForm(true);
  };

  const handleDelete = async (addressId) => {
    if (!confirm('Delete this address?')) return;
    try {
      await locationAPI.deleteDeliveryAddress(addressId);
      await fetchAddresses();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSelectAddress = (addr) => {
    setSelectedId(addr._id);
    onSelect?.({
      label: addr.label,
      address: addr.address,
      coordinates: addr.coordinates
    });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">Loading addresses...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className={`font-bold text-gray-800 flex items-center gap-2 ${compact ? 'text-sm' : 'text-lg'}`}>
          <span>🏠</span> Delivery Addresses
        </h3>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
          >
            + Add Address
          </button>
        )}
      </div>

      {error && (
        <div className="p-2 bg-red-50 text-red-600 rounded-lg text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-bold">×</button>
        </div>
      )}

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-5">
          <h4 className="text-md font-semibold text-gray-800 mb-3">
            {editingId ? 'Edit Address' : 'Add New Address'}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
              <select
                value={formData.label}
                onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="Home">Home</option>
                <option value="Work">Work</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <LocationPicker
              value={{
                address: formData.address,
                lat: formData.lat,
                lng: formData.lng
              }}
              onChange={(loc) => {
                setFormData(prev => ({ ...prev, address: loc.address, lat: loc.lat, lng: loc.lng }));
              }}
              label="Delivery Location"
              placeholder="Enter delivery address..."
              showMap={!compact}
            />

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Set as default address</span>
            </label>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {saving ? 'Saving...' : (editingId ? 'Update' : 'Save Address')}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Saved Addresses */}
      {addresses.length === 0 && !showAddForm ? (
        <div className="bg-gray-50 rounded-xl p-6 text-center">
          <span className="text-3xl block mb-2">🏠</span>
          <p className="text-gray-500 text-sm">No saved addresses. Add one for faster checkout.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {addresses.map((addr) => (
            <div
              key={addr._id}
              onClick={() => onSelect && handleSelectAddress(addr)}
              className={`bg-white rounded-lg shadow-sm p-3 border-2 transition-all cursor-pointer ${
                selectedId === addr._id
                  ? 'border-blue-400 bg-blue-50/30'
                  : addr.isDefault
                    ? 'border-green-200'
                    : 'border-transparent hover:border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span>{addr.label === 'Home' ? '🏠' : addr.label === 'Work' ? '🏢' : '📍'}</span>
                    <span className="font-semibold text-gray-800 text-sm">{addr.label}</span>
                    {addr.isDefault && (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Default</span>
                    )}
                    {selectedId === addr._id && onSelect && (
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">Selected</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 ml-6">{addr.address}</p>
                  <p className="text-xs text-gray-400 ml-6">
                    {addr.coordinates?.lat?.toFixed(4)}, {addr.coordinates?.lng?.toFixed(4)}
                  </p>
                </div>

                {!compact && (
                  <div className="flex items-center gap-1 ml-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(addr); }}
                      className="p-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(addr._id); }}
                      className="p-1 text-xs text-red-600 hover:bg-red-50 rounded"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ConsumerAddressManager;
