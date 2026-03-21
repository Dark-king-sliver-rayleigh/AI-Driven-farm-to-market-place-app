/**
 * API Configuration and utilities
 */
const API_BASE = 'http://localhost:5000/api';

/**
 * Get stored auth token
 */
function getToken() {
  return sessionStorage.getItem('authToken');
}

/**
 * Create headers with auth token
 */
function authHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
}

/**
 * Handle API response
 * @throws Error with message from API or generic error
 */
async function handleResponse(response) {
  const data = await response.json();
  
  if (!response.ok) {
    // Handle 401 - redirect to login
    if (response.status === 401) {
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('authUser');
      window.location.href = '/login';
      throw new Error(data.error?.message || 'Session expired. Please login again.');
    }
    
    // Handle 403 - access denied
    if (response.status === 403) {
      throw new Error(data.error?.message || 'Access denied. You do not have permission.');
    }
    
    // Handle other errors
    throw new Error(data.error?.message || data.message || 'An error occurred');
  }
  
  return data;
}

/**
 * API request helper
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: authHeaders(),
    ...options
  };
  
  const response = await fetch(url, config);
  return handleResponse(response);
}

// ============================================
// PRODUCT API
// ============================================

export const productAPI = {
  /**
   * Get all available products (for consumers)
   * GET /api/products
   */
  async getAvailable() {
    return apiRequest('/products');
  },

  /**
   * Get single product by ID
   * GET /api/products/:id
   */
  async getById(productId) {
    return apiRequest(`/products/${productId}`);
  },

  /**
   * Get farmer's own products
   * GET /api/farmer/products
   */
  async getMyProducts() {
    return apiRequest('/farmer/products');
  },

  /**
   * Create a new product (farmer only)
   * POST /api/farmer/products
   */
  async create(productData) {
    return apiRequest('/farmer/products', {
      method: 'POST',
      body: JSON.stringify(productData)
    });
  },

  /**
   * Update product status (farmer only)
   * PATCH /api/farmer/products/:id/status
   */
  async updateStatus(productId, status) {
    return apiRequest(`/farmer/products/${productId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  /**
   * Delete product (soft delete) (farmer only)
   * DELETE /api/farmer/products/:productId
   */
  async delete(productId) {
    return apiRequest(`/farmer/products/${productId}`, {
      method: 'DELETE'
    });
  },

  /**
   * Add quantity to product (restock) (farmer only)
   * PATCH /api/farmer/products/:productId/add-quantity
   */
  async addQuantity(productId, quantity) {
    return apiRequest(`/farmer/products/${productId}/add-quantity`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity })
    });
  }
};

// ============================================
// ORDER API
// ============================================

export const orderAPI = {
  /**
   * Create a new order (consumer only)
   * POST /api/orders
   */
  async create(orderData) {
    return apiRequest('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  },

  /**
   * Get consumer's orders
   * GET /api/consumer/orders
   */
  async getConsumerOrders() {
    return apiRequest('/consumer/orders');
  },

  /**
   * Get farmer's orders
   * GET /api/farmer/orders
   */
  async getFarmerOrders() {
    return apiRequest('/farmer/orders');
  },

  /**
   * Get order by ID
   * GET /api/orders/:id
   */
  async getById(orderId) {
    return apiRequest(`/orders/${orderId}`);
  },

  /**
   * Cancel an order (consumer only)
   * DELETE /api/consumer/orders/:orderId
   */
  async cancel(orderId, reason = '') {
    return apiRequest(`/consumer/orders/${orderId}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason })
    });
  },

  /**
   * Get order delivery timeline
   * GET /api/orders/:id/timeline
   */
  async getTimeline(orderId) {
    return apiRequest(`/orders/${orderId}/timeline`);
  }
};

// ============================================
// LOGISTICS API
// ============================================

