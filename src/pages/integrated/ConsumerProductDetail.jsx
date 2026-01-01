import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { productAPI, orderAPI } from '../../services/api';
import { useEffect } from 'react';

/**
 * Consumer Product Detail Page
 * Features: Image gallery, Farmer info, Price/quantity, Delivery expectation, Direct ordering
 */
export function ConsumerProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedImage, setSelectedImage] = useState(0);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [ordering, setOrdering] = useState(false);
  const [orderError, setOrderError] = useState(null);
  const [orderSuccess, setOrderSuccess] = useState(null);

  // Fetch product on mount
  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true);
        setError(null);
        const response = await productAPI.getById(id);
        setProduct(response.product);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [id]);

  const handleOrder = async () => {
    if (!product) return;

    try {
      setOrdering(true);
      setOrderError(null);

      await orderAPI.create({
        items: [{ productId: product._id, quantity: orderQuantity }],
        paymentMode: 'COD'
      });

      setOrderSuccess(`Order placed successfully! ${orderQuantity} ${product.unit} of ${product.name}`);
      
      // Redirect to orders after 2 seconds
      setTimeout(() => {
        navigate('/consumer/orders');
      }, 2000);
    } catch (err) {
      setOrderError(err.message);
    } finally {
      setOrdering(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading product...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <span className="text-5xl block mb-4">❌</span>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Failed to load product</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/consumer/home')}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Product not found
  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <span className="text-5xl block mb-4">🔍</span>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Product not found</h2>
          <p className="text-gray-600 mb-4">This product may have been removed.</p>
          <button
            onClick={() => navigate('/consumer/home')}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Browse Products
          </button>
        </div>
      </div>
    );
  }

  const images = product.images && product.images.length > 0 ? product.images : [];
  const farmer = product.farmerId || {};

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <span className="text-xl">←</span>
            </button>
            <h1 className="text-xl font-semibold text-gray-900 truncate">{product.name}</h1>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {orderSuccess && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="p-4 bg-green-100 border border-green-300 rounded-lg text-green-800 flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="font-medium">{orderSuccess}</p>
              <p className="text-sm">Redirecting to your orders...</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {orderError && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center justify-between">
            <span>❌ {orderError}</span>
            <button onClick={() => setOrderError(null)} className="underline text-sm">Dismiss</button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Image Gallery */}
          <div>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Main Image */}
              <div className="aspect-square bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center">
                {images.length > 0 ? (
                  <img 
                    src={images[selectedImage]} 
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center">
                    <span className="text-8xl opacity-30">🥬</span>
                    <p className="text-gray-400 mt-2">No image available</p>
                  </div>
                )}
              </div>

              {/* Thumbnail Strip */}
              {images.length > 1 && (
                <div className="p-4 flex gap-2 overflow-x-auto">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImage(idx)}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                        selectedImage === idx ? 'border-green-500 ring-2 ring-green-200' : 'border-gray-200 hover:border-green-300'
                      }`}
                    >
                      <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Product Info */}
          <div className="space-y-6">
            {/* Price Section */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-bold text-green-600">₹{product.price}</span>
                <span className="text-xl text-gray-500">/ {product.unit}</span>
              </div>
              
              <div className="flex items-center gap-2 text-gray-600 mb-4">
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                  {product.quantity} {product.unit} available
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  product.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {product.status === 'AVAILABLE' ? '✓ In Stock' : product.status}
                </span>
              </div>

              {/* Quantity Selector */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Quantity ({product.unit})</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setOrderQuantity(Math.max(1, orderQuantity - 1))}
                    className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center text-xl hover:bg-gray-100"
                    disabled={orderQuantity <= 1}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={orderQuantity}
                    onChange={(e) => setOrderQuantity(Math.max(1, Math.min(product.quantity, parseInt(e.target.value) || 1)))}
                    min="1"
                    max={product.quantity}
                    className="w-20 text-center py-2 border border-gray-300 rounded-lg font-medium text-lg"
                  />
                  <button
                    onClick={() => setOrderQuantity(Math.min(product.quantity, orderQuantity + 1))}
                    className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center text-xl hover:bg-gray-100"
                    disabled={orderQuantity >= product.quantity}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Total */}
              <div className="bg-green-50 rounded-lg p-4 mb-4 border border-green-200">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">Total Amount:</span>
                  <span className="text-3xl font-bold text-green-600">₹{(product.price * orderQuantity).toFixed(2)}</span>
                </div>
              </div>

              {/* Place Order Button */}
              <button
                onClick={handleOrder}
                disabled={ordering || product.status !== 'AVAILABLE'}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                  ordering || product.status !== 'AVAILABLE'
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700 shadow-lg hover:shadow-xl'
                }`}
              >
                {ordering ? 'Placing Order...' : '🛒 Place Order (Cash on Delivery)'}
              </button>
            </div>

            {/* Farmer Details */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span>👨‍🌾</span> Farmer Details
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-2xl">
                    👨‍🌾
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{farmer.name || 'Local Farmer'}</p>
                    <p className="text-sm text-gray-500">Verified Seller</p>
                  </div>
                </div>
                {farmer.phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <span>📞</span>
                    <span>{farmer.phone}</span>
                  </div>
                )}
                {farmer.location && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <span>📍</span>
                    <span>{farmer.location}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Info */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span>🚚</span> Delivery Information
              </h3>
              <div className="space-y-3 text-gray-600">
                <div className="flex items-start gap-3">
                  <span className="text-green-500 text-lg">✓</span>
                  <div>
                    <p className="font-medium text-gray-900">Fresh Delivery</p>
                    <p className="text-sm">Products are picked and delivered fresh from the farm</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-green-500 text-lg">✓</span>
                  <div>
                    <p className="font-medium text-gray-900">Estimated Time</p>
                    <p className="text-sm">Usually within 24-48 hours depending on location</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-green-500 text-lg">✓</span>
                  <div>
                    <p className="font-medium text-gray-900">Cash on Delivery</p>
                    <p className="text-sm">Pay when you receive your order</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
