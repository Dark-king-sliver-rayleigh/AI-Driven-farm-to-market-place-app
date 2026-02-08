import React, { useState, useCallback } from 'react';
import { useLogisticsTracking, LogisticsTrackingProvider } from '../../context/LogisticsTrackingContext';
import { LogisticsTrackingMap } from './LogisticsTrackingMap';
import { DRIVER_ACTIONS } from '../../services/trackingService';

/**
 * DriverTrackingPanel Component
 * 
 * PURPOSE:
 * Driver-facing UI for managing delivery tracking.
 * Allows driver to update logistics state and view map.
 * 
 * FEATURES:
 * - Real-time map visualization
 * - State transition buttons
 * - Location update (GPS or simulated)
 * - Order and customer details
 * 
 * PROPS:
 * @param {string} orderId - Order ID to track
 * @param {Object} orderDetails - Order information to display
 * @param {string} geoapifyApiKey - Geoapify API key
 * @param {function} onDeliveryComplete - Callback when delivery is marked complete
 */

function DriverTrackingPanelContent({
  orderId,
  orderDetails,
  geoapifyApiKey,
  onDeliveryComplete
}) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  
  const {
    tracking,
    currentState,
    stateMessage,
    markerColor,
    isActive,
    isDelivered,
    distance,
    eta,
    updateState,
    simulateMovement,
    LOGISTICS_STATES
  } = useLogisticsTracking();
  
  /**
   * Handle state transition
   */
  const handleStateUpdate = useCallback(async (nextState) => {
    try {
      setIsUpdating(true);
      setUpdateError(null);
      
      await updateState(nextState);
      
      if (nextState === 'DELIVERED' && onDeliveryComplete) {
        onDeliveryComplete();
      }
    } catch (err) {
      setUpdateError(err.message);
    } finally {
      setIsUpdating(false);
    }
  }, [updateState, onDeliveryComplete]);
  
  /**
   * Handle simulation (dev mode only)
   */
  const handleSimulate = useCallback(async () => {
    try {
      setIsUpdating(true);
      await simulateMovement(2); // Move 2 steps
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsUpdating(false);
    }
  }, [simulateMovement]);
  
  // Get action configuration for current state
  const actionConfig = currentState ? DRIVER_ACTIONS[currentState] : null;
  
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-4 text-white">
        <h2 className="text-xl font-bold">Delivery Tracking</h2>
        <p className="text-emerald-100 text-sm">Order #{orderId?.slice(-8)}</p>
      </div>
      
      {/* Map */}
      <div className="p-4">
        <LogisticsTrackingMap
          orderId={orderId}
          geoapifyApiKey={geoapifyApiKey}
          className="h-80 sm:h-96"
        />
      </div>
      
      {/* Status Card */}
      <div className="px-6 py-4 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: markerColor }}
              />
              <span className="font-semibold text-gray-800">{stateMessage}</span>
            </div>
            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
              {distance?.remaining && (
                <span>📏 {distance.remaining} remaining</span>
              )}
              {eta?.text && (
                <span>⏱️ ETA: {eta.text}</span>
              )}
            </div>
          </div>
          
          {/* Progress indicator */}
          {tracking?.routeProgress && (
            <div className="text-right">
              <span className="text-2xl font-bold text-gray-800">
                {tracking.routeProgress.percentComplete}%
              </span>
              <p className="text-xs text-gray-400">Complete</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Action Buttons */}
      {isActive && actionConfig && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          {updateError && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              {updateError}
            </div>
          )}
          
          <div className="flex space-x-3">
            <button
              onClick={() => handleStateUpdate(actionConfig.nextState)}
              disabled={isUpdating}
              className={`flex-1 py-3 px-4 rounded-lg text-white font-semibold transition-all
                ${actionConfig.buttonColor} hover:opacity-90
                ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {isUpdating ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Updating...
                </span>
              ) : (
                actionConfig.buttonText
              )}
            </button>
            
            {/* Dev mode: Simulate movement button */}
            {import.meta.env.DEV && currentState === 'IN_TRANSIT' && (
              <button
                onClick={handleSimulate}
                disabled={isUpdating}
                className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                title="Simulate driver movement (Dev only)"
              >
                🔧 Simulate
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Delivery Complete */}
      {isDelivered && (
        <div className="px-6 py-6 bg-green-50 border-t border-green-100">
          <div className="text-center">
            <div className="text-4xl mb-2">✅</div>
            <h3 className="text-xl font-bold text-green-700">Delivery Complete!</h3>
            <p className="text-green-600 mt-1">Order has been successfully delivered</p>
            {tracking?.deliveredAt && (
              <p className="text-sm text-green-500 mt-2">
                Delivered at {new Date(tracking.deliveredAt).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      )}
      
      {/* Order Details */}
      {orderDetails && (
        <div className="px-6 py-4 border-t border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-3">Order Details</h3>
          
          <div className="space-y-3">
            {/* Pickup Location */}
            <div className="flex items-start space-x-3">
              <span className="text-xl">🌾</span>
              <div>
                <p className="font-medium text-gray-700">Pickup</p>
                <p className="text-sm text-gray-500">{orderDetails.pickupAddress}</p>
                {orderDetails.farmerName && (
                  <p className="text-sm text-gray-400">From: {orderDetails.farmerName}</p>
                )}
              </div>
            </div>
            
            {/* Delivery Location */}
            <div className="flex items-start space-x-3">
              <span className="text-xl">🏠</span>
              <div>
                <p className="font-medium text-gray-700">Delivery</p>
                <p className="text-sm text-gray-500">{orderDetails.deliveryAddress}</p>
                {orderDetails.consumerName && (
                  <p className="text-sm text-gray-400">To: {orderDetails.consumerName}</p>
                )}
                {orderDetails.consumerPhone && (
                  <a
                    href={`tel:${orderDetails.consumerPhone}`}
                    className="text-sm text-blue-500 hover:underline"
                  >
                    📞 {orderDetails.consumerPhone}
                  </a>
                )}
              </div>
            </div>
            
            {/* Items */}
            {orderDetails.items && orderDetails.items.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="font-medium text-gray-700 mb-2">Items</p>
                <div className="space-y-2">
                  {orderDetails.items.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-gray-600">{item.name}</span>
                      <span className="text-gray-500">{item.quantity} {item.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* State History */}
      {tracking?.stateHistory && tracking.stateHistory.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-3">Tracking History</h3>
          <div className="space-y-2">
            {tracking.stateHistory.slice().reverse().map((event, index) => (
              <div key={index} className="flex items-center text-sm">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-3" />
                <div className="flex-1">
                  <span className="text-gray-700">{event.to}</span>
                  {event.remarks && (
                    <span className="text-gray-400 ml-2">- {event.remarks}</span>
                  )}
                </div>
                <span className="text-gray-400 text-xs">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Wrapper component that provides the tracking context
 */
export function DriverTrackingPanel(props) {
  return (
    <LogisticsTrackingProvider>
      <DriverTrackingPanelContent {...props} />
    </LogisticsTrackingProvider>
  );
}

export default DriverTrackingPanel;
