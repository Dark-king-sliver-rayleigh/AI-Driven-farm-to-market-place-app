import { useState } from 'react';
import { productAPI } from '../../services/api';

/**
 * API-integrated form component for adding new products
 * Simplified version focused on essential fields matching backend
 */
export function AddProductFormIntegrated({ onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    quantity: '',
    unit: 'kg',
    price: '',
    status: 'AVAILABLE'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) newErrors.name = 'Product name is required';
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      newErrors.quantity = 'Valid quantity is required';
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      newErrors.price = 'Valid price is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;

    try {
      setLoading(true);
      setError(null);

      const productData = {
        name: formData.name.trim(),
        quantity: parseFloat(formData.quantity),
        unit: formData.unit,
        price: parseFloat(formData.price),
        status: formData.status
      };

      await productAPI.create(productData);
      
      // Reset form
      setFormData({
        name: '',
        quantity: '',
        unit: 'kg',
        price: '',
        status: 'AVAILABLE'
      });
      setErrors({});

      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Add New Product</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Product Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product Name *
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            disabled={loading}
            className={`w-full px-3 py-2 border rounded-md ${
              errors.name ? 'border-red-500' : 'border-gray-300'
            } ${loading ? 'bg-gray-100' : ''}`}
            placeholder="e.g., Fresh Tomatoes"
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
              disabled={loading}
              step="0.01"
              min="0"
              className={`w-full px-3 py-2 border rounded-md ${
                errors.quantity ? 'border-red-500' : 'border-gray-300'
              } ${loading ? 'bg-gray-100' : ''}`}
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
              disabled={loading}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md ${loading ? 'bg-gray-100' : ''}`}
            >
              <option value="kg">kg</option>
              <option value="quintal">quintal</option>
              <option value="dozen">dozen</option>
            </select>
          </div>
        </div>

        {/* Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Price per Unit (₹) *
          </label>
          <input
            type="number"
            name="price"
            value={formData.price}
            onChange={handleInputChange}
            disabled={loading}
            step="0.01"
            min="0"
            className={`w-full px-3 py-2 border rounded-md ${
              errors.price ? 'border-red-500' : 'border-gray-300'
            } ${loading ? 'bg-gray-100' : ''}`}
            placeholder="40"
          />
          {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price}</p>}
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Initial Status
          </label>
          <select
            name="status"
            value={formData.status}
            onChange={handleInputChange}
            disabled={loading}
            className={`w-full px-3 py-2 border border-gray-300 rounded-md ${loading ? 'bg-gray-100' : ''}`}
          >
            <option value="AVAILABLE">Available</option>
            <option value="NOT_HARVESTED">Not Harvested</option>
            <option value="PRE_ORDER">Pre-Order</option>
          </select>
        </div>

        {/* Submit Button */}
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className={`flex-1 py-2 px-4 rounded-md font-medium text-white ${
              loading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Adding...
              </span>
            ) : (
              'Add Product'
            )}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setFormData({
                name: '',
                quantity: '',
                unit: 'kg',
                price: '',
                status: 'AVAILABLE'
              });
              setErrors({});
              setError(null);
            }}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
