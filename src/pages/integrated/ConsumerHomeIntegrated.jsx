import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAvailableProducts, useConsumerOrders, useNotifications } from '../../hooks/useData';
import { orderAPI } from '../../services/api';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

/** Reverse geocode lat/lng via Nominatim (free, no API key) */
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const a = data.address || {};
    return {
      address: [a.road, a.neighbourhood, a.suburb, a.hamlet, a.village].filter(Boolean).join(', ') || data.display_name?.split(',').slice(0, 3).join(',') || '',
      city: a.city || a.town || a.county || a.state_district || '',
      state: a.state || '',
      pincode: a.postcode || '',
    };
  } catch {
    return null;
  }
}

/** Leaflet child component that captures map clicks */
function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng);
    },
  });
  return null;
}

// Category definitions for filtering
const CATEGORIES = [
  { id: 'all', label: 'All', icon: '🛒', color: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
  { id: 'vegetables', label: 'Vegetables', icon: '🥬', color: 'bg-green-100 text-green-700 hover:bg-green-200' },
  { id: 'fruits', label: 'Fruits', icon: '🍎', color: 'bg-red-100 text-red-700 hover:bg-red-200' },
  { id: 'cereals', label: 'Cereals', icon: '🌾', color: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
  { id: 'pulses', label: 'Pulses', icon: '🫘', color: 'bg-orange-100 text-orange-700 hover:bg-orange-200' },
];

// Map product names to categories (simple keyword matching)
function getProductCategory(productName) {
  const name = productName.toLowerCase();
  
  // Vegetables
  if (['tomato', 'potato', 'onion', 'carrot', 'cabbage', 'spinach', 'brinjal', 'cauliflower', 'beans', 'peas', 'okra', 'ladyfinger', 'cucumber', 'capsicum', 'pepper'].some(v => name.includes(v))) {
    return 'vegetables';
  }
  
  // Fruits
  if (['apple', 'mango', 'banana', 'orange', 'grapes', 'papaya', 'guava', 'watermelon', 'pomegranate', 'pineapple', 'strawberry', 'kiwi', 'lemon', 'lime'].some(f => name.includes(f))) {
    return 'fruits';
  }
  
  // Cereals
  if (['wheat', 'rice', 'maize', 'corn', 'barley', 'oats', 'millet', 'bajra', 'jowar', 'ragi'].some(c => name.includes(c))) {
    return 'cereals';
  }
  
  // Pulses
  if (['dal', 'lentil', 'chana', 'chickpea', 'moong', 'masoor', 'urad', 'toor', 'arhar', 'rajma', 'kidney', 'black gram', 'green gram'].some(p => name.includes(p))) {
    return 'pulses';
  }
  
  return 'other';
}

/**
 * API-Integrated Consumer Home
 * Features: Category shortcuts, Notifications, Product browsing, Direct ordering
 */
export function ConsumerHomeIntegrated() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { products, loading, error, refetch } = useAvailableProducts();
  const { orders, refetch: refetchOrders } = useConsumerOrders();
  const { notifications, loading: notifLoading } = useNotifications();

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [ordering, setOrdering] = useState(false);
  const [orderError, setOrderError] = useState(null);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState({
    address: '',
    city: '',
    state: '',
    pincode: '',
    coordinates: null, // { lat, lng }
  });
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapMarker, setMapMarker] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState(null);

  // Handle "Current Location" click
  const handleCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const geo = await reverseGeocode(latitude, longitude);
        if (geo) {
          setDeliveryLocation(prev => ({
            ...prev,
            address: geo.address || prev.address,
            city: geo.city || prev.city,
            state: geo.state || prev.state,
            pincode: geo.pincode || prev.pincode,
            coordinates: { lat: latitude, lng: longitude },
          }));
          setMapMarker({ lat: latitude, lng: longitude });
        } else {
          setDeliveryLocation(prev => ({
            ...prev,
            coordinates: { lat: latitude, lng: longitude },
          }));
          setMapMarker({ lat: latitude, lng: longitude });
          setGeoError('Got your location but could not resolve address. Please fill in remaining fields.');
        }
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(err.code === 1 ? 'Location permission denied. Please allow access.' : 'Could not get your location. Please try again.');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Handle map click for pin placement
  const handleMapLocationSelect = useCallback(async (latlng) => {
    const { lat, lng } = latlng;
    setMapMarker({ lat, lng });
    setDeliveryLocation(prev => ({ ...prev, coordinates: { lat, lng } }));
    const geo = await reverseGeocode(lat, lng);
    if (geo) {
      setDeliveryLocation(prev => ({
        ...prev,
        address: geo.address || prev.address,
        city: geo.city || prev.city,
        state: geo.state || prev.state,
        pincode: geo.pincode || prev.pincode,
        coordinates: { lat, lng },
      }));
    }
  }, []);

  // Filter and sort products
  const filteredProducts = products
    .filter(p => {
      // Search filter
      if (search.trim() && !p.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      // Category filter
      if (selectedCategory !== 'all') {
        const productCategory = getProductCategory(p.name);
        if (productCategory !== selectedCategory) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'price_low') return a.price - b.price;
      if (sortBy === 'price_high') return b.price - a.price;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  // Recent notifications (last 5)
  const recentNotifications = notifications.slice(0, 5);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleOrder = async () => {
    if (!selectedProduct) return;
    if (!deliveryLocation.address.trim() || !deliveryLocation.city.trim() || !deliveryLocation.state.trim() || !deliveryLocation.pincode.trim()) {
      setOrderError('Please fill in all delivery location fields.');
      return;
    }
    if (!/^\d{6}$/.test(deliveryLocation.pincode.trim())) {
      setOrderError('Please enter a valid 6-digit pincode.');
      return;
    }

    try {
      setOrdering(true);
      setOrderError(null);

      await orderAPI.create({
        items: [{ productId: selectedProduct._id, quantity: orderQuantity }],
        paymentMode: 'COD',
        deliveryLocation: {
          address: deliveryLocation.address.trim(),
          city: deliveryLocation.city.trim(),
          state: deliveryLocation.state.trim(),
          pincode: deliveryLocation.pincode.trim(),
          ...(deliveryLocation.coordinates ? { coordinates: deliveryLocation.coordinates } : {}),
        }
      });

      setOrderSuccess(`Order placed for ${orderQuantity} ${selectedProduct.unit} of ${selectedProduct.name}!`);
      setSelectedProduct(null);
      setOrderQuantity(1);
      setDeliveryLocation({ address: '', city: '', state: '', pincode: '', coordinates: null });
      setMapMarker(null);
      setShowMapPicker(false);
      refetch();
      refetchOrders();

      // Clear success message after 3 seconds
      setTimeout(() => setOrderSuccess(null), 3000);
    } catch (err) {
      setOrderError(err.message);
    } finally {
      setOrdering(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-green-900 via-green-800 to-green-900 text-white py-8 px-4 mb-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold">Fresh from Farmers</h1>
              <p className="text-green-200 mt-1">
                Welcome, {user?.name || 'Consumer'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Notifications Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                >
                  <span className="text-xl">🔔</span>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              </div>
              <button
                onClick={() => navigate('/consumer/orders')}
                className="px-4 py-2 bg-white/20 text-white rounded-md hover:bg-white/30"
              >
                My Orders ({orders.length})
              </button>
              <button
                onClick={() => navigate('/consumer/profile')}
                className="px-4 py-2 bg-white/20 text-white rounded-md hover:bg-white/30"
              >
                Profile
              </button>
            </div>
          </div>

          {/* Category Shortcuts */}
          <div className="mt-6 flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-full font-medium text-sm transition-all flex items-center gap-2 ${
                  selectedCategory === cat.id
                    ? 'bg-white text-green-800 shadow-lg scale-105'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications Dropdown */}
      {showNotifications && (
        <div className="fixed inset-0 z-50" onClick={() => setShowNotifications(false)}>
          <div 
            className="absolute right-4 top-20 w-80 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <span className="font-semibold text-gray-800">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifLoading ? (
                <div className="p-4 text-center text-gray-500">Loading...</div>
              ) : recentNotifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <span className="text-2xl block mb-2">📭</span>
                  No notifications
                </div>
              ) : (
                recentNotifications.map(notif => (
                  <div
                    key={notif._id}
                    className={`p-3 border-b border-gray-100 hover:bg-gray-50 ${!notif.isRead ? 'bg-blue-50' : ''}`}
                  >
                    <p className="text-sm text-gray-800">{notif.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(notif.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success/Error Messages */}
      {orderSuccess && (
        <div className="max-w-7xl mx-auto px-4 mb-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center gap-2">
            <span>✅</span> {orderSuccess}
          </div>
        </div>
      )}

      {orderError && (
        <div className="max-w-7xl mx-auto px-4 mb-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center justify-between">
            <span>❌ {orderError}</span>
            <button onClick={() => setOrderError(null)} className="underline text-sm">Dismiss</button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4">
        {/* Search & Sort */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[250px] relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg bg-white cursor-pointer"
          >
            <option value="recent">✨ Recently Added</option>
            <option value="price_low">💰 Price: Low to High</option>
            <option value="price_high">💎 Price: High to Low</option>
          </select>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-gray-600">Loading products...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">{error}</p>
            <button onClick={refetch} className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm">
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredProducts.length === 0 && (
          <div className="bg-white rounded-lg p-8 text-center shadow-sm">
            <div className="text-5xl mb-4">🌾</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Products Found</h3>
            <p className="text-gray-500">
              {selectedCategory !== 'all' 
                ? `No ${selectedCategory} available. Try another category.`
                : 'Try adjusting your search or check back later.'}
            </p>
            {selectedCategory !== 'all' && (
              <button 
                onClick={() => setSelectedCategory('all')}
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                View All Products
              </button>
            )}
          </div>
        )}

        {/* Products Grid */}
        {!loading && !error && filteredProducts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8">
            {filteredProducts.map((product) => (
              <div 
                key={product._id} 
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all group"
              >
                {/* Product Image */}
                <div 
                  className="h-40 bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center cursor-pointer"
                  onClick={() => navigate(`/consumer/product/${product._id}`)}
                >
                  {product.images && product.images.length > 0 ? (
                    <img 
                      src={product.images[0]} 
                      alt={product.name} 
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <span className="text-5xl opacity-50">🥬</span>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 
                      className="text-lg font-semibold text-gray-900 cursor-pointer hover:text-green-600"
                      onClick={() => navigate(`/consumer/product/${product._id}`)}
                    >
                      {product.name}
                    </h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      CATEGORIES.find(c => c.id === getProductCategory(product.name))?.color || 'bg-gray-100 text-gray-600'
                    }`}>
                      {CATEGORIES.find(c => c.id === getProductCategory(product.name))?.label || 'Other'}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-500 mb-3 flex items-center gap-1">
                    <span>👨‍🌾</span>
                    <span>{product.farmerId?.name || 'Local Farmer'}</span>
                    {product.farmerId?.location && (
                      <>
                        <span className="mx-1">•</span>
                        <span>📍 {product.farmerId.location}</span>
                      </>
                    )}
                  </p>
                  
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <span className="text-2xl font-bold text-green-600">₹{product.price}</span>
                      <span className="text-gray-500">/{product.unit}</span>
                    </div>
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {product.quantity} {product.unit} left
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/consumer/product/${product._id}`)}
                      className="flex-1 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 font-medium"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => setSelectedProduct(product)}
                      className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                    >
                      Order Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Place Order</h3>
            
            {/* Order Error */}
            {orderError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {orderError}
              </div>
            )}
            
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="font-medium text-lg">{selectedProduct.name}</p>
              <p className="text-sm text-gray-500">₹{selectedProduct.price}/{selectedProduct.unit}</p>
              <p className="text-sm text-gray-500">Available: {selectedProduct.quantity} {selectedProduct.unit}</p>
              {selectedProduct.farmerId?.name && (
                <p className="text-sm text-gray-500 mt-2">
                  👨‍🌾 From {selectedProduct.farmerId.name}
                </p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity ({selectedProduct.unit})</label>
              <input
                type="number"
                value={orderQuantity}
                onChange={(e) => setOrderQuantity(Math.max(1, Math.min(selectedProduct.quantity, parseInt(e.target.value) || 1)))}
                min="1"
                max={selectedProduct.quantity}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            {/* Delivery Location */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🚩</span>
                <label className="text-sm font-semibold text-gray-800">Delivery Location</label>
              </div>
              <p className="text-xs text-gray-500 mb-3">Where should this product be delivered?</p>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-600">Address / Landmark *</label>
                    <button
                      type="button"
                      onClick={handleCurrentLocation}
                      disabled={geoLoading}
                      className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-2.5 py-1 rounded-full transition-colors disabled:opacity-50 disabled:cursor-wait"
                    >
                      {geoLoading ? (
                        <><span className="inline-block w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></span> Locating...</>
                      ) : (
                        <>📍 Current Location</>
                      )}
                    </button>
                  </div>
                  {geoError && (
                    <p className="text-xs text-amber-600 mb-1">⚠️ {geoError}</p>
                  )}
                  <textarea
                    value={deliveryLocation.address}
                    onChange={(e) => setDeliveryLocation(prev => ({ ...prev, address: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none text-sm"
                    placeholder="e.g., Flat 201, Green Apartments, MG Road"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMapPicker(prev => !prev)}
                    className="mt-1.5 flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-full transition-colors"
                  >
                    🗺️ {showMapPicker ? 'Hide Map' : 'Choose from Map'}
                  </button>
                  {showMapPicker && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-gray-300" style={{ height: '250px' }}>
                      <MapContainer
                        center={mapMarker ? [mapMarker.lat, mapMarker.lng] : [20.5937, 78.9629]}
                        zoom={mapMarker ? 15 : 5}
                        style={{ height: '100%', width: '100%' }}
                        className="z-0"
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <MapClickHandler onLocationSelect={handleMapLocationSelect} />
                        {mapMarker && <Marker position={[mapMarker.lat, mapMarker.lng]} />}
                      </MapContainer>
                      <p className="text-[10px] text-gray-400 text-center py-1 bg-gray-50">Click on the map to select delivery location</p>
                    </div>
                  )}
                  {deliveryLocation.coordinates && (
                    <p className="text-[10px] text-green-600 mt-1">📌 Coordinates: {deliveryLocation.coordinates.lat.toFixed(5)}, {deliveryLocation.coordinates.lng.toFixed(5)}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">City / Town *</label>
                    <input
                      type="text"
                      value={deliveryLocation.city}
                      onChange={(e) => setDeliveryLocation(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                      placeholder="e.g., Pune"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">State *</label>
                    <input
                      type="text"
                      value={deliveryLocation.state}
                      onChange={(e) => setDeliveryLocation(prev => ({ ...prev, state: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                      placeholder="e.g., Maharashtra"
                    />
                  </div>
                </div>
                <div className="w-1/2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Pincode *</label>
                  <input
                    type="text"
                    value={deliveryLocation.pincode}
                    onChange={(e) => setDeliveryLocation(prev => ({ ...prev, pincode: e.target.value }))}
                    maxLength="6"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    placeholder="e.g., 411001"
                  />
                </div>
              </div>
            </div>

            <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium">Total Amount:</span>
                <span className="font-bold text-2xl text-green-600">₹{(selectedProduct.price * orderQuantity).toFixed(2)}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                <span>💵</span> Payment: Cash on Delivery
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleOrder}
                disabled={ordering}
                className={`flex-1 py-3 rounded-lg font-medium text-white ${
                  ordering ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {ordering ? 'Placing Order...' : '✓ Confirm Order'}
              </button>
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  setOrderQuantity(1);
                  setDeliveryLocation({ address: '', city: '', state: '', pincode: '', coordinates: null });
                  setMapMarker(null);
                  setShowMapPicker(false);
                  setOrderError(null);
                }}
                disabled={ordering}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
