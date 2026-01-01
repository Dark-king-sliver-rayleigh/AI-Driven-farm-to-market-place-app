import { useState, useMemo } from 'react';
import { productAPI } from '../../services/api';
import { CategorySelector, CATEGORY_COMMODITIES } from './CategorySelector';
import { ImageUploader } from './ImageUploader';

/**
 * Enhanced Add Product Component
 * Multi-step product creation flow for farmers
 * 
 * Props:
 * - onSuccess: () => void - callback after successful creation
 * - onCancel: () => void - callback to cancel and go back
 */
export function AddProductEnhanced({ onSuccess, onCancel }) {
  // Step management
  const [step, setStep] = useState(1); // 1 = category, 2 = details

  // Form state
  const [category, setCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    quantity: '',
    unit: 'kg',
    price: '',
    status: 'AVAILABLE',
    images: []
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Get commodity suggestions for selected category
  const commoditySuggestions = useMemo(() => {
    return category ? CATEGORY_COMMODITIES[category] || [] : [];
  }, [category]);

  // Filter suggestions based on input
  const [showSuggestions, setShowSuggestions] = useState(false);
  const filteredSuggestions = useMemo(() => {
    if (!formData.name.trim()) return commoditySuggestions;
    const query = formData.name.toLowerCase();
    return commoditySuggestions.filter(s => 
      s.toLowerCase().includes(query)
    );
  }, [commoditySuggestions, formData.name]);

  // Handlers
  const handleCategorySelect = (cat) => {
    setCategory(cat);
    setStep(2); // Move to details step
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setFormData(prev => ({ ...prev, name: suggestion }));
    setShowSuggestions(false);
    setErrors(prev => ({ ...prev, name: null }));
  };

  const handleImagesChange = (images) => {
    setFormData(prev => ({ ...prev, images }));
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
      setSubmitError(null);

      const productData = {
        name: formData.name.trim(),
        quantity: parseFloat(formData.quantity),
        unit: formData.unit,
        price: parseFloat(formData.price),
        status: formData.status,
        images: formData.images,
        category: category
      };

      await productAPI.create(productData);
      
      if (onSuccess) onSuccess();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (step === 2) {
      setStep(1);
    } else if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 max-w-2xl mx-auto">
      {/* Header with step indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 text-lg"
          >
            <span>←</span> Back
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold
              ${step >= 1 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              1
            </div>
            <div className="w-8 h-1 bg-gray-200">
              <div className={`h-full ${step >= 2 ? 'bg-green-500' : ''}`} />
            </div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold
              ${step >= 2 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              2
            </div>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-800">
          {step === 1 ? 'Add New Product' : `Add ${category ? category.charAt(0).toUpperCase() + category.slice(1) : ''}`}
        </h1>
      </div>

      {/* Step 1: Category Selection */}
      {step === 1 && (
        <CategorySelector 
          selectedCategory={category}
          onSelect={handleCategorySelect}
        />
      )}

      {/* Step 2: Product Details */}
      {step === 2 && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Submit error */}
          {submitError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
              {submitError}
            </div>
          )}

          {/* Product Name with suggestions */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              disabled={loading}
              className={`w-full px-4 py-3 text-lg border-2 rounded-xl ${
                errors.name ? 'border-red-500' : 'border-gray-200 focus:border-green-500'
              } outline-none transition-colors`}
              placeholder="e.g., Fresh Tomatoes"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            
            {/* Suggestions dropdown */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {filteredSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full px-4 py-2 text-left hover:bg-green-50 hover:text-green-700 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quantity and Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                className={`w-full px-4 py-3 text-lg border-2 rounded-xl ${
                  errors.quantity ? 'border-red-500' : 'border-gray-200 focus:border-green-500'
                } outline-none transition-colors`}
                placeholder="100"
              />
              {errors.quantity && <p className="text-red-500 text-sm mt-1">{errors.quantity}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unit *
              </label>
              <select
                name="unit"
                value={formData.unit}
                onChange={handleInputChange}
                disabled={loading}
                className="w-full px-4 py-3 text-lg border-2 border-gray-200 rounded-xl focus:border-green-500 outline-none"
              >
                <option value="kg">kg</option>
                <option value="quintal">quintal</option>
                <option value="dozen">dozen</option>
                <option value="piece">piece</option>
              </select>
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price per Unit (₹) *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">₹</span>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                disabled={loading}
                step="0.01"
                min="0"
                className={`w-full pl-10 pr-4 py-3 text-lg border-2 rounded-xl ${
                  errors.price ? 'border-red-500' : 'border-gray-200 focus:border-green-500'
                } outline-none transition-colors`}
                placeholder="40"
              />
            </div>
            {errors.price && <p className="text-red-500 text-sm mt-1">{errors.price}</p>}
            <p className="text-xs text-gray-500 mt-1">
              💡 You set your own price. We do not auto-fill prices.
            </p>
          </div>

          {/* Image Upload */}
          <ImageUploader
            images={formData.images}
            onChange={handleImagesChange}
            maxImages={3}
          />

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Availability Status
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'AVAILABLE', label: 'Available', icon: '✅' },
                { value: 'NOT_HARVESTED', label: 'Not Harvested', icon: '🌱' },
                { value: 'PRE_ORDER', label: 'Pre-Order', icon: '📅' }
              ].map((status) => (
                <button
                  key={status.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, status: status.value }))}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    formData.status === status.value
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl block mb-1">{status.icon}</span>
                  <span className="text-sm font-medium">{status.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold text-lg text-white transition-all ${
              loading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Adding Product...
              </span>
            ) : (
              '✓ Add Product'
            )}
          </button>
        </form>
      )}
    </div>
  );
}