export const logisticsAPI = {
  /**
   * Get available orders for pickup
   * GET /api/logistics/orders?status=CREATED
   */
  async getAvailableOrders(status = 'CREATED') {
    return apiRequest(`/logistics/orders?status=${status}`);
  },

  /**
   * Get driver's assigned deliveries
   * GET /api/logistics/my-deliveries
   */
  async getMyDeliveries() {
    return apiRequest('/logistics/my-deliveries');
  },

  /**
   * Accept an order for delivery
   * POST /api/logistics/orders/:orderId/accept
   */
  async acceptOrder(orderId, locationData) {
    return apiRequest(`/logistics/orders/${orderId}/accept`, {
      method: 'POST',
      body: JSON.stringify(locationData || {})
    });
  },

  /**
   * Reject an order
   * POST /api/logistics/orders/:orderId/reject
   */
  async rejectOrder(orderId, reason) {
    return apiRequest(`/logistics/orders/${orderId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  /**
   * Update delivery status
   * PATCH /api/logistics/orders/:orderId/status
   */
  async updateStatus(orderId, status) {
    return apiRequest(`/logistics/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  /**
   * Get delayed deliveries
   * GET /api/logistics/delayed
   */
  async getDelayedDeliveries() {
    return apiRequest('/logistics/delayed');
  },

  /**
   * Get delivery audit events
   * GET /api/logistics/deliveries/:id/events
   */
  async getDeliveryEvents(deliveryId) {
    return apiRequest(`/logistics/deliveries/${deliveryId}/events`);
  },

  /**
   * Initiate reassignment for a delivery
   * POST /api/logistics/deliveries/:id/reassign
   */
  async initiateReassignment(deliveryId, reason) {
    return apiRequest(`/logistics/deliveries/${deliveryId}/reassign`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }
};

// ============================================
// SYSTEM API
// ============================================

export const systemAPI = {
  /**
   * Get system stats
   * GET /system/stats
   */
  async getStats() {
    const response = await fetch('http://localhost:5000/system/stats');
    return handleResponse(response);
  },

  /**
   * Health check
   * GET /system/health
   */
  async healthCheck() {
    const response = await fetch('http://localhost:5000/system/health');
    return handleResponse(response);
  }
};

// ============================================
// PRICE INSIGHT API (Farmer only)
// ============================================

export const priceInsightAPI = {
  /**
   * Get price insight for a commodity at a mandi
   * GET /api/farmer/price-insight?commodity=X&mandi=Y
   */
  async getInsight(commodity, mandi) {
    return apiRequest(`/farmer/price-insight?commodity=${encodeURIComponent(commodity)}&mandi=${encodeURIComponent(mandi)}`);
  },

  /**
   * Get list of available commodities
   * GET /api/farmer/price-insight/commodities
   */
  async getCommodities() {
    return apiRequest('/farmer/price-insight/commodities');
  },

  /**
   * Get list of mandis for a commodity
   * GET /api/farmer/price-insight/mandis?commodity=X
   */
  async getMandis(commodity) {
    return apiRequest(`/farmer/price-insight/mandis?commodity=${encodeURIComponent(commodity)}`);
  },

  /**
   * Get all market insight categories with counts
   * GET /api/farmer/price-insight/categories
   */
  async getCategories() {
    return apiRequest('/farmer/price-insight/categories');
  },

  /**
   * Get commodities and insights for a specific category
   * GET /api/farmer/price-insight/categories/:categoryId
   */
  async getCategoryInsights(categoryId) {
    return apiRequest(`/farmer/price-insight/categories/${encodeURIComponent(categoryId)}`);
  }
};

// ============================================
// PROFILE API
// ============================================

export const profileAPI = {
  /**
   * Get current user profile
   * GET /api/auth/me
   */
  async getProfile() {
    return apiRequest('/auth/me');
  },

  /**
   * Update user profile
   * PATCH /api/auth/profile
   */
  async updateProfile(profileData) {
    return apiRequest('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(profileData)
    });
  }
};

// ============================================
// NOTIFICATION API
// ============================================

export const notificationAPI = {
  /**
   * Get user's notifications
   * GET /api/notifications
   */
  async getNotifications(unreadOnly = false) {
    const query = unreadOnly ? '?unreadOnly=true' : '';
    return apiRequest(`/notifications${query}`);
  },

  /**
   * Mark notification as read
   * PATCH /api/notifications/:id/read
   */
  async markAsRead(notificationId) {
    return apiRequest(`/notifications/${notificationId}/read`, {
      method: 'PATCH'
    });
  },

  /**
   * Mark all notifications as read
   * PATCH /api/notifications/read-all
   */
  async markAllAsRead() {
    return apiRequest('/notifications/read-all', {
      method: 'PATCH'
    });
  }
};

// ============================================
// FEEDBACK API
// ============================================

export const feedbackAPI = {
  /**
   * Submit feedback for an order (consumer only)
   * POST /api/feedback
   */
  async submit(feedbackData) {
    return apiRequest('/feedback', {
      method: 'POST',
      body: JSON.stringify(feedbackData)
    });
  },

  /**
   * Get farmer's feedback
   * GET /api/feedback/farmer/all
   */
  async getFarmerFeedback() {
    return apiRequest('/feedback/farmer/all');
  },

  /**
   * Get logistics feedback
   * GET /api/feedback/logistics/all
   */
  async getLogisticsFeedback() {
    return apiRequest('/feedback/logistics/all');
  },

  /**
   * Get feedback for specific order
   * GET /api/feedback/:orderId
   */
  async getOrderFeedback(orderId) {
    return apiRequest(`/feedback/${orderId}`);
  }
};

// ============================================
// ROUTE PLANNING API (Logistics only)
// ============================================

export const routePlanAPI = {
  async createPlan(planData) {
    return apiRequest('/logistics/routes/plan', {
      method: 'POST',
      body: JSON.stringify(planData)
    });
  },
  async getPlans(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/logistics/routes${query ? '?' + query : ''}`);
  },
  async getPlanById(id) {
    return apiRequest(`/logistics/routes/${id}`);
  },
  async assignDriver(id, driverId) {
    return apiRequest(`/logistics/routes/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ driverId })
    });
  },
  async updateStopStatus(routeId, stopId, data) {
    return apiRequest(`/logistics/routes/${routeId}/stops/${stopId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }
};

// ============================================
// KPI API (Logistics only)
// ============================================

export const kpiAPI = {
  async getSummary(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/logistics/kpi/summary${query ? '?' + query : ''}`);
  },
  async getOnTime(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/logistics/kpi/on-time${query ? '?' + query : ''}`);
  },
  async getAvgDistance(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/logistics/kpi/avg-distance${query ? '?' + query : ''}`);
  },
  async getCapacityUtilization(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/logistics/kpi/capacity-utilization${query ? '?' + query : ''}`);
  },
  async getTimeSeries(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/logistics/kpi/time-series${query ? '?' + query : ''}`);
  }
};

