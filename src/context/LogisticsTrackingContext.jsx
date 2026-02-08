import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { trackingAPI, LOGISTICS_STATES, STATE_MESSAGES, STATE_MARKER_COLORS } from '../services/trackingService';

/**
 * LogisticsTrackingContext
 * 
 * PURPOSE:
 * Provides centralized state management for real-time logistics tracking.
 * Handles polling, state updates, and error recovery.
 * 
 * FEATURES:
 * - Automatic polling every 5-10 seconds
 * - Exponential backoff on errors
 * - State transition handling
 * - ETA countdown timer
 * 
 * USAGE:
 * const { tracking, isLoading, startTracking, stopTracking } = useLogisticsTracking();
 */

const LogisticsTrackingContext = createContext(null);

// Polling configuration
const POLLING_INTERVAL_MS = 5000; // 5 seconds
const MAX_RETRY_INTERVAL_MS = 30000; // 30 seconds max
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second

/**
 * LogisticsTrackingProvider
 * 
 * Wrap your app or tracking page with this provider to enable
 * real-time tracking functionality.
 */
export function LogisticsTrackingProvider({ children }) {
  // Tracking state
  const [tracking, setTracking] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  
  // ETA countdown (seconds remaining)
  const [etaCountdown, setEtaCountdown] = useState(null);
  
  // Refs for polling control
  const pollingIntervalRef = useRef(null);
  const retryDelayRef = useRef(INITIAL_RETRY_DELAY_MS);
  const orderIdRef = useRef(null);
  
  /**
   * Fetch tracking data for an order
   */
  const fetchTracking = useCallback(async (orderId) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await trackingAPI.getTracking(orderId);
      
      if (response.success && response.tracking) {
        setTracking(response.tracking);
        setEtaCountdown(response.tracking.eta?.seconds || null);
        retryDelayRef.current = INITIAL_RETRY_DELAY_MS; // Reset retry delay on success
        
        // Stop polling if delivery is complete
        if (!response.tracking.isActive) {
          stopPolling();
        }
      } else {
        setTracking(null);
      }
      
      return response;
    } catch (err) {
      setError(err.message);
      console.error('Error fetching tracking:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  /**
   * Start polling for tracking updates
   */
  const startPolling = useCallback((orderId) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    orderIdRef.current = orderId;
    setIsPolling(true);
    
    // Initial fetch
    fetchTracking(orderId);
    
    // Set up polling interval
    pollingIntervalRef.current = setInterval(async () => {
      if (!orderIdRef.current) return;
      
      try {
        await fetchTracking(orderIdRef.current);
      } catch (err) {
        // Implement exponential backoff on error
        retryDelayRef.current = Math.min(
          retryDelayRef.current * 2,
          MAX_RETRY_INTERVAL_MS
        );
        console.warn(`Tracking fetch failed, retrying in ${retryDelayRef.current}ms`);
      }
    }, POLLING_INTERVAL_MS);
  }, [fetchTracking]);
  
  /**
   * Stop polling for updates
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
    orderIdRef.current = null;
  }, []);
  
  /**
   * Start tracking for an order
   * Begins polling for real-time updates
   */
  const startTracking = useCallback((orderId) => {
    if (!orderId) {
      console.error('Order ID is required to start tracking');
      return;
    }
    startPolling(orderId);
  }, [startPolling]);
  
  /**
   * Stop tracking and clear state
   */
  const stopTracking = useCallback(() => {
    stopPolling();
    setTracking(null);
    setEtaCountdown(null);
    setError(null);
  }, [stopPolling]);
  
  /**
   * Manually refresh tracking data
   */
  const refreshTracking = useCallback(async () => {
    if (!orderIdRef.current) {
      console.error('No order is currently being tracked');
      return;
    }
    return fetchTracking(orderIdRef.current);
  }, [fetchTracking]);
  
  /**
   * Update logistics state (driver only)
   */
  const updateState = useCallback(async (state, remarks = null) => {
    if (!orderIdRef.current) {
      throw new Error('No order is currently being tracked');
    }
    
    try {
      setIsLoading(true);
      const response = await trackingAPI.updateState(orderIdRef.current, state, remarks);
      
      if (response.success && response.tracking) {
        setTracking(response.tracking);
        setEtaCountdown(response.tracking.eta?.seconds || null);
      }
      
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  /**
   * Update driver location (driver only)
   */
  const updateDriverLocation = useCallback(async (location, routeIndex = null) => {
    if (!orderIdRef.current) {
      throw new Error('No order is currently being tracked');
    }
    
    try {
      const response = await trackingAPI.updateDriverLocation(
        orderIdRef.current,
        location,
        routeIndex
      );
      
      if (response.success && response.tracking) {
        setTracking(response.tracking);
        setEtaCountdown(response.tracking.eta?.seconds || null);
      }
      
      return response;
    } catch (err) {
      console.error('Error updating driver location:', err);
      throw err;
    }
  }, []);
  
  /**
   * Simulate driver movement (development only)
   */
  const simulateMovement = useCallback(async (steps = 1) => {
    if (!orderIdRef.current) {
      throw new Error('No order is currently being tracked');
    }
    
    try {
      const response = await trackingAPI.simulateMovement(orderIdRef.current, steps);
      
      if (response.success && response.tracking) {
        setTracking(response.tracking);
        setEtaCountdown(response.tracking.eta?.seconds || null);
      }
      
      return response;
    } catch (err) {
      console.error('Error simulating movement:', err);
      throw err;
    }
  }, []);
  
  /**
   * ETA countdown timer
   * Decrements every second when tracking is active
   */
  useEffect(() => {
    if (!tracking?.isActive || etaCountdown === null || etaCountdown <= 0) {
      return;
    }
    
    const timer = setInterval(() => {
      setEtaCountdown(prev => {
        if (prev === null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [tracking?.isActive, etaCountdown]);
  
  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);
  
  /**
   * Format ETA countdown for display
   */
  const formatEtaCountdown = useCallback((seconds) => {
    if (seconds === null || seconds === undefined) return '--';
    if (seconds <= 0) return 'Arriving now';
    
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  }, []);
  
  // Context value
  const value = {
    // State
    tracking,
    isLoading,
    error,
    isPolling,
    etaCountdown,
    
    // Computed values
    currentState: tracking?.currentState || null,
    stateMessage: tracking?.stateMessage || STATE_MESSAGES[tracking?.currentState] || null,
    markerColor: tracking?.markerColor || STATE_MARKER_COLORS[tracking?.currentState] || null,
    driverLocation: tracking?.driverLocation || null,
    farmerLocation: tracking?.farmerLocation || null,
    consumerLocation: tracking?.consumerLocation || null,
    routePolyline: tracking?.routePolyline || null,
    distance: tracking?.distance || null,
    eta: tracking?.eta || null,
    driver: tracking?.driver || null,
    isDelivered: tracking?.currentState === LOGISTICS_STATES.DELIVERED,
    isActive: tracking?.isActive ?? false,
    progressPercentage: tracking?.routeProgress?.percentComplete || 0,
    
    // Methods
    startTracking,
    stopTracking,
    refreshTracking,
    updateState,
    updateDriverLocation,
    simulateMovement,
    formatEtaCountdown,
    
    // Constants
    LOGISTICS_STATES,
    STATE_MESSAGES,
    STATE_MARKER_COLORS
  };
  
  return (
    <LogisticsTrackingContext.Provider value={value}>
      {children}
    </LogisticsTrackingContext.Provider>
  );
}

/**
 * Hook to access logistics tracking context
 * 
 * @returns {Object} Tracking state and methods
 * @throws {Error} If used outside LogisticsTrackingProvider
 */
export function useLogisticsTracking() {
  const context = useContext(LogisticsTrackingContext);
  
  if (!context) {
    throw new Error(
      'useLogisticsTracking must be used within a LogisticsTrackingProvider'
    );
  }
  
  return context;
}

export default LogisticsTrackingContext;
