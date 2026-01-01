import { useState, useEffect, useCallback } from 'react';
import { productAPI, orderAPI, logisticsAPI, notificationAPI } from '../services/api';

/**
 * Hook for farmer's products
 */
export function useFarmerProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await productAPI.getMyProducts();
      setProducts(response.products || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const createProduct = async (productData) => {
    const response = await productAPI.create(productData);
    await fetchProducts(); // Refresh list
    return response;
  };

  const updateProductStatus = async (productId, status) => {
    const response = await productAPI.updateStatus(productId, status);
    await fetchProducts(); // Refresh list
    return response;
  };

  return {
    products,
    loading,
    error,
    refetch: fetchProducts,
    createProduct,
    updateProductStatus
  };
}

/**
 * Hook for available products (consumers)
 */
export function useAvailableProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await productAPI.getAvailable();
      setProducts(response.products || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, loading, error, refetch: fetchProducts };
}

/**
 * Hook for consumer's orders
 */
export function useConsumerOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await orderAPI.getConsumerOrders();
      setOrders(response.orders || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const createOrder = async (orderData) => {
    const response = await orderAPI.create(orderData);
    await fetchOrders(); // Refresh list
    return response;
  };

  return { orders, loading, error, refetch: fetchOrders, createOrder };
}

/**
 * Hook for farmer's orders
 */
export function useFarmerOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await orderAPI.getFarmerOrders();
      setOrders(response.orders || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { orders, loading, error, refetch: fetchOrders };
}

/**
 * Hook for logistics - available orders
 */
export function useAvailableOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrders = useCallback(async (status = 'CREATED') => {
    try {
      setLoading(true);
      setError(null);
      const response = await logisticsAPI.getAvailableOrders(status);
      setOrders(response.orders || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { orders, loading, error, refetch: fetchOrders };
}

/**
 * Hook for logistics - my deliveries
 */
export function useMyDeliveries() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDeliveries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await logisticsAPI.getMyDeliveries();
      setDeliveries(response.deliveries || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  const acceptOrder = async (orderId, locationData) => {
    const response = await logisticsAPI.acceptOrder(orderId, locationData);
    await fetchDeliveries(); // Refresh list
    return response;
  };

  const updateStatus = async (orderId, status) => {
    const response = await logisticsAPI.updateStatus(orderId, status);
    await fetchDeliveries(); // Refresh list
    return response;
  };

  return { 
    deliveries, 
    loading, 
    error, 
    refetch: fetchDeliveries,
    acceptOrder,
    updateStatus
  };
}

/**
 * Hook for user's notifications
 */
export function useNotifications(unreadOnly = false) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await notificationAPI.getNotifications(unreadOnly);
      setNotifications(response.notifications || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (notificationId) => {
    await notificationAPI.markAsRead(notificationId);
    await fetchNotifications();
  };

  const markAllAsRead = async () => {
    await notificationAPI.markAllAsRead();
    await fetchNotifications();
  };

  return { 
    notifications, 
    loading, 
    error, 
    refetch: fetchNotifications,
    markAsRead,
    markAllAsRead
  };
}

/**
 * Hook for order timeline (delivery tracking)
 */
export function useOrderTimeline(orderId) {
  const [timeline, setTimeline] = useState([]);
  const [deliveryStatus, setDeliveryStatus] = useState(null);
  const [isDelayed, setIsDelayed] = useState(false);
  const [expectedDeliveryTime, setExpectedDeliveryTime] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTimeline = useCallback(async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await orderAPI.getTimeline(orderId);
      setTimeline(response.timeline || []);
      setDeliveryStatus(response.deliveryStatus || null);
      setIsDelayed(response.isDelayed || false);
      setExpectedDeliveryTime(response.expectedDeliveryTime || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  return { 
    timeline, 
    deliveryStatus,
    isDelayed,
    expectedDeliveryTime,
    loading, 
    error, 
    refetch: fetchTimeline 
  };
}