// ============================================
// PLATFORM PRICE API (Farmer only)
// ============================================

export const platformPriceAPI = {
  async getPrices(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/farmer/platform-prices${query ? '?' + query : ''}`);
  },
  async comparePrices(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/farmer/price-insight/compare${query ? '?' + query : ''}`);
  },
  /** Get product names that have delivered orders (for commodity dropdown) */
  async getTradedCommodities() {
    return apiRequest('/farmer/platform-prices/commodities');
  }
};

// ============================================
// DEMAND FORECAST API (Farmer only)
// ============================================

export const demandForecastAPI = {
  async getForecast(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/farmer/demand-forecast${query ? '?' + query : ''}`);
  },
  async generateForecast(data) {
    return apiRequest('/farmer/demand-forecast/generate', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
};

// ============================================
// LOCATION API (All roles)
// ============================================

export const locationAPI = {
  // === Primary Location (all roles) ===
  async getPrimaryLocation() {
    return apiRequest('/location/primary');
  },
  async updatePrimaryLocation(data) {
    return apiRequest('/location/primary', {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  // === Farmer Pickup Locations ===
  async getPickupLocations() {
    return apiRequest('/location/pickup');
  },
  async addPickupLocation(data) {
    return apiRequest('/location/pickup', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async updatePickupLocation(locationId, data) {
    return apiRequest(`/location/pickup/${locationId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },
  async deletePickupLocation(locationId) {
    return apiRequest(`/location/pickup/${locationId}`, {
      method: 'DELETE'
    });
  },

  // === Consumer Delivery Addresses ===
  async getDeliveryAddresses() {
    return apiRequest('/location/delivery-address');
  },
  async addDeliveryAddress(data) {
    return apiRequest('/location/delivery-address', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async updateDeliveryAddress(addressId, data) {
    return apiRequest(`/location/delivery-address/${addressId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },
  async deleteDeliveryAddress(addressId) {
    return apiRequest(`/location/delivery-address/${addressId}`, {
      method: 'DELETE'
    });
  },

  // === Driver Location & Availability ===
  async updateDriverLocation(data) {
    return apiRequest('/location/driver/current', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async toggleDriverAvailability(isAvailable) {
    return apiRequest('/location/driver/availability', {
      method: 'PATCH',
      body: JSON.stringify({ isAvailable })
    });
  },
  async getDriverStatus() {
    return apiRequest('/location/driver/status');
  },

  // === Smart Driver Assignment ===
  async findNearestDrivers(data) {
    return apiRequest('/location/find-drivers', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // === Order Origin ===
  async getOrderOrigin(orderId) {
    return apiRequest(`/location/order/${orderId}/origin`);
  }
};
